-- D10_background_queues_v1 (10.11.2026): background queues that do not overload the database.
-- On 10.11 the 360 recount (every 10 s, up to 500 cards per run, no time limit) and the synonym recount (every 10 s,
-- up to 200 cards + 1000 synonym columns per run) ran for up to 280 s each on a slow disk while new runs kept starting;
-- together with 130 stale open jobs this used up the disk IO budget and stopped the database.
--   1) lexeme360_refresh_drain_v1: the same steps in chunks of 50 cards; stops taking chunks after 20 s.
--   2) synonym_refresh_drain_v1: 20 s budget in both phases (what is not done stays queued); phase B reads <= 2 x p_max.
--   3) cron: both drains every 30 s (was 10 s) with statement_timeout 55 s; the synonym tick with statement_timeout
--      120 s; the three jobs paused by 401 are switched back on.
-- Nothing in the calculations changes. Rollback: optional/rollback_d10_background_queues_v1.sql.

CREATE OR REPLACE FUNCTION public.lexeme360_refresh_drain_v1(p_max_lexemes integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
-- D10_lexeme360_queue_v1 (02.11.2026): recompute queued cards. One drain at a time (advisory lock).
-- Never waits for a lock: cards are locked in id order with SKIP LOCKED; a card held by a writer stays
-- in the queue for the next drain. Only queue rows read before the calculation are removed, so a change
-- committed later is always recomputed by a later drain.
-- D10_background_queues_v1 (10.11.2026): the same steps, in chunks of 50 cards, and the drain stops taking new
-- chunks after 20 s (the rest waits for the next run) - one run no longer grows to minutes on a slow disk.
DECLARE
  v_chunk constant integer := 50;
  v_budget constant interval := interval '20 seconds';
  v_max integer := greatest(coalesce(p_max_lexemes, 500), 1);
  v_seen uuid[] := '{}';
  v_ids uuid[];
  v_rows bigint[];
  v_cid uuid[]; v_ready integer[]; v_cand integer[]; v_root text[];
  v_need uuid[]; v_locked uuid[]; v_skipped uuid[];
  v_n integer;
  v_processed integer := 0; v_updated integer := 0; v_skipped_n integer := 0; v_deleted integer := 0;
  v_chunks integer := 0;
  v_t0 timestamptz := clock_timestamp();
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('lexeme360_refresh_drain_v1', 0)) THEN
    RETURN jsonb_build_object('ok', true, 'busy', true,
      'pending', (SELECT count(DISTINCT q.lexeme_id) FROM private.lexeme360_refresh_queue_v1 q));
  END IF;

  LOOP
    EXIT WHEN v_processed >= v_max OR clock_timestamp() - v_t0 > v_budget;
    v_ids := NULL; v_rows := NULL; v_need := NULL; v_locked := NULL; v_skipped := NULL;
    v_cid := NULL; v_ready := NULL; v_cand := NULL; v_root := NULL;

    SELECT array_agg(p.lexeme_id ORDER BY p.lexeme_id) INTO v_ids
    FROM (SELECT q.lexeme_id FROM private.lexeme360_refresh_queue_v1 q
          WHERE NOT (q.lexeme_id = ANY(v_seen))
          GROUP BY q.lexeme_id ORDER BY min(q.id)
          LIMIT least(v_chunk, v_max - v_processed)) p;
    EXIT WHEN v_ids IS NULL;
    v_seen := v_seen || v_ids;
    v_chunks := v_chunks + 1;

    SELECT array_agg(q.id) INTO v_rows
    FROM private.lexeme360_refresh_queue_v1 q WHERE q.lexeme_id = ANY(v_ids);

    SELECT array_agg(c.id ORDER BY c.id), array_agg(c.ready_count ORDER BY c.id),
           array_agg(c.candidate_count ORDER BY c.id), array_agg(c.display_root ORDER BY c.id)
    INTO v_cid, v_ready, v_cand, v_root
    FROM private.lexeme360_calc_v1(v_ids) c;

    SELECT array_agg(lexeme.id ORDER BY lexeme.id) INTO v_need
    FROM public.lexemes lexeme
    JOIN unnest(v_cid, v_ready, v_cand, v_root) AS calc(id, ready_count, candidate_count, display_root)
      ON calc.id = lexeme.id
    WHERE (lexeme.lexeme360_root_lemma, lexeme.lexeme360_ready_count,
           lexeme.lexeme360_candidate_count, lexeme.lexeme360_policy_version)
          IS DISTINCT FROM
          (calc.display_root, calc.ready_count, calc.candidate_count,
           'lexeme360-family/v2-root-identity'::text);

    IF v_need IS NOT NULL THEN
      SELECT array_agg(z.id ORDER BY z.id) INTO v_locked
      FROM (SELECT lexeme.id FROM public.lexemes lexeme
            WHERE lexeme.id = ANY(v_need)
            ORDER BY lexeme.id
            FOR UPDATE SKIP LOCKED) z;

      IF v_locked IS NOT NULL THEN
        UPDATE public.lexemes lexeme
        SET
          lexeme360_root_lemma = calc.display_root,
          lexeme360_ready_count = calc.ready_count,
          lexeme360_candidate_count = calc.candidate_count,
          lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
          lexeme360_refreshed_at = clock_timestamp()
        FROM unnest(v_cid, v_ready, v_cand, v_root) AS calc(id, ready_count, candidate_count, display_root)
        WHERE lexeme.id = calc.id
          AND lexeme.id = ANY(v_locked)
          AND (lexeme.lexeme360_root_lemma, lexeme.lexeme360_ready_count,
               lexeme.lexeme360_candidate_count, lexeme.lexeme360_policy_version)
              IS DISTINCT FROM
              (calc.display_root, calc.ready_count, calc.candidate_count,
               'lexeme360-family/v2-root-identity'::text);
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_updated := v_updated + v_n;
      END IF;

      v_skipped := ARRAY(SELECT unnest(v_need) EXCEPT SELECT unnest(coalesce(v_locked, '{}'::uuid[])));
    END IF;

    DELETE FROM private.lexeme360_refresh_queue_v1 q
    WHERE q.id = ANY(v_rows)
      AND NOT (q.lexeme_id = ANY(coalesce(v_skipped, '{}'::uuid[])));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted + v_n;
    v_processed := v_processed + cardinality(v_ids);
    v_skipped_n := v_skipped_n + coalesce(cardinality(v_skipped), 0);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'updated', v_updated,
    'skipped', v_skipped_n,
    'queue_rows_removed', v_deleted,
    'chunks', v_chunks,
    'pending', (SELECT count(DISTINCT q.lexeme_id) FROM private.lexeme360_refresh_queue_v1 q),
    'ms', round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.synonym_refresh_drain_v1(p_max integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
-- D10_synonym_queue_v2 (02.11.2026): background part of the synonym chain. One drain at a time.
-- Phase A: card changes -> for every affected candidate (same selection as before, in id order) the unchanged
--   loop body, each candidate in its own sub-transaction with NOWAIT / lock_timeout; a candidate that cannot be
--   locked keeps its cards queued for the next drain.
-- Phase B: lexemes.synonyms rebuild with the unchanged sync_lexeme_synonym_column, cards locked in id order with
--   SKIP LOCKED; a held card stays queued. Only queue rows read before processing are removed.
-- D10_background_queues_v1 (10.11.2026): a time budget of 20 s - phase A stops taking candidates (their cards stay
--   queued) and phase B stops rebuilding columns (the rest stays queued); phase B reads at most 2 x p_max cards.
DECLARE
  v_ids uuid[]; v_rows bigint[]; v_err text; v_cand uuid; v_failed uuid[] := '{}'; v_keep uuid[] := '{}';
  v_done_cand integer := 0; v_lex uuid[]; v_lrows bigint[]; v_locked uuid[]; v_synced integer := 0;
  v_prev_lt text := current_setting('lock_timeout');
  v_t0 timestamptz := clock_timestamp();
  v_budget constant interval := interval '20 seconds';
  v_x uuid; v_synced_ids uuid[] := '{}';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('synonym_refresh_drain_v1', 0)) THEN
    RETURN jsonb_build_object('ok', true, 'busy', true);
  END IF;
  PERFORM set_config('lock_timeout', '2s', true);

  -- Phase A
  SELECT array_agg(p.entity_id ORDER BY p.entity_id) INTO v_ids
  FROM (SELECT q.entity_id FROM private.synonym_card_change_queue_v1 q
        GROUP BY q.entity_id ORDER BY min(q.id) LIMIT greatest(coalesce(p_max, 200), 1)) p;
  IF v_ids IS NOT NULL THEN
    SELECT array_agg(q.id) INTO v_rows FROM private.synonym_card_change_queue_v1 q WHERE q.entity_id = ANY(v_ids);
    FOR v_cand IN
      SELECT DISTINCT c.id FROM public.synonym_candidate_queue c WHERE c.source_active AND
       (c.source_entity_id = ANY(v_ids) OR EXISTS(SELECT 1 FROM public.synonym_pair_v1 p
        WHERE p.candidate_id = c.id AND p.target_entity_id = ANY(v_ids)))
      ORDER BY c.id
    LOOP
      IF clock_timestamp() - v_t0 > v_budget THEN
        v_failed := v_failed || v_cand;  -- not done in this run: its cards stay queued
        CONTINUE;
      END IF;
      BEGIN
        PERFORM private.synonym_card_change_apply_v1(v_cand);
        v_done_cand := v_done_cand + 1;
      EXCEPTION
        WHEN lock_not_available OR deadlock_detected THEN
          v_failed := v_failed || v_cand;
        WHEN OTHERS THEN
          v_failed := v_failed || v_cand;
          v_err := coalesce(v_err, left(SQLSTATE || ' ' || SQLERRM, 300));
      END;
    END LOOP;
    IF cardinality(v_failed) > 0 THEN
      SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_keep FROM (
        SELECT c.source_entity_id x FROM public.synonym_candidate_queue c WHERE c.id = ANY(v_failed)
        UNION SELECT p.target_entity_id FROM public.synonym_pair_v1 p WHERE p.candidate_id = ANY(v_failed)) z
      WHERE x = ANY(v_ids);
    END IF;
    DELETE FROM private.synonym_card_change_queue_v1 q
    WHERE q.id = ANY(v_rows) AND NOT (q.entity_id = ANY(v_keep));
  END IF;

  -- Phase B
  SELECT array_agg(p.lexeme_id ORDER BY p.lexeme_id) INTO v_lex
  FROM (SELECT q.lexeme_id FROM private.synonym_column_queue_v1 q
        GROUP BY q.lexeme_id ORDER BY min(q.id) LIMIT greatest(coalesce(p_max, 200), 1) * 2) p;
  IF v_lex IS NOT NULL THEN
    SELECT array_agg(q.id) INTO v_lrows FROM private.synonym_column_queue_v1 q WHERE q.lexeme_id = ANY(v_lex);
    SELECT array_agg(z.id ORDER BY z.id) INTO v_locked
    FROM (SELECT l.id FROM public.lexemes l WHERE l.id = ANY(v_lex) ORDER BY l.id FOR UPDATE SKIP LOCKED) z;
    IF v_locked IS NOT NULL THEN
      FOREACH v_x IN ARRAY v_locked LOOP
        EXIT WHEN clock_timestamp() - v_t0 > v_budget;
        PERFORM public.sync_lexeme_synonym_column(v_x);
        v_synced_ids := v_synced_ids || v_x;
      END LOOP;
      v_synced := cardinality(v_synced_ids);
    END IF;
    -- remove processed rows; cards that do not exist are dropped too; held or not yet rebuilt cards stay
    DELETE FROM private.synonym_column_queue_v1 q
    WHERE q.id = ANY(v_lrows)
      AND (q.lexeme_id = ANY(v_synced_ids)
           OR NOT EXISTS (SELECT 1 FROM public.lexemes l WHERE l.id = q.lexeme_id));
  END IF;

  PERFORM set_config('lock_timeout', v_prev_lt, true);
  RETURN jsonb_build_object('ok', true,
    'cards_processed', coalesce(cardinality(v_ids), 0), 'candidates_done', v_done_cand,
    'candidates_retry', cardinality(v_failed), 'first_error', v_err, 'synonym_columns_rebuilt', v_synced,
    'pending_cards', (SELECT count(DISTINCT entity_id) FROM private.synonym_card_change_queue_v1),
    'pending_columns', (SELECT count(DISTINCT lexeme_id) FROM private.synonym_column_queue_v1),
    'ms', round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1));
END;
$function$;

SELECT j.jobname, cron.alter_job(j.jobid,
    schedule := CASE j.jobname WHEN 'd10-synonym-bm-tick' THEN j.schedule ELSE '30 seconds' END,
    command := CASE j.jobname
      WHEN 'lexeme360-refresh-drain' THEN 'SET statement_timeout = ''55s''; SELECT public.lexeme360_refresh_drain_v1(300)'
      WHEN 'synonym-refresh-drain' THEN 'SET statement_timeout = ''55s''; SELECT public.synonym_refresh_drain_v1(100)'
      ELSE 'SET statement_timeout = ''120s''; SELECT public.d10_synonym_bm_tick_v1()' END,
    active := true) IS NULL AS changed
FROM cron.job j
WHERE j.jobname IN ('lexeme360-refresh-drain', 'synonym-refresh-drain', 'd10-synonym-bm-tick');

SELECT jobname, schedule, active, command FROM cron.job ORDER BY jobname;

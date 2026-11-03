-- 20261102170000_d10_synonym_queue_v2.sql
-- D10_synonym_queue_v2: a change of a card no longer runs the synonym chain inside the writer's transaction.
--  * private.synonym_card_content_changed_v1 (trigger on lexemes): same change checks and same affected entities;
--    the loop over candidates (pairs -> needs_manual_review, refresh queue) moves to public.synonym_refresh_drain_v1.
--  * public.trg_sync_lexeme_synonym_column (trigger on authoritative_semantic_relations): the cards whose
--    lexemes.synonyms must be rebuilt are queued; the drain rebuilds them with the unchanged sync_lexeme_synonym_column.
-- Triggers using the card function (all four checked by the guard): lexemes, entity_translations,
-- private.d10_ai_review_rejections_v1; trg_sync on authoritative_semantic_relations.
-- Synonym rules (what counts as a change, when to withdraw / publish) are unchanged. Drain: one at a time,
-- candidates in id order with NOWAIT per candidate, cards in id order with SKIP LOCKED; pg_cron every 10 s.
-- Run the whole file in SQL Editor. Any STOP -> nothing changed.
-- Rollback: optional/20261102170000_d10_synonym_queue_v2_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_synq_report;
CREATE TEMP TABLE d10_synq_report(part text, name text, info jsonb);

DO $mig$
DECLARE v_list text;
BEGIN
  IF to_regclass('private.synonym_card_change_queue_v1') IS NOT NULL
     OR to_regprocedure('public.synonym_refresh_drain_v1(integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_queue (v1/v2) already installed';
  END IF;
  SELECT string_agg(d.reg || '=' || coalesce(md5(replace(p.prosrc, E'\r', '')), 'MISSING'), ', ') INTO v_list
  FROM (VALUES
    ('private.synonym_card_content_changed_v1()', 'cd29a9098aa9fb84450304463d23f1fc'),
    ('public.trg_sync_lexeme_synonym_column()', 'c447edcd59ee13180f2ad72e22c7152c'),
    ('public.sync_lexeme_synonym_column(uuid)', 'b33aa3a7063f925c125721cb9b47cc02'),
    ('public.d10_synonym_enqueue_refresh_v1(uuid,uuid,text,boolean)', 'abc38b87c860b718c3ff8e9024a9018c'),
    ('public.d10_synonym_publication_on_v1()', '0b04ac6c5a5d7507c998e8a4508a5ecd')
  ) d(reg, md5)
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(d.reg)
  WHERE p.oid IS NULL OR md5(replace(p.prosrc, E'\r', '')) <> d.md5;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: base version differs (changed since export 290): %', v_list; END IF;
  SELECT string_agg(x, ', ') INTO v_list FROM (
    SELECT 'lexemes.synonym_card_identity_changed_v1' x WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'public.lexemes'::regclass AND t.tgname = 'synonym_card_identity_changed_v1'
        AND t.tgfoid = 'private.synonym_card_content_changed_v1()'::regprocedure)
    UNION ALL SELECT 'authoritative_semantic_relations.trg_sync_lexeme_synonym_column' WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'public.authoritative_semantic_relations'::regclass AND t.tgname = 'trg_sync_lexeme_synonym_column'
        AND t.tgfoid = 'public.trg_sync_lexeme_synonym_column()'::regprocedure)
    UNION ALL SELECT 'triggers on these functions: ' || coalesce(string_agg(x.k, ', ' ORDER BY x.k), 'none')
    FROM (SELECT n.nspname || '.' || c.relname || '.' || t.tgname || '>' ||
                 CASE t.tgfoid WHEN 'private.synonym_card_content_changed_v1()'::regprocedure THEN 'card' ELSE 'trg_sync' END AS k
          FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT t.tgisinternal
            AND t.tgfoid IN ('private.synonym_card_content_changed_v1()'::regprocedure, 'public.trg_sync_lexeme_synonym_column()'::regprocedure)) x
    HAVING coalesce(array_agg(x.k ORDER BY x.k), '{}') IS DISTINCT FROM ARRAY[
        'private.d10_ai_review_rejections_v1.synonym_card_review_changed_v1>card',
        'public.authoritative_semantic_relations.trg_sync_lexeme_synonym_column>trg_sync',
        'public.entity_translations.synonym_card_translation_changed_v1>card',
        'public.lexemes.synonym_card_identity_changed_v1>card']
  ) z;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: trigger wiring differs: %', v_list; END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'synonym-refresh-drain') THEN
      RAISE EXCEPTION 'STOP: cron job synonym-refresh-drain already exists';
    END IF;
  END IF;
END
$mig$;

CREATE TABLE private.synonym_card_change_queue_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX synonym_card_change_queue_v1_entity_idx ON private.synonym_card_change_queue_v1 (entity_id, id);
CREATE TABLE private.synonym_column_queue_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lexeme_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX synonym_column_queue_v1_lexeme_idx ON private.synonym_column_queue_v1 (lexeme_id, id);
COMMENT ON TABLE private.synonym_card_change_queue_v1 IS 'D10_synonym_queue_v2: card/expression changes waiting for the synonym chain (append-only).';
COMMENT ON TABLE private.synonym_column_queue_v1 IS 'D10_synonym_queue_v2: cards whose lexemes.synonyms must be rebuilt (append-only).';
REVOKE ALL ON TABLE private.synonym_card_change_queue_v1 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_column_queue_v1 FROM PUBLIC;

CREATE FUNCTION private.synonym_column_enqueue_v1(p_lexeme_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_synonym_queue_v2 (02.11.2026): append cards to the lexemes.synonyms rebuild queue (append-only, never waits).
  INSERT INTO private.synonym_column_queue_v1(lexeme_id)
  SELECT DISTINCT x FROM unnest(p_lexeme_ids) x WHERE x IS NOT NULL;
$f$;

CREATE FUNCTION private.synonym_card_change_apply_v1(p_candidate_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_synonym_queue_v2 (02.11.2026): the loop that synonym_card_content_changed_v1 ran inside the writer's
-- transaction, unchanged, for ONE candidate. Pair rows of the candidate are locked first in id order, NOWAIT:
-- if a row is held (e.g. by the verifier) lock_not_available is raised and the drain retries later.
BEGIN
  PERFORM 1 FROM public.synonym_pair_v1 p
  WHERE p.candidate_id = p_candidate_id AND p.status <> 'superseded'
  ORDER BY p.id FOR UPDATE NOWAIT;

  UPDATE public.synonym_pair_v1 SET status='needs_manual_review',rule_reason='card_content_changed',
   force_recheck=true,lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE candidate_id=p_candidate_id AND status<>'superseded';
  PERFORM public.d10_synonym_enqueue_refresh_v1(p_candidate_id,NULL,'card_content_changed',true);
END;
$f$;

CREATE FUNCTION public.synonym_refresh_drain_v1(p_max integer DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_synonym_queue_v2 (02.11.2026): background part of the synonym chain. One drain at a time.
-- Phase A: card changes -> for every affected candidate (same selection as before, in id order) the unchanged
--   loop body, each candidate in its own sub-transaction with NOWAIT / lock_timeout; a candidate that cannot be
--   locked keeps its cards queued for the next drain.
-- Phase B: lexemes.synonyms rebuild with the unchanged sync_lexeme_synonym_column, cards locked in id order with
--   SKIP LOCKED; a held card stays queued. Only queue rows read before processing are removed.
DECLARE
  v_ids uuid[]; v_rows bigint[]; v_err text; v_cand uuid; v_failed uuid[] := '{}'; v_keep uuid[] := '{}';
  v_done_cand integer := 0; v_lex uuid[]; v_lrows bigint[]; v_locked uuid[]; v_synced integer := 0;
  v_prev_lt text := current_setting('lock_timeout');
  v_t0 timestamptz := clock_timestamp();
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
        GROUP BY q.lexeme_id ORDER BY min(q.id) LIMIT greatest(coalesce(p_max, 200), 1) * 5) p;
  IF v_lex IS NOT NULL THEN
    SELECT array_agg(q.id) INTO v_lrows FROM private.synonym_column_queue_v1 q WHERE q.lexeme_id = ANY(v_lex);
    SELECT array_agg(z.id ORDER BY z.id) INTO v_locked
    FROM (SELECT l.id FROM public.lexemes l WHERE l.id = ANY(v_lex) ORDER BY l.id FOR UPDATE SKIP LOCKED) z;
    IF v_locked IS NOT NULL THEN
      PERFORM public.sync_lexeme_synonym_column(x) FROM unnest(v_locked) x ORDER BY x;
      v_synced := cardinality(v_locked);
    END IF;
    -- remove processed rows; cards that do not exist are dropped too; held cards stay
    DELETE FROM private.synonym_column_queue_v1 q
    WHERE q.id = ANY(v_lrows)
      AND (q.lexeme_id = ANY(coalesce(v_locked, '{}'::uuid[]))
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
$f$;

CREATE FUNCTION public.synonym_refresh_pending_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_synonym_queue_v2 (02.11.2026): queue state, read only.
  SELECT jsonb_build_object(
    'pending_cards', (SELECT count(DISTINCT entity_id) FROM private.synonym_card_change_queue_v1),
    'pending_columns', (SELECT count(DISTINCT lexeme_id) FROM private.synonym_column_queue_v1),
    'oldest_age_s', round(extract(epoch FROM clock_timestamp() - least(
        (SELECT min(requested_at) FROM private.synonym_card_change_queue_v1),
        (SELECT min(requested_at) FROM private.synonym_column_queue_v1)))::numeric, 1));
$f$;

REVOKE ALL ON FUNCTION private.synonym_column_enqueue_v1(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_card_change_apply_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.synonym_refresh_drain_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.synonym_refresh_pending_v1() FROM PUBLIC;
DO $mig$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.synonym_refresh_drain_v1(integer) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.synonym_refresh_pending_v1() FROM %I', r);
      EXECUTE format('REVOKE ALL ON TABLE private.synonym_card_change_queue_v1 FROM %I', r);
      EXECUTE format('REVOKE ALL ON TABLE private.synonym_column_queue_v1 FROM %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.synonym_refresh_drain_v1(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.synonym_refresh_pending_v1() TO service_role;
  END IF;
END
$mig$;

DO $mig$
DECLARE
  r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_item text; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('private.synonym_card_content_changed_v1()', 'private.synonym_card_content_changed_v1()', 'trigger', 'cd29a9098aa9fb84450304463d23f1fc', '8850fcbb50fbfb0a80b5b29d62256e71', $b_card$
-- D10_synonym_queue_v2 (02.11.2026): registration only. The change checks and the set of affected entities
-- (card + expressions of the card) are unchanged; the loop over candidates (pairs -> needs_manual_review,
-- refresh queue) runs in public.synonym_refresh_drain_v1 via private.synonym_card_change_apply_v1.
DECLARE ids uuid[]:='{}'; r record; oldj jsonb;newj jsonb;lid uuid;
BEGIN
 oldj:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 newj:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
 IF TG_TABLE_NAME='lexemes' AND TG_OP='UPDATE' AND
  (oldj->'lemma',oldj->'pos',oldj->'verification_status',oldj->'dictionary_status',oldj->'translation_ua',oldj->'translation_en')
  IS NOT DISTINCT FROM
  (newj->'lemma',newj->'pos',newj->'verification_status',newj->'dictionary_status',newj->'translation_ua',newj->'translation_en') THEN RETURN NULL;END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'lexemes' AND (oldj-'updated_at')=(newj-'updated_at') THEN RETURN NULL;END IF;
 IF TG_TABLE_NAME='lexemes' THEN ids:=ARRAY[coalesce(newj->>'id',oldj->>'id')::uuid];
 ELSE
  ids:=array_remove(ARRAY[(oldj->>'lexeme_id')::uuid,(newj->>'lexeme_id')::uuid,
   (oldj->>'expression_id')::uuid,(newj->>'expression_id')::uuid],NULL);
 END IF;
 SELECT ids||coalesce(array_agg(x.id),'{}'::uuid[]) INTO ids FROM public.expression_catalog x WHERE x.lexeme_id=ANY(ids);
 INSERT INTO private.synonym_card_change_queue_v1(entity_id)
 SELECT DISTINCT x FROM unnest(ids) x WHERE x IS NOT NULL;
 RETURN NULL;
END 
$b_card$),
    ('public.trg_sync_lexeme_synonym_column()', 'public.trg_sync_lexeme_synonym_column()', 'trigger', 'c447edcd59ee13180f2ad72e22c7152c', 'aa7d5a3863732debb6c7d825ab22f748', $b_trg$
-- D10_synonym_queue_v2 (02.11.2026): registration only. The cards whose lexemes.synonyms must be rebuilt are
-- computed exactly as before and appended to private.synonym_column_queue_v1; public.synonym_refresh_drain_v1
-- rebuilds them with the unchanged public.sync_lexeme_synonym_column, locking cards in id order (SKIP LOCKED).
declare
  v_lexeme_id uuid;
  v_old_lexeme_id uuid;
begin
  if TG_OP = 'DELETE' then
    if OLD.relation_type != 'synonym' then
      return OLD;
    end if;

    if OLD.source_entity_type = 'lexeme' then
      v_old_lexeme_id := OLD.source_entity_id;
    elsif OLD.source_entity_type = 'expression' then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.source_entity_id;
    end if;

    perform private.synonym_column_enqueue_v1(ARRAY[v_old_lexeme_id]);
    return OLD;
  end if;

  if NEW.relation_type != 'synonym' then
    return NEW;
  end if;

  if NEW.source_entity_type = 'lexeme' then
    v_lexeme_id := NEW.source_entity_id;
  elsif NEW.source_entity_type = 'expression' then
    select lexeme_id into v_lexeme_id
    from public.expression_catalog
    where id = NEW.source_entity_id;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.source_entity_type = 'lexeme' then
      v_old_lexeme_id := OLD.source_entity_id;
    elsif OLD.source_entity_type = 'expression' then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.source_entity_id;
    end if;
  end if;

  perform private.synonym_column_enqueue_v1(ARRAY[v_lexeme_id, v_old_lexeme_id]);
  return NEW;
end;
$b_trg$)
  ) t(reg, hdr, ret, md5_before, md5_after, body) LOOP
    v_body := replace(r.body, E'\r', '');
    IF md5(v_body) <> r.md5_after THEN RAISE EXCEPTION 'STOP: file body of % damaged (md5 %)', r.reg, md5(v_body); END IF;
    SELECT p.oid, p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_oid, v_secdef, v_cfg, v_md5
    FROM pg_proc p WHERE p.oid = to_regprocedure(r.reg);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: % not found', r.reg; END IF;
    IF v_md5 <> r.md5_before THEN RAISE EXCEPTION 'STOP: % has md5 %, expected %', r.reg, v_md5, r.md5_before; END IF;
    EXECUTE 'CREATE OR REPLACE FUNCTION ' || r.hdr || ' RETURNS ' || r.ret || ' LANGUAGE plpgsql AS ' || quote_literal(v_body);
    IF v_secdef THEN EXECUTE 'ALTER FUNCTION ' || r.reg || ' SECURITY DEFINER'; END IF;
    IF v_cfg IS NOT NULL THEN
      FOREACH v_item IN ARRAY v_cfg LOOP
        EXECUTE format('ALTER FUNCTION %s SET %s TO %s', r.reg, split_part(v_item, '=', 1),
                       substr(v_item, length(split_part(v_item, '=', 1)) + 2));
      END LOOP;
    END IF;
    SELECT p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_secdef2, v_cfg2, v_md5
    FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> r.md5_after OR v_secdef2 IS DISTINCT FROM v_secdef OR v_cfg2 IS DISTINCT FROM v_cfg THEN
      RAISE EXCEPTION 'STOP: % after replace: md5 %, secdef %, config %', r.reg, v_md5, v_secdef2, v_cfg2;
    END IF;
    INSERT INTO d10_synq_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $mig$
DECLARE v_ver text; v_sched text; v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    INSERT INTO d10_synq_report VALUES ('03_cron', 'synonym-refresh-drain', '{"scheduled":false,"reason":"pg_cron not available"}');
    RETURN;
  END IF;
  SELECT extversion INTO v_ver FROM pg_extension WHERE extname = 'pg_cron';
  v_sched := CASE WHEN string_to_array(split_part(v_ver, '-', 1), '.')::int[] >= ARRAY[1,5] THEN '10 seconds' ELSE '* * * * *' END;
  SELECT cron.schedule('synonym-refresh-drain', v_sched, 'select public.synonym_refresh_drain_v1(200)') INTO v_jobid;
  INSERT INTO d10_synq_report VALUES ('03_cron', 'synonym-refresh-drain',
    jsonb_build_object('scheduled', true, 'jobid', v_jobid, 'schedule', v_sched, 'pg_cron', v_ver));
END
$mig$;

-- Probe in a sub-transaction (rolled back): translation change of the card with most published partners.
DO $probe$
DECLARE
  v_card uuid; v_det text; v_t0 timestamptz; v_ms numeric; v_drain jsonb;
  v_other_write bigint; v_pairs_write bigint; v_q bigint; v_partners uuid[]; v_stored jsonb; v_recalc jsonb;
  v_bad_pairs bigint;
BEGIN
  SELECT r.source_entity_id INTO v_card FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym' AND r.source_entity_type = 'lexeme'
  GROUP BY r.source_entity_id ORDER BY count(*) DESC, r.source_entity_id LIMIT 1;
  IF v_card IS NULL THEN
    INSERT INTO d10_synq_report VALUES ('04_probe', 'skipped', '{"reason":"no published lexeme relations"}');
    RETURN;
  END IF;
  SELECT array_agg(DISTINCT r.target_entity_id) INTO v_partners FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.source_entity_id = v_card AND r.target_entity_type = 'lexeme';
  BEGIN
    v_t0 := clock_timestamp();
    UPDATE public.lexemes SET translation_en = coalesce(translation_en, '') || ' (probe_synq)' WHERE id = v_card;
    v_ms := round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1);
    SELECT count(*) INTO v_other_write FROM public.lexemes WHERE updated_at = now() AND id <> v_card;
    SELECT count(*) INTO v_pairs_write FROM public.synonym_pair_v1 WHERE updated_at = now();
    SELECT count(*) INTO v_q FROM private.synonym_card_change_queue_v1;
    v_drain := public.synonym_refresh_drain_v1(200);
    -- every active candidate touching the card now waits for recheck
    SELECT count(*) INTO v_bad_pairs FROM public.synonym_pair_v1 p JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
    WHERE c.source_active AND p.status <> 'superseded'
      AND (c.source_entity_id = v_card OR p.target_entity_id = v_card OR c.source_entity_id IN (SELECT id FROM public.expression_catalog WHERE lexeme_id = v_card))
      AND NOT (p.status = 'needs_manual_review' AND p.force_recheck);
    -- lexemes.synonyms of the card and its partners equals an independent rebuild
    SELECT jsonb_object_agg(l.id, l.synonyms) INTO v_stored FROM public.lexemes l WHERE l.id = ANY(v_partners || v_card);
    PERFORM public.sync_lexeme_synonym_column(x) FROM unnest(v_partners || v_card) x;
    SELECT jsonb_object_agg(l.id, l.synonyms) INTO v_recalc FROM public.lexemes l WHERE l.id = ANY(v_partners || v_card);
    RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE', DETAIL = jsonb_build_object(
      'write_ms', v_ms, 'other_cards_written_in_write', v_other_write, 'pairs_written_in_write', v_pairs_write,
      'queued', v_q, 'drain', v_drain, 'pairs_not_rechecked', v_bad_pairs,
      'synonyms_equal_rebuild', v_stored = v_recalc, 'partners', coalesce(cardinality(v_partners), 0))::text;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
    GET STACKED DIAGNOSTICS v_det = PG_EXCEPTION_DETAIL;
    IF (v_det::jsonb ->> 'other_cards_written_in_write')::int <> 0 OR (v_det::jsonb ->> 'pairs_written_in_write')::int <> 0
       OR (v_det::jsonb ->> 'pairs_not_rechecked')::int <> 0 OR NOT (v_det::jsonb ->> 'synonyms_equal_rebuild')::boolean
       OR (v_det::jsonb -> 'drain' ->> 'pending_cards')::int <> 0 OR (v_det::jsonb -> 'drain' ->> 'pending_columns')::int <> 0 THEN
      RAISE EXCEPTION 'STOP: probe failed: %', v_det;
    END IF;
    INSERT INTO d10_synq_report VALUES ('04_probe_card_change', v_card::text, v_det::jsonb || '{"rolled_back":true}');
  END;
  INSERT INTO d10_synq_report VALUES ('05_queues_after_install', 'synonym queues', public.synonym_refresh_pending_v1());
END
$probe$;

SELECT part, name, info FROM d10_synq_report ORDER BY 1, 2;

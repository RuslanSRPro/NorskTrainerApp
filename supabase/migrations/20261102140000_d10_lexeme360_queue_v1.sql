-- 20261102140000_d10_lexeme360_queue_v1.sql
-- D10_lexeme360_queue_v1: 360 family counts are no longer recomputed inside the writer's transaction.
-- Writers (expression update, expression insert/delete, root bindings) only append the affected cards
-- to private.lexeme360_refresh_queue_v1; public.lexeme360_refresh_drain_v1 recomputes them with the
-- unchanged calculation, one drain at a time, locking cards in id order with SKIP LOCKED (never waits).
-- Drain runs from pg_cron every 10 s and from pipeline-supervisor before a job gets its final status.
-- Requires D10_lexeme360_trigger_narrow_v2. Run the whole file in SQL Editor. Any STOP -> nothing changed.
-- Rollback: optional/20261102140000_d10_lexeme360_queue_v1_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_queue_report;
CREATE TEMP TABLE d10_queue_report(part text, name text, info jsonb);

DO $mig$
DECLARE v_list text; v_trg text;
BEGIN
  -- G1 not installed yet
  IF to_regclass('private.lexeme360_refresh_queue_v1') IS NOT NULL
     OR to_regprocedure('public.lexeme360_refresh_drain_v1(integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_lexeme360_queue_v1 already installed';
  END IF;
  -- G2 base versions (package 1 installed; others as in query 288)
  SELECT string_agg(d.reg || '=' || coalesce(md5(replace(p.prosrc, E'\r', '')), 'MISSING'), ', ') INTO v_list
  FROM (VALUES
    ('private.refresh_lexeme360_expression_update_batch_v1()', 'a615f99b45ad65e72e00f4056441621a'),
    ('private.refresh_lexeme360_expression_trigger_v2()', '93f093bdc631a804087261878ea6596f'),
    ('private.refresh_lexeme360_binding_set_v1(uuid[],uuid[])', 'f13e64d060f6445cab06c08acb872f79'),
    ('private.refresh_lexeme360_lexeme_v2(uuid)', '18a81ca84cb10891fc5065222b6f84a5'),
    ('private.lexeme360_candidate_is_displayable_v1(jsonb)', 'f3050fdf28a13d15c449d6a5762f2784'),
    ('private.lexeme360_subtype_is_displayable_v1(text,boolean)', 'c8b4edf003af07421d5b2fb3b95de104'),
    ('private.lexeme360_roots_for_lexeme_v2(uuid)', '2f53acf283aa7505083753ca0666db94'),
    ('private.normalize_lexeme360_root_v1(text)', 'ecd72e3905b5fdb1dd01b178043675e3'),
    ('private.refresh_lexeme360_binding_insert_set_v1()', '801fc573b0aa67a1b278652640b679b5'),
    ('private.refresh_lexeme360_binding_update_set_v1()', '94556318ad46872486c9568da7e68ce7'),
    ('private.refresh_lexeme360_binding_delete_set_v1()', 'ad405b8fea8457a6ce90282e292355a9')
  ) d(reg, md5)
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(d.reg)
  WHERE p.oid IS NULL OR md5(replace(p.prosrc, E'\r', '')) <> d.md5;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: base version differs (install D10_lexeme360_trigger_narrow_v2 first?): %', v_list; END IF;
  -- G3 triggers that call the changed functions are as expected
  SELECT string_agg(x, ', ') INTO v_list FROM (
    SELECT 'expression_catalog.refresh_lexeme360_expression_update_batch_v1' x WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'public.expression_catalog'::regclass AND t.tgname = 'refresh_lexeme360_expression_update_batch_v1'
        AND t.tgfoid = 'private.refresh_lexeme360_expression_update_batch_v1()'::regprocedure)
    UNION ALL SELECT 'expression_catalog.refresh_lexeme360_expression_v2' WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'public.expression_catalog'::regclass AND t.tgname = 'refresh_lexeme360_expression_v2'
        AND t.tgfoid = 'private.refresh_lexeme360_expression_trigger_v2()'::regprocedure)
    UNION ALL SELECT 'lexeme360_expression_roots_v1 binding triggers' WHERE (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid = 'private.lexeme360_expression_roots_v1'::regclass AND NOT t.tgisinternal
        AND t.tgfoid IN ('private.refresh_lexeme360_binding_insert_set_v1()'::regprocedure,
                         'private.refresh_lexeme360_binding_update_set_v1()'::regprocedure,
                         'private.refresh_lexeme360_binding_delete_set_v1()'::regprocedure)) <> 3) z;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: trigger wiring differs: %', v_list; END IF;
  -- G4 cron job name free
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lexeme360-refresh-drain') THEN
      RAISE EXCEPTION 'STOP: cron job lexeme360-refresh-drain already exists';
    END IF;
  END IF;
END
$mig$;

-- queue (append-only)
CREATE TABLE private.lexeme360_refresh_queue_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lexeme_id uuid NOT NULL,
  reason text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX lexeme360_refresh_queue_v1_lexeme_idx ON private.lexeme360_refresh_queue_v1 (lexeme_id, id);
COMMENT ON TABLE private.lexeme360_refresh_queue_v1 IS
  'D10_lexeme360_queue_v1: cards whose 360 counts must be recomputed by public.lexeme360_refresh_drain_v1. Append-only.';
REVOKE ALL ON TABLE private.lexeme360_refresh_queue_v1 FROM PUBLIC;

CREATE FUNCTION private.lexeme360_enqueue_v1(p_lexeme_ids uuid[], p_reason text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_lexeme360_queue_v1 (02.11.2026): append affected cards to the queue. Append-only, no unique key,
-- so registration never waits for another transaction. Duplicates are merged by the drain.
  WITH added AS (
    INSERT INTO private.lexeme360_refresh_queue_v1 (lexeme_id, reason)
    SELECT DISTINCT x, coalesce(p_reason, 'unknown')
    FROM unnest(p_lexeme_ids) AS x
    WHERE x IS NOT NULL
    RETURNING 1
  )
  SELECT count(*)::integer FROM added;
$f$;

CREATE FUNCTION private.lexeme360_calc_v1(p_lexeme_ids uuid[])
RETURNS TABLE(id uuid, ready_count integer, candidate_count integer, display_root text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_lexeme360_queue_v1 (02.11.2026): the 360 calculation for the given cards. Text of the
-- calculation (family_pairs .. calculated) is copied unchanged from refresh_lexeme360_expression_update_batch_v1.
  WITH affected_lexemes AS MATERIALIZED (
    SELECT DISTINCT x AS id FROM unnest(p_lexeme_ids) AS x WHERE x IS NOT NULL
  ),
  family_pairs AS MATERIALIZED (
    SELECT affected.id AS lexeme_id, family.root_lexeme_id
    FROM affected_lexemes affected
    CROSS JOIN LATERAL private.lexeme360_roots_for_lexeme_v2(affected.id) family
  ),
  relevant_roots AS MATERIALIZED (
    SELECT DISTINCT root_lexeme_id FROM family_pairs
  ),
  expression_flags AS MATERIALIZED (
    SELECT
      binding.root_lexeme_id,
      expression.id AS expression_id,
      private.normalize_lexeme360_root_v1(root.lemma) AS display_root,
      (
        expression.verification_status IN
          ('multi_source', 'authoritative', 'usage_verified')
        AND nullif(btrim(expression.lemma), '') IS NOT NULL
        AND root.id IS NOT NULL
        AND private.lexeme360_subtype_is_displayable_v1(
          expression.expression_subtype, true
        )
        AND target.id IS NOT NULL
        AND target.is_learning_lexeme IS NOT FALSE
        AND coalesce(target.dictionary_status, 'active') = 'active'
      ) AS ready,
      (
        private.lexeme360_candidate_is_displayable_v1(to_jsonb(expression))
        OR (
          expression.verification_status IN
            ('multi_source', 'authoritative', 'usage_verified')
          AND target.id IS NOT NULL
          AND target.is_learning_lexeme IS FALSE
          AND coalesce(target.dictionary_status, 'active') = 'active'
          AND private.lexeme360_subtype_is_displayable_v1(
            expression.expression_subtype, true
          )
        )
      ) AS candidate
    FROM relevant_roots relevant
    JOIN private.lexeme360_expression_roots_v1 binding
      ON binding.root_lexeme_id = relevant.root_lexeme_id
    JOIN public.expression_catalog expression
      ON expression.id = binding.expression_id
    LEFT JOIN public.lexemes root ON root.id = binding.root_lexeme_id
    LEFT JOIN public.lexemes target ON target.id = expression.lexeme_id
  ),
  calculated AS (
    SELECT
      affected.id,
      count(DISTINCT flags.expression_id) FILTER (WHERE flags.ready)::integer
        AS ready_count,
      count(DISTINCT flags.expression_id) FILTER (WHERE flags.candidate)::integer
        AS candidate_count,
      min(flags.display_root) FILTER (WHERE flags.ready) AS display_root
    FROM affected_lexemes affected
    LEFT JOIN family_pairs family ON family.lexeme_id = affected.id
    LEFT JOIN expression_flags flags
      ON flags.root_lexeme_id = family.root_lexeme_id
    GROUP BY affected.id
  )
  SELECT calculated.id, calculated.ready_count, calculated.candidate_count, calculated.display_root
  FROM calculated;
$f$;

CREATE FUNCTION public.lexeme360_refresh_drain_v1(p_max_lexemes integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_lexeme360_queue_v1 (02.11.2026): recompute queued cards. One drain at a time (advisory lock).
-- Never waits for a lock: cards are locked in id order with SKIP LOCKED; a card held by a writer stays
-- in the queue for the next drain. Only queue rows read before the calculation are removed, so a change
-- committed later is always recomputed by a later drain.
DECLARE
  v_ids uuid[];
  v_rows bigint[];
  v_cid uuid[]; v_ready integer[]; v_cand integer[]; v_root text[];
  v_need uuid[]; v_locked uuid[]; v_skipped uuid[];
  v_updated integer := 0; v_deleted integer := 0;
  v_t0 timestamptz := clock_timestamp();
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('lexeme360_refresh_drain_v1', 0)) THEN
    RETURN jsonb_build_object('ok', true, 'busy', true,
      'pending', (SELECT count(DISTINCT q.lexeme_id) FROM private.lexeme360_refresh_queue_v1 q));
  END IF;

  SELECT array_agg(p.lexeme_id ORDER BY p.lexeme_id) INTO v_ids
  FROM (SELECT q.lexeme_id FROM private.lexeme360_refresh_queue_v1 q
        GROUP BY q.lexeme_id ORDER BY min(q.id)
        LIMIT greatest(coalesce(p_max_lexemes, 500), 1)) p;

  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'processed', 0, 'updated', 0, 'skipped', 0, 'pending', 0);
  END IF;

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
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;

    v_skipped := ARRAY(SELECT unnest(v_need) EXCEPT SELECT unnest(coalesce(v_locked, '{}'::uuid[])));
  END IF;

  DELETE FROM private.lexeme360_refresh_queue_v1 q
  WHERE q.id = ANY(v_rows)
    AND NOT (q.lexeme_id = ANY(coalesce(v_skipped, '{}'::uuid[])));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', cardinality(v_ids),
    'updated', v_updated,
    'skipped', coalesce(cardinality(v_skipped), 0),
    'queue_rows_removed', v_deleted,
    'pending', (SELECT count(DISTINCT q.lexeme_id) FROM private.lexeme360_refresh_queue_v1 q),
    'ms', round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1));
END;
$f$;

CREATE FUNCTION public.lexeme360_refresh_pending_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
-- D10_lexeme360_queue_v1 (02.11.2026): queue state, read only.
  SELECT jsonb_build_object(
    'pending', count(DISTINCT q.lexeme_id),
    'queue_rows', count(*),
    'oldest_age_s', round(extract(epoch FROM clock_timestamp() - min(q.requested_at))::numeric, 1))
  FROM private.lexeme360_refresh_queue_v1 q;
$f$;

REVOKE ALL ON FUNCTION private.lexeme360_enqueue_v1(uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.lexeme360_calc_v1(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lexeme360_refresh_drain_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lexeme360_refresh_pending_v1() FROM PUBLIC;
DO $mig$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.lexeme360_refresh_drain_v1(integer) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.lexeme360_refresh_pending_v1() FROM %I', r);
      EXECUTE format('REVOKE ALL ON TABLE private.lexeme360_refresh_queue_v1 FROM %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.lexeme360_refresh_drain_v1(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.lexeme360_refresh_pending_v1() TO service_role;
  END IF;
END
$mig$;

DO $mig$
DECLARE
  r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_item text; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('private.refresh_lexeme360_expression_update_batch_v1()', 'private.refresh_lexeme360_expression_update_batch_v1()', 'trigger', 'a615f99b45ad65e72e00f4056441621a', '95a498c17fa004f3bbcdca4bce40bef0', $b_batch$
-- D10_lexeme360_queue_v1 (02.11.2026): registration only, no recompute in the writer's transaction.
-- Change detection is the same as D10_lexeme360_trigger_narrow_v2 (md5 a615f99b...): only rows whose
-- 360-relevant fields changed (id, lexeme_id, verification_status, lemma, expression_subtype,
-- ordbokene_status, ordbokene_article_id via to_jsonb, verification_evidence). The affected cards
-- (roots of the changed expressions, old and new lexeme_id, cards of all expressions of those roots)
-- are appended to private.lexeme360_refresh_queue_v1. public.lexeme360_refresh_drain_v1 recomputes them
-- with the unchanged calculation (private.lexeme360_calc_v1), locking lexemes in id order with SKIP LOCKED.
DECLARE
  v_changed_ids uuid[];
  v_changed_lexeme_ids uuid[];
BEGIN
  SELECT
    coalesce(array_agg(DISTINCT x.id) FILTER (WHERE x.id IS NOT NULL), '{}'::uuid[]),
    coalesce(array_agg(DISTINCT x.lexeme_id) FILTER (WHERE x.lexeme_id IS NOT NULL), '{}'::uuid[])
  INTO v_changed_ids, v_changed_lexeme_ids
  FROM old_expression_rows o
  FULL JOIN new_expression_rows n ON n.id = o.id
  CROSS JOIN LATERAL (VALUES (o.id, o.lexeme_id), (n.id, n.lexeme_id)) AS x(id, lexeme_id)
  WHERE o.id IS NULL
     OR n.id IS NULL
     OR jsonb_build_array(to_jsonb(o) -> 'lexeme_id', to_jsonb(o) -> 'verification_status',
                          to_jsonb(o) -> 'lemma', to_jsonb(o) -> 'expression_subtype',
                          to_jsonb(o) -> 'ordbokene_status', to_jsonb(o) -> 'ordbokene_article_id',
                          to_jsonb(o) -> 'verification_evidence')
        IS DISTINCT FROM
        jsonb_build_array(to_jsonb(n) -> 'lexeme_id', to_jsonb(n) -> 'verification_status',
                          to_jsonb(n) -> 'lemma', to_jsonb(n) -> 'expression_subtype',
                          to_jsonb(n) -> 'ordbokene_status', to_jsonb(n) -> 'ordbokene_article_id',
                          to_jsonb(n) -> 'verification_evidence');

  IF cardinality(v_changed_ids) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM private.lexeme360_enqueue_v1(ARRAY(
    WITH affected_roots AS (
      SELECT DISTINCT binding.root_lexeme_id
      FROM private.lexeme360_expression_roots_v1 binding
      WHERE binding.expression_id = ANY(v_changed_ids)
    )
    SELECT root_lexeme_id FROM affected_roots
    UNION
    SELECT unnest(v_changed_lexeme_ids)
    UNION
    SELECT expression.lexeme_id
    FROM affected_roots root
    JOIN private.lexeme360_expression_roots_v1 binding
      ON binding.root_lexeme_id = root.root_lexeme_id
    JOIN public.expression_catalog expression
      ON expression.id = binding.expression_id
    WHERE expression.lexeme_id IS NOT NULL
  ), 'expression_update');

  RETURN NULL;
END;
$b_batch$),
    ('private.refresh_lexeme360_expression_trigger_v2()', 'private.refresh_lexeme360_expression_trigger_v2()', 'trigger', '93f093bdc631a804087261878ea6596f', '2ef59c332757a6fa43ab4e491d4ea732', $b_expr$
-- D10_lexeme360_queue_v1 (02.11.2026): registration only. Same affected cards as before
-- (each root of the expression + cards of all expressions of that root, old/new lexeme_id), appended to
-- private.lexeme360_refresh_queue_v1 instead of recomputing the whole family per row.
declare
  affected_expression_id uuid;
  v_ids uuid[];
begin
  affected_expression_id := case when tg_op = 'DELETE' then old.id else new.id end;

  v_ids := ARRAY(
    select binding.root_lexeme_id
    from private.lexeme360_expression_roots_v1 binding
    where binding.expression_id = affected_expression_id
    union
    select expression.lexeme_id
    from private.lexeme360_expression_roots_v1 own_binding
    join private.lexeme360_expression_roots_v1 binding
      on binding.root_lexeme_id = own_binding.root_lexeme_id
    join public.expression_catalog expression
      on expression.id = binding.expression_id
    where own_binding.expression_id = affected_expression_id
      and expression.lexeme_id is not null
  );

  if tg_op in ('UPDATE', 'DELETE') and old.lexeme_id is not null then
    v_ids := v_ids || old.lexeme_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.lexeme_id is not null then
    v_ids := v_ids || new.lexeme_id;
  end if;

  perform private.lexeme360_enqueue_v1(v_ids, 'expression_' || lower(tg_op));
  return null;
end;
$b_expr$),
    ('private.refresh_lexeme360_binding_set_v1(uuid[],uuid[])', 'private.refresh_lexeme360_binding_set_v1(p_root_ids uuid[], p_expression_ids uuid[])', 'void', 'f13e64d060f6445cab06c08acb872f79', '5f53617986b42f3c3a77139eee90c673', $b_bind$
-- D10_lexeme360_queue_v1 (02.11.2026): registration only. Callers (binding insert/update/delete
-- triggers and bind_lexeme360_expression_roots_batch_v1) keep calling this function; the affected cards
-- are computed exactly as before and appended to private.lexeme360_refresh_queue_v1.
BEGIN
  IF coalesce(cardinality(p_root_ids), 0) = 0
     AND coalesce(cardinality(p_expression_ids), 0) = 0 THEN
    RETURN;
  END IF;

  PERFORM private.lexeme360_enqueue_v1(ARRAY(
    WITH changed_roots AS MATERIALIZED (
      SELECT DISTINCT root_lexeme_id AS id
      FROM unnest(p_root_ids) AS roots(root_lexeme_id)
      WHERE root_lexeme_id IS NOT NULL
    ),
    changed_expressions AS MATERIALIZED (
      SELECT DISTINCT expression_id AS id
      FROM unnest(p_expression_ids) AS expressions(expression_id)
      WHERE expression_id IS NOT NULL
    )
    SELECT id FROM changed_roots
    UNION
    SELECT expression.lexeme_id
    FROM changed_roots root
    JOIN private.lexeme360_expression_roots_v1 binding
      ON binding.root_lexeme_id = root.id
    JOIN public.expression_catalog expression
      ON expression.id = binding.expression_id
    WHERE expression.lexeme_id IS NOT NULL
    UNION
    SELECT expression.lexeme_id
    FROM changed_expressions changed
    JOIN public.expression_catalog expression ON expression.id = changed.id
    WHERE expression.lexeme_id IS NOT NULL
  ), 'binding_set');
END;
$b_bind$)
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
    INSERT INTO d10_queue_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

-- pg_cron: drain every 10 s (pg_cron >= 1.5), otherwise every minute
DO $mig$
DECLARE v_ver text; v_sched text; v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    INSERT INTO d10_queue_report VALUES ('03_cron', 'lexeme360-refresh-drain', '{"scheduled":false,"reason":"pg_cron not available"}');
    RETURN;
  END IF;
  SELECT extversion INTO v_ver FROM pg_extension WHERE extname = 'pg_cron';
  v_sched := CASE WHEN string_to_array(split_part(v_ver, '-', 1), '.')::int[] >= ARRAY[1,5] THEN '10 seconds' ELSE '* * * * *' END;
  SELECT cron.schedule('lexeme360-refresh-drain', v_sched, 'select public.lexeme360_refresh_drain_v1(500)') INTO v_jobid;
  INSERT INTO d10_queue_report VALUES ('03_cron', 'lexeme360-refresh-drain',
    jsonb_build_object('scheduled', true, 'jobid', v_jobid, 'schedule', v_sched, 'pg_cron', v_ver));
END
$mig$;

-- Probes in sub-transactions: every probe write is rolled back.
DO $probe$
DECLARE
  v_expr uuid; v_root uuid; v_q0 bigint; v_q1 bigint; v_drain jsonb; v_ids uuid[];
  v_stored jsonb; v_recalc jsonb; v_det text; v_t0 timestamptz; v_ms numeric;
BEGIN
  -- largest family
  SELECT b.root_lexeme_id INTO v_root FROM private.lexeme360_expression_roots_v1 b
  GROUP BY b.root_lexeme_id ORDER BY count(*) DESC, b.root_lexeme_id LIMIT 1;
  IF v_root IS NULL THEN
    INSERT INTO d10_queue_report VALUES ('04_probe', 'skipped', '{"reason":"no bindings"}');
    RETURN;
  END IF;
  SELECT b.expression_id INTO v_expr
  FROM private.lexeme360_expression_roots_v1 b JOIN public.expression_catalog e ON e.id = b.expression_id
  JOIN public.lexemes t ON t.id = e.lexeme_id
  WHERE b.root_lexeme_id = v_root AND t.id <> v_root
    AND e.verification_status IN ('multi_source','authoritative','usage_verified')
  ORDER BY b.expression_id LIMIT 1;

  -- P1 naob_status only: nothing queued
  BEGIN
    SELECT count(*) INTO v_q0 FROM private.lexeme360_refresh_queue_v1;
    v_t0 := clock_timestamp();
    UPDATE public.expression_catalog SET naob_status = naob_status
    WHERE id = (SELECT b.expression_id FROM private.lexeme360_expression_roots_v1 b WHERE b.root_lexeme_id = v_root ORDER BY 1 LIMIT 1);
    v_ms := round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1);
    SELECT count(*) INTO v_q1 FROM private.lexeme360_refresh_queue_v1;
    RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE', DETAIL = jsonb_build_object('ms', v_ms, 'queued', v_q1 - v_q0)::text;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
    GET STACKED DIAGNOSTICS v_det = PG_EXCEPTION_DETAIL;
    IF (v_det::jsonb ->> 'queued')::int <> 0 THEN RAISE EXCEPTION 'STOP: probe P1 - naob_status write queued cards: %', v_det; END IF;
    INSERT INTO d10_queue_report VALUES ('04_probe_1_naob_status', v_root::text, v_det::jsonb || '{"rolled_back":true}');
  END;

  -- P2 real readiness change: only queued in the write; drain makes counts equal to independent recompute
  IF v_expr IS NULL THEN
    INSERT INTO d10_queue_report VALUES ('04_probe_2_ready_change', 'skipped', '{"reason":"no ready expression in largest family"}');
  ELSE
    BEGIN
      SELECT count(*) INTO v_q0 FROM private.lexeme360_refresh_queue_v1;
      v_t0 := clock_timestamp();
      UPDATE public.expression_catalog SET verification_status = 'candidate' WHERE id = v_expr;
      v_ms := round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1);
      SELECT count(*) INTO v_q1 FROM private.lexeme360_refresh_queue_v1;
      v_drain := public.lexeme360_refresh_drain_v1(5000);
      SELECT array_agg(DISTINCT x) INTO v_ids FROM (SELECT v_root x UNION SELECT e.lexeme_id
        FROM private.lexeme360_expression_roots_v1 b JOIN public.expression_catalog e ON e.id = b.expression_id
        WHERE b.root_lexeme_id = v_root AND e.lexeme_id IS NOT NULL) z;
      SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
        INTO v_stored FROM public.lexemes l WHERE l.id = ANY(v_ids);
      PERFORM private.refresh_lexeme360_lexeme_v2(x) FROM unnest(v_ids) x;
      SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
        INTO v_recalc FROM public.lexemes l WHERE l.id = ANY(v_ids);
      RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE', DETAIL = jsonb_build_object('write_ms', v_ms, 'queued', v_q1 - v_q0,
        'drain', v_drain, 'cards', cardinality(v_ids), 'equal', v_stored = v_recalc)::text;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
      GET STACKED DIAGNOSTICS v_det = PG_EXCEPTION_DETAIL;
      IF NOT (v_det::jsonb ->> 'equal')::boolean OR (v_det::jsonb -> 'drain' ->> 'pending')::int <> 0 THEN
        RAISE EXCEPTION 'STOP: probe P2 failed: %', v_det;
      END IF;
      INSERT INTO d10_queue_report VALUES ('04_probe_2_ready_change', v_root::text, v_det::jsonb || '{"rolled_back":true}');
    END;
  END IF;

  -- P3 binding path: remove one binding of the family, drain, compare
  BEGIN
    SELECT count(*) INTO v_q0 FROM private.lexeme360_refresh_queue_v1;
    SELECT b.expression_id INTO v_expr FROM private.lexeme360_expression_roots_v1 b
    WHERE b.root_lexeme_id = v_root ORDER BY b.expression_id LIMIT 1;
    DELETE FROM private.lexeme360_expression_roots_v1 WHERE expression_id = v_expr AND root_lexeme_id = v_root;
    SELECT count(*) INTO v_q1 FROM private.lexeme360_refresh_queue_v1;
    v_drain := public.lexeme360_refresh_drain_v1(5000);
    -- remaining family cards + the card of the removed expression
    SELECT array_agg(DISTINCT x) INTO v_ids FROM (SELECT v_root x
      UNION SELECT e.lexeme_id FROM private.lexeme360_expression_roots_v1 b JOIN public.expression_catalog e ON e.id = b.expression_id
            WHERE b.root_lexeme_id = v_root AND e.lexeme_id IS NOT NULL
      UNION SELECT e.lexeme_id FROM public.expression_catalog e WHERE e.id = v_expr AND e.lexeme_id IS NOT NULL) z;
    SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
      INTO v_stored FROM public.lexemes l WHERE l.id = ANY(v_ids);
    PERFORM private.refresh_lexeme360_lexeme_v2(x) FROM unnest(v_ids) x;
    SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
      INTO v_recalc FROM public.lexemes l WHERE l.id = ANY(v_ids);
    RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE', DETAIL = jsonb_build_object('queued', v_q1 - v_q0, 'drain', v_drain,
      'cards', cardinality(v_ids), 'equal', v_stored = v_recalc)::text;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
    GET STACKED DIAGNOSTICS v_det = PG_EXCEPTION_DETAIL;
    IF NOT (v_det::jsonb ->> 'equal')::boolean OR (v_det::jsonb ->> 'queued')::int = 0 THEN
      RAISE EXCEPTION 'STOP: probe P3 failed: %', v_det;
    END IF;
    INSERT INTO d10_queue_report VALUES ('04_probe_3_binding_delete', v_root::text, v_det::jsonb || '{"rolled_back":true}');
  END;

  INSERT INTO d10_queue_report VALUES ('05_queue_after_install', 'private.lexeme360_refresh_queue_v1', public.lexeme360_refresh_pending_v1());
END
$probe$;

SELECT part, name, info FROM d10_queue_report ORDER BY 1, 2;

-- 20261102120000_d10_lexeme360_trigger_narrow_v2.sql
-- D10_lexeme360_trigger_narrow_v2: trigger on expression_catalog recomputes family 360 only when
-- 360-relevant fields change; lexemes locked in id order; only changed values written.
-- Changes ONE function body: private.refresh_lexeme360_expression_update_batch_v1(). Trigger itself,
-- calculation rules, display filters and all other functions are untouched.
-- Run in SQL Editor (whole file at once). Any STOP -> nothing is changed.
-- Rollback: optional/20261102120000_d10_lexeme360_trigger_narrow_v2_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_narrow_report;
CREATE TEMP TABLE d10_narrow_report(part text, name text, info jsonb);

DO $mig$
DECLARE
  v_src text; v_md5 text; v_list text; v_trg text;
  v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_item text;
  v_expect_md5 constant text := 'a615f99b45ad65e72e00f4056441621a';
  v_body constant text := $body$
-- D10_lexeme360_trigger_narrow_v2 (02.11.2026; v1 never installed: it read column ordbokene_article_id directly,
--   which does not exist in expression_catalog. v2 compares fields via to_jsonb(row) -> key, exactly like
--   private.lexeme360_candidate_is_displayable_v1 reads them, so a missing column compares as NULL = NULL.)
-- Changes vs previous version (md5 6c85ebe8c9f6654e617ac8592530870d):
--  1. Only rows whose 360-relevant fields really changed are recomputed. Relevant fields = everything
--     the calculation below and private.lexeme360_candidate_is_displayable_v1 read from
--     expression_catalog: id, lexeme_id, verification_status, lemma, expression_subtype,
--     ordbokene_status, ordbokene_article_id (not a column today; read via to_jsonb), verification_evidence. Writes of naob_status,
--     translations etc. return immediately (no family recompute, no lexemes locks).
--  2. Old AND new lexeme_id of a changed row are both recomputed (old and new family).
--  3. The calculation itself (ready / candidate / display_root) is unchanged.
--  4. lexemes rows are locked in id order (ORDER BY id FOR UPDATE) and only rows whose stored
--     values differ are updated; lexeme360_refreshed_at therefore moves only on a real change.
DECLARE
  v_changed_ids uuid[];
  v_changed_lexeme_ids uuid[];
  v_ids uuid[];
  v_ready integer[];
  v_candidate integer[];
  v_root text[];
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

  WITH changed_expressions AS MATERIALIZED (
    SELECT unnest(v_changed_ids) AS id
  ),
  affected_roots AS MATERIALIZED (
    SELECT DISTINCT binding.root_lexeme_id
    FROM private.lexeme360_expression_roots_v1 binding
    JOIN changed_expressions changed ON changed.id = binding.expression_id
  ),
  affected_lexemes AS MATERIALIZED (
    SELECT root_lexeme_id AS id FROM affected_roots
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
  SELECT array_agg(id ORDER BY id), array_agg(ready_count ORDER BY id),
         array_agg(candidate_count ORDER BY id), array_agg(display_root ORDER BY id)
  INTO v_ids, v_ready, v_candidate, v_root
  FROM calculated;

  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

  -- lock only rows that need a change, always in id order
  PERFORM 1
  FROM public.lexemes lexeme
  JOIN unnest(v_ids, v_ready, v_candidate, v_root) AS calc(id, ready_count, candidate_count, display_root)
    ON calc.id = lexeme.id
  WHERE (lexeme.lexeme360_root_lemma, lexeme.lexeme360_ready_count,
         lexeme.lexeme360_candidate_count, lexeme.lexeme360_policy_version)
        IS DISTINCT FROM
        (calc.display_root, calc.ready_count, calc.candidate_count,
         'lexeme360-family/v2-root-identity'::text)
  ORDER BY lexeme.id
  FOR UPDATE OF lexeme;

  UPDATE public.lexemes lexeme
  SET
    lexeme360_root_lemma = calc.display_root,
    lexeme360_ready_count = calc.ready_count,
    lexeme360_candidate_count = calc.candidate_count,
    lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
    lexeme360_refreshed_at = clock_timestamp()
  FROM unnest(v_ids, v_ready, v_candidate, v_root) AS calc(id, ready_count, candidate_count, display_root)
  WHERE lexeme.id = calc.id
    AND (lexeme.lexeme360_root_lemma, lexeme.lexeme360_ready_count,
         lexeme.lexeme360_candidate_count, lexeme.lexeme360_policy_version)
        IS DISTINCT FROM
        (calc.display_root, calc.ready_count, calc.candidate_count,
         'lexeme360-family/v2-root-identity'::text);

  RETURN NULL;
END;
$body$;
BEGIN
  -- G0: body text in this file is intact
  IF md5(replace(v_body, E'\r', '')) <> v_expect_md5 THEN RAISE EXCEPTION 'STOP: file body md5 %, expected % (file damaged?)', md5(replace(v_body, E'\r', '')), v_expect_md5; END IF;

  -- G1: function exists, not yet installed, base version matches md5 from query 287
  SELECT replace(p.prosrc, E'\r', '') INTO v_src FROM pg_proc p
  WHERE p.oid = to_regprocedure('private.refresh_lexeme360_expression_update_batch_v1()');
  IF v_src IS NULL THEN RAISE EXCEPTION 'STOP: private.refresh_lexeme360_expression_update_batch_v1() not found'; END IF;
  IF v_src LIKE '%D10_lexeme360_trigger_narrow_v%' THEN RAISE EXCEPTION 'STOP: D10_lexeme360_trigger_narrow (v1 or v2) is already installed'; END IF;
  IF md5(v_src) <> '6c85ebe8c9f6654e617ac8592530870d' THEN RAISE EXCEPTION 'STOP: base function changed since query 287 (md5 %)', md5(v_src); END IF;

  -- G2: dependencies of the calculation unchanged (field list was derived from these texts)
  SELECT string_agg(d.name || '=' || coalesce(md5(replace(p.prosrc, E'\r', '')), 'MISSING'), ', ') INTO v_list
  FROM (VALUES
    ('lexeme360_candidate_is_displayable_v1','f3050fdf28a13d15c449d6a5762f2784'),
    ('lexeme360_subtype_is_displayable_v1','c8b4edf003af07421d5b2fb3b95de104'),
    ('lexeme360_roots_for_lexeme_v2','2f53acf283aa7505083753ca0666db94'),
    ('normalize_lexeme360_root_v1','ecd72e3905b5fdb1dd01b178043675e3')
  ) d(name, md5)
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure('private.' || d.name || '(' ||
       CASE d.name WHEN 'lexeme360_candidate_is_displayable_v1' THEN 'jsonb'
                   WHEN 'lexeme360_subtype_is_displayable_v1' THEN 'text, boolean'
                   WHEN 'lexeme360_roots_for_lexeme_v2' THEN 'uuid'
                   ELSE 'text' END || ')')
  WHERE p.oid IS NULL OR md5(replace(p.prosrc, E'\r', '')) <> d.md5;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: dependency changed or missing: %', v_list; END IF;

  -- G3: trigger is the statement-level one with the transition table names the body uses
  SELECT pg_get_triggerdef(t.oid) INTO v_trg FROM pg_trigger t
  WHERE t.tgrelid = 'public.expression_catalog'::regclass AND t.tgname = 'refresh_lexeme360_expression_update_batch_v1';
  IF v_trg IS NULL OR v_trg NOT LIKE '%OLD TABLE AS old_expression_rows%' OR v_trg NOT LIKE '%NEW TABLE AS new_expression_rows%'
     OR v_trg NOT LIKE '%FOR EACH STATEMENT%' THEN
    RAISE EXCEPTION 'STOP: trigger definition differs: %', v_trg;
  END IF;

  -- G4: all columns the body uses exist
  SELECT string_agg(c.tbl || '.' || c.col, ', ') INTO v_list
  FROM (VALUES ('expression_catalog','id'),('expression_catalog','lexeme_id'),('expression_catalog','verification_status'),
               ('expression_catalog','lemma'),('expression_catalog','expression_subtype'),('expression_catalog','ordbokene_status'),
               ('expression_catalog','verification_evidence'),
               ('lexemes','id'),('lexemes','lemma'),('lexemes','is_learning_lexeme'),('lexemes','dictionary_status'),
               ('lexemes','lexeme360_root_lemma'),('lexemes','lexeme360_ready_count'),('lexemes','lexeme360_candidate_count'),
               ('lexemes','lexeme360_policy_version'),('lexemes','lexeme360_refreshed_at')) c(tbl, col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns i
                    WHERE i.table_schema = 'public' AND i.table_name = c.tbl AND i.column_name = c.col);
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: missing columns: %', v_list; END IF;

  -- G5: no lexeme360 function (calculation or display) reads naob_status / expression_review_status
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public','private') AND p.proname ~* 'lexeme360'
    AND p.prosrc ~* '(naob_status|expression_review_status)';
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: lexeme360 functions depend on naob_status/review_status: %', v_list; END IF;

  -- G6: lexeme360_refreshed_at is only written by the 360 refresh functions, nothing reads it
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prosrc ILIKE '%lexeme360_refreshed_at%'
    AND p.oid::regprocedure::text NOT IN (
      'private.refresh_lexeme360_expression_update_batch_v1()', 'private.refresh_lexeme360_lexeme_v2(uuid)',
      'private.refresh_lexeme360_binding_set_v1(uuid[],uuid[])', 'private.refresh_lexeme360_family_v1(uuid)',
      'private.refresh_lexeme360_family_v1(text)', 'private.refresh_lexeme360_family_v1()');
  SELECT concat_ws(', ', v_list,
           (SELECT string_agg(schemaname || '.' || viewname, ', ') FROM pg_views WHERE definition ILIKE '%lexeme360_refreshed_at%'),
           (SELECT string_agg(schemaname || '.' || matviewname, ', ') FROM pg_matviews WHERE definition ILIKE '%lexeme360_refreshed_at%'),
           (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE coalesce(qual, '') || coalesce(with_check, '') ILIKE '%lexeme360_refreshed_at%'))
  INTO v_list;
  IF v_list <> '' THEN RAISE EXCEPTION 'STOP: lexeme360_refreshed_at is used outside the 360 writers: % (review before install)', v_list; END IF;

  -- capture attributes, replace body, re-apply attributes exactly
  SELECT p.oid, p.prosecdef, p.proconfig INTO v_oid, v_secdef, v_cfg
  FROM pg_proc p WHERE p.oid = 'private.refresh_lexeme360_expression_update_batch_v1()'::regprocedure;

  EXECUTE 'CREATE OR REPLACE FUNCTION private.refresh_lexeme360_expression_update_batch_v1() '
       || 'RETURNS trigger LANGUAGE plpgsql AS ' || quote_literal(replace(v_body, E'\r', ''));

  IF v_secdef THEN
    EXECUTE 'ALTER FUNCTION private.refresh_lexeme360_expression_update_batch_v1() SECURITY DEFINER';
  END IF;
  IF v_cfg IS NOT NULL THEN
    FOREACH v_item IN ARRAY v_cfg LOOP
      EXECUTE format('ALTER FUNCTION private.refresh_lexeme360_expression_update_batch_v1() SET %s TO %s',
                     split_part(v_item, '=', 1), substr(v_item, length(split_part(v_item, '=', 1)) + 2));
    END LOOP;
  END IF;

  SELECT md5(replace(p.prosrc, E'\r', '')), p.prosecdef, p.proconfig INTO v_md5, v_secdef2, v_cfg2
  FROM pg_proc p WHERE p.oid = v_oid;
  IF v_md5 <> v_expect_md5 THEN RAISE EXCEPTION 'STOP: body md5 after replace = %, expected %', v_md5, v_expect_md5; END IF;
  IF v_secdef2 IS DISTINCT FROM v_secdef OR v_cfg2 IS DISTINCT FROM v_cfg THEN
    RAISE EXCEPTION 'STOP: attributes changed (secdef % -> %, config % -> %)', v_secdef, v_secdef2, v_cfg, v_cfg2;
  END IF;

  INSERT INTO d10_narrow_report VALUES ('01_installed', 'refresh_lexeme360_expression_update_batch_v1',
    jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
END
$mig$;

-- Probes inside sub-transactions: every probe write is rolled back, nothing stays in the data.
DO $probe$
DECLARE
  v_expr uuid; v_root uuid; v_before jsonb; v_after jsonb; v_t0 timestamptz; v_ms numeric;
  v_ids uuid[]; v_stored jsonb; v_recalc jsonb; v_skip text;
BEGIN
  -- P1: naob_status-only write on an expression of the largest family: no 360 write at all
  SELECT b.expression_id, b.root_lexeme_id INTO v_expr, v_root
  FROM private.lexeme360_expression_roots_v1 b
  JOIN public.expression_catalog e ON e.id = b.expression_id
  WHERE e.lexeme_id IS DISTINCT FROM b.root_lexeme_id
  ORDER BY (SELECT count(*) FROM private.lexeme360_expression_roots_v1 b2 WHERE b2.root_lexeme_id = b.root_lexeme_id) DESC, b.expression_id
  LIMIT 1;
  IF v_expr IS NULL THEN
    INSERT INTO d10_narrow_report VALUES ('02_probe_naob_status', 'skipped', '{"reason":"no bound expression"}');
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_array(l.id, l.lexeme360_refreshed_at) ORDER BY l.id), '[]') INTO v_before
    FROM public.lexemes l WHERE l.id IN (SELECT private.lexeme360_roots_for_lexeme_v2(v_root) UNION SELECT v_root);
    BEGIN
      v_t0 := clock_timestamp();
      UPDATE public.expression_catalog SET naob_status = naob_status WHERE id = v_expr;
      v_ms := round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1);
      SELECT coalesce(jsonb_agg(jsonb_build_array(l.id, l.lexeme360_refreshed_at) ORDER BY l.id), '[]') INTO v_after
      FROM public.lexemes l WHERE l.id IN (SELECT private.lexeme360_roots_for_lexeme_v2(v_root) UNION SELECT v_root);
      RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE', DETAIL = jsonb_build_object('ms', v_ms, 'unchanged', v_before = v_after)::text;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
      GET STACKED DIAGNOSTICS v_skip = PG_EXCEPTION_DETAIL;
      IF NOT (v_skip::jsonb ->> 'unchanged')::boolean THEN
        RAISE EXCEPTION 'STOP: probe P1 - naob_status write still touched 360 rows of root %', v_root;
      END IF;
      INSERT INTO d10_narrow_report VALUES ('02_probe_naob_status', v_root::text,
        v_skip::jsonb || jsonb_build_object('expression_id', v_expr, 'rolled_back', true));
    END;
  END IF;

  -- P2: real readiness change on a ready expression: stored counts must equal the independent
  --     per-lexeme recompute private.refresh_lexeme360_lexeme_v2 for every affected card
  SELECT b.expression_id, b.root_lexeme_id INTO v_expr, v_root
  FROM private.lexeme360_expression_roots_v1 b
  JOIN public.expression_catalog e ON e.id = b.expression_id
  JOIN public.lexemes t ON t.id = e.lexeme_id
  WHERE e.verification_status IN ('multi_source','authoritative','usage_verified')
    AND nullif(btrim(e.lemma), '') IS NOT NULL
    AND private.lexeme360_subtype_is_displayable_v1(e.expression_subtype, true)
    AND t.is_learning_lexeme IS NOT FALSE AND coalesce(t.dictionary_status, 'active') = 'active'
    AND t.id <> b.root_lexeme_id
  ORDER BY (SELECT count(*) FROM private.lexeme360_expression_roots_v1 b2 WHERE b2.root_lexeme_id = b.root_lexeme_id) DESC, b.expression_id
  LIMIT 1;
  IF v_expr IS NULL THEN
    INSERT INTO d10_narrow_report VALUES ('03_probe_ready_change', 'skipped', '{"reason":"no ready bound expression"}');
    RETURN;
  END IF;
  BEGIN
    v_t0 := clock_timestamp();
    UPDATE public.expression_catalog SET verification_status = 'candidate' WHERE id = v_expr;
    v_ms := round(extract(epoch FROM clock_timestamp() - v_t0)::numeric * 1000, 1);
    SELECT array_agg(DISTINCT x) INTO v_ids FROM (
      SELECT v_root AS x
      UNION SELECT e.lexeme_id FROM private.lexeme360_expression_roots_v1 b
            JOIN public.expression_catalog e ON e.id = b.expression_id
            WHERE b.root_lexeme_id = v_root AND e.lexeme_id IS NOT NULL) z;
    SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
    INTO v_stored FROM public.lexemes l WHERE l.id = ANY(v_ids);
    PERFORM private.refresh_lexeme360_lexeme_v2(x) FROM unnest(v_ids) x;
    SELECT jsonb_object_agg(l.id, jsonb_build_array(l.lexeme360_ready_count, l.lexeme360_candidate_count, l.lexeme360_root_lemma))
    INTO v_recalc FROM public.lexemes l WHERE l.id = ANY(v_ids);
    RAISE EXCEPTION USING MESSAGE = 'D10_PROBE_DONE',
      DETAIL = jsonb_build_object('ms', v_ms, 'cards', cardinality(v_ids), 'equal', v_stored = v_recalc,
                                  'diff', (SELECT jsonb_object_agg(k, jsonb_build_object('stored', v_stored -> k, 'recalc', v))
                                           FROM jsonb_each(v_recalc) r(k, v) WHERE v_stored -> k IS DISTINCT FROM v))::text;
  EXCEPTION
    WHEN check_violation THEN
      INSERT INTO d10_narrow_report VALUES ('03_probe_ready_change', 'skipped', '{"reason":"check constraint rejects verification_status=candidate"}');
    WHEN raise_exception THEN
      IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
      GET STACKED DIAGNOSTICS v_skip = PG_EXCEPTION_DETAIL;
      IF NOT (v_skip::jsonb ->> 'equal')::boolean THEN
        RAISE EXCEPTION 'STOP: probe P2 - stored counts differ from independent recompute: %', v_skip;
      END IF;
      INSERT INTO d10_narrow_report VALUES ('03_probe_ready_change', v_root::text,
        v_skip::jsonb || jsonb_build_object('expression_id', v_expr, 'rolled_back', true));
  END;
END
$probe$;

SELECT part, name, info FROM d10_narrow_report ORDER BY 1, 2;

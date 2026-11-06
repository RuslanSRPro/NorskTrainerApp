-- 20261104100000_d10_synonym_shadow_v1.sql
-- D10_synonym_shadow_v1 (agreed 04.11.2026): shadow check of pairs from text analysis by two models side by side
-- (gemini-3.5-flash@low and gpt-6-luna@medium), class decided by the agreed feature rules (rules_v12).
-- Test only: production decisions, translations and publication do NOT change; nothing is published.
--  * config: shadow_enabled, shadow_variants (models + thinking level), daily_shadow_call_limit (own AI call limit);
--  * private.synonym_ai_extra_budget_v1: kind 'shadow' allowed (check constraint widened, rows unchanged);
--  * private.synonym_shadow_run_v1 / private.synonym_shadow_result_v1: answers next to the production decision;
--  * public.d10_synonym_shadow_cases_v1(limit): done pairs of candidates from a text analysis (last 7 days) that were
--    not shadow-checked with the same content (snapshot_hash);
--  * public.d10_synonym_shadow_start_v1 / _record_v1 (service role only).
-- Guards: D10_synonym_eval_v5 installed, shadow not installed; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_shadow_report;
CREATE TEMP TABLE d10_shadow_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regprocedure('public.d10_synonym_eval_start_v3(integer,text)') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_eval_v5 is not installed'; END IF;
  IF to_regclass('private.synonym_shadow_result_v1') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_shadow_v1 already installed'; END IF;
  IF to_regprocedure('private.synonym_card_all_translations_v1(text,uuid)') IS NULL
     OR to_regprocedure('private.synonym_target_sense_groups_v1(bigint,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STOP: eval v2 helper functions not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'synonym_ai_extra_budget_v1_kind_check') THEN
    RAISE EXCEPTION 'STOP: budget kind check not found (unexpected schema)';
  END IF;
END
$mig$;

ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN shadow_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN shadow_variants jsonb NOT NULL DEFAULT '[{"model":"gemini-3.5-flash","thinking":"low"},{"model":"gpt-6-luna","thinking":"medium"}]'::jsonb,
  ADD COLUMN daily_shadow_call_limit integer NOT NULL DEFAULT 60 CHECK (daily_shadow_call_limit >= 0 AND daily_shadow_call_limit <= 300);

ALTER TABLE private.synonym_ai_extra_budget_v1 DROP CONSTRAINT synonym_ai_extra_budget_v1_kind_check;
ALTER TABLE private.synonym_ai_extra_budget_v1 ADD CONSTRAINT synonym_ai_extra_budget_v1_kind_check CHECK (kind = ANY (ARRAY['fit', 'eval', 'shadow']));

CREATE TABLE private.synonym_shadow_run_v1 (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pairs integer NOT NULL,
  planned_calls integer NOT NULL,
  variants jsonb NOT NULL,
  summary jsonb);
CREATE TABLE private.synonym_shadow_result_v1 (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES private.synonym_shadow_run_v1(run_id),
  pair_id uuid NOT NULL,
  snapshot_hash text,
  variant text NOT NULL,
  model text NOT NULL,
  thinking text,
  stage text NOT NULL CHECK (stage IN ('relation', 'fit_source', 'fit_target')),
  prompt_version text NOT NULL,
  rules_version text,
  model_class text,
  rule_class text,
  guard text,
  fit text,
  answer jsonb,
  prod_decision text,
  prod_published boolean,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX synonym_shadow_result_v1_pair_idx ON private.synonym_shadow_result_v1 (pair_id, snapshot_hash, stage);
CREATE INDEX synonym_shadow_result_v1_run_idx ON private.synonym_shadow_result_v1 (run_id);
REVOKE ALL ON private.synonym_shadow_run_v1, private.synonym_shadow_result_v1 FROM PUBLIC;

-- done pairs of candidates collected by a text analysis in the last 7 days, not yet shadow-checked with the same
-- content; the same structure as the eval cases (all dictionary translations, target senses grouped). Nothing changes.
CREATE FUNCTION public.d10_synonym_shadow_cases_v1(p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  SELECT coalesce(jsonb_agg(jsonb_build_object('case_id', p.id::text, 'pair_id', p.id, 'snapshot_hash', p.snapshot_hash,
    'snapshot', p.snapshot, 'found', true,
    'target_groups', private.synonym_target_sense_groups_v1(p.target_article_key::bigint, p.snapshot->'target'->'definitions_nb'),
    'current', jsonb_build_object('decision', p.decision, 'published', p.published),
    'source_card', jsonb_build_object('lemma', p.snapshot->'source'->>'lemma', 'pos', p.snapshot->'source'->>'part_of_speech',
      'sense', coalesce(nullif(btrim(p.snapshot->'source'->'sense_context'->>'focus_gloss'), ''), p.snapshot->'source'->>'definition_nb'),
      'tr', private.synonym_card_all_translations_v1(p.source_entity_type, p.source_entity_id) - 'card'),
    'target_card', jsonb_build_object('lemma', p.snapshot->'target'->>'lemma', 'pos', p.snapshot->'target'->>'part_of_speech',
      'tr', private.synonym_card_all_translations_v1(p.target_entity_type, p.target_entity_id) - 'card'))
    ORDER BY p.verified_at DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT q.* FROM public.synonym_pair_v1 q
    JOIN public.synonym_candidate_queue c ON c.id = q.candidate_id
    WHERE q.status = 'done' AND q.decision IS NOT NULL AND q.target_article_key ~ '^[0-9]+$'
      AND (c.verification_evidence ? 'analysis_at')
      AND (c.verification_evidence->>'analysis_at')::timestamptz > now() - interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM private.synonym_shadow_result_v1 r
                      WHERE r.pair_id = q.id AND r.stage = 'relation' AND r.snapshot_hash IS NOT DISTINCT FROM q.snapshot_hash)
    ORDER BY q.verified_at DESC NULLS LAST
    LIMIT greatest(1, least(coalesce(p_limit, 20), 30))) p;
$f$;

-- start a shadow run: refused when disabled or when the daily shadow call limit would be passed
CREATE FUNCTION public.d10_synonym_shadow_start_v1(p_pairs integer, p_calls_per_variant integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%rowtype; v_used integer; v_run uuid; v_planned integer;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.shadow_enabled THEN RETURN jsonb_build_object('ok', false, 'error', 'shadow_disabled'); END IF;
  IF p_pairs IS NULL OR p_pairs < 1 OR p_calls_per_variant IS NULL OR p_calls_per_variant < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PLAN');
  END IF;
  IF jsonb_typeof(v_cfg.shadow_variants) <> 'array' OR jsonb_array_length(v_cfg.shadow_variants) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_variants');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_cfg.shadow_variants) v
             WHERE coalesce(v->>'model', '') !~ '^(gemini-[0-9]+(\.[0-9]+)?-[a-z0-9.-]+|gpt-[0-9]+(\.[0-9]+)?(-[a-z0-9.-]+)?)$'
                OR (v ? 'thinking' AND jsonb_typeof(v->'thinking') <> 'null' AND v->>'thinking' NOT IN ('minimal', 'none', 'low', 'medium', 'high'))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_VARIANT');
  END IF;
  v_planned := p_calls_per_variant * jsonb_array_length(v_cfg.shadow_variants);
  PERFORM pg_advisory_xact_lock(20261102, 9);
  SELECT coalesce(sum(units), 0) INTO v_used FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'shadow' AND reserved_at > now() - interval '24 hours';
  IF v_used + v_planned > v_cfg.daily_shadow_call_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_shadow_limit', 'used_24h', v_used, 'planned', v_planned, 'limit', v_cfg.daily_shadow_call_limit);
  END IF;
  INSERT INTO private.synonym_shadow_run_v1 (pairs, planned_calls, variants) VALUES (p_pairs, v_planned, v_cfg.shadow_variants) RETURNING run_id INTO v_run;
  INSERT INTO private.synonym_ai_extra_budget_v1 (kind, units, ref) VALUES ('shadow', v_planned, v_run::text);
  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'variants', v_cfg.shadow_variants, 'planned_calls', v_planned, 'used_24h', v_used + v_planned);
END
$f$;

-- record the answers; the production decision and publication of each pair are copied at this moment for comparison
CREATE FUNCTION public.d10_synonym_shadow_record_v1(p_run uuid, p_rows jsonb, p_summary jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.synonym_shadow_run_v1 WHERE run_id = p_run AND finished_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RUN_NOT_OPEN');
  END IF;
  INSERT INTO private.synonym_shadow_result_v1 (run_id, pair_id, snapshot_hash, variant, model, thinking, stage, prompt_version,
    rules_version, model_class, rule_class, guard, fit, answer, prod_decision, prod_published)
  SELECT p_run, (r->>'pair_id')::uuid, r->>'snapshot_hash', r->>'variant', r->>'model', r->>'thinking', r->>'stage', r->>'prompt_version',
    p_summary->>'rules', r->>'model_class', r->>'rule_class', r->>'guard', r->>'fit', r->'answer', p.decision, p.published
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  JOIN public.synonym_pair_v1 p ON p.id = (r->>'pair_id')::uuid
  WHERE r->>'stage' IN ('relation', 'fit_source', 'fit_target');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE private.synonym_shadow_run_v1 SET finished_at = now(), summary = p_summary WHERE run_id = p_run;
  RETURN jsonb_build_object('ok', true, 'rows', n);
END
$f$;

REVOKE ALL ON FUNCTION public.d10_synonym_shadow_cases_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_shadow_start_v1(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_shadow_record_v1(uuid, jsonb, jsonb) FROM PUBLIC;
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.d10_synonym_shadow_cases_v1(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.d10_synonym_shadow_start_v1(integer, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.d10_synonym_shadow_record_v1(uuid, jsonb, jsonb) TO service_role;
  END IF;
END
$g$;

-- probes (rolled back): pairs waiting for the shadow check; a run starts and records; the limit refuses
DO $p$
DECLARE c jsonb; s jsonb; r jsonb; big jsonb; nrows integer;
BEGIN
  c := public.d10_synonym_shadow_cases_v1(30);
  BEGIN
    s := public.d10_synonym_shadow_start_v1(1, 1);
    IF coalesce((s->>'ok')::boolean, false) AND jsonb_array_length(c) > 0 THEN
      r := public.d10_synonym_shadow_record_v1((s->>'run_id')::uuid, jsonb_build_array(jsonb_build_object('pair_id', c->0->>'pair_id',
        'snapshot_hash', c->0->>'snapshot_hash', 'variant', 'probe', 'model', 'probe', 'stage', 'relation', 'prompt_version', 'probe',
        'model_class', 'verified_synonym', 'rule_class', 'contextual_synonym')), '{"rules":"rules_v12"}'::jsonb);
      SELECT count(*) INTO nrows FROM jsonb_array_elements(public.d10_synonym_shadow_cases_v1(30));
    END IF;
    big := public.d10_synonym_shadow_start_v1(1, 1000);
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_shadow_report VALUES ('01_probe', 'waiting_pairs', jsonb_build_object('pairs', jsonb_array_length(c),
    'examples', (SELECT jsonb_agg((x->'snapshot'->'source'->>'lemma') || ' -> ' || (x->'snapshot'->'target'->>'lemma') || ' [' || (x->'current'->>'decision') || ']')
                 FROM (SELECT x FROM jsonb_array_elements(c) x LIMIT 8) t)));
  INSERT INTO d10_shadow_report VALUES ('01_probe', 'start (rolled back)', s);
  INSERT INTO d10_shadow_report VALUES ('01_probe', 'record (rolled back)', coalesce(r, '{}'::jsonb) || jsonb_build_object('waiting_after', nrows));
  INSERT INTO d10_shadow_report VALUES ('01_probe', 'limit_refuses', big);
END
$p$;
INSERT INTO d10_shadow_report SELECT '02_config', 'shadow', jsonb_build_object('enabled', shadow_enabled, 'variants', shadow_variants,
  'daily_shadow_call_limit', daily_shadow_call_limit, 'production_model_unchanged', model)
FROM public.synonym_verifier_config_v1 WHERE singleton;
SELECT part, name, info FROM d10_shadow_report ORDER BY 1, 2;

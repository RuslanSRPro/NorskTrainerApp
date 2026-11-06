-- 20261105170000_d10_synonym_rerun_v1.sql
-- D10_synonym_rerun_v1 (agreed 05.11.2026): two MANUAL modes for decisions that are already made. Both start with a
-- dry run (report only, nothing changes); applying needs p_apply := true and the number of pairs from the dry run
-- (p_expect). Nothing runs on a schedule; the whole-base walk stays off.
--  1. public.d10_synonym_rerule_v1(p_apply, p_expect) - recount WITHOUT AI: the class of every v12 decision is
--     computed again from the AI answer stored in it (v11_answer), with the rules now set in the config
--     (verifier_rules). Only pairs decided under OTHER rules can change; a pair decided under the current rules
--     that comes out different is reported as a mismatch and never changed (it would mean an error in this port).
--     r12: every v12 answer. r13: only answers that have register_kind (prompt v11c) and, for a clean result, the
--     second answer; others are reported as needing AI. v10 decisions have no stored answer -> mode 2.
--     Applying: new class, evidence (rule_class, rules, rerule), old decision to history; the publication trigger
--     publishes / withdraws; a pair that becomes clean or contextual without translation fits gets them requested.
--  2. public.d10_synonym_recheck_v1(p_words, p_version_like, p_decision, p_max, p_apply, p_expect) - a NEW AI answer
--     for the chosen pairs (by words, verifier version, decision; at least one filter). Pairs with the same relation
--     content are taken together, so the AI really answers again. Dry run: pairs, AI calls, approximate cost.
--     Applying (at most p_max pairs): the pairs go back to the queue (old decision to history; they leave the app
--     until the next verifier run decides them again). Dictionary rule decisions (rule:...) are never taken.
--  private.synonym_rule_class_v1(evidence, rules): the SQL copy of ruleClassV12 / ruleClassV13 + vote of the edge function.
-- Both functions: service role / SQL Editor only. Guards: D10_synonym_nuance_chip_v1 installed; reinstall -> STOP.
DROP TABLE IF EXISTS pg_temp.d10_rerun_report;
CREATE TEMP TABLE d10_rerun_report(part text, name text, info jsonb);
DO $g$
BEGIN
  IF to_regprocedure('public.d10_synonym_rerule_v1(boolean,integer)') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_rerun_v1 already installed'; END IF;
  IF to_regclass('private.synonym_nuance_v1') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_nuance_v1 is not installed'; END IF;
  IF has_function_privilege('anon', 'public.get_synonym_carousel_v4(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_nuance_chip_v1 (v4 grants) is not installed';
  END IF;
END
$g$;

-- SQL copy of the edge rules (index.ts ruleClassV12 / ruleClassV13 / voteClassV13), from the stored evidence:
-- v11_answer = the AI answer d; guard / model_class / matched_definition = the guard result g; vote_class = class of
-- the second answer (r13). NULL = cannot be computed from the stored answer (needs AI).
CREATE FUNCTION private.synonym_rule_class_v1(p_ev jsonb, p_rules text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE d jsonb := p_ev->'v11_answer'; g_guard text := nullif(p_ev->>'guard', ''); g_final text := p_ev->>'model_class';
  g_md numeric; fwd boolean; rev boolean; added boolean; md text; diff boolean; light boolean; heavy boolean;
  v_first text; v_vote text;
BEGIN
  IF d IS NULL OR jsonb_typeof(d) <> 'object' THEN RETURN NULL; END IF;
  g_md := CASE WHEN jsonb_typeof(p_ev->'matched_definition') = 'number' THEN (p_ev->>'matched_definition')::numeric END;
  IF p_rules = 'r12' THEN
    IF g_guard IS NOT NULL AND g_guard NOT IN ('ai_category_contradiction', 'code_category', 'meaning_difference') THEN RETURN g_final; END IF;
  ELSIF p_rules = 'r13' THEN
    IF NOT (d ? 'register_kind') THEN RETURN NULL; END IF;
    -- 'votes_disagree' replaces the guard when the second answer disagreed: the first answer was clean then
    IF g_guard = 'votes_disagree' THEN
      RETURN CASE WHEN p_ev->>'vote_class' IN ('verified_synonym', 'contextual_synonym') THEN p_ev->>'vote_class' ELSE 'needs_manual_review' END;
    END IF;
    IF g_guard IS NOT NULL AND g_guard NOT IN ('ai_category_contradiction', 'code_category', 'meaning_difference', 'added_component') THEN
      -- the guard decides the first answer; a clean one still needs the second answer (as in the edge function)
      IF g_final IS DISTINCT FROM 'verified_synonym' THEN RETURN g_final; END IF;
      v_vote := p_ev->>'vote_class';
      IF v_vote IS NULL THEN RETURN NULL; END IF;
      RETURN CASE WHEN v_vote IN ('verified_synonym', 'contextual_synonym') THEN v_vote ELSE 'needs_manual_review' END;
    END IF;
  ELSE
    RETURN NULL;
  END IF;
  IF coalesce(g_md, -1) < 0 OR d->>'decision' = 'rejected' THEN RETURN 'rejected'; END IF;
  fwd := d->'substitution_forward' = 'true'::jsonb;
  rev := d->'substitution_reverse' = 'true'::jsonb;
  IF NOT fwd AND NOT rev THEN RETURN CASE WHEN d->>'decision' = 'near_synonym' THEN 'near_synonym' ELSE 'rejected' END; END IF;
  IF fwd <> rev THEN RETURN 'one_way_synonym'; END IF;
  md := regexp_replace(coalesce(d->>'meaning_difference', ''), '^\s+|\s+$', '', 'g');
  IF p_rules = 'r12' THEN
    added := coalesce(d->>'added_component', 'none') <> 'none';
    diff := md <> '' AND md !~* '^(none|no|nothing|ingen|-)\.?$';
    IF added OR d->'additional_restriction' = 'true'::jsonb OR diff OR d->'same_construction' = 'false'::jsonb THEN RETURN 'contextual_synonym'; END IF;
    RETURN 'verified_synonym';
  END IF;
  light := d->>'register_kind' = 'colloquial' AND coalesce(d->>'added_component', 'none') IN ('none', 'register');
  added := coalesce(d->>'added_component', 'none') <> 'none' AND NOT light;
  diff := NOT light AND md <> '' AND md !~* '^(none|no|nothing|ingen|-)\.?$';
  heavy := coalesce(d->>'register_kind', 'none') IN ('formal', 'literary_or_archaic', 'regional', 'technical', 'unknown');
  v_first := CASE WHEN added OR heavy OR d->'additional_restriction' = 'true'::jsonb OR diff OR d->'same_construction' = 'false'::jsonb
    THEN 'contextual_synonym' ELSE 'verified_synonym' END;
  IF v_first <> 'verified_synonym' THEN RETURN v_first; END IF;
  v_vote := p_ev->>'vote_class';
  IF v_vote IS NULL THEN RETURN NULL; END IF;
  RETURN CASE WHEN v_vote IN ('verified_synonym', 'contextual_synonym') THEN v_vote ELSE 'needs_manual_review' END;
END
$f$;

-- mode 1: recount without AI
CREATE FUNCTION public.d10_synonym_rerule_v1(p_apply boolean DEFAULT false, p_expect integer DEFAULT NULL)
RETURNS TABLE(part text, name text, info jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_rules text; v_rules_tag text; v_version text; v_n integer; v_fit integer := 0; r record; v_senses jsonb; v_res jsonb;
BEGIN
  SELECT verifier_rules INTO v_rules FROM public.synonym_verifier_config_v1 WHERE singleton;
  v_rules_tag := CASE v_rules WHEN 'r13' THEN 'rules_v13' ELSE 'rules_v12' END;
  v_version := public.d10_synonym_verifier_version_v1();
  CREATE TEMP TABLE IF NOT EXISTS d10_rerule_pick(id uuid, src text, tgt text, old_decision text, new_decision text,
    old_rules text, published boolean, kind text) ON COMMIT DROP;
  TRUNCATE d10_rerule_pick;
  INSERT INTO d10_rerule_pick
  SELECT p.id, p.snapshot->'source'->>'lemma', p.snapshot->'target'->>'lemma', p.decision, c.cls,
    coalesce(p.verification_evidence->>'rules', 'rules_v12'), p.published,
    CASE WHEN c.cls IS NULL THEN 'needs_ai'
         WHEN c.cls = p.decision THEN 'same'
         WHEN coalesce(p.verification_evidence->>'rules', 'rules_v12') = v_rules_tag THEN 'mismatch'
         ELSE 'change' END
  FROM public.synonym_pair_v1 p
  CROSS JOIN LATERAL (SELECT private.synonym_rule_class_v1(p.verification_evidence, v_rules) AS cls) c
  WHERE p.status = 'done' AND p.verifier_version LIKE 'ai:synonym_pair_v12:%' AND p.verification_evidence->>'contract' = 'v12';
  SELECT count(*) INTO v_n FROM d10_rerule_pick k WHERE k.kind = 'change';
  RETURN QUERY SELECT '01_summary'::text, 'rules ' || v_rules, jsonb_build_object(
    'apply', p_apply, 'v12_decisions', (SELECT count(*) FROM d10_rerule_pick),
    'same', (SELECT count(*) FROM d10_rerule_pick k WHERE k.kind = 'same'),
    'would_change', v_n,
    'mismatch_same_rules_never_changed', (SELECT count(*) FROM d10_rerule_pick k WHERE k.kind = 'mismatch'),
    'needs_ai_answer_missing', (SELECT count(*) FROM d10_rerule_pick k WHERE k.kind = 'needs_ai'),
    'older_decisions_need_ai', (SELECT count(*) FROM public.synonym_pair_v1 q WHERE q.status = 'done' AND q.verifier_version LIKE 'ai:%'
       AND q.verifier_version NOT LIKE 'ai:synonym_pair_v12:%'),
    'transitions', (SELECT coalesce(jsonb_object_agg(t, n), '{}'::jsonb) FROM (SELECT k.old_decision || ' -> ' || k.new_decision AS t, count(*) AS n
       FROM d10_rerule_pick k WHERE k.kind = 'change' GROUP BY 1) x));
  RETURN QUERY SELECT CASE k.kind WHEN 'change' THEN '02_change' ELSE '03_mismatch' END, k.src || ' -> ' || k.tgt,
    jsonb_build_object('pair_id', k.id, 'now', k.old_decision, 'new', k.new_decision, 'decided_under', k.old_rules, 'published', k.published)
  FROM d10_rerule_pick k WHERE k.kind IN ('change', 'mismatch') ORDER BY 1, 2;
  IF NOT p_apply THEN RETURN; END IF;
  IF p_expect IS DISTINCT FROM v_n THEN
    RAISE EXCEPTION 'STOP: % pairs would change, p_expect = % (run the dry run again and pass its number)', v_n, p_expect;
  END IF;
  FOR r IN SELECT p.*, k.new_decision FROM public.synonym_pair_v1 p JOIN d10_rerule_pick k ON k.id = p.id WHERE k.kind = 'change' FOR UPDATE OF p LOOP
    UPDATE public.synonym_pair_v1 p
    SET decision = r.new_decision,
        history = p.history || jsonb_build_array(jsonb_build_object('status', p.status, 'decision', p.decision, 'published', p.published,
          'verifier_version', p.verifier_version, 'verified_at', p.verified_at, 'rule_class', p.verification_evidence->'rule_class',
          'rules', p.verification_evidence->'rules', 'superseded_at', now(), 'superseded_by', 'd10_synonym_rerule_v1')),
        -- additional_restriction as the edge function stores it under these rules (publication of a clean pair reads it)
        verification_evidence = p.verification_evidence || jsonb_build_object('rule_class', r.new_decision, 'rules', v_rules_tag,
          'additional_restriction', (p.verification_evidence->'v11_answer'->'additional_restriction' = 'true'::jsonb)
            OR (coalesce(p.verification_evidence->'v11_answer'->>'added_component', 'none') <> 'none'
                AND NOT (v_rules = 'r13' AND p.verification_evidence->'v11_answer'->>'register_kind' = 'colloquial'
                         AND p.verification_evidence->'v11_answer'->>'added_component' IN ('none', 'register'))),
          'rerule', jsonb_build_object('at', now(), 'from', p.decision, 'from_rules', coalesce(p.verification_evidence->>'rules', 'rules_v12'))),
        verifier_version = CASE WHEN v_version LIKE 'ai:synonym_pair_v12:%' THEN v_version ELSE p.verifier_version END,
        updated_at = now()
    WHERE p.id = r.id;
    -- a pair that becomes clean or contextual needs both translation fits (as d10_synonym_record_decision_v1 asks them)
    IF r.new_decision IN ('verified_synonym', 'contextual_synonym')
       AND (r.verification_evidence->>'source_fit_key' IS NULL OR r.verification_evidence->>'target_fit_key' IS NULL) THEN
      v_senses := private.synonym_pair_senses_v1(r.snapshot, r.source_entity_type, r.source_entity_id,
        r.target_entity_type, r.target_entity_id, r.target_article_key, r.verification_evidence->>'matched_text');
      IF v_senses->>'source_sense_key' IS NOT NULL AND v_senses->>'target_sense_key' IS NOT NULL THEN
        v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
          jsonb_build_object('ref', 's', 'all_translations', true, 'entity_type', r.source_entity_type, 'entity_id', r.source_entity_id,
            'sense_key', v_senses->>'source_sense_key', 'sense_text', v_senses->>'source_sense_text',
            'contexts', coalesce(r.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
          jsonb_build_object('ref', 't', 'all_translations', true, 'entity_type', r.target_entity_type, 'entity_id', r.target_entity_id,
            'sense_key', v_senses->>'target_sense_key', 'sense_text', v_senses->>'target_sense_text',
            'contexts', jsonb_build_array(v_senses->>'target_sense_text'))));
        UPDATE public.synonym_pair_v1 p SET verification_evidence = p.verification_evidence
          || jsonb_strip_nulls(jsonb_build_object('source_sense_key', v_senses->>'source_sense_key', 'target_sense_key', v_senses->>'target_sense_key',
               'source_fit_key', v_res->0->>'fit_key', 'target_fit_key', v_res->1->>'fit_key'))
        WHERE p.id = r.id;
        v_fit := v_fit + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT '04_applied'::text, 'summary'::text, jsonb_build_object('changed', v_n, 'fits_requested_for', v_fit,
    'published_now', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published));
END
$f$;

-- mode 2: a new AI answer for chosen pairs
CREATE FUNCTION public.d10_synonym_recheck_v1(p_words text[] DEFAULT NULL, p_version_like text DEFAULT NULL,
  p_decision text DEFAULT NULL, p_max integer DEFAULT 20, p_apply boolean DEFAULT false, p_expect integer DEFAULT NULL)
RETURNS TABLE(part text, name text, info jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%ROWTYPE; v_n integer; v_calls integer; v_used integer; v_version text;
BEGIN
  IF p_words IS NULL AND p_version_like IS NULL AND p_decision IS NULL THEN
    RAISE EXCEPTION 'STOP: give at least one filter: p_words, p_version_like or p_decision';
  END IF;
  SELECT * INTO v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  v_version := public.d10_synonym_verifier_version_v1();
  CREATE TEMP TABLE IF NOT EXISTS d10_recheck_pick(id uuid, src text, tgt text, decision text, version text, published boolean, why text) ON COMMIT DROP;
  TRUNCATE d10_recheck_pick;
  WITH chosen AS (
    SELECT p.id, p.verification_evidence->>'relation_key' AS rk FROM public.synonym_pair_v1 p
    WHERE p.status = 'done' AND p.verifier_version LIKE 'ai:%'
      AND (p_words IS NULL OR lower(p.snapshot->'source'->>'lemma') = ANY (SELECT lower(w) FROM unnest(p_words) w)
                           OR lower(p.snapshot->'target'->>'lemma') = ANY (SELECT lower(w) FROM unnest(p_words) w))
      AND (p_version_like IS NULL OR p.verifier_version LIKE p_version_like)
      AND (p_decision IS NULL OR p.decision = p_decision)
  )
  INSERT INTO d10_recheck_pick
  SELECT p.id, p.snapshot->'source'->>'lemma', p.snapshot->'target'->>'lemma', p.decision, p.verifier_version, p.published,
    CASE WHEN p.id IN (SELECT id FROM chosen) THEN 'chosen' ELSE 'same_content' END
  FROM public.synonym_pair_v1 p
  WHERE p.status = 'done' AND p.verifier_version LIKE 'ai:%'
    AND (p.id IN (SELECT id FROM chosen)
      -- pairs with the same relation content would hand the old answer back without AI: they go too
      OR (p.verification_evidence->>'relation_key' IS NOT NULL AND p.verification_evidence->>'relation_key' IN (SELECT rk FROM chosen WHERE rk IS NOT NULL)
          AND p.verifier_version = v_version));
  SELECT count(*) INTO v_n FROM d10_recheck_pick;
  v_calls := ceil(v_n::numeric / greatest(v_cfg.pairs_per_call, 1));
  SELECT count(*) INTO v_used FROM private.synonym_ai_budget_v1 WHERE reserved_at > now() - interval '24 hours';
  RETURN QUERY SELECT '01_summary'::text, 'filter'::text, jsonb_build_object(
    'apply', p_apply, 'words', to_jsonb(p_words), 'version_like', p_version_like, 'decision', p_decision,
    'pairs', v_n, 'of_them_same_content', (SELECT count(*) FROM d10_recheck_pick k WHERE k.why = 'same_content'),
    'published_now', (SELECT count(*) FROM d10_recheck_pick k WHERE k.published), 'max', p_max,
    'ai_calls_relation_about', v_calls, 'cost_usd_about', round(v_n * 0.0006, 3),
    'model', v_cfg.model || '@' || coalesce(v_cfg.verifier_thinking, 'default'), 'version_after', v_version,
    'daily_pair_limit', v_cfg.daily_ai_pair_limit, 'used_24h_about', v_used);
  RETURN QUERY SELECT '02_pair'::text, k.src || ' -> ' || k.tgt, jsonb_build_object('pair_id', k.id, 'decision', k.decision,
    'version', k.version, 'published', k.published, 'why', k.why)
  FROM d10_recheck_pick k ORDER BY 2;
  IF NOT p_apply THEN RETURN; END IF;
  IF v_n > coalesce(p_max, 0) THEN RAISE EXCEPTION 'STOP: % pairs, more than p_max = %', v_n, p_max; END IF;
  IF p_expect IS DISTINCT FROM v_n THEN
    RAISE EXCEPTION 'STOP: % pairs chosen, p_expect = % (run the dry run again and pass its number)', v_n, p_expect;
  END IF;
  UPDATE public.synonym_pair_v1 p
  SET status = 'queued',
      history = p.history || jsonb_build_array(jsonb_build_object('status', p.status, 'decision', p.decision, 'confidence', p.confidence,
        'verifier_version', p.verifier_version, 'verified_at', p.verified_at, 'published', p.published,
        'verification_evidence', p.verification_evidence, 'superseded_at', now(), 'superseded_by', 'd10_synonym_recheck_v1')),
      decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL, verified_at = NULL,
      attempts = 0, next_attempt_at = NULL, last_error = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
  FROM d10_recheck_pick k WHERE p.id = k.id AND p.status = 'done';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN QUERY SELECT '03_applied'::text, 'summary'::text, jsonb_build_object('queued', v_n,
    'next', 'SELECT public.d10_synonym_bm_call_edge_v1(''synonym-verifier'', ''{}''::jsonb);');
END
$f$;

REVOKE ALL ON FUNCTION private.synonym_rule_class_v1(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_rerule_v1(boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_recheck_v1(text[], text, text, integer, boolean, integer) FROM PUBLIC;
DO $r$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['private.synonym_rule_class_v1(jsonb, text)', 'public.d10_synonym_rerule_v1(boolean, integer)',
    'public.d10_synonym_recheck_v1(text[], text, text, integer, boolean, integer)'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM anon'; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM authenticated'; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f || ' TO service_role'; END IF;
  END LOOP;
END $r$;

-- report: dry runs of both modes (nothing changes)
INSERT INTO d10_rerun_report SELECT '01_rerule_dry_run', x.name, x.info FROM public.d10_synonym_rerule_v1(false) x WHERE x.part = '01_summary';
INSERT INTO d10_rerun_report SELECT '02_rerule_mismatch', x.name, x.info FROM public.d10_synonym_rerule_v1(false) x WHERE x.part = '03_mismatch';
INSERT INTO d10_rerun_report SELECT '03_recheck_dry_run_snakke', x.name, x.info FROM public.d10_synonym_recheck_v1(ARRAY['snakke']) x WHERE x.part = '01_summary';
SELECT part, name, info FROM d10_rerun_report ORDER BY 1, 2;

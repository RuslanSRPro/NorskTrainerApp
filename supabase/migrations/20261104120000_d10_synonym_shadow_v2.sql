-- 20261104120000_d10_synonym_shadow_v2.sql
-- D10_synonym_shadow_v2 (agreed 04.11.2026):
--  * public.d10_synonym_shadow_cases_v2(limit, scope): scope 'analysis' = as v1 (pairs from text analysis, 7 days);
--    scope 'published' = pairs published now (any origin) not yet shadow-checked with the same content.
--    v1 stays (not removed).
--  * public.d10_synonym_shadow_unpublish_v1(p_apply): the cleanup of D10_synonym_cleanup_v1 as a function that can be
--    run again: published pairs whose CURRENT content gpt-6-luna@medium (rules_v12) does not confirm as a clean
--    synonym -> status needs_manual_review, rule_reason d10_cleanup_shadow_v12; nothing deleted, previous state in
--    history. p_apply = false only shows what would be taken off.
-- Test/cleanup only: production verifier, model and publication rule do NOT change.
-- Guards: D10_synonym_cleanup_v1 applied, v2 not installed; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_shadow2_report;
CREATE TEMP TABLE d10_shadow2_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regprocedure('public.d10_synonym_shadow_cases_v1(integer)') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_shadow_v1 is not installed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 WHERE rule_reason = 'd10_cleanup_shadow_v12') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_cleanup_v1 is not applied';
  END IF;
  IF to_regprocedure('public.d10_synonym_shadow_cases_v2(integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_shadow_v2 already installed'; END IF;
END
$mig$;

CREATE FUNCTION public.d10_synonym_shadow_cases_v2(p_limit integer, p_scope text)
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
    WHERE q.status = 'done' AND q.decision IS NOT NULL AND q.target_article_key ~ '^[0-9]+$'
      AND CASE WHEN p_scope = 'published' THEN q.published
               ELSE EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = q.candidate_id
                              AND (c.verification_evidence ? 'analysis_at')
                              AND (c.verification_evidence->>'analysis_at')::timestamptz > now() - interval '7 days') END
      AND NOT EXISTS (SELECT 1 FROM private.synonym_shadow_result_v1 r
                      WHERE r.pair_id = q.id AND r.stage = 'relation' AND r.snapshot_hash IS NOT DISTINCT FROM q.snapshot_hash)
    ORDER BY q.verified_at DESC NULLS LAST
    LIMIT greatest(1, least(coalesce(p_limit, 20), 30))) p;
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_shadow_cases_v2(integer, text) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.d10_synonym_shadow_cases_v2(integer, text) TO service_role;
  END IF;
END $g$;

-- repeatable cleanup (SQL Editor only): what gpt-6-luna@medium does not confirm is taken off publication
CREATE FUNCTION public.d10_synonym_shadow_unpublish_v1(p_apply boolean)
RETURNS TABLE(part text, name text, info jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_before integer; v_n integer := 0;
BEGIN
  SELECT count(*) INTO v_before FROM public.synonym_pair_v1 WHERE published;
  CREATE TEMP TABLE IF NOT EXISTS d10_unpub_pick(id uuid, src text, tgt text, decision text, rule_class text, model_class text, answer jsonb) ON COMMIT DROP;
  TRUNCATE d10_unpub_pick;
  INSERT INTO d10_unpub_pick
  SELECT p.id, p.snapshot->'source'->>'lemma', p.snapshot->'target'->>'lemma', p.decision, s.rule_class, s.model_class, s.answer
  FROM public.synonym_pair_v1 p
  JOIN LATERAL (SELECT r.* FROM private.synonym_shadow_result_v1 r
    WHERE r.pair_id = p.id AND r.stage = 'relation' AND r.variant = 'gpt-6-luna@medium'
      AND r.snapshot_hash IS NOT DISTINCT FROM p.snapshot_hash
    ORDER BY r.created_at DESC LIMIT 1) s ON true
  WHERE p.published AND p.status = 'done' AND s.rule_class IS DISTINCT FROM 'verified_synonym';
  RETURN QUERY SELECT '01_before'::text, 'published_pairs_total'::text, jsonb_build_object('n', v_before, 'apply', p_apply);
  RETURN QUERY SELECT '02_unpublish', k.src || ' -> ' || k.tgt, jsonb_build_object('pair_id', k.id, 'production', k.decision,
    'shadow_rules', k.rule_class, 'added', k.answer->>'added_component', 'difference', left(k.answer->>'meaning_difference', 160),
    'reason', left(k.answer->>'reason', 160)) FROM d10_unpub_pick k;
  IF p_apply THEN
    UPDATE public.synonym_pair_v1 p
    SET status = 'needs_manual_review', rule_reason = 'd10_cleanup_shadow_v12',
        history = p.history || jsonb_build_array(jsonb_build_object('status', p.status, 'decision', p.decision, 'published', p.published,
          'verifier_version', p.verifier_version, 'verified_at', p.verified_at, 'confidence', p.confidence,
          'verification_evidence', p.verification_evidence, 'snapshot_hash', p.snapshot_hash, 'superseded_at', now(),
          'superseded_by', 'd10_synonym_shadow_unpublish_v1')),
        verification_evidence = p.verification_evidence || jsonb_build_object('cleanup_v12', jsonb_build_object('at', now(),
          'shadow_variant', 'gpt-6-luna@medium', 'shadow_rule_class', k.rule_class, 'shadow_model_class', k.model_class,
          'shadow_reason', left(k.answer->>'reason', 300), 'shadow_difference', left(k.answer->>'meaning_difference', 300))),
        updated_at = now()
    FROM d10_unpub_pick k WHERE p.id = k.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;
  RETURN QUERY SELECT '03_after', 'summary', jsonb_build_object('taken_off', v_n,
    'published_pairs_total', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published),
    'published_not_shadow_checked', (SELECT count(*) FROM public.synonym_pair_v1 q WHERE q.published AND NOT EXISTS (
       SELECT 1 FROM private.synonym_shadow_result_v1 r WHERE r.pair_id = q.id AND r.stage = 'relation' AND r.variant = 'gpt-6-luna@medium'
         AND r.snapshot_hash IS NOT DISTINCT FROM q.snapshot_hash)),
    'published_without_article', (SELECT count(*) FROM public.synonym_pair_v1 q WHERE q.published AND q.target_article_key !~ '^[0-9]+$'));
END
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_shadow_unpublish_v1(boolean) FROM PUBLIC;

INSERT INTO d10_shadow2_report SELECT '01_waiting', 'published_scope', jsonb_build_object('pairs_next_batch',
  jsonb_array_length(public.d10_synonym_shadow_cases_v2(30, 'published')),
  'published_total', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published),
  'published_without_article', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published AND target_article_key !~ '^[0-9]+$'));
INSERT INTO d10_shadow2_report SELECT '01_waiting', 'analysis_scope', jsonb_build_object('pairs_next_batch',
  jsonb_array_length(public.d10_synonym_shadow_cases_v2(30, 'analysis')));
INSERT INTO d10_shadow2_report SELECT '02_unpublish_dry_run', u.name, u.info FROM public.d10_synonym_shadow_unpublish_v1(false) u WHERE u.part <> '02_unpublish';
INSERT INTO d10_shadow2_report SELECT '03_config', 'shadow', jsonb_build_object('variants', shadow_variants, 'daily_shadow_call_limit', daily_shadow_call_limit)
FROM public.synonym_verifier_config_v1 WHERE singleton;
SELECT part, name, info FROM d10_shadow2_report ORDER BY 1, 2;

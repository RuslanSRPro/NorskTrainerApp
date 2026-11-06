-- 20261104110000_d10_synonym_cleanup_v1.sql
-- D10_synonym_cleanup_v1 (agreed 04.11.2026): published pairs that the shadow check (gpt-6-luna@medium, rules_v12)
-- does NOT confirm as a clean synonym are taken off publication: status -> needs_manual_review,
-- rule_reason = 'd10_cleanup_shadow_v12'. Nothing is deleted: the decision stays, the previous state is added to
-- the pair history, the shadow answer is added to the evidence. The publication trigger withdraws the link.
-- After the switch to the new verifier these pairs are rechecked (they come back through analysis / the switch).
-- Only pairs whose CURRENT content was shadow-checked (same snapshot_hash) are touched.
-- Guards: D10_synonym_shadow_v1 installed, cleanup not applied yet; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_cleanup_report;
CREATE TEMP TABLE d10_cleanup_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regclass('private.synonym_shadow_result_v1') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_shadow_v1 is not installed'; END IF;
  IF EXISTS (SELECT 1 FROM public.synonym_pair_v1 WHERE rule_reason = 'd10_cleanup_shadow_v12') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_cleanup_v1 already applied';
  END IF;
END
$mig$;

CREATE TEMP TABLE d10_cleanup_pick ON COMMIT DROP AS
SELECT p.id, p.snapshot->'source'->>'lemma' AS src, p.snapshot->'target'->>'lemma' AS tgt, p.decision, s.rule_class,
  s.model_class, s.answer, s.created_at AS shadow_at
FROM public.synonym_pair_v1 p
JOIN LATERAL (SELECT r.* FROM private.synonym_shadow_result_v1 r
  WHERE r.pair_id = p.id AND r.stage = 'relation' AND r.variant = 'gpt-6-luna@medium'
    AND r.snapshot_hash IS NOT DISTINCT FROM p.snapshot_hash
  ORDER BY r.created_at DESC LIMIT 1) s ON true
WHERE p.published AND p.status = 'done' AND s.rule_class IS DISTINCT FROM 'verified_synonym';

INSERT INTO d10_cleanup_report SELECT '01_before', 'published_pairs_total', jsonb_build_object('n', count(*))
FROM public.synonym_pair_v1 WHERE published;
INSERT INTO d10_cleanup_report SELECT '02_unpublish', src || ' -> ' || tgt, jsonb_build_object('pair_id', id, 'production', decision,
  'shadow_rules', rule_class, 'shadow_model', model_class, 'added', answer->>'added_component',
  'difference', left(answer->>'meaning_difference', 160), 'reason', left(answer->>'reason', 160))
FROM d10_cleanup_pick;

UPDATE public.synonym_pair_v1 p
SET status = 'needs_manual_review', rule_reason = 'd10_cleanup_shadow_v12',
    history = p.history || jsonb_build_array(jsonb_build_object('status', p.status, 'decision', p.decision, 'published', p.published,
      'verifier_version', p.verifier_version, 'verified_at', p.verified_at, 'confidence', p.confidence,
      'verification_evidence', p.verification_evidence, 'snapshot_hash', p.snapshot_hash, 'superseded_at', now(),
      'superseded_by', 'D10_synonym_cleanup_v1')),
    verification_evidence = p.verification_evidence || jsonb_build_object('cleanup_v12', jsonb_build_object('at', now(),
      'shadow_variant', 'gpt-6-luna@medium', 'shadow_rule_class', k.rule_class, 'shadow_model_class', k.model_class,
      'shadow_reason', left(k.answer->>'reason', 300), 'shadow_difference', left(k.answer->>'meaning_difference', 300))),
    updated_at = now()
FROM d10_cleanup_pick k WHERE p.id = k.id;

INSERT INTO d10_cleanup_report SELECT '03_after', 'still_published_of_picked', jsonb_build_object('n', count(*))
FROM public.synonym_pair_v1 p JOIN d10_cleanup_pick k ON k.id = p.id WHERE p.published;
INSERT INTO d10_cleanup_report SELECT '03_after', 'published_pairs_total', jsonb_build_object('n', count(*))
FROM public.synonym_pair_v1 WHERE published;
INSERT INTO d10_cleanup_report SELECT '03_after', 'links_left_for_picked', jsonb_build_object('n', count(*))
FROM public.authoritative_semantic_relations r JOIN d10_cleanup_pick k ON true JOIN public.synonym_pair_v1 p ON p.id = k.id
WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
  AND r.source_entity_id IN (p.source_entity_id, p.target_entity_id) AND r.target_entity_id IN (p.source_entity_id, p.target_entity_id);
INSERT INTO d10_cleanup_report SELECT '04_still_published', p.snapshot->'source'->>'lemma' || ' -> ' || (p.snapshot->'target'->>'lemma'),
  jsonb_build_object('pair_id', p.id, 'shadow_luna', (SELECT r.rule_class FROM private.synonym_shadow_result_v1 r
    WHERE r.pair_id = p.id AND r.stage = 'relation' AND r.variant = 'gpt-6-luna@medium' ORDER BY r.created_at DESC LIMIT 1))
FROM public.synonym_pair_v1 p WHERE p.published;
SELECT part, name, info FROM d10_cleanup_report ORDER BY 1, 2;

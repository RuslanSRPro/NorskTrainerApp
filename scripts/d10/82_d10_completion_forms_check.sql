-- 82_d10_completion_forms_check.sql
-- Read only. Run AFTER migration 20261013210000.
-- Job 18efc887 ("Er tiden. Jeg husker"): learner completion snapshot of the
-- lexemes huske (verb, equivalent articles 24686+24687) and være (noun).
-- One result set: check | result | detail
--   T1 huske   forms > 0 now (was 0)                       expected PASS
--   T2 være    paradigm indeclinable + 4 allowed slots      expected PASS
--   T3 other lexemes of the job keep their forms             expected PASS
--   T4 equivalent-article lexemes in the whole base with an active snapshot
--      (informational: how many lexemes the fix (a) covers, ~44)
WITH params AS (SELECT '18efc887-22b8-406f-82c4-7a9c7e5d0224'::uuid AS job_id),
pages AS (
  WITH RECURSIVE pg AS (
    SELECT 1 AS n, public.get_completion_evidence_snapshot_v2((SELECT job_id FROM params), NULL, 50, NULL) AS s
    UNION ALL
    SELECT pg.n + 1, public.get_completion_evidence_snapshot_v2((SELECT job_id FROM params),
             pg.s->'page'->>'next_cursor', 50, pg.s->>'snapshot_token')
    FROM pg WHERE coalesce((pg.s->'page'->>'has_more')::boolean, false) AND pg.n < 20
  ) SELECT * FROM pg
),
ents AS (
  SELECT e FROM pages p, jsonb_array_elements(p.s->'page'->'entities') e
  WHERE e->>'entity_kind' = 'lexeme'
)
SELECT 'T1 huske verb forms' AS check,
       CASE WHEN jsonb_array_length(e->'forms') > 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       jsonb_build_object('forms', jsonb_array_length(e->'forms'),
         'form_types', (SELECT jsonb_agg(DISTINCT x->>'form_type') FROM jsonb_array_elements(e->'forms') x),
         'article_ref', e->'forms'->0->'source_refs'->0) AS detail
FROM ents WHERE e->>'entity_id' = 'd400112d-130d-406d-b4f0-88051b78f4a6'
UNION ALL
SELECT 'T2 være noun indeclinable',
       CASE WHEN e->'identity'->>'paradigm_type' = 'indeclinable'
             AND jsonb_array_length(e->'identity'->'paradigm_source_refs') > 0
             AND jsonb_array_length(e->'identity'->'allowed_missing_slots') = 4
            THEN 'PASS' ELSE 'FAIL' END,
       jsonb_build_object('paradigm_type', e->'identity'->'paradigm_type',
         'paradigm_source_refs', e->'identity'->'paradigm_source_refs',
         'allowed_missing_slots', e->'identity'->'allowed_missing_slots',
         'forms', jsonb_array_length(e->'forms'))
FROM ents WHERE e->>'entity_id' = '36be4f30-dd8f-4202-a2c5-4f19ffd373c5'
UNION ALL
SELECT 'T3 other lexemes with forms',
       CASE WHEN count(*) FILTER (WHERE jsonb_array_length(e->'forms') > 0) > 0 THEN 'PASS' ELSE 'FAIL' END,
       jsonb_build_object('lexemes', count(*),
         'with_forms', count(*) FILTER (WHERE jsonb_array_length(e->'forms') > 0),
         'without_forms', jsonb_agg(e->>'lemma' || ' (' || (e->>'pos') || ')')
                          FILTER (WHERE jsonb_array_length(e->'forms') = 0))
FROM ents WHERE e->>'entity_id' NOT IN ('d400112d-130d-406d-b4f0-88051b78f4a6', '36be4f30-dd8f-4202-a2c5-4f19ffd373c5')
UNION ALL
SELECT 'T4 equivalent-article lexemes (info)', 'INFO',
       jsonb_build_object('active_snapshots', count(*),
         'with_display_rows', count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.lexeme_form_display_v2 f
           WHERE f.snapshot_id = ms.id AND f.article_id IS NULL)))
FROM private.authoritative_morphology_snapshots_v2 ms
WHERE ms.is_active AND ms.article_resolution = 'equivalent_source_articles'
ORDER BY 1;

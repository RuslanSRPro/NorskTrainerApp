-- 83_d10_i_tide_paa_tide_check.sql
-- Read only. Why are the family expressions "i tide" (provisional) and
-- "på tide" (blocked) not ready in job 18efc887 ("Er tiden. Jeg husker")?
-- One result set: section | name | detail  (long - send as file)
--   1_catalog      expression_catalog rows (all fields)
--   2_items        items of these expressions in the job + admission summary
--   3_family       family injection rows and lexeme360 roots
--   4_checks       source checks (Ordbøkene / NAOB / Lexin) of these items
--   5_evidence     expression_source_evidence rows
--   6_translations entity_translations rows
--   7_snapshot     learner completion snapshot entity (what the app evaluates)
WITH params AS (SELECT '18efc887-22b8-406f-82c4-7a9c7e5d0224'::uuid AS job_id),
ex AS (
  SELECT e.* FROM public.expression_catalog e
  WHERE lower(btrim(e.lemma)) IN ('i tide', 'på tide')
),
it AS (
  SELECT i.* FROM public.lexeme_processing_items i JOIN params p ON p.job_id = i.job_id
  WHERE i.expression_id IN (SELECT id FROM ex)
     OR lower(btrim(coalesce(i.normalized_lemma, i.raw_input))) IN ('i tide', 'på tide')
),
pages AS (
  WITH RECURSIVE pg AS (
    SELECT 1 AS n, public.get_completion_evidence_snapshot_v2((SELECT job_id FROM params), NULL, 50, NULL) AS s
    UNION ALL
    SELECT pg.n + 1, public.get_completion_evidence_snapshot_v2((SELECT job_id FROM params),
             pg.s->'page'->>'next_cursor', 50, pg.s->>'snapshot_token')
    FROM pg WHERE coalesce((pg.s->'page'->>'has_more')::boolean, false) AND pg.n < 20
  ) SELECT * FROM pg
)
SELECT '1_catalog' AS section, ex.lemma || ' ' || ex.id AS name, to_jsonb(ex) AS detail FROM ex
UNION ALL
SELECT '2_items', coalesce(it.normalized_lemma, it.raw_input) || ' ' || it.id,
       jsonb_build_object('expression_id', it.expression_id, 'lexeme_id', it.lexeme_id,
         'status', it.status, 'stage', it.current_stage, 'pos', it.pos, 'last_error', it.last_error,
         'result_summary', it.result_summary)
FROM it
UNION ALL
SELECT '3_family', 'injection ' || f.expression_id,
       to_jsonb(f) || jsonb_build_object('root_lemma', (SELECT l.lemma || ' (' || l.pos || ')' FROM public.lexemes l WHERE l.id = f.root_lexeme_id))
FROM private.d10_job_family_injections_v1 f JOIN params p ON p.job_id = f.job_id
WHERE f.expression_id IN (SELECT id FROM ex)
UNION ALL
SELECT '3_family', 'root ' || r.expression_id,
       to_jsonb(r) || jsonb_build_object('root_lemma', (SELECT l.lemma || ' (' || l.pos || ')' FROM public.lexemes l WHERE l.id = r.root_lexeme_id))
FROM private.lexeme360_expression_roots_v1 r
WHERE r.expression_id IN (SELECT id FROM ex)
UNION ALL
SELECT '4_checks', c.source || ' / ' || c.stage || ' / ' || c.query,
       to_jsonb(c) - 'urls'
FROM public.lexeme_source_checks c
WHERE c.item_id IN (SELECT id FROM it)
UNION ALL
SELECT '5_evidence', ese.source || ' ' || ese.expression_id, to_jsonb(ese)
FROM public.expression_source_evidence ese
WHERE ese.expression_id IN (SELECT id FROM ex)
UNION ALL
SELECT '6_translations', coalesce(t.language_code, '?') || ' ' || coalesce(t.source, '?') || ' ' || t.expression_id, to_jsonb(t)
FROM public.entity_translations t
WHERE t.expression_id IN (SELECT id FROM ex)
UNION ALL
SELECT '7_snapshot', e->>'lemma', e
FROM pages p, jsonb_array_elements(p.s->'page'->'entities') e
WHERE e->>'entity_kind' = 'expression' AND (e->>'entity_id')::uuid IN (SELECT id FROM ex)
ORDER BY 1, 2;

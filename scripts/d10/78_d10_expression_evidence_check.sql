-- 78_d10_expression_evidence_check.sql
-- Read only. Run AFTER migration 20261013200200 (plan C, option b).
-- Job 18efc887 (13.10): every expression item with its own-article check,
-- review status and own_article evidence row.
-- Expected:
--   admitted family expressions (semantic_audit) with a matched own-article
--   check -> evidence_rows >= 1 and review_status = verified
--   gray ones (admission_gate, own article not matched) -> 0 rows, unchanged
-- Last row: totals of the whole backfill.
WITH items AS (
  SELECT i.id, i.expression_id, i.current_stage, e.lemma,
         e.ordbokene_status, e.naob_status, e.expression_review_status,
         (SELECT jsonb_build_object('status', sc.status, 'found', sc.found,
                   'whole_unit', sc.whole_unit_match,
                   'scope', sc.evidence->'raw_preview'->>'lookup_scope',
                   'article', sc.evidence->'raw_preview'->'article_ids'->>0,
                   'label', sc.evidence->>'evidence_label')
            FROM public.lexeme_source_checks sc
           WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' LIMIT 1) AS own_check,
         (SELECT count(*) FROM public.expression_source_evidence s
           WHERE s.expression_id = i.expression_id AND s.lexeme_id IS NULL
             AND s.source = 'ordbokene' AND s.source_status = 'own_article') AS evidence_rows
  FROM public.lexeme_processing_items i
  JOIN public.expression_catalog e ON e.id = i.expression_id
  WHERE i.job_id = '18efc887-22b8-406f-82c4-7a9c7e5d0224'
    AND i.match_type = 'expression'
)
SELECT current_stage AS stage, lemma,
       jsonb_build_object('review_status', expression_review_status,
         'ordbokene_status', ordbokene_status, 'naob_status', naob_status,
         'evidence_rows', evidence_rows, 'own_check', own_check) AS detail,
       CASE
         WHEN (own_check->>'found')::boolean AND own_check->>'scope' = 'candidate_article'
              AND (evidence_rows = 0 OR (ordbokene_status = 'sub_article' AND expression_review_status <> 'verified'))
           THEN 'FAIL'
         WHEN NOT coalesce((own_check->>'found')::boolean, false) AND evidence_rows > 0 THEN 'CHECK (evidence from another job)'
         ELSE 'PASS'
       END AS verdict
FROM items
UNION ALL
SELECT 'TOTAL', 'backfill',
       jsonb_build_object(
         'own_article_rows', (SELECT count(*) FROM public.expression_source_evidence
                              WHERE source = 'ordbokene' AND source_status = 'own_article'),
         'expressions_verified_by_own_article', (SELECT count(*) FROM public.expression_catalog e
            WHERE e.ordbokene_status = 'sub_article' AND e.expression_review_status = 'verified'
              AND EXISTS (SELECT 1 FROM public.expression_source_evidence s
                          WHERE s.expression_id = e.id AND s.source = 'ordbokene'
                            AND s.source_status = 'own_article'))),
       NULL
ORDER BY 1, 2;

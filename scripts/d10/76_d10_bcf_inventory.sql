-- 76_d10_bcf_inventory.sql
-- Read only. Facts needed to build stages B, C, F (plan D10_homonym_pos_plan_v2).
-- Jobs: 3779546f (12.10) and 18efc887 (13.10, after stage A).
-- One result set: section | name | detail
--   1_expr_status     family expressions (ledger d10_job_family_injections_v1):
--                     distribution of ordbokene_status / naob_status /
--                     expression_review_status / expression_subtype /
--                     verification_status, and whether a non-AI
--                     expression_source_evidence row exists
--   2_expr_sample     5 family expressions of the 13.10 job in full (catalog
--                     row without large fields) + their own-article candidates
--   3_evidence_kinds  existing expression_source_evidence rows by source /
--                     source_status (what "whole-unit evidence" looks like today)
--   4_pos_carry       13.10 job: per token item, POS on item / promoted lexeme /
--                     Ordbokene evidence; flag when they differ (stage B2)
--   5_clones          13.10 job: POS clones, with the parent's context rule
--                     (stage B1: which clones the new text rule would stop)
--   6_family_roots    13.10 job: family ledger rows whose root lexeme / article
--                     is not a promoted token of this job with that article (C1)
WITH fam AS (
  SELECT DISTINCT f.expression_id FROM private.d10_job_family_injections_v1 f
),
fam_e AS (
  SELECT e.*,
    EXISTS (SELECT 1 FROM public.expression_source_evidence s
            WHERE s.expression_id = e.id
              AND lower(s.source) NOT IN ('ai', 'gemini', 'ai_fallback')) AS has_dict_evidence
  FROM public.expression_catalog e JOIN fam ON fam.expression_id = e.id
),
newjob AS (SELECT '18efc887-22b8-406f-82c4-7a9c7e5d0224'::uuid AS id),
tok AS (
  SELECT i.*, l.pos AS lexeme_pos,
    (SELECT sc.evidence->'raw_preview'->>'pos' FROM public.lexeme_source_checks sc
      WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' LIMIT 1) AS ordbokene_pos,
    (SELECT sc.evidence->'raw_preview'->'article_ids' FROM public.lexeme_source_checks sc
      WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' LIMIT 1) AS ordbokene_articles
  FROM public.lexeme_processing_items i
  JOIN newjob n ON n.id = i.job_id
  LEFT JOIN public.lexemes l ON l.id = i.lexeme_id
  WHERE i.match_type = 'token'
)
SELECT '1_expr_status' AS section,
       concat_ws(' | ', coalesce(ordbokene_status, '-'), coalesce(naob_status, '-'),
         coalesce(expression_review_status, '-'), coalesce(expression_subtype, '-'),
         coalesce(verification_status, '-')) AS name,
       jsonb_build_object('count', count(*),
         'with_dict_evidence', count(*) FILTER (WHERE has_dict_evidence)) AS detail
FROM fam_e
GROUP BY ordbokene_status, naob_status, expression_review_status, expression_subtype, verification_status
UNION ALL
SELECT '2_expr_sample', x.lemma,
       jsonb_build_object(
         'catalog', to_jsonb(x) - 'verification_evidence' - 'embedding' - 'search_vector',
         'own_article_candidates', (SELECT jsonb_agg(to_jsonb(c) - 'payload' - 'raw_payload')
            FROM public.ordbokene_expression_candidates c WHERE c.promoted_expression_id = x.id))
FROM (
  SELECT e.* FROM public.expression_catalog e
  JOIN private.d10_job_family_injections_v1 f ON f.expression_id = e.id
  JOIN newjob n ON n.id = f.job_id
  ORDER BY e.lemma LIMIT 5
) x
UNION ALL
SELECT '3_evidence_kinds', s.source || ' / ' || coalesce(s.source_status, '-'),
       jsonb_build_object('rows', count(*),
         'with_text', count(*) FILTER (WHERE nullif(s.expression_text, '') IS NOT NULL OR nullif(s.surface_form, '') IS NOT NULL))
FROM public.expression_source_evidence s
WHERE s.expression_id IS NOT NULL
GROUP BY s.source, s.source_status
UNION ALL
SELECT '4_pos_carry', coalesce(t.normalized_lemma, t.raw_input) || ' (' || coalesce(t.pos, '?') || ')',
       jsonb_build_object('item_id', t.id, 'stage', t.current_stage,
         'item_pos', t.pos, 'lexeme_pos', t.lexeme_pos, 'ordbokene_pos', t.ordbokene_pos,
         'ordbokene_articles', t.ordbokene_articles,
         'mismatch', (t.lexeme_pos IS NOT NULL AND t.lexeme_pos IS DISTINCT FROM t.pos)
                  OR (t.ordbokene_pos IS NOT NULL AND t.ordbokene_pos IS DISTINCT FROM t.pos))
FROM tok t
UNION ALL
SELECT '5_clones', coalesce(t.normalized_lemma, t.raw_input) || ' (' || coalesce(t.pos, '?') || ')',
       jsonb_build_object('clone_item_id', t.id, 'stage', t.current_stage,
         'promotion_status', t.result_summary->>'promotion_status',
         'parent_pos', p.pos,
         'parent_rule', p.result_summary->'resolved_features'->>'disambiguation_rule',
         'parent_resolution', p.result_summary->'resolved_features'->>'v2_resolution_status')
FROM tok t
JOIN public.lexeme_processing_items p ON p.id = (t.result_summary->>'cloned_from_item_id')::uuid
WHERE t.result_summary ? 'cloned_from_item_id'
UNION ALL
SELECT '6_family_roots', e.lemma,
       jsonb_build_object('expression_id', f.expression_id, 'root_lexeme_id', f.root_lexeme_id,
         'root_article_id', f.root_article_id,
         'root_promoted_in_job', EXISTS (SELECT 1 FROM public.lexeme_processing_items i
            WHERE i.job_id = f.job_id AND i.lexeme_id = f.root_lexeme_id
              AND i.result_summary->>'promotion_status' = 'promoted'),
         'root_article_in_job_evidence', EXISTS (SELECT 1 FROM public.lexeme_processing_items i
            JOIN public.lexeme_source_checks sc ON sc.item_id = i.id AND sc.source = 'Ordbokene'
            WHERE i.job_id = f.job_id AND i.lexeme_id = f.root_lexeme_id
              AND sc.evidence->'raw_preview'->'article_ids' @> to_jsonb(ARRAY[f.root_article_id::text])))
FROM private.d10_job_family_injections_v1 f
JOIN newjob n ON n.id = f.job_id
JOIN public.expression_catalog e ON e.id = f.expression_id
ORDER BY 1, 2;

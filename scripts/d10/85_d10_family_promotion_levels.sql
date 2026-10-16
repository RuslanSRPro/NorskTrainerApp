-- 85_d10_family_promotion_levels.sql
-- Read only. Which family-360 expressions became colored (promoted) and on
-- what evidence of THEIR OWN job checks. Basis for the på tide decision.
-- One result set: section | name | detail
--   1_summary   counts per group over all jobs
--   2_items     every promoted family item outside group A (lemma, job, checks)
-- Groups (Ordbøkene own-article check of the item in its job):
--   A own_article_ok      "Own exact Bokmål expression article"
--   B own_article_mismatch "Expression article identity mismatch"
--   C no_own_article      any other Ordbøkene result or no check
-- live_whole_unit = some check of the item itself has registered_entry or
-- whole_unit_match (rank >= 4 without the stored candidate bonus).
WITH fam AS (
  SELECT i.id AS item_id, i.job_id, i.expression_id,
         coalesce(i.normalized_lemma, i.raw_input) AS lemma,
         i.result_summary->>'promotion_status' AS promotion,
         i.result_summary->>'admission_status' AS admission,
         i.result_summary->>'verification_status' AS vstatus,
         (SELECT sc.evidence->>'evidence_label' FROM public.lexeme_source_checks sc
          WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
          ORDER BY sc.updated_at DESC LIMIT 1) AS own_label,
         EXISTS (SELECT 1 FROM public.lexeme_source_checks sc
                 WHERE sc.item_id = i.id AND sc.found IS TRUE
                   AND (sc.registered_entry IS TRUE OR sc.whole_unit_match IS TRUE)) AS live_whole_unit,
         (SELECT string_agg(sc.source || ':' || coalesce(sc.quality, '?')
                 || CASE WHEN sc.registered_entry THEN ':reg' ELSE '' END
                 || CASE WHEN sc.whole_unit_match THEN ':whole' ELSE '' END
                 || CASE WHEN sc.usage_match THEN ':usage' ELSE '' END, ' ' ORDER BY sc.source)
          FROM public.lexeme_source_checks sc WHERE sc.item_id = i.id) AS checks,
         (SELECT e.expression_review_status FROM public.expression_catalog e WHERE e.id = i.expression_id) AS review_status
  FROM public.lexeme_processing_items i
  JOIN private.d10_job_family_injections_v1 f
    ON f.job_id = i.job_id AND f.item_id = i.id AND f.expression_id = i.expression_id
),
g AS (
  SELECT fam.*,
    CASE WHEN own_label = 'Own exact Bokmål expression article' THEN 'A own_article_ok'
         WHEN own_label = 'Expression article identity mismatch' THEN 'B own_article_mismatch'
         ELSE 'C no_own_article' END AS grp
  FROM fam
)
SELECT '1_summary' AS section, grp || ' / ' || coalesce(promotion, '?') AS name,
       jsonb_build_object('items', count(*), 'expressions', count(DISTINCT expression_id),
         'live_whole_unit', count(*) FILTER (WHERE live_whole_unit),
         'without_live_whole_unit', count(*) FILTER (WHERE NOT live_whole_unit),
         'review_verified', count(*) FILTER (WHERE review_status = 'verified')) AS detail
FROM g GROUP BY grp, promotion
UNION ALL
SELECT '2_items', grp || ' | ' || lemma,
       jsonb_build_object('job', job_id, 'item', item_id, 'promotion', promotion,
         'verification_status', vstatus, 'review_status', review_status,
         'own_label', own_label, 'live_whole_unit', live_whole_unit, 'checks', checks)
FROM g
WHERE promotion = 'expression_promoted' AND grp <> 'A own_article_ok'
ORDER BY 1, 2;

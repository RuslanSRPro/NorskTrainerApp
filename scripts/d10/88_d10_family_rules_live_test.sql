-- 88_d10_family_rules_live_test.sql
-- Read only. Live test after deploy of lexical-worker: analyze the text
--   "Vi kom fram i tide. Jeg husker det."
-- and run this when the job has finished. It takes the newest job whose text
-- contains "i tide". Short columns (screenshot friendly).
-- Expected:
--   i tide      Ordbøkene check "Own exact Bokmål expression article",
--               own_article evidence 1, review verified, colored
--   husker      verb, has family members (verb root)
--   tid family  none (noun roots no longer give a family)
--   gray        family members not verified -> admission_gate / not_promoted
WITH job AS (
  SELECT j.id, j.status FROM public.lexeme_processing_jobs j
  WHERE j.input_text ILIKE '%i tide%'
  ORDER BY j.created_at DESC LIMIT 1
)
SELECT 'job' AS what, (SELECT id::text || ' / ' || status FROM job) AS item, NULL::text AS stage,
       NULL::text AS promotion, NULL::text AS detail
UNION ALL
SELECT 'item', coalesce(i.normalized_lemma, i.raw_input) || ' (' || coalesce(i.pos, '?') || ')',
       i.current_stage,
       i.result_summary->>'promotion_status',
       concat_ws(' | ',
         CASE WHEN f.item_id IS NOT NULL THEN 'family of ' || (SELECT l.lemma || ' ' || l.pos FROM public.lexemes l WHERE l.id = f.root_lexeme_id) END,
         i.result_summary->>'admission_reason',
         (SELECT 'review ' || e.expression_review_status FROM public.expression_catalog e WHERE e.id = i.expression_id),
         (SELECT 'ordbokene: ' || (sc.evidence->>'evidence_label') FROM public.lexeme_source_checks sc
          WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' ORDER BY sc.updated_at DESC LIMIT 1),
         (SELECT 'own_article ' || count(*) FROM public.expression_source_evidence s
          WHERE s.expression_id = i.expression_id AND s.source = 'ordbokene' AND s.source_status = 'own_article'
          HAVING count(*) > 0))
FROM public.lexeme_processing_items i
JOIN job ON job.id = i.job_id
LEFT JOIN private.d10_job_family_injections_v1 f ON f.job_id = i.job_id AND f.item_id = i.id
ORDER BY 1 DESC, 2;

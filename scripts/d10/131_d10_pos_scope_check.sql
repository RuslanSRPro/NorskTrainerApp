-- 131: part of speech of source answers (D10_pos_scope_v1). Read only.
-- Last job with token checks; one row per word, card POS and source.
WITH j AS (
  SELECT sc.job_id
  FROM public.lexeme_source_checks sc
  WHERE sc.query_type = 'token' AND sc.updated_at > now() - interval '2 days'
  ORDER BY sc.updated_at DESC
  LIMIT 1
)
SELECT sc.query AS word,
       i.pos AS card_pos,
       sc.source AS src,
       sc.found,
       sc.quality,
       sc.evidence->>'pos_match' AS pos_match,
       sc.evidence->'found_pos' AS found_pos,
       sc.evidence->>'pos_basis' AS basis
FROM public.lexeme_source_checks sc
JOIN j ON j.job_id = sc.job_id
LEFT JOIN public.lexeme_processing_items i ON i.id = sc.item_id
WHERE sc.query_type = 'token'
ORDER BY 1, 2, 3;

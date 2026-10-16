-- 105_d10_no_article_words.sql
-- Read only. Words for a live test of the no-article AI translation:
-- Ordbøkene answered "no article" for their part of speech, they are verified
-- by other sources, have no second card. "uk"/"en" = translation sources
-- present now (empty = no translation). Short columns, 15 rows.
SELECT l.lemma, l.pos, l.verification_status AS status,
       coalesce((SELECT string_agg(DISTINCT t.source, ',') FROM public.entity_translations t
                  WHERE t.lexeme_id = l.id AND t.expression_id IS NULL AND t.language_code = 'uk'
                    AND t.translation_type = 'primary'), '') AS uk,
       coalesce((SELECT string_agg(DISTINCT t.source, ',') FROM public.entity_translations t
                  WHERE t.lexeme_id = l.id AND t.expression_id IS NULL AND t.language_code = 'en'
                    AND t.translation_type = 'primary'), '') AS en
FROM public.lexemes l
WHERE l.verification_evidence->'Ordbokene'->>'quality' = 'not_found'
  AND coalesce(l.homograph_key, '') = ''
  AND l.verification_status IN ('authoritative', 'usage_verified', 'multi_source', 'candidate')
  AND CASE WHEN jsonb_typeof(l.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'candidate_article_ids') = 'array'
           THEN jsonb_array_length(l.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'candidate_article_ids')
           ELSE 0 END = 0
  AND NOT EXISTS (SELECT 1 FROM public.lexemes s WHERE s.lemma = l.lemma AND s.pos = l.pos AND s.id <> l.id)
ORDER BY (SELECT count(*) FROM public.entity_translations t WHERE t.lexeme_id = l.id), l.lemma
LIMIT 15;

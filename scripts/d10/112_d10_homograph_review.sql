-- 112_d10_homograph_review.sql
-- Read only. Homograph decisions that need your eye. Short columns.
--   A  R9 guard: forms differ but the meaning looks the same -> no second card
--      was created automatically (decision skipped, review = true).
--   B  main card without a September binding: its main article was chosen by
--      the lowest Roman number (vende, styr and future words). Check the meaning.
--   C  the other articles of those words and what was decided for them.
-- Definitions: first explanation of the cached Ordbøkene article (may be empty
-- when the article is not in ordbokene_article_cache yet).
WITH dec AS (
  SELECT d.*, m.lemma, m.pos
  FROM private.d10_homograph_article_decisions_v1 d
  JOIN public.lexemes m ON m.id = d.main_lexeme_id
),
defs AS (
  SELECT c.article_id,
         (SELECT left(e->>'content', 70)
            FROM jsonb_path_query(c.payload, 'strict $.body.definitions.**') AS e
           WHERE e->>'type_' = 'explanation' LIMIT 1) AS first_def
  FROM public.ordbokene_article_cache c
  WHERE c.dictionary_code = 'bm'
    AND c.article_id IN (SELECT article_id FROM dec)
)
SELECT 'A r9 guard' AS part, dec.lemma || ' ' || dec.pos || ' ' || coalesce(public.d10_roman_v1(dec.hgno), '?') AS word,
       dec.article_id::text AS article, coalesce(defs.first_def, '') AS definition
FROM dec LEFT JOIN defs ON defs.article_id = dec.article_id
WHERE dec.decision = 'skipped' AND coalesce((dec.evidence->>'review')::boolean, false)
UNION ALL
SELECT 'B main by number', dec.lemma || ' ' || dec.pos || ' ' || coalesce(public.d10_roman_v1(dec.hgno), '?'),
       dec.article_id::text, coalesce(defs.first_def, '')
FROM dec LEFT JOIN defs ON defs.article_id = dec.article_id
WHERE dec.decision = 'main_article'
UNION ALL
SELECT 'C other: ' || dec.decision, dec.lemma || ' ' || dec.pos || ' ' || coalesce(public.d10_roman_v1(dec.hgno), '?'),
       dec.article_id::text, coalesce(defs.first_def, '')
FROM dec LEFT JOIN defs ON defs.article_id = dec.article_id
WHERE dec.decision <> 'main_article'
  AND NOT (dec.decision = 'skipped' AND coalesce((dec.evidence->>'review')::boolean, false))
  AND dec.main_lexeme_id IN (SELECT main_lexeme_id FROM dec WHERE decision = 'main_article')
ORDER BY 1, 2;

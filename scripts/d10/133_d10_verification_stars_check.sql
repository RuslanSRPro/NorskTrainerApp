-- 133: server star rating (D10_verification_stars_v1). Read only.
-- A: every lexeme and expression has a rating (T1 PASS).
-- B: stars distribution, words and expressions.
-- C: sample words.
-- D: rule cases on fixed evidence (no table read), every row PASS.
SELECT 'A T1 every row rated' AS part,
       CASE WHEN (SELECT count(*) FROM public.lexemes l WHERE NOT EXISTS (
                    SELECT 1 FROM public.verification_stars_v1 v WHERE v.entity_type = 'lexeme' AND v.entity_id = l.id))
               + (SELECT count(*) FROM public.expression_catalog e WHERE NOT EXISTS (
                    SELECT 1 FROM public.verification_stars_v1 v WHERE v.entity_type = 'expression' AND v.entity_id = e.id)) = 0
            THEN 'PASS' ELSE 'FAIL' END AS value, NULL::bigint AS n
UNION ALL
SELECT 'B ' || entity_type || ' stars', stars::text, count(*)
FROM public.verification_stars_v1 GROUP BY entity_type, stars
UNION ALL
SELECT 'C ' || l.lemma || ' (' || l.pos || ')',
       v.stars || ' | old tier ' || coalesce(l.verification_tier, '-') || ' | ord ' || (v.rating->>'ordbokene')
         || ' naob ' || (v.rating->>'naob') || ' lexin ' || (v.rating->>'lexin') || ' wikt ' || (v.rating->>'wiktionary'),
       NULL
FROM public.lexemes l
JOIN public.verification_stars_v1 v ON v.entity_type = 'lexeme' AND v.entity_id = l.id
WHERE l.lemma IN ('brenne', 'vinterjakke', 'like', 'drikke', 'styr', 'tid')
UNION ALL
SELECT 'D ' || c.name,
       CASE WHEN (public.d10_verification_rating_v1(c.ev::jsonb, c.pos)->>'stars')::int = c.expect THEN 'PASS' ELSE 'FAIL' END,
       c.expect
FROM (VALUES
  ('brenne noun, sources only verb', 'noun', '{"Ordbokene":{"found":false},"NAOB":{"found":true,"registered_entry":true,"evidence":{"original_quality":"registered_entry","pos_match":"mismatch"}},"Lexin":{"found":true,"registered_entry":true,"evidence":{"pos_match":"mismatch"}}}', 1),
  ('verb, Ordbokene verb article', 'verb', '{"Ordbokene":{"found":true,"registered_entry":true,"evidence":{"original_quality":"registered_entry","pos_match":"match","raw_preview":{"pos":"verb"}}}}', 5),
  ('noun, NAOB noun + Lexin noun', 'noun', '{"NAOB":{"found":true,"registered_entry":true,"evidence":{"original_quality":"registered_entry","pos_match":"match","pos_basis":"naob_article_heading"}},"Lexin":{"found":true,"evidence":{"pos_match":"match"}}}', 4),
  ('noun, NAOB noun only', 'noun', '{"NAOB":{"found":true,"registered_entry":true,"evidence":{"original_quality":"registered_entry","pos_match":"match","pos_basis":"naob_article_heading"}}}', 3),
  ('noun, NAOB mention only', 'noun', '{"NAOB":{"found":true,"evidence":{"original_quality":"search_page_match","pos_match":"unknown"}}}', 2),
  ('noun, Spraakraadet only', 'noun', '{"Språkrådet":{"found":true,"usage_match":true}}', 2),
  ('noun, AI only', 'noun', '{}', 1),
  ('expression, Lexin only', 'expression', '{"Lexin":{"found":true,"usage_match":true,"evidence":{"original_quality":"learner_dictionary"}}}', 3)
) AS c(name, pos, ev, expect)
ORDER BY 1, 2;

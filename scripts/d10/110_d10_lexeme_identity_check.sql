-- 110_d10_lexeme_identity_check.sql
-- Read only. After migration 20261015140000. Expected:
--   T1 bok article 6790   -> main
--   T2 bok article 106786 -> II
--   T3 lemma bok          -> main (bok II is a second card, not a main card)
--   T4 count of lemmas with several main cards (several parts of speech):
--      their relation targets now stay candidates instead of an error.
SELECT 'T1 article 6790' AS test,
       coalesce((SELECT coalesce(nullif(l.homograph_key, ''), 'main') FROM public.lexemes l
                 WHERE l.id = public.d10_lexeme_for_article_v1(6790, 'bm', 'bok')), 'NULL') AS result
UNION ALL
SELECT 'T2 article 106786',
       coalesce((SELECT coalesce(nullif(l.homograph_key, ''), 'main') FROM public.lexemes l
                 WHERE l.id = public.d10_lexeme_for_article_v1(106786, 'bm', 'bok')), 'NULL')
UNION ALL
SELECT 'T3 lemma bok',
       coalesce((SELECT coalesce(nullif(l.homograph_key, ''), 'main') || ' ' || l.pos FROM public.lexemes l
                 WHERE l.id = public.d10_lexeme_for_lemma_v1('bok')), 'NULL')
UNION ALL
SELECT 'T4 lemmas with several main cards',
       (SELECT count(*)::text FROM (SELECT lower(lemma) FROM public.lexemes
         WHERE coalesce(homograph_key, '') = '' GROUP BY lower(lemma) HAVING count(*) > 1) x);

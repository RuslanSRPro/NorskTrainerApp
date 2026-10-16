-- D10 15.10.2026 (agreed): choose a card by article, never "the first one".
-- With second cards (bok / bok II) and lemmas with several parts of speech, a
-- lookup by lemma alone is ambiguous. Two read-only helpers:
--   d10_lexeme_for_article_v1(article, dictionary, lemma)
--     the ONE card bound to this Ordbøkene article (headword aliases, the
--     same identity the family 360 binding uses); NULL when none or several.
--   d10_lexeme_for_lemma_v1(lemma)
--     the ONE main card (homograph_key '') with this lemma; NULL when none or
--     several (e.g. a noun and a verb) - the caller then does not choose.
-- New functions only; nothing existing changes. Re-running is a no-op.

CREATE OR REPLACE FUNCTION public.d10_lexeme_for_article_v1(
  p_article_id bigint, p_dictionary_code text DEFAULT 'bm', p_lemma text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT min(alias.lexeme_id::text)::uuid
  FROM public.lexeme_headword_aliases_v2 alias
  WHERE alias.dictionary_code = lower(btrim(coalesce(p_dictionary_code, 'bm')))
    AND alias.article_id = p_article_id
    AND alias.is_active
    AND (p_lemma IS NULL
      OR alias.normalized_headword = private.normalize_lexeme360_root_v1(p_lemma))
  HAVING count(DISTINCT alias.lexeme_id) = 1;
$body$;

CREATE OR REPLACE FUNCTION public.d10_lexeme_for_lemma_v1(p_lemma text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT min(l.id::text)::uuid
  FROM public.lexemes l
  WHERE lower(l.lemma) = lower(btrim(p_lemma))
    AND coalesce(l.homograph_key, '') = ''
  HAVING count(*) = 1;
$body$;

REVOKE ALL ON FUNCTION public.d10_lexeme_for_article_v1(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_lexeme_for_lemma_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_lexeme_for_article_v1(bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_lexeme_for_lemma_v1(text) TO service_role;

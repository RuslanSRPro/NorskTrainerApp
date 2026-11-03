BEGIN;
ALTER TABLE public.lexemes ADD COLUMN homonym_card_ids uuid[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION private.refresh_homonym_count_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
DECLARE keys text[];k text;ids uuid[];n integer;
BEGIN
 IF TG_OP='INSERT' THEN keys:=ARRAY[lower(btrim(NEW.lemma))];
 ELSIF TG_OP='DELETE' THEN keys:=ARRAY[lower(btrim(OLD.lemma))];
 ELSE keys:=ARRAY[lower(btrim(OLD.lemma)),lower(btrim(NEW.lemma))]; END IF;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(k,20261101));
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO ids FROM public.lexemes
   WHERE lower(btrim(lemma))=k AND coalesce(pos,'')<>'expression' AND coalesce(dictionary_status,'')<>'excluded';
  n:=cardinality(ids);
  UPDATE public.lexemes l SET homonym_card_count=CASE WHEN l.id=ANY(ids) THEN n ELSE 0 END,
   homonym_card_ids=CASE WHEN l.id=ANY(ids) THEN array_remove(ids,l.id) ELSE '{}'::uuid[] END
  WHERE lower(btrim(l.lemma))=k AND (l.homonym_card_count IS DISTINCT FROM CASE WHEN l.id=ANY(ids) THEN n ELSE 0 END
   OR l.homonym_card_ids IS DISTINCT FROM CASE WHEN l.id=ANY(ids) THEN array_remove(ids,l.id) ELSE '{}'::uuid[] END);
 END LOOP;
 RETURN NULL;
END $f$;
WITH groups AS (SELECT lower(btrim(lemma)) k,array_agg(id ORDER BY id) ids FROM public.lexemes
 WHERE coalesce(pos,'')<>'expression' AND coalesce(dictionary_status,'')<>'excluded' GROUP BY 1)
UPDATE public.lexemes l SET homonym_card_ids=array_remove(g.ids,l.id) FROM groups g
WHERE lower(btrim(l.lemma))=g.k AND l.id=ANY(g.ids);

-- One batch for explicitly linked identities, no lemma search on the client.
CREATE FUNCTION public.get_homonym_cards_v1(p_ids uuid[])
RETURNS TABLE(id uuid,lemma text,pos text,translation_ua text,translation_en text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 WITH cards AS MATERIALIZED (SELECT l.id,l.lemma,l.pos FROM public.lexemes l
  WHERE l.id=ANY(coalesce(p_ids,'{}'::uuid[])) AND coalesce(l.pos,'')<>'expression'
   AND coalesce(l.dictionary_status,'')<>'excluded'),
 tr AS MATERIALIZED (SELECT * FROM public.get_canonical_lexeme_translations_v1(
  (SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM cards)))
 SELECT c.id,c.lemma,c.pos,max(t.translation) FILTER(WHERE t.language_code='uk'),
  max(t.translation) FILTER(WHERE t.language_code='en')
 FROM cards c LEFT JOIN tr t ON t.lexeme_id=c.id GROUP BY c.id,c.lemma,c.pos
$f$;
REVOKE ALL ON FUNCTION public.get_homonym_cards_v1(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_homonym_cards_v1(uuid[]) TO authenticated,service_role;
COMMIT;

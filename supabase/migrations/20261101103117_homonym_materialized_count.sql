BEGIN;
ALTER TABLE public.lexemes ADD COLUMN homonym_card_count integer NOT NULL DEFAULT 0 CHECK(homonym_card_count>=0);
CREATE INDEX IF NOT EXISTS lexemes_homonym_lemma_idx ON public.lexemes(lower(btrim(lemma)));
CREATE FUNCTION private.refresh_homonym_count_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
DECLARE keys text[]; k text;n integer;
BEGIN
 IF TG_OP='INSERT' THEN keys:=ARRAY[lower(btrim(NEW.lemma))];
 ELSIF TG_OP='DELETE' THEN keys:=ARRAY[lower(btrim(OLD.lemma))];
 ELSE keys:=ARRAY[lower(btrim(OLD.lemma)),lower(btrim(NEW.lemma))]; END IF;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP
  SELECT count(*) INTO n FROM public.lexemes WHERE lower(btrim(lemma))=k
   AND coalesce(pos,'')<>'expression' AND coalesce(dictionary_status,'')<>'excluded';
  UPDATE public.lexemes SET homonym_card_count=CASE WHEN coalesce(pos,'')<>'expression'
   AND coalesce(dictionary_status,'')<>'excluded' THEN n ELSE 0 END
  WHERE lower(btrim(lemma))=k AND homonym_card_count IS DISTINCT FROM
   CASE WHEN coalesce(pos,'')<>'expression' AND coalesce(dictionary_status,'')<>'excluded' THEN n ELSE 0 END;
 END LOOP;
 RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION private.refresh_homonym_count_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lexemes_homonym_count_v1 AFTER INSERT OR DELETE OR UPDATE OF lemma,pos,dictionary_status
ON public.lexemes FOR EACH ROW EXECUTE FUNCTION private.refresh_homonym_count_v1();
WITH counts AS (SELECT lower(btrim(lemma)) k,count(*) n FROM public.lexemes
 WHERE coalesce(pos,'')<>'expression' AND coalesce(dictionary_status,'')<>'excluded' GROUP BY 1)
UPDATE public.lexemes l SET homonym_card_count=c.n FROM counts c
WHERE lower(btrim(l.lemma))=c.k AND coalesce(l.pos,'')<>'expression' AND coalesce(l.dictionary_status,'')<>'excluded';
COMMIT;

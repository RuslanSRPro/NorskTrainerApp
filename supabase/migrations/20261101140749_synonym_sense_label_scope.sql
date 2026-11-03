BEGIN;
CREATE FUNCTION public.d10_synonym_label_contexts_v1(p_lemma text,p_sense text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT coalesce(jsonb_agg(q.context),'[]'::jsonb) FROM (
  SELECT DISTINCT public.d10_synonym_source_context_v1(g.id) context
  FROM public.synonym_bm_gloss_v1 g JOIN public.lexemes l ON l.id=g.lexeme_id
  WHERE lower(btrim(l.lemma))=lower(btrim(p_lemma)) AND g.gloss_text=p_sense
  ORDER BY 1 LIMIT 8) q WHERE q.context<>'{}'::jsonb
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_label_contexts_v1(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_label_contexts_v1(text,text) TO service_role;
DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_sense_lease_v1(integer)'::regprocedure);
 anchor text:=$a$'sense', sense_text$a$;
BEGIN
 IF position('d10_synonym_label_contexts_v1' IN def)>0 THEN RETURN;END IF;
 IF position(anchor IN def)=0 THEN RAISE EXCEPTION 'sense label lease anchor changed';END IF;
 EXECUTE replace(def,anchor,anchor||$a$, 'dictionary_contexts', public.d10_synonym_label_contexts_v1(lemma,sense_text)$a$);
END $patch$;
COMMIT;

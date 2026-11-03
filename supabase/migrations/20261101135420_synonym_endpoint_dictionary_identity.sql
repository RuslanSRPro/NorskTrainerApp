BEGIN;
CREATE OR REPLACE FUNCTION private.synonym_endpoint_key_v1(t text,i uuid,a bigint,s text)
RETURNS text LANGUAGE sql STABLE SET search_path TO pg_catalog,public AS $f$
 SELECT jsonb_build_array(t,i,a,coalesce(
  (SELECT 'path:'||p.sense_path FROM public.d10_synonym_sense_path_v1(a,s) p
   WHERE nullif(p.sense_path,'') IS NOT NULL LIMIT 1),
  'text:'||lower(btrim(regexp_replace(coalesce(s,''),'\s+',' ','g')))))::text
$f$;
CREATE FUNCTION private.synonym_render_quote_v1(q jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO pg_catalog AS $f$
DECLARE parts text[]:=string_to_array(q->>'content','$');out text;it jsonb;i integer;v text;
BEGIN
 IF parts IS NULL THEN RETURN NULL;END IF;out:=parts[1];
 FOR i IN 2..coalesce(array_length(parts,1),1) LOOP
  it:=q->'items'->(i-2);
  v:=CASE WHEN it->>'type_'='usage' THEN it->>'text'
   WHEN it->>'type_'='article_ref' THEN (SELECT string_agg(l->>'lemma',' / ') FROM jsonb_array_elements(coalesce(it->'lemmas','[]'::jsonb)) l)
   ELSE NULL END;
  IF v IS NULL THEN RETURN NULL; END IF;
  out:=out||v||parts[i];
 END LOOP;
 RETURN nullif(btrim(out),'');
END $f$;
REVOKE ALL ON FUNCTION private.synonym_render_quote_v1(jsonb) FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_source_context_v1(uuid)'::regprocedure);
BEGIN
 IF position('private.synonym_render_quote_v1' IN def)>0 THEN RETURN;END IF;
 IF position('e->''quote''->>''content'' txt' IN def)=0 THEN RAISE EXCEPTION 'quote anchor changed';END IF;
 def:=replace(def,'e->''quote''->>''content'' txt','private.synonym_render_quote_v1(e->''quote'') txt');
 def:=replace(def,'AND position(''$'' IN e->''quote''->>''content'')=0',
  'AND private.synonym_render_quote_v1(e->''quote'') IS NOT NULL');
 EXECUTE def;
END $patch$;
COMMIT;

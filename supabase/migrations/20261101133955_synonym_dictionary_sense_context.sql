BEGIN;
CREATE FUNCTION public.d10_synonym_source_context_v1(p_gloss uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
DECLARE g public.synonym_bm_gloss_v1%rowtype; payload jsonb;nodes jsonb[];paths text[]:=ARRAY[''];
 node jsonb;child jsonb;path text;d integer;k integer;i integer;n integer;guard integer:=0;
 defs jsonb;examples jsonb;
BEGIN
 SELECT * INTO g FROM public.synonym_bm_gloss_v1 WHERE id=p_gloss;
 IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 SELECT a.payload INTO payload FROM public.ordbokene_article_cache a
 WHERE a.article_id=g.article_id AND a.dictionary_code='bm' ORDER BY a.updated_at DESC LIMIT 1;
 nodes:=ARRAY[coalesce(payload->'body'->'definitions','[]'::jsonb)];
 WHILE coalesce(array_length(nodes,1),0)>0 AND guard<4000 LOOP
  guard:=guard+1;n:=array_length(nodes,1);node:=nodes[n];path:=paths[n];
  nodes:=nodes[1:n-1];paths:=paths[1:n-1];
  IF jsonb_typeof(node)='array' THEN
   SELECT count(*) INTO d FROM jsonb_array_elements(node) e WHERE e->>'type_'='definition';k:=d+1;
   FOR i IN REVERSE jsonb_array_length(node)-1..0 LOOP
    child:=node->i;
    IF child->>'type_'='definition' THEN
     k:=k-1;nodes:=nodes||child;paths:=paths||CASE WHEN d=1 THEN path WHEN path='' THEN k::text ELSE path||'.'||k END;
    ELSE nodes:=nodes||child;paths:=paths||path;END IF;
   END LOOP;
   CONTINUE;
  END IF;
  IF jsonb_typeof(node)<>'object' OR node->>'type_' IN ('sub_article','example') THEN CONTINUE; END IF;
  IF node->>'type_'='definition' AND path=coalesce(g.sense_path,'')
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(node->'elements','[]'::jsonb)) e WHERE e->>'type_'='explanation') THEN
   SELECT coalesce(jsonb_agg(x.txt ORDER BY x.def_ord),'[]'::jsonb) INTO defs
   FROM public.d10_ordbokene_explanation_paths_v1(jsonb_build_object('body',jsonb_build_object('definitions',jsonb_build_array(node)))) x;
   SELECT coalesce(jsonb_agg(q.txt ORDER BY q.ord),'[]'::jsonb) INTO examples FROM (
    SELECT e->'quote'->>'content' txt,ord FROM jsonb_array_elements(coalesce(node->'elements','[]'::jsonb)) WITH ORDINALITY a(e,ord)
    WHERE e->>'type_'='example' AND nullif(e->'quote'->>'content','') IS NOT NULL
     AND position('$' IN e->'quote'->>'content')=0 ORDER BY ord LIMIT 8) q;
   RETURN jsonb_build_object('article_id',g.article_id,'sense_path',g.sense_path,
    'focus_gloss',g.gloss_text,'group_definitions',defs,'examples_nb',examples);
  END IF;
  child:=coalesce(node->'elements',node->'definitions');
  IF child IS NOT NULL THEN nodes:=nodes||child;paths:=paths||path;END IF;
 END LOOP;
 RETURN '{}'::jsonb;
END $f$;
REVOKE ALL ON FUNCTION public.d10_synonym_source_context_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_source_context_v1(uuid) TO service_role;
DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_prepare_candidate_v1(uuid,boolean)'::regprocedure);
 anchor text:=$a$'examples_nb', public.d10_synonym_examples_v1(c.source_entity_type,c.source_entity_id)$a$;
BEGIN
 IF position('d10_synonym_source_context_v1' IN def)=0 THEN
  IF position(anchor IN def)=0 THEN RAISE EXCEPTION 'source snapshot anchor changed'; END IF;
  def:=replace(def,anchor,anchor||$a$, 'sense_context', public.d10_synonym_source_context_v1(c.bm_gloss_id)$a$);
 END IF;
 def:=replace(def,':rules-v3',':rules-v4');EXECUTE def;
END $patch$;
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT 'ai:synonym_pair_v7:'||model FROM public.synonym_verifier_config_v1 WHERE singleton;
$f$;
DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_rule_verify_v1(integer)'::regprocedure);
BEGIN
 IF position('rule:mutual_reference_v4' IN def)>0 THEN RETURN; END IF;
 def:=replace(def,'WHERE p.status = ''queued'' AND NOT p.force_recheck',
  'WHERE p.status = ''queued'' AND NOT p.force_recheck
   AND jsonb_array_length(coalesce(p.snapshot->''target''->''definitions_nb'',''[]''::jsonb))=1
   AND jsonb_array_length(coalesce(p.snapshot->''source''->''sense_context''->''group_definitions'',''[]''::jsonb))<=1');
 def:=replace(def,'rule:mutual_reference_v3','rule:mutual_reference_v4');EXECUTE def;
END $patch$;
COMMIT;

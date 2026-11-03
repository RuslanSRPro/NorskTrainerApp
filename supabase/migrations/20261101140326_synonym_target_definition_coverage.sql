BEGIN;
DO $patch$
DECLARE def text;
BEGIN
 def:=pg_get_functiondef('public.d10_ordbokene_explanations_v1(jsonb)'::regprocedure);
 IF position('0) < 12' IN def)=0 THEN RAISE EXCEPTION 'definition capacity anchor changed';END IF;
 def:=replace(def,'public.d10_ordbokene_explanations_v1','public.d10_synonym_target_definitions_v1');
 def:=replace(def,'0) < 12','0) < 80');EXECUTE def;
 def:=pg_get_functiondef('public.d10_ordbokene_explanation_paths_v1(jsonb)'::regprocedure);
 IF position('0) < 12' IN def)=0 THEN RAISE EXCEPTION 'path capacity anchor changed';END IF;
 def:=replace(def,'public.d10_ordbokene_explanation_paths_v1','public.d10_synonym_target_paths_v1');
 def:=replace(def,'0) < 12','0) < 80');EXECUTE def;
 def:=pg_get_functiondef('public.d10_synonym_prepare_candidate_v1(uuid,boolean)'::regprocedure);
 IF position('public.d10_ordbokene_explanations_v1(v_payload)' IN def)=0 THEN RAISE EXCEPTION 'target definitions anchor changed';END IF;
 EXECUTE replace(def,'public.d10_ordbokene_explanations_v1(v_payload)','public.d10_synonym_target_definitions_v1(v_payload)');
 def:=pg_get_functiondef('public.d10_synonym_sense_path_v1(bigint,text)'::regprocedure);
 EXECUTE replace(def,'public.d10_ordbokene_explanation_paths_v1','public.d10_synonym_target_paths_v1');
END $patch$;
REVOKE ALL ON FUNCTION public.d10_synonym_target_definitions_v1(jsonb),public.d10_synonym_target_paths_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_target_definitions_v1(jsonb),public.d10_synonym_target_paths_v1(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT 'ai:synonym_pair_v8:'||model FROM public.synonym_verifier_config_v1 WHERE singleton;
$f$;
COMMIT;

-- Versioned semantic input contract: unaligned translations/examples are audit data only.
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $f$
 SELECT 'ai:synonym_pair_v6:' || model FROM public.synonym_verifier_config_v1 WHERE singleton;
$f$;

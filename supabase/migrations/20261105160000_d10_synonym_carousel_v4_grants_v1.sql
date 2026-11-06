-- 20261105160000_d10_synonym_carousel_v4_grants_v1.sql
-- D10_synonym_nuance_chip_v1 (agreed 05.11.2026): get_synonym_carousel_v4 gets the same EXECUTE rights as
-- get_synonym_carousel_v3 (v4 was open to everyone incl. anon; v3 is not open to anon). Function text unchanged.
-- Guards: v4 exists with the D10_synonym_nuance_v1 text (md5); nothing else is changed. Rerun is harmless.
DROP TABLE IF EXISTS pg_temp.d10_grants_report;
CREATE TEMP TABLE d10_grants_report(part text, name text, info jsonb);
DO $m$
DECLARE r text;
BEGIN
  IF to_regprocedure('public.get_synonym_carousel_v4(uuid)') IS NULL THEN RAISE EXCEPTION 'STOP: get_synonym_carousel_v4 not found'; END IF;
  IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.get_synonym_carousel_v4(uuid)'::regprocedure) <> '4be688146f9967018c7b0dd15daa9fb5' THEN
    RAISE EXCEPTION 'STOP: get_synonym_carousel_v4 differs from the expected version';
  END IF;
  INSERT INTO d10_grants_report SELECT '01_before', rolname, jsonb_build_object(
    'v3', has_function_privilege(rolname, 'public.get_synonym_carousel_v3(uuid)', 'EXECUTE'),
    'v4', has_function_privilege(rolname, 'public.get_synonym_carousel_v4(uuid)', 'EXECUTE'))
  FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role');
  REVOKE ALL ON FUNCTION public.get_synonym_carousel_v4(uuid) FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.get_synonym_carousel_v4(uuid) FROM %I', r);
      IF has_function_privilege(r, 'public.get_synonym_carousel_v3(uuid)', 'EXECUTE') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v4(uuid) TO %I', r);
      END IF;
    END IF;
  END LOOP;
  INSERT INTO d10_grants_report SELECT '02_after', rolname, jsonb_build_object(
    'v3', has_function_privilege(rolname, 'public.get_synonym_carousel_v3(uuid)', 'EXECUTE'),
    'v4', has_function_privilege(rolname, 'public.get_synonym_carousel_v4(uuid)', 'EXECUTE'))
  FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role');
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
      AND has_function_privilege(rolname, 'public.get_synonym_carousel_v3(uuid)', 'EXECUTE')
       <> has_function_privilege(rolname, 'public.get_synonym_carousel_v4(uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'STOP: v4 rights still differ from v3';
  END IF;
END
$m$;
SELECT part, name, info FROM d10_grants_report ORDER BY 1, 2;

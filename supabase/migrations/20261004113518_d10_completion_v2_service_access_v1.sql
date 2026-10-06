-- Service-only Completion RPC. Do not grant direct access to private tables.
BEGIN;
DO $guard$
DECLARE f record;
BEGIN
  SELECT p.prosecdef, p.proconfig, r.rolname, r.rolsuper, r.rolbypassrls,
    md5(btrim(replace(p.prosrc, E'\r\n', E'\n'), E' \n\r\t')) AS body_md5
  INTO f
  FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.oid = 'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure;
  IF f.rolname <> 'postgres' OR NOT (f.rolsuper OR f.rolbypassrls) THEN
    RAISE EXCEPTION 'STOP: unexpected RPC owner or missing RLS bypass';
  END IF;
  IF f.body_md5 <> '7b122c8ecc1cb26e5c34bd87cd4d4767' THEN
    RAISE EXCEPTION 'STOP: Completion body changed since verified V2 patch';
  END IF;
END;
$guard$;
ALTER FUNCTION public.get_completion_evidence_snapshot_v1(uuid,text,integer,text) SECURITY DEFINER;
ALTER FUNCTION public.get_completion_evidence_snapshot_v1(uuid,text,integer,text) SET search_path = '';
REVOKE ALL ON FUNCTION public.get_completion_evidence_snapshot_v1(uuid,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_completion_evidence_snapshot_v1(uuid,text,integer,text) TO service_role;
COMMIT;

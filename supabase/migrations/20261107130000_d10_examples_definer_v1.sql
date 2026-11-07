-- D10_examples_definer_v1 (07.11.2026, agreed variant A): get_canonical_lexeme_examples_v1 runs as its owner.
-- Cause (query 333): the function ran with the caller's rights; the app role (authenticated) may not read
-- public.expression_catalog, so the whole call failed with 42501 and the app showed no examples anywhere
-- (search, training, card). Only SECURITY DEFINER is set; the body (md5 without \r) and search_path ('')
-- stay as they are, table rights are not touched. The function still returns examples only for the ids passed.
-- Guards: body md5 must be the known one; already SECURITY DEFINER -> STOP (repeated install).
-- Rollback: optional/rollback_d10_examples_definer_v1.sql.
DO $mig$
DECLARE v_oid oid; v_def boolean; v_md5 text; v_cfg text[];
BEGIN
  SELECT p.oid, p.prosecdef, md5(replace(p.prosrc, E'\r', '')), p.proconfig INTO v_oid, v_def, v_md5, v_cfg
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_canonical_lexeme_examples_v1(uuid[])');
  IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: public.get_canonical_lexeme_examples_v1(uuid[]) not found'; END IF;
  IF v_def THEN RAISE EXCEPTION 'STOP: already SECURITY DEFINER (D10_examples_definer_v1 installed?)'; END IF;
  IF v_md5 <> '70efa3070bb321043bf0befd0dc752e6' THEN
    RAISE EXCEPTION 'STOP: body md5 is %, expected 70efa3070bb321043bf0befd0dc752e6', v_md5;
  END IF;
  IF v_cfg IS DISTINCT FROM ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'STOP: unexpected config %', v_cfg;
  END IF;
  ALTER FUNCTION public.get_canonical_lexeme_examples_v1(uuid[]) SECURITY DEFINER;
  SELECT p.prosecdef, md5(replace(p.prosrc, E'\r', '')) INTO v_def, v_md5 FROM pg_proc p WHERE p.oid = v_oid;
  IF NOT v_def OR v_md5 <> '70efa3070bb321043bf0befd0dc752e6' THEN
    RAISE EXCEPTION 'STOP: after change: definer %, md5 %', v_def, v_md5;
  END IF;
END
$mig$;

SELECT 'function'::text AS part, 'get_canonical_lexeme_examples_v1' AS name,
  jsonb_build_object('security_definer', p.prosecdef, 'md5_no_cr', md5(replace(p.prosrc, E'\r', '')),
    'config', p.proconfig, 'exec_authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS info
FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_canonical_lexeme_examples_v1(uuid[])');

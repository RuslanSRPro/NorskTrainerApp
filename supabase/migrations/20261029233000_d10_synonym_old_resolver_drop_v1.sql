-- D10_synonym_old_resolver_drop_v1 (29.10.2026, agreed in chat: old synonyms can be removed).
-- The edge function naob-synonym-resolver is already deleted (supabase functions delete).
-- Removes what still pointed at it:
--   cron job 'naob-synonym-resolver-daily' (jobid 2, inactive since 27.10) and
--   function public.call_naob_synonym_resolver().
-- STOP (nothing changed) when another function or another cron job uses call_naob_synonym_resolver.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
DECLARE v text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private') AND p.prosrc ILIKE '%call_naob_synonym_resolver%'
    AND p.proname <> 'call_naob_synonym_resolver';
  IF v IS NOT NULL THEN RAISE EXCEPTION 'STOP: these functions call call_naob_synonym_resolver: %; nothing changed', v; END IF;
  SELECT string_agg(j.jobname || ' (' || j.jobid || ')', ', ') INTO v
  FROM cron.job j WHERE j.command ILIKE '%call_naob_synonym_resolver%' AND j.jobname <> 'naob-synonym-resolver-daily';
  IF v IS NOT NULL THEN RAISE EXCEPTION 'STOP: other cron jobs call it: %; nothing changed', v; END IF;
END
$pre$;

SELECT cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'naob-synonym-resolver-daily';
DROP FUNCTION IF EXISTS public.call_naob_synonym_resolver();

COMMIT;

-- D10 15.10.2026 (agreed): longer retry of an Ordbøkene check when Ordbøkene
-- itself fails (HTTP 5xx, timeout), so a short outage does not end the job
-- with incomplete data.
--
-- public.update_lexeme_source_check_status: for source 'Ordbokene' and a
-- server-failure error text the check gets 4 attempts instead of 3. The
-- pauses come from the existing public.get_retry_delay: 1, 5, 30 minutes.
-- The job waits meanwhile (job-orchestrator waits for retry_scheduled checks).
-- Every other source and every other error: unchanged.
-- Patch in place on the live definition; each anchor must match exactly
-- once, otherwise nothing changes. Re-running is a no-op.

CREATE OR REPLACE FUNCTION pg_temp.d10_patch_v1(p_def text, p_pattern text, p_replacement text, p_label text)
RETURNS text LANGUAGE plpgsql AS $body$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM regexp_matches(p_def, p_pattern, 'g');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'D10_ORDBOKENE_RETRY_PREFLIGHT: anchor "%" found % times; nothing changed', p_label, v_count;
  END IF;
  RETURN regexp_replace(p_def, p_pattern, p_replacement);
END
$body$;

DO $patch$
DECLARE
  v text;
BEGIN
  v := pg_get_functiondef('public.update_lexeme_source_check_status(uuid,text,text,boolean,text,text,jsonb,jsonb,jsonb)'::regprocedure);
  IF position('d10_ordbokene_server_failure' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$v_max_attempts integer;$p$,
      $r$v_max_attempts integer;
  v_source text;  -- d10_ordbokene_server_failure (15.10.2026)$r$, 'declare source');
    v := pg_temp.d10_patch_v1(v,
      $p$select c\.attempt_count \+ 1, c\.max_attempts\s+into v_attempt_count, v_max_attempts\s+from public\.lexeme_source_checks c$p$,
      $r$select c.attempt_count + 1, c.max_attempts, c.source
  into v_attempt_count, v_max_attempts, v_source
  from public.lexeme_source_checks c$r$, 'select source');
    v := pg_temp.d10_patch_v1(v,
      $p$if v_attempt_count < v_max_attempts then$p$,
      $r$if v_attempt_count < greatest(v_max_attempts,
         -- D10 15.10.2026: Ordbøkene server failure -> 4 attempts (1, 5, 30 min)
         case when v_source = 'Ordbokene'
                and coalesce(p_error_message, '') ~* '(ordbokene returned http 5[0-9][0-9]|timed out|timeout|aborted|error sending request)'
              then 4 else 0 end) then$r$, 'attempt limit');
    EXECUTE v;
  END IF;
  RAISE NOTICE 'D10: Ordbøkene server failures are retried 4 times';
END
$patch$;

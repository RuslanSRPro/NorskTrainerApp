-- D10_supervisor_speed_v1 (27.10.2026, agreed)
-- 1. Step log of pipeline-supervisor: one row per step (job, tick, stage,
--    step, classification, rows processed, duration). Written once per job per
--    tick by d10_log_pipeline_steps_v1; rows older than 14 days are removed by
--    the same function (at most 500 per call). Read by query 222.
-- 2. call_pipeline_supervisor: pg_net timeout 30 s -> 120 s. A tick now makes
--    several steps (up to ~25 s of new steps + the last step); the cron call
--    must not give up on it earlier. Nothing else in the function changes
--    (version from query 220, 27.10.2026).
-- No existing data is changed.

CREATE TABLE IF NOT EXISTS private.d10_pipeline_step_log_v1 (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL,
  tick_id uuid NOT NULL,
  step_no integer NOT NULL,
  started_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  stage text,
  step text,
  classification text,
  processed integer,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  logged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS d10_pipeline_step_log_v1_job_idx
  ON private.d10_pipeline_step_log_v1 (job_id, started_at);
CREATE INDEX IF NOT EXISTS d10_pipeline_step_log_v1_started_idx
  ON private.d10_pipeline_step_log_v1 (started_at);

CREATE OR REPLACE FUNCTION public.d10_log_pipeline_steps_v1(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  n integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;
  INSERT INTO private.d10_pipeline_step_log_v1 (
    job_id, tick_id, step_no, started_at, duration_ms, stage, step, classification, processed, result)
  SELECT (r->>'job_id')::uuid, (r->>'tick_id')::uuid, (r->>'step_no')::integer,
    (r->>'started_at')::timestamptz, greatest(0, (r->>'duration_ms')::integer),
    r->>'stage', r->>'step', r->>'classification',
    CASE WHEN r->>'processed' ~ '^-?\d+$' THEN (r->>'processed')::integer END,
    coalesce(r->'result', '{}'::jsonb)
  FROM jsonb_array_elements(p_rows) r
  WHERE r->>'job_id' IS NOT NULL AND r->>'tick_id' IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- retention: 14 days, a bounded number of rows per call
  DELETE FROM private.d10_pipeline_step_log_v1
  WHERE id IN (SELECT id FROM private.d10_pipeline_step_log_v1
               WHERE started_at < now() - interval '14 days' LIMIT 500);
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.d10_log_pipeline_steps_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_log_pipeline_steps_v1(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_log_pipeline_steps_v1(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.call_pipeline_supervisor()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  k text;
begin
  select decrypted_secret into k
  from vault.decrypted_secrets
  where name = 'service_role_key';

  perform net.http_post(
    url := 'https://kevpkawrbtovrgyjkkvu.supabase.co/functions/v1/pipeline-supervisor',
    headers := jsonb_build_object(
      'apikey', k,
      'Authorization', 'Bearer ' || k,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    -- D10 27.10.2026: 30000 -> 120000 (a tick makes several steps now)
    timeout_milliseconds := 120000
  );
end;
$function$;

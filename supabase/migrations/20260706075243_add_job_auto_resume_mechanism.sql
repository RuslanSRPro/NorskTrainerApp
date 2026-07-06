-- ============================================================================
-- 20260706090000_add_job_auto_resume_mechanism.sql
--
-- СРОЧНЫЙ ФИКС: job-orchestrator запускается один раз через
-- EdgeRuntime.waitUntil() из analyze-text, и если не укладывается в лимит
-- времени выполнения Edge Function за один прогон — job навечно остаётся
-- недоделанным (часть source_checks успевает захватиться и зависнуть в
-- 'processing', часть остаётся нетронутой в 'pending'), и НИКТО не вызывает
-- job-orchestrator повторно автоматически.
--
-- pg_cron не установлен в этом проекте (подтверждено ранее), поэтому
-- используем уже существующий поллинг клиента: get-job-status опрашивается
-- каждые несколько секунд из приложения. Патчим get-job-status так, чтобы
-- при обнаружении "зависшего" job'а (не готов, давно не обновлялся) он сам
-- инициировал повторный вызов job-orchestrator в фоне.
--
-- claim_job_resume() — атомарный "замок" через UPDATE ... RETURNING,
-- чтобы несколько одновременных опросов get-job-status не запустили
-- job-orchestrator параллельно друг с другом для одного и того же job'а.
-- ============================================================================

ALTER TABLE public.lexeme_processing_jobs
  ADD COLUMN IF NOT EXISTS last_resume_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_job_resume(
  p_job_id uuid,
  p_stale_seconds integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
declare
  v_claimed boolean := false;
begin
  update public.lexeme_processing_jobs
  set last_resume_at = now()
  where id = p_job_id
    and status != 'done'
    and (
      last_resume_at is null
      or last_resume_at < now() - make_interval(secs => p_stale_seconds)
    )
    and (
      updated_at < now() - make_interval(secs => p_stale_seconds)
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$function$;
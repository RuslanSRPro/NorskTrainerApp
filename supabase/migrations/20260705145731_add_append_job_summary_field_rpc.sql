-- ============================================================================
-- 20260705130000_add_append_job_summary_field_rpc.sql
--
-- Небольшой хелпер для job-completion-auditor (и потенциально других
-- воркеров) — безопасно дописывает/обновляет одно поле в
-- lexeme_processing_jobs.summary (jsonb), не перезатирая остальное
-- содержимое summary (которое уже используется job-orchestrator для
-- ingestion_version, expression_items, lexeme360_roots и т.д.).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.append_job_summary_field(
  p_job_id uuid,
  p_field text,
  p_value jsonb
)
RETURNS void
LANGUAGE sql
AS $function$
  update public.lexeme_processing_jobs
  set
    summary = coalesce(summary, '{}'::jsonb) || jsonb_build_object(p_field, p_value),
    updated_at = now()
  where id = p_job_id;
$function$;
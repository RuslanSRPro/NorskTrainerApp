-- ============================================================================
-- 20260705140000_fix_reset_stuck_source_checks_escalation.sql
--
-- НАЙДЕНО: reset_stuck_source_checks (используется в начале каждого
-- job-orchestrator запуска) переводит зависшие 'processing' checks обратно
-- в 'pending', но НИКОГДА не увеличивает attempt_count и не переводит в
-- 'failed' по достижении max_attempts. Это означает: ЛЮБОЙ одноразовый сбой
-- (сетевой таймаут, обрыв Edge Function по лимиту времени, что угодно
-- случайное) создаёт БЕСКОНЕЧНЫЙ цикл: захват → зависание в processing →
-- сброс в pending без эскалации → повторный захват → (если тот же сбой
-- повторится) → зависание снова → ...
--
-- Хуже того: runLexicalWorker в job-orchestrator бросает исключение, если
-- claimed=0 при remaining>0 — то есть застрявшие 12 из 56 items блокируют
-- promotion/enrichment/audit для ВСЕГО job'а, а не только для себя.
--
-- Фикс: reset теперь инкрементирует attempt_count при каждом сбросе, и если
-- достигнут max_attempts — переводит в 'failed' с понятным error_message,
-- а не возвращает в pending навечно.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_stuck_source_checks(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
declare
  v_reset_count integer;
  v_failed_count integer;
begin
  -- Шаг 1: то, что зависло в processing и УЖЕ достигло/превысило
  -- max_attempts (после инкремента ниже стало бы >= max_attempts) —
  -- переводим в failed, а не даём ещё один бесконечный круг.
  with escalated as (
    update public.lexeme_source_checks
    set
      status = 'failed',
      attempt_count = attempt_count + 1,
      error_code = 'stuck_processing_max_attempts',
      error_message = 'Check stayed in processing status past timeout and reached max_attempts after reset; giving up.',
      updated_at = now()
    where item_id in (
      select id from public.lexeme_processing_items where job_id = p_job_id
    )
    and status = 'processing'
    and updated_at < now() - interval '2 minutes'
    and attempt_count + 1 >= max_attempts
    returning id
  )
  select count(*) into v_failed_count from escalated;

  -- Шаг 2: то, что зависло, но ещё не достигло max_attempts — возвращаем
  -- в pending, НО с инкрементом attempt_count (в отличие от старой версии),
  -- чтобы цикл рано или поздно дошёл до шага 1 и не длился бесконечно.
  with reset as (
    update public.lexeme_source_checks
    set
      status = 'pending',
      attempt_count = attempt_count + 1,
      updated_at = now()
    where item_id in (
      select id from public.lexeme_processing_items where job_id = p_job_id
    )
    and status = 'processing'
    and updated_at < now() - interval '2 minutes'
    and attempt_count + 1 < max_attempts
    returning id
  )
  select count(*) into v_reset_count from reset;

  -- Возвращаем суммарное количество затронутых строк (как и раньше,
  -- чтобы не ломать существующих потребителей возвращаемого значения).
  return v_reset_count + v_failed_count;
end;
$function$;
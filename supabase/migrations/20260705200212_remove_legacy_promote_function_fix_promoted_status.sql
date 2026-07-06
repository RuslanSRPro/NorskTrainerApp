-- ============================================================================
-- 20260705150000_remove_legacy_promote_function_fix_promoted_status.sql
--
-- НАЙДЕНО: отдельная, полностью независимая от job-scoped пайплайна legacy-
-- функция promote_verification_results() (без job_id, обрабатывает ВСЕ
-- source_checks в БД разом) содержала хардкод verification_status = 'promoted'
-- буквально — тот самый баг, который мы чинили в promote_verification_results_for_job
-- в начале дня (там уже давно правильный case-маппинг, v9).
--
-- Проверено: никакой код в supabase/functions её не вызывает
-- (Get-ChildItem поиск "promote_verification_results['\"]" — пусто).
-- Значит 99 записей с verification_status='promoted' — след ручных/legacy
-- вызовов этой функции в прошлом, до перехода на job-scoped архитектуру.
--
-- Действия:
--   1. Удаляем мёртвую функцию, чтобы её нельзя было случайно вызвать снова.
--   2. Пересчитываем verification_status для уже испорченных записей —
--      используя те же best_rank-производные поля (source_verified,
--      verification_tier), которые сама legacy-функция успела сохранить
--      корректно (баг был только в самом статусе, не в остальных полях).
-- ============================================================================

DROP FUNCTION IF EXISTS public.promote_verification_results();

-- ── lexemes ──────────────────────────────────────────────────────────────────
UPDATE public.lexemes
SET
  verification_status = case
    when source_verified like '%+%' then 'multi_source'
    when verification_tier in ('dictionary_entry', 'dictionary_match') then 'authoritative'
    when verification_tier = 'weak_match' then 'usage_verified'
    else 'candidate'
  end,
  updated_at = now()
WHERE verification_status = 'promoted';

-- ── expression_catalog ───────────────────────────────────────────────────────
UPDATE public.expression_catalog
SET
  verification_status = case
    when source_verified like '%+%' then 'multi_source'
    when verification_tier in ('dictionary_entry', 'dictionary_match') then 'authoritative'
    when verification_tier = 'weak_match' then 'usage_verified'
    else 'candidate'
  end,
  updated_at = now()
WHERE verification_status = 'promoted';
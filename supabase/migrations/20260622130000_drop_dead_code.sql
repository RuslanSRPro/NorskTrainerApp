-- Удаление подтверждённо мёртвого кода. Каждая цель проверена дважды
-- через grep по всему репозиторию (architecture-audit-full.md, раздел 1
-- плана действий + сегодняшняя повторная проверка) — все совпадения
-- находятся только внутри файлов своего же определения, ни одного
-- внешнего вызова.

-- create_text_analysis_job_v2 / normalize_ingestion_token():
-- analyze-text/index.ts:533 вызывает create_empty_text_analysis_job, не
-- эту функцию. Вся greedy-match доработка вплоть до 15 июня — мёртвая.
-- Сигнатуры сверены вживую через pg_proc перед удалением.
drop function if exists public.create_text_analysis_job_v2(p_text text, p_user_id text);
drop function if exists public.normalize_ingestion_token(p_token text);

-- enqueue_expression_semantic_for_job: ни одного вызова нигде кроме
-- файла своего определения — её работу делает сама
-- promote_verification_results_for_job.
drop function if exists public.enqueue_expression_semantic_for_job(p_job_id uuid);
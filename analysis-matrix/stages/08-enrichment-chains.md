# 08 — Цепочки обогащения (pipeline-supervisor)

## Назначение
После продвижения каждая карточка / выражение проходит цепочки обогащения.

## Код
`pipeline-supervisor` (cron `pipeline-supervisor-tick` раз в минуту, `call_pipeline_supervisor`) →
`job-enrichment-batch-worker` → воркеры цепочек. [проверить по коду: порядок и условия цепочек]

## Цепочки (по отображению в приложении)
ordbokene → naob → naob_synonyms → lexeme_translation (Lexin) → expression_translation → authoritative
(верификация источников) → expression_ai_fallback → authoritative_ai_fallback → translation_reorder →
translation_canonicalization → forms.

## Таблицы
`private.d10_job_enrichment_item_state_v1` (chain, job_id, item_id, lexeme_id, expression_id, status
done / no_data / failed / retry / processing, outcome_code, last_error, attempt_count, next_retry_at). [проверено]

## Известные проблемы
- 10.11: строки NAOB зависали в `processing` / `retry` после падения базы — закрыты (C-1111-05).
- «retryable_*_error» (bra, skje, ta-выражения 11.11) остаются без повтора в завершённой задаче. [проверить по коду]

## Достоверность
[проверить по коду] почти всё, кроме таблицы состояний.

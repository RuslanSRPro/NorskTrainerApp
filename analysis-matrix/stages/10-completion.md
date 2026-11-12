# 10 — Проверка завершения задачи

## Код [проверено частично]
`job-completion-auditor/index.ts` (страницы по 10, дообработка через ai-enrichment-worker, 2 прохода),
`_shared/completion-contract/v1/*` (контракт, runtime, evaluator), `get-job-status` (статус для приложения),
`job-completion-report`, SQL `get_completion_evidence_snapshot_v2`, `d10_ai_review_marked_v1`.

## Логика
- Пункт неполный (не хватает перевода / примера / форм) → дообработка.
- Слово с отметкой «на проверку», которому не хватает только перевода / примера → считается завершённым.
- (11.11) Выражение, дообработка которого закончилась решением проверки (D12), а не хватает только перевода /
  примера → завершённое (`review_marked_items`).
- Осталось неполное после 2 проходов → задача `needs_manual_review` (`supervisor_last_error`).

## Таблицы
`lexeme_processing_jobs.summary.completion_audit` (incomplete_items, review_marked_items …).

## Известные проблемы
- До 11.11 одно выражение без толкования валило задачу (gi beskjed).
- Слова «≈» теперь требуют пример → дообработка вызовет ИИ для старых «≈»-слов при их анализе (ожидаемо).

## История
C-1111-04, C-1111-07.

# D09-C4 — Package 1: инструкция по установке

Статус пакета: **готов к добавлению в локальный репозиторий, но не применён в Supabase**.

## Что не изменяется

- `supabase/functions/job-completion-auditor/index.ts`
- `supabase/functions/pipeline-supervisor/index.ts`
- `supabase/functions/get-job-status/index.ts`
- `services/api.ts`

## Новые файлы

- `supabase/functions/_shared/completion-contract/v1/contract.ts`
- `supabase/functions/_shared/completion-contract/v1/evaluator.ts`
- `supabase/functions/_shared/completion-contract/v1/aggregate.ts`
- `supabase/functions/_shared/completion-contract/v1/assessment.schema.json`
- `supabase/functions/completion-contract-shadow/index.ts`
- `supabase/functions/completion-contract-shadow/deno.json`
- `supabase/functions/tests/completion-contract/golden-corpus-v1.ts`
- `supabase/functions/tests/completion-contract/evaluator_test.ts`
- `supabase/functions/tests/completion-contract/aggregate_test.ts`
- `supabase/functions/tests/completion-contract/schema_test.ts`
- `supabase/functions/tests/completion-contract/deno.json`
- `supabase/migrations/20260829181722_completion_contract_snapshot_v1.sql`
- `supabase/tests/completion_contract_snapshot_v1.test.sql`
- `scripts/run-completion-shadow.ps1`

## Изменяемый существующий файл

- `supabase/config.toml` — добавлена только секция `completion-contract-shadow` с `verify_jwt = false`. Авторизация выполняется внутри функции через `@supabase/server` и именованный современный ключ `secret:completion-shadow`.

## Безопасный порядок

1. Распаковать ZIP в корень `NorskTrainerApp`.
2. Выполнить `git status --short` и убедиться, что четыре основных файла выше не изменены.
3. До применения миграции создать в Supabase именованный secret key `completion-shadow` формата `sb_secret_...`.
4. Отдельно проверить и применить миграцию `20260829181722_completion_contract_snapshot_v1.sql`.
5. Запустить pgTAP-тест `supabase/tests/completion_contract_snapshot_v1.test.sql`.
6. Только после успешного SQL-теста развернуть `completion-contract-shadow` с `verify_jwt=false`.
7. Запускать shadow-проверку только на terminal job через `scripts/run-completion-shadow.ps1`.

Ни миграция, ни Edge Function в рамках подготовки пакета не применялись.

## Проверки до упаковки

- Node tests: 28 passed, 0 failed.
- Deno lint: passed.
- Deno formatting: passed.
- Shadow Edge Function Deno type-check: passed.
- Migration и pgTAP SQL: PostgreSQL parser passed.
- `git diff --check`: passed.

## Откат SQL

Если после отдельного разрешения миграция была применена и потребуется откат:

```sql
drop function if exists public.get_completion_evidence_snapshot_v1(uuid, text, integer, text);
```

Функция read-only: она не создаёт таблиц, не изменяет задания и не публикует результаты учащимся.

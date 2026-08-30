# D09-C4 — Package 2: item-aware execution state

Статус пакета: **подготовлен для локальной установки, но не применён в Supabase**.

## Причина

Shadow-прогон выявил fail-open рассинхронизацию: terminal job мог иметь
`status = partial` или связанные items со статусами `pending` / `partial`,
но snapshot выдавал сущностям `execution_state = completed`.

На production-выборке найдено 78 terminal jobs и 957 items не в состоянии
`done`.

## Что изменяется

- Пустая миграция
  `supabase/migrations/20260830090255_completion_contract_entity_execution_state_v1.sql`
  заполняется новой версией read-only RPC
  `public.get_completion_evidence_snapshot_v1`.
- Добавляется регрессионный pgTAP-тест
  `supabase/tests/completion_contract_entity_execution_state_v1.test.sql`.

## Что не изменяется

- `supabase/functions/job-completion-auditor/index.ts`
- `supabase/functions/pipeline-supervisor/index.ts`
- `supabase/functions/get-job-status/index.ts`
- `services/api.ts`
- `supabase/functions/completion-contract-shadow/index.ts`
- evaluator и JSON Schema completion-contract/v1
- существующая применённая миграция Package 1
- пользовательские данные и статусы jobs/items

## Fail-closed правила

1. Job `failed` → snapshot/job и сущности `failed`.
2. Job `partial` или `needs_manual_review`, либо supervisor
   `needs_manual_review` → `needs_manual_review`.
3. Для job `completed` / `done`:
   - item `failed` → его сущность `failed`;
   - любой item не `done` → его сущность `needs_manual_review`;
   - только `done` items → сущность `completed`.
4. Unresolved items по-прежнему блокируют завершение отдельным флагом
   `unresolved_items_block_completion`.

Готовые сущности в job с ошибочным pending-item не понижаются: fail-closed
состояние применяется только к затронутой сущности, кроме явного job-level
`partial` / `needs_manual_review`.

## Безопасный порядок

1. Распаковать ZIP в корень `NorskTrainerApp`.
2. Убедиться, что изменены только пустая миграция и новые Package 2 файлы.
3. Выполнить `git diff --check`.
4. Проверить миграцию через `npx supabase db push --dry-run`.
5. До production push запустить локальный pgTAP-тест при доступном локальном
   Supabase stack:
   `npx supabase test db supabase/tests/completion_contract_entity_execution_state_v1.test.sql`.
6. Отдельно применить миграцию только после успешных проверок.
7. Повторить семь shadow-сценариев и подтвердить `writes_performed = 0`.

Edge Function повторно деплоить не нужно: меняется только вызываемая ею
Database Function.

## Безопасность

RPC остаётся:

- `STABLE`;
- `SECURITY INVOKER`;
- с `search_path = ''`;
- без INSERT / UPDATE / DELETE;
- недоступной для `public`, `anon` и `authenticated`;
- доступной только `service_role`.

Package 2 не исправляет отдельную найденную проблему RLS в 20 таблицах
`public`; она требует отдельного аудита политик и отдельной миграции.

## Откат

Не удалять RPC: Package 1 и shadow-функция зависят от неё. Для отката создать
новую миграцию и восстановить определение функции из
`20260829181722_completion_contract_snapshot_v1.sql`, сохранив grants.

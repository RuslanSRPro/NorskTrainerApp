# D09-C4 — Package 3B: post-terminal contract shadow

Дата подготовки: 2026-08-30.

## Назначение

Пакет подключает Completion Contract v1 к завершению pipeline только в
режиме наблюдения:

- legacy audit/heal и его решение о `done` остаются прежними;
- после записи legacy terminal-state supervisor вызывает отдельный режим
  `mode: contract_shadow` у `job-completion-auditor`;
- shadow читает полный immutable snapshot, включая все страницы;
- AI/heal в shadow-режиме не вызывается;
- `job.status` и `pipeline_supervisor_state.stage` contract-результатом не
  изменяются;
- в `lexeme_processing_jobs.summary.completion_contract_shadow_v1`
  записывается только компактная диагностическая сводка;
- ошибка shadow логируется и возвращается в диагностике, но не отменяет
  прежнее завершение job.

Это наблюдение перед Package 3C. Quality enforcement в Package 3B
намеренно отсутствует.

## Файлы, которые ЗАМЕНЯЮТСЯ

1. `supabase/functions/job-completion-auditor/index.ts`
2. `supabase/functions/pipeline-supervisor/index.ts`

## Файлы, которые ДОБАВЛЯЮТСЯ

1. `supabase/functions/_shared/completion-contract/v1/shadow-observer.ts`
2. `supabase/functions/tests/completion-contract/shadow_observer_test.ts`
3. `D09-C4_PACKAGE_3B_INSTALL_RU.md`
4. `SHA256SUMS_PACKAGE_3B.txt`

Миграций БД, изменений клиента, `services/api.ts`, `analyze-text` и
`get-job-status` в пакете нет.

## Границы безопасности

- `contract_shadow` принимается только с внутренним service authorization,
  который уже использует текущий `pipeline-supervisor`.
- Ответ не содержит полный список assessment/evidence — только counts и
  итоговые состояния.
- Единственная запись shadow — одно атомарное поле JSON summary.
- `enforcement_applied=false` сохраняется явно.
- Package 3B не модернизирует существующий legacy service-role transport
  двух старых функций. Его замена на современную внутреннюю авторизацию —
  отдельный rollout, чтобы не смешивать auth- и quality-изменения.

## Установка без деплоя

Из корня `C:\Users\subbo\NorskTrainerApp`:

```powershell
Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\D09-C4_package_3b_post_terminal_shadow_v2.zip" `
  -DestinationPath "$env:USERPROFILE\NorskTrainerApp" `
  -Force
```

Проверить точный набор:

```powershell
git status --short

git diff --check

git diff --stat -- `
  D09-C4_PACKAGE_3B_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_3B.txt `
  supabase/functions/job-completion-auditor/index.ts `
  supabase/functions/pipeline-supervisor/index.ts `
  supabase/functions/_shared/completion-contract/v1/shadow-observer.ts `
  supabase/functions/tests/completion-contract/shadow_observer_test.ts
```

Проверить, что Package 3B не задел read-side и новый порядок анализа:

```powershell
git diff -- `
  services/api.ts `
  supabase/functions/analyze-text/index.ts `
  supabase/functions/get-job-status/index.ts
```

Последняя команда должна быть пустой относительно commit Package 3A.

## Проверка типов и тесты

```powershell
npx --yes deno@2.5.6 check `
  --no-config `
  supabase/functions/_shared/completion-contract/v1/shadow-observer.ts

npx --yes deno@2.5.6 check `
  --no-config `
  supabase/functions/job-completion-auditor/index.ts

npx --yes deno@2.5.6 check `
  --no-config `
  supabase/functions/pipeline-supervisor/index.ts

npx --yes deno@2.5.6 test `
  --config supabase/functions/tests/completion-contract/deno.json `
  supabase/functions/tests/completion-contract
```

Ожидается 37 passed / 0 failed.

## Commit до production

Сначала добавить только файлы Package 3B:

```powershell
git add -- `
  D09-C4_PACKAGE_3B_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_3B.txt `
  supabase/functions/job-completion-auditor/index.ts `
  supabase/functions/pipeline-supervisor/index.ts `
  supabase/functions/_shared/completion-contract/v1/shadow-observer.ts `
  supabase/functions/tests/completion-contract/shadow_observer_test.ts

git diff --cached --check
git diff --cached --stat
git status --short
```

После отдельного подтверждения:

```powershell
git commit -m "Observe completion contract after legacy terminal state"
git push origin feature/vision-home-ui
```

## Безопасный порядок rollout

Не выполнять до отдельного подтверждения.

1. Сначала деплоить auditor, потому что новый supervisor вызывает его новый
   режим:

```powershell
npx supabase functions deploy job-completion-auditor --use-api
```

2. Убедиться, что unauthenticated POST по-прежнему получает 401.
3. Затем деплоить supervisor:

```powershell
npx supabase functions deploy pipeline-supervisor --use-api
```

4. Запустить один новый canary job из авторизованного приложения.
5. После terminal-state проверить summary в SQL Editor:

```sql
select
  id,
  status,
  summary -> 'completion_contract_shadow_v1' as contract_shadow
from public.lexeme_processing_jobs
where id = '<CANARY_JOB_UUID>'::uuid;
```

Ожидаемые признаки:

- `shadow_mode = true`;
- `enforcement_applied = false`;
- есть `snapshot_token`, `execution_state`, `quality_state` и counts;
- legacy `status` не изменён contract-результатом;
- в логах нет `COMPLETION_SNAPSHOT_FAILED` и
  `COMPLETION_SHADOW_PERSIST_FAILED`.

## Rollback

Если shadow rollout не проходит:

1. `git revert <PACKAGE_3B_COMMIT_SHA>`;
2. сначала повторно деплоить прежний `pipeline-supervisor`;
3. затем повторно деплоить прежний `job-completion-auditor`;
4. миграции Package 1/2 и Package 3A не откатывать.

Порядок rollback обратный rollout-порядку: старый supervisor не вызывает
новый shadow-mode и совместим со старым auditor.

## Decision register

- Snapshot оценивается только post-terminal, потому что RPC fail-closed
  возвращает `TERMINAL_JOB_REQUIRED` до terminal-state.
- Legacy audit/heal пока остаётся источником terminal-решения.
- Shadow пишет только диагностическую summary и не выполняет enforcement.
- Новый preview/select/save порядок анализа текста в Package 3B не
  реализуется; он остаётся отдельным будущим рефакторингом.

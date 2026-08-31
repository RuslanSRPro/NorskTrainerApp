# D09-C4 — Package 3C: canary quality enforcement

Дата подготовки: 2026-08-31.

## Назначение

Пакет переводит Completion Contract v1 из наблюдения Package 3B в
управляемый quality gate:

- безопасный режим по умолчанию — `shadow`;
- `canary` применяет enforcement только к UUID из allowlist;
- `all` применяет enforcement ко всем новым terminal jobs;
- `completed` подтверждается только при `learner_ready=true`;
- отрицательный результат или ошибка gate переводит job в
  `needs_manual_review`;
- auditor оценивает контракт, но status/stage меняет только supervisor;
- полный evidence/assessments в `jobs.summary` не записывается.

## Переключатели

| Переменная | Значение | Поведение |
| --- | --- | --- |
| `COMPLETION_CONTRACT_ENFORCEMENT_MODE` | отсутствует, пустое, неизвестное или `shadow` | enforcement выключен |
| `COMPLETION_CONTRACT_ENFORCEMENT_MODE` | `canary` | только jobs из allowlist |
| `COMPLETION_CONTRACT_ENFORCEMENT_MODE` | `all` | все jobs |
| `COMPLETION_CONTRACT_CANARY_JOB_IDS` | UUID через запятую | allowlist режима `canary` |

Опечатка в режиме безопасно возвращает систему в `shadow`.

## Файлы

Изменяются:

1. `supabase/functions/job-completion-auditor/index.ts`
2. `supabase/functions/pipeline-supervisor/index.ts`

Добавляются:

1. `supabase/functions/_shared/completion-contract/v1/enforcement.ts`
2. `supabase/functions/tests/completion-contract/enforcement_test.ts`
3. `D09-C4_PACKAGE_3C_INSTALL_RU.md`
4. `SHA256SUMS_PACKAGE_3C.txt`

Миграций БД и изменений `services/api.ts`, `analyze-text`, `get-job-status`,
UI или грамматических файлов в пакете нет.

## Production-blocker

Package 3C можно установить, проверить и закоммитить, но нельзя включать
`canary`/`all`, пока:

1. не завершена параллельная работа над грамматическими миграциями;
2. local/remote migration history не совпадает полностью;
3. не применена миграция
   `20260831070000_completion_contract_intentional_exclusions_v1.sql`;
4. не пройден pgTAP Package 2.1;
5. shadow-canary не подтвердил, что intentional exclusions (`Jeg`, `det`)
   отсутствуют в `unresolved_items`.

До этого режим остаётся `shadow`.

## Установка без деплоя

```powershell
Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\D09-C4_package_3c_canary_enforcement.zip" `
  -DestinationPath "$env:USERPROFILE\NorskTrainerApp" `
  -Force
```

```powershell
git status --short
git diff --check

git diff --stat -- `
  D09-C4_PACKAGE_3C_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_3C.txt `
  supabase/functions/job-completion-auditor/index.ts `
  supabase/functions/pipeline-supervisor/index.ts `
  supabase/functions/_shared/completion-contract/v1/enforcement.ts `
  supabase/functions/tests/completion-contract/enforcement_test.ts
```

Грамматика и read-side должны быть неизменны:

```powershell
git diff -- `
  services/api.ts `
  supabase/functions/analyze-text/index.ts `
  supabase/functions/get-job-status/index.ts `
  supabase/migrations `
  supabase/functions/grammar-shadow-compare-v2
```

## Проверки

```powershell
npx --yes deno@2.5.6 check `
  --no-config `
  supabase/functions/_shared/completion-contract/v1/enforcement.ts

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

Ожидается `44 passed / 0 failed`.

## Commit

```powershell
git add -- `
  D09-C4_PACKAGE_3C_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_3C.txt `
  supabase/functions/job-completion-auditor/index.ts `
  supabase/functions/pipeline-supervisor/index.ts `
  supabase/functions/_shared/completion-contract/v1/enforcement.ts `
  supabase/functions/tests/completion-contract/enforcement_test.ts

git diff --cached --check
git diff --cached --stat
git status --short
```

После подтверждения:

```powershell
git commit -m "Add canary completion contract enforcement"
git push origin feature/vision-home-ui
```

## Production rollout

Не выполнять до снятия production-blocker.

Сначала явно оставить shadow и задеплоить auditor перед supervisor:

```powershell
npx supabase secrets set COMPLETION_CONTRACT_ENFORCEMENT_MODE=shadow
npx supabase functions deploy job-completion-auditor --use-api
npx supabase functions deploy pipeline-supervisor --use-api
```

После каждого деплоя unauthenticated POST должен возвращать `401`.

После применения Package 2.1 включить один новый canary:

```powershell
npx supabase secrets set `
  COMPLETION_CONTRACT_ENFORCEMENT_MODE=canary `
  COMPLETION_CONTRACT_CANARY_JOB_IDS=<CANARY_JOB_UUID>
```

API keys в эти переменные не помещаются — allowlist содержит только UUID.

Проверка canary:

```sql
select
  id,
  status,
  summary -> 'completion_contract_enforcement_v1' as contract_enforcement
from public.lexeme_processing_jobs
where id = '<CANARY_JOB_UUID>'::uuid;
```

Готовый job должен иметь `status=completed`, `decision=allow_completed`,
`learner_ready=true`, `enforcement_applied=true` и `rollout_mode=canary`.
Неготовый job получает `needs_manual_review` с точной `decision_reason`.

После одного canary выполнять партии 20, 100 и 500 jobs. `all` включать
только отдельным решением после проверки отсутствия ложных `completed`,
snapshot/persistence errors и регрессий owner-check/read-side.

## Rollback

Быстрое отключение без redeploy:

```powershell
npx supabase secrets set COMPLETION_CONTRACT_ENFORCEMENT_MODE=shadow
```

Не удалять Package 1/2/2.1 migrations и не выполнять `migration repair`.
Для rollback кода сначала вернуть прежний `pipeline-supervisor`, затем
прежний `job-completion-auditor`; DB migrations не откатывать.

## Decision register

- Supervisor остаётся единственным владельцем terminal-state.
- Auditor не меняет status/stage и не запускает AI/heal в contract mode.
- Package 3A read-side не показывает `completed`, пока contract не вернул
  `learner_ready=true`.
- Ошибка gate закрывается в `needs_manual_review`.
- При выключенном флаге сохраняется Package 3B shadow-путь.
- Preview/select/save рефакторинг анализа текста сюда не входит.

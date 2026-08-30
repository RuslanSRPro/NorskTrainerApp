# D09-C4 — Package 3A: ownership + read-side dual state

Дата подготовки: 2026-08-30.

## Назначение

Пакет вводит постепенную read-side интеграцию Completion Contract v1:

- новый job получает владельца только из проверенного `userClaims.id`
  пользовательской сессии;
- `get-job-status` возвращает данные только владельцу job;
- execution и linguistic quality возвращаются отдельно;
- совместимое поле `status` становится `completed` только при `learner_ready=true`;
- мобильный клиент больше не читает job/RPC напрямую;
- `job-completion-auditor` и `pipeline-supervisor` не изменяются;
- миграций БД и quality-записей в этом пакете нет.

`grammar-parser.ts` содержит только две type-only корректировки:
`lexeme_id` допускает уже существующее runtime-значение `null`, а
`candidate_generator` добавлен в фактически используемый union.

## Файлы, которые ЗАМЕНЯЮТСЯ

1. `services/api.ts`
2. `supabase/config.toml`
3. `supabase/functions/analyze-text/index.ts`
4. `supabase/functions/analyze-text/deno.json`
5. `supabase/functions/analyze-text/grammar-parser.ts`
6. `supabase/functions/get-job-status/index.ts`

## Файлы, которые ДОБАВЛЯЮТСЯ

1. `supabase/functions/get-job-status/deno.json`
2. `supabase/functions/_shared/completion-contract/v1/runtime.ts`
3. `supabase/functions/_shared/job-status-policy.ts`
4. `supabase/functions/tests/completion-contract/runtime_test.ts`
5. `supabase/functions/tests/completion-contract/job_status_policy_test.ts`
6. `supabase/functions/analyze-text/deno.lock`
7. `supabase/functions/get-job-status/deno.lock`
8. `supabase/functions/tests/completion-contract/deno.lock`

Три `deno.lock` генерируются командами `deno check/test` и фиксируют
точные транзитивные зависимости. Они не содержат API keys или JWT.

## Файлы, которые НЕ ИЗМЕНЯЮТСЯ

- `supabase/functions/job-completion-auditor/index.ts`
- `supabase/functions/pipeline-supervisor/index.ts`
- все локальные файлы audio/voice;
- схема БД и уже применённые миграции Package 1/2.

## Важное ограничение

Исторические jobs с `user_id IS NULL` новый endpoint намеренно не отдаёт.
Это fail-closed защита от IDOR/BOLA: невозможно доказать, кому принадлежит
старый job. Canary выполняется на новом job, созданном после деплоя
`analyze-text`.

`verify_jwt=true` здесь относится к JWT пользовательской сессии Supabase
Auth. Такие JWT не отменены. Устаревающими являются legacy API keys
`anon`/`service_role`, которые сами имеют JWT-формат.

Package 3A не переписывает старые внутренние вызовы pipeline внутри
`analyze-text`, использующие legacy service-role key. Их миграция на
современный именованный secret key выполняется отдельным этапом, чтобы не
смешивать ownership/read-side rollout с изменением orchestration.

## Установка без деплоя

Из корня `C:\Users\subbo\NorskTrainerApp`:

```powershell
Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\D09-C4_package_3a_read_side_dual_state.zip" `
  -DestinationPath "$env:USERPROFILE\NorskTrainerApp" `
  -Force
```

Проверить точный набор изменений:

```powershell
git status --short

git diff --check

git diff --stat -- `
  services/api.ts `
  supabase/config.toml `
  supabase/functions/analyze-text/index.ts `
  supabase/functions/analyze-text/deno.json `
  supabase/functions/analyze-text/grammar-parser.ts `
  supabase/functions/get-job-status/index.ts `
  supabase/functions/get-job-status/deno.json `
  supabase/functions/_shared/completion-contract/v1/runtime.ts `
  supabase/functions/_shared/job-status-policy.ts `
  supabase/functions/tests/completion-contract/runtime_test.ts `
  supabase/functions/tests/completion-contract/job_status_policy_test.ts

git diff -- `
  supabase/functions/job-completion-auditor/index.ts `
  supabase/functions/pipeline-supervisor/index.ts
```

Последняя команда должна быть пустой.

## Локальные unit-тесты

Если Deno установлен:

```powershell
deno test `
  --config supabase/functions/tests/completion-contract/deno.json `
  supabase/functions/tests/completion-contract
```

Если Deno не установлен:

```powershell
npx --yes deno@2.5.6 test `
  --config supabase/functions/tests/completion-contract/deno.json `
  supabase/functions/tests/completion-contract
```

## Безопасный порядок rollout

Не выполнять эти шаги до отдельного подтверждения.

1. Зафиксировать Package 3A отдельным commit и отправить branch в GitHub.
2. Деплоить только `analyze-text`:

```powershell
npx supabase functions deploy analyze-text --use-api
```

3. Из авторизованного приложения запустить один новый анализ текста.
4. В SQL Editor проверить, что новый job имеет ненулевой `user_id`:

```sql
select id, user_id, status, created_at
from public.lexeme_processing_jobs
order by created_at desc
limit 5;
```

5. Только после проверки ownership деплоить read endpoint:

```powershell
npx supabase functions deploy get-job-status --use-api
```

6. Собрать/запустить клиент с новым `services/api.ts` и проверить новый job:
   `processing` -> `completed` либо `needs_manual_review`.
7. Проверить Edge Function logs: не должно быть `JOB_READ_FAILED`,
   `SNAPSHOT_RPC_FAILED` или повторяющихся HTTP 500.

В Package 3A не деплоить:

- `job-completion-auditor`;
- `pipeline-supervisor`;
- `completion-contract-shadow`;
- миграции БД.

## Canary-критерии

- unauthenticated вызов получает 401;
- чужой UUID и NULL-owned исторический UUID получают одинаковый 404;
- новый job доступен только создавшему его пользователю;
- `execution_state=completed` не превращается в UI `completed`, если
  `quality_state` не `ready`;
- `writes_performed` не добавляется: endpoint только читает;
- shadow endpoint продолжает возвращать те же результаты для того же job.

## Rollback

Если canary не проходит:

1. откатить commit Package 3A через `git revert <commit_sha>`;
2. повторно задеплоить прежние `analyze-text` и `get-job-status`;
3. вернуть клиент на предыдущую сборку;
4. Package 1/2 и миграции БД не откатывать — Package 3A схему не меняет.

## Decision register

- Выбран staged dual-state rollout.
- Package 3A меняет только ownership и чтение.
- Quality contract пока не пишет состояние job и не управляет supervisor.
- Enforcement и отзыв публичного EXECUTE у legacy RPC выносятся в
  последующие Package 3B/3C после canary.

# D09-C4 — Package 2.1: intentional admission exclusions

Дата подготовки: 2026-08-31.

## Причина

Canary Package 3B выявил два `unresolved_items`: `Jeg` и `det`. Оба item
фактически завершены (`status=done`, `current_stage=admission_gate`) и
имеют доказанное решение admission gate:

- `promotion_status=not_promoted`;
- `admission_status=rejected`;
- `admission_reason=function_word_pronoun`;
- `admission_decision.rule_type=function_word`.

Это намеренно исключённые служебные слова, а не потерянные элементы.

## Изменение политики snapshot

Новая migration заменяет только read-only RPC
`get_completion_evidence_snapshot_v1`:

- доказанные function-word exclusions возвращаются в `excluded_items`;
- они остаются в `total_items`, но не входят в `unresolved_items`;
- admission `review`, неизвестная/поддельная причина, отсутствующая
  `result_summary`, ошибки и незавершённые items продолжают fail-closed
  входить в unresolved;
- execution state, entity evidence и quality evaluator не ослабляются;
- Package 3C enforcement не включается.

## Файлы

Добавляются:

1. `supabase/migrations/20260831070000_completion_contract_intentional_exclusions_v1.sql`
2. `supabase/tests/completion_contract_intentional_exclusions_v1.test.sql`
3. `D09-C4_PACKAGE_2_1_INSTALL_RU.md`
4. `SHA256SUMS_PACKAGE_2_1.txt`

Изменяются:

1. `supabase/functions/_shared/completion-contract/v1/runtime.ts`
2. `supabase/functions/tests/completion-contract/runtime_test.ts`
3. `supabase/functions/tests/completion-contract/shadow_observer_test.ts`

## Установка без применения migration

```powershell
Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\D09-C4_package_2_1_intentional_exclusions.zip" `
  -DestinationPath "$env:USERPROFILE\NorskTrainerApp" `
  -Force

git diff --check

npx --yes deno@2.5.6 check `
  --no-config `
  supabase/functions/_shared/completion-contract/v1/runtime.ts

npx --yes deno@2.5.6 test `
  --config supabase/functions/tests/completion-contract/deno.json `
  supabase/functions/tests/completion-contract

npx supabase db push --dry-run
```

Ожидается:

- Deno: `38 passed | 0 failed`;
- dry-run предлагает только migration
  `20260831070000_completion_contract_intentional_exclusions_v1.sql`.

## Commit до БД

```powershell
git add -- `
  D09-C4_PACKAGE_2_1_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_2_1.txt `
  supabase/migrations/20260831070000_completion_contract_intentional_exclusions_v1.sql `
  supabase/tests/completion_contract_intentional_exclusions_v1.test.sql `
  supabase/functions/_shared/completion-contract/v1/runtime.ts `
  supabase/functions/tests/completion-contract/runtime_test.ts `
  supabase/functions/tests/completion-contract/shadow_observer_test.ts

git diff --cached --check
git diff --cached --stat
```

После отдельного подтверждения:

```powershell
git commit -m "Distinguish intentional exclusions from unresolved items"
git push origin feature/vision-home-ui
```

## Применение и проверка БД

Не выполнять до отдельного подтверждения.

```powershell
npx supabase db push

npx supabase test db --linked `
  supabase/tests/completion_contract_intentional_exclusions_v1.test.sql
```

После migration повторить snapshot canary job:

```sql
with snapshot as (
  select public.get_completion_evidence_snapshot_v1(
    '7e6018d5-886e-4212-88fd-c3e095683f6d'::uuid,
    null,
    50,
    null
  ) as payload
)
select
  payload -> 'counts' as counts,
  payload -> 'unresolved_items' as unresolved_items,
  payload -> 'excluded_items' as excluded_items
from snapshot;
```

Ожидается `unresolved_items=0`, `excluded_items=2` с сохранёнными
admission reasons.

## Deploy

Edge Functions повторно деплоить не требуется. Runtime-изменение только
расширяет TypeScript-интерфейс optional-полями; фактическую классификацию
выполняет versioned Postgres RPC.

## Rollback

Migration не удаляет данные и не меняет таблицы. При необходимости не
редактировать историю migration и не делать destructive rollback — создать
новую corrective migration, возвращающую предыдущую версию тела RPC.

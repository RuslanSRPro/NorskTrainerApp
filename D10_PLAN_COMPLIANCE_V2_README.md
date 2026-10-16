# D10 plan compliance v2 — неатрибутированная ошибка не валит всю пачку

Исправление после ревью. Меняется только `job-enrichment-batch-worker` и общий модуль `_shared/d10-enrichment-page-contract.ts`. Supervisor и миграции не меняются.

## Ошибка в v1

В агрегатной цепочке пачка могла упасть целиком, без указания элемента (`ok: false`). Тогда v1 приписывал ошибку всем участникам пачки. Если ошибка постоянная, например HTTP 400 от «ядовитого» элемента, все 20 элементов сразу получали `failed`, и до уменьшения пачки дело не доходило.

## Правило v2

Функция `aggregateItemOutcome`:

| Случай | Пачка из нескольких элементов | Пачка из 1 элемента |
|---|---|---|
| Ошибка называет элемент | временная → `retry`, постоянная → `failed` | то же |
| Ошибка не называет элемент | `retry` всем (код `unattributed_batch_error_split`), при любом типе ошибки — следующая пачка меньше | временная → `retry`, постоянная → `failed` |
| Нет данных в источнике | `no_data` | `no_data` |
| Успех | `done` | `done` |

Постоянная ошибка приписывается элементу только тогда, когда он остался в пачке один.

## Тесты

`tests/d10-enrichment-residue/page_contract_test.ts`, 12 тестов. Они моделируют журнал и выбор пачки и вызывают ту же функцию решения, что и обработчик:

- страница из 20 с «ядовитым» элементом и постоянной ошибкой (HTTP 400): `failed` только он, остальные 19 — `done`;
- то же с временной ошибкой: невиновные тратят не более 2 попыток;
- два «ядовитых» элемента: `failed` только они;
- здоровая страница — один вызов;
- правила исхода по отдельности.

Сам обработчик с реальной базой и источниками тесты не запускают.

## Установка

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_plan_compliance_v2.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
```

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_plan_compliance_v2\install_d10_plan_compliance_v2.ps1"
```

```powershell
npx supabase functions deploy job-enrichment-batch-worker
```

Откат: вернуть файлы из `*.d10-plan-compliance-v2.bak` и задеплоить `job-enrichment-batch-worker`.

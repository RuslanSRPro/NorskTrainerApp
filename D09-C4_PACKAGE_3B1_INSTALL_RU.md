# D09-C4 — Package 3B.1: pin internal function JWT verification

Дата подготовки: 2026-08-30.

## Причина

После deploy `pipeline-supervisor` endpoint временно отвечал на
unauthenticated POST. Ручное включение `Verify JWT with legacy secret` в
Dashboard вернуло ожидаемый HTTP 401.

Этот пакет фиксирует ту же настройку в version-controlled
`supabase/config.toml`, чтобы следующий CLI deploy не зависел от ручного
состояния Dashboard.

## Изменения

В `supabase/config.toml` явно добавлены:

- `[functions.job-completion-auditor]` с `verify_jwt = true`;
- `[functions.pipeline-supervisor]` с `verify_jwt = true`.

Обе функции используют существующий root import map. Runtime-код,
Completion Contract, схема БД и клиент не изменяются.

## Установка

```powershell
Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\D09-C4_package_3b1_verify_jwt_config.zip" `
  -DestinationPath "$env:USERPROFILE\NorskTrainerApp" `
  -Force

git diff --check -- supabase/config.toml
git diff -- supabase/config.toml
```

До commit повторный deploy не нужен: Dashboard уже сохранён в положении
ON, а unauthenticated smoke test вернул HTTP 401.

## Commit

```powershell
git add -- `
  D09-C4_PACKAGE_3B1_INSTALL_RU.md `
  SHA256SUMS_PACKAGE_3B1.txt `
  supabase/config.toml

git diff --cached --check
git diff --cached --stat
```

После проверки:

```powershell
git commit -m "Pin JWT verification for internal pipeline functions"
git push origin feature/vision-home-ui
```

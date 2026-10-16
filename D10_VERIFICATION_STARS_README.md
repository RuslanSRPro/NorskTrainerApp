# D10 шаг Б, часть 2: одна оценка в звёздах на сервере

Согласовано 16.10.2026. Ставится **после** D10_pos_scope_v1. Код функций не меняется, только миграция.

## Что делает

- Новая функция `d10_verification_rating_v1(доказательства, часть речи)` считает звёзды по согласованной таблице.
- Результат лежит в новой таблице `public.verification_stars_v1`, по строке на каждое слово и выражение. Там число звёзд и расшифровка по каждому источнику: Ordbøkene / NAOB / Lexin / Wiktionary / Språkrådet.
- Триггеры пересчитывают оценку, когда у слова или выражения меняются доказательства или часть речи.
- При установке оценка сразу считается для всей базы. Пишется **только** в новую таблицу: строки слов и выражений не трогаются, их триггеры не запускаются.

**Ничего из работающего не меняется:**
- `verification_status` и `verification_tier`;
- кто становится карточкой;
- допуск выражений;
- проверка смысла, AI, приложение.

Приложение начнёт показывать эти звёзды в части 3.

## Таблица

| Что есть для части речи карточки | ★ |
|---|---|
| статья Ordbøkene этой части речи | 5 (статья) / 4 (подстатья) |
| статья NAOB этой части речи + Lexin или Wiktionary этой части речи | 4, пометка «нет в учебном словаре Ordbøkene» |
| только одна из них | 3, пометка та же |
| только упоминания: поиск NAOB, источник без части речи, части слова, Språkrådet | 2 (серая) |
| ничего, кроме AI | 1 (серая) |

- Источник, где слово есть **только с другой частью речи**, для этой карточки не считается.
- **Språkrådet** — упоминание (2★), для слов и выражений. Больше 2★ он не даёт.
- **Выражения:** та же таблица без части речи.
- **Старые доказательства** (до D10_pos_scope_v1, без полей части речи):
  - Lexin, Wiktionary и NAOB считаются по лемме, как раньше;
  - статья Ordbøkene без части речи считается одной статьёй (как NAOB), а не 5★.

  После перепроверки слова оценка станет точной.

## Проверено (PostgreSQL 16)

- **19 случаев**, все совпали:
  - **brenne:**
    - сущ. на новых доказательствах → 2★ (только Språkrådet);
    - сущ. на старых → 4★;
    - глагол → 5★;
  - vinterjakke (только NAOB) → 3★;
  - drikke сущ. (строка NAOB + Lexin) → 4★;
  - только Wiktionary → 3★ (сейчас сервер даёт 5★);
  - noun_masculine ↔ noun;
  - выражения: подстатья Ordbøkene 4★, Lexin 3★, Språkrådet 2★;
  - нет доказательств → 1★.
- **Триггеры:**
  - вставка, смена доказательств и смена части речи пересчитывают оценку;
  - изменение других полей не пересчитывает;
  - удаление слова удаляет оценку.
- **Повтор миграции** ничего не ломает.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_verification_stars_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_verification_stars_v1\install_d10_verification_stars.ps1"
   ```
2. SQL Editor — миграция (NOTICE «d10 verification stars v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261016090000_d10_verification_stars_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 133. Только чтение. Ожидается:
   - A: PASS;
   - D: все строки PASS;
   - B: сколько слов и выражений на каждом уровне;
   - C: примеры (brenne, vinterjakke, like, drikke, styr, tid).
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\133_d10_verification_stars_check.sql" | Set-Clipboard
   ```

## Откат

Удаляет только то, что добавила эта миграция:
```sql
drop trigger if exists trg_d10_stars_lexeme_v1 on public.lexemes;
drop trigger if exists trg_d10_stars_expression_v1 on public.expression_catalog;
drop table if exists public.verification_stars_v1;
```

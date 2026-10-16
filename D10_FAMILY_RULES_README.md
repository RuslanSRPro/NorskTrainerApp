# D10: правила семейства 360 и выражения с однобуквенным словом (14.10.2026)

Основа: установленное состояние (резервная копия 13.10 + этап A + B/C/F). Установщик сверяет хэши двух меняемых файлов.

## 1. Однобуквенные слова в выражениях: `verification/adapters/ordbokene.ts`

`getTokens()` отбрасывает слова короче двух букв. Поэтому «i tide», «sette i», «ta i» выглядели как одно слово и проверялись как статья части речи, а не как собственная статья выражения.

Теперь путь проверки выбирается по настоящему числу слов: новая функция `ordbokeneLookupPath`.
- `getTokens()` не меняется: её используют NAOB, Lexin и Wiktionary.
- Ведущий инфинитивный «å» по-прежнему отбрасывается: «å gå» проверяется как «gå», как и раньше.

Тест: 13 случаев, все PASS. Изменились только три: i tide, sette i, ta i.

## 2. Версия кэша выражений: `lexical-worker/cache.ts`

`…-expression-v1` → `…-expression-v2`. Иначе старые неверные «not found» вернулись бы из кэша. Каждое выражение один раз проверится заново, это немного медленнее.

## 3. Семейство 360: только глаголы — миграция `20261014120000`

Исходное правило проекта: семейство 360 — это глагол, у которого в выражениях меняется смысл («ta → ta opp, ta seg av»). Об этом говорят `LEXEME360_ROOT_ALLOWED_POS = verb/expression` в analyze-text и комментарий в `Lexeme360.tsx`. Первая версия добавления семейства (07.10) брала только глаголы. До 10.10 в базе её расширили на существительные, отсюда семейство «tid» с устойчивыми фразами.

Изменения в `d10_inject_verified_job_family_page_v1`:
- корень только `verb`;
- выражение должно проходить тот же список подтипов, что привязка корня и показ 360 (`lexeme360_subtype_is_displayable_v1`). Collocation, synonym и т. п. не попадают.

Функция правится точечно в живом определении: остальное не меняется. Если живое определение не такое, как ожидалось, миграция останавливается и ничего не меняет. Повторный запуск ничего не делает. Уже добавленные в прошлых задачах члены семейства не удаляются.

Локальный тест: глагол + существительное + collocation. До: 3 выражения (huske på, huske feil, i gammel tid). После: только huske på.

## 4. Цветной член семейства = `verified` — миграция `20261014120100`

Член семейства 360 становится цветным, только если выражение подтверждено: `expression_review_status = 'verified'`. Это даёт:
- собственная статья Ordbøkene (доказательство C-3 пишется в момент проверки);
- отдельная статья Ordbøkene;
- запись NAOB `uttrykk`.

Иначе член семейства становится серым тем же путём, что и другие слабые: `admission_gate`, `not_promoted`, причина `FAMILY_EXPRESSION_NOT_VERIFIED`. Серый путь (итог задачи v2, аудит семейства, серое обогащение C-2) узнаёт его автоматически.

Выражения из самого текста (не из семейства) и слова не меняются. Функция `promote_verification_results_for_job` правится точечно в четырёх местах живого определения, с той же защитой и повторным запуском, что в пункте 3.

Локальный тест на живом определении функции:

| Выражение | До | После |
|---|---|---|
| verified, семейство | цветной | цветной |
| partial, Lexin usage, семейство | цветной | **серый** |
| partial, бонус сохранённого кандидата (как «på tide»), семейство | цветной | **серый** |
| partial, из текста (не семейство) | цветной | цветной, без изменений |
| слабое, семейство | серый | серый |

Счётчик обработанных элементов тот же (5 = 5). Серые не попадают в семантическое обогащение цветных (как и раньше для серых).

## Порядок

1. Распаковать и установить. Каждая команда отдельной строкой:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_family_rules_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_family_rules_v1\install_d10_family_rules.ps1"
   ```
2. SQL Editor — миграция `20261014120000` (ожидается NOTICE «verb roots only»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261014120000_d10_family_verb_roots_only_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — миграция `20261014120100` (ожидается NOTICE «family members colored only when verified»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261014120100_d10_family_promotion_verified_only_v1.sql" | Set-Clipboard
   ```
4. SQL Editor — проверка `87`: T1–T3 = PASS.
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\87_d10_family_rules_check.sql" | Set-Clipboard
   ```
5. Деплой:
   ```powershell
   npx supabase functions deploy lexical-worker
   ```
6. Живой тест: проанализировать текст «Vi kom fram i tide. Jeg husker det.», дождаться конца, запустить `88`:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\88_d10_family_rules_live_test.sql" | Set-Clipboard
   ```

## Откат

- **Файлы:** вернуть из `*.d10-family-rules.bak`, задеплоить `lexical-worker`.
- **Миграция 3:** повторно применить определение из `20261013200100_d10_family_bound_article_set_v1.sql`: блок `CREATE OR REPLACE FUNCTION … $function$;` без проверки в начале файла.
- **Миграция 4:** определения до этого пакета в репозитории одним файлом нет: живое = `20260930105614` + правка `20261006143000`. Перед применением можно сохранить текущее определение:
  ```sql
  SELECT pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
  ```

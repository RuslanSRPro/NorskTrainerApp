# D10: устойчивость к сбоям Ordbøkene

Согласовано 15.10.2026. 15.10 поиск Ordbøkene (`/api/articles`) отвечал 502, а страницы статей работали. Из-за этого задачи завершались ⚠️ с неполными данными.

## 1. Статья по номеру, когда поиск упал

Поиск остаётся главным путём, в обычной работе ничего не меняется. Только если поиск ответил **5xx или тайм-аутом**, а статья лексемы уже известна (привязка или активный снимок форм), статья скачивается напрямую.

| Где | Что делает запасной путь |
|---|---|
| Проверка слова (lexical-worker → `verification/adapters/ordbokene.ts`) | Скачивает известные статьи. Проверки те же: часть речи, форма. **Только точная лемма** (для «bøker» запасного пути нет). В доказательстве `lookup_fallback: known_article_ids` |
| Формы (`forms-enrichment-v2-worker`) | Строит снимок по известным статьям (`d10_lexeme_article_ids_v1`). Те же привязки и те же проверки при сохранении |
| Цепочка Ordbøkene (`ordbokene-lexeme-pipeline-worker`) | Проверка «статья принадлежит лемме» идёт по самой статье: та же лемма и часть речи |

**Запасной путь никогда не отвечает «статьи нет» и «неоднозначно».** Если по известным статьям ответа нет, остаётся исходная ошибка, и проверка повторяется позже. Поэтому путь «AI без статьи» не может сработать из-за сбоя.

Общий клиент получил метод `lookupKnownArticles` и функцию `isOrdbokeneServerError`. Остальные функции, которые его используют, не меняются.

## 2. Повторы

| Что | Было | Стало |
|---|---|---|
| Проверка слова Ordbøkene, сбой сервера | 3 попытки: сразу, через 1 мин, через 5 мин | **4 попытки:** + ещё одна через 30 мин. Паузы из существующей `get_retry_delay`. Задача ждёт |
| Остальные источники и ошибки проверки | 3 попытки | без изменений |
| Цепочки обогащения, «Ordbokene returned HTTP 5xx» | формы: сразу окончательная ошибка | повтор, **5 минут** между попытками (3 попытки) |

## Проверено

- **9 тестов Node** с подставным ответом Ordbøkene и настоящей статьёй 106786:
  - поиск 502 + известная статья → bok II подтверждена своей статьёй;
  - без известной статьи → ошибка, а не «нет статьи»;
  - словоформа → ошибка;
  - другая часть речи → ошибка;
  - 404 → без запасного пути;
  - поиск работает → обычный путь без пометки;
  - формы по известной статье → boker и bokene.
- **Миграция на живом определении** (PostgreSQL 16):
  - Ordbøkene 502 → 4 попытки;
  - NAOB 502 и Ordbøkene 404 → 3, как раньше;
  - повтор миграции ничего не меняет.
- Старые тесты политики повторов совместимы. Синтаксис проверен.

## Известное ограничение

- Пока поиск лежит, **новые** слова и новые омонимы не определяются. Их задача ждёт повторов, потом ⚠️.
- Цепочка authoritative для слова без номера статьи по-прежнему ищет. Её сбой не останавливает задачу, так было и раньше.

## Порядок

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_ordbokene_resilience_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_ordbokene_resilience_v1\install_d10_ordbokene_resilience.ps1"
   ```
2. SQL Editor — миграция (NOTICE «Ordbøkene server failures are retried 4 times»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015110000_d10_ordbokene_retry_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 106, ожидается T1 и T2 PASS:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\106_d10_ordbokene_resilience_check.sql" | Set-Clipboard
   ```
4. Деплой:
   ```powershell
   npx supabase functions deploy lexical-worker
   ```
   ```powershell
   npx supabase functions deploy forms-enrichment-v2-worker
   ```
   ```powershell
   npx supabase functions deploy ordbokene-lexeme-pipeline-worker
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
5. Тест: «bok» в режиме Audit → Check. Даже при лежащем поиске ожидается:
   - проверка обеих карточек `done` с пометкой запасного пути;
   - у bok II формы boker/bokene и перевод по статье 106786.

## Откат

Вернуть файлы из `*.d10-resilience.bak` и задеплоить те же 4 функции. Функцию проверки слова вернуть по определению, сохранённому до миграции; если нужно, дам отдельный SQL.

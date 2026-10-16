# D10: R9-защита, B3 и правило главной статьи (vende/styr)

Согласовано 15.10.2026. Ставится **поверх** D10_ai_review_retry_v1. Миграции нет.

## 1. R9-защита

Раньше: у омонима другие формы → автоматически вторая карточка (R9). Теперь перед этим есть одна проверка смысла.

| Статья-кандидат | Решение |
|---|---|
| Формы те же, что у главной | как раньше: `r8_same_forms`, карточки нет |
| Тот же римский номер, что у главной | как раньше: пропуск |
| **Новое:** своих толкований нет, только ссылки на главную статью (вариант написания/формы) | карточка **не** создаётся, `skipped`, причина `r9_guard_same_meaning`, `review: true` |
| **Новое:** все её толкования совпадают с толкованиями главной | то же |
| Другие формы и свой смысл (bok II «бук») | как раньше: вторая карточка |

Пропущенные защитой статьи видны в запросе 112, часть A. Если смысл всё-таки другой, скажите: карточку создам вручную.

Уже созданные карточки защита **не удаляет**. Работает только при новом решении.

## 2. B3: цепочка authoritative получает карточку

`job-enrichment-batch-worker` передаёт в `authoritative-enrichment-pipeline-worker` то же, что уже получает цепочка Ordbøkene:

- часть речи карточки (`lexemes.pos`);
- номер статьи из проверки этого слова: только Bokmål, только подтверждённая проверка, только **одна** статья.

Дальше в `ordbokene-lexeme-pipeline-worker` идут `article_id`, `parent_lexeme_id` и `dictionary_code = bm`.

Итог: для bok II цепочка берёт статью 106786, а не ищет «bok» заново. Без поиска она работает и когда поиск Ordbøkene лежит. Если статьи нет или их несколько, всё как раньше: поиск по лемме.

## 3. vende/styr: какая статья главная

Сейчас правило такое: главной карточкой становится статья с **наименьшим** римским номером. Это касается только слов без сентябрьской привязки. Запрос 112:

- **B** — такие слова, выбранная статья и её первое толкование;
- **C** — остальные статьи этих слов и что с ними решено.

Проверьте по смыслу. Если для какого-то слова главной должна быть другая статья, напишите слово и номер: дам точечную правку привязки.

**Не сделано, нужно согласовать:** выбирать главную статью по формам из Lexin (какое значение учебное). Для этого нужен живой разбор Lexin для каждого омонима: больше запросов и новый источник ошибок. Предлагаю пока ручную проверку по 112-B.

## Файлы

| Файл | Изменение |
|---|---|
| `_shared/d10-homograph-cards.ts` | толкования и ссылки статьи; `sameMeaningAsMain`; решение `r9_guard_same_meaning` |
| `authoritative-enrichment-pipeline-worker/types.ts` | поля `article_id`, `parent_article_id` |
| `authoritative-enrichment-pipeline-worker/source-runners.ts` | передаёт статью и карточку в цепочку Ordbøkene |
| `job-enrichment-batch-worker/index.ts` | загружает часть речи и статью, передаёт их |
| `tests/d10-r9-guard/` | 12 тестов + настоящая статья 6790 |
| `scripts/d10/112_d10_homograph_review.sql` | только чтение |

## Проверено

- **12 тестов Node:**
  - 9 прежних тестов омонимов;
  - настоящая 6790 против 106786 → вторая карточка остаётся;
  - вариант со ссылкой на главную → на проверку;
  - те же толкования → на проверку.
- **Тест этапа D** (`stage_d_test.ts`) проверяет отдельные поля, новые поля его не ломают.
- **Синтаксис** всех 4 файлов.
- **Запрос 112** на локальном PostgreSQL 16.
- Изменения B3 добавлены строками; остальной код файлов не тронут. Окончания строк и BOM сохранены.

## Порядок

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_r9_guard_b3_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_r9_guard_b3_v1\install_d10_r9_guard_b3.ps1"
   ```
2. Тест (из папки проекта), ожидается `pass 12`, `fail 0`:
   ```powershell
   node --experimental-strip-types --test supabase/functions/tests/d10-r9-guard/r9_guard_test.mts
   ```
3. SQL Editor — запрос 112 (A, B, C):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\112_d10_homograph_review.sql" | Set-Clipboard
   ```
4. Деплой:
   ```powershell
   npx supabase functions deploy job-orchestrator
   ```
   ```powershell
   npx supabase functions deploy authoritative-enrichment-pipeline-worker
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
5. Живая проверка: «bok» в режиме Audit → Check. Ожидается:
   - те же две карточки;
   - в цепочке authoritative для bok II статья 106786.

## Откат

Вернуть файлы из `*.d10-r9-guard.bak` и задеплоить те же 3 функции.

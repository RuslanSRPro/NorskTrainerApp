# D10: AI-перевод слова без своей статьи Ordbøkene (R12)

Согласовано 15.10.2026:
- AI переводит по части речи и по данным других источников (NAOB, Lexin, Wiktionary);
- такой перевод помечается как менее надёжный и для проверки;
- слово с ним считается готовым, задача может быть ✅;
- в чтении и в выборе карточки перед переводом стоит «≈».

## Когда работает новый путь

Только если Ordbøkene **ответил**, что статьи этой части речи нет.

| Случай | Что происходит |
|---|---|
| Своя статья есть | Как раньше: перевод по статье |
| Ordbøkene ответил «статьи нет» | **Новое:** перевод по части речи и NAOB / Lexin / Wiktionary |
| Ordbøkene не ответил (502, тайм-аут) | Как раньше: отказ. Это не «нет статьи», повтор позже |
| Статей несколько, ни одна не выбрана | Как раньше: отказ |
| Вторая карточка (bok II) или слово, у которого она есть | Как раньше: отказ. Общие данные NAOB/Lexin описали бы другое значение |
| Нет ни одного текста из NAOB / Lexin / Wiktionary | Отказ: не на чем основать перевод |

По новому пути AI заполняет только переводы uk и en. Пример и заметку без статьи не делает.

## Что записывается

- Перевод с источником `ai_fallback` и уверенностью `low`. В заметке: «без статьи Ordbøkene… (низкая надёжность, рекомендована проверка)».
- Доказательство: `status = ai_reviewed_no_article`, `reliability = low`, `review_suggested = true`, использованные источники, проверка второй моделью.
- Проверка второй моделью остаётся. Для таких слов она сверяет перевод с данными NAOB / Lexin / Wiktionary нужной части речи. Для обычных слов её текст не изменился (проверено тестом).

## Полнота задачи

- Перевод засчитывается, **пока у слова нет статьи** (нет активного снимка форм со статьёй).
- Если статья появится позже, перевод перестаёт засчитываться (`AI_NO_ARTICLE_ARTICLE_NOW_EXISTS`). Следующий аудит переведёт слово по статье.
- Путь со статьёй не изменился: те же проверки и то же доказательство (проверено тестом).

## Приложение

- Новая функция `get_lexeme_translation_approx_v1` (только чтение). Она возвращает языки, перевод на которых есть **только** от такого AI.
- `services/api.ts` проставляет `ua_approx` / `en_approx`.
- `reading.tsx`: «≈ » перед таким переводом. Касается только экрана чтения: разметки, выбора части речи, омонимов и карточки слова. Ответы в упражнениях не затронуты.
- Если функция недоступна, просто нет значка, всё остальное работает.

## Файлы

| Файл | Изменение |
|---|---|
| `ai-enrichment-worker/index.ts` | путь «без статьи» (`loadLexemeContext`), Wiktionary в контексте, уверенность и заметка |
| `ai-enrichment-worker/pos-sense-guard.ts` | правила допуска, контекст, доказательство, правило для второй модели |
| `_shared/ai-review-binding.ts` | привязка и проверка полноты для перевода без статьи |
| `services/api.ts`, `app/(tabs)/reading.tsx` | значок «≈» |
| миграция `20261015100000` | функция `get_lexeme_translation_approx_v1` |
| тест `tests/d10-ai-no-article` | 19 проверок |

## Проверено локально

- **19 тестов Node.** Правила допуска (8 случаев), доказательство, полнота: готово / статья появилась / текст изменён / чужая лексема. Путь со статьёй не изменился. Текст второй модели для обычных слов не изменился.
- **Миграция на PostgreSQL 16.** Значок только там, где нет другого источника. Повторный запуск ничего не меняет.
- **Синтаксис** всех изменённых TS/TSX.

## Порядок

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_ai_no_article_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_ai_no_article_v1\install_d10_ai_no_article.ps1"
   ```
2. SQL Editor — миграция:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015100000_d10_translation_approx_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 104, ожидается T1 и T2 PASS:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\104_d10_ai_no_article_check.sql" | Set-Clipboard
   ```
4. Деплой (одинаковая логика полноты во всех местах, где она считается):
   ```powershell
   npx supabase functions deploy ai-enrichment-worker
   ```
   ```powershell
   npx supabase functions deploy job-completion-auditor
   ```
   ```powershell
   npx supabase functions deploy get-job-status
   ```
   ```powershell
   npx supabase functions deploy job-completion-report
   ```
   ```powershell
   npx supabase functions deploy completion-contract-shadow
   ```
5. Приложение: `eas update` или перезапуск Expo.
6. Живой тест на одном слове. Запрос 105 покажет до 15 слов, у которых Ordbøkene ответил «статьи нет», а другие источники слово подтвердили:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\105_d10_no_article_words.sql" | Set-Clipboard
   ```
   Возьмите слово с пустым `uk`. Режим Audit → Check → ✅. Ожидается перевод с «≈».

## Не меняется

- ai-translation-review и ai-example-review (ручные инструменты) работают как раньше. Слово без статьи они, как и раньше, не принимают.
- ordbokene-lexeme-pipeline-worker не затронут: функции, которые он использует, не менялись.

## Откат

Вернуть файлы из `*.d10-no-article.bak`, задеплоить те же 5 функций, перезапустить приложение. Функцию `get_lexeme_translation_approx_v1` можно оставить: она только читает.

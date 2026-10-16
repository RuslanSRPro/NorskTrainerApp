# D10: слово без статьи — пример и заметка не считаются недостающими

Исправление к D10_ai_no_article_v1. Ставится **поверх** D10_ai_review_retry_v1. Миграции нет.

## Что было

У vinterjakke уже был перевод с «≈». Не хватало примера, а по правилу R12 путь «без статьи» пример и заметку не делает. Последствия:
- `ai-enrichment-worker` считал пример недостающим;
- в цепочке AI-перевода он бросал ошибку `NO_ARTICLE_NOTHING_TO_TRANSLATE` (запись `failed`);
- аудитор полноты пытался «долечить» слово два прохода подряд;
- задача висела на 100 % и заканчивалась `needs_manual_review`.

## Что стало

Для слова, к которому применимо правило «без статьи», недостающими могут быть **только** переводы uk/en. Перевод уже есть → слово пропускается с причиной `no_article_translations_complete`. Это и цепочка, и проверка аудитора: аудитор берёт «что недостаёт» из этой же функции.

Не меняется:
- слова со своей статьёй;
- выражения;
- слова, где Ordbøkene не ответил (сбой);
- вторая карточка (bok II) и группа омонимов.

Проверка полноты контракта (`completion-contract`) пример не требует, она не меняется.

## Проверено

- **4 новых теста:**
  - vinterjakke → только переводы;
  - слово со статьёй → без изменений;
  - сбой Ordbøkene → без изменений;
  - вторая карточка и группа омонимов → без изменений.
- **19 прежних тестов** «без статьи» проходят.
- **Синтаксис** проверен.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_ai_no_article_fix_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_ai_no_article_fix_v1\install_d10_ai_no_article_fix.ps1"
   ```
2. Тест (ожидается `pass 4`):
   ```powershell
   node --experimental-strip-types --test supabase/functions/tests/d10-ai-no-article/field_scope_test.mts
   ```
3. Деплой:
   ```powershell
   npx supabase functions deploy ai-enrichment-worker
   ```
4. Тест: «Jeg liker vinterjakke» в режиме Audit → Check. Ожидается:
   - в запросе 116 нет записей в части C;
   - задача заканчивается без зависания.

## Откат

Вернуть файл из `*.d10-no-article-fix.bak` и задеплоить `ai-enrichment-worker`.

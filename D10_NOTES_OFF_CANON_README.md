# D10: заметки AI отключены, канонизация переписывается в задаче

Согласовано 15.10.2026. Ставится **поверх** D10_ai_no_article_fix_v1 и D10_family_rebind_v1. Миграции нет.

## 1. Заметки (`ai-enrichment-worker`)

- Заметка больше не считается недостающей. AI её не запрашивает, а слово без заметки считается полным.
- 1871 существующая заметка остаётся в базе и не используется. В приложении заметки и раньше не показывались.
- Переводы и примеры — без изменений.

## 2. Канонизация (`job-enrichment-batch-worker`)

- В цепочке `translation_canonicalization` воркер вызывается с `force_recanonicalize:true` для слов задачи. Канонический вариант из прошлых итераций выбирается заново.
- Исходный текст Lexin не меняется: результат пишется в `canonical_translation` и `canonicalization_metadata`, как и раньше.
- AI нужен только когда после очистки дублей остаётся два и больше вариантов. Сейчас в базе 2044 случая из 2046 решены без AI.
- Предварительная проверка теперь пропускает только слова, у которых вообще нет строк перевода Lexin или AI.

## Проверено

- **23 теста** «без статьи» проходят.
- **Синтаксис** обоих файлов.
- **Повторные имена** — проверено компилятором TypeScript.
- По коду воркера канонизации: при `force_recanonicalize` он берёт все строки Lexin и AI ранга 1 этих слов, включая уже канонизированные и `needs_review`.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_notes_off_canon_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_notes_off_canon_v1\install_d10_notes_off_canon.ps1"
   ```
2. Деплой:
   ```powershell
   npx supabase functions deploy ai-enrichment-worker
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
3. Проверка: следующий прогон Audit. В цепочке канонизации теперь видна работа, а не «nothing_missing», и задача не ждёт заметок.

## Откат

Вернуть оба файла из `*.d10-notes-canon.bak` и задеплоить те же две функции.

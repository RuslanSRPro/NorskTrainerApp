# D10: служебное слово и часть речи (ved = «дрова»)

Согласовано 16.10.2026. Только миграция, деплой функций не нужен.

## Что было

Правило служебного слова «ved» (предлог) записано без части речи и срабатывало на любую. В «Jeg brenner ved» ved — существительное «дрова», и у Ordbøkene есть статья существительного. Карточка всё равно не создавалась.

## Что меняется

1. **Новая функция `d10_admission_decision_v1(доказательства, …)`.** Она даёт тот же результат, что `dictionary_admission_decision`, с одним исключением. Слово допускается, если выполнены все условия:
   - правило служебного слова записано без части речи;
   - у слова часть речи сущ., глагол или прил.;
   - Ordbøkene подтвердил статью Bokmål именно этой части речи.
2. **`promote_verification_results_for_job`.** Единственный вызов `dictionary_admission_decision` заменён на эту функцию. Точечная замена:
   - перед заменой миграция сверяет определение с запросом 130 (md5 `bdea5416…`); если оно другое, ничего не меняет;
   - повторный запуск ничего не меняет.

**Не меняется:**
- правила служебных слов и их таблица;
- `dictionary_admission_decision`;
- предлог ved, og, jeg и все остальные служебные слова отклоняются, как раньше.

## Проверено (PostgreSQL 16, живые определения функций)

- ved (сущ.) + статья Ordbøkene сущ. → допущен (`lexical_pos_ordbokene_article`);
- ved (предлог) → отклонён;
- ved (сущ.) без статьи Ordbøkene или со статьёй глагола → отклонён;
- og → отклонён;
- brenne (глагол, правила нет) → допущен, как раньше;
- откат 144b возвращает определение в точности (md5 совпадает).

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_function_word_pos_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_function_word_pos_v1\install_d10_function_word_pos.ps1"
   ```
2. SQL Editor — миграция (NOTICE «d10 function word pos v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261016120000_d10_function_word_pos_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 144 (все PASS):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\144_d10_function_word_pos_check.sql" | Set-Clipboard
   ```

## Откат

SQL Editor — `scripts/d10/144b_d10_function_word_pos_rollback.sql`.

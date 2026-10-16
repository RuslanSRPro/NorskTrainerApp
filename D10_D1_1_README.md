# D10 этап D1-1: ключ омографа (план D10_stage_d_plan_v3)

Первый шаг этапа D. Он **только добавляет**: поведение приложения и конвейера не меняется.

## Что меняется

1. **Миграция `20261014180000`:**
   - новое поле `lexemes.homograph_key`: у всех существующих карточек пустое; у второй карточки (R9) будет римский номер омографа, как в справочнике (II, III…). Другие значения запрещены проверкой;
   - новый уникальный индекс (lemma, pos, homograph_key);
   - **старый индекс (lemma, pos) остаётся.** Поэтому вторую карточку пока создать нельзя. Он удаляется только на шаге D2, вместе с кодом, который создаёт вторые карточки и выбирает карточку по статье;
   - `sync_expression_to_lexemes`: `ON CONFLICT (lemma, pos)` → `(lemma, pos, homograph_key)`. Пока ключ у всех пустой, обе формы находят ту же самую строку, поведение одинаковое. Без этой правки удаление старого индекса на шаге D2 сломало бы функцию. Функция правится точечно: если живое определение не такое, как ожидалось, миграция останавливается. Повторный запуск ничего не делает.
2. **Приложение, `services/api.ts`:** сохранение выражения (`upsert`) использует ту же цель конфликта `lemma,pos,homograph_key`. Причина та же.

## Проверено локально (PostgreSQL 16, живое определение функции)

- `sync_expression_to_lexemes`: обновление существующей карточки и создание новой работают как раньше.
- Сохранение в стиле приложения (`ON CONFLICT (lemma, pos, homograph_key)`) работает.
- Вторая карточка «bok II» пока блокируется старым индексом — так и задумано.
- Ключ не из римских цифр отклоняется.
- Повторный запуск миграции ничего не меняет.
- Проверка 93: T1–T4 PASS.

## Порядок (после окончания текущей задачи и проверки 88)

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_d1_1_homograph_key_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_d1_1_homograph_key_v1\install_d10_d1_1.ps1"
   ```
2. SQL Editor — миграция (ожидается NOTICE «homograph_key added…»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261014180000_d10_homograph_key_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 93, ожидается T1–T4 = PASS:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\93_d10_homograph_key_check.sql" | Set-Clipboard
   ```
4. Перезапустить приложение. Деплоя функций нет.

## Откат

- **Приложение:** вернуть `services/api.ts` из `.d10-d1-1.bak`.
- **База:** функцию вернуть заменой `(lemma, pos, homograph_key)` → `(lemma, pos)`, затем:
  ```sql
  DROP INDEX public.lexemes_lemma_pos_homograph_unique;
  ALTER TABLE public.lexemes DROP CONSTRAINT lexemes_homograph_key_check;
  ALTER TABLE public.lexemes DROP COLUMN homograph_key;
  ```

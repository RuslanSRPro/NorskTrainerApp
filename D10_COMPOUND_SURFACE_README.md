# D10: формы составного слова в тексте (vinterjakka → vinterjakke)

Ставится **после** D10_compound_v1. Только миграция, деплой функций не нужен.

## Что было

У составного слова без своей статьи Ordbøkene (vinterjakke) формы строятся по главной части: vinterjakka, vinterjakker и т. д. Они лежат в `lexeme_compound_head_forms_v1`. Разбор текста их не читал. Поэтому «vinterjakka» в тексте не находилось ни в базе, ни в словарях (`not_found_anywhere`) и останавливало задачу. Так закончилась последняя задача.

## Что меняется

В `collect_surface_candidates` добавлен ещё один источник — формы по главной части:
- **Блоки A и E без изменений.** Блок A — формы V2, блок E — точное совпадение с карточкой. Оба скопированы из живого определения от 14.10.
- **Где новый источник в порядке.** Он ниже форм V2 и выше простого совпадения леммы.
- **Только для карточек без своих форм V2.** Так же устроено и в приложении.
- **Защита.** Миграция сначала сравнивает живое определение функции с ожидаемым. Если оно другое, миграция ничего не меняет и показывает ошибку. Повторный запуск безопасен.

## Проверено (PostgreSQL 16, живые определения функций)

- vinterjakka → vinterjakke (сущ.), Vinterjakken → vinterjakke;
- vinterjakke → карточка, как раньше;
- jakka → jakke по формам V2, как раньше;
- контрольная сумма живого определения совпала с ожидаемой.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_compound_surface_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_compound_surface_v1\install_d10_compound_surface.ps1"
   ```
2. SQL Editor — миграция (NOTICE «d10 compound surface v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261016110000_d10_compound_surface_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 142 (T1 PASS):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\142_d10_compound_surface_check.sql" | Set-Clipboard
   ```

## Откат

SQL Editor — `scripts/d10/142b_d10_compound_surface_rollback.sql`. Это живое определение функции от 14.10, без нового источника.

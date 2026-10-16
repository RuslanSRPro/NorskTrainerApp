# D10: несколько статей одной части речи без привязки (passe, прил.)

Ставится **после** D10_gray_pos_clone_v1 и D10_homonym_icon_v2. Только миграция, деплой не нужен.

## Что было

Одно слово «passe» без контекста: в задаче есть и глагол, и прилагательное. У Ordbøkene два прилагательных passe с разными формами — passe I и passé/passe II. Ни одно не привязано к карточке. Проверка честно ответила «несколько статей, ни одна не выбрана», и прилагательное осталось на допуске. Задача остановилась.

Прошлое исправление (D10_homonym_icon_v2) помогало только копиям части речи. Здесь прилагательное — не копия, а отдельное слово из разбора.

## Что меняется

Функция `d10_promote_gray_pos_clones_v1` получила ещё одно условие. Карточкой становится и слово, у которого Ordbøkene нашёл **две или больше** статьи Bokmål этой части речи. Дальше так же, как у копий:
1. существующая карточка привязывается, иначе создаётся новая;
2. слово идёт в обогащение;
3. шаг омографов (он идёт после) даёт карточке статью с наименьшим номером (passe I) и создаёт passe II (R9). Если формы одинаковые, привязывает все статьи к одной карточке (R8).

Остальной текст функции — без изменений из D10_gray_pos_clone_v1. Слово без статей Ordbøkene, которое не копия, по-прежнему останавливает задачу, как раньше.

## Проверено (PostgreSQL 16)

- passe (прил., статьи 44353 и 44354, не копия) → карточка, переход в обогащение;
- слово без статей (не копия) → остаётся на допуске, как раньше;
- копии части речи — как раньше.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_gray_ambiguous_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_gray_ambiguous_v1\install_d10_gray_ambiguous.ps1"
   ```
2. SQL Editor — миграция (NOTICE «d10 gray ambiguous articles v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261016130000_d10_gray_ambiguous_articles_v1.sql" | Set-Clipboard
   ```
3. Тест: слово «passe». Затем запрос 147. Ожидается:
   - прилагательное на стадии `semantic_audit` с карточкой;
   - карточка passe II (прил.) со своей строкой (`homograph = true`).

## Откат

Выполнить функцию `d10_promote_gray_pos_clones_v1` из миграции `20261016100000_d10_gray_pos_clone_v1.sql`. Это прежняя версия.

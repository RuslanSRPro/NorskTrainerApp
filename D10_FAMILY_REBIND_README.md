# D10: семья 360 у новых вторых карточек

Ставится **поверх** D10_compound_v1.

## Что было

Выражения из подстатей Ordbøkene (like tall, like for like, uten like) привязываются к карточке в первой цепочке, через связь «статья → карточка» (`lexeme_headword_aliases_v2`). У новой второй карточки эта связь появляется только при публикации её форм, в последней цепочке. В момент привязки карточки ещё нет: функция молча возвращает пусто, и повторно никто не привязывает.

Итог на живой базе: 77 выражений без семьи. У 49 карточка статьи уже есть, у 28 нет.

## Что меняется

Только добавления. Функция привязки `bind_lexeme360_expression_roots_batch_v1` не меняется, и её проверки остаются те же:
- у статьи одна карточка;
- выражение действительно из этой статьи.

| Где | Что |
|---|---|
| `d10_rebind_expression_roots_v1(ids)` | повторяет привязку для выражений без карточки семьи. Карточки нет → пропуск, как раньше. Ошибка одной статьи не останавливает остальные |
| `d10_rebind_job_expression_roots_v1(job)` | то же для выражений задачи и подстатей статей её слов |
| `job-enrichment-batch-worker` | после каждой страницы цепочки форм вызывает функцию для задачи. Это добавка: её сбой не меняет результат форм, итог виден в `family_rebind_v1` |
| `118` | разовая догрузка всех существующих (пишет) |

## Проверено (PostgreSQL 16, настоящая функция привязки)

- Задача с карточками like (глагол и прилагательное):
  - like tall и like for like привязаны к прилагательному;
  - like seg не тронут.
- Общая догрузка: uten like привязан к существительному. nyttig idiot без карточки статьи остаётся непривязанным.
- Повтор: 0 новых привязок. Повтор миграции ничего не меняет.
- Синтаксис batch-worker проверен.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_family_rebind_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_family_rebind_v1\install_d10_family_rebind.ps1"
   ```
2. SQL Editor — миграция (NOTICE «d10 family rebind v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015170000_d10_family_rebind_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — разовая догрузка 118. **Пишет.** Ожидается bound около 49, no_card_yet около 28, failed 0:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\118_d10_family_rebind_backfill.sql" | Set-Clipboard
   ```
4. SQL Editor — проверка 119:
   - T1 PASS;
   - T2 около 28;
   - like tall, like for like → прилагательное; uten like → существительное.
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\119_d10_family_rebind_check.sql" | Set-Clipboard
   ```
5. Деплой:
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
6. В приложении: семья 360 карточки «like (прилагательное)» содержит like tall и like for like.

## Не входит

28 выражений, у статьи которых нет карточки (например, nyttig idiot ← nyttig, статья 41447). Причина другая: родительское слово не стало карточкой в базе или у него нет форм. Их разберу отдельно, если нужно.

## Откат

Вернуть batch-worker из `*.d10-family-rebind.bak` и задеплоить. Функции можно оставить: без вызова они ничего не делают. Привязки из 118 — обычные привязки той же функции.

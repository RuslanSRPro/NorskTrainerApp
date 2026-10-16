# D10: составные слова — разбор, формы по главной части, NAOB в задаче

Согласовано 15.10.2026. Ставится **поверх** D10_r9_guard_b3_v1. Всё добавляется: таблица `lexeme_form_display_v2`, её снимки, проверки полноты и триггер раскраски не меняются.

## 1. Разбор по словарю

Только для слова **без своей статьи Ordbøkene**, которое NAOB знает целиком (как vinterjakke).

| Условие | Зачем |
|---|---|
| Ordbøkene **ответил** «статьи нет», есть проверка NAOB с found | Сбой Ordbøkene не считается отсутствием статьи |
| Перебор всех мест разреза; связка `-s-`/`-e-` в конце первой части (arbeid+s+jakke, barn+e+hage) | Правила словосложения |
| Главная часть — карточка в нашей базе той же части речи, с формами из статьи Ordbøkene | Из неё берутся формы |
| Первая часть — заголовок Ordbøkene: сначала наша база, потом точный поиск (`scope=e`) | Подтверждение части |
| Подходит **один** вариант → разбор `source_verified`, источник `dictionary_split` | |
| Два и больше вариантов, или карточки-омонимы главной части с разными формами → **на проверку** (`private.d10_compound_review_v1`), ничего не пишется | Не угадываем |
| Сбой Ordbøkene при проверке первой части → ничего не пишется, повтор при следующем аудите | |

**Старшинство разборов.** Разбор NAOB старше словарного. Ручной разбор (например, прежний barnehage) никогда не заменяется. Один и тот же разбор переписывается без изменений.

## 2. Формы по главной части

- Новая таблица `lexeme_compound_head_forms_v1`. В ней приставка + формы главной части: vinterjakke, vinterjakka/vinterjakken, vinterjakker, vinterjakkene. Артикли тоже от главной части.
- Формы строит **сервер** (`d10_publish_compound_head_forms_v1`) из строк главной карточки. Отказ, если:
  - у слова есть свои формы;
  - нет проверенного разбора с этой главной частью;
  - омонимы главной части дают разные формы;
  - форма главной части из нескольких слов («har gjort»).
- **Приложение** читает эту таблицу, только если у слова нет ни одной строки в `lexeme_form_display_v2`. Перед названием формы стоит «≈». Раскраска частей берётся из разбора. Если таблица недоступна, у слова просто нет форм, как раньше.
- Формы по главной части попадают и в упражнения, как и перевод с «≈». Если их там не нужно, скажите: уберу.

## 3. NAOB в задаче

- `compound-candidate-promoter` получил режим «только эти слова» (`lexeme_ids`). Старый режим (общая очередь, ручной запуск) не изменился.
- Новый шаблон NAOB «annet ledd X» (sykehus → «annet ledd hus»). Первая часть = лемма минус X → syke + hus.
- «sammensatt av X og Y» обрабатывается как раньше, но через ту же функцию записи со старшинством.

## Где это запускается

В цепочке форм (`job-enrichment-batch-worker`), после обычного шага Ordbøkene, для той же страницы слов:
1. promoter для слов страницы;
2. `compound-head-forms-worker` для слов, где Ordbøkene ответил «статьи нет».

Это добавка: её сбой **не меняет** результат форм и не останавливает задачу. Итог виден в `compound_v1` результата цепочки. Повтор — при следующем аудите.

## Ограничения

- В тексте «vinterjakka» пока не узнаётся как форма vinterjakke: поиск по формам в `analyze-text` читает только `lexeme_form_display_v2`. Можно добавить отдельно.
- Главная часть должна уже быть карточкой в базе с формами. Если её нет, разбора нет.
- Только две части. vinterjakkelomme разбирается, только если vinterjakke — заголовок Ordbøkene.
- Грамматический граф пока не участвует. Он читает те же таблицы разбора и увидит их после активации.

## Файлы

| Файл | Изменение |
|---|---|
| миграция `20261015160000_d10_compound_v1.sql` | таблицы `lexeme_compound_head_forms_v1`, `private.d10_compound_review_v1`; функции записи разбора, публикации форм, пометки, выборки кандидатов |
| `_shared/d10-compound-split.ts` | новое: правило разбора, «annet ledd» |
| `compound-head-forms-worker/index.ts` | новая функция |
| `compound-candidate-promoter/index.ts` + `lexeme-mode.ts` | режим «только эти слова» |
| `verification/adapters/naob.ts` | шаблон «annet ledd» |
| `job-enrichment-batch-worker/index.ts` | шаг после форм |
| `services/formReadModel.ts`, `formReadModelCore.ts`, `api.ts`, `app/(tabs)/reading.tsx` | чтение форм по главной части, «≈» |
| `tests/d10-compound/compound_test.mts` | 14 тестов |
| `scripts/d10/115_d10_compound_check.sql` | только чтение |

## Проверено

- **14 тестов Node:**
  - vinterjakke → vinter + jakke, формы;
  - свои формы → не трогается;
  - сбой Ordbøkene → ничего;
  - NAOB не знает слово → ничего;
  - первая часть не слово → нет разбора;
  - два разбора → проверка;
  - омонимы главной части → проверка;
  - другая часть речи → нет;
  - 502 → ошибка без записи;
  - первая часть из базы без сети;
  - arbeid+s+jakke;
  - «annet ledd»;
  - promoter: barnehage, sykehus и непригодный кандидат.
- **Миграция на PostgreSQL 16.** Повтор ничего не меняет, 15 проверок:
  - формы vinterjakke;
  - старшинство NAOB над словарём;
  - ручной разбор не заменяется;
  - раскраска sykehus в своих строках;
  - отказы `OWN_FORMS_EXIST`, `HEAD_FORMS_DIVERGE`, `HEAD_FORM_NOT_SINGLE_WORD`, неверное написание;
  - при замене разбора старые формы по главной части удаляются.
- **Синтаксис** всех файлов. Окончания строк исходных файлов сохранены.

## Порядок

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_compound_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_compound_v1\install_d10_compound.ps1"
   ```
2. Тест из папки проекта, ожидается `pass 14`:
   ```powershell
   node --experimental-strip-types --test supabase/functions/tests/d10-compound/compound_test.mts
   ```
3. SQL Editor — миграция (NOTICE «d10 compound v1 installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015160000_d10_compound_v1.sql" | Set-Clipboard
   ```
4. SQL Editor — проверка 115 (T1 PASS):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\115_d10_compound_check.sql" | Set-Clipboard
   ```
5. Деплой **в этом порядке**. Promoter раньше batch-worker: иначе задача обратится к старому promoter. Тот получит только безопасный `dry_run` и запишет в `compound_v1` ошибку.
   ```powershell
   npx supabase functions deploy compound-candidate-promoter
   ```
   ```powershell
   npx supabase functions deploy compound-head-forms-worker
   ```
   ```powershell
   npx supabase functions deploy lexical-worker
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
6. Приложение: `eas update` или перезапуск Expo.
7. Тест: «Jeg liker vinterjakke» в режиме Audit → Check. Ожидается:
   - в 115-D: `vinter+jakke`, 4 head rows, 0 own rows;
   - в карточке слова: раскраска vinter|jakke и формы с «≈».

## Откат

1. Вернуть файлы из `*.d10-compound.bak`.
2. Задеплоить `compound-candidate-promoter`, `lexical-worker`, `job-enrichment-batch-worker`, обновить приложение.
3. `compound-head-forms-worker` можно оставить: его больше никто не вызывает.
4. Таблицы и функции миграции можно оставить: без воркеров в них ничего не пишется. Разборы `dictionary_split` удаляются отдельным SQL, если понадобится.

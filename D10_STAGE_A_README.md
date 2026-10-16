# D10 этап A — явные ошибки (план D10_homonym_pos_plan_v1)

Основа: резервная копия от 13.10.2026 (`NorskTrainer_text_analysis_backup_20261013_151146.zip`). Установщик сверяет хэши трёх меняемых файлов именно с ней.

## Что меняется

### A1. Проверка Ordbøkene: набор статей одной лексемы (`verification/adapters/ordbokene.ts`)

- Старое правило без изменений: если к лексеме привязана **ровно одна** статья-кандидат (være 69211), выбирается она. Код вынесен в функцию `selectBoundHomonymArticles`, чтобы его можно было тестировать. Поведение то же.
- **Новое:** если к лексеме этого элемента привязаны **несколько** кандидатов (huske 24686 + 24687, одинаковые формы — правило R8), проверка пройдена. В доказательстве `article_ids` — набор, `article_selection: bound_lexeme_article_set`.
- Набор применяется только к точному поиску леммы (`lookup_scope = 'e'`). Для поиска по словоформе (`'i'`) — как раньше: SQL-функции леммы нужна одна статья.
- Если ни одна статья не привязана — как раньше, «Ambiguous». Добавлено только диагностическое поле `bound_article_ids`.
- Деплой: `lexical-worker` (адаптер используется только им).

**Проверка затронутых цепочек:**

| Где | Результат |
|-----|-----------|
| Продвижение и защита части речи (`promote_verification_results_for_job`) | Принимает набор: Ordbøkene `registered_entry`, часть речи совпадает. Глагол huske будет продвинут ✓ |
| Лемма продвижения (`d10_verified_ordbokene_promotion_lemma`) | Срабатывает только при поиске по словоформе; набор там не используется ✓ |
| AI-обогащение и AI-проверка (`pos-sense-guard`: нужна одна статья) | По запросу 71: у всех 44 лексем с несколькими статьями она **уже сейчас** не проходит. Регрессии нет, но и улучшения нет → этапы C/D |
| Цепочка Ordbøkene в обогащении | Получит `article_id = null`, поиск найдёт несколько статей и завершится без данных, без ошибки (как сейчас) |
| Добавление семейства 360 (`d10_inject_verified_job_family_page_v1`: одна статья) | Для набора семейство не добавляется. Сейчас глагол не продвигается совсем, так что регрессии нет → этап C |
| Клон-существительное huske в режиме текста | Всё ещё создаётся (`expand_multi_pos_occurrences_for_job`) → этап B1 |

### A2. Статус «обрабатывается», пока supervisor не закончил (`get-job-status`, `_shared/job-status-policy.ts`)

- Срабатывает только если у задачи статус `done` от оркестратора, а этап supervisor'а — `orchestrator`, `enrichment` или `audit`. Тогда ответ `processing`, и проверка полноты не запускается.
- Итоговые статусы supervisor'а (`completed` / `needs_manual_review`) и задачи без строки supervisor'а не меняются. Если строку не удалось прочитать, всё работает по-старому.
- В `job-status-policy.ts` функция `supervisorStillRunning` только добавлена; `ownsJob` не тронут.
- Приложение (`reading.tsx`) уже обрабатывает `processing`: продолжает опрос раз в 4 секунды. Приложение не меняется.
- Деплой: `get-job-status`.

### A3. Служебные слова не делают задачу «needs manual review» (миграция `20261013160000`)

- Функция `d10_job_gray_family_audit_v1`: в `blocked_count` больше не попадают служебные слова, отклонённые правилом допуска. Условие то же, что уже действует в проверке полноты для приложения (`get_completion_evidence_snapshot_v1`).
- Добавлен ключ `excluded_function_word_count`. `gray_ids` и `gray_count` не меняются. Сигнатура и права те же. Вызывает функцию только `job-completion-auditor`, и лишних ключей он не проверяет.

## Тесты

- `supabase/functions/tests/d10-stage-a/stage_a_test.ts` — 9 тестов (A1: одна статья, være, huske, часть набора, без привязки; A2: все этапы, конечные статусы, нет строки). Проверены локально. Запуск: `deno test supabase/functions/tests/d10-stage-a/`.
- `scripts/d10/72_d10_admission_blocked_check.sql` — до и после миграции, на трёх реальных задачах.

## Установка

0. **До установки** (только чтение): `scripts/d10/73_d10_completion_snapshot_dump.sql`, результат — файлом. По нему проверяется, что скажет приложению проверка полноты для задачи 3779546f после A (см. «Риск»).
1. Распаковать архив в «Загрузки» и запустить установщик (две отдельные строки):
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_stage_a_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_stage_a_v1\install_d10_stage_a.ps1"
   ```
2. SQL Editor: `72` (до) → миграция `20261013160000` → `72` (после).
3. Деплой — две отдельные строки:
   ```powershell
   npx supabase functions deploy lexical-worker
   ```
   ```powershell
   npx supabase functions deploy get-job-status
   ```
4. Живой тест в режиме аудита: «Er tiden. Jeg husker det.» Ожидание:
   - пока идёт обогащение, окно «Needs manual review» не появляется;
   - глагол huske продвинут (`article_selection: bound_lexeme_article_set`);
   - supervisor не считает Jeg/det заблокированными.

## Риск (проверяется запросом 73 до установки)

Даже когда supervisor завершит задачу как `completed`, `get-job-status` отдаёт приложению итог проверки полноты (`learner_ready`). 12.10, на середине обогащения, выражения семейства в ней были «blocked» (`IDENTITY_NOT_VERIFIED`, `EXPRESSION_WHOLE_UNIT_EVIDENCE_MISSING`). Если так останется и после окончания, приложение по-прежнему покажет «needs manual review» — уже по причине качества выражений, а не из-за ошибки. Это отдельный вопрос, ничего не меняю без согласования.

## Откат

Вернуть три файла из `*.d10-stage-a.bak` и задеплоить `lexical-worker` и `get-job-status`. Для A3 — повторно применить определение `d10_job_gray_family_audit_v1` из `20261009223000_d10_family_independent_display_v2.sql` (строки 512–545).

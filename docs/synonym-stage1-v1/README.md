# synonym-stage1-v1 — локальный пакет

Добавляются только три новых файла: эта инструкция, `supabase/migrations/20261027140448_synonym_stage1_v1.sql` и
`scripts/d10/200_synonym_stage1_check.sql`. Единый patch находится в корне архива.
Пакет не применён к Windows-проекту или Production.

## Основание и сравнение

Снимок: synonym-handoff-20261027-140118.zip.
Ветка: fix/audio-runtime-completion-p1.
HEAD: abfa5cfb2ce0634b9c40aaed2831704e71feba90.
65/65 записей manifest.json совпали по SHA-256 и размеру. В git-status.txt:
21 изменённый отслеживаемый файл и многочисленные неотслеживаемые файлы.
Совпадений новых путей пакета со списком статуса не найдено.
Архив содержит также два .bak, несмотря на описание экспорта; они не использованы и не включены.
Отсутствующий expression-matcher.ts не требуется для этого этапа.
Прямого доступа к текущей C:\Users\subbo\NorskTrainerApp нет: сравнение с живой
директорией не выполнено. git apply --check выполняется на отдельной копии снимка,
а не на исходном HEAD и не на Windows-проекте. Снимок не является полным репозиторием.

Прочитаны исходники extractor/resolver, текущие SynonymsBadge/TrainingMeta,
миграция save_authoritative_semantic_relation, места интеграции анализа текста,
предоставленные определения Production-функций и триггеров. В Production
sync_lexeme_synonym_column действительно не фильтрует статус; его не меняем.
Полных CREATE TABLE Production нет; совместимость с реальной схемой до деплоя
должна быть проверена отдельно. Миграция проверяет UUID идентификаторы и
останавливается при несовместимости. Совпадение существующих имён новых объектов
также вызывает ошибку, а не молча пропускается через IF NOT EXISTS.

## Состав изменения

Шесть таблиц: настройки, semantic_senses, gloss/target/candidate/verification queues.
В authoritative_semantic_relations добавляются поля значений, класса связи,
признания и доказательств. Существующие отношения и lexemes.synonyms не обновляются.

Триггер только записывает очередь при будущих изменениях глоссов:
direct → queued, reference → reference_pending; новый no_gloss не ставится в очередь.
Если прежний direct/reference становится no_gloss, его очередь получает ignored.
Меньшая origin_depth сильнее: least сохраняет минимальную известную глубину.
Одинаковый fingerprint с понижением depth обновляет только depth и updated_at;
queue_status, attempts, next_attempt_at, last_error и lease сохраняются.
Повторное recursive обнаружение не повышает уже известную depth=0.
Одинаковый fingerprint не сбрасывает завершённую обработку. Изменение глосса
сбрасывает lease и retry, а будущий worker обязан проверять fingerprint перед записью.
Триггер работает как SECURITY INVOKER: сервисный extractor имеет доступ,
обычные клиенты — нет. Запись глосса неавторизованной ролью может быть отклонена:
это нужно сверить с реальными writers перед применением.

pipeline_enabled=false, publish_verified_only=false. Триггер собирает лёгкую
очередь даже при отключённой обработке; jobs не создаются.
Дневной лимит 20, размер пачки 5, одновременность 1 и максимальная глубина 0 —
пока только конфигурация. Соблюдать их будут workers следующих этапов.
Транзакционная метка origin_depth поддерживается триггером, но автоматическая
передача происхождения через Edge pipeline ещё НЕ реализована. До её реализации
обработку включать нельзя.

Внутренние таблицы защищены RLS без клиентских policies; права PUBLIC/anon/
authenticated отозваны, service_role получает явные права. Сервисный ключ в приложение
не добавляется. Новые функции SECURITY INVOKER с пустым search_path;
EXECUTE открыт только service_role и владельцу. Очередь верификации имеет ключ,
учитывающий цель, pipeline/snapshot, fingerprint источника и verifier version.

## Идентичность кандидатов и задачи

Кандидат обязан иметь relation_id или gloss_id. Уникальность relation+version
сохранена; для gloss добавлен отдельный частичный UNIQUE индекс:
gloss_id + lower(btrim(target_text)) + pipeline_version. Пустой target_text запрещён.
Будущий dispatcher обязан применять ON CONFLICT с этим ключом.
Оба job_id имеют FK на lexeme_processing_jobs(id) ON DELETE SET NULL.
Предоставленные SQL-функции используют UUID задач; дополнительно миграция
проверяет фактический тип lexeme_processing_jobs.id до создания объектов.

needs_manual_review не является обычным ожиданием POS/kind. Он зарезервирован
для явно неразрешимых/конфликтных случаев. Автоматического worker для него нет:
его разбирает оператор; возврат в очередь потребует отдельного согласованного
инструмента второго этапа. Stage 1 backfill больше не присваивает этот статус.

## Backfill: только определение

Функция d10_synonym_backfill_v1(integer,boolean) добавлена, но НЕ вызывалась,
включая dry_run. Автоматического вызова нет. Допустимый limit: 1..100,
по умолчанию 20; dry_run=true использует только SELECT, без временных таблиц.
Пустые legacy target_text не ставятся в очередь и не изменяются;
они требуют отдельной диагностики перед миграцией старых данных. Реальный вызов сериализован advisory transaction lock и пишет только новые очереди.
Выбираются только существующие synonym/candidate, без обхода таблицы глоссов.
Сохраняется legacy evidence; старый target_entity_id не используется как доказательство.

POS берётся только у source lexeme, а не у прежней target-привязки.
У выражений функциональный POS не выводится из родительского слова автоматически:
такие кандидаты получают awaiting_pos_resolution. Будущий synonym-gloss-dispatcher
обязан выбирать этот статус, определять POS по статье/значению NAOB и затем
передавать цель в enrichment. Это контракт второго этапа; самого worker пока нет.
Многословные цели с известным POS получают awaiting_target_resolution,
который также обязан обрабатывать synonym-gloss-dispatcher; однословные считаются lexeme-кандидатами, а не подтверждённой
идентичностью. Неизвестные POS/kind не создают target queue или job.
Это намеренное консервативное ограничение этапа 1; resolver следующего этапа
должен снять неоднозначность. Реальная готовность карточек и число необходимых
jobs пока не вычисляются — функция не выдаёт выдуманных оценок готовности.

## Применение только файлов — пользователем

Распакуйте архив в Downloads. Не копируйте содержимое поверх проекта целиком.
В PowerShell выполните только проверку:

```powershell
Set-Location 'C:\Users\subbo\NorskTrainerApp'
$patch = 'C:\Users\subbo\Downloads\synonym-stage1-v1\synonym-stage1-v1.patch'
git status --short
git rev-parse HEAD
git apply --check --whitespace=error $patch
if ($LASTEXITCODE -ne 0) { throw 'STOP: patch check failed; do not apply' }
git apply --stat $patch
```

Локальное применение добавит только три новых файла. Эта команда НЕ запускает SQL:

```powershell
git apply --whitespace=error $patch
if ($LASTEXITCODE -ne 0) { throw 'STOP: patch application failed' }
git status --short
```

Не запускайте db push, psql миграции, backfill, deploy, AI или cron по этой инструкции.
Read-only SQL предназначен для отдельно согласованной проверки ПОСЛЕ применения
миграции; сейчас запускать его в Production не нужно. Он не вызывает backfill,
не считает все глоссы/отношения и работает в READ ONLY транзакции.

## Проверки и ограничения

23 локальных проверки на изолированном PGlite/PostgreSQL с минимальными fixture-таблицами:
создание, настройки, trigger transitions, идемпотентность, POS/kind, RLS/ACL, READ ONLY SQL,
дедупликация gloss-кандидата, запрет отсутствующего происхождения и пустой цели,
expression-source → awaiting_pos_resolution и оба FK задач. Тест маршрутизации
выполняет только SELECT с точным CASE из функции; backfill не вызывается.
Это не копия Production. Backfill runtime, миграционная история и интеграция с
полной Production-схемой не проверены. AI и внешние jobs не запускались.
Отчёт git apply --check, сравнение SHA-256 исходников и список patch-путей
приложены в validation.txt. Единственный проверенный target — копия снимка.

## Откат

До применения SQL: git apply -R --check <patch>, затем git apply -R <patch>
только если добавленные файлы не менялись; существующие правки не затрагиваются.
Если SQL когда-либо будет применён: оставить оба переключателя false, не удалять
таблицы/кандидатов. Снятие нового триггера и удаление пустых новых объектов требуют
отдельной проверенной миграции отката после оценки накопленных данных.
Готовой разрушительной down-миграции пакет не содержит.

Следующие этапы: dispatcher и корректное определение POS/kind, pipeline origin и
ограничение 360, финальный snapshot hook, verifier, ограниченный согласованный
backfill, затем публикация/UI. Старый resolver/cron сейчас не удаляются.

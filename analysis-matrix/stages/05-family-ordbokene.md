# 05 — Семейство из Ordbøkene (подстатьи)

## Назначение
Для глагола-корня — выражения из подстатей его статьи Ordbøkene, привязка к корню для семейства 360.

## Код
job-orchestrator `runFamilyDictionaryStep` → SQL `d10_family_dictionary_roots_page_v2(job, limit)` (отбор корней) →
Edge `ordbokene-lexeme-pipeline-worker` → запись `d10_family_dictionary_record_v1`.
Связи подстатей: `ordbokene-sub-article-relation-worker` (кандидаты `ordbokene_expression_candidates`).

## Отбор корней [проверено по `20261107170000_d10_naob_family_v1`; живой текст сверить]
Пункт задачи: token, done, `semantic_audit`, `promotion_status='promoted'`, глагол; проверка Ordbokene done, found,
registered, whole_unit, ровно один `article_id` (или `article_selection='bound_lexeme_article_set'`).
`need_ordbokene`: нет привязки `ordbokene_parent_article` к этой статье и нет записи в журнале (done / failed / retry < 2 мин).

## Таблицы
`private.lexeme360_expression_roots_v1` (source_kind `ordbokene_parent_article`, `source_article_id`),
`private.d10_family_dictionary_runs_v1` (журнал), `ordbokene_expression_candidates`.

## Повторный анализ
**Не перезапускается**, если журнал `done` / `failed` или привязка уже есть. [проверено по тексту отбора]

## Известные проблемы
- 10.11: кандидаты ссылались на удалённые выражения → цепочка падала `EXPRESSION_CATALOG_ID_MISSING`;
  с 11.11 воркер пропускает (C-1111-05).
- brenne — образец правильного разделения: подстатьи 7434 → brenne, 7433 → brenne I.

## История
C-1111-05.

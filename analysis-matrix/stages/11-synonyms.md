# 11 — Синонимы

## Код
SQL `d10_synonym_after_job_v1`, `d10_synonym_dispatch_v1` (дочерние задачи), `d10_synonym_bm_tick_v1` (cron 5 мин),
`d10_synonym_record_decision_v1`, `d10_synonym_lease_pairs_v1`, `synonym_refresh_drain_v1` (cron 30 с);
Edge `naob-synonym-extractor`, `naob-synonym-resolver`, `synonym-verifier`. [проверить по коду]

## Таблицы
`synonym_candidate_queue` (source_entity = корень, target_text, target_kind, naob_slug, naob_gloss = ряд синонимов,
stage1_status, dispatch_status, child_job_id, gloss_id → naob_expression_glosses), `synonym_pipeline_config`
(daily_job_limit 150, max_concurrent_jobs 1, max_auto_origin_depth 0), `private.synonym_collection_state_v1`,
`synonym_expression_resolution_v1`, `authoritative_semantic_relations` (старый путь `naob_synonym_resolver`).

## Правила
D13. Синоним NAOB как опора «≈» для выражения — D9.

## Нагрузка
`d10_synonym_bm_tick_v1` в 454 (до сброса): до 118 с за вызов. [проверено, нужно следить]

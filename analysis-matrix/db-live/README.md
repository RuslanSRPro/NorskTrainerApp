# db-live — живые определения из базы

Часть SQL-функций создана прямо в базе и отсутствует в `supabase/migrations` (известные: `get_stranded_expression_candidates`,
`claim_next_semantic_audit`, `claim_next_expression_semantic_audit`, `get_lexeme360_ready_expressions_v2`,
`get_lexeme360_root_options_v1`, `private.lexeme360_roots_for_lexeme_v2`, `d10_synonym_bm_tick_v1` и др.).
Другие функции многократно патчились на месте (точка привязки в DO-блоке), поэтому текст в файлах миграций
может отличаться от живого (пример: `d10_homograph_candidates_for_job_v1`).

Правило Q4: перед правкой любой функции брать живой текст.

План (новый чат): скрипт `tools/` выгружает сюда по файлу на функцию (`<schema>.<name>.sql`) + `cron.csv` +
`indexes.csv`, чтобы изменения в базе были видны в Git. [не сделано]

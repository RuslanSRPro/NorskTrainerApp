# 14 — Фон и нагрузка на базу

## Cron (известные)
| Имя | Расписание | Что |
|---|---|---|
| pipeline-supervisor-tick | 1 мин | цепочки обогащения |
| lexeme360-refresh-drain | 30 с, лимит 55 с, бюджет 20 с | снимки 360 |
| synonym-refresh-drain | 30 с, бюджет 20 с | синонимы |
| d10-synonym-bm-tick | 5 мин, лимит 120 с | синонимы |
| semantic-audit-worker-periodic | 5 мин | семантический аудит (claim_next_*) |
| call_expression_candidate_promoter | 5 мин | get_stranded_expression_candidates |
| d10-problem-cards-refresh | 5 мин | кэш ⚠️-списка |
| категории | 5 мин | expression-category-worker |
[проверить: полный список `select jobname, schedule from cron.job`]

## Найдено 11.11 [проверено, 454]
Три опроса без индексов: ~27 000 с времени базы, упор в лимит 8 с, при пустых очередях → индексы
`20261111150000`. После: карточки ta 3 с (было 30–40). Не было индексов `lexeme_processing_items (job_id, lexeme_id)`
и `(job_id, expression_id)`.

## Открыто
Пики во время анализа слова (11.11 ~20:10 si, ~21:15 hete) — причина не найдена. Статистика сброшена 21:18 —
следующий анализ + запрос 454.

## Запросы
452 (сейчас), 454 (самые дорогие с именами), 461 (кэш реже + сброс статистики).

## История
C-1110-06, C-1111-09, C-1111-10.

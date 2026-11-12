# 13 — Отчёты: задача, ⚠️-список

## Код [проверено]
- История задач (приложение `components/AnalysisHistory.tsx`): `get_job_problem_items_v1(job)` — причины по словам
  (no_translation, no_translation_en, no_example, example_no_translation, ai_rejected, ai_example_highlight,
  no_unique_article, not_confirmed, pos_unconfirmed, not_found, enrichment_error).
- Окно задачи (`app/(tabs)/reading.tsx`): только `review_items` из `get-job-status`; блока проблемных слов нет.
- ⚠️-список (`reading.tsx`): `d10_problem_cards_v4` / `d10_problem_cards_count_v3` → кэш
  `private.d10_problem_cards_cache_v1`, обновление `private.d10_problem_cards_refresh_step_v1` (cron
  `d10-problem-cards-refresh` 5 мин, 150 карточек + до 100 свежих из задач). В список входят и карточки вне обучения.

## Известные проблемы
- Новая сборка TestFlight с блоком «Проблемні слова» в истории ещё не сделана; в окне задачи блока нет.
- Сбои шага омонимов не попадают в отчёт.

## История
C-1110-07, C-1111-09.

# 01 — Приём: analyze-text, пункты, проверки источников

## Назначение
Принимает текст или список слов, создаёт задачу и пункты, ставит проверки источников.

## Вход → выход
Вход: запрос приложения или скрипта (`mode='word_list'` для списка слов, без режима — текст).
Выход: `lexeme_processing_jobs` (задача), `lexeme_processing_items` (пункты: token / expression),
`lexeme_source_checks` (Ordbokene, NAOB, Lexin, Wiktionary, Språkrådet; статус pending → done / partial / failed).

## Код
`supabase/functions/analyze-text/index.ts`, `surface-resolver-v2.ts` (разбор формы в лемму);
проверки выполняет `lexical-worker` (`adapters.ts`) с адаптерами `functions/verification/adapters/*`
(ordbokene.ts, naob.ts, lexin.ts, wiktionary.ts, pos-scope.ts). [проверить по коду: порядок вызовов]

## Таблицы
`lexeme_processing_jobs`, `lexeme_processing_items` (`result_summary` jsonb: admission_status, promotion_status,
clone_reason, gray_reason …), `lexeme_source_checks` (`evidence`: raw_preview, requested_pos, found_pos, pos_match,
pos_basis; колонки `pos` нет). [проверено]

## Журналы, кэши, условия пропуска
- `analysis_skip_config_v1.skip_since` (08.11): текстовый анализ пропускает уже обработанное; `word_list` — нет. [проверено по разговору]
- `source_lookup_cache` (кэш ответов источников) [проверить по коду: срок жизни]
- `ordbokene_article_cache`, `naob_article_cache` (страницы) — см. 06.

## Повторный анализ
Новая задача, новые пункты и проверки. Но ответы источников могут браться из кэшей. [проверить по коду]

## Известные проблемы
- 11.11: двойное нажатие в приложении создало две задачи stemme в одну секунду (нет блокировки кнопки).

## Правила
D5, D1.

## Достоверность
[проверено] структура evidence (`lexical-worker/adapters.ts` строки ~150–175, `pos-scope.ts`).
[проверить по коду] analyze-text целиком, кэши источников.

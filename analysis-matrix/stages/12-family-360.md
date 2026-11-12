# 12 — Семейство 360 в приложении

## Код [проверено, живой текст]
`get_lexeme360_ready_expressions_v2(card)`: корни `private.lexeme360_roots_for_lexeme_v2(card)` (сама карточка,
если к ней что-то привязано, + корни выражений) → `private.lexeme360_expression_roots_v1` → `expression_catalog`
(verification_status multi_source / authoritative / usage_verified, отображаемый подтип, активная запись выражения).
`get_lexeme360_root_options_v1`, `get_lexeme360_examples_v1`, `get_lexeme360_candidate_display_v1`.
Обновление снимков: `lexeme360_refresh_drain_v1` (cron 30 с).

## Важно
`expression_catalog.lexeme_id` указывает на собственную запись выражения (pos expression), а не на корень.
Семейство определяется привязками (05, 06). Корни по карточке выбираются правильно (hete / hete II — разные).

## Известные проблемы
hete: привязки NAOB перемешаны (см. 06). Проверка: запрос 460.

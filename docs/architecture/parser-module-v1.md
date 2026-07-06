# Parser Module v1

## Цель

Parser v1 выделен из analyze-text в отдельный модуль.

Его задача:

- токенизировать текст;
- найти известные выражения;
- нормализовать формы;
- закрыть найденные выражения от повторного разбора как отдельных слов;
- вернуть список planned_items.

## Главное правило

Expression first.

Сначала ищутся выражения длиной до 8 токенов.

Только потом оставшиеся токены разбираются как отдельные слова.

## Источники выражений

Parser должен читать выражения из:

1. trusted_expressions_v1;
2. expression_catalog, где lexeme_id is not null;
3. verification_status in ('multi_source', 'authoritative').

В будущем trusted_expressions_v1 должен быть заменён на expression_catalog как единый источник правды.

## Нормализация

Parser должен уметь:

- tar med → ta med;
- tok med → ta med;
- finner ut → finne ut;
- går fra hverandre → gå fra hverandre;
- gleder meg til → glede seg til;
- tar seg av → ta seg av.

## Выход Parser

Parser возвращает PlannedItem:

- raw_input;
- normalized_input;
- normalized_lemma;
- surface_form;
- pos;
- match_type;
- expression_id;
- token_start;
- token_end;
- expression_subtype;
- match_strategy;
- compound_normalized;
- network_root_lemma.

## Что Parser не делает

Parser не подтверждает качество выражения.

Parser не решает, добавлять ли слово в базу.

Parser не делает Lexeme360.

Parser не делает promotion.

Parser только определяет возможные языковые единицы в тексте.
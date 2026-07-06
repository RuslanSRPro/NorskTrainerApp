# Module Responsibilities

**Project:** Norsk Trainer  
**Component:** Language Processing Pipeline v2

---

# Основной принцип

Каждый модуль имеет **одну ответственность** (Single Responsibility Principle).

Модуль:

- отвечает только за свою задачу;
- не знает внутреннее устройство других модулей;
- не изменяет данные, за которые отвечает другой модуль;
- возвращает результат следующему этапу Pipeline.

Только `index.ts` является orchestrator и определяет порядок выполнения модулей.

---

# Pipeline

```
Text

↓

Grammar Parser

↓

Expression Resolver

↓

Lexeme Resolver

↓

Lexeme360 Enrichment

↓

Parser Pass 2

↓

Source Checks

↓

Verification

↓

Promotion

↓

Semantic Relations

↓

Translation Ranking

↓

Done
```

---

# Grammar Parser

## Responsibility

Понять, что написано в тексте.

Parser:

- разбивает текст;
- ищет выражения;
- находит отдельные слова;
- нормализует формы;
- возвращает список найденных единиц.

## Input

```
Text
```

## Output

```
PlannedItem[]
```

## Cannot

Parser НЕ имеет права:

- обращаться к источникам;
- выполнять Verification;
- выполнять Promotion;
- выполнять Lexeme360;
- изменять базу данных.

---

# Expression Resolver

## Responsibility

Определить, существует ли найденное выражение.

## Input

```
PlannedItem[]
```

## Output

```
ResolvedExpression[]
```

Добавляет:

- expression_id
- lexeme_id
- root_lemma
- verification_status
- expression_subtype

## Cannot

Не делает:

- Parser
- Lexeme360
- Promotion
- Semantic Relations

---

# Lexeme Resolver

## Responsibility

Определить словарную лемму.

Например

```
gjester

↓

gjest
```

или

```
barna

↓

barn
```

## Input

ResolvedExpression[]

## Output

ResolvedLexeme[]

## Cannot

Не делает:

- Parser
- Lexeme360
- Verification

---

# Lexeme360 Enrichment

## Responsibility

Обогатить сеть найденной леммы.

Например

```
ta

↓

ta med
ta imot
ta opp
ta rede på
...
```

## Input

ResolvedLexeme[]

## Output

Updated Expression Catalog

## Cannot

Lexeme360 НЕ подтверждает выражение.

НЕ делает Verification.

НЕ принимает решение о Promotion.

НЕ анализирует текст.

---

# Parser Pass 2

## Responsibility

Повторный анализ текста после обогащения.

Используется только один раз.

Позволяет найти выражения, которые появились после Lexeme360.

## Input

Text

+

Updated Expression Catalog

## Output

Updated PlannedItem[]

## Cannot

Не делает Verification.

---

# Source Checks

## Responsibility

Проверка найденных единиц во внешних источниках.

Источники:

- Ordbokene
- NAOB
- Lexin
- Wiktionary

## Output

Evidence

---

# Verification

## Responsibility

Оценить качество найденных данных.

## Input

Evidence

## Output

Verification Result

например

```
candidate

multi_source

authoritative
```

## Cannot

Не изменяет Parser.

---

# Promotion

## Responsibility

Создать или обновить Lexeme.

Добавляет:

- lexeme
- expression
- forms
- translations

## Cannot

Не занимается поиском выражений.

---

# Semantic Relations

## Responsibility

Создание смысловых связей.

Например

- synonym
- antonym
- hypernym
- related
- derived
- expression relation

---

# Translation Ranking

## Responsibility

Ранжирование переводов.

Не занимается Verification.

---

# index.ts

## Responsibility

Pipeline Orchestrator.

Только определяет порядок выполнения.

Например

```ts
await parser();

await resolveExpressions();

await resolveLexemes();

await enrichLexeme360();

await parserPass2();

await sourceChecks();

await verify();

await promote();

await semanticRelations();

await translationRanking();
```

## Cannot

Не содержит бизнес-логики.

Все вычисления находятся в отдельных модулях.

---

# Design Rules

Каждый модуль:

✔ имеет одну ответственность

✔ имеет понятный Input

✔ имеет понятный Output

✔ не знает внутреннюю реализацию других модулей

✔ может быть протестирован отдельно

✔ может использоваться повторно

---

# Future Modules

В дальнейшем Pipeline может быть расширен.

Например

- Reading Analyzer
- Voice Analyzer
- Dictionary Maintenance
- Batch Refresh
- Import Pipeline
- AI Explanation
- AI Example Generation

Все новые модули должны следовать тем же правилам.
# Pipeline v1 Stabilization Before v2

**Version:** 1.0  
**Status:** Required before Pipeline v2 refactoring

---

# Purpose

Before starting the modular refactoring of **Language Processing Pipeline v2**, the current implementation of **Analyze Text** must be returned to a completely stable and fully working state.

The objective of this phase is **not to improve algorithms**, but to ensure that every part of the existing pipeline functions correctly before it is decomposed into modules.

Only after achieving a stable baseline may the Pipeline v2 refactoring begin.

---

# Why this phase exists

During the design of Pipeline v2 we discovered an important engineering principle:

> **Never refactor a system whose current behaviour is not fully working.**

Otherwise it becomes impossible to distinguish:

- bugs introduced during refactoring;
- bugs that already existed;
- regressions caused by moving code.

Therefore the first milestone is creating a **stable reference implementation**.

---

# Historical Architecture (Pipeline v1)

```text
Reading Analyzer
      │
      ▼
analyze-text
      │
      ▼
job-orchestrator
      │
      ├────────────► verification-pipeline
      │                    │
      │                    ▼
      │             verified lexeme
      │
      ▼
authoritative-enrichment-pipeline-worker
      │
      ├── Ordbokene
      ├── NAOB
      ├── Wiktionary
      ├── Frequency
      ├── CEFR
      ├── Expressions
      ├── Collocations
      ├── Relations
      └── Semantic Audit
              │
              ▼
        lexical-worker
              │
              ▼
         Save database
```

Pipeline v2 is **not a replacement** of this architecture.

It is the same processing philosophy reorganized into a modular internal pipeline.

---

# Stabilization Goal

The entire Analyze Text flow must work correctly from input text to database update.

Every stage must be verified before refactoring begins.

---

# Required Working Flow

```text
Text

↓

Grammar Parser

↓

Expression Resolution

↓

Lexeme Resolution

↓

Lexeme360 Enrichment

↓

Verification

↓

Promotion

↓

Database Update

↓

UI
```

Every stage must produce valid output for the next stage.

---

# Stabilization Checklist

## 1. Grammar Parser

Must correctly:

- tokenize text;
- normalize words;
- detect expressions before single words;
- apply Longest Match;
- build Planned Items.

Parser output must match the current production behaviour.

---

## 2. Expression Resolution

Must correctly identify existing expressions.

Expected:

```text
tar med
↓

ta med
```

```text
tok med
↓

ta med
```

```text
går fra hverandre
↓

gå fra hverandre
```

The resolver must return:

- expression_id
- lexeme_id
- root lemma
- normalized expression

---

## 3. Lexeme Resolution

Must correctly resolve lexical forms.

Examples:

```text
gjester
↓

gjest
```

```text
barna
↓

barn
```

```text
tok
↓

ta
```

Output must contain a valid lemma for every recognized item.

---

## 4. Lexeme360 Enrichment

This is the most important validation point.

Lexeme360 must actually expand the lexical network.

Example:

```text
ta
```

must produce approximately

```text
ta med
ta opp
ta ut
ta over
...
```

Current failure:

```text
lexeme360_network_items = 0

lexeme360_candidates_found = 0
```

Expected:

non-zero enrichment results.

---

## 5. Verification

Verification pipeline must successfully classify candidates.

Expected transitions:

```text
candidate

↓

multi_source

↓

authoritative
```

No regressions are allowed.

---

## 6. Promotion

Promotion must correctly:

- create new lexemes;
- update existing lexemes;
- preserve existing knowledge.

Promotion must never create duplicates.

---

## 7. UI Validation

Lexeme360 UI must display:

- enrichment cards;
- carousel;
- candidate cards;
- authoritative entries.

UI is considered correct only if it reflects actual pipeline output.

---

# Acceptance Criteria

Pipeline v1 is considered stabilized only when:

- Parser correctly detects expressions.
- Expression resolution works.
- Lexeme resolution works.
- Lexeme360 expands lexical networks.
- Verification succeeds.
- Promotion updates the dictionary.
- Database receives correct data.
- Lexeme360 UI shows actual enrichment.
- No regressions compared to the previous implementation.

---

# Freeze Point

Only after all stabilization criteria are met should the project create a stable baseline.

Recommended tag:

```text
pipeline-v1-stable
```

This becomes the reference implementation for all future refactoring.

---

# Refactoring Rule

After stabilization:

**Move first. Improve later.**

Every module must initially preserve existing behaviour.

Algorithm improvements are postponed until the module has been fully extracted and tested.

Correct order:

```text
1. Stabilize Pipeline v1

↓

2. Extract Parser

↓

3. Verify identical behaviour

↓

4. Extract Expression Resolver

↓

5. Verify identical behaviour

↓

6. Extract Lexeme Resolver

↓

7. Verify identical behaviour

↓

8. Continue with remaining modules
```

At no point should multiple major modules be rewritten simultaneously.

---

# Engineering Principle

The objective of Pipeline v2 is not to invent a new language-processing system.

The objective is to transform the existing working pipeline into a modular, maintainable, versioned architecture without changing behaviour during refactoring.

Only after the modular architecture is complete may new language-processing capabilities be introduced.

---

# Versioned Knowledge

The stabilization phase also establishes the foundation for future dictionary evolution.

Knowledge is expected to evolve over time.

Example:

```text
candidate

↓

multi_source

↓

authoritative
```

Historical states must never be lost.

Future Dictionary Maintenance will reuse the same Pipeline, processing existing database entries instead of new input text.

This ensures that the dictionary can be reprocessed months or years later while preserving its historical evolution.
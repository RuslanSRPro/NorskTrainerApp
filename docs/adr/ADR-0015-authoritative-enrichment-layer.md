# ADR-0015 — Authoritative Enrichment Layer

## Status

Planned

---

## Context

The verification pipeline is now capable of:

- source verification
- evidence classification
- semantic relation extraction
- relation resolution
- normalized text ingestion

However, authoritative sources contain significantly more information than simple verification status.

Current verification answers:

- Does this unit exist?
- Is it supported by an authoritative source?
- What evidence supports it?

But learner-facing functionality requires additional data:

- definitions
- examples
- inflection
- usage notes
- expressions
- semantic links

This information should be stored separately from verification.

---

## Decision

Introduce a dedicated Authoritative Enrichment Layer.

This layer does not affect verification status.

It only stores additional information retrieved from authoritative sources.

---

## Verification vs Enrichment

Verification:

```text
exists?
verified?
evidence quality?
```

Enrichment:

```text
definition
examples
inflection
usage information
semantic information
```

These concerns must remain separated.

---

## Initial Source Priority

Phase 1:

```text
Ordbokene
```

Phase 2:

```text
NAOB
```

Phase 3:

```text
Lexin
Språkrådet
```

---

## Proposed Table

authoritative_enrichment

```sql
id uuid

lexeme_id uuid null
expression_id uuid null

source text

lemma text
part_of_speech text

definitions jsonb
examples jsonb

inflection jsonb

metadata jsonb

created_at timestamptz
updated_at timestamptz
```

---

## New Worker

ordbokene-enrichment-worker

Pipeline:

```text
verified lexical unit
↓
Ordbokene lookup
↓
extract enrichment
↓
store enrichment
```

---

## Extraction Targets

Phase 1

```text
lemma
part_of_speech
```

Phase 2

```text
definitions
examples
```

Phase 3

```text
inflection
expressions
```

---

## Important Rule

Enrichment must never modify:

```text
verification status
verification quality
audit decisions
```

Verification remains authoritative.

Enrichment remains informational.

---

## Future Features Enabled

The enrichment layer will support:

```text
dictionary cards
reading hints
voice feedback
example generation
learning explanations
flashcards
grammar assistance
```

without mixing learner-facing metadata with verification logic.

---

## Relation to ADR-0014

ADR-0014 introduced:

```text
frequency
CEFR
learning metadata
```

ADR-0015 introduces:

```text
definitions
examples
dictionary content
```

Both are enrichment layers.

Neither affects verification.

---

## First Research Task

Investigate Ordbokene payloads for:

```text
gå
hus
glede seg til
ta vare på
```

Determine which fields can be extracted reliably before implementing the first enrichment worker.
# ADR-0013 — Grammar Rules Layer

## Status

Planned

---

## Context

The lexical verification pipeline currently focuses on:

- lexemes
- expressions
- authoritative verification
- semantic relations
- enrichment metadata

However, language learning and text analysis also require a dedicated grammar/rules layer.

Grammar rules are fundamentally different from lexical entities.

Dictionary entries and grammar rules must remain separated architecturally.

---

## Decision

A future dedicated grammar subsystem will be introduced.

Planned core tables:

- grammar_rules_catalog
- grammar_rule_examples
- grammar_rule_triggers
- grammar_rule_relations

---

## Intended Sources

Primary authoritative source:

- Språkrådet

Secondary possible sources:

- official educational materials
- trusted grammar references
- manually curated examples

AI-generated rules are NOT authoritative.

AI may later assist with:

- explanations
- simplification
- tutoring
- adaptive feedback

but not as source of truth.

---

## Planned Responsibilities

Grammar layer should support:

- grammar pattern detection
- spelling rules
- punctuation rules
- preposition usage
- word order analysis
- agreement rules
- learner-level explanations
- contextual rule hints

---

## Architectural Separation

Lexical pipeline:

text
→ tokenization
→ lexical verification
→ semantic enrichment

Grammar pipeline:

text
→ syntax/pattern analysis
→ grammar rule matching
→ learner explanations

These pipelines remain independent.

---

## Important Principle

Dictionary fact != grammar rule

Lexical verification and grammar validation must not be merged into one model.

---

## Future Workers

Planned future workers:

- grammar-rule-matcher
- grammar-feedback-worker
- grammar-explanation-worker

---

## Consequences

Benefits:

- clean architecture
- explainable grammar feedback
- scalable rule system
- separation of concerns
- authoritative rule management

Tradeoff:

- additional subsystem complexity
- separate maintenance lifecycle
- delayed implementation
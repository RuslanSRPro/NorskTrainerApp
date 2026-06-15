# ADR-0014 — Learning Metadata: Frequency and CEFR

## Status

Planned

---

## Context

The old `analyze-text` implementation already used learning metadata such as:

- frequency_rank
- frequency_level
- frequency_source
- frequency_note
- cefr

It also allowed Gemini to estimate CEFR and frequency level for unknown units.

This was useful for learning UX, but it mixed several responsibilities:

- lexical verification
- enrichment
- learning priority
- AI fallback

The new architecture separates these concerns.

---

## Decision

Frequency and CEFR are learning metadata.

They are NOT verification metadata.

A word or expression can be:

- verified but missing frequency
- verified but missing CEFR
- unverified but AI-estimated for learning purposes

These states must remain separate.

---

## Authoritative Verification vs Learning Metadata

Verification answers:

```text
Does this lexical unit exist?
Is it supported by an authoritative source?
What kind of evidence supports it?
Learning metadata answers:

How useful is this unit for a learner?
How frequent is it?
What CEFR level is it likely to belong to?
Should it be prioritized in training?

These questions must not be merged.

Data Fields

Existing fields may be used:

Lexemes
lexemes.frequency_rank
lexemes.frequency_level
lexemes.frequency_source
lexemes.frequency_note
lexemes.cefr
Expressions
expression_catalog.frequency_rank
expression_catalog.frequency_level
expression_catalog.cefr

Future normalized layer may introduce:

learning_metadata
learning_priority_score
learning_metadata_evidence
learning_metadata_source
learning_metadata_confidence
Source Policy

Preferred sources for frequency:

curated frequency lists
corpus-based frequency data
subtitle corpus
manually reviewed frequency tiers

Preferred sources for CEFR:

official or educational wordlists
trusted learner dictionaries
manually reviewed levels

AI may provide estimates only as fallback.

AI-estimated metadata must be marked clearly:

source = ai_estimate
confidence = low

AI estimates must not upgrade verification status.

Important Principle

Learning confidence != verification confidence

Example:

verification_status = authoritative
learning_confidence = low

is valid when the word exists but frequency or CEFR is missing.

Example:

verification_status = candidate
cefr = B1
cefr_source = ai_estimate

is also valid, but must remain untrusted for verification.

Pipeline Separation

Lexical verification pipeline:

source checks
→ verification evidence
→ semantic audit
→ trusted / needs_review

Learning metadata pipeline:

verified or candidate lexical unit
→ frequency lookup
→ CEFR lookup
→ learning priority scoring
→ learner-facing metadata
Gemini / OpenAI Role

Gemini or OpenAI may later assist with:

examples
simplified explanations
learner hints
CEFR estimates
topic suggestions

But AI must not be the source of authoritative lexical truth.

AI output should be stored as:

estimated
low confidence
reviewable
source-labelled
Relation to Old Analyze-Text

The old analyzer is preserved as an idea source for:

chunking
expression-first matching
reflexive normalization
auxiliary + participle normalization
learning metadata fields

But the monolithic design must not be restored.

The new pipeline must remain modular.

Future Workers

Planned future workers:

frequency-enrichment-worker
cefr-enrichment-worker
learning-priority-worker
learner-example-worker
Consequences

Benefits:

avoids mixing trust with learning usefulness
preserves honest verification status
supports better learner UX
allows AI assistance without corrupting source truth

Tradeoff:

more metadata layers
more explicit confidence handling
some verified entries may remain low-confidence for learning until enriched
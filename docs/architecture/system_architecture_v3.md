# Norsk Trainer App — System Architecture v3

## Core Rule

Authoritative source can enrich.  
Gemini can complete.  
Only verification pipeline can trust.

## Main Application Purpose

Norsk Trainer App is a Norwegian learning app with:

- vocabulary training
- expression recognition
- reading/text analysis
- SRS learning queue
- lexical verification
- semantic audit
- future voice, pronunciation and tutoring features

## Main Architecture

```text
text / user input
→ analyze-text / ingestion
→ processing jobs
→ processing items
→ source checks
→ verification promotion
→ semantic audit
→ trusted read layer
→ semantic normalization
→ relations
→ enrichment
→ learning UI / voice / tutoring
Key Decision

analyze-text must remain ingestion/parser logic.

It must NOT be:

verifier
catalog writer
enrichment writer
trust authority
Source of Truth

Authoritative sources:

NAOB
Ordbokene
Språkrådet
Lexin
Wiktionary

These sources may provide:

registered entries
whole-unit evidence
component evidence
usage examples
translations when available
definitions
source URLs
AI Role

Gemini may complete missing learning content:

examples
translations
learner explanations
topic suggestions
learning hints
candidate suggestions

Gemini must not assign:

trusted
dictionary_entry
dictionary_match
registered_entry
whole_unit_match

OpenAI API is reserved for later interactive learning features:

voice
pronunciation
tutoring
rules explanation
conversation analysis
Fixed Critical Bugs
Fix 1 — Source Evidence Flags

NAOB / Ordbokene search or suggest results must not become:

registered_entry=true
whole_unit_match=true

Search/suggest/example evidence is not canonical dictionary evidence.

Fix 2 — Promotion Rank

promote_verification_results_for_job must use semantic evidence flags:

registered_entry
whole_unit_match
usage_match
component_match
found

It must not promote solely from:

quality='strong'
quality='medium'
Trusted Read Layer

Frontend and learning logic should prefer:

trusted_lexemes_v1
trusted_expressions_v1

Raw tables are not final trusted read models.

Important Separation

Verification determines truth.

Enrichment improves learning experience.

Normalization creates semantic units.

Relations connect semantic units.

Frontend should consume trusted/read views, not raw worker tables.

Production-ready
lexical-worker
semantic-audit-worker
trusted_lexemes_v1
trusted_expressions_v1
semantic-rank promotion logic
Partially migrated
form-enrichment-worker
semantic-normalization-worker
semantic-relation-worker
Experimental / not production-safe
grammar-family-worker
gemini_bulk scripts
legacy expression generation JSON files
Legacy Warning

Old analyze-text logic mixed:

parsing
verification
AI suggestions
direct catalog writes
enrichment
expression generation

This must not return.

Current Safe Pipeline Direction
Authoritative verification first
→ semantic audit
→ trusted views
→ enrichment/completion
→ normalization
→ relations
→ learning UI
# Norsk Trainer App — Project Structure v3

## Frontend

### app/

Expo / React Native application screens.

Important areas:

- reading.tsx — reading analyzer UI
- train screens — SRS and vocabulary training
- voice screens — future voice/pronunciation flows

### components/

Reusable UI components.

Important files:

- Lexeme360.tsx
- Lexeme360Carousel.tsx

### services/

Frontend data/API helpers.

Important files:

- api.ts
- i18n.ts

## Supabase Functions

### supabase/functions/lexical-worker/

Handles source verification checks.

Key files:

- index.ts — claims pending source checks
- process-source-check.ts — adapter result → database source check
- cache.ts — source lookup cache
- adapters.ts — source routing
- types.ts — SourceCheck / LookupResult contracts

Responsibility:

- call authoritative sources
- save source evidence
- never assign final trust directly

### supabase/functions/verification/adapters/

Source adapters.

Important adapters:

- naob.ts
- ordbokene.ts
- shared.ts

Responsibility:

- classify source evidence correctly
- distinguish search/suggest/example from registered entry
- never over-promote surface fragments

### supabase/functions/semantic-audit-worker/

Final trust calibration.

Responsibility:

- aggregate source evidence
- compute review_status
- compute semantic_confidence
- compute verification_confidence
- compute source_confidence
- compute form_confidence
- compute learning_confidence
- detect conflicts

Only this worker may determine final trust status.

### supabase/functions/form-enrichment-worker/

Morphological/form enrichment.

Responsibility:

- canonical form
- form type
- grammatical features
- accepted variants

Priority:

1. lexeme_form_variants
2. internal rules fallback

### supabase/functions/semantic-normalization-worker/

Creates normalized semantic units.

Tables:

- canonical_semantic_units
- semantic_unit_variants

Responsibility:

- normalize trusted lexemes/expressions
- attach variants
- prepare semantic graph

### supabase/functions/semantic-relation-worker/

Builds semantic unit relations.

Currently minimal.

Responsibility:

- variant relations
- future synonym/derived/semantic relations

### supabase/functions/grammar-family-worker/

Experimental.

Current risk:

- uses simple suffix heuristics
- does not use verified form variants
- should not be part of production full pipeline yet

## Database Core Tables

### lexemes

Main word catalog.

### expression_catalog

Main expression catalog.

### lexeme_processing_jobs

Processing jobs.

### lexeme_processing_items

Processing items inside jobs.

### lexeme_source_checks

Raw source verification results.

### source_lookup_cache

Cached source lookups.

## Semantic / Audit Tables

### lexeme_semantic_enrichment

Lexeme semantic audit and enrichment metadata.

### expression_semantic_enrichment

Expression semantic audit and enrichment metadata.

### canonical_semantic_units

Unified semantic units.

### semantic_unit_variants

Variants for canonical semantic units.

### semantic_unit_relations

Relations between semantic units.

## Trusted Views

### trusted_lexemes_v1

Trusted lexemes only.

### trusted_expressions_v1

Trusted expressions only.

Important:

Frontend and learning systems should use trusted views instead of raw catalog tables.

## Legacy / Experimental

### norsk-expressions/

Contains Gemini-generated expression JSON and sync scripts.

Status:

- useful historical seed data
- not production source of truth
- should not write trust fields directly

Important files:

- gemini_bulk.mjs
- gemini_bulk_2.mjs
- gemini_bulk_3.mjs
- gemini_bulk_4.mjs
- sync_to_catalog.mjs

## Architectural Rules

### Rule 1

Authoritative source can enrich.

### Rule 2

Gemini can complete.

### Rule 3

Only verification pipeline can trust.

### Rule 4

AI output must be marked with source and confidence.

### Rule 5

Filled does not mean verified.

### Rule 6

Do not merge parser, verifier, enrichment and catalog writer again.

## Current Next Steps

1. Finish enrichment inventory.
2. Add field-level enrichment metadata.
3. Harden semantic-normalization-worker.
4. Keep grammar-family-worker out of production pipeline until rewritten.
5. Build controlled full reverification + enrichment pipeline.
6. Return to analyze-text parser only after verification/enrichment foundation is stable.
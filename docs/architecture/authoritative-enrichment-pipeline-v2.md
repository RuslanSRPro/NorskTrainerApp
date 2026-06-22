# Authoritative Enrichment Pipeline V2

## 1. Purpose

`authoritative-enrichment-pipeline-v2` is the orchestration layer for enriching Norwegian lexemes and expressions from authoritative linguistic sources and internal analytical layers.

The pipeline must support both:

1. expressions
2. single lexemes

But the global architectural rule remains:

```text
TEXT
→ Expression Detection
→ Expression Verification & Enrichment
→ Lexeme Detection
→ Lexeme Verification & Enrichment
→ Semantic Audit
→ Catalog Update
→ Learning Layer
```

The key principle:

```text
Expressions first. Single lexemes second.
```

This prevents multiword expressions from being incorrectly split into individual words before they are verified as independent lexical units.

Examples:

```text
ta hensyn til
legge merke til
ta kontakt med
ha ansvar for
```

---

# 2. Core Architectural Principle

## 2.1 Expression-first processing

Expressions are treated as independent lexical units.

They are not just combinations of words.

Therefore, the pipeline must always attempt to detect and verify expressions before processing their component lexemes.

Correct order:

```text
Input text
↓
Detect expression candidates
↓
Verify/enrich expressions
↓
Mask or reserve confirmed expressions
↓
Detect remaining single lexemes
↓
Verify/enrich lexemes
```

Incorrect order:

```text
Input text
↓
Tokenize words
↓
Verify words
↓
Try to reconstruct expressions later
```

This incorrect order may destroy the expression context.

---

# 3. Pipeline Scope

`authoritative-enrichment-pipeline-v2` is responsible for orchestrating authoritative and analytical enrichment.

It does not replace individual source workers.

It coordinates them.

Existing source workers should be reused where possible.

---

# 4. Source Layers

## 4.1 Layer 1 — Authoritative Sources

These are external linguistic/reference sources.

### Ordbokene

Existing worker:

```text
ordbokene-lexeme-pipeline-worker
```

Current version:

```text
ordbokene_lexeme_pipeline_v4
```

Responsibilities:

```text
article lookup
article fetch
entity detection
standalone expression promotion
expression extraction
expression promotion
has_expression relations
article_ref relations
relation resolution
```

Writes or updates:

```text
ordbokene_status
source_ordbokene
ordbokene_article_id
ordbokene_article_ref
ordbokene_diagnostic_status
ordbokene_confidence
```

Possible statuses for expressions:

```text
expr_entry
sub_article
article_ref
not_listed
candidate
```

---

### NAOB

Existing workers:

```text
naob-article-fetcher
naob-structure-extractor
naob-expression-batch-worker
naob-pipeline-worker
```

Current version:

```text
naob_pipeline_v1
```

Responsibilities:

```text
article fetch
structure extraction
expression lookup inside article
uttrykk detection
example detection
not_listed detection
diagnostic status
```

Writes or updates:

```text
naob_status
source_naob
naob_article_id
naob_article_ref
naob_diagnostic_status
naob_confidence
```

Possible statuses:

```text
uttrykk
example
not_listed
candidate
```

Important rule:

```text
not_listed is a valid signal.
```

Example:

```text
ha ansvaret for
ha besøk av
ha betydning for
```

may receive:

```text
naob_status = not_listed
diagnostic_status = expression_not_found_in_article
```

This does not mean the expression is wrong.

It means it is probably not lexicalized in NAOB.

It may still be:

```text
support_verb_construction
collocation
```

---

### Wiktionary

Future worker:

```text
wiktionary-pipeline-worker
```

Responsibilities:

```text
lookup
entry detection
inflection extraction
translation hints
usage notes
candidate status
```

Writes or updates:

```text
wiktionary_status
source_wiktionary
wiktionary_confidence
wiktionary_diagnostic_status
```

Possible statuses:

```text
entry
translation_hint
not_listed
candidate
```

---

### Lexin

Future worker:

```text
lexin-pipeline-worker
```

Responsibilities:

```text
learner-oriented lookup
simple definition extraction
examples
CEFR/learning relevance hints if available
```

Writes or updates:

```text
lexin_status
source_lexin
lexin_confidence
lexin_diagnostic_status
```

Possible statuses:

```text
entry
example
not_listed
candidate
```

---

### Språkrådet

Future worker:

```text
sprakradet-pipeline-worker
```

Responsibilities:

```text
normative language guidance
recommended form
spelling/norm check
usage recommendation
```

Writes or updates:

```text
sprakradet_status
source_sprakradet
sprakradet_confidence
sprakradet_diagnostic_status
```

Possible statuses:

```text
recommended
accepted
discouraged
not_listed
candidate
```

---

# 5. Layer 2 — Internal Analytics

Internal analytics are not copied from dictionaries.

They are derived by our own analytical logic.

## 5.1 Expression Structure

Field:

```text
expression_structure
```

Possible values:

```text
particle_verb
prepositional_verb
support_verb_construction
reflexive_construction
multiword_fixed
```

Examples:

```text
ta hensyn til → support_verb_construction
legge merke til → support_verb_construction
se opp for → prepositional_verb / particle-like construction
```

---

## 5.2 Expression Semantics

Field:

```text
expression_semantics
```

Possible values:

```text
idiom
collocation
conversation_phrase
discourse_marker
functional_phrase
```

Examples:

```text
ta hensyn til → collocation
legge merke til → collocation
ikke sant → conversation_phrase
for eksempel → discourse_marker
```

---

# 6. Layer 3 — Verification Resolution

Verification resolution is a separate step.

It must not be mixed into source workers.

Source workers only report source-specific evidence.

The resolver decides the final review status.

Main output:

```text
expression_review_status
```

Possible values:

```text
verified
partial
unverified
disputed
```

---

## 6.1 Suggested resolution logic

### verified

Use when at least one authoritative source gives a strong positive signal.

Examples:

```text
ordbokene_status = expr_entry
naob_status = uttrykk
```

---

### partial

Use when the expression is supported, but not fully lexicalized.

Examples:

```text
ordbokene_status = sub_article
naob_status = example
```

or:

```text
naob_status = not_listed
expression_structure = support_verb_construction
expression_semantics = collocation
```

---

### unverified

Use when no authoritative source confirms it and internal analytics are weak.

Example:

```text
ordbokene_status = not_listed
naob_status = not_listed
expression_structure = null
expression_semantics = null
```

---

### disputed

Use when sources conflict or when one source indicates a different lemma/expression mapping.

Example:

```text
ordbokene_status = candidate
naob_status = uttrykk
but normalized expression differs
```

---

# 7. New Main Orchestrator

## 7.1 Worker name

```text
authoritative-enrichment-pipeline-worker
```

## 7.2 Input

For expression enrichment:

```json
{
  "item_type": "expression",
  "expression_id": "uuid",
  "expression_lemma": "legge merke til",
  "force_refresh": false,
  "update_catalog": true
}
```

For lexeme enrichment:

```json
{
  "item_type": "lexeme",
  "lexeme_id": "uuid",
  "lemma": "merke",
  "pos": "verb",
  "force_refresh": false,
  "update_catalog": true
}
```

Batch mode:

```json
{
  "mode": "batch",
  "item_type": "expression",
  "limit": 100,
  "only_missing": ["naob_status"],
  "force_refresh": false,
  "update_catalog": true
}
```

---

# 8. Orchestration Flow

## 8.1 Expression flow

```text
authoritative-enrichment-pipeline-worker
↓
load expression from expression_catalog
↓
normalize expression lemma
↓
run Ordbokene pipeline if needed
↓
run NAOB pipeline if needed
↓
run future source workers if enabled
↓
run verification resolver
↓
run semantic audit
↓
update expression_catalog
↓
write enrichment log
```

---

## 8.2 Lexeme flow

```text
authoritative-enrichment-pipeline-worker
↓
load lexeme from lexeme_catalog
↓
normalize lemma + POS
↓
run Ordbokene pipeline if needed
↓
run NAOB pipeline if applicable
↓
run future source workers if enabled
↓
run verification resolver
↓
update lexeme_catalog
↓
write enrichment log
```

---

# 9. Worker Sequence

## 9.1 For expressions

Recommended sequence:

```text
1. authoritative-enrichment-pipeline-worker
2. ordbokene-lexeme-pipeline-worker
3. naob-pipeline-worker
4. wiktionary-pipeline-worker
5. lexin-pipeline-worker
6. sprakradet-pipeline-worker
7. verification-resolver-worker
8. semantic-audit-worker
9. catalog-update-worker
```

At the current stage, only these should be active:

```text
1. authoritative-enrichment-pipeline-worker
2. ordbokene-lexeme-pipeline-worker
3. naob-pipeline-worker
4. verification-resolver-worker
5. semantic-audit-worker
6. catalog update inside orchestrator or existing update logic
```

Future workers should be feature-flagged.

---

# 10. What Each Layer Writes

## 10.1 Ordbokene layer

Writes:

```text
source_ordbokene
ordbokene_status
ordbokene_article_id
ordbokene_article_ref
ordbokene_confidence
ordbokene_diagnostic_status
ordbokene_updated_at
```

Does not write:

```text
expression_review_status
expression_structure
expression_semantics
```

---

## 10.2 NAOB layer

Writes:

```text
source_naob
naob_status
naob_article_id
naob_article_ref
naob_confidence
naob_diagnostic_status
naob_updated_at
```

Does not write:

```text
expression_review_status
expression_structure
expression_semantics
```

---

## 10.3 Verification resolver

Writes:

```text
expression_review_status
verification_confidence
verification_reason
verification_updated_at
```

For lexemes:

```text
lexeme_review_status
verification_confidence
verification_reason
verification_updated_at
```

---

## 10.4 Semantic audit

Writes:

```text
expression_structure
expression_semantics
semantic_audit_confidence
semantic_audit_reason
semantic_audit_updated_at
```

Important:

Semantic audit can use authoritative source evidence, but it must not pretend that its conclusions come directly from the source.

Example:

```text
NAOB not_listed + repeated pattern ha X for
```

may support:

```text
expression_structure = support_verb_construction
expression_semantics = collocation
```

but this is internal analysis.

---

# 11. Mass Catalog Run

Mass processing must not be launched before the orchestrator is stable.

Recommended mass run strategy:

```text
1. dry_run = true
2. limit = 20
3. inspect logs
4. limit = 100
5. inspect status distribution
6. full batch
```

---

## 11.1 First mass run target

Current known state:

```text
expression_catalog ≈ 1050
source_ordbokene = true ≈ 217
naob_status is null ≈ 217
```

First safe batch:

```json
{
  "mode": "batch",
  "item_type": "expression",
  "only_where": {
    "source_ordbokene": true,
    "naob_status": null
  },
  "limit": 20,
  "dry_run": true
}
```

Then:

```json
{
  "mode": "batch",
  "item_type": "expression",
  "only_where": {
    "source_ordbokene": true,
    "naob_status": null
  },
  "limit": 20,
  "dry_run": false
}
```

Then:

```json
{
  "mode": "batch",
  "item_type": "expression",
  "only_where": {
    "source_ordbokene": true,
    "naob_status": null
  },
  "limit": 100,
  "dry_run": false
}
```

---

# 12. Existing Functions That Can Be Reused

## 12.1 Reuse without rewriting

```text
ordbokene-lexeme-pipeline-worker
naob-pipeline-worker
naob-article-fetcher
naob-structure-extractor
naob-expression-batch-worker
ordbokene-article-fetcher
ordbokene-expression-extractor
ordbokene-expression-promotion-worker
ordbokene-sub-article-relation-worker
ordbokene-article-ref-relation-worker
relation-resolver
semantic-audit-worker
```

These should not be rewritten now.

They should be called by the new orchestrator.

---

## 12.2 Workers that may need small adaptation

```text
semantic-audit-worker
relation-resolver
```

Potential changes:

```text
accept expression_id directly
accept lexeme_id directly
support source-specific evidence payload
return structured audit result
avoid direct uncontrolled catalog overwrite
```

---

# 13. New Workers Needed

## 13.1 Required now

```text
authoritative-enrichment-pipeline-worker
```

Main orchestrator.

---

```text
verification-resolver-worker
```

Responsible only for final review status resolution.

Should not fetch external source data.

---

```text
enrichment-batch-runner
```

Responsible for controlled batch processing.

Supports:

```text
limit
dry_run
force_refresh
only_missing
only_where
item_type
```

---

## 13.2 Optional now / future

```text
wiktionary-pipeline-worker
lexin-pipeline-worker
sprakradet-pipeline-worker
catalog-update-worker
```

`catalog-update-worker` is optional if updates remain inside orchestrator for now.

But long term, catalog updates should be separated.

---

# 14. Recommended Database Additions

## 14.1 Enrichment runs table

```sql
create table if not exists enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  item_type text not null,
  status text not null default 'pending',
  limit_count integer,
  force_refresh boolean default false,
  dry_run boolean default false,
  filter jsonb,
  started_at timestamptz default now(),
  finished_at timestamptz,
  error text,
  created_at timestamptz default now()
);
```

---

## 14.2 Enrichment run items table

```sql
create table if not exists enrichment_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references enrichment_runs(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  lemma text,
  status text not null default 'pending',
  result jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);
```

---

# 15. Feature Flags

The orchestrator should support feature flags.

Initial active flags:

```json
{
  "enable_ordbokene": true,
  "enable_naob": true,
  "enable_wiktionary": false,
  "enable_lexin": false,
  "enable_sprakradet": false,
  "enable_verification_resolver": true,
  "enable_semantic_audit": true,
  "update_catalog": true
}
```

This allows new source workers to be added without changing the orchestrator contract.

---

# 16. Error Handling

A failed source must not fail the whole enrichment process unless it is critical.

Example:

```text
Ordbokene succeeds
NAOB fails
```

Result should be:

```text
partial enrichment completed
naob_error logged
verification resolver still runs using available evidence
```

Each source result should have:

```text
status
diagnostic_status
confidence
error
updated_at
```

---

# 17. Idempotency

The orchestrator must be idempotent.

Repeated run with the same input should not duplicate data.

Rules:

```text
Do not create duplicate expression records.
Do not create duplicate source checks.
Do not duplicate article relations.
Do not overwrite newer manual corrections unless force_refresh = true.
```

---

# 18. Manual Overrides

Manual review must be protected.

Fields such as:

```text
manual_review_status
manual_expression_structure
manual_expression_semantics
manual_notes
```

should override automated results when present.

The automated pipeline can still write:

```text
suggested_expression_structure
suggested_expression_semantics
suggested_review_status
```

But final catalog fields should respect manual overrides.

---

# 19. Recommended Implementation Order

## Phase 1 — Orchestrator skeleton

Create:

```text
authoritative-enrichment-pipeline-worker
```

Support:

```text
single expression input
single lexeme input
force_refresh
update_catalog
feature flags
```

Call existing:

```text
ordbokene-lexeme-pipeline-worker
naob-pipeline-worker
```

---

## Phase 2 — Verification resolver

Create:

```text
verification-resolver-worker
```

Input:

```json
{
  "item_type": "expression",
  "item_id": "uuid",
  "source_evidence": {}
}
```

Output:

```json
{
  "review_status": "verified",
  "confidence": 0.92,
  "reason": "Confirmed by Ordbokene expr_entry and NAOB uttrykk"
}
```

---

## Phase 3 — Semantic audit integration

Connect existing:

```text
semantic-audit-worker
```

Expected output:

```json
{
  "expression_structure": "support_verb_construction",
  "expression_semantics": "collocation",
  "confidence": 0.84,
  "reason": "Support verb pattern with nominal object and preposition"
}
```

---

## Phase 4 — Batch runner

Create:

```text
enrichment-batch-runner
```

Supports controlled batch runs.

---

## Phase 5 — Mass run

Start with:

```text
source_ordbokene = true
naob_status is null
limit 20
dry_run true
```

Only after logs are clean, increase to:

```text
limit 100
```

Then full run.

---

# 20. What Not To Do Now

Do not start full mass enrichment yet.

Do not rewrite Ordbokene pipeline.

Do not rewrite NAOB pipeline.

Do not merge semantic audit into source workers.

Do not mix source evidence and internal analytics in one field.

Do not return to a monolithic text analyzer.

Do not process single words before expressions.

---

# 21. Final Target Architecture

```text
TEXT
↓
expression-detector
↓
authoritative-enrichment-pipeline-worker
    ├─ ordbokene-lexeme-pipeline-worker
    ├─ naob-pipeline-worker
    ├─ wiktionary-pipeline-worker
    ├─ lexin-pipeline-worker
    └─ sprakradet-pipeline-worker
↓
verification-resolver-worker
↓
semantic-audit-worker
↓
catalog-update-worker
↓
single-lexeme-detector
↓
authoritative-enrichment-pipeline-worker
↓
verification-resolver-worker
↓
catalog-update-worker
↓
learning layer
```

Main rule:

```text
Expressions first.
Lexemes second.
Authoritative evidence separate from internal analytics.
Verification resolution separate from source workers.
Semantic audit separate from source evidence.
```

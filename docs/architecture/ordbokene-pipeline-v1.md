# Ordbokene Pipeline v1

## Purpose

This pipeline enriches one lexeme from Ordbokene authoritative data.

It is not a monolithic analyzer.

The architecture is:

admin / background request
→ orchestrator
→ small specialized workers
→ shared database state
→ audit summary

## Main Pipeline

### Step 1 — Fetch article

Function:

`ordbokene-article-fetcher`

Input example:

```json
{
  "article_id": 59502,
  "dictionary_code": "bm"
}
Writes to:

ordbokene_article_cache

Result:

Full Ordbokene article JSON is cached.

Step 2 — Extract expressions

Function:

ordbokene-expression-extractor

Reads from:

ordbokene_article_cache

Extracts:

sub_article

Writes to:

ordbokene_expression_candidates

Initial status:

candidate

Step 3 — Promote expressions

Function:

ordbokene-expression-promotion-worker

Reads from:

ordbokene_expression_candidates

Writes to:

expression_catalog

Updates candidate status:

candidate → promoted

or

candidate → duplicate

Step 4 — Create has_expression relations

Function:

ordbokene-sub-article-relation-worker

Creates:

lexeme → has_expression → expression

Writes to:

authoritative_semantic_relations

Example result for gå:

59 has_expression

Step 5 — Extract article_ref relations

Function:

ordbokene-article-ref-relation-worker

Reads:

article_ref from full Ordbokene JSON.

Creates:

related_candidate

Examples:

gå → dø

gå → fungere

gå → utløpe

Important:

These are not verified synonyms.

They are conservative semantic candidates.

Default relation values:

relation_type = related_candidate
source = Ordbokene
confidence = high
status = candidate
Step 6 — Resolve relation targets

Function:

relation-resolver

Resolves relations where possible.

Example unresolved state:

target_text = dø
target_entity_id = null

Resolver tries to find target in:

lexemes
expression_catalog

Resolved state:

target_text = dø
target_entity_type = lexeme
target_entity_id = ...
Step 7 — Audit semantic quality

Function:

semantic-audit-worker

Checks:

broken relations
unresolved targets
duplicates
cycles
conflicts
suspicious semantic links
Current Ordbokene Pipeline v1
job-orchestrator
        │
        ▼
ordbokene-article-fetcher
        │
        ▼
ordbokene-expression-extractor
        │
        ▼
ordbokene-expression-promotion-worker
        │
        ▼
ordbokene-sub-article-relation-worker
        │
        ▼
ordbokene-article-ref-relation-worker
        │
        ▼
relation-resolver
        │
        ▼
semantic-audit-worker
Relationship to lexical-worker

lexical-worker belongs to the lexical verification branch.

It works with:

lexemes
source checks
verification
NAOB
Wiktionary
Ordbokene

Logical position:

lexical verification
→ semantic enrichment

So lexical-worker is upstream from the semantic relation layer.

Relationship to analyze-text

analyze-text is a user-facing text analyzer.

It should:

tokenize text
resolve known forms / lexemes / expressions
return a user-facing analysis
optionally enqueue background enrichment jobs

It should not become a monolithic enrichment worker.

Architecture Rule

Do not return to one large monolithic function.

Correct:

one entry
→ orchestrator
→ specialized workers
→ shared tables
→ audit summary

Incorrect:

analyze-text
→ does tokenization
→ does source fetch
→ does verification
→ does expression extraction
→ does promotion
→ does semantic relations
→ does UI result
Current tested lexemes
gå

Completed:

article fetch
expression extraction
expression promotion
has_expression
article_ref → related_candidate

Known result:

has_expression = 59
related_candidate = 22
derived_candidate = 1
ta

Completed:

article fetch
expression extraction
expression promotion
article_ref → related_candidate

Known result:

expression candidates = 23
promoted = 18
duplicate = 5
related_candidate = 1

Pending:

has_expression relations for ta
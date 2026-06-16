# ADR-0016 — Ordbokene Morphology Resolution

## Status

Accepted

---

## Context

The project needs reliable morphology resolution:

```text
surface form
→ lemma
Examples:

gikk → gå
gått → gå
gleder → glede
huset → hus
husene → hus
barnet → barn
barna → barn
alvorlige → alvorlig
alvorligere → alvorlig

Earlier approaches relied on local heuristics, such as:

tar → ta
gleder → glede
-r / -er suffix stripping
manual irregular verb lists

These heuristics are useful for lightweight ingestion but are not authoritative and may produce false positives.

Example risk:

lærer

can be both a noun and a verb form, so regex-based normalization can easily over-normalize.

Discovery

Diagnostic tests against Ordbokene showed that the API already supports morphology resolution.

The key endpoint pattern is:

/api/articles?w={surface_form}&dict=bm,nn&scope=i

When a queried form is an inflected form, scope=i returns article IDs of the corresponding lemma.

Examples:

gikk
→ articlesInflected.bm includes article id for gå
gått
→ articlesInflected.bm includes article id for gå
gleder
→ articlesInflected includes article ids for glede
huset / husene
→ articlesInflected includes article id for hus
barnet / barna
→ articlesInflected includes article id for barn
alvorlige / alvorligere
→ articlesInflected includes article id for alvorlig

The suggest endpoint also exposes useful morphology hints:

suggest.a.inflect

Examples:

gikk → gå
gått → gå
gleder → glede
alvorlige → alvorlig
alvorligere → alvorlig
huset → hus
barnet → barn
Decision

Ordbokene becomes the primary authoritative source for morphology resolution.

The project should prefer Ordbokene morphology data over regex-based morphology heuristics when authoritative resolution is needed.

Resolution Strategy
Fast path

Use:

/api/suggest?q={surface_form}&dict=bm,nn&include=eif&n=20

If suggest.a.inflect contains candidate lemma forms, store them as morphology candidates.

Authoritative path

Use:

/api/articles?w={surface_form}&dict=bm,nn&scope=i

If article IDs are returned, treat them as authoritative evidence that the surface form maps to lemma article(s).

Exact-entry nuance

A surface form may be both:

an independent dictionary entry

and

an inflected form of another lemma

Example:

går

The API may return both:

articlesExact

and:

articlesInflected

Therefore morphology resolution must not rely only on:

articlesExact = empty

The system must check scope=i and/or suggest.a.inflect explicitly.

Relation to Ingestion

normalize_ingestion_token() may remain as a lightweight deterministic pre-normalization layer for expression matching.

However, it must not be treated as authoritative morphology.

Authoritative morphology should come from Ordbokene.

The current ingestion heuristic:

gleder → glede
tar → ta

is acceptable for matching known expressions during ingestion, but it is not a substitute for source-based morphology resolution.

Planned Pipeline

Future morphology-resolution flow:

surface token
↓
Ordbokene suggest.a.inflect
↓
Ordbokene scope=i article IDs
↓
resolve to existing lexeme/expression if possible
↓
store morphology evidence
↓
optionally retry verification on resolved lemma
Storage Model

Future storage may use:

lexeme_form_variants

or a dedicated table:

morphology_resolution_candidates

Possible fields:

id
surface_form
normalized_surface_form

resolved_lemma
resolved_lexeme_id

source
source_article_ids
source_payload

confidence
status

created_at
updated_at
Important Constraints

The morphology resolver must not:

invent lemmas
use AI as source of truth
overwrite verification status
auto-create trusted lexemes

It may:

suggest lemma candidates
resolve to existing lexemes
create auditable morphology evidence
trigger re-verification of resolved lemma
Consequences

Benefits:

more accurate text analysis
better handling of inflected forms
less dependence on regex heuristics
support for irregular verbs
support for nouns, verbs, and adjectives
official source-backed morphology

Tradeoffs:

additional API calls
need for caching
need to handle ambiguous forms
need to distinguish exact entries from inflected forms
Follow-up Work
Implement an Ordbokene morphology resolver.
Store suggest.a.inflect and scope=i evidence.
Connect morphology resolution to token verification.
Revisit and reduce local regex heuristics after source-backed morphology is stable.
Add cache versioning for morphology lookups.
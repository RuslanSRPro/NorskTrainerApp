# ADR-0017 — Ordbokene Full Article Structured Extraction

## Status

Accepted

---

## Context

Previous Ordbokene integration used:

```text
/api/articles?w={query}&dict=bm,nn&scope=e
/api/articles?w={query}&dict=bm,nn&scope=i
/api/suggest?q={query}&dict=bm,nn&include=eif&n=20
These endpoints provide:

exact article IDs
inflected-form article IDs
exact suggestions
morphology hints through suggest.a.inflect

However, they do not provide the full article body.

A diagnostic investigation confirmed that Ordbokene exposes full article JSON through:

https://ord.uib.no/{dict}/article/{article_id}.json

Examples:

https://ord.uib.no/bm/article/21740.json
https://ord.uib.no/bm/article/1440.json
https://ord.uib.no/bm/article/57372.json

This endpoint returns a rich structured dictionary article.

Discovery

The full article payload contains:

article_id
lemmas
inflection_class
paradigm_info
body
pronunciation
etymology
definitions
examples
article_ref references
referers
sub_article entries
word_class for sub-articles

This changes the architecture of Ordbokene integration.

Ordbokene is not only a verification source.

It is a structured authoritative lexical graph source.

Morphology

Full article JSON contains complete normative paradigms:

lemmas[].paradigm_info[].inflection[]

Each inflection entry contains:

tags
word_form

Examples:

gå
går
gikk
gått
alvorlig
alvorlige
alvorligere
alvorligst
alvorligste
stor
stort
store
større
størst
største

This confirms that Ordbokene can be used as the primary source for authoritative morphology.

Regex-based morphology reconstruction and Gemini-generated forms are no longer acceptable as primary sources.

Definitions and Examples

Definitions are stored under:

body.definitions

The structure is recursive.

Common node types include:

definition
explanation
example

Examples are structured as:

type_: example
quote.content
quote.items
explanation.content

The quote may contain $ placeholders with corresponding usage items.

This requires a renderer/extractor that can reconstruct readable example text from:

content + items
Semantic Relations

Definitions contain structured references:

article_ref

Each article_ref may include:

article_id
lemmas[].lemma
definition_id
definition_order

These are direct semantic links to other dictionary articles.

This is more reliable than regex extraction from HTML.

Relation Type Markers

In the same items array, Ordbokene may include entity markers before article_ref objects.

Examples:

mots
jf
el

Interpretation:

mots → antonym_candidate
jf   → related_candidate / compare_candidate
el   → alternative_candidate

If no explicit marker exists, relation type should remain conservative:

related_candidate

or be classified later by a semantic audit worker.

The relation extraction logic must preserve the raw marker.

Etymology Relations

The article body may include structured etymology nodes:

body.etymology

Etymology items may contain:

language
usage
relation
article_ref

When article_ref is present, this creates a source-backed etymological relation.

Example relation types:

etymology_reference
derived_from_candidate
historical_related_candidate

These must be stored separately from semantic synonym/antonym relations.

Sub-Articles / Expressions

The article body may contain:

type_: sub_article

Sub-articles include:

article_id
lemmas
article.word_class = EXPR
article.body.definitions
article.referenced_by

This provides a structured authoritative source for registered expressions.

Examples discovered from adjective/verb articles include:

gå ut
gå over
gå tilbake
stort sett
se stort på
gjøre store øyne
være stor i kjeften
i det store og hele

Sub-articles should be extracted as expression candidates.

They must not be blindly promoted to trusted application entries without deduplication and audit.

Referers

Full articles may include:

referers

Referers represent reverse links: other dictionary articles that reference the current article.

These can be used to build a reverse semantic graph.

Referers should be stored as reverse relation evidence, not as primary relation extraction unless confirmed.

Decision

Introduce Ordbokene full-article structured extraction.

This extraction should be implemented separately from the existing verification worker.

Verification answers:

Does this lexical unit exist?

Full article extraction answers:

What structured authoritative information exists for this unit?

These responsibilities must remain separated.

New Worker

Planned worker:

ordbokene-article-enrichment-worker

Responsibilities:

article_id
↓
fetch /{dict}/article/{article_id}.json
↓
extract morphology
↓
extract definitions
↓
extract examples
↓
extract article_ref relations
↓
extract sub_article expression candidates
↓
extract etymology references
↓
store normalized enrichment
Storage Targets

Possible storage targets:

authoritative_enrichment
lexeme_form_variants
semantic_relations
expression_catalog_candidates
ordbokene_article_cache

Recommended first implementation:

ordbokene_article_cache

Then derive:

morphology candidates
semantic relation candidates
expression candidates
definition/example enrichment

from cached article payloads.

Important Constraints

The worker must not:

modify verification status directly
auto-trust imported expressions
overwrite human-reviewed entries
replace semantic audit

The worker may:

store article payloads
create candidate relations
create candidate expressions
store authoritative morphology evidence
store definitions and examples
Relation to NAOB Extraction

NAOB relation extraction currently relies more heavily on HTML/text pattern extraction.

Ordbokene full article extraction should be preferred where available because it is structured JSON.

Priority order for structured extraction:

Ordbokene full article JSON
NAOB structured/API data if available
HTML/text extraction only as fallback
Relation to Gemini

Gemini must not generate morphology or dictionary facts when Ordbokene provides them.

Gemini may later assist with:

learner-friendly explanations
translations
simplified examples
CEFR estimates
topic grouping

But not as source of lexical truth.

Follow-up Work
Implement ordbokene_article_cache.
Implement article fetcher by article_id and dict.
Implement recursive JSON traversal utilities.
Extract paradigm_info.inflection into form variants.
Extract article_ref into semantic relation candidates.
Extract sub_article into expression candidates.
Extract definitions and examples into authoritative enrichment.
Add cache versioning for full article payloads.
Add audit/deduplication before promoting expression candidates.


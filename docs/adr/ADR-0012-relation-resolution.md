# ADR-0012 — Relation Resolution

## Status

Accepted

---

## Context

The semantic relation pipeline extracts authoritative relation candidates from trusted linguistic sources such as:

- NAOB
- Ordbokene
- Språkrådet

Examples:

- avledet av
- sammensetning av
- parenthetical expression variants
- related references

Extracted relations are stored in:

authoritative_semantic_relations

Initially relations are stored as unresolved candidates:

- target_text populated
- target_entity_id = null
- status = 'candidate'

Example:

```text
ta ansvar for
    ->
related_candidate
    ->
ta ansvar
Decision
Resolver behavior

Relation resolution must:

use deterministic matching only
resolve only against existing catalog entities
never create new entities automatically
never use AI-generated matching
never hallucinate semantic relations

Current resolution strategy:

normalize target_text
exact match against:
expression_catalog.normalized_key
lexemes.lemma
if exact match found:
set target_entity_type
set target_entity_id
set status = 'resolved'
otherwise:
keep status = 'candidate'
Important Principle

Unresolved candidate != error

A relation candidate may remain unresolved because:

the target expression does not yet exist in catalog
the catalog is incomplete
the relation points to a future entity

This is expected system behavior.

Example:

ta ansvar

may legitimately remain unresolved until the expression is added to expression_catalog.

Architectural Constraints

The resolver must NOT:

create lexemes
create expressions
generate semantic guesses
use embeddings
use fuzzy AI similarity
auto-merge entities

Semantic integrity is prioritized over aggressive auto-linking.

False semantic links are considered more dangerous than unresolved candidates.

Future Extensions

Possible future improvements:

alias resolution layer
variant mapping
inflection-aware matching
canonical semantic units
approved synonym resolution

However:

all future matching layers must remain deterministic and auditable.

Consequences

Benefits:

semantic graph remains trustworthy
relations remain traceable to authoritative evidence
no AI hallucinated semantic edges
candidates can safely accumulate before catalog growth

Tradeoff:

some relations remain unresolved longer
graph completeness grows gradually over time

This tradeoff is intentional.
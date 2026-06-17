# ADR-0018: Sense-Level Synonym Strategy

## Status

Accepted (Provisional)

## Date

2026-06

## Context

During the analysis of Ordbokene semantic references (`article_ref`), it was discovered that many references point to lexemes or expressions that are semantically close to a specific meaning of the source lexeme.

Examples:

* gå bort → dø
* gå fra vettet → miste vettet
* gå ut (om kontrakt) → utløpe
* det går → fungere

The lexeme "gå" has many unrelated meanings:

* walk
* function
* expire
* fit / contain
* die (in specific expressions)

Therefore semantic relations cannot automatically be interpreted as global lexeme-level synonymy.

## Decision

Synonymy must be evaluated at the sense level or expression level, not at the lexeme level.

Valid examples:

* gå bort ↔ dø
* gå fra vettet ↔ miste vettet
* gå ut (om kontrakt) ↔ utløpe

Invalid examples:

* gå ↔ dø
* gå ↔ utløpe

without additional sense-level evidence.

## Ordbokene Article References

At the current stage all article_ref relations are stored as:

relation_type = related_candidate

with:

* source = Ordbokene
* confidence = high
* status = candidate

Reason:

The semantic connection is strongly supported by a structured authoritative source, but the exact relation type (synonym, related term, see-also, alternative expression, etc.) has not yet been validated across all authoritative sources.

## Expression-Level Relations

Expression-level relations are considered more reliable than lexeme-level relations.

Examples:

* gå bort ↔ dø
* gå fra vettet ↔ miste vettet
* gå i vasken ↔ mislykkes
* gå av stabelen ↔ finne sted

Future semantic processing should prefer expression-level relation extraction whenever sufficient evidence exists.

## Future Validation

After semantic relation extraction has been implemented for all authoritative sources:

* Ordbokene
* NAOB
* Wiktionary
* Additional authoritative sources

candidate relations may be promoted to:

* verified_synonym
* verified_related
* antonym
* see_also
* alternative_expression

based on multi-source agreement.

## Rationale

This strategy:

* preserves all extracted semantic information;
* avoids false synonym assignments;
* supports highly polysemous Norwegian lexemes;
* scales naturally to expression-based learning;
* allows later confidence calibration using multiple authoritative sources.

## Consequences

Current workflow:

article_ref
→ related_candidate

Future workflow:

related_candidate
→ verified_synonym

or

related_candidate
→ verified_related

after cross-source validation.

This ADR applies to all future semantic relation extraction workers.
### Semantic Relations Roadmap

* [x] Ordbokene sub-article extraction
* [x] Expression promotion pipeline
* [x] has_expression relations
* [x] Ordbokene article_ref discovery
* [x] Sense-level synonym strategy adopted

Next:

* [ ] Implement ordbokene-article-ref-relation-worker
* [ ] Extract article_ref relations for all cached Ordbokene articles
* [ ] Resolve target lexemes automatically
* [ ] Resolve target expressions automatically
* [ ] Compare semantic relations across Ordbokene, NAOB and Wiktionary
* [ ] Introduce verified_synonym promotion rules
* [ ] Introduce verified_related promotion rules

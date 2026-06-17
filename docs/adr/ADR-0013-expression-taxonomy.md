# ADR-0013 — Expression Taxonomy and Promotion Boundaries

## Status

Accepted

## Context

The Ordbokene sub_article extraction pipeline proved that authoritative dictionary articles can produce many usable expression candidates.

For the article `gå`:

- 63 sub_article candidates were extracted
- 55 were promoted to `expression_catalog`
- 4 were detected as duplicates
- 4 were intentionally left as candidates for future formula/phrase handling

The extraction showed that Ordbokene marks many different linguistic units uniformly as:

- `word_class = EXPR`
- `article_type = SUB_ARTICLE`

Therefore `word_class/article_type` alone is not enough to decide whether a candidate belongs in `expression_catalog`.

The extracted candidates include several different linguistic classes:

- idioms
- phrasal verbs
- prepositional verbs
- nominal idioms
- pragmatic formulas
- interrogative formulas
- command interjections
- discourse formulas

A single binary classifier such as `expression` vs `sentence_phrase` is not sufficient for long-term data quality.

## Decision

We define a project-level expression taxonomy.

### 1. Allowed in `expression_catalog` v1

The following units may be promoted into `expression_catalog`:

#### idiom

Fixed or semi-fixed expression with non-literal or partly non-compositional meaning.

Examples:

- `gå fløyten`
- `gå i vasken`
- `gå fra vettet`
- `gå av stabelen`

#### phrasal_verb

Verb + particle/adverb/preposition where the meaning may be lexicalized or hard to infer from components.

Examples:

- `gå bort`
- `gå inn`
- `gå ut`
- `gå ned`
- `gå opp`

Short two-token phrasal expressions are allowed, but must be marked with higher review priority.

#### prepositional_verb

Verb + preposition or prepositional pattern.

Examples:

- `gå med på`
- `gå inn for`
- `gå ut over`
- `gå opp for`

#### nominal_idiom

Fixed nominal phrase or pronoun-based nominal expression functioning like a noun phrase.

Examples:

- `noe å gå på`
- `noe som går`

#### fixed_expression

General fixed expression that does not fit more specific categories yet but is suitable for learning and lookup.

Examples:

- `la gå at`
- `som en går og står`

### 2. Not promoted to `expression_catalog` v1

The following should remain as candidates or move later to a separate formula/phrase catalog:

#### pragmatic_formula

Formulaic utterance used as a conversational reaction or speech act.

Examples:

- `den går ikke!`

#### interrogative_formula

Fixed idiomatic question or rhetorical question.

Examples:

- `hva går det av deg?`

#### command_interjection

Command-like interjection, often domain-specific.

Examples:

- `la gå!`

#### discourse_formula

Formulaic discourse marker or transition phrase.

Examples:

- `så gikk vi da`

## Review Priority

Short phrasal expressions with `token_count <= 2` are valuable but carry higher ambiguity and duplicate risk.

They may be promoted, but must be marked as:

- `review_priority = high`
- `review_reason = Short phrasal expression: valuable but higher duplicate/ambiguity risk`

Longer expressions normally use:

- `review_priority = normal`

## Verification Semantics

Promotion from Ordbokene sub_article does not mean fully verified by the global verification pipeline.

Promoted entries should use:

- `verification = needs_review`
- `verification_status = candidate`
- `verification_tier = candidate`
- `source_ordbokene = true`
- `source_gemini = false`

The Ordbokene source evidence must be preserved in:

- `raw_sources`
- `verification_evidence`

Norwegian dictionary definitions must not be stored in `notes_ua`.

They should remain in:

- `raw_sources.definition_preview`
- `verification_evidence.definition_preview`

## Source Strategy

This taxonomy is shared across sources.

However, every source requires its own extraction adapter.

### Ordbokene

Primary source for:

- article JSON
- morphology paradigms
- sub_article expressions
- article_ref relations
- referers
- etymology references

### NAOB

Useful for:

- examples
- usage evidence
- semantic relations
- idiomatic usage

NAOB extraction is structurally different and may require HTML/text parsing.

### Wiktionary

Useful as secondary evidence.

Should not be treated as the primary authoritative source for Norwegian expression promotion.

### Lexin

Useful for learner-friendly definitions and translations.

Not the main source for complex expression discovery.

### Språkrådet

Useful for normative language guidance.

Not suitable as a bulk expression extraction source.

### Gemini / AI

May generate candidates or enrich metadata.

AI output is never authoritative evidence by itself.

## Consequences

- `expression_catalog` may contain idioms, phrasal verbs, prepositional verbs, nominal idioms, and fixed expressions.
- Pragmatic formulas, interrogative formulas, command interjections, and discourse formulas remain outside `expression_catalog` v1.
- Ordbokene sub_article promotion is allowed, but promoted entries remain `needs_review`.
- Future source pipelines should reuse this taxonomy but not reuse Ordbokene-specific extraction logic.
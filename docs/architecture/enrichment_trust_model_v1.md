# Enrichment Trust Model v1

## Core Principle

Authoritative source can enrich.
Gemini can complete.
Only verification pipeline can trust.

---

# Trust Model

## Verification Pipeline

Only authoritative verification may assign:

* trusted
* dictionary_entry
* dictionary_match
* component_match
* authoritative

Sources:

* NAOB
* Ordbokene
* Språkrådet
* Lexin
* Wiktionary

---

# AI Responsibilities

## Gemini

Gemini is an enrichment/completion layer.

Gemini MAY:

* generate examples
* generate learner explanations
* generate translations when missing
* classify topics
* create candidate suggestions
* create learning hints

Gemini MUST NOT:

* define authoritative truth
* assign trusted review status
* assign verification tiers
* define canonical legitimacy

---

# OpenAI Responsibilities

OpenAI is reserved for:

* voice analysis
* pronunciation
* tutoring
* speech interaction
* grammar explanations
* conversation feedback

OpenAI is NOT a verification source.

---

# Important Rule

Filled ≠ Verified

Example:

```text id="bdxtaq"
cefr = A2
source = Gemini
confidence = low
```

This improves completeness,
but must not automatically raise learning_confidence.

---

# review_status Invariant

Only semantic-audit-worker may assign:

* trusted
* candidate
* conflicted
* weak

Enrichment workers must never write:

* review_status
* verification_tier
* trusted flags

---

# Trusted Read Layer

Applications should use:

* trusted_lexemes_v1
* trusted_expressions_v1

instead of raw catalog tables.

---

# Candidate Suggestions

Suggestions from:

* NAOB
* Ordbokene
* Gemini

must remain candidate-only until verified.

Examples:

* related forms
* avledet av
* sammensetning av
* semantic suggestions
* synonym candidates

These are NOT canonical truth automatically.

---

# Architectural Separation

Verification determines truth.

Enrichment improves learning experience.

These systems must remain separated.

---

# Anti-Patterns

Avoid:

* monolithic analyze-text logic
* AI-defined trust
* direct AI writes to trusted catalogs
* hidden heuristics
* mixed verification/enrichment responsibilities

---

# Approved Direction

Preferred architecture:

* isolated workers
* queue-based processing
* semantic audit calibration
* authoritative-first verification
* field-level enrichment metadata
* trusted views
* explicit confidence handling

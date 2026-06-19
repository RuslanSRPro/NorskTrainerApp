# NAOB Pipeline V1

## Purpose

NAOB Pipeline V1 adds a second authoritative evidence layer for Norwegian expressions.

It does not replace Ordbokene.

Ordbokene tells us whether an expression exists as an entry or sub-article.
NAOB tells us whether the expression is documented as:

- UTTRYKK
- EKSEMPLER
- not listed in the checked article

## Functions

### naob-article-fetcher

Fetches NAOB search HTML and stores it in:

- naob_article_cache

Main use: debug/search/cache.

### naob-structure-extractor

Input:

```json
{
  "expression_lemma": "legge merke til",
  "source_lemma": "merke",
  "naob_slug": "merke_2",
  "force_refresh": false,
  "update_catalog": true
}
Responsibilities:

fetch/cache NAOB article by slug
parse HTML
detect UTTRYKK / EKSEMPLER / not_found
save evidence to naob_expression_evidence
optionally update expression_catalog

Detected values:

naob_status:
  uttrykk
  example
  not_found

Diagnostic values:

diagnostic_status:
  matched_uttrykk
  matched_example
  expression_found_unstructured
  expression_not_found_in_article
naob-expression-batch-worker

Tries multiple NAOB slugs for one expression.

Important rule:

Intermediate attempts must not update expression_catalog.

Only the final successful match may update expression_catalog.

Confirmed examples
ta hensyn til
naob_slug = ta_2
naob_status = example
diagnostic_status = matched_example
legge merke til
naob_slug = merke_2
naob_status = uttrykk
diagnostic_status = matched_uttrykk
ha ansvaret for / ha besøk av / ha betydning for
naob_status = not_listed
diagnostic_status = expression_not_found_in_article
expression_structure = support_verb_construction
expression_semantics = collocation
expression_review_status = partial
Design rule

NAOB evidence is source evidence.

It must be stored separately from Norsk Trainer analytical classifications.

Do not overwrite expression_structure or expression_semantics from NAOB automatically.



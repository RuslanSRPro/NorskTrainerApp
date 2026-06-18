# Expression Model V2

## Background

During Ordbokene Pipeline V1 development we investigated how Norwegian authoritative sources classify expressions.

The original assumption was that Ordbokene or NAOB would provide a reusable taxonomy such as:

* particle_verb
* prepositional_verb
* support_verb_construction
* idiom
* collocation

Research showed that this assumption is incorrect.

---

# Findings

## Ordbokene

Ordbokene provides only a single expression category:

```text
EXPR = uttrykk
```

No official distinction exists between:

* particle verbs
* prepositional verbs
* idioms
* collocations
* support verb constructions

The most important signal from Ordbokene is therefore:

```text
Does the expression have its own article?
```

Examples:

```text
ta hensyn til
```

has its own article:

```text
article_id = 102701
```

This is evidence of lexicalization.

---

## NAOB

NAOB provides a different type of signal.

Expressions may appear as:

```text
UTTRYKK
```

or

```text
EKSEMPLER
```

### UTTRYKK

Expression receives its own definition.

This is strong evidence of lexicalization.

Examples:

* legge merke til
* gjøre rede for
* ta initiativ til

### EKSEMPLER

Expression appears only as an example under a broader meaning.

This is evidence of productive usage rather than independent lexicalization.

Examples:

* ta hensyn til
* ta del i
* ta sikte på
* ta kontakt med

---

# Design Principle

Different sources describe different aspects of the same object.

These aspects must not be merged into a single field.

---

# Expression Dimensions

## Dimension 1: Ordbokene Status

Column:

```text
ordbokene_status
```

Values:

```text
expr_entry
sub_article
not_listed
```

Meaning:

* expr_entry = standalone article exists
* sub_article = extracted from parent article
* not_listed = not found

---

## Dimension 2: NAOB Status

Column:

```text
naob_status
```

Values:

```text
uttrykk
example
not_listed
```

Meaning:

* uttrykk = own definition
* example = usage example only
* not_listed = not found

---

## Dimension 3: Structural Classification

Column:

```text
expression_structure
```

Values:

```text
particle_verb
prepositional_verb
support_verb_construction
reflexive_construction
multiword_fixed
```

This is Norsk Trainer linguistic analysis.

It does not come directly from Ordbokene or NAOB.

---

## Dimension 4: Semantic Classification

Column:

```text
expression_semantics
```

Values:

```text
idiom
collocation
conversation_phrase
discourse_marker
```

This is Norsk Trainer semantic analysis.

It does not come directly from Ordbokene or NAOB.

---

# Review Status

Column:

```text
expression_review_status
```

Values:

```text
verified
partial
unverified
disputed
```

Meaning:

* verified = confirmed by multiple sources
* partial = confirmed by one source
* unverified = automatic classification only
* disputed = conflicting evidence

---

# Examples

## ta hensyn til

```text
ordbokene_status       = expr_entry
naob_status            = example
expression_structure   = support_verb_construction
expression_semantics   = collocation
expression_review_status = partial
```

## legge merke til

```text
ordbokene_status       = sub_article
naob_status            = uttrykk
expression_structure   = support_verb_construction
expression_semantics   = collocation
expression_review_status = verified
```

## slå to fluer i én smekk

```text
ordbokene_status       = sub_article
naob_status            = uttrykk
expression_structure   = multiword_fixed
expression_semantics   = idiom
expression_review_status = verified
```

---

# Architectural Rule

Ordbokene and NAOB are sources of evidence.

Norsk Trainer classification must never overwrite source evidence.

Source evidence and derived analysis must remain separate.

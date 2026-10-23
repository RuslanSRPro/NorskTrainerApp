# Graph-first morphology boundary

Status: user-corrected architecture requirement; implementation and runtime proof OPEN.

## Direction of evidence

1. Surface tokens and lexical/POS possibilities enter as candidates, including ambiguous readings. A dictionary form match may suggest a candidate but cannot by itself prove adjective POS or determine the grammar rule.
2. Independent grammatical evidence evaluates the adjective reading: syntactic slot, agreement controller, degree context, and applicable rule conditions. If evidence is insufficient or conflicts, the graph abstains.
3. Given an accepted adjective reading, lemma/class features and an applicable grammar rule, the graph derives the expected form. The rule records its source, version, conditions and derivation steps.
4. Observed dictionary forms may be compared with the derived form after the derivation. A mismatch is a diagnostic, an exception candidate or a reason to abstain; the stored target must not choose the rule or become the derivation result.
5. Reverse analysis starts with a surface form but returns possible lemma/class/rule derivations. It cannot treat a dictionary surface match as sufficient proof of POS or a unique lemma.

## Current mismatch

`dispatch_morphological_rules_v3` uses selected lemma/POS or a source-form lookup to find a lexeme, then reads both source and target from `lexeme_form_variants` before deciding whether a rule matches. That relation currently has zero Production rows, while `lexeme_form_display_v2` holds source forms under different keys. Merely redirecting the old executor to the display table would preserve the circular target lookup and is **not** the repair.

## Required proof before runtime repair

- Identify a source-backed adjective rule with a fully specified operation, conditions and class features; distinguish primary rules from post-transform adjustments.
- Provide an adjective POS hypothesis independently of a target-form match, with an explicit ambiguous case.
- Derive at least one regular form from the rule without reading the target from any form table. Test a nonapplicable context and an irregular exception.
- Only after derivation, compare with source forms using lexeme/article provenance. Record match, mismatch or no source observation without changing the computed result.
- Check forward generation, reverse candidate analysis, explanation and repeatability. Preserve alternate and same-POS lexeme identities.

Current state: contract only. No claim that the existing twelve adjective release members satisfy this boundary.

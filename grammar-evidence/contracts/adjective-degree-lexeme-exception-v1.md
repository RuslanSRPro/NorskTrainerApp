# Adjective degree: per-lexeme exception decision v1

Scope: the comparative `-el/-en/-er` deletion rule for one identified adjective lexeme. A derived form remains a **candidate** until this decision is supported by independent source evidence. This contract does not activate a rule or publish a graph result.

## Input identity

- `lexeme_id`, `lemma`, `pos=adjective`, `dictionary_code`, `article_id`, `snapshot_id` and positive-form source evidence must match the row used for derivation.
- `rule_source_candidate_id` identifies the proposed default rule. The decision must name the same rule and lexeme.
- `source_evidence_ids` identify source passages that explicitly establish the paradigm class or an exception. A stored comparative form, `regularity_marker=unknown`, an absent exception row, or the rule's own output cannot establish this decision.

## Decision

`class` is one of `regular_confirmed`, `irregular_confirmed`, `unknown`, or `conflict`.

- `regular_confirmed`: an independent, article-bound source explicitly licenses this default for the lexeme. Only this class can clear `exceptionCheckRequired`, after source identity and rule applicability have passed.
- `irregular_confirmed`: an independent source identifies a conflicting paradigm or lexical exception. Suppress the default candidate; evaluate an appropriate separately admitted irregular rule.
- `unknown`: no sufficient independent class evidence. Keep the derived form as a candidate with `exceptionCheckRequired=true`.
- `conflict`: sources disagree, identity is ambiguous, evidence is stale, or more than one incompatible decision matches. Keep the candidate unadmitted and request review.

The decision record must include `decision_id`, `lexeme_id`, `rule_source_candidate_id`, `class`, `source_evidence_ids`, `dictionary_code`, `article_id`, `snapshot_id`, `reviewed_at`, and `source_revision`. For a non-unknown class, the evidence list must be nonempty and traceable to a specific source passage. Changes to identity, source revision, rule, or snapshot invalidate the decision. A mismatch fails closed.

## Current scoped result

The Production response for `åpen` on 2026-10-24 returned `candidate=åpnere` and `exceptionCheckRequired=true`. No verified per-lexeme exception decision was available. Its class is therefore `unknown`; the candidate is neither admitted nor activated. The next proof must attach an independent source passage to the exact `åpen` article and test both regular and irregular paths without reading the stored comparative answer as a classifier.

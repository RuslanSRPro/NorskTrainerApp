# Future analyze-text / Grammar Graph interface

Status: USER_REQUIREMENT, clarified boundary; integration not implemented or authorized for current app flow.

## Purpose

The graph must support three directions: identify word readings and cards in context; analyze a complete sentence and explain applicable rules; generate or verify a sentence and word forms from rules. These directions share one token-reading format.

## Input per sentence

- Ordered tokens with surface, position and following punctuation.
- Every lexical/form candidate, preserved separately: `lexeme_id`, `lemma`, `pos`, `homograph_key`, `form_key`, form provenance and article IDs. Candidates of the same POS remain separate (for example bok I / bok II and være I / være III).
- Function words carry a function-word marker.
- Inputs can be submitted as a batch of sentences for one text.

## Output

- Per-token candidate readings with rule ID, source section, evidence strength (`hard` or `soft`), short explanation and recommendation `chosen`, `preferred` or `ambiguous`. An ambiguous result preserves candidate order. The parser owns final candidate selection.
- Sentence structure and applied-rule explanations; graph and rule versions.
- Deterministic output from the same input, without AI calls.
- Measured milliseconds per sentence and a whole-text batch call.

## Boundaries

- Analyze-text uses only source-provided forms in its current workflow. A missing source form means no input reading, not a fabricated candidate. The graph's separate bidirectional generation/verification capability may derive forms from proved rules, but does not add candidates to this analyze-text input/output path.
- The graph annotates candidates; it does not delete, insert or merge them at this interface.
- A source default with exceptions yields `preferred` or `ambiguous`, never a hard elimination by itself.
- Integration with analyze-text is future work. An internal shadow call may run before full rule activation after its own isolation, failure and performance checks. Its evidence and discrepancies stay in service-only diagnostics and cannot alter or appear in the app response. The existing user gate still bars graph-derived user-visible results or candidate-order changes until the required rule-activation condition is met. Later ordering/card changes need separate proof and authorization.

## Joint acceptance corpus

| Input | Expected evidence |
| --- | --- |
| Vinterjakka henger på kroken | `henger` supports verb `henge`, not noun. |
| Det var kaldt i går | `var` supports preterite `være`, not noun `var`. |
| Jeg brenner ved | `ved` supports noun firewood, not preposition. |
| Han leser en bok / Det står en bok i skogen | bok I and bok II remain `ambiguous` without sufficient context. |
| Hunden værer noe | `værer` supports være III (smell), not være I. |
| Jeg brenner ved | `brenner` supports verb `brenne`, not noun. |
| Fisken spiser hunden | Subject/object remain `ambiguous` without independent evidence. |

## Future rollout requested by analyze-text team

1. Internal shadow call and discrepancy logging with no user-facing behavior change, after isolation, failure and performance checks. This does not depend on permission to publish graph results to the app.
2. Evidence may reorder existing candidates.
3. Stop collapsing same-POS cards only after identity and ambiguity tests pass.

No callable function name or production endpoint is asserted here. Add one only after the interface, provenance, determinism, latency, batch and output-isolation tests pass.

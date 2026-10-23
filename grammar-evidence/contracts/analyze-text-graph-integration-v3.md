# Future analyze-text / Grammar Graph interface

Status: USER_REQUIREMENT, clarified early-use objective; integration not implemented.

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
- The user wants the earliest useful use of Grammar Graph. A blanket all-rules activation gate does not apply. A bounded internal shadow call may run after isolation, failure and performance checks. Once a specific capability has source-backed evidence, a reproducible acceptance corpus, an explicit abstain/ambiguous behavior, versioned provenance, safe rollout and rollback, it may be exposed to analyze-text and the app for that capability. The parser owns final candidate selection. Do not imply that graph-generated claims are reliable outside the proved capability.

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

1. Internal shadow call and discrepancy logging, with failure containment and latency checks.
2. A proved, bounded capability may provide evidence to analyze-text and, where useful, to the app. Test its effect and abstention cases before changing candidate order.
3. Preserve same-POS cards at the graph input now; change parser card selection after identity and ambiguity tests pass.

No callable function name or production endpoint is asserted here. First-use scope must be a small verified capability; full 4,000-rule activation is not a prerequisite.

# One-rule adjective manifest admission v1

## Proven closed shadow scope

`shadow.adjective.degree.apen.en_deletion.v1` admits only the comparative `-en` deletion rule for the exact `åpen` lexeme, Bokmålsordboka article 1033, and positive-row snapshot `965f0a1a-9f22-446a-b36c-f573c9a002d8`. It requires positive-form provenance, independent NAOB stress, R109 class evidence, and the exact rule source candidate. The stored comparative target is not an input. On a mismatch it withholds the candidate. This manifest has `shadow_only` execution mode and no activation authority.

R111 observed both controls in Production: `åpen` was admitted to the closed shadow response; `sikker` was withheld with no candidate. This is a code-level shadow manifest, not a row in `public.grammar_runtime_manifests`.

## Existing SQL manifest is a different contract

`ir.adjective.degree.suffix.el_en_er_vowel_deletion.comparative` is validated and its compiled rule belongs to shadow release `runtime-structural-v1.37`. Its condition only checks `lexeme.id`, while its executor requires a source-verified positive/comparative form pair and compares the predicted form to the stored target. On `åpen`, the current executor returned `no_evidence` because that pair is absent. The release readiness result `activation_ready` therefore does not establish rule-first operation or admissibility of R110/R111 evidence.

Do not alter the existing release or silently reinterpret its compile hash. A future SQL release needs a separately named rule-first operator and manifest. Its inputs are the positive identity, independent stress, source-backed class decision and rule source; its output is a candidate with provenance and explicit uncertainty. The operator must not read a target degree form to choose the rule. A bounded grant must bind the new manifest, compiled hash and one release member. Test grant absence, wrong hash, changed snapshot, source conflict, duplicate execution and revocation before any rule activation.

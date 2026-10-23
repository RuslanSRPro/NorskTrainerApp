# First useful Grammar Graph capability — readiness contract

Status: planning contract. Acceptance of the pronoun candidate producer is recorded separately in R095; sentence analysis and app use remain unverified.

## Pronouns and forms: unfinished work

1. Preserve every source-backed form reading with canonical token identity and article/source provenance. The accepted nine-pair `morphological_paradigm` producer generates and recognizes candidates; it is nonexhaustive. A stored dictionary form may corroborate a reading but must not silently become the graph's rule authority.
2. Treat `case_selection` as a soft default with documented exceptions. A nominative or accusative candidate alone does not prove subject or object. Keep `Meg ser han` unresolved until independent syntax and exception evidence support a choice.
3. Resolve `og`/`eller` coordinated nominal constituents before assigning their clause role. R090 currently creates a coordination candidate and blocks the premature single-pronoun subject; it does not resolve the constituent.
4. Add a separate, source-backed object-role proof and test subject/object competition. No object conclusion follows merely from a failed subject candidate.
5. Validate the scoped producer manifest and operator mapping against the actual runtime only after positive, negative and exception corpus checks. Do not promote the draft manifest based on pair lookup alone.

## Gate for analyze-text and app use

This is a capability gate, not an all-rules gate. The first user-facing graph result must correctly identify or abstain for the tested combination of subject, object, finite predicate, noun and verb readings; adjective readings; and the relevant article/function-word uses. Broad coverage of every article is not required. A missing or conflicting capability must return `ambiguous`/`not_observed`, never a guessed answer.

The joint corpus must include SVO and OVS pronouns, `den`/`det`/`dere`, coordination with `og` and `eller`, noun order ambiguity (`Fisken spiser hunden`), adjective and article contexts, and same-POS homographs (`bok`). For each case save raw input candidates, chosen/abstained result, rule and source evidence, canonical identities, and latency. Analyze-text must receive candidates before its same-POS collapse. The parser retains final choice. Run the corpus in shadow first, then enable only the proved capability with a rollback switch.

## Current decision

- Pronoun form candidate producer: accepted for its nine source-backed pairs, with nonexhaustive status.
- Pronoun subject/object resolution: open.
- Coordinated nominal role: open.
- Adjective, article and complete POS capability for analyze-text: open; assess each against the joint corpus rather than inferring readiness from stored forms or rule counts.

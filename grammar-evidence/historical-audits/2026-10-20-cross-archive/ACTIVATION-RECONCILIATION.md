# Grammar Graph — historical cross-archive evidence (2026-10-20)

## Provenance and scope
This is an **import of historical chat-reported evidence**, NOT new execution proof. Original 24 archive hashes and per-row origin are preserved in `archive-manifest.json` and `*-all.json`. Raw row counts: timeline 429, contracts 351, tests 439, blockers 196, production identifiers 590. Counts include duplicates. `grammar-evidence/registry.json` remains the authority for proof status; this sidecar does not change existing proof statuses.

## Activation-path reconciliation
1. v1.53 closed historical authority/occurrence/WHERE architecture milestones, not automatic compiled-rule activation. End-to-end action and learner result remain UNVERIFIED.
2. `private.grammar_rpc_capture_v1`: user-reported read-only observation of one one-shot pair captured 2026-10-18 (`Katten sover`, two tokens). Canonical token IDs survived input/output for this pair; historical V32 result `clause_count=0`, legacy anchors/predicates/clauses/hypotheses all 0. This does not prove current V32 behavior after R048P. Treat as externally reported snapshot pending independently reproduced provenance.
3. `subject_of_predicate` expected `clause.predicate_phrase_id` and endpoint `phrase`; reported SQL clause builder provides `predicate_id` and canonical adapter emits `predicate` node. Need exact bridge or controlled manifest correction. UNVERIFIED executable compatibility.
4. S0 token POS exact-eq proof does not establish clause/phrase binding, `scope=clause`, `exists`, `create_dependency`, `add_trace` or combined execution.
5. Scheduler and graph patch reported in current code; D7 'no plan consumer' is a historical blocker, not proven current blocker. Handler shadow, activation authority reportedly 0 rows; controlled activation NOT authorized.

## Priority checks (read-only first)
- Validate exact current Git SHA, code paths, V32 migration tracking/deployment and current producer output on safe fixture (do not repeat one-shot capture).
- Trace producer → clause/predicate/phrase adapter → manifest endpoint schema for one selected rule.
- Execute local positive/negative fixture for clause bindings and `exists`; separately verify `create_dependency` and `add_trace`, then composed graph patch and feedback.
- Require explicit owner approval before any activation grant or Production mutation.

## Governance
`registry.json` and `history.jsonl` are NOT modified by this import; `index.json` and `matrix.csv` are generated views and must only be rebuilt using existing project tools after deliberate proof review. Imported CSV/JSON are evidence inventory, not newly PROVEN claims. Historical chat assertions are not promoted. Source ZIPs remain outside Git.

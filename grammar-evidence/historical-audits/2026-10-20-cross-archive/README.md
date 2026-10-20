# Cross-archive evidence reconciliation — 2026-10-20

This is a source-preserving consolidation, not a runtime verification. No tests, SQL or deployments executed.

## Counts (raw rows; not unique proof claims)

- timeline: 429 rows; all source archive names and source row numbers retained
- contracts: 351 rows; all source archive names and source row numbers retained
- tests: 439 rows; all source archive names and source row numbers retained
- blockers: 196 rows; all source archive names and source row numbers retained
- production: 590 rows; all source archive names and source row numbers retained

## Critical-path findings and temporal reconciliation

1. v1.53: historical architecture milestone for authority/occurrence/WHERE, not proof of compiled rule activation.
2. D7 missing plan consumer: historical claim, superseded as a blanket current blocker by reported scheduler/graph patch; execution on target rule still UNVERIFIED.
3. One-shot capture: user-reported read-only Production record dated 2026-10-18 for `Katten sover`; tokens retained IDs; zero clause anchors, predicates, clauses. This proves capture and token identity for that pair, NOT clause producer success. The Production snapshot itself is not included in this archive.
4. V32: `clause_count=0` in captured historical response. User reports current Production V32 includes R048P noun-subject path; current result for same sentence is UNVERIFIED without a fresh authorized, safe proof.
5. Manifest/producer mismatch: `subject_of_predicate` expects `clause.predicate_phrase_id` / phrase endpoint; producer reportedly emits `predicate_id` and adapter node `predicate`. Exact bridge or manifest repair UNVERIFIED.
6. S0 token POS exact-eq proof cannot prove clause scope, phrase bindings, `exists`, `create_dependency` or `add_trace` execution.
7. Shadow handler and zero activation-authority rows reported; controlled grant is NOT authorized and no user-visible result proven.

## Safe ordered closure gates

- Gate 1: preserve the captured pair; verify read-back evidence and version lineage (no repeat capture while one-shot writer rejects duplicates).
- Gate 2: trace exact selected rule manifest vs current producer/adapter contracts and resolve predicate-vs-phrase identity with a narrow test.
- Gate 3: prove clause-scope binding and `exists` using local fixture and current Git baseline.
- Gate 4: prove `create_dependency` and `add_trace` separately, then composition with graph patch and trace assertions.
- Gate 5: verify shadow output, regression tests and activation authority prerequisites. Controlled activation only after explicit approval.

## Evidence discipline

- These findings combine user-reported read-only Production observations and archive-derived historical accounts. They are not independently verified against live Production in this consolidation.
- Do not promote `CLAUSE_SOURCE_BACKED_FIXTURE` or `CLAUSE_PRODUCER_EXECUTION` to PROVEN.
- Keep existing grammar-evidence/registry.json and history.jsonl unchanged until schema-aware import with explicit review.
- Raw row tables are preserved without semantic deduplication; apparent duplicates and contradictions require human adjudication.

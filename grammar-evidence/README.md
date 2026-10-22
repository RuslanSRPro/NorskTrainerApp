# Grammar Evidence System V1

Purpose: persistent, Git-versioned evidence bookkeeping for NorskTrainer Grammar Graph.

## Files

- `registry.json` вЂ” source of truth for proof claims and proof status.
- `history.jsonl` вЂ” append-only chronological record of proof runs, discoveries, harness errors, patches and commits.
- `index.json` вЂ” generated current-source index; never promotes a proof.
- `matrix.csv` вЂ” generated human-readable view.
- `tools/build-evidence-index.py` вЂ” read-only source scanner and stale detector.

## Status model

- `PROVEN` вЂ” supported by the declared proof kind. Runtime/execution claims require executable/runtime evidence.
- `INFERRED` вЂ” strongly suggested by source/evidence but not directly proven.
- `UNVERIFIED` вЂ” required claim has not been proven.
- `STALE` вЂ” was proven, but a tracked dependency changed after the proof commit or a time-sensitive snapshot needs refresh.

## Non-negotiable rules

1. Text search, symbol presence, import wiring, matching names, and static matrix compatibility MUST NOT promote runtime claims to `PROVEN`.
2. `SOURCE_INSPECTION` can prove source architecture/wiring claims only.
3. `EXECUTABLE_TEST` / `EXECUTABLE_COMPOSITION` are required for executable producer/composition claims.
4. DB-state claims are snapshots and become stale when a newer authoritative snapshot supersedes them.
5. The generated index/matrix may downgrade a tracked proof to `STALE`; they never upgrade `UNVERIFIED` or `INFERRED` to `PROVEN`.
6. Evidence ZIPs stay outside Git. Registry stores run identifiers and concise results.
7. `sentenceIndex` is never canonical object identity.
8. Existing authority IDs, object identity, provenance and candidate status must not be rewritten to make a proof pass.
9. Activation requires explicit canonical activation authority. READY is not ACTIVATED.

## Workflow

1. Run the index builder at the current HEAD.
2. Read `matrix.csv` for unresolved/stale claims.
3. Run the narrow executable/runtime proof for the selected claim.
4. Review evidence.
5. Update `registry.json` deliberately with the exact proof result and HEAD.
6. Rebuild index/matrix.
7. Govern and commit exact files only.

`registry.json` is deliberately editable. Generated files are reproducible views, not evidence authority.

## History rules

`history.jsonl` records how the current proof state was reached. One JSON object equals one historical event.

- History is append-only in normal operation.
- Harness/package errors use `project_failure=false`; invalid runs must not be interpreted as project evidence.
- `updates_proofs` links an event to registry claims.
- History never promotes a registry claim automatically.
- The builder validates that every non-empty `updates_proofs` identifier exists in `registry.json`.
- Failed and superseded attempts remain in history so searches and mistakes are not repeated.
## Proof queue and gate resolution

V1.2 adds dependency-aware proof selection.

- `blocked_by` identifies unresolved proof claims that must be closed first.
- `next_action` records the next executable or discovery action.
- `search_gate` defines a narrow search contract with goal, success condition and fail-closed condition.
- `tools/build-proof-queue.py` writes `queue.json` and selects the next unblocked claim.
- Optional numeric `queue_priority` orders eligible work (lower first); it changes work order, never proof status or dependencies.
- Search/discovery may refine blockers and history, but never promotes a claim to `PROVEN`.
- A failed search records the exact missing contract and leaves the claim unresolved.

# R051 — source recovery and first-rule decision (22 October 2026)

This report separates three questions: reproducibility of the R048M branch, integrity of the current Production route, and readiness of one `subject_of_predicate` rule. It records verified observations; it does not authorize a deploy or an activation grant.

## Verified now

| Question | Evidence | Finding |
|---|---|---|
| Current SQL producer | `artifacts/R051-current-production-structural-rpc-smoke.json` | On the saved canonical input “Katten sover”, current Production RPC v1.37 produced one V32 clause, one resolved predicate and one resolved clause. Function definition hashes and full output are preserved. |
| SQL rule execution | Same artifact and `test-r051-production-structural-projection-v1.ts` | `nrg_rt_v1.structural.dependency.subject_of_predicate` reports `executed`, one dependency, canonical parity, supported actions and materialized trace. This is SQL shadow execution, not a canonical activation grant. |
| Public canonical projection | R051 executable test | The v1.43 adapter maps subject index 1 to `tok:0:0:6`, predicate to `predicate:0:pred1:simple:2`, and resolved clause span to the two canonical token IDs. It attaches `source_rule` evidence and provenance to the subject-to-predicate edge. A separate subject-to-clause edge also exists; these are distinct endpoints. |
| Target manifest | `artifacts/R051-current-subject-manifest-snapshot.json` | The validated manifest asks for a `phrase` predicate through `clause.predicate_phrase_id` and includes both `create_dependency` and `add_trace`. The resolved clause uses `predicate_id`; the canonical projection creates a `predicate` node. Executable manifest compatibility remains open. |
| Current deployed Edge | `artifacts/R051-current-source-lineage.json`, `artifacts/R051-edge-v66-source-parity.json` | All ten files in the deployed `canonical-graph-shadow-v1` v66 bundle match tracked source after line-ending normalization. The entrypoint includes later R048R evidence but lacks R048M capture and bounded dependency scheduler wiring. |
| R048M source divergence | `artifacts/R051-r048m-static-import-audit.json` | The alternate entrypoint has 19 direct NLP imports, 10 absent from the audited HEAD; its static relative closure reaches 115 source modules, 41 absent from HEAD. Absence does not establish necessity or safe equivalence. |
| Production governance | Read-only count on 22 October | Canonical dependency activation authority has zero rows; the capture table has one row. The R048M writer exists in SQL, while no `20261018%` rows were found in the migration ledger. |

## Recovery decision

1. **Preserve the current R048R adapter.** R048R was committed after R048M. The 59-line difference in `legacy-language-graph-adapter-v1.ts` is later functionality, not a deliberate deletion by R048M. Do not replace this file with the older branch snapshot.
2. **Do not transplant the 41 absent modules wholesale.** They include capture and bounded scheduler source that is absent from the deployed Edge v66. Classify each requested capability against the chosen first-rule route before creating a patch.
3. **Treat SQL migration lineage as an explicit drift item.** The Production R048M writer and R048P V32 definition exist, but the checked migration ledger has no `20261018%` entries. Preserve exact source and deployed definitions, then reconcile history through the project's deployment process. Do not replay historical SQL as a repair.
4. **Keep the existing SQL shadow rule route as the demonstrated baseline.** The alternative canonical scheduler route needs a separate source, manifest, action and deployment proof. Graph output stays inside the verification route until the grammar rules are activated as a whole; user-facing delivery is outside this first-rule proof.

## Next bounded proof for the first rule

Use the R051 fixture and manifest snapshot in an executable compatibility test. It must show whether a resolved canonical phrase exists inside the clause and whether `clause.type`, `clause.subject_token_index` and `clause.predicate_phrase_id` resolve under the actual runtime semantics. If they do not, make a reviewed contract decision: adapt the manifest to the existing predicate occurrence or implement a provenance-preserving phrase bridge. Verify both `create_dependency` and `add_trace`, then test admission, plan, patch, graph transition, duplicate handling and reevaluation for this one rule.

Before any scoped rule activation, reconcile the deployed Edge source with the reviewed commit. A scoped authority grant, rollback and observation plan follow these proofs, not the SQL smoke alone. Integration with the main `analyze-text` route is a later, separate milestone after the full rule set is activated.

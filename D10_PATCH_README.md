# D10 enrichment residue patch (v3)

v3 supersedes v1 and v2; do not apply either of them. Changes against v2 are
listed in `D10_PATCH_V3_CHANGES.md`.

This patch changes enrichment recovery from deferred page isolation to a durable
per-item residue ledger. A chain keeps the same stable page until each member is
terminal: `done`, `no_data`, or `failed`. Only the unresolved remainder is sent
again. A failed item is retained for manual review and does not erase successful
work from its neighbours.

## Scope

- durable item/chain state with stale `processing` recovery and retry cooldown;
- translations, source examples, forms, and expression-family enrichment;
- gray family candidates receive enrichment and retain their verification-driven
  display status;
- the production family injection function (verified verb and noun roots,
  evidence POS equal to the root POS) is recorded unchanged as a migration;
- expressions carry `expression_id` and their own dictionary article identity;
- direct Ordbokene expression articles persist their source examples against
  that exact `expression_id`, only when the cached article lemma equals the
  expression lemma;
- Lexeme360 reads multiple examples without changing the canonical one-row RPC;
- client mapping degrades per enrichment block instead of failing the whole view.

Forms remain enabled for nouns, verbs, adjectives, and the existing intentional
determiner path. `no_source_article` is a terminal `no_data` result.

## Install order

1. Pause creation of new analysis jobs and wait until every currently active job
   leaves `processing`, `ready`, `partial`, `retry_scheduled`, enrichment, or audit.
2. Run `scripts/d10/49_d10_residue_predeploy_checks.sql` and save the output.
3. Apply the three migrations in filename order. Never edit an already-applied
   migration. Immediately afterwards run `scripts/d10/51_d10_residue_runtime_tests.sql`
   (it is wrapped in BEGIN/ROLLBACK and leaves no rows) and stop if it raises.
4. Deploy, in order: `job-enrichment-batch-worker`, `job-orchestrator`,
   `pipeline-supervisor`, `job-completion-auditor`, `get-job-status`,
   `analyze-text`, `lexical-worker`, and `ordbokene-lexeme-pipeline-worker`.
   This list is intentionally complete: mixing the v12 SQL with old auditors or
   adapters can block gray family expressions.
5. Deploy the application files.
6. Run `scripts/d10/50_d10_residue_postdeploy_checks.sql`.
7. Start one small canary job. Confirm that a retry leaves the chain/page offset
   stable and that only residue items gain another attempt.
8. Run `scripts/d10/50_d10_residue_postdeploy_checks.sql` again after the canary.
9. Resume job creation only after the canary reaches `completed` or the expected
   `needs_manual_review` state.

The new batch worker remains compatible with old supervisor calls that omit
`item_ids`; the worker derives the stable page and claims its remaining items.

## Acceptance

- a partial item error does not terminate the job;
- successful candidates reach every downstream enrichment chain;
- 429 respects `Retry-After` when provided (120 seconds otherwise); timeouts use
  the persisted cooldown; both consume at most three attempts;
- stale `processing` rows become claimable again;
- terminal failures finish as `needs_manual_review` with durable item evidence;
- translations/examples/forms are visible independently in the application;
- `get_example_audit_v1` keeps its old one-row contract while Lexeme360 may read
  up to three examples through `get_lexeme360_examples_v1`.

Homonym/equivalent-article policy is deliberately outside this patch and remains
a separate design decision.

The learning-queue completion write is also not invented here: its schema/RPC
contract is absent from the supplied export. See `D10_PATCH_V2_REVIEW_RESOLUTION.md`.

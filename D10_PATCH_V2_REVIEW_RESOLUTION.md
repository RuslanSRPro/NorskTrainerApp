# Review resolution for residue patch v2

Status before local PostgreSQL runtime test: **STOP**.

## Corrected

- PL/pgSQL output-column conflict: `#variable_conflict use_column`.
- stale `processing`: increments attempts; third stale execution becomes `failed`.
- expression examples: linked through `expression_catalog.lexeme_id` even when
  Lexeme360 supplies no explicit expression IDs.
- complete Edge Function deployment order is documented and packaged.
- aggregate AI errors are classified per matching item, including
  `missing_in_batch_response`.
- HTTP `Retry-After` is persisted; quota fallback is 120 seconds.
- missing official forms are `no_data`, not manual review.
- terminal job evidence contains item, lexeme/expression identity and error.
- postdeploy check uses `last_error`.
- missing cutoff cannot empty active-job discovery.
- installation requires draining active jobs first.
- Ordbokene and other gray-family paths use the injection ledger selector.
- installer defaults to the current repository and creates per-file backups.
- `analyze-text` uses `resolve_surface_form_v2`.
- family injection is pinned to verb/noun roots in a new migration.
- gray cards receive a verification-reason label.
- direct Ordbokene expression articles persist source examples for the supplied
  `expression_id`.
- SQL runtime tests and a dependency-free retry-policy Deno test are included.

## Not fabricated

The exported sources contain no production learning-queue schema or idempotent
enqueue/refresh RPC. `learning_progress` is described elsewhere as user-scoped
and not bound to this runtime. Therefore this patch does not invent a write at
job completion. The exact queue table/RPC contract must be exported before that
separate write is safe.

Homonyms and equivalent articles remain separate by prior decision.

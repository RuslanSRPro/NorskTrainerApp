# Edge Functions Inventory

Last updated: 2026-06-22 (architecture audit session)

## ACTIVE — User / Job Entry

1. **analyze-text**
   User text analysis. Loads expression dictionary from `trusted_expressions_v1`
   (only `semantic-audit-worker`-verified expressions), resolves surface forms,
   creates processing jobs, triggers `job-orchestrator`. Does NOT contain
   enrichment monolith logic.

2. **job-orchestrator**
   General job orchestration layer. After `promote_verification_results_for_job`,
   fires two independent background enrichment tasks via `EdgeRuntime.waitUntil()`:
   Ordbokene (via `ordbokene-lexeme-pipeline-worker`) and NAOB (via
   `naob-pipeline-worker`).

## ACTIVE — Verification

3. **lexical-worker**
   Runs source checks and lexical verification pipeline. Routes to source-specific
   adapters in `verification/adapters/` (naob.ts, ordbokene.ts, lexin.ts,
   sprakradet.ts, wiktionary.ts).

## ACTIVE — Ordbokene Enrichment Pipeline

4. **ordbokene-lexeme-pipeline-worker**
   Main Ordbokene orchestrator (v4). Calls article-fetcher → expression-extractor
   → expression-promotion-worker → sub-article-relation-worker →
   article-ref-relation-worker → relation-resolver in sequence. Entry point for
   all Ordbokene enrichment — the five workers below are called only from here,
   not as standalone pipelines.

5. **ordbokene-article-fetcher**
   Fetches full Ordbokene article JSON into `ordbokene_article_cache`.

6. **ordbokene-expression-extractor**
   Extracts sub_article expressions into `ordbokene_expression_candidates`.

7. **ordbokene-expression-promotion-worker**
   Promotes expression candidates into `expression_catalog`. Writes
   `ordbokene_status: 'sub_article'` on new rows; backfills same field on
   existing rows (does not overwrite `'expr_entry'` with a weaker status).

8. **ordbokene-sub-article-relation-worker**
   Creates lexeme → has_expression → expression relations.

9. **ordbokene-article-ref-relation-worker**
   Creates article_ref → related_candidate semantic relations. Returns
   `ok: true, skipped: true` (not an error) when parent lexeme not yet in
   `lexemes` — path A simply has not processed the word yet.

## ACTIVE — NAOB Enrichment Pipeline

10. **naob-pipeline-worker**
    NAOB entry point. Builds candidate slugs from `expression_lemma` and
    orchestrates the batch worker. `source_lemma` is optional — falls back to
    trying all tokens of the expression.

11. **naob-expression-batch-worker**
    Tries candidate NAOB slugs in order. Intermediate attempts use
    `update_catalog: false` (prevents premature writes); only the first
    successful match updates the catalog.

12. **naob-structure-extractor**
    Fetches and parses NAOB article HTML. Detects expression presence
    (uttrykk / example / not_found). Writes only `naob_status` to
    `expression_catalog` — does NOT compute `expression_review_status`.
    A DB trigger (`trg_expression_catalog_recompute_review_status`)
    recalculates `expression_review_status` automatically from
    `ordbokene_status + naob_status` whenever either column changes.

## ACTIVE — Combined Enrichment

13. **authoritative-enrichment-pipeline-worker**
    Orchestrates both Ordbokene and NAOB via `source-runners.ts`. Produces
    authoritative evidence summary. Not yet connected to `job-orchestrator`
    directly — Ordbokene and NAOB are called individually instead (via workers
    10 and 4 above). `evidence-summary.ts` reports raw evidence facts only;
    trust verdict is left exclusively to `semantic-audit-worker`.

## ACTIVE — Relation / Audit

14. **relation-resolver**
    Resolves unresolved relation targets where possible.

15. **semantic-audit-worker**
    Single source of truth for trust verdicts (`trusted` / `candidate` /
    `weak` / `conflicted`). No other function may override `review_status`
    written by this worker. Tier logic (`aggregateVerificationTier`) is
    authoritative — client-side `services/verification.ts` is kept in sync
    with it.

## DELETED — Legacy functions

All 11 functions below were deleted via `supabase functions delete` on
2026-06-22. They are no longer deployed.

Local copies in `supabase/functions-archive/` (only these three):
- `enrich-lexeme-data`
- `verify-lexeme`
- `verify-lexeme-audit`

No local copy — deleted both from Supabase and from disk (recoverable only
from git history):
- `enrich-word` ⚠️ `api.ts` still references ENRICH_WORD_URL — calls will fail
- `form-enrichment-worker` (was still ACTIVE before deletion; calls removed from job-orchestrator)
- `grammar-family-worker`
- `ordbokene-expression-dedup-worker`
- `ordbokene-debug`
- `semantic-normalization-worker` (was still ACTIVE before deletion; calls removed from job-orchestrator)
- `semantic-relation-worker`
- `translate-sentence`

## Architecture Rule

Do not return to a monolithic `analyze-text` worker.

Correct architecture:

```
one admin/user entry (analyze-text / job-orchestrator)
→ small specialized workers (lexical-worker, ordbokene-*, naob-*)
→ shared tables (expression_catalog, authoritative_semantic_relations, ...)
→ single trust arbiter (semantic-audit-worker)
→ audit / summary result
```

**Trust verdict rule**: only `semantic-audit-worker` writes `review_status`.
No other worker or function should set `verification_tier` above `'candidate'`
or make trust decisions independently.

**expression_review_status rule**: each source writes only its own honest
status column (`ordbokene_status`, `naob_status`). The combined
`expression_review_status` is computed by a DB trigger, not by any TS code.
Current rule: `verified` ⇔ `ordbokene_status = 'expr_entry'` OR
`naob_status = 'uttrykk'`.
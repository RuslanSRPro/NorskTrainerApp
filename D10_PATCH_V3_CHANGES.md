# D10 residue patch v3 — changes against v2

Every change below was checked on a local PostgreSQL 16 with the production
column layout of `entity_examples` (from the schema export); migrations
20261010210000 and 20261010213000 apply, and `51_d10_residue_runtime_tests.sql`
passes and rolls back to zero ledger rows.

## Fixed

1. `get_lexeme360_examples_v1` (migration 20261010210000) did not compile, so the
   whole migration rolled back:
   - `entity_examples` has no `cefr_level` column → returned as `NULL::text`;
   - `ORDER BY coalesce(c.lexeme_id, …)` referenced a renamed column →
     `c.resolved_lexeme_id`.
2. Missing cutoff row: the fallback was `-infinity`, which would resume every
   old `partial` job. It is now `infinity`: no `partial` job is resumed
   automatically; jobs in other active statuses are unaffected.
3. Ordbokene expression examples: `quote` is a structured node
   `{content, items}` with `$` placeholders, not a string, so v2 saved nothing.
   Rendering now follows the existing project rule (pos-sense-guard): usage,
   article_ref and `mots` are substituted; a quote with an unknown placeholder is
   skipped; nested `sub_article` nodes are not read. Examples are written only
   when the cached article lemma equals the `expression_catalog` lemma of the
   supplied `expression_id`; otherwise the step reports
   `expression_article_identity_mismatch` and writes nothing.
   Shared module: `_shared/d10-ordbokene-examples.ts`, test:
   `tests/d10-enrichment-residue/ordbokene_examples_test.ts`.
4. Migration 20261010213000 now contains the live production definition of
   `d10_inject_verified_job_family_page_v1` unchanged. v2 had replaced
   `evidence.pos = l.pos` with `IN ('verb','noun')` (a weaker identity check) and
   changed the returned version string. No grant changes: CREATE OR REPLACE keeps
   existing privileges.
5. Installer keeps the first backup on a repeated run instead of overwriting it.
6. Predeploy check lists the third migration and states that `schema_migrations`
   is informative only (SQL Editor applications are not recorded there).

## Reverted

- `analyze-text` → `resolve_surface_form_v2`. The v2 resolver reads the same
  legacy tables (via `collect_surface_candidates`: `verb_forms`, `noun_forms`,
  `adjective_forms`, `lexeme_form_variants`) and returns different columns
  (`form_types`, `sources`, `base_confidence`, `score`), so `form_type`,
  `grammatical_features`, `confidence` and `source` would become empty and POS
  choice would change. `analyze-text/index.ts` is identical to the current
  project file.

## Still open (not done, by design)

- Replacing legacy form tables in surface resolution: needs a resolver built on
  `lexeme_form_display_v2`; separate design and test.
- Learning-queue refresh after a terminal job: production queue schema/RPC is not
  in the export.
- Gray-card reasons: three of the five planned reasons are available from current
  data (`verified`, `linked_to_verified_lexeme`, `awaiting_source_verification`).
  Source conflict, temporary error and manual review need verification evidence
  in the candidate RPC.
- Homonyms and equivalent articles: separate decisions.

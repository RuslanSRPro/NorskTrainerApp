# Edge Functions Inventory

## ACTIVE — User / Job Entry

1. analyze-text  
User text analysis. Should not contain enrichment monolith logic.

2. job-orchestrator  
General job orchestration layer.

## ACTIVE — Verification

3. lexical-worker  
Runs source checks and lexical verification pipeline.

## ACTIVE — Ordbokene Enrichment Pipeline

4. ordbokene-article-fetcher  
Fetches full Ordbokene article JSON into ordbokene_article_cache.

5. ordbokene-expression-extractor  
Extracts sub_article expressions into ordbokene_expression_candidates.

6. ordbokene-expression-promotion-worker  
Promotes expression candidates into expression_catalog and marks duplicates.

7. ordbokene-sub-article-relation-worker  
Creates lexeme → has_expression → expression relations.

8. ordbokene-article-ref-relation-worker  
Creates article_ref → related_candidate semantic relations.

## ACTIVE — Relation / Audit

9. relation-resolver  
Resolves unresolved relation targets where possible.

10. semantic-audit-worker  
Audits semantic relation quality.

## ARCHIVED / LEGACY CANDIDATES

- enrich-lexeme-data
- enrich-word
- form-enrichment-worker
- grammar-family-worker
- ordbokene-expression-dedup-worker
- ordbokene-debug
- semantic-normalization-worker
- semantic-relation-worker
- translate-sentence
- verify-lexeme
- verify-lexeme-audit

## Architecture Rule

Do not return to a monolithic analyze-text worker.

Correct architecture:

one admin/user entry
→ orchestrator
→ small specialized workers
→ shared tables
→ audit / summary result
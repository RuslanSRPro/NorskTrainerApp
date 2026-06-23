-- Add root_lemma to expression_catalog.
--
-- Stores the parent article lemma from which the expression was discovered.
-- For expressions found in Ordbokene: set by ordbokene-expression-promotion-worker
-- from ordbokene_expression_candidates.parent_lemma.
--
-- Used by lexin-enrichment-worker as root_word parameter in expression mode,
-- enabling autonomous orchestration without manual root_word lookup:
--
--   expression_catalog.root_lemma = "merke"
--   → lexin-enrichment-worker(lemma="legge merke til", root_word="merke")
--
-- Nullable: expressions from other sources may not have a root_lemma yet.

alter table public.expression_catalog
  add column if not exists root_lemma text;

comment on column public.expression_catalog.root_lemma is
'Parent lemma from which this expression was discovered.
For Ordbokene: parent_lemma from ordbokene_expression_candidates.
Used as root_word by lexin-enrichment-worker in expression mode.';

create index if not exists expression_catalog_root_lemma_idx
  on public.expression_catalog(root_lemma)
  where root_lemma is not null;
-- Fix lexin enrichment tables after architecture review (2026-06-22).
--
-- Problems fixed:
-- 1. expression_definitions and expression_examples were expression-only.
--    Lexin provides definitions/examples for plain lexemes too — added
--    lexeme_id column (same FK pattern as entity_translations).
-- 2. expression_source_evidence was expression-only. Added lexeme_id.
-- 3. New table: lexin_gloss_candidates — staging area for gloss terms
--    before they are promoted to authoritative_semantic_relations by
--    authoritative-enrichment-pipeline-worker. Source workers must NOT
--    write directly to authoritative_semantic_relations — they write
--    facts, the orchestrator decides what to promote.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Fix expression_source_evidence: add lexeme_id
-- ─────────────────────────────────────────────────────────────────────
alter table public.expression_source_evidence
  add column if not exists lexeme_id uuid
    references public.lexemes(id) on delete cascade;

-- Drop old constraint that required expression_id
alter table public.expression_source_evidence
  drop constraint if exists expression_source_evidence_unique;

-- New constraint: exactly one of lexeme_id / expression_id must be set
alter table public.expression_source_evidence
  add constraint expression_source_evidence_single_entity check (
    (lexeme_id is not null and expression_id is null) or
    (lexeme_id is null and expression_id is not null)
  );

alter table public.expression_source_evidence
  add constraint expression_source_evidence_unique unique
    (lexeme_id, expression_id, source, source_status);

create index if not exists expression_source_evidence_lexeme_idx
  on public.expression_source_evidence(lexeme_id)
  where lexeme_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Fix expression_definitions: rename to entity_definitions,
--    add lexeme_id
-- ─────────────────────────────────────────────────────────────────────
alter table public.expression_definitions
  rename to entity_definitions;

alter table public.entity_definitions
  add column if not exists lexeme_id uuid
    references public.lexemes(id) on delete cascade;

alter table public.entity_definitions
  drop constraint if exists expression_definitions_unique;

alter table public.entity_definitions
  add constraint entity_definitions_single_entity check (
    (lexeme_id is not null and expression_id is null) or
    (lexeme_id is null and expression_id is not null)
  );

alter table public.entity_definitions
  add constraint entity_definitions_unique unique
    (lexeme_id, expression_id, language_code, source);

create index if not exists entity_definitions_lexeme_idx
  on public.entity_definitions(lexeme_id)
  where lexeme_id is not null;

create index if not exists entity_definitions_expression_idx
  on public.entity_definitions(expression_id)
  where expression_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Fix expression_examples: rename to entity_examples, add lexeme_id
-- ─────────────────────────────────────────────────────────────────────
alter table public.expression_examples
  rename to entity_examples;

alter table public.entity_examples
  add column if not exists lexeme_id uuid
    references public.lexemes(id) on delete cascade;

alter table public.entity_examples
  drop constraint if exists expression_examples_unique;

alter table public.entity_examples
  add constraint entity_examples_single_entity check (
    (lexeme_id is not null and expression_id is null) or
    (lexeme_id is null and expression_id is not null)
  );

alter table public.entity_examples
  add constraint entity_examples_unique unique
    (lexeme_id, expression_id, language_code, source, example_text);

create index if not exists entity_examples_lexeme_idx
  on public.entity_examples(lexeme_id)
  where lexeme_id is not null;

create index if not exists entity_examples_expression_idx
  on public.entity_examples(expression_id)
  where expression_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- 4. New: lexin_gloss_candidates
--    Staging table for gloss terms extracted from E-idi entries.
--    Source workers write here. authoritative-enrichment-pipeline-worker
--    reads here and decides what to promote to
--    authoritative_semantic_relations.
--
--    Example: "legge merke til (observere, se)"
--      → source_expression_id = <legge merke til id>
--      → gloss_term = "observere"
--      → gloss_term = "se"
--      → uk_translation filled by lexin-translation-resolver
--      → target_lexeme_id filled by relation-resolver
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.lexin_gloss_candidates (
  id                    uuid primary key default gen_random_uuid(),

  -- Source entity (exactly one, same pattern as entity_translations)
  source_lexeme_id      uuid references public.lexemes(id) on delete cascade,
  source_expression_id  uuid references public.expression_catalog(id) on delete cascade,

  -- The gloss term as extracted from E-idi
  gloss_term            text not null,            -- "observere"
  surface_gloss         text,                     -- full gloss string: "observere, se"
  surface_idi           text,                     -- raw E-idi: "legge merke til (observere, se)"

  -- Filled by lexin-translation-resolver
  uk_translation        text,                     -- "спостерігати"
  uk_definition         text,                     -- "звертати увагу, бачити" (Ukr-def)
  translation_source    text default 'lexin',
  translation_status    text default 'pending',   -- 'pending' | 'resolved' | 'not_found'

  -- Filled by relation-resolver
  target_lexeme_id      uuid references public.lexemes(id),
  target_expression_id  uuid references public.expression_catalog(id),
  target_status         text default 'pending',   -- 'pending' | 'resolved' | 'not_found'

  -- Promotion status — set by authoritative-enrichment-pipeline-worker
  promotion_status      text default 'pending',   -- 'pending' | 'promoted' | 'rejected'
  promotion_relation_type text,                   -- relation type if promoted
  promoted_relation_id  uuid,                     -- id in authoritative_semantic_relations

  source                text not null default 'lexin',
  confidence            text not null default 'low',
  evidence              jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint lexin_gloss_candidates_single_source check (
    (source_lexeme_id is not null and source_expression_id is null) or
    (source_lexeme_id is null and source_expression_id is not null)
  ),

  constraint lexin_gloss_candidates_unique unique
    (source_lexeme_id, source_expression_id, gloss_term, source)
);

comment on table public.lexin_gloss_candidates is
'Staging area for gloss terms extracted from Lexin E-idi entries.
Source workers (lexin-enrichment-worker) write here.
lexin-translation-resolver fills uk_translation.
relation-resolver fills target_lexeme_id / target_expression_id.
authoritative-enrichment-pipeline-worker promotes to
authoritative_semantic_relations with appropriate relation_type.
Never written to directly by source workers — staging only.';

create index if not exists lexin_gloss_candidates_source_expr_idx
  on public.lexin_gloss_candidates(source_expression_id)
  where source_expression_id is not null;

create index if not exists lexin_gloss_candidates_source_lex_idx
  on public.lexin_gloss_candidates(source_lexeme_id)
  where source_lexeme_id is not null;

create index if not exists lexin_gloss_candidates_translation_status_idx
  on public.lexin_gloss_candidates(translation_status)
  where translation_status = 'pending';

create index if not exists lexin_gloss_candidates_target_status_idx
  on public.lexin_gloss_candidates(target_status)
  where target_status = 'pending';

create index if not exists lexin_gloss_candidates_promotion_status_idx
  on public.lexin_gloss_candidates(promotion_status)
  where promotion_status = 'pending';
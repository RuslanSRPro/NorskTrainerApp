-- Lexin B-pipeline enrichment tables
-- Designed per lexin-architecture.md (2026-06-22).
--
-- One translations table for both lexemes and expression_catalog,
-- with separate FK columns + CHECK constraint to enforce exactly one
-- source entity per row. Real FKs give cascade delete and type safety
-- while keeping a single table for the Lexin Translation Layer queries.

-- ─────────────────────────────────────────────────────────────────────
-- 1. entity_translations
--    Stores translations for both lexemes and expressions.
--    Source: Lexin (primary), extensible to Wiktionary etc.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.entity_translations (
  id              uuid primary key default gen_random_uuid(),

  -- Exactly one of these must be set (enforced by CHECK below)
  lexeme_id       uuid references public.lexemes(id) on delete cascade,
  expression_id   uuid references public.expression_catalog(id) on delete cascade,

  language_code   text not null,           -- 'uk', 'en', 'ru', etc.
  translation     text not null,
  translation_type text not null default 'primary',
                                           -- 'primary' | 'gloss' | 'definition' | 'example'
  source          text not null,           -- 'lexin', 'wiktionary', 'manual', etc.
  confidence      text not null default 'medium',
                                           -- 'high' | 'medium' | 'low'
  surface_form    text,                    -- original surface form from source (e.g. "legge merke til (observere, se)")
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint entity_translations_single_entity check (
    (lexeme_id is not null and expression_id is null) or
    (lexeme_id is null and expression_id is not null)
  ),

  constraint entity_translations_unique unique (
    lexeme_id, expression_id, language_code, translation_type, source
  )
);

comment on table public.entity_translations is
'Translations for lexemes and expressions. One row per entity+language+type+source.
See lexin-architecture.md: Lexin is the primary source for Ukrainian translations.
Use lexeme_id for words in lexemes table, expression_id for expression_catalog entries.';

create index if not exists entity_translations_lexeme_idx
  on public.entity_translations(lexeme_id)
  where lexeme_id is not null;

create index if not exists entity_translations_expression_idx
  on public.entity_translations(expression_id)
  where expression_id is not null;

create index if not exists entity_translations_language_idx
  on public.entity_translations(language_code, source);

-- ─────────────────────────────────────────────────────────────────────
-- 2. expression_source_evidence
--    Per-source raw evidence for expressions. Separate from
--    expression_catalog (canonical) and entity_translations (clean).
--    Stores the original surface form before normalization so we never
--    lose the hint text (e.g. "(observere, se)" from Lexin E-idi).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.expression_source_evidence (
  id              uuid primary key default gen_random_uuid(),
  expression_id   uuid references public.expression_catalog(id) on delete cascade,

  source          text not null,           -- 'lexin', 'ordbokene', 'naob', etc.
  source_status   text,                    -- 'e_idi', 'sub_article', 'uttrykk', etc.
  surface_form    text,                    -- raw form: "legge merke til (observere, se)"
  expression_text text,                    -- clean: "legge merke til"
  hint_text       text,                    -- gloss: "observere, se"
  gloss_terms     text[],                  -- parsed: ["observere", "se"]
  ukr_translation text,                    -- UA from same source if available
  evidence        jsonb,                   -- full raw evidence payload
  urls            text[],

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint expression_source_evidence_unique unique (expression_id, source, source_status)
);

comment on table public.expression_source_evidence is
'Per-source raw evidence for expressions. Stores original surface forms before
normalization — the hint text "(observere, se)" from Lexin E-idi must never be
lost even if it is not stored in expression_catalog.normalized_key.';

create index if not exists expression_source_evidence_expression_idx
  on public.expression_source_evidence(expression_id);

create index if not exists expression_source_evidence_source_idx
  on public.expression_source_evidence(source, source_status);

-- ─────────────────────────────────────────────────────────────────────
-- 3. expression_definitions
--    Norwegian and other-language definitions for expressions.
--    Separate from translations — a definition is not a translation.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.expression_definitions (
  id              uuid primary key default gen_random_uuid(),
  expression_id   uuid references public.expression_catalog(id) on delete cascade,

  language_code   text not null,           -- 'nb', 'nn', 'uk', 'en'
  definition      text not null,
  source          text not null,
  source_type     text,                    -- 'e_def', 'n_def', 'ukr_def', etc.

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint expression_definitions_unique unique (expression_id, language_code, source)
);

create index if not exists expression_definitions_expression_idx
  on public.expression_definitions(expression_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. expression_examples
--    Usage examples from all sources (Lexin E-eks, NAOB, Ordbokene).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.expression_examples (
  id              uuid primary key default gen_random_uuid(),
  expression_id   uuid references public.expression_catalog(id) on delete cascade,

  language_code   text not null,           -- 'nb', 'uk', 'en'
  example_text    text not null,
  translation_uk  text,                    -- UA translation of this example if available
  source          text not null,
  source_type     text,                    -- 'e_eks', 'n_eks', 'ukr_eks', etc.

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint expression_examples_unique unique (expression_id, language_code, source, example_text)
);

create index if not exists expression_examples_expression_idx
  on public.expression_examples(expression_id);
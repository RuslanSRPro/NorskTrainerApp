-- semantic_units_schema_stabilization
-- Fix semantic unit uniqueness and variant duplication risk

alter table public.canonical_semantic_units
  drop constraint if exists canonical_semantic_units_normalized_form_key;

alter table public.canonical_semantic_units
  add constraint canonical_semantic_units_normalized_form_type_key
  unique (normalized_form, semantic_type);

alter table public.semantic_unit_variants
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists semantic_unit_variants_unit_form_type_key
  on public.semantic_unit_variants (
    semantic_unit_id,
    variant_form,
    coalesce(variant_type, '')
  );
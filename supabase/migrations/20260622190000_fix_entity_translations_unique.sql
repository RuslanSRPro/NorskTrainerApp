-- Fix entity_translations unique index.
--
-- Problem: old index (lexeme_id, expression_id, ...) without translation column
-- allowed multiple rows for same entity+language+type combination.
-- Additionally, NULL in expression_id/lexeme_id was treated as distinct by PostgreSQL,
-- so rows with expression_id=NULL didn't conflict with each other.
--
-- Fix:
-- 1. Add translation to the unique key — one row per unique translation text
-- 2. NULLS NOT DISTINCT — NULLs are treated as equal for uniqueness
--    (PostgreSQL 15+, supported on Supabase)
--
-- After this, onConflict in workers uses:
-- 'lexeme_id,expression_id,language_code,translation_type,source,translation'

-- Drop old constraint/index
alter table public.entity_translations
  drop constraint if exists entity_translations_unique;

drop index if exists public.entity_translations_unique;

-- New index: includes translation, NULLS NOT DISTINCT
create unique index entity_translations_unique
  on public.entity_translations (
    lexeme_id,
    expression_id,
    language_code,
    translation_type,
    source,
    translation
  ) nulls not distinct;

-- Cleanup: remove duplicate rows keeping the one with lowest rank (or oldest)
-- Run this AFTER creating the new index (it will fail if duplicates exist)
-- If the migration fails due to duplicates, run this cleanup first:
--
-- delete from entity_translations
-- where id in (
--   select id from (
--     select id,
--       row_number() over (
--         partition by
--           coalesce(lexeme_id::text, ''),
--           coalesce(expression_id::text, ''),
--           language_code, translation_type, source,
--           lower(translation)
--         order by created_at asc
--       ) as rn
--     from entity_translations
--   ) t
--   where rn > 1
-- );
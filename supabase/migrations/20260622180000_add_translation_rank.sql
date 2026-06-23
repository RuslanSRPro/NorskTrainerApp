-- Add translation_rank to entity_translations.
--
-- Lexin returns multiple translations per word (all senses, all homographs).
-- Raw data is preserved as-is for semantic analysis and completeness.
-- translation_rank=1 marks the best/first translation per (entity, language, type, source)
-- for UI display. Higher ranks are "other meanings".
--
-- Ranking rule (initial): order of appearance in Lexin API response.
-- Future improvement: POS-aware ranking to separate homographs (nå verb vs adverb).
--
-- UI query pattern:
--   WHERE source = 'lexin'
--     AND translation_type IN ('primary', 'expression_primary')
--     AND translation_rank = 1

alter table public.entity_translations
  add column if not exists translation_rank integer not null default 1;

comment on column public.entity_translations.translation_rank is
'1 = best/first translation for UI display. Higher = secondary meanings.
For Lexin: rank by order of Ukr-lem/B-lem entries in API response.
Use WHERE translation_rank = 1 for UI display.
TECH DEBT: POS/homograph filtering needed for words like nå (verb vs adverb)
and se (Norwegian vs Ukrainian homograph noise).';

-- Index for UI queries
create index if not exists entity_translations_rank_idx
  on public.entity_translations(lexeme_id, expression_id, language_code, translation_rank)
  where translation_rank = 1;
-- Add sense_rank to entity_translations.
--
-- Two-level ranking system:
--   sense_rank       = which sense/homograph (1=primary, 2=secondary, ...)
--   translation_rank = position within that sense (1=best, 2=second, ...)
--
-- UI display: ORDER BY sense_rank, translation_rank
--
-- Grouping example for "forhold":
--   sense_rank=1: circumstance, condition   (pol-1 from Lexin)
--   sense_rank=2: relationship              (pol-2 from Lexin)
--   sense_rank=3: custom                   (pol=null, appearance order)
--
-- sense_rank is set by lexin-enrichment-worker from:
--   source_sense_pol (N-kom: pol-1→1, pol-2→2) if available
--   else: order of sub-article appearance in Lexin response
--
-- translation_rank is set by translation-ranking-worker per-sense group.

alter table public.entity_translations
  add column if not exists sense_rank integer;

comment on column public.entity_translations.sense_rank is
'Which sense/homograph this translation belongs to (1=primary, 2=secondary).
Set from Lexin N-kom pol-1/pol-2 when available, otherwise by appearance order.
Used with translation_rank for two-level UI display:
  ORDER BY sense_rank, translation_rank';

create index if not exists entity_translations_sense_rank_idx
  on public.entity_translations(lexeme_id, language_code, sense_rank)
  where sense_rank is not null;
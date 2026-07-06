-- Add sense disambiguation columns to entity_translations (LEXIN-008).
--
-- source_sense_id: Lexin article id for the specific sense/homograph.
--   e.g. for "forhold": 1404 = relationship, 47154 = circumstance
--   Written by lexin-enrichment-worker from entry.id of each sub-article.
--
-- source_sense_pol: polysemy order from Lexin N-kom entry.
--   "pol-1" → 1, "pol-2" → 2, "pol-3" → 3, absent → NULL
--   Used by translation-ranking-worker to order senses within same POS:
--   pol-1 = primary meaning, pol-2 = secondary, etc.
--
-- Ranking sort after this change:
--   pos_match_score DESC      (verb before noun)
--   source_sense_pol ASC      (pol-1 before pol-2, NULL last)
--   confidence DESC
--   old translation_rank ASC

alter table public.entity_translations
  add column if not exists source_sense_id integer,
  add column if not exists source_sense_pol integer;

comment on column public.entity_translations.source_sense_id is
'Lexin entry.id for the specific sense/article this translation came from.
Enables grouping translations by semantic sense rather than just by lemma.
e.g. "forhold" has sense 1404 (relationship) and sense 47154 (circumstance).';

comment on column public.entity_translations.source_sense_pol is
'Polysemy order from Lexin N-kom entry: pol-1→1, pol-2→2, pol-3→3.
NULL = no polysemy marker (unique or unknown sense ordering).
Lower value = more primary/frequent sense in Lexin.
Used by translation-ranking-worker to order senses within same POS.';

create index if not exists entity_translations_sense_idx
  on public.entity_translations(source_sense_id)
  where source_sense_id is not null;
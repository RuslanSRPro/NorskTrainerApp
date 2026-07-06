-- Add CEFR level and frequency data to lexemes.
-- Source: Kelly Norwegian word list (University of Oslo / KELLY project)
-- URL: https://www.hf.uio.no/iln/english/about/organisation/text-laboratory/services/kelly.html
-- License: CC BY-NC-SA 2.0
-- Coverage: ~9000 most frequent Norwegian words mapped to CEFR A1-C2
--
-- cefr_level:      CEFR level (A1/A2/B1/B2/C1/C2)
-- frequency_ipm:   frequency in instances per million words (normalized)
-- frequency_rank:  rank in Kelly list (1=most frequent)

alter table public.lexemes
  add column if not exists cefr_level text,
  add column if not exists frequency_ipm numeric,
  add column if not exists frequency_rank integer;

comment on column public.lexemes.cefr_level is
'CEFR level from Kelly Norwegian word list: A1/A2/B1/B2/C1/C2.
NULL = not in Kelly list (may be too rare or specialized).';

comment on column public.lexemes.frequency_ipm is
'Word frequency in instances per million words (from Kelly/corpus data).
Higher = more common. NULL if not in Kelly list.';

comment on column public.lexemes.frequency_rank is
'Rank in Kelly Norwegian word list (1=most frequent, 9000=least frequent).
NULL if not in Kelly list.';

create index if not exists lexemes_cefr_level_idx
  on public.lexemes(cefr_level)
  where cefr_level is not null;

create index if not exists lexemes_frequency_rank_idx
  on public.lexemes(frequency_rank)
  where frequency_rank is not null;

-- Staging table for Kelly XLS import
-- Import CSV here first, then run the update SQL below
create table if not exists public.kelly_import_staging (
  rank          integer,
  lemma         text,
  pos_raw       text,        -- raw POS from Kelly (e.g. "v.", "n.", "adj.")
  cefr_level    text,        -- A1/A2/B1/B2/C1/C2 (or 1-6, normalized on import)
  frequency_ipm numeric,
  en_translation text,       -- English translation from Kelly
  matched       boolean default false
);

comment on table public.kelly_import_staging is
'Temporary staging table for Kelly Norwegian word list import.
After import and matching, can be dropped or kept for reference.';
-- Add surface_form to lexeme_source_checks
-- Separates canonical verification query (lemma) from actual text form
-- query       = canonical verification query (gå)
-- surface_form = actual normalized form from text (gikk)

ALTER TABLE public.lexeme_source_checks
  ADD COLUMN IF NOT EXISTS surface_form text;

COMMENT ON COLUMN public.lexeme_source_checks.surface_form IS
  'Original normalized surface form from the analyzed text.
   query is the canonical verification query (lemma);
   surface_form preserves the actual form encountered in text.
   For expressions: surface_form == query (canonical key).
   For tokens: surface_form = gikk, query = gå.';

-- Backfill: for existing rows surface_form = query (unknown original form)
UPDATE public.lexeme_source_checks
SET surface_form = query
WHERE surface_form IS NULL;

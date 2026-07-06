-- Add cefr_source to lexemes to track origin of CEFR level and frequency
-- Values:
--   'kelly_corpus'     — from Kelly Norwegian word list (corpus-based, authoritative)
--   'gemini_estimate'  — from Gemini AI (semantic complexity estimate, less reliable)
--   'manual'           — manually assigned

ALTER TABLE public.lexemes
  ADD COLUMN IF NOT EXISTS cefr_source text;

COMMENT ON COLUMN public.lexemes.cefr_source IS
  'Source of cefr_level and frequency_rank:
   kelly_corpus     = Kelly Norwegian list (corpus frequency, authoritative)
   gemini_estimate  = Gemini AI estimate (semantic complexity, less reliable)
   manual           = manually assigned';

-- Backfill existing data:
-- Words that have both cefr_level (new) and frequency_rank → Kelly
UPDATE public.lexemes
SET cefr_source = 'kelly_corpus'
WHERE cefr_level IS NOT NULL
  AND frequency_rank IS NOT NULL
  AND cefr_source IS NULL;

-- Words that have cefr_level but no frequency_rank → Gemini fallback
UPDATE public.lexemes
SET cefr_source = 'gemini_estimate'
WHERE cefr_level IS NOT NULL
  AND cefr_source IS NULL;

-- Update trigger to also set cefr_source
CREATE OR REPLACE FUNCTION auto_fill_cefr_from_kelly()
RETURNS trigger AS $$
BEGIN
  SELECT k.cefr_level, k.rank
  INTO new.cefr_level, new.frequency_rank
  FROM public.kelly_import_staging k
  WHERE lower(k.lemma) = lower(new.lemma)
  LIMIT 1;

  -- Set source only if Kelly matched
  IF new.cefr_level IS NOT NULL THEN
    new.cefr_source := 'kelly_corpus';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Verify distribution
SELECT
  cefr_source,
  count(*) as count,
  count(cefr_level) as with_cefr,
  count(frequency_rank) as with_rank
FROM public.lexemes
GROUP BY cefr_source
ORDER BY count DESC;

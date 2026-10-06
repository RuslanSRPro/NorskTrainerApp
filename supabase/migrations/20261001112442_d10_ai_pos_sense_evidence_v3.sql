-- Nullable provenance only; no backfill or job resume.
BEGIN;
ALTER TABLE public.entity_translations
  ADD COLUMN IF NOT EXISTS enrichment_evidence jsonb;
ALTER TABLE public.entity_examples
  ADD COLUMN IF NOT EXISTS enrichment_evidence jsonb;
COMMENT ON COLUMN public.entity_translations.enrichment_evidence IS
  'Source identity/definitions and AI review evidence; AI review is not source verification.';
COMMENT ON COLUMN public.entity_examples.enrichment_evidence IS
  'Source identity/definitions and AI review evidence; AI review is not source verification.';
COMMIT;

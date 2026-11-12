-- D10_si_noun_bad_ai_delete_v1 (11.11.2026, after 456): si noun (card 450b8a4f, article 51262 "durskalaens sjuende
-- tone" = the note si/ti) got the AI translation "ten" / "десятка" and the example "Tallet si kommer etter ni":
-- the article's cross-reference "jf. ti" had been passed to AI as a definition "ti" (fixed in pos-sense-guard:
-- such references are now see_also, never a meaning). The wrong AI rows of this card are deleted so the next
-- analysis of "si" makes them again from the note meaning. Dictionary rows are not touched.
-- Saved first in private.d10_bad_ai_delete_backup_v1. Re-run = deletes nothing more.
CREATE TABLE IF NOT EXISTS private.d10_bad_ai_delete_backup_v1 (
  id bigserial PRIMARY KEY, table_name text NOT NULL, row_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_bad_ai_delete_backup_v1 FROM PUBLIC;

INSERT INTO private.d10_bad_ai_delete_backup_v1 (table_name, row_data)
SELECT 'entity_translations', to_jsonb(t) FROM public.entity_translations t
WHERE t.lexeme_id = '450b8a4f-7af2-474c-ba14-9bd4b90b636f' AND t.source = 'ai_fallback';
INSERT INTO private.d10_bad_ai_delete_backup_v1 (table_name, row_data)
SELECT 'entity_examples', to_jsonb(e) FROM public.entity_examples e
WHERE e.lexeme_id = '450b8a4f-7af2-474c-ba14-9bd4b90b636f' AND e.source = 'ai_fallback';

DELETE FROM public.entity_translations
WHERE lexeme_id = '450b8a4f-7af2-474c-ba14-9bd4b90b636f' AND source = 'ai_fallback';
DELETE FROM public.entity_examples
WHERE lexeme_id = '450b8a4f-7af2-474c-ba14-9bd4b90b636f' AND source = 'ai_fallback';

SELECT table_name, count(*) AS saved_and_deleted FROM private.d10_bad_ai_delete_backup_v1
WHERE row_data->>'lexeme_id' = '450b8a4f-7af2-474c-ba14-9bd4b90b636f' GROUP BY table_name;

-- D10 17.10.2026 (agreed): a card of a word with several cards of one part of
-- speech (R9) whose Lexin entry cannot be chosen by its forms is marked "for
-- review" (lexin-enrichment-worker keeps all Lexin rows for it, as before).
-- The mark is removed as soon as one entry fits the card. Adds only.

CREATE TABLE IF NOT EXISTS private.d10_lexin_r9_review_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.d10_lexin_r9_review_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_lexin_r9_review_v1 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.d10_record_lexin_r9_review_v1(
  p_lexeme_id uuid, p_reason text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  INSERT INTO private.d10_lexin_r9_review_v1 (lexeme_id, reason, detail, recorded_at)
  VALUES (p_lexeme_id, left(coalesce(p_reason, 'unknown'), 200), coalesce(p_detail, '{}'::jsonb), now())
  ON CONFLICT (lexeme_id) DO UPDATE
    SET reason = excluded.reason, detail = excluded.detail, recorded_at = excluded.recorded_at;
$body$;

CREATE OR REPLACE FUNCTION public.d10_clear_lexin_r9_review_v1(p_lexeme_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  DELETE FROM private.d10_lexin_r9_review_v1 WHERE lexeme_id = p_lexeme_id;
$body$;

REVOKE ALL ON FUNCTION public.d10_record_lexin_r9_review_v1(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_clear_lexin_r9_review_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_record_lexin_r9_review_v1(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_clear_lexin_r9_review_v1(uuid) TO service_role;

do $$ begin raise notice 'd10 lexin r9 review v1 installed'; end $$;

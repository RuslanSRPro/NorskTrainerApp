-- D10 15.10.2026 (agreed "a + b"): an AI translation rejected by the review
-- model gets one retry (ai-enrichment-worker). If it is rejected again:
--   - the word is marked "for review" (this table), it keeps no translation;
--   - the job is not stopped by it: the enrichment outcome is "no data"
--     (job-enrichment-batch-worker) and the completion contract accepts a
--     word whose ONLY gap is the missing translation when it carries this
--     mark (completion-contract runtime). The word itself stays not ready.
-- The mark is removed as soon as an AI or source translation is accepted.

CREATE TABLE IF NOT EXISTS private.d10_ai_review_rejections_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  job_id uuid,
  reason text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.d10_ai_review_rejections_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_ai_review_rejections_v1 FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.d10_record_ai_review_rejection_v1(
  p_lexeme_id uuid, p_reason text, p_detail jsonb DEFAULT '{}'::jsonb, p_job_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  INSERT INTO private.d10_ai_review_rejections_v1 (lexeme_id, job_id, reason, detail, recorded_at)
  VALUES (p_lexeme_id, p_job_id, p_reason, coalesce(p_detail, '{}'::jsonb), now())
  ON CONFLICT (lexeme_id) DO UPDATE SET job_id = excluded.job_id, reason = excluded.reason,
    detail = excluded.detail, recorded_at = excluded.recorded_at;
$body$;

CREATE OR REPLACE FUNCTION public.d10_clear_ai_review_rejection_v1(p_lexeme_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  DELETE FROM private.d10_ai_review_rejections_v1 WHERE lexeme_id = p_lexeme_id;
$body$;

REVOKE ALL ON FUNCTION public.d10_record_ai_review_rejection_v1(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_clear_ai_review_rejection_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_record_ai_review_rejection_v1(uuid, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_clear_ai_review_rejection_v1(uuid) TO service_role;

-- Snapshot: the mark is exposed in the identity of a lexeme entity.
DO $patch$
DECLARE
  v text := pg_get_functiondef('public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure);
  n integer;
BEGIN
  IF position('ai_review_rejected' IN v) > 0 THEN
    RAISE NOTICE 'D10 review mark: snapshot already patched';
    RETURN;
  END IF;
  SELECT count(*) INTO n FROM regexp_matches(v,
    $p$'identity', case when sr\.entity_kind = 'lexeme' then\s+jsonb_build_object\($p$, 'g');
  IF n <> 1 THEN
    RAISE EXCEPTION 'D10_REVIEW_MARK_PREFLIGHT: identity anchor found % times; nothing changed', n;
  END IF;
  v := regexp_replace(v,
    $p$'identity', case when sr\.entity_kind = 'lexeme' then\s+jsonb_build_object\($p$,
    $r$'identity', case when sr.entity_kind = 'lexeme' then
          jsonb_build_object(
            -- D10 15.10.2026: AI translation rejected twice, word marked for review
            'ai_review_rejected', exists (select 1 from private.d10_ai_review_rejections_v1 rr
                                          where rr.lexeme_id = l.id),$r$);
  EXECUTE v;
  RAISE NOTICE 'D10 review mark installed';
END
$patch$;

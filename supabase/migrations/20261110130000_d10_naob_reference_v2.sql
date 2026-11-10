-- D10_naob_reference_v2 (10.11.2026): the NAOB step of gå ran 62 min and failed with statement timeouts.
--   1) naob_extraction_log_v1: what naob-family-expressions-worker already extracted (the verb's own articles:
--      not again within 24 h; referenced articles, or references to articles NAOB does not have: not again
--      within 30 days). Seeded with the articles already in cache + glosses, so nothing is re-extracted.
--   2) partial passes are capped: after 12 partial passes of one verb the step counts as done with what it
--      found (detail.partial_cap = true); a normal finish resets the counter.
--   3) gå gets a new try (its attempts are reset).
-- Rollback: optional/rollback_d10_naob_reference_v2.sql.

CREATE TABLE IF NOT EXISTS public.naob_extraction_log_v1 (
  kind text NOT NULL CHECK (kind IN ('root', 'reference')),
  slug text NOT NULL,
  status text NOT NULL CHECK (status IN ('extracted', 'missing')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, slug)
);
ALTER TABLE public.naob_extraction_log_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.naob_extraction_log_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.naob_extraction_log_v1 TO service_role;

-- referenced articles already cached and extracted (key = the target word, without _1, _2 ...)
INSERT INTO public.naob_extraction_log_v1 (kind, slug, status, checked_at)
SELECT DISTINCT 'reference', regexp_replace(lower(g.naob_slug), '_[0-9]+$', ''), 'extracted', now()
FROM public.naob_expression_glosses g
JOIN public.naob_article_cache c ON c.normalized_key = lower(g.naob_slug)
ON CONFLICT (kind, slug) DO NOTHING;

ALTER TABLE private.d10_family_naob_runs_v1 ADD COLUMN IF NOT EXISTS partial_passes integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.d10_family_naob_record_v1(
  p_job_id uuid, p_root_lexeme_id uuid, p_ok boolean, p_slugs text[] DEFAULT '{}', p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_row private.d10_family_naob_runs_v1;
  v_partial boolean := p_ok AND coalesce(p_detail->>'status', '') = 'partial';
  v_cap constant integer := 12;
BEGIN
  IF p_root_lexeme_id IS NULL OR p_ok IS NULL THEN RAISE EXCEPTION 'INVALID_FAMILY_NAOB_RECORD'; END IF;
  INSERT INTO private.d10_family_naob_runs_v1 AS d (root_lexeme_id, status, attempts, slugs, last_job_id, detail,
    updated_at, partial_passes)
  VALUES (p_root_lexeme_id, CASE WHEN v_partial THEN 'retry' WHEN p_ok THEN 'done' ELSE 'retry' END,
    CASE WHEN v_partial THEN 0 ELSE 1 END, coalesce(p_slugs, '{}'), p_job_id, coalesce(p_detail, '{}'::jsonb),
    CASE WHEN v_partial THEN now() - interval '3 minutes' ELSE now() END, CASE WHEN v_partial THEN 1 ELSE 0 END)
  ON CONFLICT (root_lexeme_id) DO UPDATE
    SET attempts = CASE WHEN v_partial THEN d.attempts ELSE d.attempts + 1 END,
        partial_passes = CASE WHEN v_partial THEN d.partial_passes + 1 WHEN p_ok THEN 0 ELSE d.partial_passes END,
        status = CASE
          WHEN v_partial AND d.partial_passes + 1 >= v_cap THEN 'done'   -- D10_naob_reference_v2: cap
          WHEN v_partial THEN 'retry' WHEN p_ok THEN 'done'
          WHEN d.attempts + 1 >= 3 THEN 'failed' ELSE 'retry' END,
        slugs = CASE WHEN p_ok THEN coalesce(p_slugs, '{}') ELSE d.slugs END,
        last_job_id = p_job_id,
        detail = coalesce(p_detail, '{}'::jsonb)
          || CASE WHEN v_partial AND d.partial_passes + 1 >= v_cap THEN '{"partial_cap": true}'::jsonb ELSE '{}'::jsonb END,
        -- a partial run is eligible again at once (the 2-minute pause is only after a failure)
        updated_at = CASE WHEN v_partial AND d.partial_passes + 1 < v_cap THEN now() - interval '3 minutes' ELSE now() END
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'attempts', v_row.attempts, 'partial', v_partial,
    'partial_passes', v_row.partial_passes);
END;
$function$;
REVOKE ALL ON FUNCTION public.d10_family_naob_record_v1(uuid, uuid, boolean, text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_family_naob_record_v1(uuid, uuid, boolean, text[], jsonb) TO service_role;

WITH reset AS (
  UPDATE private.d10_family_naob_runs_v1 r
  SET status = 'retry', attempts = 0, partial_passes = 0, updated_at = now() - interval '3 minutes'
  FROM public.lexemes l
  WHERE l.id = r.root_lexeme_id AND r.status <> 'done'
    AND r.detail::text LIKE '%statement timeout%'
  RETURNING l.lemma
)
SELECT 'D10_naob_reference_v2 installed' AS result,
  (SELECT count(*) FROM public.naob_extraction_log_v1) AS log_seeded,
  (SELECT string_agg(lemma, ', ') FROM reset) AS naob_runs_reset;

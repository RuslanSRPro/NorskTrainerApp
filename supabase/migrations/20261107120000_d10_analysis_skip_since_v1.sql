-- D10_analysis_skip_since_v1 (07.11.2026, agreed): a whole-text analysis does not process again a card that was
-- fully processed by a text analysis on or after skip_since.
--   * public.analysis_skip_config_v1 (singleton): skip_since; NULL = off. Set to 08.11.2026 00:00 Europe/Oslo.
--   * public.d10_analysis_skip_cards_v1(lexeme_ids, expression_ids) -> the requested ids that may be skipped.
-- A card may be skipped only when ALL of this holds:
--   - its LATEST text job (input_type 'text', item of the card: lexeme_id, or expression whose catalog entry
--     belongs to the card) started on or after skip_since and ended 'completed';
--   - its item in that job is 'done' and has no enrichment step outside done / no_data;
--   - the card is not excluded and is not in private.d10_deferred_enrichment_v1 (cards of synonym child jobs
--     wait there for family 360: never skipped).
-- Only analyze-text calls it (service_role). Word lists are never skipped (decided in analyze-text).
-- Guards: a repeated install stops. Rollback: optional/rollback_d10_analysis_skip_since_v1.sql.
DO $guard$
BEGIN
  IF to_regclass('public.analysis_skip_config_v1') IS NOT NULL
     OR to_regprocedure('public.d10_analysis_skip_cards_v1(uuid[],uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_analysis_skip_since_v1 is already installed';
  END IF;
  IF to_regclass('private.d10_deferred_enrichment_v1') IS NULL
     OR to_regclass('private.d10_job_enrichment_item_state_v1') IS NULL THEN
    RAISE EXCEPTION 'STOP: required private tables are missing';
  END IF;
END
$guard$;

CREATE TABLE public.analysis_skip_config_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  skip_since timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.analysis_skip_config_v1 (singleton, skip_since)
VALUES (true, '2026-11-08 00:00:00 Europe/Oslo'::timestamptz);
ALTER TABLE public.analysis_skip_config_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analysis_skip_config_v1 FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.d10_analysis_skip_cards_v1(p_lexeme_ids uuid[], p_expression_ids uuid[])
RETURNS TABLE(kind text, id uuid, skip_since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $fn$
WITH cfg AS (
  SELECT c.skip_since FROM public.analysis_skip_config_v1 c WHERE c.singleton AND c.skip_since IS NOT NULL
),
req AS (
  SELECT DISTINCT 'lexeme'::text AS kind, u.id AS id, u.id AS card
  FROM unnest(coalesce(p_lexeme_ids, '{}'::uuid[])) AS u(id)
  UNION
  SELECT DISTINCT 'expression', e.id, e.lexeme_id
  FROM public.expression_catalog e
  WHERE e.id = ANY (coalesce(p_expression_ids, '{}'::uuid[])) AND e.lexeme_id IS NOT NULL
),
latest AS (
  SELECT r.kind, r.id, r.card, x.job_id, x.item_id, x.item_status, x.job_status, x.job_created
  FROM req r
  CROSS JOIN LATERAL (
    SELECT y.job_id, y.item_id, y.item_status, y.job_status, y.job_created FROM (
      SELECT j.id AS job_id, i.id AS item_id, i.status AS item_status, j.status AS job_status, j.created_at AS job_created
      FROM public.lexeme_processing_items i
      JOIN public.lexeme_processing_jobs j ON j.id = i.job_id
      WHERE i.lexeme_id = r.card AND j.input_type = 'text'
      UNION ALL
      SELECT j.id, i.id, i.status, j.status, j.created_at
      FROM public.expression_catalog ce
      JOIN public.lexeme_processing_items i ON i.expression_id = ce.id
      JOIN public.lexeme_processing_jobs j ON j.id = i.job_id
      WHERE ce.lexeme_id = r.card AND j.input_type = 'text'
    ) y
    ORDER BY y.job_created DESC, y.item_status = 'done' ASC
    LIMIT 1
  ) x
)
SELECT l.kind, l.id, cfg.skip_since
FROM latest l
CROSS JOIN cfg
JOIN public.lexemes card ON card.id = l.card
WHERE l.job_created >= cfg.skip_since
  AND l.job_status = 'completed'
  AND l.item_status = 'done'
  AND coalesce(card.dictionary_status, 'active') <> 'excluded'
  AND NOT EXISTS (SELECT 1 FROM private.d10_deferred_enrichment_v1 d WHERE d.lexeme_id = l.card)
  AND NOT EXISTS (SELECT 1 FROM private.d10_job_enrichment_item_state_v1 s
                  WHERE s.job_id = l.job_id AND s.item_id = l.item_id AND s.status NOT IN ('done', 'no_data'));
$fn$;

REVOKE ALL ON FUNCTION public.d10_analysis_skip_cards_v1(uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_analysis_skip_cards_v1(uuid[], uuid[]) TO service_role;

SELECT 'config'::text AS part, 'skip_since' AS name, jsonb_build_object('skip_since', skip_since) AS info
FROM public.analysis_skip_config_v1
UNION ALL
SELECT 'probe', 'cards that may be skipped now (expected 0 before the date)',
  jsonb_build_object('count', (SELECT count(*) FROM public.d10_analysis_skip_cards_v1(
    (SELECT array_agg(l.id) FROM (SELECT id FROM public.lexemes ORDER BY id LIMIT 200) l), '{}'::uuid[])))
ORDER BY 1, 2;

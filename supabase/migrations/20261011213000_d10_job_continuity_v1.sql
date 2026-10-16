-- D10 job continuity v1
-- One unpromotable item must not stop the whole text-analysis job.
--
-- d10_fail_stalled_promotion_items_v1: called by pipeline-supervisor only after
--   promote_verification_results_for_job made no progress on 3 consecutive
--   ticks while every source check of the job is terminal. It closes exactly
--   the page promotion keeps selecting (current_stage = 'source_checks',
--   ORDER BY id, LIMIT p_limit — the same selection as the promotion RPC), the
--   same way promotion already closes not-promoted items: status = 'done',
--   current_stage = 'admission_gate', plus promotion_status = 'promotion_failed'
--   and the source-check statuses as evidence. Items beyond that page are not
--   touched; promotion continues with them on the next tick.
-- d10_job_promotion_failures_v1: the list of such items for the final
--   needs_manual_review report.
-- Nothing existing is changed or dropped.

CREATE OR REPLACE FUNCTION public.d10_fail_stalled_promotion_items_v1(
  p_job_id uuid,
  p_limit integer DEFAULT 3
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $body$
DECLARE
  v_pending integer;
  v_marked integer;
  v_items jsonb;
BEGIN
  IF p_job_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'INVALID_STALLED_PROMOTION_REQUEST';
  END IF;

  -- Source checks still running: promotion is waiting, not stalled.
  SELECT count(*) INTO v_pending
  FROM public.lexeme_source_checks sc
  WHERE sc.job_id = p_job_id
    AND sc.status IN ('pending','processing','retry_scheduled');
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', true, 'marked', 0,
      'reason', 'source_checks_pending', 'pending_checks', v_pending, 'items', '[]'::jsonb);
  END IF;

  WITH stalled AS MATERIALIZED (
    SELECT i.id, i.normalized_lemma, i.surface_form, i.pos, i.match_type,
      (SELECT coalesce(jsonb_object_agg(latest.source, latest.status), '{}'::jsonb)
       FROM (
         SELECT DISTINCT ON (sc.source) sc.source, sc.status
         FROM public.lexeme_source_checks sc
         WHERE sc.item_id = i.id
         ORDER BY sc.source, sc.updated_at DESC
       ) latest) AS checks
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id
      AND i.current_stage = 'source_checks'
    ORDER BY i.id
    LIMIT p_limit
  ), marked AS (
    UPDATE public.lexeme_processing_items i
    SET status = 'done',
        current_stage = 'admission_gate',
        last_error = 'promotion_failed: no promotable source evidence after all source checks finished',
        result_summary = coalesce(i.result_summary, '{}'::jsonb) || jsonb_build_object(
          'promotion_status', 'promotion_failed',
          'admission_status', 'promotion_failed',
          'd10_promotion_failure', jsonb_build_object(
            'version', 'd10_job_continuity_v1',
            'reason', 'promotion_stalled',
            'source_checks', s.checks,
            'marked_at', clock_timestamp()))
    FROM stalled s
    WHERE i.id = s.id
      AND i.job_id = p_job_id
      AND i.current_stage = 'source_checks'
    RETURNING i.id, s.normalized_lemma, s.surface_form, s.pos, s.match_type, s.checks
  )
  SELECT count(*)::integer,
    coalesce(jsonb_agg(jsonb_build_object(
      'item_id', m.id, 'lemma', coalesce(m.normalized_lemma, m.surface_form),
      'pos', m.pos, 'match_type', m.match_type, 'source_checks', m.checks)
      ORDER BY m.id), '[]'::jsonb)
  INTO v_marked, v_items
  FROM marked m;

  RETURN jsonb_build_object('ok', true, 'marked', v_marked, 'items', v_items);
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_fail_stalled_promotion_items_v1(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_fail_stalled_promotion_items_v1(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_fail_stalled_promotion_items_v1(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.d10_job_promotion_failures_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $body$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'item_id', i.id,
    'lemma', coalesce(i.normalized_lemma, i.surface_form),
    'pos', i.pos,
    'match_type', i.match_type,
    'error', i.last_error,
    'source_checks', i.result_summary #> '{d10_promotion_failure,source_checks}')
    ORDER BY i.id), '[]'::jsonb)
  FROM public.lexeme_processing_items i
  WHERE i.job_id = p_job_id
    AND i.result_summary ->> 'promotion_status' = 'promotion_failed';
$body$;

REVOKE ALL ON FUNCTION public.d10_job_promotion_failures_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_job_promotion_failures_v1(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_job_promotion_failures_v1(uuid) TO service_role;

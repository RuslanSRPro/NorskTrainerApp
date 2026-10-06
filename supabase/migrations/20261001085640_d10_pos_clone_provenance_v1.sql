BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_lexeme_processing_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql
AS $function$
DECLARE
  v_total integer;
  v_done integer;
  v_not_found integer;
  v_failed integer;
  v_retry integer;
  v_processing integer;
  v_pending integer;
  v_success integer;
  v_status text;
  v_job_id uuid;
BEGIN
  SELECT job_id INTO v_job_id
  FROM lexeme_processing_items WHERE id = p_item_id;
  IF v_job_id IS NULL THEN RETURN; END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE c.status = 'done')::integer,
    count(*) FILTER (WHERE c.status = 'not_found')::integer,
    count(*) FILTER (WHERE c.status = 'failed')::integer,
    count(*) FILTER (WHERE c.status = 'retry_scheduled')::integer,
    count(*) FILTER (WHERE c.status = 'processing')::integer,
    count(*) FILTER (WHERE c.status = 'pending')::integer,
    count(*) FILTER (
      WHERE c.status = 'done' AND (
        c.found = true OR c.registered_entry = true
        OR c.whole_unit_match = true OR c.component_match = true
        OR c.usage_match = true
      )
    )::integer
  INTO v_total, v_done, v_not_found, v_failed,
       v_retry, v_processing, v_pending, v_success
  FROM lexeme_source_checks c WHERE c.item_id = p_item_id;

  IF v_total = 0 THEN v_status := 'pending';
  ELSIF v_processing > 0 THEN v_status := 'processing';
  ELSIF v_pending > 0 THEN v_status := 'pending';
  ELSIF v_retry > 0 THEN v_status := 'retry_scheduled';
  ELSIF v_failed > 0 THEN
    IF v_success > 0 THEN v_status := 'partial';
    ELSE v_status := 'failed'; END IF;
  ELSIF v_success > 0 THEN v_status := 'done';
  ELSIF v_not_found = v_total THEN v_status := 'failed';
  ELSE v_status := 'partial';
  END IF;

  UPDATE lexeme_processing_items AS i
  SET status = v_status,
      current_stage = 'source_checks',
      finished_at = CASE
        WHEN v_status IN ('done', 'partial', 'failed')
          THEN coalesce(i.finished_at, now())
        ELSE NULL
      END,
      result_summary = coalesce((
        SELECT jsonb_object_agg(e.key, e.value)
        FROM jsonb_each(coalesce(i.result_summary, '{}'::jsonb)) AS e
        WHERE e.key IN (
          'cloned_from_item_id', 'clone_reason',
          'clone_version', 'candidate_provenance'
        )
      ), '{}'::jsonb) || jsonb_build_object(
        'total_source_checks', v_total,
        'done', v_done,
        'not_found', v_not_found,
        'failed', v_failed,
        'retry_scheduled', v_retry,
        'processing', v_processing,
        'pending', v_pending,
        'successful_evidence', v_success
      )
  WHERE i.id = p_item_id;

  PERFORM recalculate_lexeme_processing_job(v_job_id);
END;
$function$;

COMMIT;
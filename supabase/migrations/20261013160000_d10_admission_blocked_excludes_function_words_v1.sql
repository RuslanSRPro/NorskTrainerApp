-- D10 plan A3 (D10_homonym_pos_plan_v1): the supervisor's final
-- "N items ended at admission_gate without promotion" check counts
-- blocked_count from d10_job_gray_family_audit_v1. Function words rejected on
-- purpose by the admission rules (Jeg, det ...) were counted there, so every
-- text with a pronoun ended as needs_manual_review, while the learner
-- completion snapshot (get_completion_evidence_snapshot_v1) already treats
-- exactly these items as intentionally excluded.
-- Change: blocked_count no longer counts them, using the SAME predicate as the
-- snapshot. gray_ids / gray_count are unchanged. A new key
-- excluded_function_word_count reports how many were left out.
-- Same signature, same grants; nothing else is changed or dropped.
CREATE OR REPLACE FUNCTION public.d10_job_gray_family_audit_v1(
  p_job_id uuid, p_item_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE v_gray_ids uuid[]; v_gray_count integer; v_blocked_count integer;
  v_function_word_count integer;
BEGIN
  IF p_job_id IS NULL OR p_item_ids IS NULL OR cardinality(p_item_ids)>30
     OR array_position(p_item_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_FAMILY_AUDIT_IDS';
  END IF;
  SELECT coalesce(array_agg(i.id),'{}'::uuid[]) INTO v_gray_ids
  FROM public.lexeme_processing_items i
  JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  WHERE i.job_id=p_job_id AND i.id=ANY(p_item_ids)
    AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  SELECT count(*) FILTER (WHERE family.item_id IS NOT NULL),
    count(*) FILTER (WHERE family.item_id IS NULL AND NOT fw.is_function_word),
    count(*) FILTER (WHERE family.item_id IS NULL AND fw.is_function_word)
    INTO v_gray_count,v_blocked_count,v_function_word_count
  FROM public.lexeme_processing_items i
  LEFT JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  -- Same rule as get_completion_evidence_snapshot_v1 (intentionally_excluded).
  CROSS JOIN LATERAL (SELECT coalesce(
        i.result_summary->>'admission_status'='rejected'
    AND i.result_summary->>'admission_reason' LIKE 'function_word_%'
    AND i.result_summary->'admission_decision'->>'admit'='false'
    AND i.result_summary->'admission_decision'->>'status'='rejected'
    AND i.result_summary->'admission_decision'->>'rule_type'='function_word',
    false) AS is_function_word) fw
  WHERE i.job_id=p_job_id AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  RETURN jsonb_build_object('ok',true,'gray_ids',v_gray_ids,
    'gray_count',v_gray_count,'blocked_count',v_blocked_count,
    'excluded_function_word_count',v_function_word_count);
END;
$body$;
REVOKE ALL ON FUNCTION public.d10_job_gray_family_audit_v1(uuid,uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_job_gray_family_audit_v1(uuid,uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_job_gray_family_audit_v1(uuid,uuid[]) TO service_role;

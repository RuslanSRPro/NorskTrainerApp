-- 77_d10_b1_text_context_clone_test.sql
-- Scenario test for migration 20261013200000 (plan B1) on real evidence.
-- Everything runs in one DO block that ends with RAISE EXCEPTION
-- 'D10_B1_REPORT ...', so all synthetic rows are rolled back.
-- Source: item "husker" (verb) of job 3779546f (context rule
-- preceded_by_subject_pronoun) with its finished source checks, and item "Er"
-- (verb, no_signal_fallback_to_verb). Each is copied into synthetic jobs and
-- expand_multi_pos_occurrences_for_job is called.
-- Expected after the migration:
--   T1 text job, husker (context rule)        -> 0 clones
--   T2 word_list job, husker                  -> >= 1 clone (unchanged)
--   T3 text job, Er (no_signal_fallback)      -> same count as T4 (unchanged, TEMPORARY rule)
--   T4 word_list job, Er                      -> reference
--   T5 legacy job without isolated_mode, husker -> >= 1 clone (unchanged)
DO $test$
DECLARE
  v_report text := '';
  v_case record;
  v_job uuid;
  v_item uuid;
  v_clones integer;
  v_results jsonb := '{}'::jsonb;
BEGIN
  FOR v_case IN
    SELECT * FROM (VALUES
      ('T1', 'dda6eba7-c497-4859-a07f-85da2c96deae'::uuid, '{"isolated_mode": false}'::jsonb),
      ('T2', 'dda6eba7-c497-4859-a07f-85da2c96deae'::uuid, '{"isolated_mode": true}'::jsonb),
      ('T3', '2dbd7ec4-3af8-47ff-be60-be23dfd51a5a'::uuid, '{"isolated_mode": false}'::jsonb),
      ('T4', '2dbd7ec4-3af8-47ff-be60-be23dfd51a5a'::uuid, '{"isolated_mode": true}'::jsonb),
      ('T5', 'dda6eba7-c497-4859-a07f-85da2c96deae'::uuid, '{}'::jsonb)
    ) AS c(code, source_item, summary)
  LOOP
    INSERT INTO public.lexeme_processing_jobs(status, input_text, summary)
    VALUES ('processing', 'D10 B1 test ' || v_case.code, v_case.summary || '{"d10_test": "77"}'::jsonb)
    RETURNING id INTO v_job;

    INSERT INTO public.lexeme_processing_items (
      job_id, lexeme_id, raw_input, normalized_input, normalized_lemma,
      surface_form, pos, match_type, status, current_stage,
      attempt_count, max_attempts, result_summary, expression_id)
    SELECT v_job, NULL, raw_input, normalized_input, normalized_lemma,
      surface_form, pos, match_type, 'done', 'source_checks',
      0, max_attempts, result_summary, NULL
    FROM public.lexeme_processing_items WHERE id = v_case.source_item
    RETURNING id INTO v_item;
    IF v_item IS NULL THEN
      RAISE EXCEPTION 'D10_B1_SETUP: source item % not found', v_case.source_item;
    END IF;

    INSERT INTO public.lexeme_source_checks (
      job_id, item_id, lexeme_id, source, stage, query, query_type,
      status, attempt_count, max_attempts, evidence, urls,
      authoritative_relations, surface_form, found, quality,
      registered_entry, whole_unit_match, component_match, usage_match)
    SELECT v_job, v_item, sc.lexeme_id, sc.source, sc.stage, sc.query, sc.query_type,
      sc.status, sc.attempt_count, sc.max_attempts, sc.evidence, sc.urls,
      sc.authoritative_relations, sc.surface_form, sc.found, sc.quality,
      sc.registered_entry, sc.whole_unit_match, sc.component_match, sc.usage_match
    FROM public.lexeme_source_checks sc WHERE sc.item_id = v_case.source_item;

    PERFORM public.expand_multi_pos_occurrences_for_job(v_job);

    SELECT count(*) INTO v_clones FROM public.lexeme_processing_items
    WHERE job_id = v_job AND result_summary ? 'cloned_from_item_id';
    v_results := v_results || jsonb_build_object(v_case.code, v_clones);
  END LOOP;

  v_report := v_report || format(E'\nT1 text + context rule -> no clones: %s (%s)',
    CASE WHEN (v_results->>'T1')::int = 0 THEN 'PASS' ELSE 'FAIL' END, v_results->>'T1');
  v_report := v_report || format(E'\nT2 word_list -> clones kept: %s (%s)',
    CASE WHEN (v_results->>'T2')::int >= 1 THEN 'PASS' ELSE 'FAIL (no POS evidence to clone?)' END, v_results->>'T2');
  v_report := v_report || format(E'\nT3 text + no_signal -> same as word_list (T4): %s (%s vs %s)',
    CASE WHEN (v_results->>'T3')::int = (v_results->>'T4')::int THEN 'PASS' ELSE 'FAIL' END,
    v_results->>'T3', v_results->>'T4');
  v_report := v_report || format(E'\nT5 legacy job without flag -> clones kept: %s (%s)',
    CASE WHEN (v_results->>'T5')::int = (v_results->>'T2')::int THEN 'PASS' ELSE 'FAIL' END, v_results->>'T5');

  RAISE EXCEPTION 'D10_B1_REPORT (everything rolled back):%', v_report;
END
$test$;

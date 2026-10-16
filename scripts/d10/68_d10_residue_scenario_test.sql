-- 68_d10_residue_scenario_test.sql
-- Synthetic test of the agreed residue rule on the LIVE ledger functions.
-- Everything runs inside one DO block that always ends with
-- RAISE EXCEPTION 'D10_RESIDUE_SCENARIO_REPORT ...', so the whole transaction
-- (synthetic job, items, ledger rows) is rolled back. Nothing stays behind.
-- Read the result in the error message: every line must be PASS.
--
-- Scenario (page of 20 = AI page size; the claim accepts at most 30 ids):
--   S1  chain naob claims all 20
--   S2  19 done, 1 retry  -> next claim returns ONLY that 1 item
--   S3  the item keeps failing -> after 3 attempts it is failed, nothing left
--   S4  summary: done 19, failed 1, waiting 0 (chain may advance)
--   S5  d10_job_enrichment_failures_v1 lists exactly that item
--   S6  next chain (lexeme_translation) claims all 20: the failed item
--       continues to the next chains (decision 12.10.2026)
--   S7  the other chain's ledger is independent: done 20, failed 0
--   S8  d10_enrichment_residue_attempts_v1 (migration 20261012200000) reports
--       failed/3 for the bad item and done/0 for a healthy one
-- Apply migration 20261012200000 before running this test.
DO $test$
DECLARE
  v_job uuid;
  v_ids uuid[];
  v_bad uuid;
  v_claimed uuid[];
  v_sum jsonb;
  v_fail jsonb;
  v_report text := '';
  i integer;
BEGIN
  INSERT INTO public.lexeme_processing_jobs(status, input_text, summary)
  VALUES ('processing', 'D10 residue scenario test', '{"d10_test": "68"}'::jsonb)
  RETURNING id INTO v_job;

  -- The ledger requires a real lexeme identity: reuse 20 existing lexeme ids
  -- (read only; the items and the ledger rows are rolled back).
  INSERT INTO public.lexeme_processing_items(job_id, raw_input, lexeme_id, match_type, current_stage, status, normalized_lemma, result_summary)
  SELECT v_job, 'testord' || n, l.id, 'token', 'semantic_audit', 'done', 'testord' || n, '{}'::jsonb
  FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM public.lexemes ORDER BY id LIMIT 20) l;
  IF (SELECT count(*) FROM public.lexeme_processing_items WHERE job_id = v_job) <> 20 THEN
    RAISE EXCEPTION 'D10_RESIDUE_SCENARIO_SETUP: fewer than 20 lexemes available';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.lexeme_processing_items WHERE job_id = v_job;
  v_bad := v_ids[7];

  -- S1
  SELECT coalesce(array_agg(item_id ORDER BY item_id), '{}') INTO v_claimed
  FROM public.d10_claim_enrichment_residue_v1(v_job, 'naob', v_ids, 180);
  v_report := v_report || format(E'\nS1 claim all 20: %s (%s)',
    CASE WHEN cardinality(v_claimed) = 20 THEN 'PASS' ELSE 'FAIL' END, cardinality(v_claimed));

  -- S2
  FOR i IN 1..20 LOOP
    IF v_ids[i] = v_bad THEN
      PERFORM public.d10_record_enrichment_outcome_v1(v_job, 'naob', v_ids[i], 'retry', 'retryable_worker_error', 'test timeout', '{}'::jsonb, 1);
    ELSE
      PERFORM public.d10_record_enrichment_outcome_v1(v_job, 'naob', v_ids[i], 'done', 'worker_completed', NULL, '{}'::jsonb, NULL);
    END IF;
  END LOOP;
  PERFORM pg_sleep(1.2);
  SELECT coalesce(array_agg(item_id), '{}') INTO v_claimed
  FROM public.d10_claim_enrichment_residue_v1(v_job, 'naob', v_ids, 180);
  v_report := v_report || format(E'\nS2 retry claims only the residue: %s (%s claimed)',
    CASE WHEN v_claimed = ARRAY[v_bad] THEN 'PASS' ELSE 'FAIL' END, cardinality(v_claimed));

  -- S3: second and third failed attempt
  PERFORM public.d10_record_enrichment_outcome_v1(v_job, 'naob', v_bad, 'retry', 'retryable_worker_error', 'test timeout 2', '{}'::jsonb, 1);
  PERFORM pg_sleep(1.2);
  SELECT coalesce(array_agg(item_id), '{}') INTO v_claimed
  FROM public.d10_claim_enrichment_residue_v1(v_job, 'naob', v_ids, 180);
  IF v_claimed = ARRAY[v_bad] THEN
    PERFORM public.d10_record_enrichment_outcome_v1(v_job, 'naob', v_bad, 'retry', 'retryable_worker_error', 'test timeout 3', '{}'::jsonb, 1);
  END IF;
  PERFORM pg_sleep(1.2);
  SELECT coalesce(array_agg(item_id), '{}') INTO v_claimed
  FROM public.d10_claim_enrichment_residue_v1(v_job, 'naob', v_ids, 180);
  v_report := v_report || format(E'\nS3 after 3 attempts nothing is claimed: %s (%s claimed)',
    CASE WHEN cardinality(v_claimed) = 0 THEN 'PASS' ELSE 'FAIL' END, cardinality(v_claimed));

  -- S4
  v_sum := public.d10_enrichment_residue_summary_v1(v_job, 'naob', v_ids);
  v_report := v_report || format(E'\nS4 summary done 19 / failed 1 / waiting 0: %s (%s)',
    CASE WHEN (v_sum->>'done')::int = 19 AND (v_sum->>'failed')::int = 1 AND (v_sum->>'waiting')::int = 0
      THEN 'PASS' ELSE 'FAIL' END, v_sum - 'failed_items');

  -- S5
  v_fail := public.d10_job_enrichment_failures_v1(v_job);
  v_report := v_report || format(E'\nS5 failure list has exactly the bad item: %s (%s rows)',
    CASE WHEN jsonb_array_length(v_fail) = 1 AND v_fail->0->>'item_id' = v_bad::text
      AND v_fail->0->>'chain' = 'naob' AND (v_fail->0->>'attempt_count')::int = 3 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_array_length(v_fail));

  -- S6
  SELECT coalesce(array_agg(item_id ORDER BY item_id), '{}') INTO v_claimed
  FROM public.d10_claim_enrichment_residue_v1(v_job, 'lexeme_translation', v_ids, 180);
  v_report := v_report || format(E'\nS6 next chain claims all 20 incl. the failed one: %s (%s, contains bad: %s)',
    CASE WHEN cardinality(v_claimed) = 20 AND v_bad = ANY(v_claimed) THEN 'PASS' ELSE 'FAIL' END,
    cardinality(v_claimed), v_bad = ANY(v_claimed));

  -- S7
  FOR i IN 1..20 LOOP
    PERFORM public.d10_record_enrichment_outcome_v1(v_job, 'lexeme_translation', v_ids[i], 'done', 'worker_completed', NULL, '{}'::jsonb, NULL);
  END LOOP;
  v_sum := public.d10_enrichment_residue_summary_v1(v_job, 'lexeme_translation', v_ids);
  v_report := v_report || format(E'\nS7 next chain ledger independent (done 20, failed 0): %s',
    CASE WHEN (v_sum->>'done')::int = 20 AND (v_sum->>'failed')::int = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- S8: attempt counts used by the worker to shrink an aggregate retry batch
  SELECT jsonb_object_agg(CASE WHEN a.item_id = v_bad THEN 'bad' ELSE 'ok' END,
           jsonb_build_object('status', a.status, 'attempts', a.attempt_count))
    INTO v_sum
  FROM public.d10_enrichment_residue_attempts_v1(v_job, 'naob', ARRAY[v_bad, v_ids[1]]) a;
  v_report := v_report || format(E'\nS8 attempts helper (bad failed/3, other done/0): %s (%s)',
    CASE WHEN v_sum #>> '{bad,status}' = 'failed' AND (v_sum #>> '{bad,attempts}')::int = 3
      AND v_sum #>> '{ok,status}' = 'done' AND (v_sum #>> '{ok,attempts}')::int = 0 THEN 'PASS' ELSE 'FAIL' END, v_sum);

  RAISE EXCEPTION 'D10_RESIDUE_SCENARIO_REPORT (everything rolled back):%', v_report;
END
$test$;

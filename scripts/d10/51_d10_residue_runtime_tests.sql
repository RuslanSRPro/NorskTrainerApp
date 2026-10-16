-- Run on local/staging Postgres only. Every mutation is rolled back.
BEGIN;

DO $test$
DECLARE
  v_job uuid;
  v_item uuid;
  v_claimed uuid;
  v_attempt integer;
  v_status text;
BEGIN
  SELECT i.job_id,i.id INTO v_job,v_item
  FROM public.lexeme_processing_items i
  ORDER BY i.id LIMIT 1;
  IF v_item IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_ONE_PROCESSING_ITEM'; END IF;

  DELETE FROM private.d10_job_enrichment_item_state_v1
  WHERE job_id=v_job AND chain='ordbokene' AND item_id=v_item;

  SELECT item_id INTO v_claimed FROM public.d10_claim_enrichment_residue_v1(
    v_job,'ordbokene',ARRAY[v_item],60);
  IF v_claimed IS DISTINCT FROM v_item THEN RAISE EXCEPTION 'INITIAL_CLAIM_FAILED'; END IF;

  FOR n IN 1..3 LOOP
    UPDATE private.d10_job_enrichment_item_state_v1
    SET started_at=clock_timestamp()-interval '61 seconds'
    WHERE job_id=v_job AND chain='ordbokene' AND item_id=v_item;
    PERFORM * FROM public.d10_claim_enrichment_residue_v1(
      v_job,'ordbokene',ARRAY[v_item],60);
  END LOOP;

  SELECT attempt_count,status INTO v_attempt,v_status
  FROM private.d10_job_enrichment_item_state_v1
  WHERE job_id=v_job AND chain='ordbokene' AND item_id=v_item;
  IF v_attempt<>3 OR v_status<>'failed' THEN
    RAISE EXCEPTION 'STALE_PROCESSING_NOT_TERMINAL: attempt=%, status=%',v_attempt,v_status;
  END IF;
END;
$test$;

DO $test$
DECLARE v_lexeme uuid; v_expression uuid; v_example uuid; v_found integer;
BEGIN
  SELECT e.lexeme_id,x.expression_id,x.id INTO v_lexeme,v_expression,v_example
  FROM public.expression_catalog e
  JOIN public.entity_examples x ON x.expression_id=e.id AND x.lexeme_id IS NULL
  WHERE e.lexeme_id IS NOT NULL AND x.language_code='nb'
  ORDER BY x.id LIMIT 1;
  IF v_example IS NULL THEN
    RAISE NOTICE 'SKIP expression example bridge: no suitable fixture';
    RETURN;
  END IF;
  SELECT count(*) INTO v_found
  FROM public.get_lexeme360_examples_v1(ARRAY[v_lexeme],'{}'::uuid[]) r
  WHERE r.id=v_example AND r.expression_id=v_expression;
  IF v_found<>1 THEN RAISE EXCEPTION 'EXPRESSION_EXAMPLE_BRIDGE_FAILED'; END IF;
END;
$test$;

ROLLBACK;

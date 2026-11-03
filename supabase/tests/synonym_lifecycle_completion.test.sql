BEGIN;
DO $test$
DECLARE j uuid; card uuid; v jsonb; c public.synonym_candidate_queue%rowtype; n integer; fake uuid:=gen_random_uuid();
BEGIN
 SELECT i.job_id,i.lexeme_id INTO STRICT j,card FROM public.lexeme_processing_items i
 JOIN public.lexeme_processing_jobs jobs ON jobs.id=i.job_id
 WHERE jobs.status='completed' AND jobs.input_type<>'synonym_candidate' AND jobs.total_items<=10 AND i.lexeme_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM private.d10_job_enrichment_item_state_v1 e WHERE e.job_id=i.job_id AND e.item_id=i.id AND e.chain='ordbokene' AND e.status IN ('done','no_data'))
 AND NOT EXISTS(SELECT 1 FROM private.d10_job_enrichment_item_state_v1 e WHERE e.job_id=i.job_id AND e.status NOT IN ('done','no_data'))
 ORDER BY jobs.created_at DESC LIMIT 1;
 DELETE FROM private.synonym_family_completed_v1 WHERE job_id=j;
 INSERT INTO private.d10_deferred_enrichment_v1(lexeme_id,facets,reason,job_id)
 VALUES(card,ARRAY['family_360'],'synonym_child_job',j) ON CONFLICT(lexeme_id) DO UPDATE SET facets=EXCLUDED.facets;
 v:=public.d10_synonym_after_job_v1(j);
 ASSERT v->>'ok'='true' AND v->'bm'->>'ok'='true','completion failed';
 ASSERT EXISTS(SELECT 1 FROM private.d10_deferred_enrichment_v1 WHERE lexeme_id=card),'marker absent must preserve deferred family';
 INSERT INTO private.synonym_family_completed_v1(job_id) VALUES(j);
 UPDATE public.pipeline_supervisor_state SET enrichment_offsets=enrichment_offsets||'{"__d10_family_injection_skipped_v1__":1}'::jsonb WHERE job_id=j;
 v:=public.d10_synonym_after_job_v1(j);
 ASSERT EXISTS(SELECT 1 FROM private.d10_deferred_enrichment_v1 WHERE lexeme_id=card),'skipped family must preserve deferred';
 UPDATE public.pipeline_supervisor_state SET enrichment_offsets=enrichment_offsets-'__d10_family_injection_skipped_v1__' WHERE job_id=j;
 v:=public.d10_synonym_after_job_v1(j);
 ASSERT NOT EXISTS(SELECT 1 FROM private.d10_deferred_enrichment_v1 WHERE lexeme_id=card),'successful confirmed full job must clear deferred';

 PERFORM public.d10_synonym_job_error_v1(j,'test_failure');
 PERFORM public.d10_synonym_job_error_v1(j,'test_failure');
 PERFORM public.d10_synonym_job_error_v1(j,'test_failure');
 ASSERT EXISTS(SELECT 1 FROM private.synonym_job_retry_v1 WHERE job_id=j AND attempts=3 AND status='failed'),'job retry must stop visibly';

 SELECT * INTO STRICT c FROM public.synonym_candidate_queue WHERE source_active AND dispatch_status IN ('enrichment_done','skipped_ready') AND source_entity_type='lexeme' AND target_kind='lexeme' LIMIT 1;
 -- Over 500 relations must be queued durably; only 50 are processed synchronously.
 INSERT INTO public.synonym_candidate_queue
 SELECT (jsonb_populate_record(NULL::public.synonym_candidate_queue,to_jsonb(c)||jsonb_build_object(
  'id',gen_random_uuid(),'pipeline_version','pagination-test-'||fake||'-'||g.n,
  'source_job_id',j,'source_active',true))).*
 FROM generate_series(1,501)g(n);
 v:=public.d10_synonym_prepare_for_job_v1(j);
 SELECT count(*) INTO n FROM private.synonym_refresh_queue_v1 q JOIN public.synonym_candidate_queue cc ON cc.id=q.candidate_id
 WHERE cc.pipeline_version LIKE 'pagination-test-'||fake||'-%';
 ASSERT n=501,'relations beyond 500 lost';
 ASSERT EXISTS(SELECT 1 FROM private.synonym_refresh_queue_v1 q JOIN public.synonym_candidate_queue cc ON cc.id=q.candidate_id
 WHERE cc.pipeline_version LIKE 'pagination-test-'||fake||'-%' AND q.status='pending'),'remainder not durable';
END $test$;
SELECT 'PASS: deferred-family evidence, bounded job retry, 501-candidate pagination' tests;
ROLLBACK;

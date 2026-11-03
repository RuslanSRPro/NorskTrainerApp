BEGIN;
DO $test$
DECLARE c public.synonym_candidate_queue%rowtype;tag text:='coverage-'||gen_random_uuid();n integer;
BEGIN
 SELECT * INTO STRICT c FROM public.synonym_candidate_queue WHERE origin_depth=0 AND source_active LIMIT 1;
 INSERT INTO public.synonym_candidate_queue
 SELECT (jsonb_populate_record(NULL::public.synonym_candidate_queue,to_jsonb(c)||jsonb_build_object(
  'id',gen_random_uuid(),'pipeline_version',tag||g.n,'target_text',tag,'target_kind','lexeme',
  'child_job_id',NULL,'target_entity_ids','[]'::jsonb,'verification_evidence','{}'::jsonb,
  'stage1_status','needs_manual_review','dispatch_status',CASE g.n WHEN 1 THEN 'not_dispatchable' ELSE 'enrichment_done' END))).*
 FROM generate_series(1,2) g(n);
 SELECT count(*) INTO n FROM public.d10_synonym_unresolved_v2(1000,0) WHERE target_text=tag;
 ASSERT n=1,'different stop reasons duplicate the same candidate text';
 ASSERT EXISTS(SELECT 1 FROM public.d10_synonym_unresolved_v2(1000,0)
  WHERE target_text=tag AND cardinality(candidate_ids)=2 AND reason='not_dispatchable'),'candidate origins lost';
END $test$;
SELECT 'PASS: mixed stop reasons produce one row and retain both candidate IDs' tests;
ROLLBACK;

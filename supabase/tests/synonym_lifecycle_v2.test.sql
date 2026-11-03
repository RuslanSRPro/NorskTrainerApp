BEGIN;
DO $test$
DECLARE p public.synonym_pair_v1%rowtype; c public.synonym_candidate_queue%rowtype;
 a jsonb; b jsonb; key1 text; key2 text; v jsonb; n integer; events_before integer; fake uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT p FROM public.synonym_pair_v1 WHERE status='done' AND decision='verified_synonym'
  AND target_entity_type='lexeme' ORDER BY id LIMIT 1;
 a:=p.snapshot;
 key1:=public.d10_synonym_pair_content_key_v1(a,p.target_entity_id,p.target_article_key);
 b:=jsonb_set(a,'{source,translations}', '{"uk":"changed translation"}'::jsonb);
 ASSERT key1<>public.d10_synonym_pair_content_key_v1(b,p.target_entity_id,p.target_article_key),'translation must invalidate';
 b:=jsonb_set(a,'{source,part_of_speech}','"noun"'::jsonb);
 IF a->'source'->>'part_of_speech'='noun' THEN b:=jsonb_set(a,'{source,part_of_speech}','"verb"'::jsonb); END IF;
 ASSERT key1<>public.d10_synonym_pair_content_key_v1(b,p.target_entity_id,p.target_article_key),'POS must invalidate';
 b:=jsonb_set(a,'{target,examples_nb}','["a changed example"]'::jsonb);
 ASSERT key1<>public.d10_synonym_pair_content_key_v1(b,p.target_entity_id,p.target_article_key),'example must invalidate';
 b:=jsonb_set(a,'{candidate,source_job_id}',to_jsonb(gen_random_uuid()::text));
 ASSERT key1=public.d10_synonym_pair_content_key_v1(b,p.target_entity_id,p.target_article_key),'job ID must not invalidate';

 SELECT * INTO STRICT c FROM public.synonym_candidate_queue WHERE id=p.candidate_id;
 v:=public.d10_synonym_prepare_candidate_v1(c.id,false);
 ASSERT v->>'ok'='true','prepare failed';
 SELECT snapshot_hash INTO key1 FROM public.synonym_pair_v1 WHERE id=p.id;
 v:=public.d10_synonym_prepare_candidate_v1(c.id,false);
 SELECT snapshot_hash INTO key2 FROM public.synonym_pair_v1 WHERE id=p.id;
 ASSERT key1=key2 AND (v->>'written')::integer=0,'identical re-run must be idempotent';

 -- Force bypasses copying/rules and withdraws publication while the result is pending.
 UPDATE public.synonym_pair_v1 SET status='done',decision='verified_synonym',force_recheck=false,
  verifier_version=public.d10_synonym_verifier_version_v1(),
  verification_evidence='{"substitution_forward":true,"substitution_reverse":true,"same_construction":true}'::jsonb
 WHERE id=p.id;
 PERFORM public.d10_synonym_enqueue_refresh_v1(c.id,NULL,'test_force',true);
 UPDATE public.synonym_pair_v1 SET force_recheck=true WHERE id=p.id;
 v:=public.d10_synonym_prepare_candidate_v1(c.id,false);
 ASSERT EXISTS(SELECT 1 FROM public.synonym_pair_v1 WHERE id=p.id AND status='queued' AND decision IS NULL AND NOT published),'force must reset decision';
 PERFORM public.d10_synonym_rule_verify_v1(500);
 ASSERT EXISTS(SELECT 1 FROM public.synonym_pair_v1 WHERE id=p.id AND status='queued'),'force must bypass rule';

 SELECT count(*) INTO events_before FROM private.synonym_pair_events_v1 WHERE pair_id=p.id;
 UPDATE public.synonym_pair_v1 SET status='done',decision='rejected',verified_at=now(),force_recheck=false WHERE id=p.id;
 ASSERT (SELECT count(*) FROM private.synonym_pair_events_v1 WHERE pair_id=p.id)>events_before,'negative result not logged';
 ASSERT EXISTS(SELECT 1 FROM private.synonym_pair_events_v1 WHERE pair_id=p.id AND after_row->>'decision'='rejected'
  AND after_row->'snapshot' IS NOT NULL AND recorded_at IS NOT NULL),'negative snapshot/date missing';

 INSERT INTO private.synonym_collection_state_v1(entity_type,entity_id,status,reason) VALUES('lexeme',fake,'complete','no_candidates_in_source');
 ASSERT public.d10_synonym_entity_status_v1('lexeme',fake)->>'status'='no_candidates','successful empty search should not be error';
 UPDATE private.synonym_collection_state_v1 SET status='error',reason='no_article' WHERE entity_id=fake;
 ASSERT public.d10_synonym_entity_status_v1('lexeme',fake)->>'status'='error','missing source is not a confident negative';
 ASSERT (SELECT count(*) FROM private.synonym_collection_events_v1 WHERE entity_id=fake)=2,'collection attempts not both recorded';
 ASSERT NOT (SELECT enabled FROM public.synonym_bm_config_v1 WHERE singleton),'mass collector must stay disabled';
 ASSERT (SELECT after_analysis_enabled FROM public.synonym_bm_config_v1 WHERE singleton),'analysis collection should stay enabled';

 UPDATE public.synonym_candidate_queue SET source_active=false WHERE id=c.id;
 ASSERT NOT EXISTS(SELECT 1 FROM public.synonym_pair_v1 WHERE candidate_id=c.id AND status<>'superseded'),'withdrawn source left live pairs';
 ASSERT NOT has_function_privilege('anon','public.d10_synonym_recheck_entity_v1(text,uuid,boolean)','execute'),'anonymous force recheck allowed';
 ASSERT NOT has_function_privilege('authenticated','public.d10_synonym_recheck_entity_v1(text,uuid,boolean)','execute'),'unrestricted paid force recheck allowed';
END $test$;
SELECT 'PASS: evidence changes, idempotence, force bypass, negative history, zero candidates, source retirement, permissions, mass OFF' AS tests;
ROLLBACK;

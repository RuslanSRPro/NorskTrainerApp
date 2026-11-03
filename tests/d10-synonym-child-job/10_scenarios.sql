\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;

-- data
insert into lexemes(id,lemma,pos,verification_status,created_at) values
 ('00000000-0000-0000-0000-0000000000b1','bryte','verb','authoritative', now()-interval '1 day'),
 ('00000000-0000-0000-0000-0000000000b2','bryte','verb','authoritative', now()-interval '1 day'),
 ('00000000-0000-0000-0000-0000000000a1','skje','noun','authoritative', now()-interval '1 day'),
 ('00000000-0000-0000-0000-0000000000a2','skje','verb',null, now()-interval '1 day');
update lexemes set homograph_key='II' where id='00000000-0000-0000-0000-0000000000b2';
insert into expression_catalog(id,lemma,normalized_key,lexeme_id,verification_status) values
 ('00000000-0000-0000-0000-00000000e001','gi opp','gi opp',null,'authoritative'),
 ('00000000-0000-0000-0000-00000000e002','finne sted','finne sted',null,'authoritative'),
 ('00000000-0000-0000-0000-00000000e003','stryke med','stryke med',null,'authoritative'),
 ('00000000-0000-0000-0000-00000000e004','gå konkurs','gå konkurs',null,'candidate'),
 ('00000000-0000-0000-0000-00000000e005','gå over ende','gå over ende',null,'authoritative');
insert into naob_expression_glosses(normalized_key,naob_slug,anchor_id,gloss_text,gloss_type,gloss_index) values
 ('gi opp','gi_2','a1','ikke yte videre innsats; bryte; jf. oppgi','direct',0),
 ('finne sted','finne','a2','skje; hende','direct',0),
 ('stryke med','stryke','a3','dø; omkomme','direct',0),
 ('gå over ende','gå','a4','gå konkurs; møte (noen); se satse','direct',0),
 ('gå over ende','gå','a5','se satse','reference',1);
insert into lexeme_processing_jobs(id,user_id,input_type,input_text,created_at) values
 ('00000000-0000-0000-0000-0000000000f1','u1','text','tekst', now()-interval '1 hour');
insert into lexeme_processing_items(job_id,expression_id,normalized_lemma,match_type,status,current_stage) values
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-00000000e001','gi opp','expression','done','semantic_audit'),
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-00000000e002','finne sted','expression','done','semantic_audit'),
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-00000000e003','stryke med','expression','done','semantic_audit'),
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-00000000e005','gå over ende','expression','done','semantic_audit');

-- 0. the migration switched it on with 50 / 50
select pg_temp.ok((select pipeline_enabled and dispatcher_batch_size=50 and daily_job_limit=50 from synonym_pipeline_config),'migration: on, 50 targets, 50 jobs/day');
update synonym_pipeline_config set pipeline_enabled=false;
-- 1. disabled: collect only
select pg_temp.ok((d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f1')->'dispatch'->>'reason')='pipeline_disabled','disabled -> no dispatch');
select pg_temp.ok((select count(*) from synonym_candidate_queue)=8,'collected 8 terms: jf. and se dropped, (noen) stripped');
select target_text, target_kind, dispatch_status, stage1_status, synonym_group_key, root_synonym_lemma from synonym_candidate_queue order by synonym_group_key, target_text;
select pg_temp.ok((select count(*) from lexeme_processing_jobs where input_type='synonym_candidate')=0,'no child job while disabled');
-- 2. idempotent
select pg_temp.ok((d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f1')->>'collected')::int=0,'second collect adds nothing');
-- 3. enable
update synonym_pipeline_config set pipeline_enabled=true;
select d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((select count(*) from lexeme_processing_jobs where input_type='synonym_candidate')=1,'one child job');
select j.input_text, j.total_items, j.summary->>'origin_depth' depth from lexeme_processing_jobs j where input_type='synonym_candidate';
select i.normalized_lemma, i.pos, i.match_type, i.expression_id is not null has_expr, i.result_summary->>'resolved_lexeme_id' resolved,
  (select count(*) from lexeme_source_checks s where s.item_id=i.id) checks
from lexeme_processing_items i join lexeme_processing_jobs j on j.id=i.job_id where j.input_type='synonym_candidate' order by 1;
select target_text, dispatch_status, child_job_id is not null in_job from synonym_candidate_queue order by target_text;
select pg_temp.ok((select dispatch_status from synonym_candidate_queue where target_text='bryte')='skipped_ready','bryte ready -> skipped_ready (no item)');
select pg_temp.ok(not exists(select 1 from lexeme_processing_items where normalized_lemma='bryte'),'no item for bryte');
select pg_temp.ok((select count(*) from lexeme_processing_items i join lexeme_processing_jobs j on j.id=i.job_id where j.input_type='synonym_candidate' and normalized_lemma='skje')=1
  and (select pos from lexeme_processing_items where normalized_lemma='skje')='verb','skje: only the unverified verb card gets an item');
select pg_temp.ok((select dispatch_status from synonym_candidate_queue where target_text='ikke yte videre innsats')='not_dispatchable','unknown 4-word expression not dispatched');
-- 4. second call: nothing pending -> no new child job, no second item
select d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((select count(*) from lexeme_processing_jobs where input_type='synonym_candidate')=1,'repeat call creates no second child job');
-- 5. discovery order
insert into lexeme_processing_jobs(id,user_id,input_type,input_text,created_at) values ('00000000-0000-0000-0000-0000000000f2','u1','text','x', now()+interval '1 minute');
select pg_temp.ok((select array_agg(input_type order by ord) from (select j.input_type, row_number() over () ord from get_active_pipeline_jobs(200) g join lexeme_processing_jobs j on j.id=g.id) q)
  = array['text','text','synonym_candidate'],'user jobs first, child last');
-- 6. child job ends: promotion simulated
select id as child from lexeme_processing_jobs where input_type='synonym_candidate' \gset
insert into lexemes(id,lemma,pos,verification_status,created_at) values ('00000000-0000-0000-0000-0000000000c1','hende','verb','authoritative', now()+interval '2 minute');
update lexeme_processing_items set lexeme_id='00000000-0000-0000-0000-0000000000c1' where job_id=:'child' and normalized_lemma='hende';
update lexeme_processing_items set lexeme_id='00000000-0000-0000-0000-0000000000a2' where job_id=:'child' and normalized_lemma='skje';
insert into naob_expression_glosses(normalized_key,naob_slug,anchor_id,gloss_text,gloss_type,gloss_index) values ('gå konkurs','gå','a9','slå seg konkurs; fallere','direct',0);
-- a new user-job candidate waits for the next child job
insert into naob_expression_glosses(normalized_key,naob_slug,anchor_id,gloss_text,gloss_type,gloss_index) values ('gi opp','gi_2','a7','oppgi','direct',1);
select d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f2');  -- unrelated user job: nothing, child active
select pg_temp.ok((select count(*) from synonym_candidate_queue where target_text='oppgi')=0,'f2 has no items -> nothing collected for f1 glosses');
select d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((select dispatch_status from synonym_candidate_queue where target_text='oppgi')='in_child_job'
  and (select count(*) from lexeme_processing_jobs where input_type='synonym_candidate')=2,'new candidate goes at once to a new child job (no wait)');
select d10_synonym_after_job_v1(:'child');
select pg_temp.ok((select count(*) from synonym_candidate_queue where child_job_id=:'child' and dispatch_status='enrichment_done')=6,'child candidates enrichment_done');
select pg_temp.ok((select target_entity_ids->0->>'pos' from synonym_candidate_queue where target_text='hende')='verb','target cards recorded');
select pg_temp.ok((select count(*) from private.d10_deferred_enrichment_v1)=1 and exists(select 1 from private.d10_deferred_enrichment_v1 where lexeme_id='00000000-0000-0000-0000-0000000000c1'),'only the card created by the child job is deferred (not old skje)');
select pg_temp.ok((select dispatch_status from synonym_candidate_queue where target_text='fallere')='deferred_depth' and (select origin_depth from synonym_candidate_queue where target_text='fallere')=1,'depth-1 candidates kept, not dispatched');
select pg_temp.ok((select count(*) from lexeme_processing_jobs where input_type='synonym_candidate')=2,'ending child creates no job for depth-1 candidates');
select pg_temp.ok(not exists(select 1 from lexeme_processing_items i join synonym_candidate_queue c on c.child_job_id=i.job_id where c.target_text='fallere'),'no item for depth-1 candidate');
-- 7. problem list
select lemma, pos, deferred_by_policy, deferred_facets, missing_translation from d10_problem_cards_v2(300) order by lemma;
select pg_temp.ok(exists(select 1 from d10_problem_cards_v2(300) where lexeme_id='00000000-0000-0000-0000-0000000000c1' and deferred_by_policy),'hende in problem list as deferred');
select pg_temp.ok(d10_problem_cards_count_v2() >= 1,'count v2');
-- 8. rerun by a normal job clears the mark
insert into lexeme_processing_jobs(id,user_id,input_type,input_text) values ('00000000-0000-0000-0000-0000000000f3','u1','text','hende');
insert into lexeme_processing_items(job_id,lexeme_id,normalized_lemma,match_type,status,current_stage) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c1','hende','token','done','semantic_audit');
select d10_synonym_after_job_v1('00000000-0000-0000-0000-0000000000f3');
select pg_temp.ok(not exists(select 1 from private.d10_deferred_enrichment_v1),'normal job clears deferred mark');
-- 9. rights
set role anon;
do $$ begin perform public.d10_synonym_after_job_v1(gen_random_uuid()); raise exception 'FAIL anon executed'; exception when insufficient_privilege then raise notice 'ok: anon cannot execute'; end $$;
reset role;
set role authenticated;
do $$ begin perform public.d10_synonym_dispatch_v1(null); raise exception 'FAIL auth executed'; exception when insufficient_privilege then raise notice 'ok: authenticated cannot dispatch'; end $$;
reset role;
-- 10. disabled again: nothing dispatched
update synonym_pipeline_config set pipeline_enabled=false;
select pg_temp.ok((d10_synonym_dispatch_v1(null)->>'reason')='pipeline_disabled','disable stops dispatch');
-- 11. batch split: 3 targets, batch 2 -> two child jobs at once
update synonym_pipeline_config set pipeline_enabled=true, dispatcher_batch_size=2, daily_job_limit=50;
insert into naob_expression_glosses(normalized_key,naob_slug,anchor_id,gloss_text,gloss_type,gloss_index) values ('stryke med','stryke','a8','krepere; avgå; sovne','direct',1);
select d10_synonym_collect_job_v1('00000000-0000-0000-0000-0000000000f1');
select (d10_synonym_dispatch_v1(null)->'child_job_ids') as ids \gset
select pg_temp.ok(jsonb_array_length(:'ids'::jsonb)=2,'3 targets with batch 2 -> 2 child jobs');
-- 12. daily limit
update synonym_pipeline_config set daily_job_limit=(select count(*) from lexeme_processing_jobs where input_type='synonym_candidate');
insert into naob_expression_glosses(normalized_key,naob_slug,anchor_id,gloss_text,gloss_type,gloss_index) values ('stryke med','stryke','b1','vandre heden','direct',2);
select d10_synonym_collect_job_v1('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((d10_synonym_dispatch_v1(null)->>'daily_limit_reached')::boolean and (select dispatch_status from synonym_candidate_queue where target_text='vandre heden')='pending','daily limit: remainder waits');

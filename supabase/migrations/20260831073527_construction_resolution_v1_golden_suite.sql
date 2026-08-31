do $migration$
begin
  if exists(select 1 from public.grammar_golden_tests where code like 'gt.construction_resolution_v1.%') then
    raise exception 'Construction Resolution V1 goldens already exist';
  end if;

  insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,expected_language_graph,status,test_layer,target_phase,input_fixture,expected_rule_matches)
  values
  ('gt.construction_resolution_v1.modal_singleton_decision','positive','Han kan ringe.',true,
   '{"family":"modal_auxiliary_bare_infinitive","decision":"selected","reason_code":"resolved_singleton_or_compatible_candidate"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"modal_auxiliary_bare_infinitive","surface":"kan ringe"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_singleton_group','positive','Han kan ringe.',true,
   '{"status":"resolved","reason_code":"singleton_supported_construction","requires_resolution":false}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"group","surface":"kan ringe"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.marked_infinitive_selected','positive','Jeg liker å lese.',true,
   '{"family":"marked_infinitive","decision":"selected"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"marked_infinitive","surface":"å lese"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.aux_nonfinite_selected','positive','Han har gått.',true,
   '{"family":"auxiliary_nonfinite_complement","decision":"selected"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"auxiliary_nonfinite_complement","surface":"har gått"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.aux_nonfinite_provenance','positive','Han har gått.',true,
   '{"has_source":true}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision_provenance","family":"auxiliary_nonfinite_complement","candidate_code":"verb.compound_form.finite_aux_nonfinite_main"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.copular_noun_selected','positive','Han er lærer.',true,
   '{"family":"copular_predicative","decision":"selected"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"copular_predicative","surface":"er lærer"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.copular_adjective_selected','positive','Han er stor.',true,
   '{"family":"copular_predicative","decision":"selected"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"copular_predicative","surface":"er stor"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.copular_ambiguous_unresolved','boundary','Han er sky.',true,
   '{"family":"copular_predicative","decision":"unresolved","reason_code":"recognition_hypothesis_requires_discriminating_evidence"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"copular_predicative","surface":"er sky"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.copular_ambiguous_group','boundary','Han er sky.',true,
   '{"status":"unresolved","reason_code":"recognition_hypothesis_requires_discriminating_evidence","requires_resolution":true}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"group","surface":"er sky"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.passive_blocker_prevents_selection','contrastive','Han blir rost.',true,
   '{"family":"copular_predicative","decision":"unresolved","reason_code":"blocked_competitor_overlap"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"copular_predicative","surface":"blir rost"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.passive_blocker_preserved','boundary','Han blir rost.',true,
   '{"family":"passive","status":"upstream_blocked"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"blocked","family":"passive"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_group_resolved','positive','Han vil kunne gå.',true,
   '{"status":"resolved","reason_code":"compatible_modal_chain_composition","requires_resolution":false}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"group","surface":"vil kunne"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_primary_selected','positive','Han vil kunne gå.',true,
   '{"family":"modal_auxiliary_chain","decision":"selected","reason_code":"modal_chain_primary_composite"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision","family":"modal_auxiliary_chain","surface":"vil kunne"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_components_count','positive','Han vil kunne gå.',true,
   '{"count":2}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision_count","decision":"compatible_component","family":"modal_auxiliary_bare_infinitive"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_relation_count','positive','Han vil kunne gå.',true,
   '{"count":3}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"relation_count","relation":"compatible"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_relation_reason','positive','Han vil kunne gå.',true,
   '{"relation":"compatible","reason_code":"modal_chain_component"}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"relation","reason_code":"modal_chain_component"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_chain_provenance','positive','Han vil kunne gå.',true,
   '{"has_source":true}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision_provenance","family":"modal_auxiliary_chain","candidate_code":"verb.modal_auxiliary.chain.finiteness"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_ellipsis_blocked_group','boundary','Han skal hjem.',true,
   '{"status":"blocked","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1","requires_resolution":true}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"blocked_group","family":"modal_ellipsis_motion"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.modal_ellipsis_no_decision','negative','Han skal hjem.',true,
   '{"count":0}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"decision_count","decision":"selected"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.no_construction_empty','negative','Han sover.',true,
   '{"group_count":0,"selected_count":0,"unresolved_decision_count":0}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"summary"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.document_isolation','regression','Jeg kan ringe. Han er sky.',true,
   '{"sentence1":{"decision":"selected"},"sentence2":{"decision":"unresolved"}}'::jsonb,'implemented','end_to_end','construction_resolution',
   '{"kind":"document"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.recognition_immutable_modal','regression','Han vil kunne gå.',true,
   '{"equal":true}'::jsonb,'implemented','pipeline_integration','construction_resolution',
   '{"kind":"recognition_parity"}'::jsonb,'[]'::jsonb),
  ('gt.construction_resolution_v1.synthetic_unknown_overlap_competes','boundary','synthetic-overlap',true,
   '{"relation":"competing","reason_code":"unknown_overlap_defaults_to_competing"}'::jsonb,'implemented','runtime_component','construction_resolution',
   jsonb_build_object('kind','synthetic_relation','analysis',jsonb_build_object('language_graph',jsonb_build_object('construction_recognition_v1',jsonb_build_object(
     'constructions',jsonb_build_array(
       jsonb_build_object('id','synthetic:a','family','family_a','status','recognized','surface','a b','span_start',1,'span_end',2),
       jsonb_build_object('id','synthetic:b','family','family_b','status','recognized','surface','b c','span_start',2,'span_end',3)
     ),
     'overlaps',jsonb_build_array(jsonb_build_object('left_id','synthetic:a','right_id','synthetic:b','relation','overlaps','requires_resolution',true)),
     'blocked_events','[]'::jsonb
   )))),'[]'::jsonb),
  ('gt.construction_resolution_v1.synthetic_unknown_overlap_unresolved','boundary','synthetic-overlap',true,
   '{"status":"unresolved","reason_code":"competing_overlap_without_resolution_rule"}'::jsonb,'implemented','runtime_component','construction_resolution',
   jsonb_build_object('kind','synthetic_group','analysis',jsonb_build_object('language_graph',jsonb_build_object('construction_recognition_v1',jsonb_build_object(
     'constructions',jsonb_build_array(
       jsonb_build_object('id','synthetic:a','family','family_a','status','recognized','surface','a b','span_start',1,'span_end',2),
       jsonb_build_object('id','synthetic:b','family','family_b','status','recognized','surface','b c','span_start',2,'span_end',3)
     ),
     'overlaps',jsonb_build_array(jsonb_build_object('left_id','synthetic:a','right_id','synthetic:b','relation','overlaps','requires_resolution',true)),
     'blocked_events','[]'::jsonb
   )))),'[]'::jsonb);
end;
$migration$;

create or replace function public.run_construction_resolution_golden_v1(p_release_code text default 'runtime-structural-v1.9')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_parent_doc jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_resolution jsonb; v_family text; v_surface text; v_kind text; v_candidate_code text; v_analysis jsonb;
begin
  select r.id,r.status into v_release_id,v_status from public.grammar_runtime_releases r where r.code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Construction Resolution Golden accepts build/golden, got %',v_status; end if;

  for t in select * from public.grammar_golden_tests where code like 'gt.construction_resolution_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_family:=t.input_fixture->>'family'; v_surface:=t.input_fixture->>'surface';

    if v_kind like 'synthetic_%' then
      v_analysis:=t.input_fixture->'analysis';
      v_resolution:=public.resolve_constructions_v1(v_analysis,p_release_code);
      v_doc:=null;
    else
      v_doc:=public.analyze_text_structural_shadow_v9(t.sentence,p_release_code);
      v_resolution:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_resolution_v1}','{}'::jsonb);
    end if;

    if v_kind='decision' then
      select x into v_actual from jsonb_array_elements(coalesce(v_resolution->'construction_decisions','[]'::jsonb)) x
      where (v_family is null or x->>'family'=v_family) and (v_surface is null or x->>'surface'=v_surface) order by x->>'construction_id' limit 1;
    elsif v_kind='group' then
      select g into v_actual from jsonb_array_elements(coalesce(v_resolution->'resolution_groups','[]'::jsonb)) g
      where exists(select 1 from jsonb_array_elements(coalesce(v_resolution->'construction_decisions','[]'::jsonb)) d where d->>'group_id'=g->>'group_id' and (v_surface is null or d->>'surface'=v_surface)) limit 1;
    elsif v_kind='blocked' then
      select x into v_actual from jsonb_array_elements(coalesce(v_resolution->'unresolved_blocked_events','[]'::jsonb)) x where x->>'family'=v_family limit 1;
    elsif v_kind='blocked_group' then
      select g into v_actual from jsonb_array_elements(coalesce(v_resolution->'resolution_groups','[]'::jsonb)) g
      where g->>'status'='blocked' and exists(select 1 from jsonb_array_elements(coalesce(g->'blocked_events','[]'::jsonb)) b where b->>'family'=v_family) limit 1;
    elsif v_kind='decision_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_resolution->'construction_decisions','[]'::jsonb)) x
        where (t.input_fixture->>'decision' is null or x->>'decision'=t.input_fixture->>'decision') and (v_family is null or x->>'family'=v_family)));
    elsif v_kind='relation_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_resolution->'resolved_relations','[]'::jsonb)) x where x->>'relation'=t.input_fixture->>'relation'));
    elsif v_kind='relation' then
      select x into v_actual from jsonb_array_elements(coalesce(v_resolution->'resolved_relations','[]'::jsonb)) x where x->>'reason_code'=t.input_fixture->>'reason_code' limit 1;
    elsif v_kind='decision_provenance' then
      v_candidate_code:=t.input_fixture->>'candidate_code';
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate_code)) into v_actual
      from jsonb_array_elements(coalesce(v_resolution->'construction_decisions','[]'::jsonb)) x where x->>'family'=v_family limit 1;
    elsif v_kind='summary' then
      v_actual:=coalesce(v_resolution->'summary','{}'::jsonb);
    elsif v_kind='document' then
      v_actual:=jsonb_build_object(
        'sentence1',(select jsonb_build_object('decision',x->>'decision') from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_resolution_v1,construction_decisions}','[]'::jsonb)) x limit 1),
        'sentence2',(select jsonb_build_object('decision',x->>'decision') from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,construction_resolution_v1,construction_decisions}','[]'::jsonb)) x limit 1)
      );
    elsif v_kind='recognition_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v8(t.sentence,'runtime-structural-v1.8');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1}','{}'::jsonb));
    elsif v_kind='synthetic_relation' then
      select x into v_actual from jsonb_array_elements(coalesce(v_resolution->'resolved_relations','[]'::jsonb)) x limit 1;
    elsif v_kind='synthetic_group' then
      select x into v_actual from jsonb_array_elements(coalesce(v_resolution->'resolution_groups','[]'::jsonb)) x limit 1;
    else
      v_actual:='{}'::jsonb;
    end if;

    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'construction-resolution-golden-v1','grammar-structural-shadow-v9',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','construction-resolution-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>24 then raise exception 'Construction Resolution Golden expected 24 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;;

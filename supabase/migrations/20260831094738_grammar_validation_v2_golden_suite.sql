insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,expected_language_graph,status,test_layer,target_phase,input_fixture)
values
('gt.grammar_validation_v2.modal_valid','positive','Han kan ringe.',true,'{"overall_status":"valid","invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.modal_family_valid','positive','Han kan ringe.',true,'{"family":"modal_governance","status":"valid","expected_edges":1,"observed_edges":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"modal_governance"}'::jsonb),
('gt.grammar_validation_v2.modal_chain_valid','positive','Han vil kunne gå.',true,'{"family":"modal_governance","status":"valid","expected_edges":2,"observed_edges":2}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"modal_governance"}'::jsonb),
('gt.grammar_validation_v2.auxiliary_valid','positive','Han har gått.',true,'{"family":"auxiliary_governance","status":"valid","observed_edges":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"auxiliary_governance"}'::jsonb),
('gt.grammar_validation_v2.copular_valid','positive','Han er lærer.',true,'{"family":"copular_link","status":"valid","observed_edges":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"copular_link"}'::jsonb),
('gt.grammar_validation_v2.simple_valid','positive','Han satt stille.',true,'{"overall_status":"valid","invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.simple_no_diagnostic','negative','Han satt stille.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"diagnostic_count"}'::jsonb),
('gt.grammar_validation_v2.infinitive_valid','positive','Jeg liker å lese.',true,'{"family":"nonfinite_infinitive_shape","status":"valid","observed_marker_edges":1,"forbidden_subject_or_finite_edges":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"nonfinite_infinitive_shape"}'::jsonb),
('gt.grammar_validation_v2.infinitive_overall_valid','positive','Jeg liker å lese.',true,'{"overall_status":"valid","invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.ambiguous_unresolved','boundary','Han er sky.',true,'{"overall_status":"unresolved","unresolved_count":1,"invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.ambiguous_no_diagnostic','negative','Han er sky.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"diagnostic_count"}'::jsonb),
('gt.grammar_validation_v2.passive_unresolved','boundary','Han blir rost.',true,'{"overall_status":"unresolved","unresolved_count":1,"invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.passive_blocker_preserved','boundary','Han blir rost.',true,'{"family":"unresolved_propagation","status":"unresolved","reason_code":"blocked_competitor_overlap"}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"unresolved_propagation"}'::jsonb),
('gt.grammar_validation_v2.ellipsis_blocked','boundary','Han skal hjem.',true,'{"overall_status":"blocked","blocked_count":1,"invalid_count":0}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"summary"}'::jsonb),
('gt.grammar_validation_v2.ellipsis_event','boundary','Han skal hjem.',true,'{"family":"blocked_propagation","status":"blocked","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1"}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"blocked_propagation"}'::jsonb),
('gt.grammar_validation_v2.finite_subject_valid','positive','Han kan ringe.',true,'{"family":"finite_subject_integrity","status":"valid","subject_token_index":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"finite_subject_integrity"}'::jsonb),
('gt.grammar_validation_v2.finite_head_valid','positive','Han har gått.',true,'{"family":"finite_head_integrity","status":"valid","finite_token_index":2}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"finite_head_integrity"}'::jsonb),
('gt.grammar_validation_v2.clause_predicate_valid','positive','Han er lærer.',true,'{"family":"clause_predicate_integrity","status":"valid","observed_edges":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"event","family":"clause_predicate_integrity"}'::jsonb),
('gt.grammar_validation_v2.word_order_deferred','boundary','Han kan ringe.',true,'{"status":"deferred_until_clause_fields"}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"word_order_status"}'::jsonb),
('gt.grammar_validation_v2.synthetic_missing_subject','negative','Han kan ringe.',true,'{"overall_status":"invalid","invalid_count":1,"diagnostic_count":1}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"synthetic_remove_relation","relation":"subject_of"}'::jsonb),
('gt.grammar_validation_v2.synthetic_missing_modal','negative','Han can ringe.',true,'{"overall_status":"invalid"}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"synthetic_remove_relation","relation":"modal_governs","source_sentence":"Han kan ringe."}'::jsonb),
('gt.grammar_validation_v2.synthetic_dangling_token','negative','Han kan ringe.',true,'{"overall_status":"invalid","diagnostic_code":"gv2_dangling_dependency_token"}'::jsonb,'implemented','pipeline_integration','grammar_validation','{"kind":"synthetic_dangling_token"}'::jsonb),
('gt.grammar_validation_v2.dependency_v2_immutable','regression','Han kan ringe.',true,'{"equal":true}'::jsonb,'implemented','end_to_end','grammar_validation','{"kind":"dependency_parity"}'::jsonb),
('gt.grammar_validation_v2.clause_immutable','regression','Jeg liker å lese.',true,'{"equal":true}'::jsonb,'implemented','end_to_end','grammar_validation','{"kind":"clause_parity"}'::jsonb),
('gt.grammar_validation_v2.legacy_validation_immutable','regression','Han kan ringe.',true,'{"equal":true}'::jsonb,'implemented','end_to_end','grammar_validation','{"kind":"legacy_validation_parity"}'::jsonb),
('gt.grammar_validation_v2.document_isolation','regression','Han kan ringe. Han er sky.',true,'{"sentence1":"valid","sentence2":"unresolved"}'::jsonb,'implemented','end_to_end','grammar_validation','{"kind":"document"}'::jsonb);

create or replace function public.run_grammar_validation_golden_v2(p_release_code text default 'runtime-structural-v1.13')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record;
  v_doc jsonb; v_parent_doc jsonb; v_analysis jsonb; v_mut jsonb; v_layer jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_kind text; v_family text; v_rel text; v_arr jsonb; v_diag text;
begin
  select id,status into v_release_id,v_status from public.grammar_runtime_releases where code=p_release_code for update;
  if v_release_id is null then raise exception 'Release not found'; end if;
  if v_status not in ('build','golden') then raise exception 'Grammar Validation V2 Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.grammar_validation_v2.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_family:=t.input_fixture->>'family'; v_rel:=t.input_fixture->>'relation';
    v_doc:=public.analyze_text_structural_shadow_v13(coalesce(t.input_fixture->>'source_sentence',t.sentence),p_release_code);
    v_analysis:=coalesce(v_doc#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
    v_layer:=coalesce(v_analysis#>'{language_graph,grammar_validation_v2}','{}'::jsonb);

    if v_kind='summary' then v_actual:=coalesce(v_layer->'summary','{}'::jsonb);
    elsif v_kind='event' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'validation_events','[]'::jsonb)) x where x->>'family'=v_family limit 1;
    elsif v_kind='diagnostic_count' then v_actual:=jsonb_build_object('count',jsonb_array_length(coalesce(v_layer->'diagnostics','[]'::jsonb)));
    elsif v_kind='word_order_status' then v_actual:=jsonb_build_object('status',v_layer->>'word_order_v2_status');
    elsif v_kind='synthetic_remove_relation' then
      select coalesce(jsonb_agg(x),'[]'::jsonb) into v_arr from jsonb_array_elements(coalesce(v_analysis#>'{language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) x where x->>'relation'<>v_rel;
      v_mut:=jsonb_set(v_analysis,'{language_graph,dependency_build_v2,dependencies}',v_arr,true);
      v_actual:=public.resolve_grammar_validation_v2(v_mut,p_release_code)->'summary';
    elsif v_kind='synthetic_dangling_token' then
      select coalesce(jsonb_agg(case when rn=1 then jsonb_set(x,'{source_token_index}','999'::jsonb,true) else x end),'[]'::jsonb) into v_arr
      from (select x,row_number() over() rn from jsonb_array_elements(coalesce(v_analysis#>'{language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) x) q;
      v_mut:=jsonb_set(v_analysis,'{language_graph,dependency_build_v2,dependencies}',v_arr,true);
      v_layer:=public.resolve_grammar_validation_v2(v_mut,p_release_code);
      select d->>'code' into v_diag from jsonb_array_elements(coalesce(v_layer->'diagnostics','[]'::jsonb)) d where d->>'code'='gv2_dangling_dependency_token' limit 1;
      v_actual:=coalesce(v_layer->'summary','{}'::jsonb)||jsonb_build_object('diagnostic_code',v_diag);
    elsif v_kind='dependency_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v12(t.sentence,'runtime-structural-v1.12');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}','{}'::jsonb));
    elsif v_kind='clause_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v12(t.sentence,'runtime-structural-v1.12');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}','{}'::jsonb));
    elsif v_kind='legacy_validation_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v12(t.sentence,'runtime-structural-v1.12');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,validations}','[]'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,validations}','[]'::jsonb) and coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,diagnostics}','[]'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,diagnostics}','[]'::jsonb));
    elsif v_kind='document' then
      v_actual:=jsonb_build_object('sentence1',v_doc#>>'{document_graph,sentences,0,analysis,language_graph,grammar_validation_v2,summary,overall_status}','sentence2',v_doc#>>'{document_graph,sentences,1,analysis,language_graph,grammar_validation_v2,summary,overall_status}');
    else v_actual:='{}'::jsonb; end if;

    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'grammar-validation-golden-v2','grammar-structural-shadow-v13',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','grammar-validation-golden-v2'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>26 then raise exception 'Grammar Validation V2 Golden expected 26 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;

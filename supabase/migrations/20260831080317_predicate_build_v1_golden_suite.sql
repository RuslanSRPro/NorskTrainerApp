delete from public.grammar_golden_tests where code like 'gt.predicate_build_v1.%';

insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,expected_language_graph,status,test_layer,target_phase,input_fixture)
values
('gt.predicate_build_v1.01_simple_finite','positive','Han satt stille.',true,'{"predicate_kind":"simple_verbal","status":"resolved","surface":"satt","finiteness":"finite","finite_token_index":2,"member_token_indices":[2]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"simple_verbal"}'::jsonb),
('gt.predicate_build_v1.02_simple_provenance','regression','Han satt stille.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"simple_verbal","candidate_code":"verb.form.finite.predicate_head"}'::jsonb),
('gt.predicate_build_v1.03_modal_compound','positive','Han kan ringe.',true,'{"predicate_kind":"modal_compound","status":"resolved","surface":"kan ringe","finite_token_index":2,"lexical_head_token_index":3,"member_token_indices":[2,3]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"modal_compound"}'::jsonb),
('gt.predicate_build_v1.04_modal_compound_provenance','regression','Han kan ringe.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"modal_compound","candidate_code":"verb.form.finite.auxiliary_compound"}'::jsonb),
('gt.predicate_build_v1.05_modal_chain','positive','Han vil kunne gå.',true,'{"predicate_kind":"modal_chain","status":"resolved","surface":"vil kunne gå","finite_token_index":2,"lexical_head_token_index":4,"member_token_indices":[2,3,4]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"modal_chain"}'::jsonb),
('gt.predicate_build_v1.06_modal_chain_single_predicate','boundary','Han vil kunne gå.',true,'{"count":1}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate_count","predicate_kind":"modal_chain"}'::jsonb),
('gt.predicate_build_v1.07_modal_chain_provenance','regression','Han vil kunne gå.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"modal_chain","candidate_code":"verb.modal_auxiliary.chain"}'::jsonb),
('gt.predicate_build_v1.08_aux_compound','positive','Han har gått.',true,'{"predicate_kind":"auxiliary_compound","status":"resolved","surface":"har gått","finite_token_index":2,"lexical_head_token_index":3,"member_token_indices":[2,3]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"auxiliary_compound"}'::jsonb),
('gt.predicate_build_v1.09_aux_provenance','regression','Han har gått.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"auxiliary_compound","candidate_code":"verb.compound_form.semantic_unit_predicate"}'::jsonb),
('gt.predicate_build_v1.10_copular_noun','positive','Han er lærer.',true,'{"predicate_kind":"copular","status":"resolved","surface":"er lærer","finite_token_index":2,"predicative_complement_token_index":3}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.11_copular_adj','positive','Han er stor.',true,'{"predicate_kind":"copular","status":"resolved","surface":"er stor","predicative_complement_token_index":3}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.12_copular_provenance','regression','Han er lærer.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"copular","candidate_code":"grammar.foundations.phrase.copula_predicative_link"}'::jsonb),
('gt.predicate_build_v1.13_copular_ambiguous_hypothesis','contrastive','Han er sky.',true,'{"predicate_kind":"copular","status":"hypothesis","surface":"er sky","reason_code":"recognition_hypothesis_requires_discriminating_evidence","finite_token_index":2}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"hypothesis","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.14_copular_ambiguous_no_resolved','negative','Han er sky.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate_count","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.15_passive_blocker_hypothesis','contrastive','Han blir rost.',true,'{"predicate_kind":"copular","status":"hypothesis","reason_code":"blocked_competitor_overlap","finite_token_index":2}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"hypothesis","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.16_passive_blocker_no_resolved','negative','Han blir rost.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate_count","predicate_kind":"copular"}'::jsonb),
('gt.predicate_build_v1.17_modal_ellipsis_blocked','boundary','Han skal hjem.',true,'{"status":"blocked","surface":"skal hjem","finite_token_index":2,"member_token_indices":[2,3]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"blocked"}'::jsonb),
('gt.predicate_build_v1.18_modal_ellipsis_no_simple_fallback','negative','Han skal hjem.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate_count"}'::jsonb),
('gt.predicate_build_v1.19_marked_inf_nonfinite','positive','Jeg liker å lese.',true,'{"predicate_kind":"nonfinite_infinitive","status":"resolved","surface":"å lese","finiteness":"nonfinite","lexical_head_token_index":4,"member_token_indices":[3,4]}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"predicate","predicate_kind":"nonfinite_infinitive"}'::jsonb),
('gt.predicate_build_v1.20_matrix_plus_nonfinite_count','boundary','Jeg liker å lese.',true,'{"predicate_count":2,"finite_count":1,"nonfinite_count":1}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"summary"}'::jsonb),
('gt.predicate_build_v1.21_nonfinite_provenance','regression','Jeg liker å lese.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"provenance","predicate_kind":"nonfinite_infinitive","candidate_code":"verb.infinitive.construction_head"}'::jsonb),
('gt.predicate_build_v1.22_sentence_isolation','regression','Jeg kan ringe. Han er sky.',true,'{"sentence1":{"predicate_kind":"modal_compound"},"sentence2":{"predicate_kind":"copular","status":"hypothesis"}}'::jsonb,'implemented','end_to_end','predicate_build','{"kind":"document"}'::jsonb),
('gt.predicate_build_v1.23_resolution_immutability','regression','Han vil kunne gå.',true,'{"equal":true}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"resolution_parity"}'::jsonb),
('gt.predicate_build_v1.24_empty_no_predicate','negative','Hei.',true,'{"predicate_count":0,"hypothesis_count":0,"blocked_count":0}'::jsonb,'implemented','pipeline_integration','predicate_build','{"kind":"summary"}'::jsonb);

create or replace function public.run_predicate_build_golden_v1(p_release_code text default 'runtime-structural-v1.10')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_parent_doc jsonb; v_layer jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_kind text; v_pred_kind text; v_candidate_code text;
begin
  select r.id,r.status into v_release_id,v_status from public.grammar_runtime_releases r where r.code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Predicate Build Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.predicate_build_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_pred_kind:=t.input_fixture->>'predicate_kind';
    v_doc:=public.analyze_text_structural_shadow_v10(t.sentence,p_release_code);
    v_layer:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}','{}'::jsonb);
    if v_kind='predicate' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'predicates','[]'::jsonb)) x where (v_pred_kind is null or x->>'predicate_kind'=v_pred_kind) order by x->>'id' limit 1;
    elsif v_kind='hypothesis' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'predicate_hypotheses','[]'::jsonb)) x where (v_pred_kind is null or x->>'predicate_kind'=v_pred_kind) order by x->>'id' limit 1;
    elsif v_kind='blocked' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'blocked_predicates','[]'::jsonb)) x order by x->>'id' limit 1;
    elsif v_kind='predicate_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_layer->'predicates','[]'::jsonb)) x where (v_pred_kind is null or x->>'predicate_kind'=v_pred_kind)));
    elsif v_kind='summary' then v_actual:=coalesce(v_layer->'summary','{}'::jsonb);
    elsif v_kind='provenance' then
      v_candidate_code:=t.input_fixture->>'candidate_code';
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate_code)) into v_actual
      from jsonb_array_elements(coalesce(v_layer->'predicates','[]'::jsonb)) x where x->>'predicate_kind'=v_pred_kind limit 1;
    elsif v_kind='document' then
      v_actual:=jsonb_build_object(
        'sentence1',(select jsonb_build_object('predicate_kind',x->>'predicate_kind') from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1,predicates}','[]'::jsonb)) x limit 1),
        'sentence2',(select jsonb_build_object('predicate_kind',x->>'predicate_kind','status',x->>'status') from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,predicate_build_v1,predicate_hypotheses}','[]'::jsonb)) x limit 1)
      );
    elsif v_kind='resolution_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v9(t.sentence,'runtime-structural-v1.9');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_resolution_v1}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_resolution_v1}','{}'::jsonb));
    else v_actual:='{}'::jsonb;
    end if;
    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'predicate-build-golden-v1','grammar-structural-shadow-v10',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','predicate-build-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>24 then raise exception 'Predicate Build Golden expected 24 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;

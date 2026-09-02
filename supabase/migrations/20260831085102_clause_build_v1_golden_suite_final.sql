insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,input_fixture,expected_language_graph,status,test_layer,target_phase)
values
('gt.clause_build_v1.simple.finite','positive','Han satt stille.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"status":"resolved","clause_type":"finite","clause_form":"finite_predicate_core","surface":"Han satt","predicate_kind":"simple_verbal","subject_surface":"Han","finite_token_index":2}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.simple.extent','boundary','Han satt stille.',true,'{"kind":"summary"}'::jsonb,'{"clause_count":1,"finite_count":1,"nonfinite_count":0}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.modal.compound','positive','Han kan ringe.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Han kan ringe","predicate_kind":"modal_compound","finite_token_index":2,"subject_token_index":1}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.modal.no_nonfinite','negative','Han kan ringe.',true,'{"kind":"count","bucket":"clauses","clause_type":"nonfinite"}'::jsonb,'{"count":0}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.modal_chain.single_clause','positive','Han vil kunne gå.',true,'{"kind":"summary"}'::jsonb,'{"clause_count":1,"finite_count":1,"nonfinite_count":0}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.modal_chain.surface','positive','Han vil kunne gå.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Han vil kunne gå","predicate_kind":"modal_chain"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.auxiliary','positive','Han har gått.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Han har gått","predicate_kind":"auxiliary_compound"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.copular.noun','positive','Han er lærer.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Han er lærer","predicate_kind":"copular","subject_status":"explicit"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.copular.adjective','positive','Han er stor.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Han er stor","predicate_kind":"copular"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.copular.ambiguous_hypothesis','boundary','Han er sky.',true,'{"kind":"hypothesis"}'::jsonb,'{"status":"hypothesis","clause_type":"finite","surface":"Han er sky","reason_code":"recognition_hypothesis_requires_discriminating_evidence"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.copular.ambiguous_no_resolved','negative','Han er sky.',true,'{"kind":"count","bucket":"clauses"}'::jsonb,'{"count":0}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.passive_blocker_hypothesis','boundary','Han blir rost.',true,'{"kind":"hypothesis"}'::jsonb,'{"status":"hypothesis","surface":"Han blir rost","reason_code":"blocked_competitor_overlap"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.ellipsis.blocked','boundary','Han skal hjem.',true,'{"kind":"blocked"}'::jsonb,'{"status":"blocked","clause_type":"finite","surface":"Han skal hjem","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.ellipsis.no_resolved','negative','Han skal hjem.',true,'{"kind":"count","bucket":"clauses"}'::jsonb,'{"count":0}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.infinitive.two_units','positive','Jeg liker å lese.',true,'{"kind":"summary"}'::jsonb,'{"clause_count":2,"finite_count":1,"nonfinite_count":1}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.infinitive.matrix_core','positive','Jeg liker å lese.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"surface":"Jeg liker","predicate_kind":"simple_verbal","attachment_state":"matrix_or_sentence_core"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.infinitive.nonfinite','positive','Jeg liker å lese.',true,'{"kind":"clause","clause_type":"nonfinite"}'::jsonb,'{"surface":"å lese","clause_form":"nonfinite_infinitive","subject_status":"unexpressed","attachment_state":"unresolved_nonfinite_attachment"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.infinitive.provenance','positive','Jeg liker å lese.',true,'{"kind":"provenance","clause_type":"nonfinite","candidate_code":"sentence.subordinate.explicative.nominal.infinitive.reference.function_parallel_at_clause"}'::jsonb,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.finite.provenance','positive','Han kan ringe.',true,'{"kind":"provenance","clause_type":"finite","candidate_code":"grammar.foundations.sentence.subject_predicate_core"}'::jsonb,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.schema_hint','positive','Han kan ringe.',true,'{"kind":"clause","clause_type":"finite"}'::jsonb,'{"schema_hint":"A"}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.document_isolation','regression','Jeg kan ringe. Han er sky.',true,'{"kind":"document"}'::jsonb,'{"sentence1":{"resolved":1,"hypotheses":0},"sentence2":{"resolved":0,"hypotheses":1}}'::jsonb,'implemented','end_to_end','clause_build'),
('gt.clause_build_v1.predicate_immutable','regression','Han kan ringe.',true,'{"kind":"predicate_parity"}'::jsonb,'{"equal":true}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.legacy_clause_immutable','regression','Han satt stille.',true,'{"kind":"legacy_clause_parity"}'::jsonb,'{"equal":true}'::jsonb,'implemented','pipeline_integration','clause_build'),
('gt.clause_build_v1.empty_no_clause','negative','ringe',true,'{"kind":"summary"}'::jsonb,'{"clause_count":0,"finite_count":0,"nonfinite_count":0,"hypothesis_count":0,"blocked_count":0}'::jsonb,'implemented','pipeline_integration','clause_build')
on conflict(code) do update set test_type=excluded.test_type,sentence=excluded.sentence,is_grammatical=excluded.is_grammatical,input_fixture=excluded.input_fixture,expected_language_graph=excluded.expected_language_graph,status=excluded.status,test_layer=excluded.test_layer,target_phase=excluded.target_phase,updated_at=clock_timestamp();

create or replace function public.run_clause_build_golden_v1(p_release_code text default 'runtime-structural-v1.11')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_parent_doc jsonb; v_layer jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_kind text; v_clause_type text; v_bucket text; v_candidate_code text;
begin
  select r.id,r.status into v_release_id,v_status from public.grammar_runtime_releases r where r.code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Clause Build Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.clause_build_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_clause_type:=t.input_fixture->>'clause_type'; v_bucket:=t.input_fixture->>'bucket';
    v_doc:=public.analyze_text_structural_shadow_v11(t.sentence,p_release_code);
    v_layer:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}','{}'::jsonb);
    if v_kind='clause' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'clauses','[]'::jsonb)) x where (v_clause_type is null or x->>'clause_type'=v_clause_type) order by x->>'id' limit 1;
    elsif v_kind='hypothesis' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'clause_hypotheses','[]'::jsonb)) x order by x->>'id' limit 1;
    elsif v_kind='blocked' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'blocked_clauses','[]'::jsonb)) x order by x->>'id' limit 1;
    elsif v_kind='summary' then v_actual:=coalesce(v_layer->'summary','{}'::jsonb);
    elsif v_kind='count' then
      if v_bucket='clauses' then v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_layer->'clauses','[]'::jsonb)) x where (v_clause_type is null or x->>'clause_type'=v_clause_type)));
      elsif v_bucket='hypotheses' then v_actual:=jsonb_build_object('count',jsonb_array_length(coalesce(v_layer->'clause_hypotheses','[]'::jsonb)));
      else v_actual:=jsonb_build_object('count',jsonb_array_length(coalesce(v_layer->'blocked_clauses','[]'::jsonb))); end if;
    elsif v_kind='provenance' then
      v_candidate_code:=t.input_fixture->>'candidate_code';
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate_code)) into v_actual from jsonb_array_elements(coalesce(v_layer->'clauses','[]'::jsonb)) x where x->>'clause_type'=v_clause_type limit 1;
    elsif v_kind='document' then
      v_actual:=jsonb_build_object('sentence1',jsonb_build_object('resolved',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb)),'hypotheses',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb))),'sentence2',jsonb_build_object('resolved',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb)),'hypotheses',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb))));
    elsif v_kind='predicate_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v10(t.sentence,'runtime-structural-v1.10');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}','{}'::jsonb));
    elsif v_kind='legacy_clause_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v10(t.sentence,'runtime-structural-v1.10');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,clauses}','[]'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,clauses}','[]'::jsonb));
    else v_actual:='{}'::jsonb; end if;
    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'clause-build-golden-v1','grammar-structural-shadow-v11',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','clause-build-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>24 then raise exception 'Clause Build Golden expected 24 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;

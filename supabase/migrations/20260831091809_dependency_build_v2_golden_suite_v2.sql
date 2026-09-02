delete from public.grammar_golden_tests where code like 'gt.dependency_build_v2.%';
insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,expected_language_graph,status,test_layer,target_phase,input_fixture)
values
('gt.dependency_build_v2.simple_subject','positive','Han satt stille.',true,'{"relation":"subject_of","source_surface":"Han","target_surface":"satt"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"subject_of"}'::jsonb),
('gt.dependency_build_v2.simple_predicate_clause','positive','Han satt stille.',true,'{"relation":"predicate_of_clause","source_surface":"satt","target_surface":"Han satt"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"predicate_of_clause"}'::jsonb),
('gt.dependency_build_v2.simple_no_stille_edge','negative','Han satt stille.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"surface_edge_count","surface":"stille"}'::jsonb),
('gt.dependency_build_v2.modal_subject','positive','Han kan ringe.',true,'{"relation":"subject_of","target_surface":"kan ringe"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"subject_of"}'::jsonb),
('gt.dependency_build_v2.modal_governs','positive','Han kan ringe.',true,'{"relation":"modal_governs","source_surface":"kan","target_surface":"ringe"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"modal_governs"}'::jsonb),
('gt.dependency_build_v2.modal_lexical_head','positive','Han kan ringe.',true,'{"relation":"lexical_head_of_predicate","source_surface":"ringe"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"lexical_head_of_predicate"}'::jsonb),
('gt.dependency_build_v2.modal_chain_count','positive','Han vil kunne gå.',true,'{"count":2}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"relation_count","relation":"modal_governs"}'::jsonb),
('gt.dependency_build_v2.modal_chain_first','positive','Han vil kunne gå.',true,'{"relation":"modal_governs","source_surface":"vil","target_surface":"kunne"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge_surface","relation":"modal_governs","source":"vil"}'::jsonb),
('gt.dependency_build_v2.modal_chain_second','positive','Han vil kunne gå.',true,'{"relation":"modal_governs","source_surface":"kunne","target_surface":"gå"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge_surface","relation":"modal_governs","source":"kunne"}'::jsonb),
('gt.dependency_build_v2.aux_governs','positive','Han har gått.',true,'{"relation":"auxiliary_governs","source_surface":"har","target_surface":"gått"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"auxiliary_governs"}'::jsonb),
('gt.dependency_build_v2.aux_lexical_head','positive','Han har gått.',true,'{"relation":"lexical_head_of_predicate","source_surface":"gått"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"lexical_head_of_predicate"}'::jsonb),
('gt.dependency_build_v2.copula_link','positive','Han er lærer.',true,'{"relation":"copula_links_predicative","source_surface":"er","target_surface":"lærer"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"copula_links_predicative"}'::jsonb),
('gt.dependency_build_v2.copula_subject_target_predicate','positive','Han er lærer.',true,'{"relation":"subject_of","source_surface":"Han","target_surface":"er lærer","target_entity":"predicate"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"subject_of"}'::jsonb),
('gt.dependency_build_v2.copula_provenance','positive','Han er lærer.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"provenance","relation":"copula_links_predicative","candidate_code":"grammar.foundations.phrase.copula_predicative_link"}'::jsonb),
('gt.dependency_build_v2.ambiguous_no_authoritative','boundary','Han er sky.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"dependency_count"}'::jsonb),
('gt.dependency_build_v2.ambiguous_hypothesis','boundary','Han er sky.',true,'{"status":"hypothesis","reason_code":"recognition_hypothesis_requires_discriminating_evidence"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"hypothesis"}'::jsonb),
('gt.dependency_build_v2.passive_blocker_hypothesis','boundary','Han blir rost.',true,'{"status":"hypothesis","reason_code":"blocked_competitor_overlap"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"hypothesis"}'::jsonb),
('gt.dependency_build_v2.ellipsis_blocked','boundary','Han skal hjem.',true,'{"status":"blocked","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"blocked"}'::jsonb),
('gt.dependency_build_v2.ellipsis_no_subject_edge','negative','Han skal hjem.',true,'{"count":0}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"relation_count","relation":"subject_of"}'::jsonb),
('gt.dependency_build_v2.infinitive_clause_predicate','positive','Jeg liker å lese.',true,'{"count":2}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"relation_count","relation":"predicate_of_clause"}'::jsonb),
('gt.dependency_build_v2.infinitive_marker','positive','Jeg liker å lese.',true,'{"relation":"infinitive_marker_of_predicate","source_surface":"å","target_surface":"å lese"}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"edge","relation":"infinitive_marker_of_predicate"}'::jsonb),
('gt.dependency_build_v2.infinitive_no_subject','negative','Jeg liker å lese.',true,'{"count":1}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"relation_count","relation":"subject_of"}'::jsonb),
('gt.dependency_build_v2.infinitive_head_provenance','positive','Jeg liker å lese.',true,'{"has_source":true}'::jsonb,'implemented','pipeline_integration','dependency_build','{"kind":"provenance_surface","relation":"grammatical_head_of_predicate","source":"lese","candidate_code":"verb.infinitive.construction_head"}'::jsonb),
('gt.dependency_build_v2.legacy_immutable','regression','Han kan ringe.',true,'{"equal":true}'::jsonb,'implemented','end_to_end','dependency_build','{"kind":"legacy_parity"}'::jsonb);

create or replace function public.run_dependency_build_golden_v2(p_release_code text default 'runtime-structural-v1.12')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_parent_doc jsonb; v_layer jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_kind text; v_rel text; v_source text; v_candidate text;
begin
  select id,status into v_release_id,v_status from public.grammar_runtime_releases where code=p_release_code for update;
  if v_release_id is null then raise exception 'Release not found'; end if;
  if v_status not in ('build','golden') then raise exception 'Dependency Build Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.dependency_build_v2.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_rel:=t.input_fixture->>'relation'; v_source:=t.input_fixture->>'source'; v_candidate:=t.input_fixture->>'candidate_code';
    v_doc:=public.analyze_text_structural_shadow_v12(t.sentence,p_release_code);
    v_layer:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}','{}'::jsonb);
    if v_kind='edge' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'relation'=v_rel limit 1;
    elsif v_kind='edge_surface' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'relation'=v_rel and x->>'source_surface'=v_source limit 1;
    elsif v_kind='relation_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'relation'=v_rel));
    elsif v_kind='dependency_count' then
      v_actual:=jsonb_build_object('count',jsonb_array_length(coalesce(v_layer->'dependencies','[]'::jsonb)));
    elsif v_kind='surface_edge_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'source_surface'=t.input_fixture->>'surface' or x->>'target_surface'=t.input_fixture->>'surface'));
    elsif v_kind='hypothesis' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'dependency_hypotheses','[]'::jsonb)) x limit 1;
    elsif v_kind='blocked' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'blocked_dependencies','[]'::jsonb)) x limit 1;
    elsif v_kind='provenance' then
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate)) into v_actual from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'relation'=v_rel limit 1;
    elsif v_kind='provenance_surface' then
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate)) into v_actual from jsonb_array_elements(coalesce(v_layer->'dependencies','[]'::jsonb)) x where x->>'relation'=v_rel and x->>'source_surface'=v_source limit 1;
    elsif v_kind='legacy_parity' then
      v_parent_doc:=public.analyze_text_structural_shadow_v11(t.sentence,'runtime-structural-v1.11');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis,language_graph,dependencies}','[]'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,dependencies}','[]'::jsonb));
    else v_actual:='{}'::jsonb; end if;
    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'dependency-build-golden-v2','grammar-structural-shadow-v12',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','dependency-build-golden-v2'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>24 then raise exception 'Dependency Build V2 Golden expected 24 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;

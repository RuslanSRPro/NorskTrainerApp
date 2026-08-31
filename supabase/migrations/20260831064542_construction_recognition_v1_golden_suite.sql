insert into public.grammar_golden_tests(
  code,test_type,sentence,is_grammatical,expected_constructions,expected_language_graph,status,test_layer,target_phase,input_fixture
) values
('gt.construction_recognition_v1.modal_bare.kan_ringe','positive','Han kan ringe.',true,'[]','{"family":"modal_auxiliary_bare_infinitive","status":"recognized","surface":"kan ringe","requires_resolution":false}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"modal_auxiliary_bare_infinitive","surface":"kan ringe"}'),
('gt.construction_recognition_v1.modal_bare.provenance','positive','Han kan ringe.',true,'[]','{"provenance":[{"candidate_code":"verb.modal_auxiliary.bare_infinitive","verification_status":"source_verified"}]}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"modal_auxiliary_bare_infinitive","surface":"kan ringe"}'),
('gt.construction_recognition_v1.modal_bare.standalone_negative','negative','Ringe.',true,'[]','{"count":0}','implemented','runtime_component','construction_recognition','{"kind":"family_count","family":"modal_auxiliary_bare_infinitive"}'),
('gt.construction_recognition_v1.modal_chain.recognized','positive','Han vil kunne gå.',true,'[]','{"family":"modal_auxiliary_chain","status":"recognized","surface":"vil kunne","requires_resolution":true}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"modal_auxiliary_chain","surface":"vil kunne"}'),
('gt.construction_recognition_v1.modal_chain.source','positive','Han vil kunne gå.',true,'[]','{"provenance":[{"candidate_code":"verb.modal_auxiliary.chain","verification_status":"source_verified"},{"candidate_code":"verb.modal_auxiliary.chain.finiteness","verification_status":"source_verified"}]}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"modal_auxiliary_chain","surface":"vil kunne"}'),
('gt.construction_recognition_v1.modal_chain.nested_count','boundary','Han vil kunne gå.',true,'[]','{"construction_count":3,"recognized_count":3}','implemented','pipeline_integration','construction_recognition','{"kind":"summary"}'),
('gt.construction_recognition_v1.modal_chain.overlap','boundary','Han vil kunne gå.',true,'[]','{"overlap_count":3}','implemented','pipeline_integration','construction_recognition','{"kind":"summary"}'),
('gt.construction_recognition_v1.marked_infinitive.lese','positive','Jeg liker å lese.',true,'[]','{"family":"marked_infinitive","status":"recognized","surface":"å lese","requires_resolution":false}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"marked_infinitive","surface":"å lese"}'),
('gt.construction_recognition_v1.marked_infinitive.provenance','positive','Jeg liker å lese.',true,'[]','{"provenance":[{"candidate_code":"verb.infinitive.marker.aa","verification_status":"source_verified"},{"candidate_code":"verb.infinitive.construction_head","verification_status":"source_verified"}]}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"marked_infinitive","surface":"å lese"}'),
('gt.construction_recognition_v1.marked_infinitive.nonverb_negative','negative','Jeg liker å huset.',false,'[]','{"count":0}','implemented','runtime_component','construction_recognition','{"kind":"family_count","family":"marked_infinitive"}'),
('gt.construction_recognition_v1.aux_nonfinite.har_gaatt','positive','Han har gått.',true,'[]','{"family":"auxiliary_nonfinite_complement","subfamily":"ha_nonfinite","status":"recognized","surface":"har gått","requires_resolution":true}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"auxiliary_nonfinite_complement","surface":"har gått"}'),
('gt.construction_recognition_v1.aux_nonfinite.provenance','positive','Han har gått.',true,'[]','{"provenance":[{"candidate_code":"verb.auxiliary.complement.nonfinite_main","verification_status":"source_verified"}]}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"auxiliary_nonfinite_complement","surface":"har gått"}'),
('gt.construction_recognition_v1.aux_nonfinite.nonverb_negative','negative','Han har hus.',false,'[]','{"count":0}','implemented','runtime_component','construction_recognition','{"kind":"family_count","family":"auxiliary_nonfinite_complement"}'),
('gt.construction_recognition_v1.copula.nominal','positive','Han er lærer.',true,'[]','{"family":"copular_predicative","status":"recognized","surface":"er lærer","predicative_type_candidates":["noun"],"requires_resolution":false}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"copular_predicative","surface":"er lærer"}'),
('gt.construction_recognition_v1.copula.adjectival','positive','Han er stor.',true,'[]','{"family":"copular_predicative","status":"recognized","surface":"er stor","predicative_type_candidates":["adjective"],"requires_resolution":false}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"copular_predicative","surface":"er stor"}'),
('gt.construction_recognition_v1.copula.ambiguous_sky','contrastive','Han er sky.',true,'[]','{"family":"copular_predicative","status":"hypothesis","surface":"er sky","predicative_type_candidates":["noun","adjective"],"requires_resolution":true}','implemented','pipeline_integration','construction_recognition','{"kind":"construction","family":"copular_predicative","surface":"er sky"}'),
('gt.construction_recognition_v1.copula.provenance','positive','Han er lærer.',true,'[]','{"provenance":[{"candidate_code":"sentence.predicative.subject.copula.constituent_type_eligibility","verification_status":"source_verified"}]}','implemented','runtime_component','construction_recognition','{"kind":"construction","family":"copular_predicative","surface":"er lærer"}'),
('gt.construction_recognition_v1.passive.upstream_blocked','boundary','Han blir rost.',true,'[]','{"family":"passive","status":"upstream_blocked","reason_code":"nonfinite_verb_or_participle_not_available_from_upstream_morphology"}','implemented','pipeline_integration','construction_recognition','{"kind":"blocked","family":"passive"}'),
('gt.construction_recognition_v1.bli.competing_copula_candidate','boundary','Han blir rost.',true,'[]','{"family":"copular_predicative","surface":"blir rost","requires_resolution":true}','implemented','pipeline_integration','construction_recognition','{"kind":"construction","family":"copular_predicative","surface":"blir rost"}'),
('gt.construction_recognition_v1.modal_ellipsis.deferred','boundary','Han skal hjem.',true,'[]','{"family":"modal_ellipsis_motion","status":"deferred","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1"}','implemented','pipeline_integration','construction_recognition','{"kind":"blocked","family":"modal_ellipsis_motion"}'),
('gt.construction_recognition_v1.modal_ellipsis.no_false_bare_inf','negative','Han skal hjem.',true,'[]','{"count":0}','implemented','pipeline_integration','construction_recognition','{"kind":"family_count","family":"modal_auxiliary_bare_infinitive"}'),
('gt.construction_recognition_v1.nonadjacent_modal.no_false_chain','boundary','Det vil trolig kunne gå.',true,'[]','{"count":0}','implemented','pipeline_integration','construction_recognition','{"kind":"surface_count","family":"modal_auxiliary_chain","surface":"vil trolig kunne"}'),
('gt.construction_recognition_v1.document.sentence_isolation','regression','Jeg kan ringe. Han er sky.',true,'[]','{"sentence1":{"family":"modal_auxiliary_bare_infinitive","status":"recognized","surface":"kan ringe"},"sentence2":{"family":"copular_predicative","status":"hypothesis","surface":"er sky","requires_resolution":true}}','implemented','end_to_end','construction_recognition','{"kind":"document"}');

create or replace function public.run_construction_recognition_golden_v1(p_release_code text default 'runtime-structural-v1.8')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_actual jsonb; v_pass boolean; v_count int:=0;
  v_family text; v_surface text; v_c1 jsonb; v_c2 jsonb;
begin
  select r.id,r.status into v_release_id,v_status from public.grammar_runtime_releases r where r.code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Construction Golden accepts build/golden, got %',v_status; end if;

  for t in select * from public.grammar_golden_tests where code like 'gt.construction_recognition_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1;
    v_doc:=public.analyze_text_structural_shadow_v8(t.sentence,p_release_code);
    v_family:=t.input_fixture->>'family'; v_surface:=t.input_fixture->>'surface';

    if t.input_fixture->>'kind'='construction' then
      select x into v_actual from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x
      where x->>'family'=v_family and (v_surface is null or x->>'surface'=v_surface) order by x->>'id' limit 1;
    elsif t.input_fixture->>'kind'='blocked' then
      select x into v_actual from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,blocked_events}','[]'::jsonb)) x
      where x->>'family'=v_family order by x->>'span_start' limit 1;
    elsif t.input_fixture->>'kind'='summary' then
      v_actual:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,summary}','{}'::jsonb);
    elsif t.input_fixture->>'kind'='family_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x where x->>'family'=v_family));
    elsif t.input_fixture->>'kind'='surface_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x where x->>'family'=v_family and x->>'surface'=v_surface));
    elsif t.input_fixture->>'kind'='document' then
      select x into v_c1 from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x where x->>'family'='modal_auxiliary_bare_infinitive' limit 1;
      select x into v_c2 from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x where x->>'family'='copular_predicative' limit 1;
      v_actual:=jsonb_build_object('sentence1',coalesce(v_c1,'{}'::jsonb),'sentence2',coalesce(v_c2,'{}'::jsonb));
    else
      v_actual:='{}'::jsonb;
    end if;

    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'construction-recognition-golden-v1','grammar-structural-shadow-v8',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','construction-recognition-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>23 then raise exception 'Construction Recognition Golden expected 23 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;;

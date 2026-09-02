delete from public.grammar_golden_tests where code like 'gt.interpretation_v2.%';

insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,expected_language_graph,status,test_layer,target_phase,input_fixture)
values
('gt.interpretation_v2.simple_present','positive','Han reiser.',true,'{"value":{"morphological_tense":"present","carrier":"finite_predicate_token"}}','implemented','runtime_component',null,'{"kind":"family","family":"morphological_tense"}'),
('gt.interpretation_v2.simple_preterite','positive','Han gikk.',true,'{"value":{"morphological_tense":"preterite"}}','implemented','runtime_component',null,'{"kind":"family","family":"morphological_tense"}'),
('gt.interpretation_v2.finite_predication','positive','Han reiser.',true,'{"value":{"predication_type":"finite","predicate_surface":"reiser"},"subject_surface":"Han"}','implemented','runtime_component',null,'{"kind":"family","family":"finite_predication"}'),
('gt.interpretation_v2.modal_compound_operator','positive','Han kan ringe.',true,'{"value":{"modal_operator_order":["kan"],"predicate_member_order":["kan","ringe"],"modal_operator_count":1}}','implemented','runtime_component',null,'{"kind":"family","family":"modal_structure"}'),
('gt.interpretation_v2.modal_compound_semantics_deferred','boundary','Han kan ringe.',true,'{"value":{"semantic_modal_reading":"deferred","semantic_scope":"deferred","future_reading":"deferred"}}','implemented','runtime_component',null,'{"kind":"family","family":"modal_structure"}'),
('gt.interpretation_v2.modal_chain_operator_order','positive','Han vil kunne gå.',true,'{"value":{"modal_operator_order":["vil","kunne"],"modal_operator_token_indices":[2,3],"modal_operator_count":2}}','implemented','runtime_component',null,'{"kind":"family","family":"modal_structure"}'),
('gt.interpretation_v2.modal_chain_member_order','positive','Han vil kunne gå.',true,'{"value":{"predicate_member_order":["vil","kunne","gå"],"lexical_head_token_index":4}}','implemented','runtime_component',null,'{"kind":"family","family":"modal_structure"}'),
('gt.interpretation_v2.modal_past_tense','positive','Hun ville lese.',true,'{"value":{"morphological_tense":"preterite"}}','implemented','runtime_component',null,'{"kind":"family","family":"morphological_tense"}'),
('gt.interpretation_v2.modal_provenance','regression','Han vil kunne gå.',true,'{"has_source":true}','implemented','runtime_component',null,'{"kind":"provenance","family":"modal_structure","candidate_code":"verb.modal_auxiliary.chain.scope_order"}'),
('gt.interpretation_v2.present_perfect','positive','Han har gått.',true,'{"value":{"tense_form":"present_perfect","auxiliary_lemma":"ha","nonfinite_form":"past_participle"}}','implemented','runtime_component',null,'{"kind":"family","family":"perfect_tense_form"}'),
('gt.interpretation_v2.preterite_perfect','positive','Han hadde gått.',true,'{"value":{"tense_form":"preterite_perfect","auxiliary_lemma":"ha"}}','implemented','runtime_component',null,'{"kind":"family","family":"perfect_tense_form"}'),
('gt.interpretation_v2.perfect_generalizes_lexical_head','positive','Han har lest.',true,'{"value":{"tense_form":"present_perfect"},"surface":"har lest"}','implemented','runtime_component',null,'{"kind":"family","family":"perfect_tense_form"}'),
('gt.interpretation_v2.perfect_temporal_profile','positive','Han har gått.',true,'{"value":{"temporal_relation_profile":"before_reference_point"}}','implemented','runtime_component',null,'{"kind":"family","family":"perfect_tense_form"}'),
('gt.interpretation_v2.perfect_provenance','regression','Han har gått.',true,'{"has_source":true}','implemented','runtime_component',null,'{"kind":"provenance","family":"perfect_tense_form","candidate_code":"verb.tense.forms.perfect_system"}'),
('gt.interpretation_v2.simple_not_perfect','negative','Han gikk.',true,'{"count":0}','implemented','runtime_component',null,'{"kind":"family_count","family":"perfect_tense_form"}'),
('gt.interpretation_v2.copular_noun','positive','Han er lærer.',true,'{"value":{"subject_surface":"Han","predicative_surface":"lærer","semantic_subtype":"deferred"}}','implemented','runtime_component',null,'{"kind":"family","family":"copular_predication"}'),
('gt.interpretation_v2.copular_adjective','positive','Han er stor.',true,'{"value":{"predicative_surface":"stor"}}','implemented','runtime_component',null,'{"kind":"family","family":"copular_predication"}'),
('gt.interpretation_v2.copular_subtype_deferred','boundary','Han er lærer.',true,'{"value":{"semantic_subtype":"deferred"}}','implemented','runtime_component',null,'{"kind":"family","family":"copular_predication"}'),
('gt.interpretation_v2.ambiguous_copula_hypothesis','boundary','Han er sky.',true,'{"status":"hypothesis","reason_code":"recognition_hypothesis_requires_discriminating_evidence"}','implemented','runtime_component',null,'{"kind":"hypothesis"}'),
('gt.interpretation_v2.ambiguous_copula_no_resolved','negative','Han er sky.',true,'{"count":0}','implemented','runtime_component',null,'{"kind":"resolved_count"}'),
('gt.interpretation_v2.passive_blocker_hypothesis','boundary','Han blir rost.',true,'{"status":"hypothesis","reason_code":"blocked_competitor_overlap"}','implemented','runtime_component',null,'{"kind":"hypothesis"}'),
('gt.interpretation_v2.passive_blocker_preserved','boundary','Han blir rost.',true,'{"has_blocker":true}','implemented','runtime_component',null,'{"kind":"hypothesis_blocker","family":"passive"}'),
('gt.interpretation_v2.modal_ellipsis_blocked','boundary','Han skal hjem.',true,'{"status":"blocked","reason_code":"ellipsis_recovery_not_in_construction_recognition_v1"}','implemented','runtime_component',null,'{"kind":"blocked"}'),
('gt.interpretation_v2.infinitive_profile','positive','Jeg liker å lese.',true,'{"value":{"overt_subject":"absent","interpreted_subject_profile":"normally_present_but_unresolved"}}','implemented','runtime_component',null,'{"kind":"family","family":"nonfinite_infinitive_profile"}'),
('gt.interpretation_v2.infinitive_no_independent_tense','positive','Jeg liker å lese.',true,'{"value":{"independent_tense":"absent","independent_modal_marking":"absent"}}','implemented','runtime_component',null,'{"kind":"family","family":"nonfinite_infinitive_profile"}'),
('gt.interpretation_v2.infinitive_controller_deferred','boundary','Jeg liker å lese.',true,'{"value":{"controller":"deferred","attachment":"deferred"}}','implemented','runtime_component',null,'{"kind":"family","family":"nonfinite_infinitive_profile"}'),
('gt.interpretation_v2.nonfinite_not_finite_predication','negative','Jeg liker å lese.',true,'{"count":1}','implemented','runtime_component',null,'{"kind":"family_count","family":"finite_predication"}'),
('gt.interpretation_v2.matrix_nonfinite_coexist','positive','Jeg liker å lese.',true,'{"family_counts":{"finite_predication":1,"morphological_tense":1,"nonfinite_infinitive_profile":1},"resolved_count":3}','implemented','runtime_component',null,'{"kind":"summary"}'),
('gt.interpretation_v2.document_isolation','regression','Han reiser. Han er sky.',true,'{"sentence1":{"validation_gate":"valid","resolved":2,"hypotheses":0},"sentence2":{"validation_gate":"unresolved","resolved":0,"hypotheses":1}}','implemented','runtime_component',null,'{"kind":"document"}'),
('gt.interpretation_v2.validation_immutable','regression','Han kan ringe.',true,'{"equal":true}','implemented','runtime_component',null,'{"kind":"validation_parity"}'),
('gt.interpretation_v2.dependency_immutable','regression','Han vil kunne gå.',true,'{"equal":true}','implemented','runtime_component',null,'{"kind":"dependency_parity"}'),
('gt.interpretation_v2.legacy_interpretation_immutable','regression','Han kan ringe.',true,'{"equal":true}','implemented','runtime_component',null,'{"kind":"legacy_interpretation_parity"}'),
('gt.interpretation_v2.invalid_validation_gate','negative','Han kan ringe.',false,'{"status":"gated_invalid","gate_reason":"grammar_validation_v2_invalid","resolved_count":0}','implemented','runtime_component',null,'{"kind":"synthetic_invalid_gate"}');

create or replace function public.run_interpretation_golden_v2(p_release_code text default 'runtime-structural-v1.14')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record;
  v_doc jsonb; v_parent jsonb; v_layer jsonb; v_actual jsonb; v_fact jsonb; v_analysis jsonb; v_pass boolean; v_count int:=0;
  v_kind text; v_family text; v_candidate text; v_block_family text;
begin
  select id,status into v_release_id,v_status from public.grammar_runtime_releases where code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Interpretation Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.interpretation_v2.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_kind:=t.input_fixture->>'kind'; v_family:=t.input_fixture->>'family'; v_candidate:=t.input_fixture->>'candidate_code';
    v_doc:=public.analyze_text_structural_shadow_v14(t.sentence,p_release_code);
    v_layer:=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}','{}'::jsonb); v_actual:='{}'::jsonb;
    if v_kind='family' then
      select x into v_actual from jsonb_array_elements(coalesce(v_layer->'interpretations','[]'::jsonb)) x where x->>'family'=v_family order by x->>'id' limit 1;
    elsif v_kind='family_count' then
      v_actual:=jsonb_build_object('count',(select count(*) from jsonb_array_elements(coalesce(v_layer->'interpretations','[]'::jsonb)) x where x->>'family'=v_family));
    elsif v_kind='resolved_count' then
      v_actual:=jsonb_build_object('count',jsonb_array_length(coalesce(v_layer->'interpretations','[]'::jsonb)));
    elsif v_kind='summary' then v_actual:=coalesce(v_layer->'summary','{}'::jsonb);
    elsif v_kind='hypothesis' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'interpretation_hypotheses','[]'::jsonb)) x limit 1;
    elsif v_kind='hypothesis_blocker' then
      v_block_family:=t.input_fixture->>'family';
      select jsonb_build_object('has_blocker',exists(select 1 from jsonb_array_elements(coalesce(x->'blocked_events','[]'::jsonb)) b where b->>'family'=v_block_family)) into v_actual from jsonb_array_elements(coalesce(v_layer->'interpretation_hypotheses','[]'::jsonb)) x limit 1;
    elsif v_kind='blocked' then select x into v_actual from jsonb_array_elements(coalesce(v_layer->'blocked_interpretations','[]'::jsonb)) x limit 1;
    elsif v_kind='provenance' then
      select jsonb_build_object('has_source',exists(select 1 from jsonb_array_elements(coalesce(x->'provenance','[]'::jsonb)) p where p->>'candidate_code'=v_candidate)) into v_actual from jsonb_array_elements(coalesce(v_layer->'interpretations','[]'::jsonb)) x where x->>'family'=v_family limit 1;
    elsif v_kind='document' then
      v_actual:=jsonb_build_object(
        'sentence1',jsonb_build_object('validation_gate',v_doc#>>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,summary,validation_gate}','resolved',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)),'hypotheses',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretation_hypotheses}','[]'::jsonb))),
        'sentence2',jsonb_build_object('validation_gate',v_doc#>>'{document_graph,sentences,1,analysis,language_graph,interpretation_v2,summary,validation_gate}','resolved',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)),'hypotheses',jsonb_array_length(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,interpretation_v2,interpretation_hypotheses}','[]'::jsonb)))
      );
    elsif v_kind='validation_parity' then
      v_parent:=public.analyze_text_structural_shadow_v13(t.sentence,'runtime-structural-v1.13');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent#>'{document_graph,sentences,0,analysis,language_graph,grammar_validation_v2}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,grammar_validation_v2}','{}'::jsonb));
    elsif v_kind='dependency_parity' then
      v_parent:=public.analyze_text_structural_shadow_v13(t.sentence,'runtime-structural-v1.13');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}','{}'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}','{}'::jsonb));
    elsif v_kind='legacy_interpretation_parity' then
      v_parent:=public.analyze_text_structural_shadow_v13(t.sentence,'runtime-structural-v1.13');
      v_actual:=jsonb_build_object('equal',coalesce(v_parent#>'{document_graph,sentences,0,analysis,language_graph,interpretations}','[]'::jsonb)=coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretations}','[]'::jsonb));
    elsif v_kind='synthetic_invalid_gate' then
      v_analysis:=public.analyze_text_structural_shadow_v13(t.sentence,p_release_code)#>'{document_graph,sentences,0,analysis}';
      v_analysis:=jsonb_set(v_analysis,'{language_graph,grammar_validation_v2,summary,overall_status}','"invalid"'::jsonb,true);
      v_fact:=public.resolve_interpretation_v2(v_analysis,p_release_code);
      v_actual:=jsonb_build_object('status',v_fact->>'status','gate_reason',v_fact->>'gate_reason','resolved_count',jsonb_array_length(coalesce(v_fact->'interpretations','[]'::jsonb)));
    end if;
    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'interpretation-golden-v2','grammar-structural-shadow-v14',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','interpretation-golden-v2'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>33 then raise exception 'Interpretation V2 Golden expected 33 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;

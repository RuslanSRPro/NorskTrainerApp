insert into public.grammar_golden_tests(
 id,code,test_type,sentence,is_grammatical,expected_tokens,expected_constructions,expected_predicates,
 expected_clauses,expected_dependencies,expected_language_graph,expected_diagnostics,status,test_layer,target_phase,input_fixture,expected_rule_matches
)
values
(gen_random_uuid(),'gt.structural_pos_v1.modal.kan_ringe','positive','Jeg kan ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"external_pos_constraint"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.kan_hende','positive','Det kan hende.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"selected_grammar_pos":"verb"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"hende"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.vil_ringe','positive','Han vil ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"selected_grammar_pos":"verb"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.ville_ringe','positive','Han ville ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"selected_grammar_pos":"verb"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.skulle_ringe','positive','Han skulle ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"selected_grammar_pos":"verb"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.burde_ringe','positive','Han burde ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","refined_local_pos":{"selected_grammar_pos":"verb"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.evidence_contract','positive','Jeg kan ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"resolved_by_structure","structural_hard_evidence":[{"type":"require_pos","pos":"verb","reason_code":"modal_governed_bare_infinitive","source":"structural-pos-refinement-v1"}]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.modal.source_provenance','positive','Jeg kan ringe.',true,'[]','[]','[]','[]','[]','{"structural_hard_evidence":[{"source_candidates":[{"candidate_code":"verb.modal_auxiliary.bare_infinitive","source_section":"7.2.5","verification_status":"source_verified"},{"candidate_code":"verb.modal_auxiliary.core_profile","source_section":"7.2.5","verification_status":"source_verified"}]}]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.np.en_sky_soft','boundary','Jeg ser en sky.',true,'[]','[]','[]','[]','[]','{"refinement_status":"ambiguous_with_structural_support","refined_local_pos":{"status":"ambiguous","selected_grammar_pos":null},"structural_soft_evidence":[{"type":"structural_phrase_support","pos":"noun","strength":"supporting","reason_code":"np_structural_context_support","left_context":"resolved_article_context"}]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"sky"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.np.soft_not_hard','negative','Jeg ser en sky.',true,'[]','[]','[]','[]','[]','{"refinement_status":"ambiguous_with_structural_support","structural_hard_evidence":[]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"sky"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.copula.sky_deferred','boundary','Han er sky.',true,'[]','[]','[]','[]','[]','{"event":"deferred_structural_ambiguity","reason_code":"copular_predicative_may_be_nominal_or_adjectival","token_index":3}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"event","reason_code":"copular_predicative_may_be_nominal_or_adjectival"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.copula.sky_not_forced','negative','Han er sky.',true,'[]','[]','[]','[]','[]','{"refinement_status":"ambiguous_no_structural_resolution","refined_local_pos":{"status":"ambiguous","selected_grammar_pos":null},"structural_hard_evidence":[]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"sky"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.standalone.ringe','boundary','ringe',true,'[]','[]','[]','[]','[]','{"refinement_status":"ambiguous_no_structural_resolution","refined_local_pos":{"status":"ambiguous","selected_grammar_pos":null}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.noop.hus','positive','et stort hus',true,'[]','[]','[]','[]','[]','{"refinement_status":"unchanged_resolved","refined_local_pos":{"selected_grammar_pos":"noun"},"structural_hard_evidence":[],"structural_soft_evidence":[]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"hus"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.noop.store','positive','store biler',true,'[]','[]','[]','[]','[]','{"refinement_status":"unchanged_resolved","refined_local_pos":{"selected_grammar_pos":"adjective"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"store"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.noop.inn','positive','Ungene har gått inn.',true,'[]','[]','[]','[]','[]','{"refinement_status":"unchanged_resolved","refined_local_pos":{"selected_grammar_pos":"preposition"}}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"inn"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.upstream.ma_blocked','boundary','Han må ringe.',true,'[]','[]','[]','[]','[]','{"refinement_status":"ambiguous_no_structural_resolution","refined_local_pos":{"status":"ambiguous","selected_grammar_pos":null},"structural_hard_evidence":[]}','[]','implemented','pipeline_integration','structural_pos_disambiguation','{"kind":"token","surface":"ringe","expected_blocker":"upstream_lexical_gap_ma"}','[]'),
(gen_random_uuid(),'gt.structural_pos_v1.document.isolation','positive','Jeg kan ringe. Han er sky.',true,'[]','[]','[]','[]','[]','{"sentence1":{"surface":"ringe","refinement_status":"resolved_by_structure","selected_grammar_pos":"verb"},"sentence2":{"surface":"sky","refinement_status":"ambiguous_no_structural_resolution","selected_grammar_pos":null}}','[]','implemented','end_to_end','structural_pos_disambiguation','{"kind":"document_isolation"}','[]');

create or replace function public.run_structural_pos_refinement_golden_v1(p_release_code text default 'runtime-structural-v1.7')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_status text; v_batch uuid:=gen_random_uuid(); t record; v_doc jsonb; v_actual jsonb; v_pass boolean; v_count integer:=0; v_s1 jsonb; v_s2 jsonb;
begin
  select id,status into v_release_id,v_status from public.grammar_runtime_releases where code=p_release_code for update;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('build','golden') then raise exception 'Structural POS Golden accepts build/golden, got %',v_status; end if;
  for t in select * from public.grammar_golden_tests where code like 'gt.structural_pos_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1; v_doc:=public.analyze_text_structural_shadow_v7(t.sentence,p_release_code);
    if t.input_fixture->>'kind'='token' then
      select x into v_actual from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,structural_pos_v1,token_resolutions}','[]'::jsonb)) x where x->>'surface'=t.input_fixture->>'surface' order by (x->>'token_index')::integer limit 1;
    elsif t.input_fixture->>'kind'='event' then
      select x into v_actual from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,structural_pos_v1,evidence_events}','[]'::jsonb)) x where x->>'reason_code'=t.input_fixture->>'reason_code' limit 1;
    else
      select x into v_s1 from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph,structural_pos_v1,token_resolutions}','[]'::jsonb)) x where x->>'surface'='ringe' limit 1;
      select x into v_s2 from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences,1,analysis,language_graph,structural_pos_v1,token_resolutions}','[]'::jsonb)) x where x->>'surface'='sky' limit 1;
      v_actual:=jsonb_build_object('sentence1',jsonb_build_object('surface',v_s1->>'surface','refinement_status',v_s1->>'refinement_status','selected_grammar_pos',v_s1#>>'{refined_local_pos,selected_grammar_pos}'),'sentence2',jsonb_build_object('surface',v_s2->>'surface','refinement_status',v_s2->>'refinement_status','selected_grammar_pos',v_s2#>'{refined_local_pos,selected_grammar_pos}'));
    end if;
    v_pass:=coalesce(v_actual,'{}'::jsonb) @> coalesce(t.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(t.id,v_release_id,'structural-pos-refinement-golden-v1','grammar-structural-shadow-v7',v_pass,t.input_fixture,coalesce(v_actual,'{}'::jsonb),case when v_pass then '{}'::jsonb else jsonb_build_object('expected',t.expected_language_graph,'actual',v_actual) end,0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','structural-pos-refinement-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=t.id;
  end loop;
  if v_count<>18 then raise exception 'Structural POS Golden expected 18 tests, got %',v_count; end if;
  return v_batch;
end;
$function$;;

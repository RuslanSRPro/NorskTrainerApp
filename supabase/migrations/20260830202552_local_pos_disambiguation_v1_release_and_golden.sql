do $do$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.4';
  if not found or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.4 must exist in shadow';
  end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  )
  values(
    'runtime-structural-v1.5',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v5',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,
    md5(coalesce(v_parent.checksum,'')||'|runtime-structural-v1.5|local-pos-disambiguation-v1'),
    jsonb_build_object(
      'purpose','Local POS Disambiguation V1',
      'parent_release','runtime-structural-v1.4',
      'parent_runtime_unchanged',true,
      'rules_active',false,
      'child_only_rules',0,
      'local_pos_disambiguation_contract','local-pos-disambiguation-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.local_pos_v1',
      'compatibility_output','existing token.nrg_resolution retained unchanged',
      'resolution_policy','deterministic evidence; no probabilistic ranking',
      'deferred_context_producers',jsonb_build_array('modal-governed infinitive','copular predicative','NP internal structural evidence')
    )
  )
  returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rr.rule_id,rr.manifest_id,rr.compile_role,rr.compiled_hash,rr.is_enabled,
         coalesce(rr.metadata,'{}'::jsonb)||jsonb_build_object('inherited_from','runtime-structural-v1.4')
  from public.grammar_runtime_release_rules rr
  where rr.release_id=v_parent.id;
end
$do$;

-- Component cases: generic resolver behavior.
insert into public.grammar_golden_tests(
  id,code,test_type,sentence,is_grammatical,expected_tokens,expected_constructions,expected_predicates,
  expected_clauses,expected_dependencies,expected_language_graph,expected_diagnostics,status,test_layer,target_phase,input_fixture,expected_rule_matches
)
values
(gen_random_uuid(),'gt.local_pos_v1.component.single_source','positive','x',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_single","selected_grammar_pos":"noun","reason_code":"source_pos_consensus","lexeme_resolution_status":"unique_matching_source_candidate"}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"x","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"noun","lexeme_id":"l1","lemma":"x"}]},"lexical_classes":[]},"morph":{},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.same_pos_multi_lexeme','boundary','sett',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_single","selected_grammar_pos":"verb","lexeme_resolution_status":"multiple_same_pos_source_candidates"}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"sett","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"verb","lexeme_id":"l1","lemma":"se"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"sette"}]},"lexical_classes":[]},"morph":{},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.lexical_override_source','contrastive','inn',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"preposition","reason_code":"lexical_class_pos","lexeme_resolution_status":"grammar_pos_supported_by_different_source_pos","source_pos_set":["adverb"]}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"inn","surface_resolution":{"candidates":[{"candidate_id":"c_adv","source_pos":"adverb","lexeme_id":"l1","lemma":"inn"}]},"lexical_classes":[{"grammar_pos":"preposition","class_code":"preposition_complementless_licensed","derived_surface_candidate_ids":["c_adv"]}]},"morph":{},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.grammar_only_pos','boundary','utenfor',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"preposition","reason_code":"lexical_class_pos","lexeme_resolution_status":"grammar_pos_without_source_candidate","candidate_count":0}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"utenfor","surface_resolution":{"candidates":[]},"lexical_classes":[{"grammar_pos":"preposition","class_code":"preposition_complementless_licensed","derived_surface_candidate_ids":[]}]},"morph":{},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.morph_selected_pos','positive','satt',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"morphology_pos"}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"satt","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"verb","lexeme_id":"l1","lemma":"sitte"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"sette"}]},"lexical_classes":[]},"morph":{"status":"resolved_by_evidence","selected_source_pos":"verb","selected_candidate_id":"c1","selected_reading_id":"verb:past"},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.morph_pos_consensus','boundary','sett',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"morphology_pos","lexeme_resolution_status":"multiple_same_pos_source_candidates"}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"sett","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"verb","lexeme_id":"l1","lemma":"se"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"sette"}]},"lexical_classes":[]},"morph":{"status":"ambiguous","surviving_count":2,"surviving_readings":[{"candidate_id":"c1","source_pos":"verb","reading_id":"verb:past_participle"},{"candidate_id":"c2","source_pos":"verb","reading_id":"verb:imperative"}]},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.cross_pos_ambiguous','boundary','sky',true,'[]','[]','[]','[]','[]',
 '{"status":"ambiguous","reason_code":"multiple_pos_candidates","selected_grammar_pos":null,"competing_pos":["adjective","noun","verb"]}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"sky","surface_resolution":{"candidates":[{"candidate_id":"ca","source_pos":"adjective","lexeme_id":"la","lemma":"sky"},{"candidate_id":"cn","source_pos":"noun","lexeme_id":"ln","lemma":"sky"},{"candidate_id":"cv","source_pos":"verb","lexeme_id":"lv","lemma":"sky"}]},"lexical_classes":[]},"morph":{},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.hard_conflict','negative','x',false,'[]','[]','[]','[]','[]',
 '{"status":"conflict","reason_code":"hard_pos_evidence_conflict","selected_grammar_pos":null,"hard_pos_set":["noun","verb"]}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"x","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"noun","lexeme_id":"l1","lemma":"x"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"x"}]},"lexical_classes":[{"grammar_pos":"noun","class_code":"synthetic_noun"}]},"morph":{"status":"resolved_by_evidence","selected_source_pos":"verb","selected_candidate_id":"c2"},"evidence":[]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.external_require','positive','x',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"external_pos_constraint","lexeme_resolution_status":"unique_matching_source_candidate"}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"x","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"noun","lexeme_id":"l1","lemma":"x"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"x"}]},"lexical_classes":[]},"morph":{},"evidence":[{"type":"require_pos","pos":"verb","reason_code":"synthetic_context"}]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.external_exclude','contrastive','x',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_single","selected_grammar_pos":"verb","reason_code":"source_pos_consensus","excluded_pos_set":["noun"]}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"x","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"noun","lexeme_id":"l1","lemma":"x"},{"candidate_id":"c2","source_pos":"verb","lexeme_id":"l2","lemma":"x"}]},"lexical_classes":[]},"morph":{},"evidence":[{"type":"exclude_pos","pos":"noun","reason_code":"synthetic_context"}]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.unsupported_evidence','negative','x',false,'[]','[]','[]','[]','[]',
 '{"status":"unsupported","reason_code":"unsupported_external_evidence","selected_grammar_pos":null}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"x","surface_resolution":{"candidates":[{"candidate_id":"c1","source_pos":"noun","lexeme_id":"l1","lemma":"x"}]},"lexical_classes":[]},"morph":{},"evidence":[{"type":"magic_score","pos":"noun"}]}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.component.no_candidate','boundary','må',true,'[]','[]','[]','[]','[]',
 '{"status":"no_pos_candidate","reason_code":"no_usable_pos_evidence","selected_grammar_pos":null,"candidate_count":0}','[]','implemented','runtime_component','local_pos_disambiguation',
 '{"kind":"resolver","token":{"token_index":1,"surface":"må","surface_resolution":{"candidates":[]},"lexical_classes":[]},"morph":{},"evidence":[]}','[]'),
-- Integration cases over the real current pipeline.
(gen_random_uuid(),'gt.local_pos_v1.integration.ville_pos','positive','ville',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"morphology_pos"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"ville"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.sett_same_pos','boundary','sett',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","lexeme_resolution_status":"multiple_same_pos_source_candidates"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"sett"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.satt_finite','positive','Han satt stille.',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"verb","reason_code":"morphology_pos"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"satt"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.inn_grammar_override','contrastive','Ungene har gått inn.',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"preposition","reason_code":"lexical_class_pos","source_pos_set":["adverb"],"lexeme_resolution_status":"grammar_pos_supported_by_different_source_pos"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"inn"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.utenfor_grammar_only','boundary','Han må vente utenfor.',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"preposition","reason_code":"lexical_class_pos","lexeme_resolution_status":"grammar_pos_without_source_candidate"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"utenfor"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.ringe_ambiguous','boundary','Jeg kan ringe.',true,'[]','[]','[]','[]','[]',
 '{"status":"ambiguous","selected_grammar_pos":null,"competing_pos":["adjective","noun","verb"]}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.hende_ambiguous','boundary','Det kan hende.',true,'[]','[]','[]','[]','[]',
 '{"status":"ambiguous","selected_grammar_pos":null,"competing_pos":["adjective","noun","verb"]}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"hende"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.sky_ambiguous','boundary','Jeg ser en sky.',true,'[]','[]','[]','[]','[]',
 '{"status":"ambiguous","selected_grammar_pos":null,"competing_pos":["adjective","noun","verb"]}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"sky"}','[]'),
(gen_random_uuid(),'gt.local_pos_v1.integration.article_determiner','positive','Jeg ser en sky.',true,'[]','[]','[]','[]','[]',
 '{"status":"resolved_by_evidence","selected_grammar_pos":"determiner","reason_code":"lexical_class_pos","lexeme_resolution_status":"grammar_pos_supported_by_different_source_pos"}','[]','implemented','pipeline_integration','local_pos_disambiguation',
 '{"kind":"integration","surface":"en"}','[]');

create or replace function public.run_local_pos_disambiguation_golden_v1(
  p_release_code text default 'runtime-structural-v1.5'
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid;
  v_batch uuid := gen_random_uuid();
  v_test record;
  v_actual jsonb;
  v_target jsonb;
  v_pass boolean;
  v_count integer := 0;
begin
  select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;

  for v_test in
    select * from public.grammar_golden_tests
    where code like 'gt.local_pos_v1.%' and status<>'disabled'
    order by code
  loop
    v_count := v_count + 1;
    if v_test.input_fixture->>'kind'='resolver' then
      v_actual := public.resolve_local_pos_token_v1(
        v_test.input_fixture->'token',
        coalesce(v_test.input_fixture->'morph','{}'::jsonb),
        coalesce(v_test.input_fixture->'evidence','[]'::jsonb)
      );
    else
      select p into v_target
      from jsonb_array_elements(
        coalesce(public.analyze_text_structural_shadow_v5(v_test.sentence,p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,local_pos_v1}','[]'::jsonb)
      ) p
      where p->>'surface'=v_test.input_fixture->>'surface'
      order by (p->>'token_index')::integer
      limit 1;
      v_actual := coalesce(v_target,'{}'::jsonb);
    end if;

    v_pass := v_actual @> coalesce(v_test.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(
      golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id
    ) values(
      v_test.id,v_release_id,'local-pos-disambiguation-golden-v1','grammar-structural-shadow-v5',v_pass,
      v_test.input_fixture,v_actual,
      case when v_pass then '{}'::jsonb else jsonb_build_object('expected',v_test.expected_language_graph,'actual',v_actual) end,
      0,clock_timestamp(),clock_timestamp(),v_batch
    );
    update public.grammar_golden_tests
    set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','local-pos-disambiguation-golden-v1'),
        last_run_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=v_test.id;
  end loop;

  if v_count<>21 then raise exception 'Local POS Golden expected exactly 21 tests, found %',v_count; end if;
  return v_batch;
end;
$function$;;

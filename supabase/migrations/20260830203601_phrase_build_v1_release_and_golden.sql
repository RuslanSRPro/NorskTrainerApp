do $do$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.5';
  if not found or v_parent.status<>'shadow' then raise exception 'Parent runtime-structural-v1.5 must be shadow'; end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values(
    'runtime-structural-v1.6',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v6',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,
    md5(coalesce(v_parent.checksum,'')||'|runtime-structural-v1.6|phrase-build-v1'),
    jsonb_build_object(
      'purpose','Phrase Build V1',
      'parent_release','runtime-structural-v1.5',
      'parent_runtime_unchanged',true,
      'rules_active',false,
      'child_only_rules',0,
      'phrase_build_contract','phrase-build-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.phrase_build_v1.resolved_phrases',
      'hypothesis_output','document_graph.sentences[].analysis.language_graph.phrase_build_v1.phrase_hypotheses',
      'compatibility_output','language_graph.phrases retained unchanged',
      'phrase_families',jsonb_build_array('AP','NP','VP'),
      'next_layer','Structural POS Refinement V1'
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rr.rule_id,rr.manifest_id,rr.compile_role,rr.compiled_hash,rr.is_enabled,
         coalesce(rr.metadata,'{}'::jsonb)||jsonb_build_object('inherited_from','runtime-structural-v1.5')
  from public.grammar_runtime_release_rules rr where rr.release_id=v_parent.id;
end
$do$;

insert into public.grammar_golden_tests(
 id,code,test_type,sentence,is_grammatical,expected_tokens,expected_constructions,expected_predicates,expected_clauses,
 expected_dependencies,expected_language_graph,expected_diagnostics,status,test_layer,target_phase,input_fixture,expected_rule_matches
)
values
-- component: resolved AP
(gen_random_uuid(),'gt.phrase_build_v1.component.ap_resolved','positive','synthetic',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":1,"hypothesis_count":0},"resolved_phrases":[{"type":"AP","status":"resolved","head_token_index":1,"member_token_indices":[1]}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"stor","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"stor","status":"resolved_single","selected_grammar_pos":"adjective"}],"morphology_v1":[{"token_index":1,"surface":"stor","status":"resolved_single"}]}}}','[]'),
-- component: ambiguous AP hypothesis only
(gen_random_uuid(),'gt.phrase_build_v1.component.ap_hypothesis','boundary','synthetic',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":0,"hypothesis_count":2},"phrase_hypotheses":[{"type":"AP","status":"hypothesis","head_token_index":1,"required_pos":"adjective"},{"type":"NP","status":"hypothesis","head_token_index":1,"required_pos":"noun"}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"sky","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"sky","status":"ambiguous","competing_pos":["adjective","noun"]}],"morphology_v1":[{"token_index":1,"surface":"sky","status":"ambiguous","surviving_readings":[]}]}}}','[]'),
-- component: NP article adjective noun
(gen_random_uuid(),'gt.phrase_build_v1.component.np_article_adjective','positive','synthetic',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"AP","head_token_index":2},{"type":"NP","head_token_index":3,"span_start":1,"span_end":3,"member_token_indices":[1,2,3]}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"et","lexical_classes":[{"class_code":"indefinite_article"}]},{"token_index":2,"surface":"stort","lexical_classes":[]},{"token_index":3,"surface":"hus","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"et","status":"resolved_by_evidence","selected_grammar_pos":"determiner"},{"token_index":2,"surface":"stort","status":"resolved_single","selected_grammar_pos":"adjective"},{"token_index":3,"surface":"hus","status":"resolved_single","selected_grammar_pos":"noun"}],"morphology_v1":[]}}}','[]'),
-- component: NP structural hypothesis from article
(gen_random_uuid(),'gt.phrase_build_v1.component.np_article_hypothesis','boundary','synthetic',true,'[]','[]','[]','[]','[]',
 '{"phrase_hypotheses":[{"type":"NP","head_token_index":2,"span_start":1,"member_token_indices":[1,2],"support_strength":"structural_context","left_context":"resolved_article_context"}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"en","lexical_classes":[{"class_code":"indefinite_article"}]},{"token_index":2,"surface":"sky","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"en","status":"resolved_by_evidence","selected_grammar_pos":"determiner"},{"token_index":2,"surface":"sky","status":"ambiguous","competing_pos":["adjective","noun","verb"]}],"morphology_v1":[{"token_index":2,"surface":"sky","status":"ambiguous","surviving_readings":[]}]}}}','[]'),
-- component: finite VP single
(gen_random_uuid(),'gt.phrase_build_v1.component.vp_finite','positive','synthetic',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_token_index":1,"span_start":1,"span_end":1,"member_token_indices":[1]}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"kan","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_grammar_pos":"verb"}],"morphology_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_reading":{"source_pos":"verb","features":{"VerbForm":"Fin"}}}]}}}','[]'),
-- component: finite + resolved infinitive
(gen_random_uuid(),'gt.phrase_build_v1.component.vp_compound_resolved','positive','synthetic',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_token_index":1,"span_start":1,"span_end":2,"member_token_indices":[1,2]}],"summary":{"hypothesis_count":0}}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"kan","lexical_classes":[]},{"token_index":2,"surface":"reise","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_grammar_pos":"verb"},{"token_index":2,"surface":"reise","status":"resolved_single","selected_grammar_pos":"verb"}],"morphology_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_reading":{"source_pos":"verb","features":{"VerbForm":"Fin"}}},{"token_index":2,"surface":"reise","status":"resolved_single","selected_reading":{"source_pos":"verb","features":{"VerbForm":"Inf"}},"surviving_readings":[{"source_pos":"verb","features":{"VerbForm":"Inf"}}]}]}}}','[]'),
-- component: finite + ambiguous nonfinite hypothesis
(gen_random_uuid(),'gt.phrase_build_v1.component.vp_extension_hypothesis','boundary','synthetic',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_token_index":1,"span_end":1}],"phrase_hypotheses":[{"type":"VP","status":"hypothesis","base_head_token_index":1,"proposed_member_token_index":2,"required_pos":"verb","reason_code":"possible_nonfinite_vp_extension"}]}','[]','implemented','runtime_component','phrase_build',
 '{"kind":"layer","analysis":{"language_graph":{"tokens":[{"token_index":1,"surface":"kan","lexical_classes":[]},{"token_index":2,"surface":"ringe","lexical_classes":[]}],"local_pos_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_grammar_pos":"verb"},{"token_index":2,"surface":"ringe","status":"ambiguous","competing_pos":["adjective","noun","verb"]}],"morphology_v1":[{"token_index":1,"surface":"kan","status":"resolved_single","selected_reading":{"source_pos":"verb","features":{"VerbForm":"Fin"}}},{"token_index":2,"surface":"ringe","status":"ambiguous","surviving_readings":[{"source_pos":"verb","features":{"VerbForm":"Inf"}}]}]}}}','[]'),
-- integration cases
(gen_random_uuid(),'gt.phrase_build_v1.integration.et_stort_hus','positive','et stort hus',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":2,"hypothesis_count":0},"resolved_phrases":[{"type":"AP","head_surface":"stort","head_token_index":2},{"type":"NP","head_surface":"hus","span_start":1,"span_end":3,"member_token_indices":[1,2,3]}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.store_biler','positive','store biler',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":2,"hypothesis_count":0},"resolved_phrases":[{"type":"AP","head_surface":"store"},{"type":"NP","head_surface":"biler","member_token_indices":[1,2]}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.sky_article_hypothesis','boundary','Jeg ser en sky.',true,'[]','[]','[]','[]','[]',
 '{"phrase_hypotheses":[{"type":"NP","head_surface":"sky","member_token_indices":[3,4],"support_strength":"structural_context","left_context":"resolved_article_context"}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.sky_no_false_resolved_np','negative','Jeg ser en sky.',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":1,"hypothesis_count":2}}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration","forbid_resolved":{"type":"NP","head_surface":"sky"}}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.ringe_vp_hypothesis','boundary','Jeg kan ringe.',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_surface":"kan","span_end":2}],"phrase_hypotheses":[{"type":"VP","base_head_surface":"kan","proposed_member_surface":"ringe","reason_code":"possible_nonfinite_vp_extension"}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.ringe_no_false_resolved_ap_np','negative','Jeg kan ringe.',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":1,"hypothesis_count":3}}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration","forbid_resolved_surface":"ringe"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.hende_hypotheses','boundary','Det kan hende.',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_surface":"kan"}],"phrase_hypotheses":[{"type":"AP","head_surface":"hende"},{"type":"NP","head_surface":"hende"},{"type":"VP","proposed_member_surface":"hende"}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.sky_copular_hypotheses','boundary','Han er sky.',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_surface":"er"}],"phrase_hypotheses":[{"type":"AP","head_surface":"sky"},{"type":"NP","head_surface":"sky"}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.perfect_vp','positive','Ungene har gått inn.',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"NP","head_surface":"Ungene"},{"type":"VP","head_surface":"har","member_token_indices":[2,3],"span_end":3}],"summary":{"hypothesis_count":0}}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.simple_finite_vp','positive','Han reiser.',true,'[]','[]','[]','[]','[]',
 '{"resolved_phrases":[{"type":"VP","head_surface":"reiser","head_token_index":2}]}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration"}','[]'),
(gen_random_uuid(),'gt.phrase_build_v1.integration.no_false_phrase_inn','boundary','Ungene har gått inn.',true,'[]','[]','[]','[]','[]',
 '{"summary":{"resolved_count":2,"hypothesis_count":0}}','[]','implemented','pipeline_integration','phrase_build','{"kind":"integration","forbid_resolved_surface":"inn"}','[]');

create or replace function public.run_phrase_build_golden_v1(p_release_code text default 'runtime-structural-v1.6')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_batch uuid:=gen_random_uuid(); v_test record; v_actual jsonb; v_layer jsonb; v_pass boolean; v_count integer:=0;
begin
  select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;

  for v_test in select * from public.grammar_golden_tests where code like 'gt.phrase_build_v1.%' and status<>'disabled' order by code loop
    v_count:=v_count+1;
    if v_test.input_fixture->>'kind'='layer' then
      v_layer:=public.build_phrase_layer_v1(v_test.input_fixture->'analysis',p_release_code);
    else
      v_actual:=public.analyze_text_structural_shadow_v6(v_test.sentence,p_release_code);
      v_layer:=coalesce(v_actual#>'{document_graph,sentences,0,analysis,language_graph,phrase_build_v1}','{}'::jsonb);
    end if;
    v_pass:=v_layer @> coalesce(v_test.expected_language_graph,'{}'::jsonb);

    if v_pass and v_test.input_fixture ? 'forbid_resolved_surface' then
      if exists(select 1 from jsonb_array_elements(coalesce(v_layer->'resolved_phrases','[]'::jsonb)) p where p->>'head_surface'=v_test.input_fixture->>'forbid_resolved_surface') then v_pass:=false; end if;
    end if;
    if v_pass and v_test.input_fixture ? 'forbid_resolved' then
      if exists(select 1 from jsonb_array_elements(coalesce(v_layer->'resolved_phrases','[]'::jsonb)) p
        where (not (v_test.input_fixture->'forbid_resolved' ? 'type') or p->>'type'=v_test.input_fixture#>>'{forbid_resolved,type}')
          and (not (v_test.input_fixture->'forbid_resolved' ? 'head_surface') or p->>'head_surface'=v_test.input_fixture#>>'{forbid_resolved,head_surface}')) then v_pass:=false; end if;
    end if;

    insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,duration_ms,started_at,finished_at,run_batch_id)
    values(v_test.id,v_release_id,'phrase-build-golden-v1','grammar-structural-shadow-v6',v_pass,v_test.input_fixture,v_layer,
      case when v_pass then '{}'::jsonb else jsonb_build_object('expected',v_test.expected_language_graph,'actual',v_layer,'fixture',v_test.input_fixture) end,
      0,clock_timestamp(),clock_timestamp(),v_batch);
    update public.grammar_golden_tests set last_result=jsonb_build_object('run_batch_id',v_batch,'passed',v_pass,'evaluator_version','phrase-build-golden-v1'),last_run_at=clock_timestamp(),updated_at=clock_timestamp() where id=v_test.id;
  end loop;
  if v_count<>18 then raise exception 'Phrase Build Golden expected 18 tests, found %',v_count; end if;
  return v_batch;
end;
$function$;;

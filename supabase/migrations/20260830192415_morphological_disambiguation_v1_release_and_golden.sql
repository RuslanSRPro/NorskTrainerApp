do $do$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.3';
  if v_parent.id is null or v_parent.status<>'shadow' then raise exception 'Parent runtime-structural-v1.3 must be shadow'; end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.4',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v4',v_parent.lexical_snapshot,v_parent.external_parser_version,'build',
    v_parent.manifest_count,v_parent.rule_count,
    md5(coalesce(v_parent.checksum,'')||'|morphological-disambiguation-v1'),
    jsonb_build_object(
      'purpose','Morphological Disambiguation V1',
      'parent_release','runtime-structural-v1.3',
      'parent_runtime_unchanged',true,
      'morphological_disambiguation_contract','morphological-disambiguation-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.morphology_v1',
      'compatibility_output','language_graph.morph_resolutions retained unchanged',
      'child_only_rules',0,
      'rules_active',false
    )
  )
  on conflict(code) do update set
    engine_version=excluded.engine_version,
    metadata=public.grammar_runtime_releases.metadata||excluded.metadata
  returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rr.rule_id,rr.manifest_id,rr.compile_role,rr.compiled_hash,rr.is_enabled,
         rr.metadata||jsonb_build_object('inherited_from','runtime-structural-v1.3')
  from public.grammar_runtime_release_rules rr
  where rr.release_id=v_parent.id
  on conflict(release_id,rule_id) do nothing;
end;
$do$;

insert into public.grammar_golden_tests(
 code,test_type,sentence,is_grammatical,status,test_layer,target_phase,input_fixture,expected_language_graph,expected_rule_matches
) values
('gt.morph_v1.component.resolved_single','positive','synthetic single reading',true,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"reise","source_pos":"verb","reading_id":"verb:infinitive","features":{"VerbForm":"Inf"}}],"evidence":[]}'::jsonb,
 '{"status":"resolved_single","selected_reading_id":"verb:infinitive"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.component.ambiguous_no_evidence','boundary','synthetic ambiguous reading',true,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"ville","source_pos":"verb","reading_id":"verb:infinitive","features":{"VerbForm":"Inf"}},{"candidate_id":"c1","lemma":"ville","source_pos":"verb","reading_id":"verb:past","features":{"VerbForm":"Fin","Tense":"Past"}}],"evidence":[]}'::jsonb,
 '{"status":"ambiguous","selected_reading_id":null,"surviving_count":2}'::jsonb,'[]'::jsonb),
('gt.morph_v1.component.feature_constraint','positive','synthetic finite constraint',true,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"ville","source_pos":"verb","reading_id":"verb:infinitive","features":{"VerbForm":"Inf"}},{"candidate_id":"c1","lemma":"ville","source_pos":"verb","reading_id":"verb:past","features":{"VerbForm":"Fin","Tense":"Past"}}],"evidence":[{"type":"feature_constraint","reason_code":"finite_predicate_head","features":{"VerbForm":"Fin"}}]}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"verb:past","surviving_count":1}'::jsonb,'[]'::jsonb),
('gt.morph_v1.component.conflict','negative','synthetic impossible constraint',false,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"reise","source_pos":"verb","reading_id":"verb:infinitive","features":{"VerbForm":"Inf"}}],"evidence":[{"type":"feature_constraint","features":{"VerbForm":"Fin"}}]}'::jsonb,
 '{"status":"conflict","selected_reading_id":null,"surviving_count":0}'::jsonb,'[]'::jsonb),
('gt.morph_v1.component.unsupported_evidence','boundary','synthetic unsupported evidence',true,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"reise","source_pos":"verb","reading_id":"verb:infinitive","features":{"VerbForm":"Inf"}}],"evidence":[{"type":"semantic_guess"}]}'::jsonb,
 '{"status":"unsupported","selected_reading_id":null}'::jsonb,'[]'::jsonb),
('gt.morph_v1.component.underspecified_feature','boundary','synthetic underspecified feature',true,'implemented','runtime_component','morphological_disambiguation',
 '{"kind":"resolver","readings":[{"candidate_id":"c1","lemma":"x","source_pos":"adjective","reading_id":"adj:underspecified","features":{"Degree":"Pos"}}],"evidence":[{"type":"feature_constraint","features":{"Number":"Sing"}}]}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"adj:underspecified"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.ville_ambiguous','boundary','ville',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"ville"}'::jsonb,
 '{"status":"ambiguous","selected_reading_id":null,"reading_count":2}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.ville_finite_main','positive','Han ville ikke reise.',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"ville"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"verb:past"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.ville_finite_subordinate','positive','fordi han ikke ville reise.',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"ville"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"verb:past"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.et_stort_hus_hus','positive','et stort hus',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"hus"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"noun:singular_indefinite"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.et_stort_hus_adj','positive','et stort hus',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"stort"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"adjective:positive_neuter"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.store_biler_adj','positive','store biler',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"store"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"adjective:positive_plural"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.en_stor_bil','positive','en stor bil',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"bil"}'::jsonb,
 '{"status":"resolved_by_evidence","selected_reading_id":"noun:singular_indefinite"}'::jsonb,'[]'::jsonb),
('gt.morph_v1.pipeline.reise_single','positive','Han ville ikke reise.',true,'implemented','pipeline_integration','morphological_disambiguation',
 '{"kind":"pipeline","surface":"reise"}'::jsonb,
 '{"status":"resolved_single","selected_reading_id":"verb:infinitive"}'::jsonb,'[]'::jsonb)
on conflict(code) do update set
 test_type=excluded.test_type,sentence=excluded.sentence,is_grammatical=excluded.is_grammatical,status=excluded.status,
 test_layer=excluded.test_layer,target_phase=excluded.target_phase,input_fixture=excluded.input_fixture,
 expected_language_graph=excluded.expected_language_graph,expected_rule_matches=excluded.expected_rule_matches,updated_at=now();

create or replace function public.run_morphological_disambiguation_golden_v1(p_release_code text default 'runtime-structural-v1.4')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid; v_batch uuid:=gen_random_uuid(); v_test record; v_actual jsonb; v_target jsonb; v_pass boolean;
begin
  select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;

  for v_test in
    select * from public.grammar_golden_tests
    where code like 'gt.morph_v1.%' and status<>'disabled'
    order by code
  loop
    if v_test.input_fixture->>'kind'='resolver' then
      v_actual:=public.resolve_morph_readings_v1(v_test.input_fixture->'readings',v_test.input_fixture->'evidence');
    else
      select m into v_target
      from jsonb_array_elements(
        coalesce(public.analyze_text_structural_shadow_v4(v_test.sentence,p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}','[]'::jsonb)
      ) m
      where m->>'surface'=v_test.input_fixture->>'surface'
      order by (m->>'token_index')::integer
      limit 1;
      v_actual:=coalesce(v_target,'{}'::jsonb);
    end if;

    v_pass:=v_actual @> coalesce(v_test.expected_language_graph,'{}'::jsonb);
    insert into public.grammar_golden_test_runs(
      golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,started_at,finished_at,run_batch_id
    ) values(
      v_test.id,v_release_id,'morphological-disambiguation-golden-v1','grammar-structural-shadow-v4',v_pass,
      v_test.input_fixture,v_actual,
      case when v_pass then '{}'::jsonb else jsonb_build_object('expected',v_test.expected_language_graph,'actual',v_actual) end,
      clock_timestamp(),clock_timestamp(),v_batch
    );
  end loop;
  return v_batch;
end;
$function$;;

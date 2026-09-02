do $do$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_new_id uuid;
  v_checksum text;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.16';
  if not found then raise exception 'Parent release not found'; end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.17') then raise exception 'Release already exists'; end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,manifest_count,rule_count,checksum,metadata
  ) values(
    'runtime-structural-v1.17',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v17',v_parent.lexical_snapshot,v_parent.external_parser_version,
    'build',v_parent.manifest_count,v_parent.rule_count,null,
    jsonb_build_object(
      'purpose','Rule Execution Plane Pilot V1',
      'parent_release','runtime-structural-v1.16',
      'next_layer','Representative Rule Suite V1',
      'rules_active',false,
      'child_only_rules',0,
      'pilot_rule_codes',jsonb_build_array(
        'nrg_rt_v1.preposition.complementless_category.candidate_constraint',
        'nrg_rt_v1.structural.noun_phrase.noun_head',
        'nrg_rt_v1.structural.dependency.subject_of_predicate'
      ),
      'pilot_pattern_types',jsonb_build_array('candidate_constraint','phrase_pattern','dependency_pattern'),
      'pilot_policy','shadow architecture audit only; no canonical grammar graph mutation; no global rule activation',
      'immutable_hash_gate',jsonb_build_object(
        'legacy_tokenizer','40819fa48cc6e48372cbf42275f2bb0c',
        'structural_core_v1','b15193a826907ea6082a1aae52f15fec',
        'tokenizer_v2','f76f85eee4469e74079a101da442ec52'
      )
    )
  ) returning id into v_new_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_new_id,rr.rule_id,rr.manifest_id,rr.compile_role,rr.compiled_hash,rr.is_enabled,rr.metadata
  from public.grammar_runtime_release_rules rr where rr.release_id=v_parent.id;

  select md5(string_agg(x,'' order by x)) into v_checksum
  from (
    select gr.code||':'||rr.compiled_hash x
    from public.grammar_runtime_release_rules rr join public.grammar_rules gr on gr.id=rr.rule_id
    where rr.release_id=v_new_id
  ) q;

  update public.grammar_runtime_releases set checksum=v_checksum where id=v_new_id;
end
$do$;

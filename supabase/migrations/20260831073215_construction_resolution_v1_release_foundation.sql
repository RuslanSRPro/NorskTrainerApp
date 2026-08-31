do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.8';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.8 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.9') then
    raise exception 'runtime-structural-v1.9 already exists';
  end if;

  select coalesce(jsonb_object_agg(candidate_code,snapshot),'{}'::jsonb) into v_sources
  from (
    select distinct on (extracted_payload->>'candidate_code')
      extracted_payload->>'candidate_code' candidate_code,
      jsonb_build_object(
        'candidate_id',id,
        'candidate_code',extracted_payload->>'candidate_code',
        'source_section',source_section,
        'verification_status',status,
        'title',title
      ) snapshot
    from public.grammar_knowledge_candidates
    where status in ('verified','source_verified') and extracted_payload->>'candidate_code' in (
      'verb.compound_form.finite_aux_nonfinite_main',
      'verb.compound_form.auxiliary_chain.finiteness',
      'verb.auxiliary.complement.nonfinite_main',
      'verb.modal_auxiliary.chain',
      'verb.modal_auxiliary.chain.finiteness',
      'sentence.predicative.subject.copula.core_verbal_requirement',
      'sentence.predicative.subject.copula.constituent_type_eligibility',
      'sentence.predicative.subject.copula.adjective_phrase.nonlexicalized_perfect_participle_passive_reference'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.9',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v9',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Construction Resolution V1',
      'parent_release','runtime-structural-v1.8',
      'next_layer','Predicate Build V1',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'construction_resolution_contract','construction-resolution-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.construction_resolution_v1.resolution_groups',
      'decision_output','document_graph.sentences[].analysis.language_graph.construction_resolution_v1.construction_decisions',
      'resolution_policy','resolve recognized candidates into groups; preserve hypotheses and blocked competitors; compose only explicitly compatible overlaps',
      'compatibility_policy',jsonb_build_object(
        'modal_auxiliary_chain',jsonb_build_array('modal_auxiliary_bare_infinitive')
      ),
      'construction_resolution_compiled_sources',v_sources,
      'deferred_resolution_families',jsonb_build_array(
        'passive_vs_copular_participle',
        'modal_ellipsis_recovery',
        'infinitive_relative_resolution',
        'semantic_modal_scope',
        'tense_aspect_interpretation'
      ),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.9|'||coalesce(v_parent.checksum,'')||'|construction-resolution-v1|'||v_sources::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.construction_resolution_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','construction-resolution-v1',
  'input','language_graph.construction_recognition_v1 {constructions, overlaps, blocked_events}',
  'authoritative_outputs',jsonb_build_array(
    'language_graph.construction_resolution_v1.resolution_groups',
    'language_graph.construction_resolution_v1.construction_decisions',
    'language_graph.construction_resolution_v1.resolved_relations'
  ),
  'decision_states',jsonb_build_array('selected','compatible_component','unresolved','rejected'),
  'group_states',jsonb_build_array('resolved','unresolved','blocked'),
  'relation_states',jsonb_build_array('compatible','competing'),
  'policy',jsonb_build_array(
    'Recognition output is immutable input; Resolution never creates new construction candidates',
    'recognized singleton candidates are selected when no competing overlap or blocked competitor exists',
    'recognition hypotheses remain unresolved until discriminating evidence exists',
    'modal_auxiliary_chain and modal_auxiliary_bare_infinitive may compose into one resolved group',
    'unknown overlapping families default to competing/unresolved rather than winner-by-priority',
    'blocked competitors keep an otherwise recognized candidate unresolved when their spans overlap'
  ),
  'causal_trace','Every decision carries recognition id, reason_code, relation/group evidence, and source provenance when a resolution rule is source-backed.',
  'non_goals',jsonb_build_array(
    'new construction recognition','passive recovery','ellipsis recovery','modal scope interpretation',
    'tense/aspect interpretation','predicate build','clause build','semantic role assignment'
  ),
  'architecture_closed_criterion','Known overlap/competition families attach through compatibility or competition policies and common resolution groups without changing Recognition or upstream runtime code.'
);
$function$;

create or replace function public.construction_resolution_source_v1(p_release_code text,p_candidate_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce(r.metadata#>array['construction_resolution_compiled_sources',p_candidate_code],'{}'::jsonb)
from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;;

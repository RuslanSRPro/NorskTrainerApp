do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.13';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.13 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.14') then
    raise exception 'runtime-structural-v1.14 already exists';
  end if;

  select coalesce(jsonb_object_agg(candidate_code,snapshot),'{}'::jsonb) into v_sources
  from (
    select distinct on (extracted_payload->>'candidate_code')
      extracted_payload->>'candidate_code' candidate_code,
      jsonb_build_object(
        'candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,
        'verification_status',status,'title',title,'details',coalesce(extracted_payload->'details','{}'::jsonb)
      ) snapshot
    from public.grammar_knowledge_candidates
    where status in ('verified','source_verified') and extracted_payload->>'candidate_code' in (
      'grammar.foundations.sentence.subject_predicate_core',
      'verb.tense.definition.finite_form_entailment',
      'grammar.foundations.inflection.tense',
      'verb.tense.forms.simple_inventory',
      'verb.tense.forms.perfect_system',
      'verb.tense.forms.present_perfect',
      'verb.tense.forms.preterite_perfect',
      'verb.tense.forms.finite_auxiliary_opposition',
      'verb.tense.forms.morphological_opposition_carrier',
      'verb.temporal_reference.punctual_terminative.perfect_system_before_relation',
      'verb.modal_auxiliary.bare_infinitive',
      'verb.modal_auxiliary.chain',
      'verb.modal_auxiliary.chain.finiteness',
      'verb.modal_auxiliary.chain.scope_order',
      'verb.modal_constructions.modal_meaning_depends_on_sentence_type',
      'verb.modal_constructions.modal_meaning_depends_on_tense',
      'grammar.foundations.phrase.copula_predicative_link',
      'sentence.predicative.subject.copula.core_verbal_requirement',
      'sentence.predicative.subject.copula.constituent_type_eligibility',
      'verb.infinitive.semantic_definition',
      'grammar.foundations.sentence.infinitive_construction_definition',
      'sentence.subordinate.explicative.nominal.infinitive.reference.infinitive_verbal_no_subject',
      'sentence.subordinate.explicative.nominal.infinitive.subject.reference.unexpressed_but_interpreted_subject',
      'sentence.subordinate.explicative.nominal.infinitive.subject.reference.controller_depends_on_function'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.14',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v14',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Interpretation V2',
      'parent_release','runtime-structural-v1.13',
      'next_layer','Sentence Model V2',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'interpretation_contract','interpretation-v2',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.interpretation_v2.interpretations',
      'hypothesis_output','document_graph.sentences[].analysis.language_graph.interpretation_v2.interpretation_hypotheses',
      'blocked_output','document_graph.sentences[].analysis.language_graph.interpretation_v2.blocked_interpretations',
      'interpretation_compiled_sources',v_sources,
      'interpretation_families',jsonb_build_array(
        'finite_predication','morphological_tense','perfect_tense_form','modal_structure','copular_predication','nonfinite_infinitive_profile'
      ),
      'deferred_interpretation_dimensions',jsonb_build_array(
        'epistemic_deontic_modal_reading','semantic_modal_scope','future_reading','lexical_aspect','control_and_PRO_controller',
        'nonfinite_attachment','copular_identifying_vs_characterizing','semantic_roles','passive_interpretation','discourse_reference'
      ),
      'validation_gate','Grammar Validation V2 invalid => no authoritative interpretations; unresolved/blocked states propagate without grammar-error inflation',
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.14|'||coalesce(v_parent.checksum,'')||'|interpretation-v2|'||v_sources::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.interpretation_contract_v2()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','interpretation-v2',
  'input_layers',jsonb_build_array('grammar_validation_v2','predicate_build_v1','clause_build_v1','dependency_build_v2','morphology_v1','sentence-local tokens'),
  'authoritative_output','language_graph.interpretation_v2.interpretations',
  'hypothesis_output','language_graph.interpretation_v2.interpretation_hypotheses',
  'blocked_output','language_graph.interpretation_v2.blocked_interpretations',
  'fact_families',jsonb_build_array('finite_predication','morphological_tense','perfect_tense_form','modal_structure','copular_predication','nonfinite_infinitive_profile'),
  'policy',jsonb_build_array(
    'interpretation consumes validated materialized graph facts and never rebuilds syntax',
    'interpretation facts are dimension-specific and additive rather than one monolithic sentence meaning',
    'finite morphological tense is read only from selected morphology on the finite predicate token',
    'perfect tense form requires a validated auxiliary_compound with ha as finite auxiliary and a resolved past-participle lexical head',
    'modal_structure preserves ordered modal operators but does not assign epistemic/deontic meaning, future meaning, or semantic scope',
    'copular_predication links explicit subject and predicative complement but does not force identifying/characterizing subtype',
    'nonfinite infinitive profile records absent overt subject and lack of independent tense/modal marking; PRO/controller resolution remains deferred',
    'invalid Grammar Validation V2 globally gates authoritative interpretation for the sentence analysis',
    'unresolved and blocked upstream states propagate as interpretation_hypotheses / blocked_interpretations rather than semantic errors',
    'legacy language_graph.interpretations remains immutable and is not an oracle for V2'
  ),
  'statuses',jsonb_build_array('resolved','hypothesis','blocked'),
  'deferred_dimensions',jsonb_build_array('semantic_modal_scope','modal_reading','future_reading','lexical_aspect','control_PRO','nonfinite_attachment','semantic_roles','passive','copular_semantic_subtype'),
  'architecture_closed_criterion','New validated interpretation dimensions are added as independent facts with provenance; existing syntax and interpretation facts do not need mutation.'
);
$function$;

create or replace function public.interpretation_source_v2(p_release_code text,p_candidate_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce(r.metadata#>array['interpretation_compiled_sources',p_candidate_code],'{}'::jsonb)
from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;

create or replace function public.interpretation_morph_by_index_v2(p_analysis jsonb,p_idx integer)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) x
where nullif(x->>'token_index','')::integer=p_idx limit 1;
$function$;

create or replace function public.interpretation_token_by_index_v2(p_analysis jsonb,p_idx integer)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) x
where nullif(x->>'token_index','')::integer=p_idx limit 1;
$function$;

create or replace function public.interpretation_predicate_by_id_v2(p_analysis jsonb,p_id text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) x
where x->>'id'=p_id limit 1;
$function$;

create or replace function public.interpretation_clause_by_predicate_v2(p_analysis jsonb,p_id text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb)) x
where x->>'predicate_id'=p_id order by x->>'id' limit 1;
$function$;

create or replace function public.interpretation_dependency_by_relation_v2(p_analysis jsonb,p_relation text,p_predicate_id text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) x
where x->>'relation'=p_relation and (x->>'predicate_id'=p_predicate_id or x->>'source_id'=p_predicate_id or x->>'target_id'=p_predicate_id)
order by x->>'id' limit 1;
$function$;

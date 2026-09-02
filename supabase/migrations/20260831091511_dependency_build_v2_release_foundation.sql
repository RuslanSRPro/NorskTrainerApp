do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
  v_rule_refs jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.11';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.11 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.12') then
    raise exception 'runtime-structural-v1.12 already exists';
  end if;

  select coalesce(jsonb_object_agg(candidate_code,snapshot),'{}'::jsonb) into v_sources
  from (
    select distinct on (extracted_payload->>'candidate_code')
      extracted_payload->>'candidate_code' candidate_code,
      jsonb_build_object(
        'candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,
        'verification_status',status,'title',title
      ) snapshot
    from public.grammar_knowledge_candidates
    where status in ('verified','source_verified') and extracted_payload->>'candidate_code' in (
      'grammar.foundations.sentence.subject_predicate_core',
      'sentence.subject.definition.nominal_finite_predicate',
      'verb.phrase.predicate',
      'verb.form.finite.predicate_head',
      'verb.compound_form.finite_aux_nonfinite_main',
      'verb.auxiliary.complement.nonfinite_main',
      'verb.modal_auxiliary.chain',
      'verb.modal_auxiliary.chain.finiteness',
      'grammar.foundations.phrase.copula_predicative_link',
      'verb.infinitive.construction_head',
      'verb.infinitive.marker.aa',
      'sentence.subordinate.explicative.nominal.infinitive.reference.infinitive_verbal_no_subject'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  select coalesce(jsonb_object_agg(r.code,jsonb_build_object(
    'rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,
    'constraint_strength',r.result->>'constraint_strength','runtime_family',r.result->>'runtime_family'
  )),'{}'::jsonb) into v_rule_refs
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled
  join public.grammar_rules r on r.id=rr.rule_id
  where rel.code='runtime-structural-v1.11' and r.code in (
    'nrg_rt_v1.structural.dependency.subject_of_predicate',
    'nrg_rt_v1.structural.clause.subject_finite_predicate',
    'nrg_rt_v1.structural.predicate.verb_phrase'
  );

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.12',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v12',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Dependency Build V2',
      'parent_release','runtime-structural-v1.11',
      'next_layer','Grammar Validation V2',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'dependency_build_contract','dependency-build-v2',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.dependency_build_v2.dependencies',
      'hypothesis_output','document_graph.sentences[].analysis.language_graph.dependency_build_v2.dependency_hypotheses',
      'blocked_output','document_graph.sentences[].analysis.language_graph.dependency_build_v2.blocked_dependencies',
      'legacy_dependency_role','language_graph.dependencies / Structural Dependency Bridge V1 retained unchanged for compatibility and regression only',
      'dependency_build_compiled_sources',v_sources,
      'dependency_build_compiled_rule_refs',v_rule_refs,
      'relation_inventory',jsonb_build_array(
        'predicate_of_clause','subject_of','grammatical_head_of_predicate','finite_member_of_predicate',
        'lexical_head_of_predicate','modal_governs','auxiliary_governs','copula_links_predicative','infinitive_marker_of_predicate'
      ),
      'deferred_dependency_capabilities',jsonb_build_array(
        'object_and_complement_dependencies','adverbial_attachment','nonfinite_clause_attachment','control_and_raising',
        'semantic_roles','coordination','passive_argument_mapping','full_np_internal_dependencies'
      ),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.12|'||coalesce(v_parent.checksum,'')||'|dependency-build-v2|'||v_sources::text||'|'||v_rule_refs::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.dependency_build_contract_v2()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','dependency-build-v2',
  'input_layers',jsonb_build_array('predicate_build_v1','clause_build_v1','sentence-local tokens'),
  'authoritative_output','language_graph.dependency_build_v2.dependencies',
  'hypothesis_output','language_graph.dependency_build_v2.dependency_hypotheses',
  'blocked_output','language_graph.dependency_build_v2.blocked_dependencies',
  'entity_types',jsonb_build_array('token','predicate','clause'),
  'relations',jsonb_build_array(
    'predicate_of_clause','subject_of','grammatical_head_of_predicate','finite_member_of_predicate',
    'lexical_head_of_predicate','modal_governs','auxiliary_governs','copula_links_predicative','infinitive_marker_of_predicate'
  ),
  'policy',jsonb_build_array(
    'resolved Clause Build clauses and resolved Predicate Build predicates are the authoritative graph sources',
    'finite resolved clauses emit subject_of only when Clause Build has an explicit subject token',
    'each resolved clause emits predicate_of_clause to its resolved predicate',
    'predicate structural member roles are materialized from Predicate Build fields without re-inferring morphology or construction identity',
    'modal and auxiliary governor edges are emitted only for resolved modal/auxiliary predicate kinds',
    'copula predicative edge is emitted only for resolved copular predicates with an explicit predicative complement token',
    'marked infinitive may emit infinitive_marker_of_predicate but its unexpressed subject never receives a guessed dependency',
    'clause hypotheses produce dependency_hypotheses; blocked clauses produce blocked_dependencies; neither creates authoritative edges',
    'legacy language_graph.dependencies remains immutable and is not an oracle for V2'
  ),
  'statuses',jsonb_build_array('resolved','hypothesis','blocked'),
  'non_goals',jsonb_build_array(
    'object/complement attachment','adverbial attachment','control/raising','semantic roles','passive mapping',
    'coordination','full dependency tree completion','replacement of legacy Dependency Bridge V1'
  ),
  'architecture_closed_criterion','Known predicate/clause structural relations are emitted through generic entity-role mappings; new complement/argument producers can add edges without changing upstream Predicate or Clause contracts.'
);
$function$;

create or replace function public.dependency_build_source_v2(p_release_code text,p_candidate_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce(r.metadata#>array['dependency_build_compiled_sources',p_candidate_code],'{}'::jsonb)
from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;

create or replace function public.dependency_build_token_surface_v2(p_analysis jsonb,p_idx integer)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
select t->>'surface' from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
where nullif(t->>'token_index','')::integer=p_idx limit 1;
$function$;

create or replace function public.dependency_build_predicate_by_id_v2(p_analysis jsonb,p_id text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select p from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) p
where p->>'id'=p_id limit 1;
$function$;

create or replace function public.dependency_build_provenance_v2(p_release_code text,p_relation text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_out jsonb:='[]'::jsonb; v_codes text[]; v_code text; v_s jsonb;
begin
  v_codes:=case p_relation
    when 'subject_of' then array['grammar.foundations.sentence.subject_predicate_core','sentence.subject.definition.nominal_finite_predicate']
    when 'predicate_of_clause' then array['verb.phrase.predicate','grammar.foundations.sentence.subject_predicate_core']
    when 'grammatical_head_of_predicate' then array['verb.form.finite.predicate_head']
    when 'finite_member_of_predicate' then array['verb.form.finite.predicate_head']
    when 'lexical_head_of_predicate' then array['verb.compound_form.finite_aux_nonfinite_main','verb.auxiliary.complement.nonfinite_main']
    when 'modal_governs' then array['verb.modal_auxiliary.chain','verb.modal_auxiliary.chain.finiteness']
    when 'auxiliary_governs' then array['verb.compound_form.finite_aux_nonfinite_main','verb.auxiliary.complement.nonfinite_main']
    when 'copula_links_predicative' then array['grammar.foundations.phrase.copula_predicative_link']
    when 'infinitive_marker_of_predicate' then array['verb.infinitive.marker.aa','verb.infinitive.construction_head']
    else array[]::text[] end;
  foreach v_code in array v_codes loop
    v_s:=public.dependency_build_source_v2(p_release_code,v_code);
    if v_s is not null and v_s<>'{}'::jsonb then v_out:=v_out||jsonb_build_array(v_s); end if;
  end loop;
  return v_out;
end;
$function$;

do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
  v_rule_refs jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.10';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.10 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.11') then
    raise exception 'runtime-structural-v1.11 already exists';
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
      'grammar.foundations.sentence.subject_predicate_core',
      'grammar.foundations.sentence.finite_predicate',
      'sentence.subject.definition.nominal_finite_predicate',
      'verb.infinitive.construction_head',
      'sentence.subordinate.explicative.nominal.infinitive.reference.derived_from_at_clause_analysis',
      'sentence.subordinate.explicative.nominal.infinitive.reference.function_parallel_at_clause',
      'sentence.subordinate.explicative.nominal.infinitive.reference.bare_after_aux_is_verb_phrase'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  select coalesce(jsonb_object_agg(r.code,jsonb_build_object(
    'rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,
    'execution_phase',coalesce(r.result->>'execution_phase',r.pattern->>'execution_phase'),
    'constraint_strength',r.result->>'constraint_strength'
  )),'{}'::jsonb) into v_rule_refs
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled
  join public.grammar_rules r on r.id=rr.rule_id
  where rel.code='runtime-structural-v1.10' and r.code in (
    'nrg_rt_v1.structural.clause.subject_finite_predicate',
    'nrg_rt_v1.structural.schema.a.declarative_main',
    'nrg_rt_v1.structural.schema.b.subordinate_default'
  );

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.11',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v11',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Clause Build V1',
      'parent_release','runtime-structural-v1.10',
      'next_layer','Dependency Build V2',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'clause_build_contract','clause-build-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.clause_build_v1.clauses',
      'hypothesis_output','document_graph.sentences[].analysis.language_graph.clause_build_v1.clause_hypotheses',
      'blocked_output','document_graph.sentences[].analysis.language_graph.clause_build_v1.blocked_clauses',
      'clause_build_compiled_sources',v_sources,
      'clause_build_compiled_rule_refs',v_rule_refs,
      'supported_clause_forms',jsonb_build_array('finite_predicate_core','nonfinite_infinitive'),
      'legacy_clause_role','subject/schema anchor only; legacy clauses remain immutable compatibility input',
      'deferred_clause_capabilities',jsonb_build_array(
        'full_clause_extent','subordinate_clause_recognition','matrix_embedded_attachment','control_and_raising',
        'imperative_subjectless_clause','question_clause_typing','coordination','ellipsis_recovery','passive_resolution'
      ),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.11|'||coalesce(v_parent.checksum,'')||'|clause-build-v1|'||v_sources::text||'|'||v_rule_refs::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.clause_build_contract_v1()
returns jsonb language sql immutable security invoker set search_path=''
as $function$
select jsonb_build_object(
  'version','clause-build-v1',
  'input_layers',jsonb_build_array('predicate_build_v1','legacy language_graph.clauses as finite subject/schema anchors','sentence-local tokens'),
  'authoritative_output','language_graph.clause_build_v1.clauses',
  'hypothesis_output','language_graph.clause_build_v1.clause_hypotheses',
  'blocked_output','language_graph.clause_build_v1.blocked_clauses',
  'clause_types',jsonb_build_array('finite','nonfinite'),
  'clause_forms',jsonb_build_array('finite_predicate_core','nonfinite_infinitive'),
  'extent_model',jsonb_build_object('finite','core extent from explicit subject anchor through predicate extent; complements/adjuncts are not silently absorbed','nonfinite','predicate construction extent only until attachment/valency is resolved'),
  'subject_model',jsonb_build_object('finite','explicit subject inherited only when legacy finite anchor matches the predicate finite token','nonfinite','unexpressed by default; control/raising/coreference is deferred'),
  'policy',jsonb_build_array(
    'resolved finite predicates with an explicit finite subject anchor produce authoritative finite clauses',
    'resolved nonfinite_infinitive predicates produce authoritative nonfinite clause units with unexpressed subject',
    'predicate hypotheses produce clause hypotheses and never authoritative clauses',
    'blocked predicates produce blocked clauses and suppress finite fallback',
    'bare infinitive inside modal/auxiliary compound predicates remains inside the finite clause and never becomes a separate nonfinite clause',
    'word-order schema from legacy clauses is compatibility evidence only and is exposed as schema_hint',
    'Predicate Build and legacy language_graph.clauses are immutable inputs'
  ),
  'statuses',jsonb_build_array('resolved','hypothesis','blocked'),
  'attachment_states',jsonb_build_array('matrix_or_sentence_core','unresolved_nonfinite_attachment'),
  'non_goals',jsonb_build_array('full subordinate-clause recognition','complement/adjunct attachment','control/raising','semantic subject recovery','imperative recovery','question typing','coordination','dependency rebuild','semantic roles','word-order validation'),
  'architecture_closed_criterion','Known predicate types map to common finite/nonfinite clause units, while new subject/attachment producers can be added without mutating Predicate Build or the clause object contract.'
);
$function$;

create or replace function public.clause_build_source_v1(p_release_code text,p_candidate_code text)
returns jsonb language sql stable security invoker set search_path='public','pg_catalog'
as $function$
select coalesce(r.metadata#>array['clause_build_compiled_sources',p_candidate_code],'{}'::jsonb) from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;

create or replace function public.clause_build_legacy_anchor_v1(p_analysis jsonb,p_finite_index integer)
returns jsonb language sql immutable security invoker set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) x where nullif(x->>'finite_token_index','')::integer=p_finite_index order by x->>'id' limit 1;
$function$;

create or replace function public.clause_build_surface_range_v1(p_analysis jsonb,p_start integer,p_end integer)
returns text language sql immutable security invoker set search_path=''
as $function$
select string_agg(t->>'surface',' ' order by (t->>'token_index')::integer) from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t where (t->>'token_index')::integer between p_start and p_end;
$function$;

create or replace function public.clause_build_provenance_v1(p_release_code text,p_clause_type text)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog'
as $function$
declare v_out jsonb:='[]'::jsonb; v_s jsonb;
begin
  if p_clause_type='finite' then
    foreach v_s in array array[public.clause_build_source_v1(p_release_code,'grammar.foundations.sentence.subject_predicate_core'),public.clause_build_source_v1(p_release_code,'grammar.foundations.sentence.finite_predicate'),public.clause_build_source_v1(p_release_code,'sentence.subject.definition.nominal_finite_predicate')] loop
      if v_s is not null and v_s<>'{}'::jsonb then v_out:=v_out||jsonb_build_array(v_s); end if;
    end loop;
  elsif p_clause_type='nonfinite' then
    foreach v_s in array array[public.clause_build_source_v1(p_release_code,'verb.infinitive.construction_head'),public.clause_build_source_v1(p_release_code,'sentence.subordinate.explicative.nominal.infinitive.reference.function_parallel_at_clause'),public.clause_build_source_v1(p_release_code,'sentence.subordinate.explicative.nominal.infinitive.reference.derived_from_at_clause_analysis')] loop
      if v_s is not null and v_s<>'{}'::jsonb then v_out:=v_out||jsonb_build_array(v_s); end if;
    end loop;
  end if;
  return v_out;
end;
$function$;

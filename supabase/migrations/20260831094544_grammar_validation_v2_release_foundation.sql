do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
  v_rule_refs jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.12';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.12 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.13') then
    raise exception 'runtime-structural-v1.13 already exists';
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
      'grammar.foundations.sentence.finite_predicate',
      'sentence.subject.definition.nominal_finite_predicate',
      'grammar.foundations.phrase.auxiliary_chain_finiteness',
      'verb.modal_auxiliary.chain',
      'verb.modal_auxiliary.chain.finiteness',
      'verb.compound_form.finite_aux_nonfinite_main',
      'verb.auxiliary.complement.nonfinite_main',
      'grammar.foundations.phrase.copula_predicative_link',
      'grammar.foundations.sentence.infinitive_construction_definition',
      'verb.infinitive.construction_head',
      'verb.infinitive.marker.aa',
      'sentence.subordinate.explicative.nominal.infinitive.reference.infinitive_verbal_no_subject'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  select coalesce(jsonb_object_agg(r.code,jsonb_build_object(
    'rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,'rule_type',r.rule_type,
    'constraint_strength',r.result->>'constraint_strength','runtime_family',r.result->>'runtime_family'
  )),'{}'::jsonb) into v_rule_refs
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled
  join public.grammar_rules r on r.id=rr.rule_id
  where rel.code='runtime-structural-v1.12' and r.code in (
    'nrg_rt_v1.structural.clause.subject_finite_predicate',
    'nrg_rt_v1.structural.dependency.subject_of_predicate',
    'nrg_rt_v1.structural.predicate.verb_phrase',
    'nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_a',
    'nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_b'
  );

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.13',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v13',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Grammar Validation V2',
      'parent_release','runtime-structural-v1.12',
      'next_layer','Interpretation V2',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'grammar_validation_contract','grammar-validation-v2',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.grammar_validation_v2.validation_events',
      'diagnostic_output','document_graph.sentences[].analysis.language_graph.grammar_validation_v2.diagnostics',
      'legacy_validation_role','legacy language_graph.validations/diagnostics retained unchanged; V2 validates materialized Predicate/Clause/Dependency V2 graph',
      'grammar_validation_compiled_sources',v_sources,
      'grammar_validation_compiled_rule_refs',v_rule_refs,
      'validation_families',jsonb_build_array(
        'clause_predicate_integrity','finite_subject_integrity','finite_head_integrity','modal_governance',
        'auxiliary_governance','copular_link','nonfinite_infinitive_shape','dependency_reference_integrity',
        'unresolved_propagation','blocked_propagation'
      ),
      'deferred_validation_families',jsonb_build_array(
        'schema_a_b_word_order','object_valency','adverbial_attachment','agreement_beyond_existing_morph_layer',
        'control_and_raising','passive_argument_mapping','subordinate_clause_constraints','question_and_imperative_constraints'
      ),
      'word_order_validation_boundary','A/B rules are compiled but not executed in Grammar Validation V2 until Clause Build exposes reliable connector/adverbial fields',
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.13|'||coalesce(v_parent.checksum,'')||'|grammar-validation-v2|'||v_sources::text||'|'||v_rule_refs::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.grammar_validation_contract_v2()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','grammar-validation-v2',
  'input_layers',jsonb_build_array('predicate_build_v1','clause_build_v1','dependency_build_v2','sentence-local tokens'),
  'authoritative_output','language_graph.grammar_validation_v2.validation_events',
  'diagnostic_output','language_graph.grammar_validation_v2.diagnostics',
  'event_statuses',jsonb_build_array('valid','warning','invalid','unresolved','blocked'),
  'severities',jsonb_build_array('info','warning','error'),
  'validation_families',jsonb_build_array(
    'clause_predicate_integrity','finite_subject_integrity','finite_head_integrity','modal_governance',
    'auxiliary_governance','copular_link','nonfinite_infinitive_shape','dependency_reference_integrity',
    'unresolved_propagation','blocked_propagation'
  ),
  'policy',jsonb_build_array(
    'validation consumes materialized graph state and never re-recognizes constructions',
    'resolved finite clauses must link to exactly one resolved predicate and preserve explicit subject_of relation',
    'finite predicate head/member relations must agree with Predicate Build token indices',
    'modal, auxiliary, copular and marked-infinitive predicates must expose their required resolved dependency topology',
    'nonfinite infinitive clauses must not acquire a guessed subject_of or finite_member edge',
    'clause/dependency hypotheses are propagated as unresolved validation events, not grammar errors',
    'blocked clauses/dependencies are propagated as blocked validation events, not grammar errors',
    'dangling dependency references are structural errors',
    'legacy validations and diagnostics remain immutable and are not an oracle for V2'
  ),
  'deferred',jsonb_build_array(
    'A/B word-order validation until connector/adverbial attachment exists','object/valency validation','control/raising',
    'passive argument mapping','subordinate-clause constraints','semantic/pragmatic interpretation'
  ),
  'architecture_closed_criterion','Known materialized clause/predicate/dependency families are checked by generic structural invariants; adding new grammar checks does not require mutating upstream graph builders.'
);
$function$;

create or replace function public.grammar_validation_source_v2(p_release_code text,p_candidate_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce(r.metadata#>array['grammar_validation_compiled_sources',p_candidate_code],'{}'::jsonb)
from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;

create or replace function public.grammar_validation_edge_count_v2(p_analysis jsonb,p_relation text,p_predicate_id text default null,p_clause_id text default null)
returns integer
language sql
immutable
security invoker
set search_path=''
as $function$
select count(*)::integer
from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) d
where d->>'relation'=p_relation
  and (p_predicate_id is null or d->>'predicate_id'=p_predicate_id or d->>'source_id'=p_predicate_id or d->>'target_id'=p_predicate_id)
  and (p_clause_id is null or d->>'clause_id'=p_clause_id or d->>'target_id'=p_clause_id);
$function$;

create or replace function public.grammar_validation_has_token_v2(p_analysis jsonb,p_idx integer)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select exists(
  select 1 from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
  where nullif(t->>'token_index','')::integer=p_idx
);
$function$;

create or replace function public.grammar_validation_provenance_v2(p_release_code text,p_family text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_out jsonb:='[]'::jsonb; v_codes text[]; v_code text; v_s jsonb;
begin
  v_codes:=case p_family
    when 'clause_predicate_integrity' then array['grammar.foundations.sentence.subject_predicate_core','grammar.foundations.sentence.finite_predicate']
    when 'finite_subject_integrity' then array['grammar.foundations.sentence.subject_predicate_core','sentence.subject.definition.nominal_finite_predicate']
    when 'finite_head_integrity' then array['grammar.foundations.sentence.finite_predicate']
    when 'modal_governance' then array['grammar.foundations.phrase.auxiliary_chain_finiteness','verb.modal_auxiliary.chain','verb.modal_auxiliary.chain.finiteness']
    when 'auxiliary_governance' then array['verb.compound_form.finite_aux_nonfinite_main','verb.auxiliary.complement.nonfinite_main']
    when 'copular_link' then array['grammar.foundations.phrase.copula_predicative_link']
    when 'nonfinite_infinitive_shape' then array['grammar.foundations.sentence.infinitive_construction_definition','verb.infinitive.construction_head','verb.infinitive.marker.aa','sentence.subordinate.explicative.nominal.infinitive.reference.infinitive_verbal_no_subject']
    else array[]::text[] end;
  foreach v_code in array v_codes loop
    v_s:=public.grammar_validation_source_v2(p_release_code,v_code);
    if v_s is not null and v_s<>'{}'::jsonb then v_out:=v_out||jsonb_build_array(v_s); end if;
  end loop;
  return v_out;
end;
$function$;

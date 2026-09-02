create table if not exists public.grammar_representative_rule_suite_v1 (
  id uuid primary key default gen_random_uuid(),
  suite_code text not null,
  ordinal integer not null,
  chapter integer not null,
  candidate_id uuid not null references public.grammar_knowledge_candidates(id),
  candidate_code text not null,
  capability_family text not null,
  architecture_probe text not null,
  expected_current_state text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(suite_code,ordinal),
  unique(suite_code,candidate_id)
);

insert into public.grammar_representative_rule_suite_v1(suite_code,ordinal,chapter,candidate_id,candidate_code,capability_family,architecture_probe,expected_current_state,notes)
select v.suite_code,v.ordinal,v.chapter,c.id,v.candidate_code,v.capability_family,v.architecture_probe,v.expected_current_state,v.notes
from (values
('representative-rule-suite-v1',1,1,'grammar.foundations.form_function.same_form_multiple_functions','meta_grammar','form_function_ambiguity','reference_or_interpretive','Foundational distinction; not every verified candidate should become an executable runtime rule.'),
('representative-rule-suite-v1',2,2,'wordformation.overview.compounding','word_formation','compound_structure','new_generic_capability_required','Tests whether build plane distinguishes reference taxonomy from executable word-formation analysis.'),
('representative-rule-suite-v1',3,3,'noun_phrase.structure.noun_head_default','noun_phrase','phrase_head','compiled_operator_expected','Existing NP phrase rule.'),
('representative-rule-suite-v1',4,3,'noun.general.number_inflection','morphology','noun_number_inflection','source_to_morphology_mapping_required','Morphology layer exists; NRG rule is not compiled into it.'),
('representative-rule-suite-v1',5,4,'pronoun.general.classification.personal_case_inflection','morphology','pronoun_case_inflection','source_to_morphology_mapping_required','Tests closed-class morphology and case features.'),
('representative-rule-suite-v1',6,5,'adjective_phrase.structure.head.required','adjective_phrase','phrase_head','compiled_operator_expected','Existing AP phrase rule.'),
('representative-rule-suite-v1',7,5,'adjective.agreement.controller.feature_copy','agreement','feature_unification','compiled_but_execution_adapter_required','Existing compiled feature_unification rule is outside Rule Execution Plane V1 closed pattern types.'),
('representative-rule-suite-v1',8,6,'preposition.category.complementless_still_preposition','pos','candidate_constraint','compiled_operator_expected','Existing generic candidate_constraint execution.'),
('representative-rule-suite-v1',9,6,'preposition.valency.transitive','valency','required_complement','new_generic_capability_required','Object/complement valency is intentionally not in current Dependency Build V2.'),
('representative-rule-suite-v1',10,7,'verb.phrase.head.finite','verb_phrase','phrase_head','compiled_operator_expected','Existing VP phrase operator.'),
('representative-rule-suite-v1',11,7,'verb.modal_auxiliary.bare_infinitive','construction','modal_bare_infinitive','source_consumed_but_not_compiled','Construction Recognition uses source-derived lexical/config evidence, not compiled rule execution.'),
('representative-rule-suite-v1',12,7,'verb.auxiliary.complement.nonfinite_main','construction','auxiliary_nonfinite','source_consumed_but_not_compiled','Construction/Predicate layers support the structure, but Build Plane rule is absent.'),
('representative-rule-suite-v1',13,8,'sentence.predicate.definition_verb_phrase','predicate','predicate_from_vp','compiled_but_execution_adapter_required','Existing graph_pattern rule is not dispatched by Rule Execution Plane V1.'),
('representative-rule-suite-v1',14,8,'sentence.subject.definition.nominal_finite_predicate','clause_dependency','subject_predicate','compiled_mixed_support','Dependency pattern is closed; clause_pattern remains outside generic execution plane.'),
('representative-rule-suite-v1',15,9,'sentence.word_order.schema.a_b.finite_adverbial_order','word_order','relative_order','compiled_but_upstream_fields_deferred','Compiled relative_order exists, but Grammar Validation V2 explicitly defers A/B execution until reliable clause fields.'),
('representative-rule-suite-v1',16,9,'sentence.word_order.main_clause.yes_no_question.empty_prefield_finite_first','question_clause','finite_first_question','new_generic_capability_required','Question/imperative clause typing is deferred.'),
('representative-rule-suite-v1',17,10,'sentence.utterance.reference.major_punctuation_boundary','segmentation','major_punctuation_boundary','runtime_capability_exists_not_rule_driven','Sentence Segmentation supports major terminals, but not through NRG manifest/compiler execution.'),
('representative-rule-suite-v1',18,11,'sentence.subordinate.explicative.nominal.infinitive.subject.reference.unexpressed_but_interpreted_subject','nonfinite_subject','implicit_subject','source_consumed_partial_semantics','Interpretation V2 records unexpressed subject profile; controller/PRO resolution remains deferred.'),
('representative-rule-suite-v1',19,12,'syntax.coordination.general.category_preservation','coordination','category_preservation','new_generic_capability_required','Coordination layer/operator is not present.'),
('representative-rule-suite-v1',20,13,'syntax.binding.general.reference.imperative_null_subject','binding','imperative_null_subject','new_generic_capability_required','Requires imperative clause recognition plus deictic/binding semantics.' )
) as v(suite_code,ordinal,chapter,candidate_code,capability_family,architecture_probe,expected_current_state,notes)
join public.grammar_knowledge_candidates c on c.extracted_payload->>'candidate_code'=v.candidate_code
where not exists(select 1 from public.grammar_representative_rule_suite_v1 s where s.suite_code=v.suite_code and s.ordinal=v.ordinal);

create or replace function public.representative_rule_suite_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object(
 'version','representative-rule-suite-v1',
 'source_of_truth','grammar_knowledge_candidates: all 4564 source-verified candidates across chapters 1-13',
 'sample_size',20,
 'selection_policy','all 13 chapters plus diverse runtime mechanisms; includes executable, source-consumed, deferred and reference-only candidates',
 'evaluation_axes',jsonb_build_array('source_verified','manifest_exists','compiled_rule_exists','compiled_pattern_type','rule_execution_plane_support','runtime_capability_presence','missing_generic_capability','compiler_automation'),
 'success_definition','Architecture closure is not 20/20 execution. Each candidate must be either executable by registered generic operators, explicitly classified as reference/pedagogy-only, or blocked by a named reusable capability. No rule-specific runtime patch is allowed.',
 'compiler_automation_requirement','A real compiler must transform validated manifest IR into grammar_rules + provenance + triggers without hand-authored per-rule migrations.',
 'non_goals',jsonb_build_array('activate all 4564 rules','invent missing linguistic data','rule-specific SQL branches','treat source verification as runtime readiness')
);
$function$;

create or replace function public.audit_representative_rule_suite_v1(p_suite_code text default 'representative-rule-suite-v1')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_items jsonb:='[]'::jsonb; v_manifests jsonb; v_rules jsonb; v_pattern_types jsonb; v_compiled_count int:=0; v_closed_exec int:=0; v_nonclosed_compiled int:=0; v_source_only int:=0; v_missing_cap int:=0; v_reference int:=0; v_chapters int:=0; v_verified int:=0; v_total int:=0; v_compiler_procs int:=0; v_actual text;
begin
 select count(*),count(distinct chapter) into v_total,v_chapters from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code;
 select count(*) into v_compiler_procs from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (pg_get_functiondef(p.oid) ilike '%insert into public.grammar_rules%' or pg_get_functiondef(p.oid) ilike '%insert into grammar_rules%');
 for r in
  select s.*,c.status source_status,c.source_section,c.title,c.extracted_payload
  from public.grammar_representative_rule_suite_v1 s join public.grammar_knowledge_candidates c on c.id=s.candidate_id
  where s.suite_code=p_suite_code order by s.ordinal
 loop
  if r.source_status in ('verified','source_verified') then v_verified:=v_verified+1; end if;
  select coalesce(jsonb_agg(jsonb_build_object('manifest_id',m.id,'manifest_code',m.code,'family',m.runtime_family,'phase',m.execution_phase,'authoring_status',m.authoring_status) order by m.code),'[]'::jsonb) into v_manifests
  from public.grammar_runtime_manifests m
  where m.primary_candidate_id=r.candidate_id or exists(select 1 from public.grammar_runtime_manifest_sources ms where ms.manifest_id=m.id and ms.candidate_id=r.candidate_id);
  select coalesce(jsonb_agg(jsonb_build_object('rule_id',gr.id,'rule_code',gr.code,'pattern_type',gr.pattern_type,'rule_type',gr.rule_type,'compiler_version',gr.compiler_version,'compile_hash',gr.compile_hash,'is_active',gr.is_active,'manifest_id',gr.runtime_manifest_id) order by gr.code),'[]'::jsonb) into v_rules
  from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id where gs.candidate_id=r.candidate_id;
  select coalesce(jsonb_agg(distinct x),'[]'::jsonb) into v_pattern_types from jsonb_array_elements(v_rules) q(x);

  if jsonb_array_length(v_rules)>0 then
   v_compiled_count:=v_compiled_count+1;
   if exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern'))
      and not exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' not in ('candidate_constraint','phrase_pattern','dependency_pattern')) then
      v_actual:='compiled_execution_plane_closed'; v_closed_exec:=v_closed_exec+1;
   elsif exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern')) then
      v_actual:='compiled_mixed_closed_and_unclosed'; v_nonclosed_compiled:=v_nonclosed_compiled+1;
   else
      v_actual:='compiled_pattern_not_closed_in_execution_plane_v1'; v_nonclosed_compiled:=v_nonclosed_compiled+1;
   end if;
  elsif r.expected_current_state in ('source_consumed_but_not_compiled','source_consumed_partial_semantics','runtime_capability_exists_not_rule_driven','source_to_morphology_mapping_required') then
   v_actual:='source_or_runtime_capability_without_compiled_rule'; v_source_only:=v_source_only+1;
  elsif r.expected_current_state='reference_or_interpretive' then
   v_actual:='reference_or_interpretive_not_runtime_compiled'; v_reference:=v_reference+1;
  else
   v_actual:='named_generic_capability_missing'; v_missing_cap:=v_missing_cap+1;
  end if;

  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'ordinal',r.ordinal,'chapter',r.chapter,'candidate_id',r.candidate_id,'candidate_code',r.candidate_code,'title',r.title,'source_section',r.source_section,'source_status',r.source_status,
    'capability_family',r.capability_family,'architecture_probe',r.architecture_probe,'expected_current_state',r.expected_current_state,'actual_current_state',v_actual,
    'manifests',v_manifests,'compiled_rules',v_rules,
    'rule_execution_plane_v1_closed_pattern_present',exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern')),
    'unclosed_compiled_pattern_present',exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' not in ('candidate_constraint','phrase_pattern','dependency_pattern')),
    'requires_new_generic_capability',r.expected_current_state='new_generic_capability_required',
    'notes',r.notes
  ));
 end loop;
 return jsonb_build_object(
   'version','representative-rule-suite-v1','suite_code',p_suite_code,'status','audited','items',v_items,
   'summary',jsonb_build_object('sample_size',v_total,'chapters_covered',v_chapters,'source_verified_count',v_verified,'candidates_with_compiled_rules',v_compiled_count,'compiled_execution_plane_closed_count',v_closed_exec,'compiled_but_execution_plane_not_closed_count',v_nonclosed_compiled,'source_or_runtime_capability_without_compiled_rule_count',v_source_only,'reference_or_interpretive_count',v_reference,'named_generic_capability_missing_count',v_missing_cap,'compiler_write_procedure_count',v_compiler_procs,'compiler_automation_present',v_compiler_procs>0,'representative_suite_ready_for_bulk_activation',false)
 );
end;
$function$;

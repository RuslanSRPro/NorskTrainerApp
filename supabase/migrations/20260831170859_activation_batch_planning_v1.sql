create or replace function public.activation_batch_planning_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
select jsonb_build_object(
  'version','activation-batch-planning-v1',
  'source_release','runtime-structural-v1.23',
  'planning_release','runtime-structural-v1.24',
  'scope_state','needs_manifest',
  'batch_key','program_family + execution_role',
  'model_type_role','evidence_dimension',
  'activation_allowed',false,
  'priority_order',jsonb_build_array(
    'adjective_forms_and_agreement',
    'degrees_of_comparison',
    'tense_form_core',
    'phrase_and_construction_core',
    'clause_and_word_order',
    'semantic_interpretation',
    'binding_extraction_discourse',
    'wordformation_and_other'
  ),
  'required_regression_suite','forms-tenses-degrees-golden-v1'
)
$$;

create or replace function public.activation_program_family_v1(p_execution_role text, p_candidate_code text, p_model_type text)
returns text
language sql
immutable
security invoker
set search_path = public, pg_catalog
as $$
select case
  when coalesce(p_execution_role,'') in ('adjective_agreement_rule','adjective_agreement_inflector','adjective_agreement_selector','adjective_predicative_agreement')
    or coalesce(p_candidate_code,'') like 'adjective.agreement.%'
    then 'adjective_forms_and_agreement'
  when coalesce(p_execution_role,'') in ('adjective_degree_rule','adjective_degree_inflector','adjective_degree_construction','adjective_phrase_comparison_builder')
    or coalesce(p_candidate_code,'') like 'adjective.degree.%'
    or coalesce(p_candidate_code,'') like 'adjective_phrase.%comparison%'
    or coalesce(p_candidate_code,'') like 'adjective_phrase.%comparative%'
    or coalesce(p_candidate_code,'') like 'adjective_phrase.%superlative%'
    then 'degrees_of_comparison'
  when coalesce(p_execution_role,'') in ('tense_form','predicate_feature','grammar_category')
    and (coalesce(p_candidate_code,'') like 'verb.tense.%' or coalesce(p_model_type,'') ilike '%tense%' or coalesce(p_model_type,'')='grammar_category')
    then 'tense_form_core'
  when coalesce(p_execution_role,'') like '%tense%'
    or coalesce(p_execution_role,'') in ('canonical_tense_selection','alternative_tense_selection','prototype_mapping','temporal_reference_interpretation','temporal_interpretation','discourse_tense_interpretation','feature_definition','feature_interpretation','form_exclusion','usage_constraint','adverbial_function_resolution')
    or coalesce(p_candidate_code,'') like 'verb.tense.%'
    then 'semantic_interpretation'
  when coalesce(p_execution_role,'') in ('construction','construction_rule','construction_constraint','construction_licensing_rule','phrase_structure_rule','adjective_phrase_rule','prepositional_phrase_rule','pp_premodifier_parser','nested_pp_parser','phrase_modifier')
    then 'phrase_and_construction_core'
  when coalesce(p_execution_role,'') like '%word_order%'
    or coalesce(p_execution_role,'') in ('position_rule','placement_rule','placement_constraint_rule','clause_order_rule','final_field_n_slot_pair_order_rule','subjunction_constraint','introducer_licensing_rule','correlate_licensing_rule')
    then 'clause_and_word_order'
  when coalesce(p_execution_role,'') like '%binding%'
    or coalesce(p_execution_role,'') in ('island_constraint','extraction_constraint','dependency_rule','semantic_role_assignment','discourse_perspective')
    then 'binding_extraction_discourse'
  when coalesce(p_execution_role,'') in ('semantic_interpretation','aspect_interpretation','modal_reading_selection','modal_reading_constraint','scope_interpretation','negation_scope_resolution','negation_scope_interpretation','negation_scope_selection','question_interpretation','question_modal_interpretation','conditional_modal_interpretation','counterfactual_interpretation','counterfactual_modal_interpretation','past_modal_interpretation','modal_tense_interpretation','deontic_reading_interpretation','concept_interpretation','interpretation_rule')
    then 'semantic_interpretation'
  when coalesce(p_execution_role,'') like '%formation%'
    or coalesce(p_execution_role,'') like '%deriv%'
    or coalesce(p_execution_role,'') like '%compound%'
    or coalesce(p_execution_role,'') in ('conversion_pattern','suffix_formation_rule')
    then 'wordformation_and_other'
  else 'wordformation_and_other'
end
$$;

create or replace function public.activation_batch_priority_v1(p_program_family text)
returns integer
language sql
immutable
security invoker
set search_path = public, pg_catalog
as $$
select case p_program_family
 when 'adjective_forms_and_agreement' then 10
 when 'degrees_of_comparison' then 20
 when 'tense_form_core' then 30
 when 'phrase_and_construction_core' then 40
 when 'clause_and_word_order' then 50
 when 'semantic_interpretation' then 60
 when 'binding_extraction_discourse' then 70
 else 80 end
$$;

create or replace function public.activation_batch_plan_v1(p_release_code text default 'runtime-structural-v1.24')
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
with scoped as (
  select c.id as candidate_id,
         e.candidate_code,
         c.title,
         c.source_section,
         coalesce(e.execution_contract#>>'{execution,role}','<none>') as execution_role,
         coalesce(m.model_type,'<none>') as model_type,
         coalesce(m.model_subtype,'<none>') as model_subtype
  from public.grammar_knowledge_candidates c
  join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
  left join public.grammar_knowledge_candidate_model_v m on m.candidate_id=c.id
  where c.status in ('verified','source_verified')
    and e.runtime_eligible
    and not exists(select 1 from public.grammar_rule_sources gs where gs.candidate_id=c.id)
    and not exists(
      select 1 from public.grammar_runtime_manifests rm
      where rm.authoring_status='validated' and (
        rm.primary_candidate_id=c.id or exists(select 1 from public.grammar_runtime_manifest_sources ms where ms.manifest_id=rm.id and ms.candidate_id=c.id)
      )
    )
), tagged as (
  select s.*,
         public.activation_program_family_v1(s.execution_role,s.candidate_code,s.model_type) as program_family
  from scoped s
), grouped as (
  select program_family, execution_role,
         public.activation_batch_priority_v1(program_family) as priority,
         count(*)::int as candidate_count,
         count(distinct model_type)::int as model_type_count,
         count(distinct model_subtype)::int as model_subtype_count,
         (array_agg(candidate_code order by candidate_code))[1:8] as sample_candidate_codes
  from tagged
  group by program_family, execution_role
), fam as (
  select program_family,
         public.activation_batch_priority_v1(program_family) as priority,
         count(*)::int as candidate_count,
         count(distinct execution_role)::int as operator_batch_count
  from tagged group by program_family
)
select jsonb_build_object(
 'version','activation-batch-planning-v1',
 'release_code',p_release_code,
 'activation_allowed',false,
 'summary',jsonb_build_object(
   'candidate_count',(select count(*) from tagged),
   'program_family_count',(select count(*) from fam),
   'operator_batch_count',(select count(*) from grouped),
   'distinct_execution_roles',(select count(distinct execution_role) from tagged),
   'singleton_operator_batches',(select count(*) from grouped where candidate_count=1),
   'largest_operator_batch',(select coalesce(max(candidate_count),0) from grouped)
 ),
 'program_families',coalesce((select jsonb_agg(jsonb_build_object(
    'program_family',program_family,'priority',priority,'candidate_count',candidate_count,'operator_batch_count',operator_batch_count,
    'activation_policy','materialize only in child pilot after dedicated operator contract + golden + comparator'
  ) order by priority,program_family) from fam),'[]'::jsonb),
 'operator_batches',coalesce((select jsonb_agg(jsonb_build_object(
    'batch_id','abp1:'||program_family||':'||execution_role,
    'program_family',program_family,'execution_role',execution_role,'priority',priority,
    'candidate_count',candidate_count,'model_type_count',model_type_count,'model_subtype_count',model_subtype_count,
    'sample_candidate_codes',to_jsonb(sample_candidate_codes),
    'materialization_status','planned',
    'activation_status','not_allowed_v1'
  ) order by priority,candidate_count desc,execution_role) from grouped),'[]'::jsonb)
)
$$;

create or replace function public.activation_batch_plan_family_v1(p_program_family text)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
select jsonb_build_object(
 'version','activation-batch-planning-v1',
 'program_family',p_program_family,
 'batches',coalesce(jsonb_agg(x.batch order by (x.batch->>'priority')::int,(x.batch->>'candidate_count')::int desc,x.batch->>'execution_role'),'[]'::jsonb)
)
from (
  select value as batch
  from jsonb_array_elements(public.activation_batch_plan_v1('runtime-structural-v1.24')->'operator_batches')
  where value->>'program_family'=p_program_family
) x
$$;

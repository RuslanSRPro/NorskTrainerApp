create table if not exists public.grammar_scoped_operator_templates_v1 (
  template_code text primary key,
  execution_role text not null,
  candidate_codes text[] not null default '{}',
  model_type text,
  semantic_category text,
  pattern_type text,
  rule_type text,
  builder_contract text,
  capability_status text not null check (capability_status in ('ready','blocked')),
  required_capabilities jsonb not null default '[]'::jsonb,
  approval_status text not null check (approval_status in ('approved','blocked','deprecated')),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.grammar_scoped_operator_templates_v1 enable row level security;
revoke all on public.grammar_scoped_operator_templates_v1 from anon, authenticated;

insert into public.grammar_scoped_operator_templates_v1(template_code,execution_role,candidate_codes,model_type,semantic_category,pattern_type,rule_type,builder_contract,capability_status,required_capabilities,approval_status,notes)
values
('word_order.subordinate_schema_b_core.v1','word_order_rule',array[
 'sentence.subordinate.explicative.adverbial.da.causal_schema_b',
 'sentence.subordinate.explicative.adverbial.for_at.schema_b',
 'sentence.subordinate.explicative.adverbial.fordi.predicative_to_vere_schema_b',
 'sentence.subordinate.explicative.adverbial.naar.causal_schema_b',
 'sentence.subordinate.explicative.adverbial.sidan_ettersom.causal_schema_b',
 'sentence.subordinate.explicative.adverbial.slik_at.schema_b'
], 'grammar_knowledge','word_order','clause_pattern','clause','clause-pattern-manifest-builder-v1','ready',
 jsonb_build_array('subordinate_clause_recognition','connector_field','schema_b_assignment'),'approved',
 'Exact scoped family: source states these recognized subordinate constructions require Schema B. Uses existing subordinate schema path; scope is candidate-code closed, not role-wide.'),
('tense_form.perfect_core.v1','tense_form',array['verb.tense.forms.present_perfect','verb.tense.forms.preterite_perfect'],
 'grammar_category',null,null,null,null,'blocked',jsonb_build_array('generic_tense_construction_operator','auxiliary_participle_construction_binding'),'blocked',
 'Current Interpretation recognizes these forms, but Source Rule materialization still needs a generic construction-level tense operator; do not map them to token morphology.'),
('construction.aux_nonfinite_core.v1','construction',array['verb.auxiliary.complement.nonfinite_main','verb.compound_form.finite_aux_nonfinite_main','verb.compound_form.finite_nonfinite.structure','verb.infinitive.bare_after_auxiliary'],
 'construction_compatibility',null,null,null,null,'blocked',jsonb_build_array('generic_construction_schema_operator'),'blocked',
 'Existing Construction Recognition supports parts of this family, but Build Plane lacks an approved generic construction-schema manifest/operator contract.'),
('noun_np.direct_apposition_form.v1','noun_form_constraint',array['sentence.subordinate.explicative.nominal.function_position.apposition.noun_definite_or_determiner_requirement'],
 'grammar_knowledge','noun_phrase_form',null,null,null,'blocked',jsonb_build_array('np_form_constraint_operator','resolved_np_definiteness'),'blocked',
 'Requires an NP-form constraint operator over resolved definiteness/determiner evidence; must not be approximated by token morphology alone.'),
('preposition.direct_apposition_requirement.v1','preposition_requirement',array['sentence.subordinate.explicative.nominal.function_position.apposition.indefinite_noun_requires_preposition'],
 'grammar_knowledge','noun_phrase_form',null,null,null,'blocked',jsonb_build_array('valency_required_complement_operator','resolved_np_definiteness','at_clause_attachment'),'blocked',
 'Requires construction-scoped preposition requirement/valency evidence, not nearest-token heuristics.'),
('dependency.long_distance_knot.v1','dependency_rule',array['sentence.subordinate.knot.general.matrix_prefield_embedded_gap','sentence.subordinate.knot.general.relative_connector_embedded_gap'],
 'grammar_knowledge',null,null,null,null,'blocked',jsonb_build_array('long_distance_dependency_operator','gap_representation','extraction_path'),'blocked',
 'Explicitly blocked until long-distance dependency/gap path exists; local dependency_pattern is not sufficient.'),
('punctuation.direct_speech_by_order.v1','direct_speech_punctuation_rule',array['sentence.subordinate.reported_speech.direct.punctuation_by_order'],
 'grammar_knowledge','reported_speech_punctuation',null,null,null,'blocked',jsonb_build_array('direct_speech_segmentation','quote_boundary_model','punctuation_operator'),'blocked',
 'Requires quote/report segmentation plus punctuation operator. Must not be treated as sentence-terminal segmentation only.')
on conflict (template_code) do update set
 execution_role=excluded.execution_role,candidate_codes=excluded.candidate_codes,model_type=excluded.model_type,
 semantic_category=excluded.semantic_category,pattern_type=excluded.pattern_type,rule_type=excluded.rule_type,
 builder_contract=excluded.builder_contract,capability_status=excluded.capability_status,
 required_capabilities=excluded.required_capabilities,approval_status=excluded.approval_status,notes=excluded.notes;

create or replace function public.scoped_operator_templates_for_candidate_v1(p_candidate_id uuid)
returns jsonb
language sql stable security invoker
set search_path='public','pg_catalog'
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'template_code',t.template_code,'execution_role',t.execution_role,'pattern_type',t.pattern_type,'rule_type',t.rule_type,
 'builder_contract',t.builder_contract,'capability_status',t.capability_status,'required_capabilities',t.required_capabilities,
 'approval_status',t.approval_status,'notes',t.notes
) order by t.template_code),'[]'::jsonb)
from public.grammar_knowledge_candidates c
join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
join public.grammar_scoped_operator_templates_v1 t
  on t.execution_role=e.execution_contract#>>'{execution,role}'
 and (cardinality(t.candidate_codes)=0 or e.candidate_code=any(t.candidate_codes))
 and (t.model_type is null or c.digital_model#>>'{model,type}'=t.model_type)
 and (t.semantic_category is null or c.digital_model#>>'{model,semantic_category}'=t.semantic_category)
where c.id=p_candidate_id;
$$;

create or replace function public.cross_family_capability_matrix_v1(p_release_code text default 'runtime-structural-v1.31')
returns jsonb
language sql stable security invoker
set search_path='public','pg_catalog'
as $$
with c as (
 select e.candidate_id,e.candidate_code,e.runtime_eligible,e.execution_contract#>>'{execution,role}' execution_role,
        public.assess_candidate_activation_readiness_v2(e.candidate_id,p_release_code) readiness,
        public.scoped_operator_templates_for_candidate_v1(e.candidate_id) scoped
 from public.grammar_knowledge_candidate_execution_v e
), x as (
 select *,
   (select count(*) from jsonb_array_elements(scoped) j where j->>'approval_status'='approved' and j->>'capability_status'='ready') scoped_ready,
   (select count(*) from jsonb_array_elements(scoped) j where j->>'capability_status'='blocked') scoped_blocked
 from c
)
select jsonb_build_object(
 'version','cross-family-capability-matrix-v1','release_code',p_release_code,
 'summary',jsonb_build_object(
  'total_candidates',count(*),
  'runtime_candidates',count(*) filter(where runtime_eligible),
  'activation_ready',count(*) filter(where readiness->>'readiness_state'='activation_ready'),
  'needs_manifest',count(*) filter(where readiness->>'readiness_state'='needs_manifest'),
  'needs_manifest_scoped_ready',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and scoped_ready=1),
  'needs_manifest_scoped_blocked',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and scoped_blocked>0),
  'needs_manifest_without_scoped_decision',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and scoped_ready=0 and scoped_blocked=0)
 ),
 'ready_candidates',(select coalesce(jsonb_agg(jsonb_build_object('candidate_code',candidate_code,'execution_role',execution_role,'template',scoped) order by candidate_code),'[]'::jsonb) from x where readiness->>'readiness_state'='needs_manifest' and scoped_ready=1),
 'blocked_candidates',(select coalesce(jsonb_agg(jsonb_build_object('candidate_code',candidate_code,'execution_role',execution_role,'template',scoped) order by candidate_code),'[]'::jsonb) from x where readiness->>'readiness_state'='needs_manifest' and scoped_blocked>0)
) from x;
$$;

create or replace function public.plan_scoped_manifest_batch_dry_run_v1(p_template_code text,p_release_code text default 'runtime-structural-v1.31')
returns jsonb
language plpgsql stable security invoker
set search_path='public','pg_catalog'
as $$
declare t record; items jsonb; n int;
begin
 select * into t from public.grammar_scoped_operator_templates_v1 where template_code=p_template_code;
 if not found then return jsonb_build_object('version','scoped-manifest-batch-dry-run-v1','status','template_not_found','write_performed',false); end if;
 select coalesce(jsonb_agg(jsonb_build_object('candidate_id',e.candidate_id,'candidate_code',e.candidate_code,'readiness',public.assess_candidate_activation_readiness_v2(e.candidate_id,p_release_code)) order by e.candidate_code),'[]'::jsonb),count(*)
 into items,n
 from public.grammar_knowledge_candidates c join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
 where e.execution_contract#>>'{execution,role}'=t.execution_role
 and (cardinality(t.candidate_codes)=0 or e.candidate_code=any(t.candidate_codes))
 and (t.model_type is null or c.digital_model#>>'{model,type}'=t.model_type)
 and (t.semantic_category is null or c.digital_model#>>'{model,semantic_category}'=t.semantic_category)
 and public.assess_candidate_activation_readiness_v2(e.candidate_id,p_release_code)->>'readiness_state'='needs_manifest';
 return jsonb_build_object('version','scoped-manifest-batch-dry-run-v1','write_performed',false,'release_code',p_release_code,
  'template_code',t.template_code,'template_status',case when t.approval_status='approved' and t.capability_status='ready' then 'approved_ready' else 'blocked' end,
  'pattern_type',t.pattern_type,'rule_type',t.rule_type,'builder_contract',t.builder_contract,'required_capabilities',t.required_capabilities,
  'candidate_count',n,'candidates',items);
end;
$$;

revoke all on function public.scoped_operator_templates_for_candidate_v1(uuid) from anon,authenticated;
revoke all on function public.cross_family_capability_matrix_v1(text) from anon,authenticated;
revoke all on function public.plan_scoped_manifest_batch_dry_run_v1(text,text) from anon,authenticated;

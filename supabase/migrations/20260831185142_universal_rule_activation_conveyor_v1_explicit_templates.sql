create table if not exists public.grammar_operator_templates_v1(
  template_code text primary key,
  execution_role text not null,
  pattern_type text not null,
  rule_type text not null,
  builder_contract text not null,
  required_source_paths jsonb not null default '[]'::jsonb,
  approval_status text not null check(approval_status in ('observed','approved','deprecated')),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.grammar_operator_templates_v1 enable row level security;

insert into public.grammar_operator_templates_v1(template_code,execution_role,pattern_type,rule_type,builder_contract,approval_status,notes) values
('morph.adjective_agreement_inflector.v1','adjective_agreement_inflector','morphological_inflection','morphology','morphological-inflection-manifest-builder-v1','approved','Already proven through release-aware canonical morphology dispatcher.'),
('morph.adjective_degree_inflector.v1','adjective_degree_inflector','morphological_inflection','morphology','morphological-inflection-manifest-builder-v1','approved','Already proven through degree batch and canonical morphology dispatcher.'),
('morph.orthographic_adjustment.v1','orthographic_inflection_adjustment','morphological_inflection','morphology','morphological-adjustment-manifest-builder-v1','approved','Post-transform adjustments require explicit composition domain/group at release membership.'),
('lex.preposition_category_classifier.v1','preposition_category_classifier','candidate_constraint','disambiguation','candidate-constraint-manifest-builder-v1','approved','Generic candidate-constraint execution is closed.'),
('syntax.connector_field_resolver.v1','connector_field_resolver','graph_pattern','clause','graph-pattern-manifest-builder-v1','approved','Graph-field assignment path is closed.'),
('syntax.schema_a_resolver.v1','schema_a_resolver','clause_pattern','clause','clause-pattern-manifest-builder-v1','approved','Clause schema A path is closed.'),
('syntax.subordinate_schema_selector.v1','subordinate_schema_selector','clause_pattern','clause','clause-pattern-manifest-builder-v1','approved','Subordinate Schema B foundation is closed.'),
('syntax.schema_selector.v1','schema_selector','relative_order','word_order','relative-order-manifest-builder-v1','approved','A/B relative order path is closed, subject to required upstream fields.'),
('syntax.sentence_adverbial_midfield.v1','sentence_adverbial_midfield_licensing','graph_pattern','interpretation','graph-pattern-manifest-builder-v1','approved','Existing canonical field assignment path.'),
('syntax.subject_requirement.v1','subject_requirement','dependency_pattern','dependency','dependency-pattern-manifest-builder-v1','approved','Generic dependency adapter is closed.'),
('syntax.predicate_structure.v1','predicate_structure','graph_pattern','construction','graph-pattern-manifest-builder-v1','approved','Predicate graph operation path is closed.'),
('phrase.adjective_phrase_rule.v1','adjective_phrase_rule','phrase_pattern','construction','phrase-pattern-manifest-builder-v1','approved','Phrase operator contract is closed.')
on conflict(template_code) do update set execution_role=excluded.execution_role,pattern_type=excluded.pattern_type,rule_type=excluded.rule_type,builder_contract=excluded.builder_contract,approval_status=excluded.approval_status,notes=excluded.notes;

create or replace function public.plan_manifest_batch_dry_run_v2(p_execution_role text,p_release_code text default 'runtime-structural-v1.30',p_limit int default 500)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare tmpl jsonb; candidates jsonb; tc int;
begin
 select coalesce(jsonb_agg(jsonb_build_object('template_code',template_code,'pattern_type',pattern_type,'rule_type',rule_type,'builder_contract',builder_contract,'required_source_paths',required_source_paths) order by template_code),'[]'::jsonb),count(*)
 into tmpl,tc from public.grammar_operator_templates_v1 where execution_role=p_execution_role and approval_status='approved';
 select coalesce(jsonb_agg(jsonb_build_object('candidate_id',candidate_id,'candidate_code',candidate_code,'source_status',status,'source_section',source_section) order by candidate_code),'[]'::jsonb)
 into candidates from (
   select c.id candidate_id,e.candidate_code,c.status,c.source_section
   from public.grammar_knowledge_candidates c join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
   where e.runtime_eligible and e.execution_contract#>>'{execution,role}'=p_execution_role
     and (public.assess_candidate_activation_readiness_v2(c.id,p_release_code)->>'readiness_state')='needs_manifest'
   order by e.candidate_code limit greatest(1,least(coalesce(p_limit,500),2000))
 ) q;
 return jsonb_build_object('version','batch-manifest-factory-dry-run-v2','write_performed',false,'execution_role',p_execution_role,
   'template_status',case when tc=1 then 'approved_unique_template' when tc>1 then 'blocked_multiple_approved_templates' else 'blocked_no_approved_template' end,
   'approved_templates',tmpl,'candidate_count',jsonb_array_length(candidates),'candidates',candidates,
   'safety','observed historical mappings are diagnostic only; only explicit approved templates may enter automatic manifest authoring');
end;$$;

create or replace function public.universal_operator_capability_matrix_v2(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $$
with c as (
 select e.candidate_id,e.runtime_eligible,e.execution_contract#>>'{execution,role}' execution_role,
        public.assess_candidate_activation_readiness_v2(e.candidate_id,p_release_code) readiness,
        (select count(*) from public.grammar_operator_templates_v1 t where t.execution_role=e.execution_contract#>>'{execution,role}' and t.approval_status='approved') approved_templates
 from public.grammar_knowledge_candidate_execution_v e
)
select jsonb_build_object('version','universal-operator-capability-matrix-v2','release_code',p_release_code,
 'summary',jsonb_build_object(
   'total_candidates',count(*),
   'runtime_candidates',count(*) filter(where runtime_eligible),
   'activation_ready',count(*) filter(where readiness->>'readiness_state'='activation_ready'),
   'needs_manifest',count(*) filter(where readiness->>'readiness_state'='needs_manifest'),
   'needs_manifest_with_approved_template',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and approved_templates=1),
   'needs_manifest_without_approved_template',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and approved_templates=0),
   'needs_manifest_with_template_ambiguity',count(*) filter(where readiness->>'readiness_state'='needs_manifest' and approved_templates>1)
 ),
 'role_counts',(select coalesce(jsonb_agg(jsonb_build_object('execution_role',execution_role,'needs_manifest',n,'approved_template_count',approved_templates) order by n desc,execution_role),'[]'::jsonb)
   from (select execution_role,max(approved_templates) approved_templates,count(*) n from c where readiness->>'readiness_state'='needs_manifest' group by execution_role) x)
) from c;$$;

create or replace function public.universal_activation_gate_v1(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare rel record; src_hash text; base_hash text; missing_sources int; invalid_patterns int; active_nrg int; inh jsonb; matrix jsonb; parent_code text;
begin
 select * into rel from public.grammar_runtime_releases where code=p_release_code;
 parent_code:=rel.metadata->>'parent_release';
 select semantic_hash into base_hash from public.grammar_source_graph_snapshots_v1 where snapshot_code='source-graph-4564-v1';
 src_hash:=public.grammar_source_graph_semantic_hash_v1();
 select count(*) into missing_sources from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id
 where r.code=p_release_code and rr.is_enabled and not exists(select 1 from public.grammar_rule_sources gs where gs.grammar_rule_id=gr.id and gs.verification_status='source_verified');
 select count(*) into invalid_patterns from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id
 where r.code=p_release_code and rr.is_enabled and not public.validate_grammar_rule_pattern_v2(gr.pattern_type,gr.pattern);
 select count(*) into active_nrg from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 inh:=case when parent_code is null then jsonb_build_object('status','root_or_parent_unknown') else public.validate_runtime_child_release_inheritance_v1(p_release_code,parent_code) end;
 matrix:=public.universal_operator_capability_matrix_v2(p_release_code);
 return jsonb_build_object('version','universal-activation-gate-v1','release_code',p_release_code,
  'checks',jsonb_build_object('source_graph_immutable',src_hash=base_hash,'source_graph_hash',src_hash,'baseline_source_graph_hash',base_hash,
    'missing_source_provenance_rules',missing_sources,'invalid_rule_patterns',invalid_patterns,'global_active_nrg_rules',active_nrg,'inheritance',inh,'operator_matrix',matrix),
  'gate_pass',src_hash=base_hash and missing_sources=0 and invalid_patterns=0 and active_nrg=0,
  'bulk_activation_ready',false,
  'note','Release integrity gate only. Automatic batch authoring requires one explicitly approved operator template per execution role plus batch-specific semantic/corpus/false-positive evidence.');
end;$$;

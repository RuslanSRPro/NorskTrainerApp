create table if not exists public.grammar_applicability_requirement_registry_v1 (
  requirement_code text primary key,
  source_selector jsonb not null,
  required_runtime_capability text not null,
  canonical_fact_path text,
  status text not null check (status in ('ready','blocked','deferred')),
  notes text not null,
  created_at timestamptz not null default now()
);
alter table public.grammar_applicability_requirement_registry_v1 enable row level security;
drop policy if exists grammar_applicability_requirement_registry_read on public.grammar_applicability_requirement_registry_v1;
create policy grammar_applicability_requirement_registry_read on public.grammar_applicability_requirement_registry_v1 for select to anon,authenticated using (true);
revoke insert,update,delete on public.grammar_applicability_requirement_registry_v1 from anon,authenticated;
grant select on public.grammar_applicability_requirement_registry_v1 to anon,authenticated;

insert into public.grammar_applicability_requirement_registry_v1(requirement_code,source_selector,required_runtime_capability,canonical_fact_path,status,notes) values
('semantic_use.causal',jsonb_build_object('details_path','semantic_use','equals','causal'),'causal_clause_semantics','analysis.language_graph.clause_semantics.causal','blocked','Requires resolved causal-vs-temporal/other semantic use; surface connector alone is insufficient.'),
('clause_type.causal',jsonb_build_object('details_path','clause_type','equals','causal'),'causal_clause_semantics','analysis.language_graph.clause_semantics.causal','blocked','Requires resolved causal clause semantics.'),
('condition.sidan_ettersom_causal_use',jsonb_build_object('details_path','condition','equals','sidan_ettersom_causal_use'),'causal_clause_semantics','analysis.language_graph.clause_semantics.causal','blocked','Connector forms are semantically polyfunctional; causal use must be resolved.'),
('function.predicative',jsonb_build_object('details_path','function','equals','predicative'),'clause_function_resolution','analysis.language_graph.clause_function','blocked','Requires resolved subordinate-clause syntactic function.'),
('matrix_copula.vere',jsonb_build_object('details_path','matrix_copula','equals','vere'),'matrix_predicate_attachment','analysis.language_graph.clause_attachment.matrix_predicate','blocked','Requires attachment to a matrix copular predicate, not connector recognition alone.'),
('compound_subjunction.for_at',jsonb_build_object('candidate_code','sentence.subordinate.explicative.adverbial.for_at.schema_b'),'compound_subjunction_disambiguation','analysis.language_graph.construction_resolution.compound_subjunction','blocked','Must distinguish compound subjunction for at from preposition for + at-clause.'),
('compound_subjunction.slik_at',jsonb_build_object('candidate_code','sentence.subordinate.explicative.adverbial.slik_at.schema_b'),'compound_subjunction_disambiguation','analysis.language_graph.construction_resolution.compound_subjunction','blocked','Must distinguish lexicalized slik at from free slik + at-clause.')
on conflict (requirement_code) do update set source_selector=excluded.source_selector,required_runtime_capability=excluded.required_runtime_capability,canonical_fact_path=excluded.canonical_fact_path,status=excluded.status,notes=excluded.notes;

create or replace function public.candidate_applicability_requirements_v1(p_candidate_id uuid)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
with c as (
 select c.id,e.candidate_code,coalesce(c.extracted_payload->'details','{}'::jsonb) details
 from public.grammar_knowledge_candidates c join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
 where c.id=p_candidate_id
), r as (
 select ar.requirement_code,ar.required_runtime_capability,ar.canonical_fact_path,ar.status,ar.notes
 from c cross join public.grammar_applicability_requirement_registry_v1 ar
 where
   (ar.source_selector ? 'candidate_code' and ar.source_selector->>'candidate_code'=c.candidate_code)
   or
   (ar.source_selector ? 'details_path'
    and c.details->>(ar.source_selector->>'details_path')=ar.source_selector->>'equals')
)
select jsonb_build_object(
 'version','candidate-applicability-requirements-v1',
 'candidate_id',p_candidate_id,
 'requirements',coalesce((select jsonb_agg(jsonb_build_object('requirement_code',requirement_code,'required_runtime_capability',required_runtime_capability,'canonical_fact_path',canonical_fact_path,'status',status,'notes',notes) order by requirement_code) from r),'[]'::jsonb),
 'requirement_count',(select count(*) from r),
 'blocked_requirement_count',(select count(*) from r where status='blocked'),
 'all_requirements_runtime_ready',not exists(select 1 from r where status<>'ready')
);
$$;

create or replace function public.assess_scoped_materialization_applicability_v1(p_candidate_id uuid,p_template_code text,p_release_code text default 'runtime-structural-v1.33')
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare req jsonb; tmpl record; ready jsonb; v_code text; v_in_scope boolean; v_source_verified boolean; v_result text;
begin
 select * into tmpl from public.grammar_scoped_operator_templates_v1 where template_code=p_template_code;
 if tmpl.template_code is null then return jsonb_build_object('status','template_not_found','template_code',p_template_code); end if;
 select e.candidate_code,(c.status in ('verified','source_verified')) into v_code,v_source_verified from public.grammar_knowledge_candidates c join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id where c.id=p_candidate_id;
 v_in_scope:=v_code=any(coalesce(tmpl.candidate_codes,array[]::text[]));
 req:=public.candidate_applicability_requirements_v1(p_candidate_id);
 ready:=public.assess_candidate_activation_readiness_v2(p_candidate_id,p_release_code);
 v_result:=case
   when not coalesce(v_source_verified,false) then 'blocked_source_not_verified'
   when not v_in_scope then 'blocked_outside_template_scope'
   when tmpl.approval_status<>'approved' then 'blocked_template_not_approved'
   when tmpl.capability_status<>'ready' then 'blocked_operator_capability'
   when coalesce((req->>'blocked_requirement_count')::int,0)>0 then 'blocked_applicability_capability'
   when not coalesce((req->>'all_requirements_runtime_ready')::boolean,false) then 'blocked_applicability_unresolved'
   else 'materialization_ready'
 end;
 return jsonb_build_object(
   'version','scoped-materialization-applicability-v1','candidate_id',p_candidate_id,'candidate_code',v_code,'template_code',p_template_code,'release_code',p_release_code,
   'source_verified',v_source_verified,'in_template_scope',v_in_scope,'operator_template_status',tmpl.capability_status,'requirements',req,
   'readiness_before_materialization',ready,'materialization_state',v_result,'materialization_allowed',v_result='materialization_ready'
 );
end;
$$;

create or replace function public.plan_scoped_manifest_batch_dry_run_v2(p_template_code text,p_release_code text default 'runtime-structural-v1.33')
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare tmpl record; arr jsonb:='[]'::jsonb; cc text; cid uuid; a jsonb; allowed int:=0; blocked int:=0;
begin
 select * into tmpl from public.grammar_scoped_operator_templates_v1 where template_code=p_template_code;
 if tmpl.template_code is null then return jsonb_build_object('status','template_not_found','template_code',p_template_code,'write_performed',false); end if;
 foreach cc in array coalesce(tmpl.candidate_codes,array[]::text[]) loop
   select e.candidate_id into cid from public.grammar_knowledge_candidate_execution_v e where e.candidate_code=cc;
   a:=public.assess_scoped_materialization_applicability_v1(cid,p_template_code,p_release_code);
   if coalesce((a->>'materialization_allowed')::boolean,false) then allowed:=allowed+1; else blocked:=blocked+1; end if;
   arr:=arr||jsonb_build_array(a);
 end loop;
 return jsonb_build_object(
  'version','scoped-manifest-batch-dry-run-v2','template_code',p_template_code,'release_code',p_release_code,'write_performed',false,
  'candidate_count',jsonb_array_length(arr),'materialization_allowed_count',allowed,'materialization_blocked_count',blocked,
  'batch_state',case when blocked=0 and allowed>0 then 'materialization_ready' when allowed>0 then 'partially_blocked' else 'blocked_applicability' end,
  'candidates',arr,
  'safety','Every source applicability requirement must map to a runtime-ready canonical fact before manifests may be created.'
 );
end;
$$;

update public.grammar_scoped_operator_templates_v1
set capability_status='blocked',
    notes='Operator/result path is ready, but source applicability is not yet runtime-resolvable for all six candidates. Materialization requires Applicability Guard V1 to pass per candidate.'
where template_code='word_order.subordinate_schema_b_core.v1';

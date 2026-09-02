create table if not exists public.grammar_runtime_lexical_overlays_v1 (
  release_id uuid not null references public.grammar_runtime_releases(id) on delete cascade,
  overlay_type text not null,
  normalized_surface text not null,
  lexical_class_code text not null,
  pos text,
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (release_id,overlay_type,normalized_surface,lexical_class_code)
);
alter table public.grammar_runtime_lexical_overlays_v1 enable row level security;
drop policy if exists grammar_runtime_lexical_overlays_read on public.grammar_runtime_lexical_overlays_v1;
create policy grammar_runtime_lexical_overlays_read on public.grammar_runtime_lexical_overlays_v1 for select to anon,authenticated using (true);
revoke insert,update,delete on public.grammar_runtime_lexical_overlays_v1 from anon,authenticated;
grant select on public.grammar_runtime_lexical_overlays_v1 to anon,authenticated;

create table if not exists public.grammar_runtime_hot_path_forbidden_refs_v1 (
  ref_kind text not null check (ref_kind in ('function','relation')),
  ref_name text not null,
  category text not null,
  reason text not null,
  primary key (ref_kind,ref_name)
);
alter table public.grammar_runtime_hot_path_forbidden_refs_v1 enable row level security;
drop policy if exists grammar_runtime_hot_path_forbidden_refs_read on public.grammar_runtime_hot_path_forbidden_refs_v1;
create policy grammar_runtime_hot_path_forbidden_refs_read on public.grammar_runtime_hot_path_forbidden_refs_v1 for select to anon,authenticated using (true);
revoke insert,update,delete on public.grammar_runtime_hot_path_forbidden_refs_v1 from anon,authenticated;
grant select on public.grammar_runtime_hot_path_forbidden_refs_v1 to anon,authenticated;

insert into public.grammar_runtime_hot_path_forbidden_refs_v1(ref_kind,ref_name,category,reason) values
('relation','grammar_knowledge_candidates','source_graph','Immutable source graph is build/control-plane input, never runtime text input.'),
('relation','grammar_knowledge_candidate_execution_v','source_graph','Candidate execution classification is build/control-plane metadata.'),
('relation','grammar_runtime_manifests','compiler','Validated manifests are compiler inputs, not runtime text inputs.'),
('relation','grammar_runtime_compiler_plans_v1','compiler','Compiler plans are build-plane only.'),
('relation','grammar_operator_templates_v1','activation_planning','Operator template approval is build-plane only.'),
('relation','grammar_scoped_operator_templates_v1','activation_planning','Scoped template selection is build-plane only.'),
('relation','grammar_source_graph_snapshots_v1','source_audit','Source snapshots are release/audit plane only.'),
('relation','grammar_representative_rule_suite_v1','architecture_audit','Representative suite is test/audit plane only.'),
('function','apply_rule_execution_pilot_v1','architecture_audit','Pilot introspection must not run for every user text.'),
('function','build_rule_execution_pilot_v1','architecture_audit','Pilot introspection reads pg_proc and architecture state.'),
('function','apply_representative_rule_suite_v1','architecture_audit','Representative-suite audit is offline only.'),
('function','audit_representative_rule_suite_v1','architecture_audit','Representative-suite audit is offline only.'),
('function','apply_compiler_execution_closure_v2','compiler_audit','Compiler closure audit is build-plane only.'),
('function','compiler_execution_closure_summary_v2','compiler_audit','Compiler closure summary is build-plane only.'),
('function','universal_activation_gate_v1','activation_planning','Activation gate is release control-plane only.'),
('function','universal_operator_capability_matrix_v1','activation_planning','Capability matrix is release planning only.'),
('function','universal_operator_capability_matrix_v2','activation_planning','Capability matrix is release planning only.'),
('function','plan_manifest_batch_dry_run_v1','activation_planning','Manifest planning is build-plane only.'),
('function','plan_manifest_batch_dry_run_v2','activation_planning','Manifest planning is build-plane only.'),
('function','plan_scoped_manifest_batch_dry_run_v1','activation_planning','Scoped manifest planning is build-plane only.'),
('function','cross_family_activation_matrix_v1','activation_planning','Cross-family planning matrix is build-plane only.'),
('function','assess_candidate_activation_readiness_v1','activation_planning','Candidate readiness is build-plane only.'),
('function','assess_candidate_activation_readiness_v2','activation_planning','Candidate readiness is build-plane only.'),
('function','compile_grammar_runtime_manifest_v1','compiler','Compiler is build-plane only.'),
('function','materialize_grammar_runtime_manifest_v1','materializer','Materializer is build-plane only.'),
('function','materialize_grammar_runtime_manifest_v2','materializer','Materializer is build-plane only.'),
('function','create_runtime_child_release_v1','release_control','Release creation is control-plane only.')
on conflict (ref_kind,ref_name) do update set category=excluded.category,reason=excluded.reason;

create or replace function public.runtime_hot_path_contract_v1()
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select jsonb_build_object(
 'version','runtime-hot-path-isolation-contract-v1',
 'principle','Text runtime consumes compiled/materialized runtime facts; source graph, compiler, activation planning and architecture audits are offline/control-plane only.',
 'runtime_allowed',jsonb_build_array('grammar_runtime_releases','grammar_runtime_release_rules','grammar_rules','grammar_rule_triggers','grammar_rule_sources','grammar_runtime_lexical_overlays_v1','grammar_lexical_classes','grammar_lexical_class_members','lexemes','lexeme_form_variants','canonical runtime operator functions'),
 'build_only',jsonb_build_array('grammar_knowledge_candidates','runtime manifests/compiler plans','operator/scoped templates','activation readiness/planning','representative suite audits','compiler closure audits'),
 'source_derived_runtime_fact_policy','Materialize once into versioned runtime storage with provenance; never re-query Source Graph per user text.',
 'diagnostics_policy','Architecture/build diagnostics are invoked explicitly via a separate diagnostic wrapper and are absent from the production hot path.',
 'ai_teacher_policy','Teacher/explanation consumes canonical facts and provenance; it must not reparse raw text independently.'
);
$$;

create or replace function public.runtime_hot_path_isolation_audit_v1(p_root_function text,p_max_depth int default 48)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
with recursive procdefs as (
  select p.oid,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
), walk as (
  select p.oid,p.proname,p.prosrc,0 depth,array[p.oid]::oid[] path
  from procdefs p where p.proname=p_root_function
  union all
  select c.oid,c.proname,c.prosrc,w.depth+1,w.path||c.oid
  from walk w
  cross join lateral regexp_matches(w.prosrc,'public\.([A-Za-z_][A-Za-z0-9_]*)\s*\(','g') m
  join procdefs c on c.proname=m[1]
  where w.depth<greatest(1,least(coalesce(p_max_depth,48),96)) and not c.oid=any(w.path)
), reach as (
  select distinct oid,proname,prosrc,min(depth) over(partition by oid) depth from walk
), fh as (
  select distinct r.proname function_name,f.ref_name,f.category,f.reason
  from reach r join public.grammar_runtime_hot_path_forbidden_refs_v1 f on f.ref_kind='function' and f.ref_name=r.proname
), rh as (
  select distinct r.proname function_name,f.ref_name,f.category,f.reason
  from reach r join public.grammar_runtime_hot_path_forbidden_refs_v1 f on f.ref_kind='relation' and position(f.ref_name in r.prosrc)>0
)
select jsonb_build_object(
 'version','runtime-hot-path-isolation-audit-v1','root_function',p_root_function,
 'root_found',exists(select 1 from reach where proname=p_root_function),
 'reachable_function_count',(select count(*) from reach),
 'reachable_functions',(select coalesce(jsonb_agg(jsonb_build_object('function',proname,'depth',depth) order by depth,proname),'[]'::jsonb) from reach),
 'forbidden_function_hits',(select coalesce(jsonb_agg(jsonb_build_object('function',function_name,'forbidden_ref',ref_name,'category',category,'reason',reason) order by function_name,ref_name),'[]'::jsonb) from fh),
 'forbidden_relation_hits',(select coalesce(jsonb_agg(jsonb_build_object('function',function_name,'forbidden_ref',ref_name,'category',category,'reason',reason) order by function_name,ref_name),'[]'::jsonb) from rh),
 'forbidden_function_hit_count',(select count(*) from fh),
 'forbidden_relation_hit_count',(select count(*) from rh),
 'pass',exists(select 1 from reach where proname=p_root_function) and not exists(select 1 from fh) and not exists(select 1 from rh)
);
$$;

create or replace function public.subordinate_connector_inventory_v2(p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare items jsonb:='[]'::jsonb; r record; prov jsonb; v_release_id uuid;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
 if v_release_id is null then raise exception 'Runtime release % not found',p_release_code; end if;
 for r in select distinct m.normalized_lemma connector from public.grammar_lexical_class_members m join public.grammar_lexical_classes c on c.id=m.class_id where c.code='subjunction_connector' and c.is_active and m.is_active and m.normalized_lemma is not null order by m.normalized_lemma loop
   select coalesce(jsonb_agg(jsonb_build_object('source_type','lexical_class_member','member_id',m.id,'class_id',c.id,'source',m.source,'pos',m.pos,'confidence',m.confidence,'evidence',m.evidence) order by m.id),'[]'::jsonb) into prov
   from public.grammar_lexical_class_members m join public.grammar_lexical_classes c on c.id=m.class_id where c.code='subjunction_connector' and c.is_active and m.is_active and m.normalized_lemma=r.connector;
   items:=items||jsonb_build_array(jsonb_build_object('connector',r.connector,'status','resolved','effective_lexical_class','subjunction_connector','classification_source','existing_lexical_class','provenance',prov));
 end loop;
 for r in select normalized_surface connector,provenance,payload,pos from public.grammar_runtime_lexical_overlays_v1 where release_id=v_release_id and overlay_type='lexical_class_overlay' and lexical_class_code='subjunction_connector' and is_enabled order by normalized_surface loop
   if not exists(select 1 from jsonb_array_elements(items) i where i->>'connector'=r.connector) then
     items:=items||jsonb_build_array(jsonb_build_object('connector',r.connector,'status','resolved','effective_lexical_class','subjunction_connector','classification_source','runtime_materialized_source_overlay','provenance',r.provenance,'payload',r.payload,'pos',r.pos));
   end if;
 end loop;
 return jsonb_build_object('version','subordinate-connector-inventory-v2','status','ready','release_code',p_release_code,'items',items,'summary',jsonb_build_object('resolved_connector_count',jsonb_array_length(items),'source_graph_runtime_reads',0,'global_lexical_class_mutation',false));
end;
$$;

create or replace function public.subordinate_connector_match_v2(p_token jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare norm text; item jsonb; cls jsonb;
begin
 norm:=lower(coalesce(nullif(p_token->>'normalized',''),p_token->>'surface',''));
 if norm='' then return jsonb_build_object('matched',false); end if;
 select value into cls from jsonb_array_elements(coalesce(p_token->'lexical_classes','[]'::jsonb)) where value->>'class_code'='subjunction_connector' order by coalesce((value->>'confidence')::numeric,0) desc limit 1;
 if cls is not null then return jsonb_build_object('matched',true,'connector',norm,'effective_lexical_class','subjunction_connector','classification_source','existing_token_lexical_class','token_class',cls); end if;
 select value into item from jsonb_array_elements(public.subordinate_connector_inventory_v2(p_release_code)->'items') where value->>'connector'=norm and value->>'status'='resolved' limit 1;
 if item is not null then return jsonb_build_object('matched',true,'connector',norm,'effective_lexical_class','subjunction_connector','classification_source',item->>'classification_source','provenance',item->'provenance'); end if;
 return jsonb_build_object('matched',false,'connector',norm);
end;
$$;

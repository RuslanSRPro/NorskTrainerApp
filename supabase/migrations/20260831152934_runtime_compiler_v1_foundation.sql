create table if not exists public.grammar_runtime_compiler_plans_v1(
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.grammar_runtime_manifests(id) on delete cascade,
  compiler_contract text not null default 'grammar-runtime-compiler-v1',
  plan_version text not null default '1.0',
  output_plan jsonb not null,
  status text not null default 'validated' check (status in ('draft','validated','deprecated')),
  notes text,
  created_at timestamptz not null default now(),
  unique(manifest_id,compiler_contract,plan_version)
);

insert into public.grammar_runtime_compiler_plans_v1(manifest_id,output_plan,notes)
select m.id,
 jsonb_build_object('outputs',jsonb_build_array(
   jsonb_build_object('pattern_type','feature_unification','rule_type','agreement','code_suffix','feature_unification','compile_role','validation')
 )),
 'Historical recognition_plus_validation manifest compiled one validation rule. Explicit plan makes this deterministic without mutating validated IR.'
from public.grammar_runtime_manifests m
where m.code='ir.adjective.agreement.controller_feature_copy'
on conflict do nothing;

insert into public.grammar_runtime_compiler_plans_v1(manifest_id,output_plan,notes)
select m.id,
 jsonb_build_object('outputs',jsonb_build_array(
   jsonb_build_object('pattern_type','relative_order','rule_type','word_order','code_suffix','schema_a','branch_id','A','compile_role','branch_A'),
   jsonb_build_object('pattern_type','relative_order','rule_type','word_order','code_suffix','schema_b','branch_id','B','compile_role','branch_B')
 )),
 'Historical split_by_branch manifest compiled A/B relative-order branches. Explicit plan removes hidden migration logic.'
from public.grammar_runtime_manifests m
where m.code='ir.word_order.schema_a_b.finite_adverbial'
on conflict do nothing;

create or replace function public.runtime_compiler_rule_type_v1(p_pattern_type text,p_manifest jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare a jsonb; v_role text; v_action text;
begin
 case p_pattern_type
  when 'candidate_constraint' then return 'disambiguation';
  when 'phrase_pattern' then return 'construction';
  when 'dependency_pattern' then return 'dependency';
  when 'clause_pattern' then return 'clause';
  when 'feature_unification' then return 'agreement';
  when 'relative_order' then return 'word_order';
 end case;
 if p_pattern_type='graph_pattern' then
   for a in select value from jsonb_array_elements(coalesce(p_manifest->'actions','[]'::jsonb)) loop
     v_action:=a->>'action'; v_role:=coalesce(a#>>'{value,role}',a->>'relation');
     if v_action='create_dependency' then return 'binding'; end if;
     if v_action='set_role' and v_role='predicate' then return 'construction'; end if;
     if v_action='set_role' and v_role='connector_field' then return 'clause'; end if;
     if v_action='set_role' and v_role='midfield_adverbial' then return 'interpretation'; end if;
   end loop;
   return 'construction';
 end if;
 return 'construction';
end;
$function$;

create or replace function public.runtime_compiler_base_code_v1(p_manifest_code text)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
select 'nrg_rt_v1.'||regexp_replace(p_manifest_code,'^ir\\.','');
$function$;

create or replace function public.runtime_compiler_pattern_v1(p_ir jsonb,p_pattern_type text,p_branch_id text default null)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare v jsonb; v_binding text; v_required jsonb; v_sat jsonb; v_violation jsonb;
begin
 v:=coalesce(p_ir,'{}'::jsonb)
    -'code'-'source'-'actions'-'runtime'-'compiler'-'generation'-'explanation'-'dependencies'-'language_scope'-'ir_version';
 v:=v||jsonb_build_object('manifest_code',p_ir->>'code','runtime_ir_version',coalesce(p_ir->>'ir_version','1.0'));
 if p_pattern_type='candidate_constraint' then
   select key into v_binding from jsonb_each(coalesce(p_ir->'bindings','{}'::jsonb)) limit 1;
   if v_binding is not null then v:=v||jsonb_build_object('binding_ref',v_binding); end if;
 elsif p_pattern_type='relative_order' and p_branch_id is not null then
   if p_branch_id='A' then
     v_required:=jsonb_build_array('finite','adv');
     v_sat:=jsonb_build_object('op','before','left',jsonb_build_object('ref','finite.position'),'right',jsonb_build_object('ref','adv.position'));
     v_violation:=jsonb_build_object('op','before','left',jsonb_build_object('ref','adv.position'),'right',jsonb_build_object('ref','finite.position'));
   else
     v_required:=jsonb_build_array('adv','finite');
     v_sat:=jsonb_build_object('op','before','left',jsonb_build_object('ref','adv.position'),'right',jsonb_build_object('ref','finite.position'));
     v_violation:=jsonb_build_object('op','before','left',jsonb_build_object('ref','finite.position'),'right',jsonb_build_object('ref','adv.position'));
   end if;
   v:=v||jsonb_build_object('branch_id',p_branch_id,'required_order',v_required,'satisfaction_condition',v_sat,'violation_condition',v_violation);
   v:=jsonb_set(v,'{condition}',jsonb_build_object('all',jsonb_build_array(
     jsonb_build_object('op','eq','left',jsonb_build_object('ref','clause.schema'),'right',p_branch_id),
     jsonb_build_object('op','exists','left',jsonb_build_object('ref','finite.position')),
     jsonb_build_object('op','exists','left',jsonb_build_object('ref','adv.position'))
   )),true);
 end if;
 return v;
end;
$function$;

create or replace function public.runtime_compiler_actions_v1(p_ir jsonb,p_pattern_type text,p_branch_id text default null)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare outj jsonb:='[]'::jsonb; a jsonb; schema_ref text;
begin
 if p_pattern_type<>'relative_order' or p_branch_id is null then return coalesce(p_ir->'actions','[]'::jsonb); end if;
 for a in select value from jsonb_array_elements(coalesce(p_ir->'actions','[]'::jsonb)) loop
   if a->>'action'='add_interpretation' then
     outj:=outj||jsonb_build_array(jsonb_set(a,'{when}',case when p_branch_id='A'
       then jsonb_build_object('op','before','left',jsonb_build_object('ref','finite.position'),'right',jsonb_build_object('ref','adv.position'))
       else jsonb_build_object('op','before','left',jsonb_build_object('ref','adv.position'),'right',jsonb_build_object('ref','finite.position')) end,true));
   elsif a->>'action'='emit_diagnostic' and a#>>'{when,all,0,right}'=p_branch_id then
     outj:=outj||jsonb_build_array(a);
   end if;
 end loop;
 return outj;
end;
$function$;

create or replace function public.runtime_compiler_result_v1(p_manifest jsonb,p_manifest_code text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_strip_nulls(jsonb_build_object(
 'manifest_code',p_manifest_code,
 'runtime_family',p_manifest->>'runtime_family',
 'constraint_strength',p_manifest->>'constraint_strength',
 'capabilities',p_manifest->'capabilities'
));
$function$;

create or replace function public.compile_grammar_runtime_manifest_v1(p_manifest_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare m record; v_plan jsonb; o jsonb; v_outputs jsonb:='[]'::jsonb; v_pattern_type text; v_rule_type text; v_suffix text; v_code text; v_branch text; v_pattern jsonb; v_actions jsonb; v_result jsonb; v_hash text; v_strategy text; v_targets jsonb;
begin
 select * into m from public.grammar_runtime_manifests where id=p_manifest_id;
 if m.id is null then return jsonb_build_object('status','manifest_not_found','manifest_id',p_manifest_id); end if;
 if m.authoring_status<>'validated' then return jsonb_build_object('status','manifest_not_validated','manifest_id',m.id,'manifest_code',m.code); end if;
 v_strategy:=m.compiler->>'strategy'; v_targets:=coalesce(m.compiler->'target_rule_types','[]'::jsonb);
 select output_plan into v_plan from public.grammar_runtime_compiler_plans_v1 where manifest_id=m.id and compiler_contract='grammar-runtime-compiler-v1' and status='validated' order by created_at desc limit 1;
 if v_strategy='single_rule' then
   o:=jsonb_build_object('pattern_type',v_targets->>0);
   v_plan:=jsonb_build_object('outputs',jsonb_build_array(o));
 elsif v_plan is null then
   return jsonb_build_object('status','explicit_compiler_plan_required','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'target_rule_types',v_targets);
 end if;
 for o in select value from jsonb_array_elements(v_plan->'outputs') loop
   v_pattern_type:=o->>'pattern_type'; v_branch:=o->>'branch_id';
   v_rule_type:=coalesce(o->>'rule_type',public.runtime_compiler_rule_type_v1(v_pattern_type,jsonb_build_object('actions',m.actions)));
   v_suffix:=o->>'code_suffix';
   v_code:=public.runtime_compiler_base_code_v1(m.code);
   if v_suffix is not null then v_code:=v_code||'.'||v_suffix;
   elsif v_pattern_type='candidate_constraint' and right(v_code,20)<>'candidate_constraint' then v_code:=v_code||'.candidate_constraint'; end if;
   v_pattern:=public.runtime_compiler_pattern_v1(m.ir_spec,v_pattern_type,v_branch);
   v_actions:=public.runtime_compiler_actions_v1(m.ir_spec,v_pattern_type,v_branch);
   v_result:=public.runtime_compiler_result_v1(to_jsonb(m),m.code);
   v_hash:=encode(digest(convert_to(jsonb_build_object('code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'result',v_result)::text,'UTF8'),'sha256'),'hex');
   v_outputs:=v_outputs||jsonb_build_array(jsonb_build_object(
    'code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'parser_actions',v_actions,'result',v_result,
    'compile_role',coalesce(o->>'compile_role','primary'),'compiler_version','grammar-runtime-compiler-v1','compile_hash',v_hash,
    'runtime_manifest_id',m.id,'topic_id',m.topic_id,'execution_phase',m.execution_phase,'runtime_family',m.runtime_family,'branch_id',v_branch
   ));
 end loop;
 return jsonb_build_object('status','compiled','compiler_version','grammar-runtime-compiler-v1','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'outputs',v_outputs,'output_count',jsonb_array_length(v_outputs));
end;
$function$;

create or replace function public.compare_manifest_compile_to_existing_v1(p_manifest_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare c jsonb; p jsonb; a jsonb; v_items jsonb:='[]'::jsonb; v_exact int:=0; v_sem int:=0; v_total int:=0;
begin
 c:=public.compile_grammar_runtime_manifest_v1(p_manifest_id);
 if c->>'status'<>'compiled' then return c; end if;
 for p in select value from jsonb_array_elements(c->'outputs') loop
   v_total:=v_total+1;
   select jsonb_build_object('code',gr.code,'pattern_type',gr.pattern_type,'rule_type',gr.rule_type,'pattern',gr.pattern,'actions',gr.actions,'parser_actions',gr.parser_actions,'result',gr.result,'compile_hash',gr.compile_hash,'compiler_version',gr.compiler_version)
    into a from public.grammar_rules gr where gr.runtime_manifest_id=p_manifest_id and gr.code=p->>'code' limit 1;
   if a is not null and a->>'pattern_type'=p->>'pattern_type' and a->>'rule_type'=p->>'rule_type' and a->'actions'=p->'actions' and (a->'pattern') @> (p->'pattern') and (p->'pattern') @> (a->'pattern') then v_sem:=v_sem+1; end if;
   if a is not null and a->>'pattern_type'=p->>'pattern_type' and a->>'rule_type'=p->>'rule_type' and a->'actions'=p->'actions' and a->'pattern'=p->'pattern' and a->'parser_actions'=p->'parser_actions' then v_exact:=v_exact+1; end if;
   v_items:=v_items||jsonb_build_array(jsonb_build_object('planned',p,'existing',a,'semantic_parity',a is not null and a->>'pattern_type'=p->>'pattern_type' and a->>'rule_type'=p->>'rule_type' and a->'actions'=p->'actions' and a->'pattern'=p->'pattern','exact_ir_parity',a is not null and a->'pattern'=p->'pattern' and a->'actions'=p->'actions' and a->'parser_actions'=p->'parser_actions'));
 end loop;
 return jsonb_build_object('version','manifest-compiler-parity-v1','manifest_id',p_manifest_id,'planned_outputs',v_total,'semantic_parity_count',v_sem,'exact_ir_parity_count',v_exact,'all_semantic_parity',v_sem=v_total,'all_exact_ir_parity',v_exact=v_total,'items',v_items);
end;
$function$;

create or replace function public.runtime_compiler_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
 'version','grammar-runtime-compiler-v1',
 'input','validated grammar_runtime_manifest + optional compiler plan for multi-output strategies',
 'output','deterministic compiled rule specs; no database mutation in compile function',
 'supported_strategies',jsonb_build_array('single_rule','recognition_plus_validation_with_explicit_plan','split_by_branch_with_explicit_plan'),
 'supported_pattern_types',jsonb_build_array('candidate_constraint','phrase_pattern','dependency_pattern','clause_pattern','graph_pattern','feature_unification','relative_order'),
 'safety',jsonb_build_object('validated_manifest_required',true,'unknown_strategy_requires_plan',true,'compile_is_pure',true,'materialization_separate',true),
 'immutability','validated manifests are not mutated; complex historical compile behavior is represented in versioned compiler-plan rows'
);
$function$;

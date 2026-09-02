create or replace function public.assess_runtime_rule_execution_v3(p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; base jsonb; st text; blockers jsonb:='[]'::jsonb; ready boolean:=false; operation text; branch text;
begin
 select gr.*,m.execution_phase,m.runtime_family into r
 from public.grammar_rules gr left join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id
 where gr.id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 base:=public.assess_runtime_rule_execution_v2(p_rule_id);
 operation:=coalesce(r.pattern->>'graph_operation',r.pattern->>'clause_operation'); branch:=r.pattern->>'branch_id';

 if r.pattern_type in ('candidate_constraint','phrase_pattern','dependency_pattern') then st:=base->>'execution_status'; ready:=coalesce((base->>'ready_without_runtime_code_change')::boolean,false);
 elsif r.pattern_type='clause_pattern' and operation='build_finite_clause' then st:='executable_via_canonical_clause_equivalent'; ready:=true;
 elsif r.pattern_type='clause_pattern' and operation='assign_schema' and r.pattern->>'schema'='A' then st:='executable_via_clause_field_model_v1'; ready:=true;
 elsif r.pattern_type='clause_pattern' and operation='assign_schema' and r.pattern->>'schema'='B' then st:='registered_but_upstream_blocked'; blockers:=jsonb_build_array('subordinate_clause_foundation_v1');
 elsif r.pattern_type='graph_pattern' and operation='assign_role' and r.pattern->>'role'='predicate' then st:='executable_via_canonical_predicate_equivalent'; ready:=true;
 elsif r.pattern_type='graph_pattern' and operation='create_relation' and r.pattern->>'relation'='agreement_controller' then st:='executable_via_agreement_controller_bridge_v1'; ready:=true;
 elsif r.pattern_type='graph_pattern' and operation='assign_field' and r.pattern->>'field'='midfield_adverbial' then st:='executable_via_clause_field_model_v1'; ready:=true;
 elsif r.pattern_type='graph_pattern' and operation='assign_field' and r.pattern->>'field'='f' then st:='registered_but_upstream_blocked'; blockers:=jsonb_build_array('subordinate_clause_foundation_v1');
 elsif r.pattern_type='feature_unification' then st:='executable_via_agreement_controller_bridge_v1'; ready:=true;
 elsif r.pattern_type='relative_order' and branch='A' then st:='executable_via_clause_field_model_v1'; ready:=true;
 elsif r.pattern_type='relative_order' and branch='B' then st:='registered_but_upstream_blocked'; blockers:=jsonb_build_array('subordinate_clause_foundation_v1');
 else st:=coalesce(base->>'execution_status','unsupported'); blockers:=coalesce(base->'upstream_blockers','[]'::jsonb); ready:=coalesce((base->>'ready_without_runtime_code_change')::boolean,false); end if;

 return base||jsonb_build_object('version','runtime-rule-execution-assessment-v3','execution_status',st,'upstream_blockers',blockers,'ready_without_runtime_code_change',ready,
  'upstream_closure',case when ready and st like '%agreement_controller_bridge_v1%' then 'agreement-controller-bridge-v1' when ready and st like '%clause_field_model_v1%' then 'clause-field-model-v1' else null end);
end;
$function$;

create or replace function public.audit_execution_family_closure_v3(p_release_code text default 'runtime-structural-v1.21')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare rid uuid; a jsonb; items jsonb:='[]'::jsonb; total int:=0; readyc int:=0; blocked int:=0; unsupported int:=0;
begin
 for rid in select rr.rule_id from public.grammar_runtime_releases rel join public.grammar_runtime_release_rules rr on rr.release_id=rel.id where rel.code=p_release_code and rr.is_enabled order by rr.rule_id loop
   a:=public.assess_runtime_rule_execution_v3(rid); total:=total+1;
   if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then readyc:=readyc+1;
   elsif a->>'execution_status'='registered_but_upstream_blocked' then blocked:=blocked+1; else unsupported:=unsupported+1; end if;
   items:=items||jsonb_build_array(a);
 end loop;
 return jsonb_build_object('version','execution-family-closure-audit-v3','status','audited','release_code',p_release_code,'items',items,
  'summary',jsonb_build_object('rule_count',total,'ready_without_runtime_code_change',readyc,'registered_but_blocked',blocked,'unsupported_or_unmapped',unsupported,'bulk_activation_ready',false,'remaining_blocker','Subordinate Clause Foundation V1'));
end;
$function$;

create or replace function public.audit_representative_rule_suite_execution_v3(p_suite_code text default 'representative-rule-suite-v1')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare s record; a jsonb; ass jsonb; items jsonb:='[]'::jsonb; compiled int:=0; fullready int:=0; partial int:=0; blocked int:=0; sourceonly int:=0; newcap int:=0; refonly int:=0; rulecount int; readyrules int;
begin
 for s in select * from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code order by ordinal loop
   ass:='[]'::jsonb; rulecount:=0; readyrules:=0;
   for a in select public.assess_runtime_rule_execution_v3(gr.id) x
            from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id where gs.candidate_id=s.candidate_id order by gr.code loop
      rulecount:=rulecount+1; if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then readyrules:=readyrules+1; end if; ass:=ass||jsonb_build_array(a);
   end loop;
   if rulecount>0 then
     compiled:=compiled+1;
     if readyrules=rulecount then fullready:=fullready+1;
     elsif readyrules>0 then partial:=partial+1;
     else blocked:=blocked+1; end if;
   elsif s.expected_current_state in ('source_consumed_but_not_compiled','source_consumed_partial_semantics','runtime_capability_exists_not_rule_driven','source_to_morphology_mapping_required') then sourceonly:=sourceonly+1;
   elsif s.expected_current_state='new_generic_capability_required' then newcap:=newcap+1;
   elsif s.expected_current_state='reference_or_interpretive' then refonly:=refonly+1; end if;
   items:=items||jsonb_build_array(jsonb_build_object('ordinal',s.ordinal,'chapter',s.chapter,'candidate_code',s.candidate_code,'capability_family',s.capability_family,'compiled_rule_count',rulecount,'ready_rule_count',readyrules,'execution_assessments',ass,
     'candidate_state',case when rulecount>0 and readyrules=rulecount then 'compiled_ready' when rulecount>0 and readyrules>0 then 'compiled_partially_ready_upstream_blocked' when rulecount>0 then 'compiled_upstream_blocked' else s.expected_current_state end));
 end loop;
 return jsonb_build_object('version','representative-rule-suite-execution-audit-v3','status','audited','suite_code',p_suite_code,'items',items,
  'summary',jsonb_build_object('sample_size',(select count(*) from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code),'compiled_candidates',compiled,'compiled_candidates_fully_ready',fullready,'compiled_candidates_partially_ready',partial,'compiled_candidates_fully_blocked',blocked,'runtime_or_source_without_compiled_rule',sourceonly,'new_generic_capability_required',newcap,'reference_or_interpretive',refonly,'bulk_activation_ready',false));
end;
$function$;

create or replace function public.upstream_capability_closure_summary_v1(p_release_code text default 'runtime-structural-v1.21')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object('version','upstream-capability-closure-v1','release_code',p_release_code,
 'execution',public.audit_execution_family_closure_v3(p_release_code),
 'representative_suite',public.audit_representative_rule_suite_execution_v3('representative-rule-suite-v1'),
 'agreement_contract',public.agreement_controller_bridge_contract_v1(),
 'clause_field_contract',public.clause_field_model_contract_v1(),
 'next_layer','Subordinate Clause Foundation V1','bulk_activation_ready',false);
$function$;

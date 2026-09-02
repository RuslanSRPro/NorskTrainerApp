create or replace function public.runtime_pattern_operator_registry_v2()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
 'version','runtime-pattern-operator-registry-v2',
 'operators',jsonb_build_array(
   jsonb_build_object('pattern_type','candidate_constraint','status','executable','operator','candidate-constraint-executor-v2','requires',jsonb_build_array('token grammar readings','lexical class triggers')),
   jsonb_build_object('pattern_type','phrase_pattern','status','executable','operator','phrase-family-operator-v1','requires',jsonb_build_array('resolved local POS','phrase strategy')),
   jsonb_build_object('pattern_type','dependency_pattern','status','executable','operator','dependency-pattern-executor-v2','requires',jsonb_build_array('resolved Clause Build V1','resolved Predicate Build V1')),
   jsonb_build_object('pattern_type','clause_pattern','status','registered','operator','clause-pattern-adapter-v2','supported_operations',jsonb_build_array('build_finite_clause','assign_schema'),'upstream_blockers',jsonb_build_array('subordinate clause recognition for schema B','reliable connector-field materialization')),
   jsonb_build_object('pattern_type','graph_pattern','status','registered','operator','graph-pattern-adapter-v2','supported_operations',jsonb_build_array('assign_role','assign_field','create_relation'),'upstream_blockers',jsonb_build_array('nested phrase relations for agreement_controller','reliable clause field model for adverbials/connectors')),
   jsonb_build_object('pattern_type','feature_unification','status','registered','operator','feature-unification-adapter-v2','supported_operations',jsonb_build_array('feature_unifies','score','diagnostic','agreement_with'),'upstream_blockers',jsonb_build_array('agreement_controller relation must be materialized')),
   jsonb_build_object('pattern_type','relative_order','status','registered','operator','relative-order-adapter-v2','supported_operations',jsonb_build_array('before','interpret','diagnostic'),'upstream_blockers',jsonb_build_array('clause.schema','midfield_adverbial field'))
 ),
 'unknown_pattern_policy','explicit_unsupported',
 'registered_does_not_mean_executable','registered families may remain blocked until their declared upstream fields exist'
);
$function$;

create or replace function public.assess_runtime_rule_execution_v2(p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; reg jsonb; op jsonb; v_operation text; v_status text; v_blockers jsonb:='[]'::jsonb; v_actions_ok boolean; v_unknown jsonb; v_upstream text;
begin
 select gr.*,m.execution_phase,m.runtime_family into r
 from public.grammar_rules gr left join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id
 where gr.id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 reg:=public.runtime_pattern_operator_registry_v2();
 select value into op from jsonb_array_elements(reg->'operators') where value->>'pattern_type'=r.pattern_type limit 1;
 if op is null then return jsonb_build_object('status','unsupported','pattern_type',r.pattern_type,'rule_code',r.code,'reason_code','pattern_type_not_registered'); end if;
 select coalesce(jsonb_agg(a->>'action' order by a->>'action'),'[]'::jsonb) into v_unknown
 from jsonb_array_elements(coalesce(r.actions,'[]'::jsonb)) a
 where not exists(select 1 from jsonb_array_elements(public.rule_action_operator_registry_v1()->'operators') o where o->>'action'=a->>'action');
 v_actions_ok:=jsonb_array_length(v_unknown)=0;
 if r.pattern_type in ('candidate_constraint','phrase_pattern','dependency_pattern') then
   v_status:=case when v_actions_ok then 'executable' else 'unsupported_actions' end;
 elsif r.pattern_type='clause_pattern' then
   v_operation:=r.pattern->>'clause_operation';
   if v_operation='build_finite_clause' then v_status:='executable_via_canonical_clause_equivalent';
   elsif v_operation='assign_schema' then v_status:='registered_but_upstream_blocked'; v_blockers:=jsonb_build_array('reliable_clause_schema_inputs');
   else v_status:='registered_but_operation_unmapped'; end if;
 elsif r.pattern_type='graph_pattern' then
   v_operation:=r.pattern->>'graph_operation';
   if v_operation='assign_role' and r.pattern->>'role'='predicate' then v_status:='executable_via_canonical_predicate_equivalent';
   elsif v_operation='assign_field' then v_status:='registered_but_upstream_blocked'; v_blockers:=jsonb_build_array('clause_field_model');
   elsif v_operation='create_relation' and r.pattern->>'relation'='agreement_controller' then v_status:='registered_but_upstream_blocked'; v_blockers:=jsonb_build_array('nested_np_ap_relation');
   else v_status:='registered_but_operation_unmapped'; end if;
 elsif r.pattern_type='feature_unification' then
   v_status:='registered_but_upstream_blocked'; v_blockers:=jsonb_build_array('agreement_controller_relation');
 elsif r.pattern_type='relative_order' then
   v_status:='registered_but_upstream_blocked'; v_blockers:=jsonb_build_array('clause.schema','midfield_adverbial_field');
 else v_status:='unsupported'; end if;
 return jsonb_build_object(
  'version','runtime-rule-execution-assessment-v2','rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,'runtime_family',r.runtime_family,'execution_phase',r.execution_phase,
  'operator',op->>'operator','registry_status',op->>'status','execution_status',v_status,'operation',v_operation,'actions_supported',v_actions_ok,'unsupported_actions',v_unknown,
  'upstream_blockers',v_blockers,'ready_without_runtime_code_change',v_status in ('executable','executable_via_canonical_clause_equivalent','executable_via_canonical_predicate_equivalent')
 );
end;
$function$;

create or replace function public.execution_family_closure_audit_v2(p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare rid uuid; a jsonb; items jsonb:='[]'::jsonb; total int:=0; ready int:=0; blocked int:=0; unsupported int:=0; patterns int:=0;
begin
 select id into rid from public.grammar_runtime_releases where code=p_release_code;
 if rid is null then return jsonb_build_object('status','release_not_found','release_code',p_release_code); end if;
 for a in
   select public.assess_runtime_rule_execution_v2(rr.rule_id)
   from public.grammar_runtime_release_rules rr where rr.release_id=rid and rr.is_enabled order by rr.rule_id
 loop
   total:=total+1; items:=items||jsonb_build_array(a);
   if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then ready:=ready+1;
   elsif a->>'execution_status' like 'registered_but%' then blocked:=blocked+1;
   else unsupported:=unsupported+1; end if;
 end loop;
 select count(distinct x->>'pattern_type') into patterns from jsonb_array_elements(items) x;
 return jsonb_build_object('version','execution-family-closure-audit-v2','release_code',p_release_code,'status','audited','items',items,
  'summary',jsonb_build_object('rule_count',total,'pattern_types_covered',patterns,'ready_without_runtime_code_change',ready,'registered_but_blocked',blocked,'unsupported_or_unmapped',unsupported,'bulk_activation_ready',unsupported=0 and blocked=0));
end;
$function$;

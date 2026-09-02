create or replace function public.representative_rule_suite_execution_audit_v2(p_suite_code text default 'representative-rule-suite-v1')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare s record; rules jsonb; a jsonb; item jsonb; items jsonb:='[]'::jsonb; total int:=0; compiled int:=0; ready int:=0; blocked int:=0; uncompiled int:=0; reference_count int:=0; new_cap int:=0;
begin
 for s in select * from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code order by ordinal loop
   total:=total+1;
   rules:='[]'::jsonb;
   for a in
     select public.assess_runtime_rule_execution_v2(gr.id)
     from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id
     where gs.candidate_id=s.candidate_id order by gr.code
   loop rules:=rules||jsonb_build_array(a); end loop;
   if jsonb_array_length(rules)>0 then
     compiled:=compiled+1;
     if exists(select 1 from jsonb_array_elements(rules) x where coalesce((x->>'ready_without_runtime_code_change')::boolean,false))
        and not exists(select 1 from jsonb_array_elements(rules) x where x->>'execution_status' in ('unsupported','unsupported_actions','registered_but_operation_unmapped')) then
       ready:=ready+1;
       item:=jsonb_build_object('candidate_state','compiled_ready_or_mixed_ready','ready_without_runtime_code_change',true);
     else
       blocked:=blocked+1;
       item:=jsonb_build_object('candidate_state','compiled_but_upstream_blocked','ready_without_runtime_code_change',false);
     end if;
   elsif s.expected_current_state='reference_or_interpretive' then
     reference_count:=reference_count+1; item:=jsonb_build_object('candidate_state','reference_or_interpretive','ready_without_runtime_code_change',false);
   elsif s.expected_current_state='new_generic_capability_required' then
     new_cap:=new_cap+1; item:=jsonb_build_object('candidate_state','new_generic_capability_required','ready_without_runtime_code_change',false);
   else
     uncompiled:=uncompiled+1; item:=jsonb_build_object('candidate_state','runtime_or_source_without_compiled_rule','ready_without_runtime_code_change',false);
   end if;
   items:=items||jsonb_build_array(jsonb_build_object('ordinal',s.ordinal,'chapter',s.chapter,'candidate_id',s.candidate_id,'candidate_code',s.candidate_code,'capability_family',s.capability_family,'execution_assessments',rules)||item);
 end loop;
 return jsonb_build_object('version','representative-rule-suite-execution-audit-v2','suite_code',p_suite_code,'status','audited','items',items,
  'summary',jsonb_build_object('sample_size',total,'compiled_candidates',compiled,'compiled_candidates_ready_without_runtime_code_change',ready,'compiled_candidates_blocked',blocked,'runtime_or_source_without_compiled_rule',uncompiled,'new_generic_capability_required',new_cap,'reference_or_interpretive',reference_count,'bulk_activation_ready',false));
end;
$function$;

create or replace function public.compiler_execution_closure_summary_v2(p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare c record; exact_manifests int:=0; manifests int:=0; outputs int:=0; exact_outputs int:=0; plans int:=0; e jsonb; rep jsonb; rel record; inh jsonb;
begin
 for c in select m.id,public.compare_manifest_compile_to_existing_v1(m.id) p from public.grammar_runtime_manifests m loop
   manifests:=manifests+1; outputs:=outputs+coalesce((c.p->>'planned_outputs')::int,0); exact_outputs:=exact_outputs+coalesce((c.p->>'exact_ir_parity_count')::int,0);
   if coalesce((c.p->>'all_exact_ir_parity')::boolean,false) then exact_manifests:=exact_manifests+1; end if;
 end loop;
 select count(*) into plans from public.grammar_runtime_compiler_plans_v1 where compiler_contract='grammar-runtime-compiler-v1' and status='validated';
 e:=public.execution_family_closure_audit_v2(p_release_code);
 rep:=public.representative_rule_suite_execution_audit_v2('representative-rule-suite-v1');
 select code,metadata into rel from public.grammar_runtime_releases where code=p_release_code;
 if rel.code is null then return jsonb_build_object('status','release_not_found','release_code',p_release_code); end if;
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,rel.metadata->>'parent_release');
 return jsonb_build_object('version','compiler-execution-closure-v2','status','audited','release_code',p_release_code,
   'compiler',jsonb_build_object('contract','grammar-runtime-compiler-v1','manifest_count',manifests,'exact_parity_manifests',exact_manifests,'compiled_output_count',outputs,'exact_parity_outputs',exact_outputs,'validated_compiler_plans',plans,'pure_compile',true,'materializer_separate',true,'materializer_default_activation',false,'compiler_closed',manifests=exact_manifests and outputs=exact_outputs and manifests>0),
   'execution',e,
   'representative_suite',rep,
   'inheritance',inh,
   'summary',jsonb_build_object(
     'compiler_closed',manifests=exact_manifests and outputs=exact_outputs and manifests>0,
     'pattern_registry_complete_for_current_compiled_rules',(e#>>'{summary,unsupported_or_unmapped}')::int=0,
     'current_compiled_rules_ready',(e#>>'{summary,ready_without_runtime_code_change}')::int,
     'current_compiled_rules_upstream_blocked',(e#>>'{summary,registered_but_blocked}')::int,
     'bulk_activation_ready',false,
     'next_closure','Upstream Capability Closure V1'
   )
 );
end;
$function$;

create or replace function public.apply_compiler_execution_closure_v2(p_doc jsonb,p_release_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_set(p_doc,'{document_graph,runtime_build_audit_v2}',public.compiler_execution_closure_summary_v2(p_release_code),true);
$function$;

create or replace function public.analyze_text_structural_shadow_v20(p_text text,p_release_code text default 'runtime-structural-v1.20')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb;
begin
 v_doc:=public.analyze_text_structural_shadow_v19(p_text,p_release_code);
 return public.apply_compiler_execution_closure_v2(v_doc,p_release_code);
end;
$function$;

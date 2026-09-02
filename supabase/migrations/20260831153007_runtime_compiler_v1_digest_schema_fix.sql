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
   v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'result',v_result)::text,'UTF8'),'sha256'::text),'hex');
   v_outputs:=v_outputs||jsonb_build_array(jsonb_build_object(
    'code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'parser_actions',v_actions,'result',v_result,
    'compile_role',coalesce(o->>'compile_role','primary'),'compiler_version','grammar-runtime-compiler-v1','compile_hash',v_hash,
    'runtime_manifest_id',m.id,'topic_id',m.topic_id,'execution_phase',m.execution_phase,'runtime_family',m.runtime_family,'branch_id',v_branch
   ));
 end loop;
 return jsonb_build_object('status','compiled','compiler_version','grammar-runtime-compiler-v1','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'outputs',v_outputs,'output_count',jsonb_array_length(v_outputs));
end;
$function$;

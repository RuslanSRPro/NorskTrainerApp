do $migration$
declare m record; gr record; outputs jsonb; triggers jsonb; base_pattern jsonb; enrichment jsonb; k text; branch text; role text;
begin
 for m in select * from public.grammar_runtime_manifests order by code loop
   outputs:='[]'::jsonb;
   for gr in select * from public.grammar_rules where runtime_manifest_id=m.id order by code loop
     base_pattern:=public.runtime_compiler_pattern_v1(m.ir_spec,gr.pattern_type,gr.pattern->>'branch_id');
     enrichment:=gr.pattern;
     for k in select key from jsonb_each(base_pattern) loop enrichment:=enrichment-k; end loop;
     select coalesce(jsonb_agg(jsonb_build_object(
       'execution_phase',t.execution_phase,'trigger_type',t.trigger_type,'trigger_key',t.trigger_key,
       'trigger_value',t.trigger_value,'priority',t.priority,'is_active',t.is_active
     ) order by t.priority,t.trigger_type,t.trigger_key),'[]'::jsonb) into triggers
     from public.grammar_rule_triggers t where t.rule_id=gr.id;
     branch:=gr.pattern->>'branch_id';
     role:=case when branch is not null then 'branch_'||branch when gr.pattern_type='feature_unification' then 'validation' else 'primary' end;
     outputs:=outputs||jsonb_build_array(jsonb_build_object(
       'pattern_type',gr.pattern_type,'rule_type',gr.rule_type,'code_override',gr.code,'compile_role',role,
       'branch_id',branch,'pattern_enrichment',enrichment,'triggers',triggers,'bootstrap_source','historical_compiled_rule'
     ));
   end loop;
   if jsonb_array_length(outputs)>0 then
     update public.grammar_runtime_compiler_plans_v1
     set status='deprecated'
     where manifest_id=m.id and compiler_contract='grammar-runtime-compiler-v1' and status='validated';
     insert into public.grammar_runtime_compiler_plans_v1(manifest_id,compiler_contract,plan_version,output_plan,status,notes)
     values(m.id,'grammar-runtime-compiler-v1','1.1',jsonb_build_object('outputs',outputs),'validated','Explicit historical output+trigger plan. Captures hidden compiler enrichment; does not mutate manifest semantics.');
   end if;
 end loop;
end;
$migration$;

create or replace function public.compile_grammar_runtime_manifest_v1(p_manifest_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare m record; v_plan jsonb; o jsonb; v_outputs jsonb:='[]'::jsonb; v_pattern_type text; v_rule_type text; v_suffix text; v_code text; v_branch text; v_pattern jsonb; v_actions jsonb; v_result jsonb; v_hash text; v_strategy text; v_targets jsonb; v_enrichment jsonb; v_triggers jsonb;
begin
 select * into m from public.grammar_runtime_manifests where id=p_manifest_id;
 if m.id is null then return jsonb_build_object('status','manifest_not_found','manifest_id',p_manifest_id); end if;
 if m.authoring_status<>'validated' then return jsonb_build_object('status','manifest_not_validated','manifest_id',m.id,'manifest_code',m.code); end if;
 v_strategy:=m.compiler->>'strategy'; v_targets:=coalesce(m.compiler->'target_rule_types','[]'::jsonb);
 select output_plan into v_plan from public.grammar_runtime_compiler_plans_v1 where manifest_id=m.id and compiler_contract='grammar-runtime-compiler-v1' and status='validated' order by plan_version desc,created_at desc limit 1;
 if v_plan is null and v_strategy='single_rule' then
   v_plan:=jsonb_build_object('outputs',jsonb_build_array(jsonb_build_object('pattern_type',v_targets->>0,'triggers','[]'::jsonb)));
 elsif v_plan is null then
   return jsonb_build_object('status','explicit_compiler_plan_required','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'target_rule_types',v_targets);
 end if;
 for o in select value from jsonb_array_elements(v_plan->'outputs') loop
   v_pattern_type:=o->>'pattern_type'; v_branch:=o->>'branch_id';
   v_rule_type:=coalesce(o->>'rule_type',public.runtime_compiler_rule_type_v1(v_pattern_type,jsonb_build_object('actions',m.actions)));
   v_suffix:=o->>'code_suffix';
   v_code:=coalesce(o->>'code_override',public.runtime_compiler_base_code_v1(m.code));
   if o->>'code_override' is null then
     if v_suffix is not null then v_code:=v_code||'.'||v_suffix;
     elsif v_pattern_type='candidate_constraint' and right(v_code,20)<>'candidate_constraint' then v_code:=v_code||'.candidate_constraint'; end if;
   end if;
   v_pattern:=public.runtime_compiler_pattern_v1(m.ir_spec,v_pattern_type,v_branch)||coalesce(o->'pattern_enrichment','{}'::jsonb);
   v_actions:=public.runtime_compiler_actions_v1(m.ir_spec,v_pattern_type,v_branch);
   v_result:=public.runtime_compiler_result_v1(to_jsonb(m),m.code);
   v_triggers:=coalesce(o->'triggers','[]'::jsonb);
   v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'result',v_result,'triggers',v_triggers)::text,'UTF8'),'sha256'::text),'hex');
   v_outputs:=v_outputs||jsonb_build_array(jsonb_build_object(
    'code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'parser_actions',v_actions,'result',v_result,
    'compile_role',coalesce(o->>'compile_role','primary'),'compiler_version','grammar-runtime-compiler-v1','compile_hash',v_hash,
    'runtime_manifest_id',m.id,'topic_id',m.topic_id,'execution_phase',m.execution_phase,'runtime_family',m.runtime_family,'branch_id',v_branch,'triggers',v_triggers
   ));
 end loop;
 return jsonb_build_object('status','compiled','compiler_version','grammar-runtime-compiler-v1','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'outputs',v_outputs,'output_count',jsonb_array_length(v_outputs));
end;
$function$;

create or replace function public.materialize_grammar_runtime_manifest_v1(p_manifest_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path='public','pg_catalog'
as $function$
declare c jsonb; o jsonb; t jsonb; m record; v_rule_id uuid; v_ids jsonb:='[]'::jsonb; s record;
begin
 c:=public.compile_grammar_runtime_manifest_v1(p_manifest_id);
 if c->>'status'<>'compiled' then return c; end if;
 select * into m from public.grammar_runtime_manifests where id=p_manifest_id;
 if exists(select 1 from jsonb_array_elements(c->'outputs') x join public.grammar_rules gr on gr.code=x->>'code') then
   return jsonb_build_object('status','conflict_existing_rule_code','manifest_id',p_manifest_id,'manifest_code',m.code,'no_write',true);
 end if;
 for o in select value from jsonb_array_elements(c->'outputs') loop
   insert into public.grammar_rules(
     code,category,subcategory,name_no,name_en,name_ru,description,pattern,result,actions,explanations,priority,base_confidence,scope,rule_type,is_active,version,
     pattern_type,parser_actions,learning_explanation,diagnostics,examples,topic_id,runtime_manifest_id,compiler_version,compile_hash
   ) values (
     o->>'code',coalesce(o->>'runtime_family','runtime'),o->>'pattern_type',m.code,null,null,
     jsonb_build_object('compiled_from_manifest',m.code,'compiler_version','grammar-runtime-compiler-v1'),
     o->'pattern',o->'result',o->'actions',coalesce(m.explanation,'{}'::jsonb),100,1.0,'sentence',o->>'rule_type',false,1,
     o->>'pattern_type',o->'parser_actions',coalesce(m.explanation,'{}'::jsonb),'{}'::jsonb,'[]'::jsonb,m.topic_id,m.id,'grammar-runtime-compiler-v1',o->>'compile_hash'
   ) returning id into v_rule_id;
   for s in select ms.candidate_id,ms.source_role,c.source_section from public.grammar_runtime_manifest_sources ms join public.grammar_knowledge_candidates c on c.id=ms.candidate_id where ms.manifest_id=m.id loop
     insert into public.grammar_rule_sources(grammar_rule_id,candidate_id,source_section,verification_status,is_primary_source,verified_at,verified_by,notes)
     values(v_rule_id,s.candidate_id,s.source_section,'source_verified',s.source_role='primary',now(),'grammar-runtime-compiler-v1','Materialized from validated manifest source provenance.');
   end loop;
   for t in select value from jsonb_array_elements(coalesce(o->'triggers','[]'::jsonb)) loop
     insert into public.grammar_rule_triggers(rule_id,execution_phase,trigger_type,trigger_key,trigger_value,priority,is_active)
     values(v_rule_id,t->>'execution_phase',t->>'trigger_type',t->>'trigger_key',coalesce(t->'trigger_value','{}'::jsonb),coalesce((t->>'priority')::int,100),coalesce((t->>'is_active')::boolean,true));
   end loop;
   v_ids:=v_ids||jsonb_build_array(jsonb_build_object('rule_id',v_rule_id,'rule_code',o->>'code'));
 end loop;
 return jsonb_build_object('status','materialized','manifest_id',m.id,'manifest_code',m.code,'rules',v_ids,'global_activation',false);
end;
$function$;
revoke all on function public.materialize_grammar_runtime_manifest_v1(uuid) from public,anon,authenticated;
grant execute on function public.materialize_grammar_runtime_manifest_v1(uuid) to postgres;

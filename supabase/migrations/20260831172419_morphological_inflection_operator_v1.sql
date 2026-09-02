create or replace function public.validate_grammar_rule_pattern_v2(p_pattern_type text, p_pattern jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path='public','pg_catalog'
as $$
begin
  if p_pattern_type <> 'morphological_inflection' then
    return public.validate_grammar_rule_pattern(p_pattern_type,p_pattern);
  end if;
  return p_pattern is not null
    and jsonb_typeof(p_pattern)='object'
    and nullif(trim(p_pattern->>'morph_operation'),'') is not null
    and nullif(trim(p_pattern->>'source_form_key'),'') is not null
    and nullif(trim(p_pattern->>'target_form_key'),'') is not null
    and (not (p_pattern ? 'source_endings') or jsonb_typeof(p_pattern->'source_endings')='array')
    and (not (p_pattern ? 'suffix') or jsonb_typeof(p_pattern->'suffix')='string');
end;
$$;

alter table public.grammar_rules drop constraint if exists grammar_rules_pattern_type_check;
alter table public.grammar_rules add constraint grammar_rules_pattern_type_check check (
  pattern_type = any(array[
    'token_sequence','clause_sequence','dependency_sequence','candidate_constraint','feature_unification','relative_order','graph_pattern','phrase_pattern','clause_pattern','dependency_pattern','interpretation_rule','morphological_inflection'
  ]::text[])
);
alter table public.grammar_rules drop constraint if exists grammar_rules_valid_pattern_check;
alter table public.grammar_rules add constraint grammar_rules_valid_pattern_check check (public.validate_grammar_rule_pattern_v2(pattern_type,pattern));

create or replace function public.runtime_pattern_operator_registry_v3()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
select public.runtime_pattern_operator_registry_v2() || jsonb_build_object(
  'version','runtime-pattern-operator-registry-v3',
  'operators',(public.runtime_pattern_operator_registry_v2()->'operators') || jsonb_build_array(
    jsonb_build_object(
      'pattern_type','morphological_inflection',
      'status','executable',
      'operator','morphological-inflection-operator-v1',
      'requires',jsonb_build_array('source_verified lexeme form pair'),
      'productive_generation',false,
      'unknown_lexeme_policy','no_evidence'
    )
  )
);
$$;

create or replace function public.runtime_compiler_rule_type_v2(p_pattern_type text, p_manifest jsonb)
returns text
language sql
immutable
security invoker
set search_path='public','pg_catalog'
as $$
select case when p_pattern_type='morphological_inflection' then 'morphology'
            else public.runtime_compiler_rule_type_v1(p_pattern_type,p_manifest) end;
$$;

create or replace function public.compile_grammar_runtime_manifest_v2(p_manifest_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare m record; v_plan jsonb; o jsonb; v_outputs jsonb:='[]'::jsonb; v_pattern_type text; v_rule_type text; v_suffix text; v_code text; v_branch text; v_pattern jsonb; v_actions jsonb; v_result jsonb; v_hash text; v_strategy text; v_targets jsonb; v_triggers jsonb;
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
   v_rule_type:=coalesce(o->>'rule_type',public.runtime_compiler_rule_type_v2(v_pattern_type,jsonb_build_object('actions',m.actions)));
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
   v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'result',v_result,'triggers',v_triggers)::text,'UTF8'),'sha256'),'hex');
   v_outputs:=v_outputs||jsonb_build_array(jsonb_build_object(
    'code',v_code,'pattern_type',v_pattern_type,'rule_type',v_rule_type,'pattern',v_pattern,'actions',v_actions,'parser_actions',v_actions,'result',v_result,
    'compile_role',coalesce(o->>'compile_role','primary'),'compiler_version','grammar-runtime-compiler-v2','compile_hash',v_hash,
    'runtime_manifest_id',m.id,'topic_id',m.topic_id,'execution_phase',m.execution_phase,'runtime_family',m.runtime_family,'branch_id',v_branch,'triggers',v_triggers
   ));
 end loop;
 return jsonb_build_object('status','compiled','compiler_version','grammar-runtime-compiler-v2','manifest_id',m.id,'manifest_code',m.code,'strategy',v_strategy,'outputs',v_outputs,'output_count',jsonb_array_length(v_outputs));
end;
$$;

create or replace function public.materialize_grammar_runtime_manifest_v2(p_manifest_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $$
declare c jsonb; o jsonb; t jsonb; m record; v_rule_id uuid; v_ids jsonb:='[]'::jsonb; s record;
begin
 c:=public.compile_grammar_runtime_manifest_v2(p_manifest_id);
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
     jsonb_build_object('compiled_from_manifest',m.code,'compiler_version','grammar-runtime-compiler-v2'),
     o->'pattern',o->'result',o->'actions',coalesce(m.explanation,'{}'::jsonb),100,1.0,'token',o->>'rule_type',false,1,
     o->>'pattern_type',o->'parser_actions',coalesce(m.explanation,'{}'::jsonb),'{}'::jsonb,'[]'::jsonb,m.topic_id,m.id,'grammar-runtime-compiler-v2',o->>'compile_hash'
   ) returning id into v_rule_id;
   for s in select ms.candidate_id,ms.source_role,k.source_id,k.source_section,k.source_pdf_page_from,k.source_pdf_page_to,k.source_printed_page_from,k.source_printed_page_to,k.source_excerpt
            from public.grammar_runtime_manifest_sources ms join public.grammar_knowledge_candidates k on k.id=ms.candidate_id where ms.manifest_id=m.id loop
     insert into public.grammar_rule_sources(grammar_rule_id,source_id,candidate_id,source_section,source_pdf_page_from,source_pdf_page_to,source_printed_page_from,source_printed_page_to,source_excerpt,verification_status,is_primary_source,verified_at,verified_by,notes)
     values(v_rule_id,s.source_id,s.candidate_id,s.source_section,s.source_pdf_page_from,s.source_pdf_page_to,s.source_printed_page_from,s.source_printed_page_to,s.source_excerpt,'source_verified',s.source_role='primary',now(),'grammar-runtime-compiler-v2','Materialized from validated manifest source provenance.');
   end loop;
   for t in select value from jsonb_array_elements(coalesce(o->'triggers','[]'::jsonb)) loop
     insert into public.grammar_rule_triggers(rule_id,execution_phase,trigger_type,trigger_key,trigger_value,priority,is_active)
     values(v_rule_id,t->>'execution_phase',t->>'trigger_type',t->>'trigger_key',coalesce(t->'trigger_value','{}'::jsonb),coalesce((t->>'priority')::int,100),coalesce((t->>'is_active')::boolean,true));
   end loop;
   v_ids:=v_ids||jsonb_build_array(jsonb_build_object('rule_id',v_rule_id,'rule_code',o->>'code'));
 end loop;
 return jsonb_build_object('status','materialized','compiler_version','grammar-runtime-compiler-v2','manifest_id',m.id,'manifest_code',m.code,'rules',v_ids,'global_activation',false);
end;
$$;

create or replace function public.execute_morphological_inflection_rule_v1(p_rule_id uuid, p_lexeme_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare r record; l record; src text; tgt text; op text; source_key text; target_key text; suffix text; endings jsonb; expected text; ok boolean:=false; matched_ending text;
begin
 select * into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found'); end if;
 if r.pattern_type<>'morphological_inflection' then return jsonb_build_object('status','wrong_pattern_type','pattern_type',r.pattern_type); end if;
 select * into l from public.lexemes where id=p_lexeme_id and pos='adjective';
 if l.id is null then return jsonb_build_object('status','no_evidence','reason','adjective_lexeme_not_found'); end if;
 source_key:=r.pattern->>'source_form_key'; target_key:=r.pattern->>'target_form_key'; op:=r.pattern->>'morph_operation'; suffix:=coalesce(r.pattern->>'suffix',''); endings:=coalesce(r.pattern->'source_endings','[]'::jsonb);
 select f.value into src from public.lexeme_form_variants f where f.lexeme_id=l.id and f.form_key=source_key and f.verification_status='source_verified' order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last,f.value limit 1;
 select f.value into tgt from public.lexeme_form_variants f where f.lexeme_id=l.id and f.form_key=target_key and f.verification_status='source_verified' order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last,f.value limit 1;
 if src is null or tgt is null then return jsonb_build_object('status','no_evidence','reason','source_verified_form_pair_missing','lemma',l.lemma,'source_form',src,'target_form',tgt); end if;
 if op='delete_penultimate_e_then_suffix' then
   select value #>> '{}' into matched_ending from jsonb_array_elements(endings) where src like '%'||(value #>> '{}') order by length(value #>> '{}') desc limit 1;
   if matched_ending is not null and matched_ending in ('el','en','er') then expected:=left(src,length(src)-2)||right(matched_ending,1)||suffix; ok:=expected=tgt; end if;
 elsif op='double_final_m_then_suffix_e' then
   expected:=src||'me'; ok=right(src,1)='m' and expected=tgt;
 elsif op='append_tt_to_final_vowel' then
   expected:=src||'tt'; ok=src ~ '[aeiouyæøå]$' and expected=tgt;
 else
   return jsonb_build_object('status','unsupported_operation','operation',op);
 end if;
 return jsonb_build_object('version','morphological-inflection-operator-v1','status',case when ok then 'matched' else 'no_match' end,'rule_code',r.code,'lemma',l.lemma,'source_form_key',source_key,'source_form',src,'target_form_key',target_key,'target_form',tgt,'expected_target',expected,'source_verified_pair',true,'productive_generation',false,'matched',ok);
end;
$$;

create or replace function public.assess_runtime_rule_execution_v5(p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare r record; base jsonb;
begin
 select * into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 base:=public.assess_runtime_rule_execution_v4(p_rule_id);
 if r.pattern_type='morphological_inflection' then
   return base||jsonb_build_object('version','runtime-rule-execution-assessment-v5','execution_status','executable_via_morphological_inflection_operator_v1','ready_without_runtime_code_change',true,'upstream_blockers','[]'::jsonb,'upstream_closure','morphological-inflection-operator-v1');
 end if;
 return base||jsonb_build_object('version','runtime-rule-execution-assessment-v5');
end;
$$;

create or replace function public.run_morphological_inflection_operator_golden_v1(p_release_code text default 'runtime-structural-v1.25')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare tests jsonb; inh jsonb; reg jsonb;
begin
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.24');
 reg:=public.runtime_pattern_operator_registry_v3();
 tests:=jsonb_build_array(
  jsonb_build_object('code','registry.has_morphological_inflection','passed',exists(select 1 from jsonb_array_elements(reg->'operators') x where x->>'pattern_type'='morphological_inflection' and x->>'status'='executable')),
  jsonb_build_object('code','validator.accepts_valid','passed',public.validate_grammar_rule_pattern_v2('morphological_inflection',jsonb_build_object('morph_operation','append_tt_to_final_vowel','source_form_key','positive_common','target_form_key','positive_neuter','suffix','tt'))),
  jsonb_build_object('code','validator.rejects_missing_operation','passed',not public.validate_grammar_rule_pattern_v2('morphological_inflection',jsonb_build_object('source_form_key','positive_common','target_form_key','positive_neuter'))),
  jsonb_build_object('code','compiler.rule_type_morphology','passed',public.runtime_compiler_rule_type_v2('morphological_inflection','{}'::jsonb)='morphology'),
  jsonb_build_object('code','inheritance.exact_parent','passed',coalesce((inh->>'valid')::boolean,false)),
  jsonb_build_object('code','child.extra_rules.zero','passed',coalesce((inh->>'extra_child_rules')::int,-1)=0),
  jsonb_build_object('code','active_nrg.zero','passed',(select count(*)=0 from public.grammar_rules where is_active and code like 'nrg_rt_v1.%')),
  jsonb_build_object('code','productive_generation.false','passed',(select (x->>'productive_generation')::boolean=false from jsonb_array_elements(reg->'operators') x where x->>'pattern_type'='morphological_inflection'))
 );
 return jsonb_build_object('version','morphological-inflection-operator-golden-v1','release_code',p_release_code,'total',jsonb_array_length(tests),'passed',(select count(*) from jsonb_array_elements(tests) x where (x->>'passed')::boolean),'failed',(select count(*) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean),'tests',tests);
end;
$$;

create or replace function public.rule_action_operator_registry_v1()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object(
 'version','rule-action-operator-registry-v1',
 'condition_policy','action when/condition is evaluated by the family matcher; action executor never silently ignores an unknown action',
 'operators',jsonb_build_array(
  jsonb_build_object('action','add_candidate_score','kind','scalar','status','registered','effect','score_delta_plus'),
  jsonb_build_object('action','subtract_candidate_score','kind','scalar','status','registered','effect','score_delta_minus'),
  jsonb_build_object('action','protect_candidate','kind','scalar','status','registered','effect','protected_true'),
  jsonb_build_object('action','add_interpretation','kind','scalar','status','registered','effect','append_interpretation'),
  jsonb_build_object('action','add_trace','kind','scalar','status','registered','effect','append_trace'),
  jsonb_build_object('action','emit_diagnostic','kind','scalar','status','registered','effect','append_diagnostic'),
  jsonb_build_object('action','create_phrase','kind','structural','status','registered','operator_family','phrase'),
  jsonb_build_object('action','set_head','kind','structural','status','registered','operator_family','phrase'),
  jsonb_build_object('action','create_dependency','kind','structural','status','registered','operator_family','dependency'),
  jsonb_build_object('action','create_clause','kind','structural','status','registered','operator_family','clause'),
  jsonb_build_object('action','set_role','kind','structural','status','registered','operator_family','graph_role')
 ),
 'unknown_action_policy','explicit_unsupported'
);
$function$;

create or replace function public.execute_scalar_rule_actions_v1(p_actions jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
 v_action jsonb; v_name text; v_score int:=0; v_protected boolean:=false;
 v_interpretations jsonb:='[]'::jsonb; v_traces jsonb:='[]'::jsonb; v_diagnostics jsonb:='[]'::jsonb;
 v_structural jsonb:='[]'::jsonb; v_unsupported jsonb:='[]'::jsonb; v_events jsonb:='[]'::jsonb;
begin
 for v_action in select value from jsonb_array_elements(coalesce(p_actions,'[]'::jsonb)) loop
  v_name:=v_action->>'action';
  case v_name
   when 'add_candidate_score' then v_score:=v_score+coalesce((v_action->>'delta')::int,0);
   when 'subtract_candidate_score' then v_score:=v_score-coalesce((v_action->>'delta')::int,0);
   when 'protect_candidate' then v_protected:=true;
   when 'add_interpretation' then v_interpretations:=v_interpretations||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('value',v_action->'value','target',v_action->>'target','reason_code',v_action->>'reason_code')));
   when 'add_trace' then v_traces:=v_traces||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('value',v_action->'value','target',v_action->>'target','reason_code',v_action->>'reason_code')));
   when 'emit_diagnostic' then v_diagnostics:=v_diagnostics||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('value',v_action->'value','target',v_action->>'target','severity',v_action->>'severity','reason_code',v_action->>'reason_code')));
   when 'create_phrase','set_head','create_dependency','create_clause','set_role' then v_structural:=v_structural||jsonb_build_array(v_action);
   else v_unsupported:=v_unsupported||jsonb_build_array(jsonb_build_object('action',v_name,'input',v_action));
  end case;
  v_events:=v_events||jsonb_build_array(jsonb_build_object('action',v_name,'supported',v_name in ('add_candidate_score','subtract_candidate_score','protect_candidate','add_interpretation','add_trace','emit_diagnostic','create_phrase','set_head','create_dependency','create_clause','set_role')));
 end loop;
 return jsonb_build_object('version','scalar-rule-actions-v1','score_delta',v_score,'protected',v_protected,'interpretations',v_interpretations,'traces',v_traces,'diagnostics',v_diagnostics,'structural_actions',v_structural,'unsupported_actions',v_unsupported,'events',v_events,'fully_supported',jsonb_array_length(v_unsupported)=0);
end;
$function$;

create or replace function public.phrase_operator_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object(
 'version','phrase-operator-contract-v1',
 'operators',jsonb_build_array(
  jsonb_build_object('build_strategy','head_only','phrase_types',jsonb_build_array('AP'),'required_actions',jsonb_build_array('create_phrase','set_head'),'required_pattern_fields',jsonb_build_array('phrase_type','head_ref')),
  jsonb_build_object('build_strategy','head_plus_left_dependents','phrase_types',jsonb_build_array('NP'),'required_actions',jsonb_build_array('create_phrase','set_head'),'required_pattern_fields',jsonb_build_array('phrase_type','head_ref','max_left_tokens','allowed_left_dependents')),
  jsonb_build_object('build_strategy','finite_head_plus_following_nonfinite','phrase_types',jsonb_build_array('VP'),'required_actions',jsonb_build_array('create_phrase','set_head'),'required_pattern_fields',jsonb_build_array('phrase_type','head_ref','max_gap'))
 ),
 'extension_policy','new build strategy requires a new registered operator and golden cases; existing operators are immutable'
);
$function$;

create or replace function public.validate_phrase_rule_operator_v1(p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_op jsonb; v_actions jsonb; v_unknown jsonb; v_registered boolean:=false; v_fields_ok boolean:=true; v_field text;
begin
 select id,code,pattern_type,pattern,actions into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','not_found','rule_id',p_rule_id); end if;
 if r.pattern_type<>'phrase_pattern' then return jsonb_build_object('status','wrong_pattern_type','rule_id',p_rule_id,'pattern_type',r.pattern_type); end if;
 select value into v_op from jsonb_array_elements(public.phrase_operator_contract_v1()->'operators') where value->>'build_strategy'=r.pattern->>'build_strategy' limit 1;
 v_registered:=v_op is not null;
 select coalesce(jsonb_agg(distinct a->>'action' order by a->>'action'),'[]'::jsonb) into v_actions from jsonb_array_elements(coalesce(r.actions,'[]'::jsonb)) a;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_unknown from jsonb_array_elements_text(v_actions) x where x not in ('create_phrase','set_head');
 if v_registered then
  for v_field in select value from jsonb_array_elements_text(v_op->'required_pattern_fields') loop
   if not (r.pattern ? v_field) then v_fields_ok:=false; end if;
  end loop;
 else v_fields_ok:=false; end if;
 return jsonb_build_object('version','phrase-operator-validation-v1','rule_id',r.id,'rule_code',r.code,'build_strategy',r.pattern->>'build_strategy','phrase_type',r.pattern->>'phrase_type','registered_operator',v_registered,'declared_actions',v_actions,'unsupported_actions',v_unknown,'required_fields_present',v_fields_ok,'valid',v_registered and v_fields_ok and jsonb_array_length(v_unknown)=0);
end;
$function$;

create or replace function public.execute_candidate_constraint_rule_v2(p_sentence jsonb,p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_trigger_keys jsonb:='[]'::jsonb; v_token jsonb; v_reading jsonb; v_effects jsonb; v_matches jsonb:='[]'::jsonb; v_class text; v_match boolean;
begin
 select id,code,pattern_type,pattern,actions,compiler_version,compile_hash into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','not_found','rule_id',p_rule_id); end if;
 if r.pattern_type<>'candidate_constraint' then return jsonb_build_object('status','wrong_pattern_type','rule_id',p_rule_id,'pattern_type',r.pattern_type); end if;
 select coalesce(jsonb_agg(distinct t.trigger_key order by t.trigger_key),'[]'::jsonb) into v_trigger_keys from public.grammar_rule_triggers t where t.rule_id=r.id and t.is_active and t.trigger_type='lexical_class';
 v_effects:=public.execute_scalar_rule_actions_v1(r.actions);
 for v_token in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,tokens}','[]'::jsonb)) loop
  for v_reading in select value from jsonb_array_elements(coalesce(v_token->'grammar_readings','[]'::jsonb)) loop
   v_match:=false;
   for v_class in select value from jsonb_array_elements_text(coalesce(v_reading->'lexical_classes','[]'::jsonb)) loop
    if v_trigger_keys ? v_class then v_match:=true; exit; end if;
   end loop;
   if v_match then
    v_matches:=v_matches||jsonb_build_array(jsonb_build_object(
     'rule_id',r.id,'rule_code',r.code,'token_index',(v_token->>'token_index')::int,'surface',v_token->>'surface','reading_id',v_reading->>'reading_id','lexical_classes',v_reading->'lexical_classes',
     'effects',v_effects,
     'canonical_score_delta',coalesce((v_reading->>'grammar_score')::int,0),
     'canonical_protected',coalesce((v_reading->>'protected')::boolean,false),
     'score_parity',coalesce((v_reading->>'grammar_score')::int,0)=coalesce((v_effects->>'score_delta')::int,0),
     'protected_parity',coalesce((v_reading->>'protected')::boolean,false)=coalesce((v_effects->>'protected')::boolean,false)
    ));
   end if;
  end loop;
 end loop;
 return jsonb_build_object('version','candidate-constraint-executor-v2','status','executed','rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,'trigger_keys',v_trigger_keys,'matches',v_matches,'match_count',jsonb_array_length(v_matches),'actions_fully_supported',(v_effects->>'fully_supported')::boolean,'trace_action_materialized',jsonb_array_length(v_effects->'traces')>0,'compiler_version',r.compiler_version,'compile_hash',r.compile_hash);
end;
$function$;

create or replace function public.dependency_ir_adapter_contract_v2()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object(
 'version','dependency-ir-adapter-v2',
 'input_model','compiled dependency_pattern IR v1',
 'target_model','Clause Build V1 + Predicate Build V1 + Dependency Build V2 entities',
 'field_adapters',jsonb_build_array(
  jsonb_build_object('legacy_ref','clause.type','v2_ref','clause.clause_type'),
  jsonb_build_object('legacy_ref','clause.predicate_phrase_id','v2_ref','clause.predicate_id','entity_upgrade','phrase->predicate'),
  jsonb_build_object('legacy_ref','clause.subject_token_index','v2_ref','clause.subject_token_index')
 ),
 'hardcoded_rule_codes',jsonb_build_array(),
 'unknown_binding_policy','explicit_unsupported'
);
$function$;

create or replace function public.execute_dependency_pattern_rule_v2(p_sentence jsonb,p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_relation text; v_action jsonb; v_effects jsonb; v_clause jsonb; v_pred jsonb; v_tok jsonb; v_edges jsonb:='[]'::jsonb; v_adapters jsonb:='[]'::jsonb;
 v_source_ref text; v_target_ref text; v_source_spec jsonb; v_target_spec jsonb; v_source_idx int; v_target_id text; v_source_surface text; v_target_surface text; v_canonical boolean;
begin
 select id,code,pattern_type,pattern,actions,compiler_version,compile_hash into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','not_found','rule_id',p_rule_id); end if;
 if r.pattern_type<>'dependency_pattern' then return jsonb_build_object('status','wrong_pattern_type','rule_id',p_rule_id,'pattern_type',r.pattern_type); end if;
 v_source_ref:=r.pattern->>'source_ref'; v_target_ref:=r.pattern->>'target_ref';
 v_source_spec:=r.pattern#>array['bindings',v_source_ref]; v_target_spec:=r.pattern#>array['bindings',v_target_ref];
 select value into v_action from jsonb_array_elements(coalesce(r.actions,'[]'::jsonb)) where value->>'action'='create_dependency' limit 1;
 v_relation:=coalesce(v_action->>'relation',r.pattern->>'relation');
 v_effects:=public.execute_scalar_rule_actions_v1(r.actions);
 for v_clause in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb)) where value->>'status'='resolved' loop
  if coalesce(r.pattern#>>'{bindings,clause,where,right}','finite')='finite' and v_clause->>'clause_type'<>'finite' then continue; end if;
  v_source_idx:=null; v_target_id:=null; v_source_surface:=null; v_target_surface:=null; v_pred:=null; v_tok:=null;
  if v_source_spec->>'entity'='token' and (v_source_spec::text like '%clause.subject_token_index%') then
   v_source_idx:=nullif(v_clause->>'subject_token_index','')::int;
   select value into v_tok from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,tokens}','[]'::jsonb)) where (value->>'token_index')::int=v_source_idx limit 1;
   v_source_surface:=v_tok->>'surface';
   v_adapters:=v_adapters||jsonb_build_array(jsonb_build_object('binding',v_source_ref,'legacy_ref','clause.subject_token_index','v2_ref','clause.subject_token_index','status','adapted'));
  end if;
  if v_target_spec->>'entity' in ('phrase','predicate') and ((v_target_spec::text like '%clause.predicate_phrase_id%') or (v_target_spec::text like '%clause.predicate_id%')) then
   v_target_id:=v_clause->>'predicate_id';
   select value into v_pred from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,predicate_build_v1,predicates}','[]'::jsonb)) where value->>'id'=v_target_id limit 1;
   v_target_surface:=v_pred->>'surface';
   v_adapters:=v_adapters||jsonb_build_array(jsonb_build_object('binding',v_target_ref,'legacy_ref',case when v_target_spec::text like '%predicate_phrase_id%' then 'clause.predicate_phrase_id' else 'clause.predicate_id' end,'v2_ref','clause.predicate_id','entity_upgrade',case when v_target_spec->>'entity'='phrase' then 'phrase->predicate' else 'none' end,'status','adapted'));
  end if;
  if v_source_idx is null or v_target_id is null then continue; end if;
  select exists(select 1 from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) d where d->>'relation'=v_relation and nullif(d->>'source_token_index','')::int=v_source_idx and d->>'target_id'=v_target_id) into v_canonical;
  v_edges:=v_edges||jsonb_build_array(jsonb_build_object('id','rexec:dep:'||v_relation||':t'||v_source_idx||':'||v_target_id,'status','resolved','relation',v_relation,'source_entity','token','source_token_index',v_source_idx,'source_surface',v_source_surface,'target_entity','predicate','target_id',v_target_id,'target_surface',v_target_surface,'clause_id',v_clause->>'id','rule_id',r.id,'rule_code',r.code,'reason_code',v_action->>'reason_code','trace_events',v_effects->'traces','canonical_v2_parity',v_canonical));
 end loop;
 return jsonb_build_object('version','dependency-pattern-executor-v2','status','executed','rule_id',r.id,'rule_code',r.code,'relation',v_relation,'source_ref',v_source_ref,'target_ref',v_target_ref,'dependencies',v_edges,'dependency_count',jsonb_array_length(v_edges),'adapter_events',v_adapters,'actions_fully_supported',(v_effects->>'fully_supported')::boolean,'trace_action_materialized',jsonb_array_length(v_effects->'traces')>0,'hardcoded_rule_code',false,'compiler_version',r.compiler_version,'compile_hash',r.compile_hash);
end;
$function$;

create or replace function public.runtime_release_rule_membership_hash_v1(p_release_code text)
returns text
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select md5(coalesce(string_agg(rr.rule_id::text||':'||rr.manifest_id::text||':'||rr.compiled_hash||':'||rr.is_enabled::text,'|' order by rr.rule_id::text),'') )
from public.grammar_runtime_releases r left join public.grammar_runtime_release_rules rr on rr.release_id=r.id where r.code=p_release_code group by r.id;
$function$;

create or replace function public.runtime_child_release_inheritance_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object('version','runtime-child-release-v1','inherits',jsonb_build_array('parent metadata snapshot','release rule membership','manifest references','compiled hashes','enabled flags','IR/compiler versions'),'overrides',jsonb_build_array('code','engine_version','status','purpose','next_layer','child-specific metadata'),'verification',jsonb_build_array('parent_metadata_hash','parent_rule_membership_hash','child_only_rule_count'),'failure_policy','child must not enter golden/shadow if inheritance validation fails');
$function$;

create or replace function public.create_runtime_child_release_v1(p_parent_code text,p_child_code text,p_engine_version text,p_purpose text,p_next_layer text,p_metadata_overrides jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path='public','pg_catalog'
as $function$
declare p record; v_id uuid; v_meta jsonb; v_parent_meta_hash text; v_parent_rule_hash text; v_rule_count int; v_manifest_count int;
begin
 select * into p from public.grammar_runtime_releases where code=p_parent_code;
 if p.id is null then raise exception 'Parent release % not found',p_parent_code; end if;
 if p.status<>'shadow' then raise exception 'Parent release % must be shadow, got %',p_parent_code,p.status; end if;
 if exists(select 1 from public.grammar_runtime_releases where code=p_child_code) then raise exception 'Child release % already exists',p_child_code; end if;
 v_parent_meta_hash:=md5(p.metadata::text); v_parent_rule_hash:=public.runtime_release_rule_membership_hash_v1(p_parent_code);
 v_meta:=p.metadata||coalesce(p_metadata_overrides,'{}'::jsonb)||jsonb_build_object('purpose',p_purpose,'next_layer',p_next_layer,'parent_release',p_parent_code,'release_inheritance_contract','runtime-child-release-v1','inheritance',jsonb_build_object('parent_metadata_hash',v_parent_meta_hash,'parent_rule_membership_hash',v_parent_rule_hash,'metadata_mode','parent_snapshot_plus_overrides','rule_membership_mode','exact_copy'));
 insert into public.grammar_runtime_releases(code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,manifest_count,rule_count,checksum,metadata)
 values(p_child_code,p.ir_version,p.compiler_version,p_engine_version,p.lexical_snapshot,p.external_parser_version,'build',p.manifest_count,p.rule_count,md5(coalesce(p.checksum,'')||'|'||p_child_code||'|'||p_engine_version||'|'||v_meta::text),v_meta) returning id into v_id;
 insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
 select v_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata from public.grammar_runtime_release_rules where release_id=p.id;
 select count(*)::int,count(distinct manifest_id)::int into v_rule_count,v_manifest_count from public.grammar_runtime_release_rules where release_id=v_id;
 update public.grammar_runtime_releases set rule_count=v_rule_count,manifest_count=v_manifest_count,metadata=metadata||jsonb_build_object('child_only_rules',0,'rules_active',false) where id=v_id;
 return v_id;
end;
$function$;
revoke all on function public.create_runtime_child_release_v1(text,text,text,text,text,jsonb) from public;
revoke all on function public.create_runtime_child_release_v1(text,text,text,text,text,jsonb) from anon,authenticated;
grant execute on function public.create_runtime_child_release_v1(text,text,text,text,text,jsonb) to postgres;

create or replace function public.validate_runtime_child_release_inheritance_v1(p_child_code text,p_parent_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare c record; p record; v_parent_meta_hash text; v_parent_rule_hash text; v_missing int; v_extra int; v_hash_match boolean;
begin
 select * into c from public.grammar_runtime_releases where code=p_child_code; select * into p from public.grammar_runtime_releases where code=p_parent_code;
 if c.id is null or p.id is null then return jsonb_build_object('status','release_not_found','child',p_child_code,'parent',p_parent_code); end if;
 v_parent_meta_hash:=md5(p.metadata::text); v_parent_rule_hash:=public.runtime_release_rule_membership_hash_v1(p_parent_code);
 select count(*) into v_missing from public.grammar_runtime_release_rules pr where pr.release_id=p.id and not exists(select 1 from public.grammar_runtime_release_rules cr where cr.release_id=c.id and cr.rule_id=pr.rule_id and cr.manifest_id=pr.manifest_id and cr.compiled_hash=pr.compiled_hash and cr.is_enabled=pr.is_enabled);
 select count(*) into v_extra from public.grammar_runtime_release_rules cr where cr.release_id=c.id and not exists(select 1 from public.grammar_runtime_release_rules pr where pr.release_id=p.id and pr.rule_id=cr.rule_id);
 v_hash_match:=coalesce(c.metadata#>>'{inheritance,parent_metadata_hash}','')=v_parent_meta_hash and coalesce(c.metadata#>>'{inheritance,parent_rule_membership_hash}','')=v_parent_rule_hash;
 return jsonb_build_object('version','runtime-child-release-inheritance-validation-v1','status',case when v_missing=0 and v_extra=0 and v_hash_match then 'pass' else 'fail' end,'child',p_child_code,'parent',p_parent_code,'missing_parent_rules',v_missing,'extra_child_rules',v_extra,'parent_metadata_hash_match',coalesce(c.metadata#>>'{inheritance,parent_metadata_hash}','')=v_parent_meta_hash,'parent_rule_membership_hash_match',coalesce(c.metadata#>>'{inheritance,parent_rule_membership_hash}','')=v_parent_rule_hash,'exact_rule_membership',v_missing=0 and v_extra=0,'valid',v_missing=0 and v_extra=0 and v_hash_match);
end;
$function$;

create or replace function public.build_rule_execution_plane_v1(p_sentence jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_release_id uuid; r record; v_candidates jsonb:='[]'::jsonb; v_phrases jsonb:='[]'::jsonb; v_deps jsonb:='[]'::jsonb; v_x jsonb; v_candidate_ok boolean:=true; v_phrase_ok boolean:=true; v_dep_ok boolean:=true;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code; if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
 for r in select gr.id,gr.pattern_type from public.grammar_runtime_release_rules rr join public.grammar_rules gr on gr.id=rr.rule_id where rr.release_id=v_release_id and rr.is_enabled and gr.pattern_type in ('candidate_constraint','phrase_pattern','dependency_pattern') order by gr.code loop
  if r.pattern_type='candidate_constraint' then v_x:=public.execute_candidate_constraint_rule_v2(p_sentence,r.id); v_candidates:=v_candidates||jsonb_build_array(v_x); if not coalesce((v_x->>'actions_fully_supported')::boolean,false) then v_candidate_ok:=false; end if;
  elsif r.pattern_type='phrase_pattern' then v_x:=public.validate_phrase_rule_operator_v1(r.id); v_phrases:=v_phrases||jsonb_build_array(v_x); if not coalesce((v_x->>'valid')::boolean,false) then v_phrase_ok:=false; end if;
  elsif r.pattern_type='dependency_pattern' then v_x:=public.execute_dependency_pattern_rule_v2(p_sentence,r.id); v_deps:=v_deps||jsonb_build_array(v_x); if not coalesce((v_x->>'actions_fully_supported')::boolean,false) or coalesce((v_x->>'hardcoded_rule_code')::boolean,true) then v_dep_ok:=false; end if;
  end if;
 end loop;
 return jsonb_build_object('version','rule-execution-plane-v1','status','ready','release_code',p_release_code,'candidate_constraint_executions',v_candidates,'phrase_operator_validations',v_phrases,'dependency_pattern_executions',v_deps,'summary',jsonb_build_object('candidate_constraint_closed',v_candidate_ok,'phrase_operator_contract_closed',v_phrase_ok,'dependency_adapter_closed',v_dep_ok,'pilot_families_closed',v_candidate_ok and v_phrase_ok and v_dep_ok,'representative_20_rule_suite_ready',v_candidate_ok and v_phrase_ok and v_dep_ok,'bulk_activation_ready',false));
end;
$function$;

create or replace function public.apply_rule_execution_plane_v1(p_doc jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_sentences jsonb:='[]'::jsonb; v_sentence jsonb; v_layer jsonb;
begin
 for v_sentence in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
  v_layer:=public.build_rule_execution_plane_v1(v_sentence,p_release_code);
  v_sentence:=jsonb_set(v_sentence,'{analysis,language_graph,rule_execution_plane_v1}',v_layer,true);
  v_sentences:=v_sentences||jsonb_build_array(v_sentence);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',v_sentences,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v18(p_text text,p_release_code text default 'runtime-structural-v1.18')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb;
begin
 v_doc:=public.analyze_text_structural_shadow_v17(p_text,p_release_code);
 v_doc:=public.apply_rule_execution_plane_v1(v_doc,p_release_code);
 return v_doc;
end;
$function$;

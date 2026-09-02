create or replace function public.run_rule_execution_pilot_golden_v1(p_release_code text default 'runtime-structural-v1.17')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_results jsonb:='[]'::jsonb; v_case jsonb; v_doc jsonb; v_p jsonb; v_rule jsonb; v_pass boolean; v_batch uuid:=gen_random_uuid();
begin
  for v_case in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('code','candidate_positive','text','Han går inn.','check','candidate_positive'),
    jsonb_build_object('code','candidate_generic_consumer','text','Han går inn.','check','candidate_generic'),
    jsonb_build_object('code','candidate_add_trace_gap','text','Han går inn.','check','candidate_gap'),
    jsonb_build_object('code','candidate_source_provenance','text','Han går inn.','check','candidate_source'),
    jsonb_build_object('code','candidate_negative','text','Han reiser.','check','candidate_negative'),
    jsonb_build_object('code','np_positive','text','Jeg ser en bil.','check','np_positive'),
    jsonb_build_object('code','np_family_dispatch','text','Jeg ser en bil.','check','np_dispatch'),
    jsonb_build_object('code','np_not_rule_hardcoded','text','Jeg ser en bil.','check','np_no_hardcode'),
    jsonb_build_object('code','np_source_provenance','text','Jeg ser en bil.','check','np_source'),
    jsonb_build_object('code','np_negative','text','Han reiser.','check','np_negative'),
    jsonb_build_object('code','dependency_positive_legacy','text','Han reiser.','check','dep_legacy'),
    jsonb_build_object('code','dependency_positive_v2','text','Han reiser.','check','dep_v2'),
    jsonb_build_object('code','dependency_hardcoded_bridge_detected','text','Han reiser.','check','dep_hardcoded'),
    jsonb_build_object('code','dependency_adapter_required','text','Han reiser.','check','dep_adapter'),
    jsonb_build_object('code','dependency_source_provenance','text','Han reiser.','check','dep_source'),
    jsonb_build_object('code','dependency_negative','text','Hei.','check','dep_negative'),
    jsonb_build_object('code','pilot_three_rules','text','Jeg ser en bil.','check','three_rules'),
    jsonb_build_object('code','bulk_activation_not_closed','text','Jeg ser en bil.','check','not_closed'),
    jsonb_build_object('code','release_inherits_rules','text','Han reiser.','check','release_rules'),
    jsonb_build_object('code','child_only_zero','text','Han reiser.','check','child_zero'),
    jsonb_build_object('code','global_active_zero','text','Han reiser.','check','active_zero'),
    jsonb_build_object('code','parent_canonical_immutable','text','Han vil kunne gå.','check','parent_immutable'),
    jsonb_build_object('code','multi_sentence_isolation','text','Han går inn. Jeg ser en bil.','check','multi'),
    jsonb_build_object('code','deterministic_audit','text','Han går inn.','check','deterministic')
  )) loop
    v_doc:=public.analyze_text_structural_shadow_v17(v_case->>'text',p_release_code);
    v_p:=v_doc#>'{document_graph,sentences,0,analysis,language_graph,rule_execution_pilot_v1}';
    v_pass:=case v_case->>'check'
      when 'candidate_positive' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='candidate_constraint' and coalesce((x->>'semantic_evidence_observed')::boolean,false))
      when 'candidate_generic' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='candidate_constraint' and x->>'architecture_status'='partial_generic' and x->>'consumer_function'='build_shadow_token_v1' and coalesce((x->>'consumer_reads_actions')::boolean,false) and not coalesce((x->>'consumer_hardcodes_rule_code')::boolean,true))
      when 'candidate_gap' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='candidate_constraint' and (x->'unsupported_by_generic_action_dispatch') @> '["add_trace"]'::jsonb)
      when 'candidate_source' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x cross join lateral jsonb_array_elements(x->'source_provenance') s where x->>'pattern_type'='candidate_constraint' and s->>'candidate_id'='0b977b51-87f6-4920-90e1-525346242256' and s->>'verification_status'='source_verified')
      when 'candidate_negative' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='candidate_constraint' and not coalesce((x->>'semantic_evidence_observed')::boolean,true))
      when 'np_positive' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='phrase_pattern' and coalesce((x->>'semantic_evidence_observed')::boolean,false) and jsonb_array_length(x->'canonical_evidence')>0)
      when 'np_dispatch' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='phrase_pattern' and x->>'architecture_status'='family_dispatch' and x->>'execution_mode'='family_pattern_dispatch')
      when 'np_no_hardcode' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='phrase_pattern' and not coalesce((x->>'consumer_hardcodes_rule_code')::boolean,true))
      when 'np_source' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x cross join lateral jsonb_array_elements(x->'source_provenance') s where x->>'pattern_type'='phrase_pattern' and s->>'candidate_id'='480ef100-7072-4c49-91d0-b846a836c691' and s->>'verification_status'='source_verified')
      when 'np_negative' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='phrase_pattern' and not coalesce((x->>'semantic_evidence_observed')::boolean,true))
      when 'dep_legacy' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='dependency_pattern' and jsonb_array_length(x->'canonical_evidence')>0)
      when 'dep_v2' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='dependency_pattern' and jsonb_array_length(x->'canonical_v2_equivalent_evidence')>0)
      when 'dep_hardcoded' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='dependency_pattern' and coalesce((x->>'consumer_hardcodes_rule_code')::boolean,false) and x->>'execution_mode'='legacy_rule_specific_bridge')
      when 'dep_adapter' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='dependency_pattern' and x->>'architecture_status'='adapter_required' and coalesce((x->>'schema_adapter_required')::boolean,false))
      when 'dep_source' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x cross join lateral jsonb_array_elements(x->'source_provenance') s where x->>'pattern_type'='dependency_pattern' and s->>'candidate_id'='21e73a5c-8a54-4d3a-98f7-52f2e9375512' and s->>'verification_status'='source_verified')
      when 'dep_negative' then exists(select 1 from jsonb_array_elements(v_p->'rule_audits') x where x->>'pattern_type'='dependency_pattern' and not coalesce((x->>'semantic_evidence_observed')::boolean,true))
      when 'three_rules' then (v_p#>>'{summary,pilot_rule_count}')::int=3 and jsonb_array_length(v_p->'rule_audits')=3
      when 'not_closed' then not coalesce((v_p#>>'{summary,architecture_closed_for_bulk_activation}')::boolean,true)
      when 'release_rules' then (select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code)=15
      when 'child_zero' then (select count(*) from public.grammar_runtime_release_rules c where c.release_id=(select id from public.grammar_runtime_releases where code=p_release_code) and not exists(select 1 from public.grammar_runtime_release_rules p where p.release_id=(select id from public.grammar_runtime_releases where code='runtime-structural-v1.16') and p.rule_id=c.rule_id))=0
      when 'active_zero' then (select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active)=0
      when 'parent_immutable' then (public.analyze_text_structural_shadow_v16(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph}')=(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph}','{}'::jsonb)-'rule_execution_pilot_v1')
      when 'multi' then jsonb_array_length(v_doc#>'{document_graph,sentences}')=2 and v_doc#>>'{document_graph,sentences,0,analysis,language_graph,rule_execution_pilot_v1,status}'='audited' and v_doc#>>'{document_graph,sentences,1,analysis,language_graph,rule_execution_pilot_v1,status}'='audited'
      when 'deterministic' then v_p=(public.analyze_text_structural_shadow_v17(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,rule_execution_pilot_v1}')
      else false end;
    v_results:=v_results||jsonb_build_array(jsonb_build_object('code',v_case->>'code','passed',v_pass));
  end loop;
  return jsonb_build_object('version','rule-execution-pilot-golden-v1','batch_id',v_batch,'total',jsonb_array_length(v_results),
    'passed',(select count(*) from jsonb_array_elements(v_results) x where (x->>'passed')::boolean),
    'failed',(select count(*) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),
    'failures',coalesce((select jsonb_agg(x) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),'[]'::jsonb));
end;
$function$;

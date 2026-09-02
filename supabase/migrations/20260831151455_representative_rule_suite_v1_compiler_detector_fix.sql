create or replace function public.audit_representative_rule_suite_v1(p_suite_code text default 'representative-rule-suite-v1')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_items jsonb:='[]'::jsonb; v_manifests jsonb; v_rules jsonb; v_compiled_count int:=0; v_closed_exec int:=0; v_nonclosed_compiled int:=0; v_source_only int:=0; v_missing_cap int:=0; v_reference int:=0; v_chapters int:=0; v_verified int:=0; v_total int:=0; v_compiler_procs int:=0; v_actual text;
begin
 select count(*),count(distinct chapter) into v_total,v_chapters from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code;
 select count(*) into v_compiler_procs
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname like 'compile_grammar_runtime_manifest%'
   and (p.prosrc ilike '%insert into public.grammar_rules%' or p.prosrc ilike '%insert into grammar_rules%');
 for r in
  select s.*,c.status source_status,c.source_section,c.title,c.extracted_payload
  from public.grammar_representative_rule_suite_v1 s join public.grammar_knowledge_candidates c on c.id=s.candidate_id
  where s.suite_code=p_suite_code order by s.ordinal
 loop
  if r.source_status in ('verified','source_verified') then v_verified:=v_verified+1; end if;
  select coalesce(jsonb_agg(jsonb_build_object('manifest_id',m.id,'manifest_code',m.code,'family',m.runtime_family,'phase',m.execution_phase,'authoring_status',m.authoring_status) order by m.code),'[]'::jsonb) into v_manifests
  from public.grammar_runtime_manifests m
  where m.primary_candidate_id=r.candidate_id or exists(select 1 from public.grammar_runtime_manifest_sources ms where ms.manifest_id=m.id and ms.candidate_id=r.candidate_id);
  select coalesce(jsonb_agg(jsonb_build_object('rule_id',gr.id,'rule_code',gr.code,'pattern_type',gr.pattern_type,'rule_type',gr.rule_type,'compiler_version',gr.compiler_version,'compile_hash',gr.compile_hash,'is_active',gr.is_active,'manifest_id',gr.runtime_manifest_id) order by gr.code),'[]'::jsonb) into v_rules
  from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id where gs.candidate_id=r.candidate_id;

  if jsonb_array_length(v_rules)>0 then
   v_compiled_count:=v_compiled_count+1;
   if exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern'))
      and not exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' not in ('candidate_constraint','phrase_pattern','dependency_pattern')) then
      v_actual:='compiled_execution_plane_closed'; v_closed_exec:=v_closed_exec+1;
   elsif exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern')) then
      v_actual:='compiled_mixed_closed_and_unclosed'; v_nonclosed_compiled:=v_nonclosed_compiled+1;
   else
      v_actual:='compiled_pattern_not_closed_in_execution_plane_v1'; v_nonclosed_compiled:=v_nonclosed_compiled+1;
   end if;
  elsif r.expected_current_state in ('source_consumed_but_not_compiled','source_consumed_partial_semantics','runtime_capability_exists_not_rule_driven','source_to_morphology_mapping_required') then
   v_actual:='source_or_runtime_capability_without_compiled_rule'; v_source_only:=v_source_only+1;
  elsif r.expected_current_state='reference_or_interpretive' then
   v_actual:='reference_or_interpretive_not_runtime_compiled'; v_reference:=v_reference+1;
  else
   v_actual:='named_generic_capability_missing'; v_missing_cap:=v_missing_cap+1;
  end if;

  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'ordinal',r.ordinal,'chapter',r.chapter,'candidate_id',r.candidate_id,'candidate_code',r.candidate_code,'title',r.title,'source_section',r.source_section,'source_status',r.source_status,
    'capability_family',r.capability_family,'architecture_probe',r.architecture_probe,'expected_current_state',r.expected_current_state,'actual_current_state',v_actual,
    'manifests',v_manifests,'compiled_rules',v_rules,
    'rule_execution_plane_v1_closed_pattern_present',exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' in ('candidate_constraint','phrase_pattern','dependency_pattern')),
    'unclosed_compiled_pattern_present',exists(select 1 from jsonb_array_elements(v_rules) x where x->>'pattern_type' not in ('candidate_constraint','phrase_pattern','dependency_pattern')),
    'requires_new_generic_capability',r.expected_current_state='new_generic_capability_required',
    'notes',r.notes
  ));
 end loop;
 return jsonb_build_object(
   'version','representative-rule-suite-v1','suite_code',p_suite_code,'status','audited','items',v_items,
   'summary',jsonb_build_object('sample_size',v_total,'chapters_covered',v_chapters,'source_verified_count',v_verified,'candidates_with_compiled_rules',v_compiled_count,'compiled_execution_plane_closed_count',v_closed_exec,'compiled_but_execution_plane_not_closed_count',v_nonclosed_compiled,'source_or_runtime_capability_without_compiled_rule_count',v_source_only,'reference_or_interpretive_count',v_reference,'named_generic_capability_missing_count',v_missing_cap,'compiler_function_count',v_compiler_procs,'compiler_automation_present',v_compiler_procs>0,'representative_suite_ready_for_bulk_activation',false)
 );
end;
$function$;

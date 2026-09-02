create or replace function public.rule_execution_pilot_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_build_object(
  'version','rule-execution-pilot-v1',
  'role','shadow architecture audit of compiled-rule consumption; does not mutate canonical analysis',
  'unit','compiled grammar rule in a versioned release',
  'statuses',jsonb_build_array('full_generic','partial_generic','family_dispatch','legacy_bridge','not_observed','adapter_required'),
  'pilot_pattern_types',jsonb_build_array('candidate_constraint','phrase_pattern','dependency_pattern'),
  'evidence_policy','semantic evidence must already be observable in canonical v1.16 outputs; pilot only records execution maturity and parity',
  'non_goals',jsonb_build_array('bulk rule activation','canonical graph mutation','new grammar claims','global grammar_rules activation','Document Runtime Contract V1')
);
$function$;

create or replace function public.build_rule_execution_pilot_v1(p_sentence jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid;
  v_codes jsonb;
  v_code text;
  r record;
  v_trigger_phase text;
  v_evidence jsonb;
  v_v2_evidence jsonb;
  v_declared_actions jsonb;
  v_unsupported_actions jsonb;
  v_consumer text;
  v_consumer_src text;
  v_mode text;
  v_arch_status text;
  v_hardcoded boolean;
  v_reads_actions boolean;
  v_semantic_parity boolean;
  v_rule_audits jsonb:='[]'::jsonb;
  v_sources jsonb;
  v_full int:=0; v_partial int:=0; v_family int:=0; v_legacy int:=0; v_observed int:=0;
begin
  select id,metadata->'pilot_rule_codes' into v_release_id,v_codes
  from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Runtime release % not found',p_release_code; end if;
  if coalesce(jsonb_typeof(v_codes),'null')<>'array' then v_codes:='[]'::jsonb; end if;

  for v_code in select value from jsonb_array_elements_text(v_codes)
  loop
    select gr.id,gr.code,gr.pattern_type,gr.pattern,gr.actions,gr.parser_actions,gr.result,gr.compiler_version,gr.compile_hash
      into r
    from public.grammar_runtime_release_rules rr
    join public.grammar_rules gr on gr.id=rr.rule_id
    where rr.release_id=v_release_id and rr.is_enabled and gr.code=v_code
    limit 1;

    if r.id is null then
      v_rule_audits:=v_rule_audits||jsonb_build_array(jsonb_build_object('rule_code',v_code,'status','not_observed','reason_code','pilot_rule_not_enabled_in_release'));
      continue;
    end if;

    select min(t.execution_phase) into v_trigger_phase
    from public.grammar_rule_triggers t where t.rule_id=r.id and t.is_active;

    select coalesce(jsonb_agg(distinct a->>'action' order by a->>'action'),'[]'::jsonb)
      into v_declared_actions from jsonb_array_elements(coalesce(r.actions,'[]'::jsonb)) a;

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'candidate_id',s.candidate_id,'source_section',s.source_section,'verification_status',s.verification_status,'is_primary_source',s.is_primary_source
    )) order by s.is_primary_source desc,s.source_section),'[]'::jsonb)
      into v_sources from public.grammar_rule_sources s where s.grammar_rule_id=r.id;

    v_evidence:='[]'::jsonb; v_v2_evidence:='[]'::jsonb; v_hardcoded:=false; v_reads_actions:=false;

    if r.pattern_type='candidate_constraint' then
      v_consumer:='build_shadow_token_v1';
      select p.prosrc into v_consumer_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_consumer limit 1;
      v_hardcoded:=position(r.code in coalesce(v_consumer_src,''))>0;
      v_reads_actions:=position('v_rule.actions' in coalesce(v_consumer_src,''))>0;
      select coalesce(jsonb_agg(m),'[]'::jsonb) into v_evidence
      from (
        select jsonb_build_object('token_index',(t->>'token_index')::int,'surface',t->>'surface','match',m) m
        from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,tokens}','[]'::jsonb)) t
        cross join lateral jsonb_array_elements(coalesce(t->'rule_matches','[]'::jsonb)) m
        where m->>'rule_id'=r.id::text
      ) q;
      select coalesce(jsonb_agg(x),'[]'::jsonb) into v_unsupported_actions
      from jsonb_array_elements_text(v_declared_actions) x
      where x not in ('add_candidate_score','protect_candidate','add_interpretation');
      v_semantic_parity:=jsonb_array_length(v_evidence)>0;
      if v_semantic_parity and jsonb_array_length(v_unsupported_actions)=0 and not v_hardcoded and v_reads_actions then
        v_mode:='full_generic'; v_arch_status:='full_generic'; v_full:=v_full+1;
      else
        v_mode:='partial_generic_action_dispatch'; v_arch_status:='partial_generic'; v_partial:=v_partial+1;
      end if;

    elsif r.pattern_type='phrase_pattern' then
      v_consumer:='build_phrase_layer_v1';
      select p.prosrc into v_consumer_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_consumer limit 1;
      v_hardcoded:=position(r.code in coalesce(v_consumer_src,''))>0;
      v_reads_actions:=position('v_rule.actions' in coalesce(v_consumer_src,''))>0;
      select coalesce(jsonb_agg(e),'[]'::jsonb) into v_evidence
      from (
        select x e from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,phrase_build_v1,resolved_phrases}','[]'::jsonb)) x where x->>'rule_id'=r.id::text
        union all
        select x e from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,phrase_build_v1,phrase_hypotheses}','[]'::jsonb)) x where x->>'rule_id'=r.id::text
      ) q;
      v_unsupported_actions:=v_declared_actions;
      v_semantic_parity:=jsonb_array_length(v_evidence)>0;
      v_mode:='family_pattern_dispatch'; v_arch_status:='family_dispatch'; v_family:=v_family+1;

    elsif r.pattern_type='dependency_pattern' then
      v_consumer:='apply_structural_dependency_bridge_v1';
      select p.prosrc into v_consumer_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_consumer limit 1;
      v_hardcoded:=position(r.code in coalesce(v_consumer_src,''))>0;
      v_reads_actions:=position('v_rule.actions' in coalesce(v_consumer_src,''))>0;
      select coalesce(jsonb_agg(x),'[]'::jsonb) into v_evidence
      from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,dependencies}','[]'::jsonb)) x
      where x->>'rule_id'=r.id::text;
      select coalesce(jsonb_agg(x),'[]'::jsonb) into v_v2_evidence
      from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) x
      where x->>'relation'=coalesce(r.pattern->>'relation','subject_of');
      v_unsupported_actions:=v_declared_actions;
      v_semantic_parity:=jsonb_array_length(v_evidence)>0 and jsonb_array_length(v_v2_evidence)>0;
      v_mode:='legacy_rule_specific_bridge'; v_arch_status:='adapter_required'; v_legacy:=v_legacy+1;
    else
      v_consumer:=null; v_consumer_src:=null; v_unsupported_actions:=v_declared_actions; v_semantic_parity:=false; v_mode:='not_observed'; v_arch_status:='not_observed';
    end if;

    if v_semantic_parity then v_observed:=v_observed+1; end if;
    v_rule_audits:=v_rule_audits||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,'runtime_family',r.result->>'runtime_family',
      'manifest_code',r.pattern->>'manifest_code','runtime_ir_version',r.pattern->>'runtime_ir_version','compiler_version',r.compiler_version,'compile_hash',r.compile_hash,
      'execution_phase',coalesce(v_trigger_phase,case when r.pattern_type='dependency_pattern' then 'dependency_build' end),
      'execution_phase_source',case when v_trigger_phase is null then 'consumer_inferred' else 'grammar_rule_triggers' end,
      'consumer_function',v_consumer,'execution_mode',v_mode,'architecture_status',v_arch_status,
      'consumer_hardcodes_rule_code',v_hardcoded,'consumer_reads_actions',v_reads_actions,
      'declared_actions',v_declared_actions,'unsupported_by_generic_action_dispatch',v_unsupported_actions,
      'semantic_evidence_observed',v_semantic_parity,'canonical_evidence',v_evidence,'canonical_v2_equivalent_evidence',v_v2_evidence,
      'schema_adapter_required',r.pattern_type='dependency_pattern' and v_semantic_parity,
      'schema_adapter_reason',case when r.pattern_type='dependency_pattern' and v_semantic_parity then 'compiled IR targets legacy phrase predicate while Dependency Build V2 targets predicate entity' end,
      'source_provenance',v_sources
    )));
  end loop;

  return jsonb_build_object(
    'version','rule-execution-pilot-v1','release_code',p_release_code,'status',case when jsonb_array_length(v_codes)=0 then 'not_configured' else 'audited' end,
    'rule_audits',v_rule_audits,
    'summary',jsonb_build_object('pilot_rule_count',jsonb_array_length(v_codes),'semantic_evidence_observed_count',v_observed,'full_generic_count',v_full,'partial_generic_count',v_partial,'family_dispatch_count',v_family,'legacy_bridge_count',v_legacy,
      'architecture_closed_for_bulk_activation',v_full=jsonb_array_length(v_codes) and jsonb_array_length(v_codes)>0)
  );
end;
$function$;

create or replace function public.apply_rule_execution_pilot_v1(p_doc jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_sentences jsonb:='[]'::jsonb; v_sentence jsonb; v_audit jsonb;
begin
  for v_sentence in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
    v_audit:=public.build_rule_execution_pilot_v1(v_sentence,p_release_code);
    v_sentence:=jsonb_set(v_sentence,'{analysis,language_graph,rule_execution_pilot_v1}',v_audit,true);
    v_sentences:=v_sentences||jsonb_build_array(v_sentence);
  end loop;
  return jsonb_set(p_doc,'{document_graph,sentences}',v_sentences,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v17(p_text text,p_release_code text default 'runtime-structural-v1.17'::text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v16(p_text,p_release_code);
  v_doc:=public.apply_rule_execution_pilot_v1(v_doc,p_release_code);
  return v_doc;
end;
$function$;

create or replace function public.run_rule_execution_pilot_shadow_comparator_v1(
  p_release_code text default 'runtime-structural-v1.17',
  p_parent_release_code text default 'runtime-structural-v1.16',
  p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
  select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code;
  select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
  if child_id is null or child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
  if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
  select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
  if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
  insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
  values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v16','grammar-structural-shadow-v17',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,
    jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_rule_execution_pilot_causal','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Rule Execution Plane Pilot V1','legacy_is_oracle',false,'child_projection','common semantic projection excludes rule_execution_pilot_v1'),clock_timestamp()) returning id into batch;
  for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
    begin
      pd:=public.analyze_text_structural_shadow_v16(c.input_text,p_parent_release_code);
      cd:=public.analyze_text_structural_shadow_v17(c.input_text,p_release_code);
      pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
      ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
      ca:=jsonb_set(ca,'{language_graph}',coalesce(ca->'language_graph','{}'::jsonb)-'rule_execution_pilot_v1',true);
      pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
      insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
      values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v16','grammar-structural-shadow-v17');
    exception when others then
      insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
      values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v16','grammar-structural-shadow-v17',sqlerrm);
    end;
  end loop;
  perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$function$;

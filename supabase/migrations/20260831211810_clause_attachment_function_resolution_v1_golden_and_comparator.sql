create or replace function public.run_clause_attachment_function_resolution_golden_v1(p_release_code text default 'runtime-structural-v1.35')
returns jsonb language plpgsql set search_path to 'public','pg_catalog' as $$
declare
 t jsonb:='[]'::jsonb; d jsonb; a jsonb; g jsonb; sm jsonb; pp jsonb; hot jsonb; inh jsonb; finh jsonb; cinh jsonb; src_hash text; snapshot_hash text; active_nrg int; child_rules int; ccount int; ftd jsonb;
begin
 select semantic_hash into snapshot_hash from public.grammar_source_graph_snapshots_v1 order by created_at desc limit 1;
 src_hash:=public.grammar_source_graph_semantic_hash_v1();
 select count(*) into active_nrg from public.grammar_rules where is_active and code like 'nrg_rt_v1.%';
 select count(*) into child_rules from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code and coalesce(rr.metadata->>'inherited_from_parent','false')::boolean=false and rr.rule_id not in (select pr.rule_id from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.34');
 select count(*) into ccount from public.grammar_runtime_constraint_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id where r.code=p_release_code and f.is_enabled;

 d:=public.analyze_text_structural_shadow_v35('Han håper at hun kommer.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.haape.resolved',a#>>'{summary,resolved_attachment_count}'='1',a->'summary'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.haape.relation',a#>>'{resolved_attachments,0,relation}'='ccomp',a#>'{resolved_attachments,0}'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.haape.function',a#>>'{resolved_attachments,0,syntactic_function}'='verb_complement',a#>'{resolved_attachments,0}'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.haape.frame_licensed',a#>>'{resolved_attachments,0,frame_assessment,status}'='licensed',a#>'{resolved_attachments,0,frame_assessment}'));

 d:=public.analyze_text_structural_shadow_v35('Han foreslår at hun kommer.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.foreslaa.resolved',a#>>'{summary,resolved_attachment_count}'='1',a->'summary'));
 d:=public.analyze_text_structural_shadow_v35('Han svarer at hun kommer.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('ccomp.svare.resolved',a#>>'{summary,resolved_attachment_count}'='1',a->'summary'));

 d:=public.analyze_text_structural_shadow_v35('Han bestemmer at hun kommer.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('sense.bestemme.blocked',a#>>'{candidate_attachments,0,reason_code}'='predicate_sense_required_by_source',a#>'{candidate_attachments,0}'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('sense.bestemme.not_resolved',a#>>'{summary,resolved_attachment_count}'='0',a->'summary'));

 d:=public.analyze_text_structural_shadow_v35('Han sier at han ikke kommer.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('lexical_bridge.si.blocked',a#>>'{candidate_attachments,0,reason_code}'='no_source_verified_predicate_complement_frame',a#>'{candidate_attachments,0}'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('lexical_bridge.si.not_resolved',a#>>'{summary,resolved_attachment_count}'='0',a->'summary'));

 d:=public.analyze_text_structural_shadow_v35('At han kommer er bra.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('csubj.prefield.candidate',exists(select 1 from jsonb_array_elements(a->'candidate_attachments') x where x->>'relation'='csubj' and x->>'status'='candidate'),a));
 t:=t||jsonb_build_array(public.golden_assertion_v1('csubj.prefield.not_overresolved',a#>>'{summary,resolved_attachment_count}'='0',a->'summary'));

 d:=public.analyze_text_structural_shadow_v35('Han dro for at han skulle hjelpe.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('mwe.for_at.blocked',exists(select 1 from jsonb_array_elements(a->'blocked_or_ambiguous') x where x->>'required_capability'='multiword_function_expression_resolution'),a));
 d:=public.analyze_text_structural_shadow_v35('Han reiser ikke.',p_release_code); a:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
 t:=t||jsonb_build_array(public.golden_assertion_v1('main.no_attachment_candidates',a#>>'{summary,generated_candidate_count}'='0',a->'summary'));
 t:=t||jsonb_build_array(public.golden_assertion_v1('safety.no_learner_error',a#>>'{summary,learner_error_claims}'='0',a->'summary'));

 t:=t||jsonb_build_array(public.golden_assertion_v1('constraints.total_31',ccount=31,jsonb_build_object('actual',ccount,'expected',31)));
 t:=t||jsonb_build_array(public.golden_assertion_v1('constraints.no_tro_variant_bridge',not exists(select 1 from public.grammar_runtime_constraint_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id join public.lexemes l on l.id=f.subject_key::uuid where r.code=p_release_code and f.fact_family='predicate_complement_frame' and l.lemma='tro'),jsonb_build_object('policy','exact lemma only')));
 t:=t||jsonb_build_array(public.golden_assertion_v1('constraints.no_gre_false_bridge',not exists(select 1 from public.grammar_runtime_constraint_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id join public.lexemes l on l.id=f.subject_key::uuid where r.code=p_release_code and f.fact_family='predicate_complement_frame' and l.lemma='gre'),jsonb_build_object('policy','source sense safety')));
 t:=t||jsonb_build_array(public.golden_assertion_v1('constraints.haape_at_present',exists(select 1 from public.grammar_runtime_constraint_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id join public.lexemes l on l.id=f.subject_key::uuid where r.code=p_release_code and f.fact_family='predicate_complement_frame' and l.lemma='håpe' and f.object_key='at_clause' and f.polarity='license'),jsonb_build_object('lemma','håpe','complement','at_clause')));

 hot:=public.runtime_hot_path_isolation_audit_v1('analyze_text_structural_shadow_v35',64);
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.hot_path_isolated',coalesce((hot->>'pass')::boolean,false),hot));
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.34');
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.rule_inheritance',coalesce((inh->>'valid')::boolean,false),inh));
 finh:=public.validate_runtime_materialized_fact_inheritance_v1(p_release_code,'runtime-structural-v1.34');
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.runtime_fact_inheritance',coalesce((finh->>'valid')::boolean,false),finh));
 cinh:=public.validate_runtime_constraint_fact_inheritance_v1(p_release_code,'runtime-structural-v1.34');
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.constraint_fact_parent_preserved',coalesce((cinh->>'valid')::boolean,false),cinh));
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.global_nrg_active_zero',active_nrg=0,jsonb_build_object('active_nrg',active_nrg)));
 t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.child_only_rules_zero',child_rules=0,jsonb_build_object('child_only_rules',child_rules)));
 t:=t||jsonb_build_array(public.golden_assertion_v1('source_graph.hash_unchanged',src_hash=snapshot_hash,jsonb_build_object('current_hash',src_hash,'snapshot_hash',snapshot_hash)));
 t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.tokenize_simple',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_simple' and md5(pg_get_functiondef(p.oid))='40819fa48cc6e48372cbf42275f2bb0c'),'{}'::jsonb));
 t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.structural_core',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v1' and md5(pg_get_functiondef(p.oid))='b15193a826907ea6082a1aae52f15fec'),'{}'::jsonb));
 t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.tokenize_v2',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_v2' and md5(pg_get_functiondef(p.oid))='f76f85eee4469e74079a101da442ec52'),'{}'::jsonb));

 ftd:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 t:=t||jsonb_build_array(public.golden_assertion_v1('regression.forms_tenses_degrees',coalesce((ftd->>'failed')::int,999)=0 and coalesce((ftd->>'passed')::int,0)=52,ftd));
 sm:=public.run_sentence_model_golden_v2(p_release_code);
 t:=t||jsonb_build_array(public.golden_assertion_v1('regression.sentence_model',coalesce((sm->>'failed')::int,999)=0 and coalesce((sm->>'passed')::int,0)=36,sm));
 pp:=public.run_pedagogical_projection_golden_v1(p_release_code);
 t:=t||jsonb_build_array(public.golden_assertion_v1('regression.pedagogy',coalesce((pp->>'failed')::int,999)=0 and coalesce((pp->>'passed')::int,0)=36,pp));

 return jsonb_build_object('version','clause-attachment-function-resolution-golden-v1','release_code',p_release_code,'tests',t,'total',jsonb_array_length(t),'passed',(select count(*) from jsonb_array_elements(t) x where coalesce((x->>'passed')::boolean,false)),'failed',(select count(*) from jsonb_array_elements(t) x where not coalesce((x->>'passed')::boolean,false)),'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(t) x where not coalesce((x->>'passed')::boolean,false)));
end;
$$;

create or replace function public.run_clause_attachment_function_resolution_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.35',p_parent_release_code text default 'runtime-structural-v1.34',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid language plpgsql set search_path to 'public','pg_catalog' as $$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; ppj jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code; select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if; if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active; if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v34','grammar-structural-shadow-v35',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_mode','parent_child_clause_attachment_function_resolution_v1','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Clause Attachment & Function Resolution V1'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v34(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v35(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   ppj:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(ppj,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,ppj,cp,cmp,'grammar-structural-shadow-v34','grammar-structural-shadow-v35');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v34','grammar-structural-shadow-v35',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$$;

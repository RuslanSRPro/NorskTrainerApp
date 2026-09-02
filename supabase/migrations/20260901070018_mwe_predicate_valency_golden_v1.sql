create or replace function public.run_mwe_predicate_valency_golden_v1(
  p_release_code text default 'runtime-structural-v1.37'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  t jsonb := '[]'::jsonb; d jsonb; pred jsonb; base_pred jsonb; bridge jsonb; clause jsonb; att jsonb; dep jsonb; val jsonb; sm jsonb; frame jsonb;
  child_id uuid; parent_id uuid; child_rules int; parent_rules int; active_nrg int; mwe_count int; mwe_frame_count int; mwe_license_count int; mwe_exclude_count int; lexical_overlay_count int; dependency_fact_count int; constraint_count int; src_hash text; snapshot_hash text;
begin
  select id into child_id from public.grammar_runtime_releases where code=p_release_code;
  select id into parent_id from public.grammar_runtime_releases where code='runtime-structural-v1.36';
  select count(*) into child_rules from public.grammar_runtime_release_rules where release_id=child_id;
  select count(*) into parent_rules from public.grammar_runtime_release_rules where release_id=parent_id;
  select count(*) into active_nrg from public.grammar_rules where is_active and code like 'nrg_rt_v1.%';
  select count(*) into mwe_count from public.grammar_runtime_multiword_facts_v1 where release_id=child_id and is_enabled;
  select count(*) into constraint_count from public.grammar_runtime_constraint_facts_v1 where release_id=child_id and is_enabled;
  select count(*) into mwe_frame_count from public.grammar_runtime_constraint_facts_v1 where release_id=child_id and is_enabled and subject_type='mwe_predicate';
  select count(*) into mwe_license_count from public.grammar_runtime_constraint_facts_v1 where release_id=child_id and is_enabled and subject_type='mwe_predicate' and polarity='license';
  select count(*) into mwe_exclude_count from public.grammar_runtime_constraint_facts_v1 where release_id=child_id and is_enabled and subject_type='mwe_predicate' and polarity='exclude';
  select count(*) into lexical_overlay_count from public.grammar_runtime_lexical_overlays_v1 where release_id=child_id and is_enabled;
  select count(*) into dependency_fact_count from public.grammar_runtime_release_dependency_facts_v1 where release_id=child_id and is_enabled;
  t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.release_exists',child_id is not null,jsonb_build_object('release_id',child_id)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.parent_release_v136',(select metadata->>'parent_release' from public.grammar_runtime_releases where id=child_id)='runtime-structural-v1.36'));
  t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.rule_inheritance_exact',child_rules=parent_rules,jsonb_build_object('child_rules',child_rules,'parent_rules',parent_rules)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.child_only_rules_zero',(select coalesce((metadata->>'child_only_rules')::int,-1) from public.grammar_runtime_releases where id=child_id)=0));
  t:=t||jsonb_build_array(public.golden_assertion_v1('architecture.global_nrg_active_zero',active_nrg=0,jsonb_build_object('active_nrg',active_nrg)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('inheritance.multiword_13',mwe_count=13,jsonb_build_object('actual',mwe_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('inheritance.lexical_overlay_1',lexical_overlay_count=1,jsonb_build_object('actual',lexical_overlay_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('inheritance.dependency_facts_7',dependency_fact_count=7,jsonb_build_object('actual',dependency_fact_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('facts.constraint_total_52',constraint_count=52,jsonb_build_object('actual',constraint_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('facts.mwe_frames_21',mwe_frame_count=21,jsonb_build_object('actual',mwe_frame_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('facts.mwe_licenses_17',mwe_license_count=17,jsonb_build_object('actual',mwe_license_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('facts.mwe_excludes_4',mwe_exclude_count=4,jsonb_build_object('actual',mwe_exclude_count)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('facts.no_new_lexeme_scope',not exists(select 1 from public.grammar_runtime_constraint_facts_v1 f where f.release_id=child_id and f.constraint_code like 'mwe_frame.%' and f.subject_type='lexeme')));
  frame:=public.mwe_predicate_complement_frame_assessment_v1(p_release_code,'mwe.predicate.passe_på','at_clause'); t:=t||jsonb_build_array(public.golden_assertion_v1('frame.passe_paa.at_licensed',frame->>'status'='licensed',frame));
  frame:=public.mwe_predicate_complement_frame_assessment_v1(p_release_code,'mwe.predicate.tyde_på','at_clause'); t:=t||jsonb_build_array(public.golden_assertion_v1('frame.tyde_paa.at_licensed',frame->>'status'='licensed',frame));
  frame:=public.mwe_predicate_complement_frame_assessment_v1(p_release_code,'mwe.predicate.finne_ut','at_clause'); t:=t||jsonb_build_array(public.golden_assertion_v1('frame.finne_ut.at_requires_sense',frame->>'status'='licensed_but_predicate_sense_required',frame));
  frame:=public.mwe_predicate_complement_frame_assessment_v1(p_release_code,'mwe.predicate.finne_ut','infinitive_construction'); t:=t||jsonb_build_array(public.golden_assertion_v1('frame.finne_ut.infinitive_excluded',frame->>'status'='excluded',frame));
  frame:=public.mwe_predicate_complement_frame_assessment_v1(p_release_code,'mwe.predicate.lure_på','at_clause'); t:=t||jsonb_build_array(public.golden_assertion_v1('frame.lure_paa.at_not_inferred',frame->>'status'='no_frame',frame));
  d:=public.analyze_text_structural_shadow_v37('Han passer på at hun kommer.',p_release_code); base_pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1_base}'; pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'; bridge:=d#>'{document_graph,sentences,0,analysis,language_graph,mwe_predicate_valency_v1}'; clause:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}'; att:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}'; dep:=d#>'{document_graph,sentences,0,analysis,language_graph,dependency_build_v2}'; val:=d#>'{document_graph,sentences,0,analysis,language_graph,grammar_validation_v2}'; sm:=d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}';
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.base_preserved',base_pred#>>'{predicates,0,surface}'='passer',base_pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.mwe_predicate_resolved',pred#>>'{predicates,0,predicate_kind}'='multiword_verbal' and pred#>>'{predicates,0,surface}'='passer på',pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.member_span',pred#>'{predicates,0,member_token_indices}'='[2,3]'::jsonb,pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.bridge_count',bridge#>>'{summary,resolved_mwe_predicate_count}'='1',bridge));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.clause_rebuilt',clause#>>'{clauses,0,surface}'='Han passer på' and clause#>>'{clauses,0,predicate_kind}'='multiword_verbal',clause));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.ccomp_resolved',exists(select 1 from jsonb_array_elements(coalesce(att->'resolved_attachments','[]'::jsonb)) x where x->>'relation'='ccomp' and x->>'mwe_code'='mwe.predicate.passe_på' and x->>'frame_scope'='mwe_predicate'),att));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.dependency_accepts_mwe',exists(select 1 from jsonb_array_elements(coalesce(dep->'dependencies','[]'::jsonb)) x where x->>'relation'='predicate_of_clause' and x->>'source_surface'='passer på'),dep));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.validation_valid',val#>>'{summary,overall_status}'='valid' and val#>>'{summary,invalid_count}'='0',val));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_paa.sentence_model_valid',sm->>'status'='valid',sm));
  d:=public.analyze_text_structural_shadow_v37('Han passer at hun kommer.',p_release_code); pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'; att:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_without_paa.not_mwe',pred#>>'{predicates,0,predicate_kind}'='simple_verbal' and pred#>>'{predicates,0,surface}'='passer',pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('passe_without_paa.no_overgeneralized_frame',not exists(select 1 from jsonb_array_elements(coalesce(att->'resolved_attachments','[]'::jsonb)) x where x->>'relation'='ccomp') and exists(select 1 from jsonb_array_elements(coalesce(att->'blocked_or_ambiguous','[]'::jsonb)) x where x->>'reason_code'='no_source_verified_predicate_complement_frame'),att));
  d:=public.analyze_text_structural_shadow_v37('Han finner ut at hun kommer.',p_release_code); pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'; bridge:=d#>'{document_graph,sentences,0,analysis,language_graph,mwe_predicate_valency_v1}'; att:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}'; sm:=d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}';
  t:=t||jsonb_build_array(public.golden_assertion_v1('finne_ut.not_resolved_without_sense',pred#>>'{predicates,0,surface}'='finner' and bridge#>>'{summary,resolved_mwe_predicate_count}'='0',pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('finne_ut.sense_hypothesis',bridge#>>'{summary,sense_hypothesis_count}'='1',bridge));
  t:=t||jsonb_build_array(public.golden_assertion_v1('finne_ut.attachment_sense_blocked',exists(select 1 from jsonb_array_elements(coalesce(att->'blocked_or_ambiguous','[]'::jsonb)) x where x->>'mwe_code'='mwe.predicate.finne_ut' and x->>'reason_code'='mwe_predicate_sense_required_by_source' and x->>'required_capability'='predicate_sense_resolution'),att));
  t:=t||jsonb_build_array(public.golden_assertion_v1('finne_ut.sentence_model_unresolved',sm->>'status'='unresolved',sm));
  d:=public.analyze_text_structural_shadow_v37('Han tyder på at hun kommer.',p_release_code); pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'; att:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_attachment_function_v1}';
  t:=t||jsonb_build_array(public.golden_assertion_v1('tyde_paa.mwe_predicate_resolved',pred#>>'{predicates,0,surface}'='tyder på' and pred#>>'{predicates,0,predicate_kind}'='multiword_verbal',pred));
  t:=t||jsonb_build_array(public.golden_assertion_v1('tyde_paa.ccomp_resolved',exists(select 1 from jsonb_array_elements(coalesce(att->'resolved_attachments','[]'::jsonb)) x where x->>'relation'='ccomp' and x->>'mwe_code'='mwe.predicate.tyde_på'),att));
  d:=public.analyze_text_structural_shadow_v37('Han reiser ikke.',p_release_code); bridge:=d#>'{document_graph,sentences,0,analysis,language_graph,mwe_predicate_valency_v1}'; pred:=d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'; t:=t||jsonb_build_array(public.golden_assertion_v1('ordinary.no_mwe_change',bridge#>>'{summary,resolved_mwe_predicate_count}'='0' and pred#>>'{predicates,0,surface}'='reiser',bridge));
  d:=public.analyze_text_structural_shadow_v37('Han tror på at hun kommer.',p_release_code); bridge:=d#>'{document_graph,sentences,0,analysis,language_graph,mwe_predicate_valency_v1}'; t:=t||jsonb_build_array(public.golden_assertion_v1('tru_paa.no_cross_standard_guess',bridge#>>'{summary,resolved_mwe_predicate_count}'='0' and bridge#>>'{summary,sense_hypothesis_count}'='0',bridge));
  t:=t||jsonb_build_array(public.golden_assertion_v1('safety.no_learner_error_claims',(public.analyze_text_structural_shadow_v37('Han passer på at hun kommer.',p_release_code)#>>'{document_graph,sentences,0,analysis,language_graph,mwe_predicate_valency_v1,summary,learner_error_claims}')='0'));
  select semantic_hash into snapshot_hash from public.grammar_source_graph_snapshots_v1 order by created_at desc limit 1; src_hash:=public.grammar_source_graph_semantic_hash_v1();
  t:=t||jsonb_build_array(public.golden_assertion_v1('source_graph.hash_unchanged',src_hash=snapshot_hash,jsonb_build_object('current_hash',src_hash,'snapshot_hash',snapshot_hash)));
  t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.tokenize_simple',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_simple' and md5(pg_get_functiondef(p.oid))='40819fa48cc6e48372cbf42275f2bb0c')));
  t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.structural_core',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v1' and md5(pg_get_functiondef(p.oid))='b15193a826907ea6082a1aae52f15fec')));
  t:=t||jsonb_build_array(public.golden_assertion_v1('immutable.tokenize_v2',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_v2' and md5(pg_get_functiondef(p.oid))='f76f85eee4469e74079a101da442ec52')));
  return jsonb_build_object('version','mwe-predicate-valency-golden-v1','release_code',p_release_code,'tests',t,'total',jsonb_array_length(t),'passed',(select count(*) from jsonb_array_elements(t) x where coalesce((x->>'passed')::boolean,false)),'failed',(select count(*) from jsonb_array_elements(t) x where not coalesce((x->>'passed')::boolean,false)),'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(t) x where not coalesce((x->>'passed')::boolean,false)));
end;
$$;

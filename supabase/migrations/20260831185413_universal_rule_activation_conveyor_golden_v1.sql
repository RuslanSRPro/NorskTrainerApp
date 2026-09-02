create or replace function public.run_universal_rule_activation_conveyor_golden_v1(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare tests jsonb:='[]'::jsonb; gate jsonb; matrix jsonb; ftd jsonb; t jsonb; np jsonb; adj jsonb; ap jsonb; r record; semhash text; basehash text; passed int; total int;
begin
 gate:=public.universal_activation_gate_v1(p_release_code);
 matrix:=gate#>'{checks,operator_matrix}';
 ftd:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 t:=public.plan_manifest_batch_dry_run_v2('tense_form_selection',p_release_code,100);
 np:=public.plan_manifest_batch_dry_run_v2('grammar_rule_candidate',p_release_code,100);
 adj:=public.plan_manifest_batch_dry_run_v2('adjective_agreement_rule',p_release_code,100);
 ap:=public.plan_manifest_batch_dry_run_v2('adjective_phrase_rule',p_release_code,100);
 select semantic_hash into basehash from public.grammar_source_graph_snapshots_v1 where snapshot_code='source-graph-4564-v1'; semhash:=public.grammar_source_graph_semantic_hash_v1();
 select * into r from public.grammar_runtime_releases where code=p_release_code;
 tests:=tests||jsonb_build_array(
 jsonb_build_object('code','source.count_4564','passed',(select count(*)=4564 from public.grammar_knowledge_candidates),'actual',(select count(*) from public.grammar_knowledge_candidates)),
 jsonb_build_object('code','source.hash_immutable','passed',semhash=basehash,'actual',semhash),
 jsonb_build_object('code','source.trigger_exists','passed',exists(select 1 from pg_trigger where tgrelid='public.grammar_knowledge_candidates'::regclass and tgname='trg_guard_verified_source_candidate_immutability_v1' and not tgisinternal)),
 jsonb_build_object('code','release.rules_27','passed',r.rule_count=27,'actual',r.rule_count),
 jsonb_build_object('code','release.manifests_26','passed',r.manifest_count=26,'actual',r.manifest_count),
 jsonb_build_object('code','release.child_rules_zero','passed',(select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id where rel.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases pre on pre.id=pr.release_id where pre.code='runtime-structural-v1.29' and pr.rule_id=rr.rule_id))=0),
 jsonb_build_object('code','forms.registry_adjective','passed',public.morph_form_key_features_v2('adjective','comparative')='{"Degree":"Cmp"}'::jsonb),
 jsonb_build_object('code','forms.registry_noun','passed',public.morph_form_key_features_v2('noun','plural_definite')='{"Number":"Plur","Definite":"Def"}'::jsonb),
 jsonb_build_object('code','forms.registry_verb','passed',public.morph_form_key_features_v2('verb','present')='{"VerbForm":"Fin","Tense":"Pres"}'::jsonb),
 jsonb_build_object('code','forms.perfect_is_construction','passed',(select form_scope='construction' from public.grammar_morph_form_registry_v1 where pos='verb' and form_key='present_perfect')),
 jsonb_build_object('code','resolver.adjective','passed',public.resolve_lexeme_for_surface_v1('større','stor','adjective')->>'pos'='adjective'),
 jsonb_build_object('code','resolver.noun','passed',public.resolve_lexeme_for_surface_v1('bilen','bil','noun')->>'pos'='noun'),
 jsonb_build_object('code','resolver.verb','passed',public.resolve_lexeme_for_surface_v1('reiser','reise','verb')->>'pos'='verb'),
 jsonb_build_object('code','dispatcher.generic_preserves_composition','passed',public.dispatch_morphological_rules_v3('grønt','grønn','adjective',p_release_code)#>>'{selected,execution_path}'='composed_two_step'),
 jsonb_build_object('code','gate.pass','passed',(gate->>'gate_pass')::boolean,'actual',gate->>'gate_pass'),
 jsonb_build_object('code','gate.active_nrg_zero','passed',(gate#>>'{checks,global_active_nrg_rules}')::int=0,'actual',gate#>>'{checks,global_active_nrg_rules}'),
 jsonb_build_object('code','matrix.total_4564','passed',(matrix#>>'{summary,total_candidates}')::int=4564,'actual',matrix#>>'{summary,total_candidates}'),
 jsonb_build_object('code','matrix.runtime_1732','passed',(matrix#>>'{summary,runtime_candidates}')::int=1732,'actual',matrix#>>'{summary,runtime_candidates}'),
 jsonb_build_object('code','matrix.ready_23','passed',(matrix#>>'{summary,activation_ready}')::int=23,'actual',matrix#>>'{summary,activation_ready}'),
 jsonb_build_object('code','matrix.needs_manifest_1699','passed',(matrix#>>'{summary,needs_manifest}')::int=1699,'actual',matrix#>>'{summary,needs_manifest}'),
 jsonb_build_object('code','matrix.approved_6','passed',(matrix#>>'{summary,needs_manifest_with_approved_template}')::int=6,'actual',matrix#>>'{summary,needs_manifest_with_approved_template}'),
 jsonb_build_object('code','matrix.unapproved_1693','passed',(matrix#>>'{summary,needs_manifest_without_approved_template}')::int=1693,'actual',matrix#>>'{summary,needs_manifest_without_approved_template}'),
 jsonb_build_object('code','factory.tense_blocked','passed',t->>'template_status'='blocked_no_approved_template','actual',t->>'template_status'),
 jsonb_build_object('code','factory.tense_13','passed',(t->>'candidate_count')::int=13,'actual',t->>'candidate_count'),
 jsonb_build_object('code','factory.broad_np_blocked','passed',np->>'template_status'='blocked_no_approved_template','actual',np->>'template_status'),
 jsonb_build_object('code','factory.adjective_agreement_blocked','passed',adj->>'template_status'='blocked_no_approved_template','actual',adj->>'template_status'),
 jsonb_build_object('code','factory.adjective_phrase_approved','passed',ap->>'template_status'='approved_unique_template','actual',ap->>'template_status'),
 jsonb_build_object('code','regression.forms_tenses_degrees_52','passed',(ftd#>>'{summary,passed}')::int=52 and (ftd#>>'{summary,failed}')::int=0,'actual',ftd->'summary'),
 jsonb_build_object('code','immutable.tokenizer_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'),
 jsonb_build_object('code','immutable.structural_core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'),
 jsonb_build_object('code','immutable.tokenizer_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52')
 );
 select count(*),count(*) filter(where coalesce((x->>'passed')::boolean,false)) into total,passed from jsonb_array_elements(tests) x;
 return jsonb_build_object('version','universal-rule-activation-conveyor-golden-v1','release_code',p_release_code,'tests',tests,'summary',jsonb_build_object('total',total,'passed',passed,'failed',total-passed),'gate',gate,'forms_tenses_degrees',ftd);
end;$$;

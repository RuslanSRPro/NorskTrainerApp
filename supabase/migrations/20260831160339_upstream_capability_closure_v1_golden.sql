create or replace function public.golden_assertion_v1(p_code text,p_pass boolean,p_actual jsonb default '{}'::jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $f$
select jsonb_build_object('code',p_code,'passed',coalesce(p_pass,false),'actual',coalesce(p_actual,'{}'::jsonb));
$f$;

create or replace function public.run_upstream_capability_closure_golden_v1(p_release_code text default 'runtime-structural-v1.21')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare results jsonb:='[]'::jsonb; d jsonb; p jsonb; ac jsonb; cf jsonb; ex jsonb; rep jsonb; inh jsonb; total int; passed int;
begin
 d:=public.analyze_text_structural_shadow_v21('Jeg ser en stor bil.',p_release_code); ac:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.contract',public.agreement_controller_bridge_contract_v1()->>'version'='agreement-controller-bridge-v1'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.indefinite.count',(ac#>>'{summary,relation_count}')::int=1,ac));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.indefinite.tokens',ac#>>'{relations,0,source_token_index}'='4' and ac#>>'{relations,0,target_token_index}'='5',ac));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.indefinite.entities',ac#>>'{relations,0,source_id}' like 'pb1:AP:%' and ac#>>'{relations,0,target_id}' like 'pb1:NP:%',ac));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.indefinite.unifies',coalesce((ac#>>'{relations,0,features_unify}')::boolean,false),ac));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.indefinite.provenance',ac#>>'{relations,0,rule_code}'='nrg_rt_v1.structural.agreement_controller.attributive_np',ac));
 p:=public.analyze_text_structural_shadow_v20('Jeg ser en stor bil.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.parent_morph_immutable',d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}'=p#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.parent_dependencies_immutable',d#>'{document_graph,sentences,0,analysis,language_graph,dependencies}'=p#>'{document_graph,sentences,0,analysis,language_graph,dependencies}'));
 d:=public.analyze_text_structural_shadow_v21('Den store bilen kommer.',p_release_code); ac:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.definite.count',(ac#>>'{summary,relation_count}')::int=1,ac));
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.definite.unifies',coalesce((ac#>>'{relations,0,features_unify}')::boolean,false),ac));
 d:=public.analyze_text_structural_shadow_v21('Han er stor.',p_release_code); ac:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('agreement.predicative.negative',(ac#>>'{summary,relation_count}')::int=0,ac));

 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.contract',public.clause_field_model_contract_v1()->>'version'='clause-field-model-v1'));
 d:=public.analyze_text_structural_shadow_v21('Han kommer.',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.simple.schema_a',(cf#>>'{summary,schema_a_count}')::int=1 and cf#>>'{clause_models,0,schema}'='A',cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.simple.rule',cf#>>'{clause_models,0,schema_rule_code}'='nrg_rt_v1.structural.schema.a.declarative_main',cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.simple.no_adverbial',(cf#>>'{summary,midfield_adverbial_count}')::int=0,cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.simple.relative_not_applicable',cf#>>'{clause_models,0,relative_order,status}'='not_applicable_no_midfield_adverbial',cf));
 d:=public.analyze_text_structural_shadow_v21('Han kommer ikke.',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.negation.schema_a',(cf#>>'{summary,schema_a_count}')::int=1,cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.negation.midfield_count',(cf#>>'{summary,midfield_adverbial_count}')::int=1,cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.negation.surface',cf#>>'{clause_models,0,midfield_adverbials,0,surface}'='ikke',cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.negation.rule',cf#>>'{clause_models,0,midfield_adverbials,0,rule_code}'='nrg_rt_v1.structural.sentence_adverbial.midfield',cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.negation.relative_a',cf#>>'{clause_models,0,relative_order,status}'='satisfied' and cf#>>'{clause_models,0,relative_order,branch}'='A',cf));
 d:=public.analyze_text_structural_shadow_v21('Kommer han?',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.question.not_classified',(cf#>>'{summary,schema_a_count}')::int=0,cf));
 d:=public.analyze_text_structural_shadow_v21('I dag kommer han.',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.fronting.not_classified',(cf#>>'{summary,schema_a_count}')::int=0,cf));
 d:=public.analyze_text_structural_shadow_v21('Jeg kan ikke komme.',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.blocked_modal.not_classified',(cf#>>'{summary,schema_a_count}')::int=0,cf));
 d:=public.analyze_text_structural_shadow_v21('Han sier fordi han ikke kommer.',p_release_code); cf:=d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.subordinate.deferred',exists(select 1 from jsonb_array_elements(coalesce(cf->'blocked_or_deferred','[]'::jsonb)) x where x->>'reason_code'='subordinate_clause_not_materialized'),cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.schema_b_zero',(cf#>>'{summary,schema_b_count}')::int=0,cf));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fields.subjunction_present',coalesce((cf#>>'{summary,subjunction_present}')::boolean,false),cf));

 ex:=public.audit_execution_family_closure_v3(p_release_code); rep:=public.audit_representative_rule_suite_execution_v3('representative-rule-suite-v1'); inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.20');
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.rules_15',(ex#>>'{summary,rule_count}')::int=15,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.ready_12',(ex#>>'{summary,ready_without_runtime_code_change}')::int=12,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.blocked_3',(ex#>>'{summary,registered_but_blocked}')::int=3,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.unsupported_0',(ex#>>'{summary,unsupported_or_unmapped}')::int=0,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.compiled_8',(rep#>>'{summary,compiled_candidates}')::int=8,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.full_ready_7',(rep#>>'{summary,compiled_candidates_fully_ready}')::int=7,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.partial_1',(rep#>>'{summary,compiled_candidates_partially_ready}')::int=1,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.inheritance',coalesce((inh->>'valid')::boolean,false),inh));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.active_nrg_0',(select count(*) from public.grammar_rules where is_active and code like 'nrg_rt_v1.%')=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.child_rules_0',(select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases c on c.id=rr.release_id where c.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p2 on p2.id=pr.release_id where p2.code='runtime-structural-v1.20' and pr.rule_id=rr.rule_id))=0));
 d:=public.analyze_text_structural_shadow_v21('Han kommer ikke. Jeg ser en stor bil.',p_release_code); p:=public.analyze_text_structural_shadow_v21('Han kommer ikke. Jeg ser en stor bil.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.deterministic',d=p));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.multi_sentence_isolation',jsonb_array_length(d#>'{document_graph,sentences}')=2 and d#>>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1,summary,schema_a_count}'='1' and d#>>'{document_graph,sentences,1,analysis,language_graph,agreement_controller_bridge_v1,summary,relation_count}'='1',d#>'{document_graph,sentences}'));
 select count(*),count(*) filter(where (x->>'passed')::boolean) into total,passed from jsonb_array_elements(results) x;
 return jsonb_build_object('version','upstream-capability-closure-golden-v1','batch_id',gen_random_uuid(),'total',total,'passed',passed,'failed',total-passed,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(results) x where not (x->>'passed')::boolean));
end;
$function$;

create or replace function public.run_subordinate_clause_foundation_golden_v1(p_release_code text default 'runtime-structural-v1.22')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare
 results jsonb:='[]'::jsonb; d jsonb; p jsonb; f jsonb; inv jsonb; ex jsonb; rep jsonb; inh jsonb;
 total int; passed int;
begin
 inv:=public.subordinate_connector_inventory_v1();
 results:=results||jsonb_build_array(public.golden_assertion_v1('contract.version',public.subordinate_clause_foundation_contract_v1()->>'version'='subordinate-clause-foundation-v1'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.count',(inv#>>'{summary,resolved_connector_count}')::int=2,inv));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.fordi_existing',exists(select 1 from jsonb_array_elements(inv->'items') x where x->>'connector'='fordi' and x->>'classification_source'='existing_lexical_class'),inv));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.at_overlay',exists(select 1 from jsonb_array_elements(inv->'items') x where x->>'connector'='at' and x->>'classification_source'='verified_nrg_exact_subjunction_overlay'),inv));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.om_absent',not exists(select 1 from jsonb_array_elements(inv->'items') x where x->>'connector'='om'),inv));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.no_global_at_mutation',(select count(*) from public.grammar_lexical_class_members m join public.grammar_lexical_classes c on c.id=m.class_id where c.code='subjunction_connector' and m.is_active and m.normalized_lemma='at')=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('inventory.broad_lists_not_promoted',not coalesce((inv#>>'{summary,broad_introducer_lists_promoted}')::boolean,true),inv));

 d:=public.analyze_text_structural_shadow_v22('Jeg tror at han kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.connector_count',(f#>>'{summary,connector_count}')::int=1,f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.clause_count',(f#>>'{summary,resolved_clause_count}')::int=1,f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.schema_b',f#>>'{clauses,0,schema}'='B',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.indices',f#>>'{clauses,0,connector_token_index}'='3' and f#>>'{clauses,0,subject_token_index}'='4' and f#>>'{clauses,0,finite_token_index}'='5',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.surface',f#>>'{clauses,0,surface}'='at han kommer',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.connector_rule',f#>>'{connector_fields,0,rule_code}'='nrg_rt_v1.structural.schema.b.connector_field',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.schema_rule',f#>>'{schema_models,0,rule_code}'='nrg_rt_v1.structural.schema.b.subordinate_default',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.overlay_provenance',f#>>'{connector_fields,0,classification_source}'='verified_nrg_exact_subjunction_overlay' and exists(select 1 from jsonb_array_elements(coalesce(f#>'{connector_fields,0,classification_provenance}','[]'::jsonb)) x where x->>'candidate_code'='sentence.subordinate.explicative.nominal.at.reference.semantic_empty_marker'),f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.source_vp',f#>>'{clauses,0,source_vp_id}'='pb1:VP:5',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.attachment_unresolved',f#>>'{clauses,0,attachment_state}'='subordinate_attachment_unresolved' and f#>>'{clauses,0,syntactic_function}'='unresolved',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.simple.no_learner_error',(f#>>'{summary,learner_error_claims}')::int=0,f));

 p:=public.analyze_text_structural_shadow_v21('Jeg tror at han kommer.','runtime-structural-v1.21');
 results:=results||jsonb_build_array(public.golden_assertion_v1('immutability.clause_build',d#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}'=p#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1}'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('immutability.predicate_build',d#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'=p#>'{document_graph,sentences,0,analysis,language_graph,predicate_build_v1}'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('immutability.clause_field_v1',d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}'=p#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('immutability.sentence_model',d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}'=p#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}'));

 d:=public.analyze_text_structural_shadow_v22('Han sier at han ikke kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.negation.midfield_count',(f#>>'{summary,midfield_adverbial_count}')::int=1,f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.negation.indices',f#>>'{clauses,0,subject_token_index}'='4' and f#>>'{clauses,0,midfield_adverbials,0,token_index}'='5' and f#>>'{clauses,0,finite_token_index}'='6',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.negation.b_satisfied',f#>>'{clauses,0,relative_order,status}'='satisfied' and f#>>'{clauses,0,relative_order,branch}'='B',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.negation.relative_rule',f#>>'{clauses,0,relative_order,rule_code}'='nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_b',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.negation.adverbial_rule',f#>>'{clauses,0,midfield_adverbials,0,rule_code}'='nrg_rt_v1.structural.sentence_adverbial.midfield',f));

 d:=public.analyze_text_structural_shadow_v22('Han sier fordi han ikke kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fordi.class_source',f#>>'{connector_fields,0,classification_source}'='existing_token_lexical_class',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fordi.schema_b',(f#>>'{summary,schema_b_count}')::int=1 and f#>>'{clauses,0,schema}'='B',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fordi.b_satisfied',f#>>'{clauses,0,relative_order,status}'='satisfied',f));

 d:=public.analyze_text_structural_shadow_v22('Fordi han ikke kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('fordi.initial.source_clause',nullif(f#>>'{clauses,0,source_clause_id}','') is not null,f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('fordi.initial.schema_b',f#>>'{clauses,0,schema}'='B',f));

 d:=public.analyze_text_structural_shadow_v22('At han kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.initial.schema_b',f#>>'{clauses,0,schema}'='B',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('at.initial.parent_field_preserved_a',d#>>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1,clause_models,0,schema}'='A',d#>'{document_graph,sentences,0,analysis,language_graph,clause_field_model_v1}'));

 d:=public.analyze_text_structural_shadow_v22('Jeg vet om han kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('om.negative.connector_zero',(f#>>'{summary,connector_count}')::int=0,f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('om.negative.clause_zero',(f#>>'{summary,resolved_clause_count}')::int=0,f));

 d:=public.analyze_text_structural_shadow_v22('Han sier at kommer.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('missing_subject.deferred',(f#>>'{summary,resolved_clause_count}')::int=0 and exists(select 1 from jsonb_array_elements(f->'blocked_or_deferred') x where x->>'reason_code'='explicit_subject_not_resolved_in_v1'),f));

 d:=public.analyze_text_structural_shadow_v22('Han sier at han kommer ikke.',p_release_code); f:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('order_conflict.observed',(f#>>'{summary,relative_order_b_conflict_unresolved_count}')::int=1 and f#>>'{clauses,0,relative_order,status}'='observed_finite_before_adverbial',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('order_conflict.not_learner_error',not coalesce((f#>>'{clauses,0,relative_order,learner_error}')::boolean,true) and f#>>'{clauses,0,relative_order,validation_state}'='unresolved_possible_schema_a_override',f));
 results:=results||jsonb_build_array(public.golden_assertion_v1('order_conflict.members_sorted',f#>'{clauses,0,member_token_indices}'='[3,4,5,6]'::jsonb,f));

 ex:=public.audit_execution_family_closure_v4(p_release_code); rep:=public.audit_representative_rule_suite_execution_v4('representative-rule-suite-v1'); inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.21');
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.rules_15',(ex#>>'{summary,rule_count}')::int=15,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.ready_15',(ex#>>'{summary,ready_without_runtime_code_change}')::int=15,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.blocked_0',(ex#>>'{summary,registered_but_blocked}')::int=0,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.unsupported_0',(ex#>>'{summary,unsupported_or_unmapped}')::int=0,ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.structurally_closed',coalesce((ex#>>'{summary,current_compiled_set_structurally_closed}')::boolean,false),ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.bulk_activation_still_false',not coalesce((ex#>>'{summary,bulk_activation_ready}')::boolean,true),ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.compiled_8',(rep#>>'{summary,compiled_candidates}')::int=8,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.full_ready_8',(rep#>>'{summary,compiled_candidates_fully_ready}')::int=8,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('representative.partial_0',(rep#>>'{summary,compiled_candidates_partially_ready}')::int=0,rep->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.inheritance',coalesce((inh->>'valid')::boolean,false),inh));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.active_nrg_0',(select count(*) from public.grammar_rules where is_active and code like 'nrg_rt_v1.%')=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.child_rules_0',(select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases c on c.id=rr.release_id where c.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p2 on p2.id=pr.release_id where p2.code='runtime-structural-v1.21' and pr.rule_id=rr.rule_id))=0));

 d:=public.analyze_text_structural_shadow_v22('Han sier at han ikke kommer. Jeg tror at han kommer.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('multi_sentence.count',jsonb_array_length(d#>'{document_graph,sentences}')=2));
 results:=results||jsonb_build_array(public.golden_assertion_v1('multi_sentence.isolation',d#>>'{document_graph,sentences,0,analysis,language_graph,subordinate_clause_foundation_v1,summary,resolved_clause_count}'='1' and d#>>'{document_graph,sentences,1,analysis,language_graph,subordinate_clause_foundation_v1,summary,resolved_clause_count}'='1',d#>'{document_graph,sentences}'));
 p:=public.analyze_text_structural_shadow_v22('Han sier at han ikke kommer. Jeg tror at han kommer.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.deterministic',d=p));

 select count(*),count(*) filter(where (x->>'passed')::boolean) into total,passed from jsonb_array_elements(results) x;
 return jsonb_build_object('version','subordinate-clause-foundation-golden-v1','batch_id',gen_random_uuid(),'total',total,'passed',passed,'failed',total-passed,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(results) x where not (x->>'passed')::boolean));
end;
$$;

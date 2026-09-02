create or replace function public.run_subordinate_construction_recognition_golden_v1(p_release_code text default 'runtime-structural-v1.34')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare
  tests jsonb:='[]'::jsonb;
  d jsonb; l jsonb; b jsonb; hot jsonb; inh jsonb; factinh jsonb; forms jsonb; sm jsonb; ped jsonb;
  n int; total int; passed int; failed int;
begin
  d:=public.analyze_text_structural_shadow_v34('Han sier at han ikke kommer.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.resolved_count',(l#>>'{summary,resolved_construction_count}')::int=1,jsonb_build_object('actual',l#>'{summary,resolved_construction_count}','expected',1)));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.family',l#>>'{constructions,0,construction_family}'='nominal_at_clause',jsonb_build_object('actual',l#>>'{constructions,0,construction_family}','expected','nominal_at_clause')));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.marker_relation',l#>>'{marker_relations,0,relation}'='mark',jsonb_build_object('actual',l#>>'{marker_relations,0,relation}','expected','mark')));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.marker_to_finite',(l#>>'{marker_relations,0,clause_head_token_index}')::int=6,jsonb_build_object('actual',l#>'{marker_relations,0,clause_head_token_index}','expected',6)));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.attachment_unresolved',l#>>'{constructions,0,attachment_status}'='unresolved',jsonb_build_object('actual',l#>>'{constructions,0,attachment_status}')));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('at.function_unresolved',l#>>'{constructions,0,syntactic_function}'='unresolved',jsonb_build_object('actual',l#>>'{constructions,0,syntactic_function}')));

  d:=public.analyze_text_structural_shadow_v34('Han dro for at han skulle hjelpe.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('for_at.hypothesis_count',(l#>>'{summary,hypothesis_count}')::int=1,l->'summary'));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('for_at.family',l#>>'{construction_hypotheses,0,construction_family}'='for_at_compound_subjunction_candidate',jsonb_build_object('actual',l#>>'{construction_hypotheses,0,construction_family}')));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('for_at.not_resolved',(l#>>'{summary,resolved_construction_count}')::int=0,l->'summary'));

  d:=public.analyze_text_structural_shadow_v34('Det skjedde slik at alle forstod.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('slik_at.hypothesis_count',(l#>>'{summary,hypothesis_count}')::int=1,l->'summary'));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('slik_at.family',l#>>'{construction_hypotheses,0,construction_family}'='slik_at_compound_subjunction_candidate',jsonb_build_object('actual',l#>>'{construction_hypotheses,0,construction_family}')));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('slik_at.not_resolved',(l#>>'{summary,resolved_construction_count}')::int=0,l->'summary'));

  d:=public.analyze_text_structural_shadow_v34('fordi han ikke reiser.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('fordi.foundation_resolved',(l#>>'{summary,resolved_construction_count}')::int=1,l->'summary'));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('fordi.family',l#>>'{constructions,0,construction_family}'='fordi_introduced_adverbial_clause',jsonb_build_object('actual',l#>>'{constructions,0,construction_family}')));

  d:=public.analyze_text_structural_shadow_v34('Han gikk fordi han var trøtt.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('embedded_fordi.conservative_hypothesis',(l#>>'{summary,hypothesis_count}')::int=1,l->'summary'));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('embedded_fordi.no_false_resolution',(l#>>'{summary,resolved_construction_count}')::int=0,l->'summary'));

  d:=public.analyze_text_structural_shadow_v34('Han reiser ikke.',p_release_code); l:=d#>'{document_graph,sentences,0,analysis,language_graph,subordinate_construction_recognition_v1}';
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('main.no_construction',(l#>>'{summary,resolved_construction_count}')::int=0 and (l#>>'{summary,hypothesis_count}')::int=0,l->'summary'));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('no_learner_error_claims',(l#>>'{summary,learner_error_claims}')::int=0,l->'summary'));

  hot:=public.runtime_hot_path_isolation_audit_v1('analyze_text_structural_shadow_v34');
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('architecture.hot_path_isolated',(hot->>'pass')::boolean,hot));
  inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('architecture.rule_inheritance',(inh->>'valid')::boolean,inh));
  factinh:=public.validate_runtime_materialized_fact_inheritance_v1(p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('architecture.runtime_fact_inheritance',(factinh->>'valid')::boolean,factinh));
  select count(*)::int into n from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('architecture.global_nrg_active_zero',n=0,jsonb_build_object('active_nrg',n)));
  select count(*)::int into n
  from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases cr on cr.id=rr.release_id
  where cr.code=p_release_code and not exists(
    select 1 from public.grammar_runtime_release_rules prr join public.grammar_runtime_releases pr on pr.id=prr.release_id
    where pr.code='runtime-structural-v1.33' and prr.rule_id=rr.rule_id
  );
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('architecture.child_only_rules_zero',n=0,jsonb_build_object('child_only_rules',n)));

  b:=public.plan_scoped_manifest_batch_dry_run_v2('word_order.subordinate_schema_b_core.v1',p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('applicability.schema_b_batch_still_blocked',b->>'batch_state'='blocked_applicability',b));
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('applicability.zero_materialization_allowed',(b->>'materialization_allowed_count')::int=0,b));

  forms:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('regression.forms_tenses_degrees',(forms->>'failed')::int=0,forms));
  sm:=public.run_sentence_model_golden_v2(p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('regression.sentence_model',(sm->>'failed')::int=0,sm));
  ped:=public.run_pedagogical_projection_golden_v1(p_release_code);
  tests:=tests||jsonb_build_array(public.golden_assertion_v1('regression.pedagogy',(ped->>'failed')::int=0,ped));

  total:=jsonb_array_length(tests);
  select count(*)::int into passed from jsonb_array_elements(tests) x where (x->>'passed')::boolean;
  failed:=total-passed;
  return jsonb_build_object('version','subordinate-construction-recognition-golden-v1','release_code',p_release_code,'total',total,'passed',passed,'failed',failed,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean),'tests',tests);
end;
$$;

create or replace function public.run_subordinate_construction_recognition_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.34',p_parent_release_code text default 'runtime-structural-v1.33',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
set search_path to 'public','pg_catalog'
as $$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code;
 select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
 if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
 if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v33','grammar-structural-shadow-v34',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_mode','parent_child_subordinate_construction_recognition_v1','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Subordinate Construction Recognition V1'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v32(c.input_text,p_parent_release_code);
   cd:=public.analyze_text_structural_shadow_v34(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v33','grammar-structural-shadow-v34');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v33','grammar-structural-shadow-v34',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$$;

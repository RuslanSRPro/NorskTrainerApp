create or replace function public.assess_runtime_rule_execution_v5(p_rule_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare r record; base jsonb;
begin
 select * into r from public.grammar_rules where id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 base:=public.assess_runtime_rule_execution_v4(p_rule_id);
 if r.pattern_type='morphological_inflection' then
   return (base-'reason_code') || jsonb_build_object(
     'status','ready',
     'version','runtime-rule-execution-assessment-v5',
     'execution_status','executable_via_morphological_inflection_operator_v1',
     'ready_without_runtime_code_change',true,
     'upstream_blockers','[]'::jsonb,
     'upstream_closure','morphological-inflection-operator-v1'
   );
 end if;
 return base||jsonb_build_object('version','runtime-rule-execution-assessment-v5');
end;
$$;

create or replace function public.run_activation_batch_materialization_pilot_golden_v1(p_release_code text default 'runtime-structural-v1.26')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare tests jsonb; v_blatt jsonb; v_enkel jsonb; v_gammel jsonb; v_morsom jsonb; v_assess_ready int; v_rules int; v_inactive int; v_sources int; v_child int; v_rel_rules int;
begin
 select count(*) into v_rules from public.grammar_rules where code in (
  'nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt',
  'nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion',
  'nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling');
 select count(*) into v_inactive from public.grammar_rules where code in (
  'nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt',
  'nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion',
  'nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling') and not is_active;
 select count(*) into v_sources from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id where gr.code in (
  'nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt',
  'nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion',
  'nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling') and gs.verification_status='source_verified';
 select count(*) into v_assess_ready from public.grammar_rules gr where gr.code in (
  'nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt',
  'nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion',
  'nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling') and coalesce((public.assess_runtime_rule_execution_v5(gr.id)->>'ready_without_runtime_code_change')::boolean,false);
 select count(*) into v_rel_rules from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id where r.code=p_release_code and gr.code in (
  'nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt',
  'nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion',
  'nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling') and rr.is_enabled;
 select coalesce((metadata->>'child_only_rules')::int,0) into v_child from public.grammar_runtime_releases where code=p_release_code;
 select public.execute_morphological_inflection_rule_v1(gr.id,l.id) into v_blatt from public.grammar_rules gr cross join public.lexemes l where gr.code='nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt' and l.lemma='blå' limit 1;
 select public.execute_morphological_inflection_rule_v1(gr.id,l.id) into v_enkel from public.grammar_rules gr cross join public.lexemes l where gr.code='nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion' and l.lemma='enkel' limit 1;
 select public.execute_morphological_inflection_rule_v1(gr.id,l.id) into v_gammel from public.grammar_rules gr cross join public.lexemes l where gr.code='nrg_rt_v1.adjective.agreement.class1.plural_el_en_er_vowel_deletion' and l.lemma='gammel' limit 1;
 select public.execute_morphological_inflection_rule_v1(gr.id,l.id) into v_morsom from public.grammar_rules gr cross join public.lexemes l where gr.code='nrg_rt_v1.adjective.agreement.class1.plural_final_m_doubling' and l.lemma='morsom' limit 1;
 tests:=jsonb_build_array(
  jsonb_build_object('code','rules.materialized.3','passed',v_rules=3),
  jsonb_build_object('code','rules.globally_inactive.3','passed',v_inactive=3),
  jsonb_build_object('code','release.child_rules.3','passed',v_child=3 and v_rel_rules=3),
  jsonb_build_object('code','source_provenance.3','passed',v_sources=3),
  jsonb_build_object('code','assessment.ready.3','passed',v_assess_ready=3),
  jsonb_build_object('code','blå_to_blått','passed',coalesce((v_blatt->>'matched')::boolean,false)),
  jsonb_build_object('code','enkel_to_enkle','passed',coalesce((v_enkel->>'matched')::boolean,false)),
  jsonb_build_object('code','morsom_to_morsomme','passed',coalesce((v_morsom->>'matched')::boolean,false)),
  jsonb_build_object('code','gammel_composition_deferred','passed',v_gammel->>'status'='no_match'),
  jsonb_build_object('code','productive_generation.false','passed',coalesce((v_blatt->>'productive_generation')::boolean,true)=false and coalesce((v_enkel->>'productive_generation')::boolean,true)=false and coalesce((v_morsom->>'productive_generation')::boolean,true)=false),
  jsonb_build_object('code','active_nrg.zero','passed',(select count(*)=0 from public.grammar_rules where is_active and code like 'nrg_rt_v1.%')),
  jsonb_build_object('code','immutable.tokenize_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'),
  jsonb_build_object('code','immutable.core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'),
  jsonb_build_object('code','immutable.tokenize_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52')
 );
 return jsonb_build_object('version','activation-batch-materialization-pilot-golden-v1','release_code',p_release_code,'total',jsonb_array_length(tests),'passed',(select count(*) from jsonb_array_elements(tests) x where (x->>'passed')::boolean),'failed',(select count(*) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean),'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean),'tests',tests);
end;
$$;

create or replace function public.promote_compiler_execution_closure_release_to_shadow_v2(
 p_golden_batch uuid,
 p_comparator_batch uuid,
 p_release_code text default 'runtime-structural-v1.20')
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; v_g_total int; v_g_pass int; v_cmp_total int; v_cmp_parity int; v_cmp_errors int; v_exp_total int; v_exp_pass int; v_inh jsonb; v_active int; v_child int; v_summary jsonb; v_h1 text; v_h2 text; v_h3 text;
begin
 select * into r from public.grammar_runtime_releases where code=p_release_code;
 if r.id is null or r.status<>'golden' then raise exception 'Release % must be golden',p_release_code; end if;
 select count(*),count(*) filter(where passed) into v_g_total,v_g_pass from public.grammar_golden_test_runs where run_batch_id=p_golden_batch and runtime_release_id=r.id and evaluator_version='compiler-execution-closure-golden-v2';
 if v_g_total<>24 or v_g_pass<>24 then raise exception 'Golden gate failed %/%',v_g_pass,v_g_total; end if;
 select count(*),count(*) filter(where classification='parity'),count(*) filter(where execution_status='error') into v_cmp_total,v_cmp_parity,v_cmp_errors
 from public.grammar_shadow_v2_comparisons where batch_id=p_comparator_batch;
 if v_cmp_total<>34 or v_cmp_parity<>34 or v_cmp_errors<>0 then raise exception 'Comparator gate failed total %, parity %, errors %',v_cmp_total,v_cmp_parity,v_cmp_errors; end if;
 select count(*),count(*) filter(where coalesce((public.evaluate_grammar_shadow_v2_expectations(cc.expectations,c.shadow_projection,c.comparison)->>'passed')::boolean,false))
 into v_exp_total,v_exp_pass
 from public.grammar_shadow_v2_comparisons c join public.grammar_shadow_v2_corpus_cases cc on cc.id=c.case_id
 where c.batch_id=p_comparator_batch and cc.expectations<>'{}'::jsonb and cc.expectations<>'[]'::jsonb;
 if v_exp_total<>26 or v_exp_pass<>26 then raise exception 'Expectation gate failed %/%',v_exp_pass,v_exp_total; end if;
 v_inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,r.metadata->>'parent_release');
 if not coalesce((v_inh->>'valid')::boolean,false) then raise exception 'Inheritance gate failed: %',v_inh; end if;
 select count(*) into v_active from public.grammar_rules where is_active and code like 'nrg_rt_v1.%';
 if v_active<>0 then raise exception 'Active NRG gate failed: %',v_active; end if;
 select count(*) into v_child from public.grammar_runtime_release_rules rr where rr.release_id=r.id and not exists(
   select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code=r.metadata->>'parent_release' and pr.rule_id=rr.rule_id
 );
 if v_child<>0 then raise exception 'Child-only rule gate failed: %',v_child; end if;
 select md5(pg_get_functiondef(p.oid)) into v_h1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_simple' limit 1;
 select md5(pg_get_functiondef(p.oid)) into v_h2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v1' and pg_get_function_identity_arguments(p.oid)='p_text text, p_release_code text' limit 1;
 select md5(pg_get_functiondef(p.oid)) into v_h3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tokenize_text_v2' limit 1;
 if v_h1<>'40819fa48cc6e48372cbf42275f2bb0c' or v_h2<>'b15193a826907ea6082a1aae52f15fec' or v_h3<>'f76f85eee4469e74079a101da442ec52' then raise exception 'Immutable hash gate failed %, %, %',v_h1,v_h2,v_h3; end if;
 v_summary:=public.compiler_execution_closure_summary_v2(p_release_code);
 if not coalesce((v_summary#>>'{summary,compiler_closed}')::boolean,false) or (v_summary#>>'{execution,summary,unsupported_or_unmapped}')::int<>0 then raise exception 'Closure summary gate failed: %',v_summary->'summary'; end if;
 update public.grammar_shadow_v2_batches set status='reviewed',metadata=metadata||jsonb_build_object('causal_review','passed','promotion_gate','compiler-execution-closure-v2-shadow-gate-v1') where id=p_comparator_batch;
 update public.grammar_runtime_releases set status='shadow',metadata=metadata||jsonb_build_object(
  'promotion_gate','compiler-execution-closure-v2-shadow-gate-v1','compiler_execution_golden_batch',p_golden_batch,'compiler_execution_comparator_batch',p_comparator_batch,
  'compiler_exact_parity','14/14 manifests; 15/15 outputs','execution_registry','7 pattern types; 0 unsupported','current_rules_ready',7,'current_rules_upstream_blocked',8,
  'representative_compiled_ready','6/8','bulk_activation_ready',false,'next_layer','Upstream Capability Closure V1'
 ) where id=r.id;
 return jsonb_build_object('status','promoted','release_code',p_release_code,'golden','24/24','comparator','34/34','machine_expectations','26/26','active_nrg',v_active,'child_only_rules',v_child,'immutable_hashes','pass','bulk_activation_ready',false,'next_layer','Upstream Capability Closure V1');
end;
$function$;

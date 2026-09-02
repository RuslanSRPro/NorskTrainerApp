create or replace function public.promote_upstream_capability_closure_release_to_shadow_v1(p_comparator_batch uuid,p_release_code text default 'runtime-structural-v1.21')
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; g jsonb; pg jsonb; sm jsonb; b record; parity int; exp_total int; exp_pass int; vals jsonb; ev text; expected_count int; pass_count int; fail_count int; inh jsonb; active int; child_rules int; h1 text; h2 text; h3 text; ex jsonb; rep jsonb;
begin
 select * into r from public.grammar_runtime_releases where code=p_release_code;
 if r.id is null or r.status<>'golden' then raise exception 'Release % must be golden',p_release_code; end if;
 if (select status from public.grammar_runtime_releases where code=r.metadata->>'parent_release')<>'shadow' then raise exception 'Parent must be shadow'; end if;
 g:=public.run_upstream_capability_closure_golden_v1(p_release_code);
 if (g->>'total')::int<>39 or (g->>'passed')::int<>39 or (g->>'failed')::int<>0 then raise exception 'Upstream Closure Golden failed: %',g; end if;
 pg:=public.run_pedagogical_projection_golden_v1(p_release_code); sm:=public.run_sentence_model_golden_v2(p_release_code);
 if (pg->>'passed')::int<>36 or (pg->>'failed')::int<>0 then raise exception 'Pedagogy gate failed: %',pg; end if;
 if (sm->>'passed')::int<>36 or (sm->>'failed')::int<>0 then raise exception 'Sentence Model gate failed: %',sm; end if;
 select * into b from public.grammar_shadow_v2_batches where id=p_comparator_batch and runtime_release_id=r.id;
 if b.id is null or b.status not in ('completed','reviewed') or b.expected_cases<>34 or b.completed_cases<>34 or b.error_cases<>0 then raise exception 'Comparator batch incomplete'; end if;
 select count(*) into parity from public.grammar_shadow_v2_comparisons where batch_id=p_comparator_batch and execution_status='completed' and classification='parity';
 if parity<>34 then raise exception 'Comparator parity failed %',parity; end if;
 select count(*),count(*) filter(where coalesce((public.evaluate_grammar_shadow_v2_expectations(cc.expectations,c.shadow_projection,c.comparison)->>'passed')::boolean,false))
 into exp_total,exp_pass
 from public.grammar_shadow_v2_comparisons c join public.grammar_shadow_v2_corpus_cases cc on cc.id=c.case_id
 where c.batch_id=p_comparator_batch and cc.expectations<>'{}'::jsonb and cc.expectations<>'[]'::jsonb;
 if exp_total<>26 or exp_pass<>26 then raise exception 'Machine expectations failed %/%',exp_pass,exp_total; end if;
 vals:=jsonb_build_object(
  'interpretation-golden-v2',33,'grammar-validation-golden-v2',26,'dependency-build-golden-v2',24,'clause-build-golden-v1',24,'predicate-build-golden-v1',24,
  'construction-resolution-golden-v1',24,'construction-recognition-golden-v1',23,'structural-pos-refinement-golden-v1',18,'phrase-build-golden-v1',18,
  'local-pos-disambiguation-golden-v1',21,'morphological-disambiguation-golden-v1',14,'lexical-class-resolver-v1',10,'structural-golden-v1',12,
  'structural-dependency-golden-v1.1-surface-normalized',7,'structural-tokenizer-integration-golden-v1',7,'sentence-segmentation-integration-golden-v1',6);
 for ev,expected_count in select key,(value::text)::int from jsonb_each(vals) loop
  select count(*) filter(where passed)::int,count(*) filter(where not passed)::int into pass_count,fail_count
  from public.grammar_golden_test_runs where runtime_release_id=r.id and evaluator_version=ev
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=r.id and evaluator_version=ev order by created_at desc limit 1);
  if coalesce(pass_count,0)<>expected_count or coalesce(fail_count,0)<>0 then raise exception 'Inherited gate % failed passed=% failed=% expected=%',ev,pass_count,fail_count,expected_count; end if;
 end loop;
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,r.metadata->>'parent_release'); if not coalesce((inh->>'valid')::boolean,false) then raise exception 'Inheritance failed %',inh; end if;
 select count(*) into active from public.grammar_rules where is_active and code like 'nrg_rt_v1.%'; if active<>0 then raise exception 'Active NRG failed %',active; end if;
 select count(*) into child_rules from public.grammar_runtime_release_rules cr where cr.release_id=r.id and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code=r.metadata->>'parent_release' and pr.rule_id=cr.rule_id);
 if child_rules<>0 then raise exception 'Child rules failed %',child_rules; end if;
 select md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure)) into h1; select md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure)) into h2; select md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure)) into h3;
 if h1<>'40819fa48cc6e48372cbf42275f2bb0c' or h2<>'b15193a826907ea6082a1aae52f15fec' or h3<>'f76f85eee4469e74079a101da442ec52' then raise exception 'Immutable hashes failed %,%,%',h1,h2,h3; end if;
 ex:=public.audit_execution_family_closure_v3(p_release_code); rep:=public.audit_representative_rule_suite_execution_v3('representative-rule-suite-v1');
 if (ex#>>'{summary,ready_without_runtime_code_change}')::int<>12 or (ex#>>'{summary,registered_but_blocked}')::int<>3 or (ex#>>'{summary,unsupported_or_unmapped}')::int<>0 then raise exception 'Execution closure counts failed %',ex->'summary'; end if;
 if (rep#>>'{summary,compiled_candidates_fully_ready}')::int<>7 or (rep#>>'{summary,compiled_candidates_partially_ready}')::int<>1 then raise exception 'Representative closure counts failed %',rep->'summary'; end if;
 update public.grammar_shadow_v2_batches set status='reviewed',metadata=metadata||jsonb_build_object('causal_review','passed','promotion_gate','upstream-capability-closure-v1-shadow-gate-v1') where id=p_comparator_batch;
 update public.grammar_runtime_releases set status='shadow',metadata=metadata||jsonb_build_object(
  'promotion_gate','upstream-capability-closure-v1-shadow-gate-v1','upstream_closure_comparator_batch',p_comparator_batch,'upstream_closure_golden','39/39',
  'current_rules_ready',12,'current_rules_upstream_blocked',3,'representative_fully_ready',7,'representative_partially_ready',1,'bulk_activation_ready',false,
  'remaining_blockers',jsonb_build_array('schema_B_subordinate_default','connector_field_subordinate','relative_order_schema_B'),'next_layer','Subordinate Clause Foundation V1',
  'immutable_hash_gate',jsonb_build_object('legacy_tokenizer',h1,'structural_core_v1',h2,'tokenizer_v2',h3)) where id=r.id;
 return jsonb_build_object('status','promoted','release_code',p_release_code,'golden','39/39','pedagogy','36/36','sentence_model','36/36','comparator','34/34','machine_expectations','26/26','current_rules_ready',12,'current_rules_blocked',3,'active_nrg',active,'child_only_rules',child_rules,'immutable_hashes','pass','bulk_activation_ready',false,'next_layer','Subordinate Clause Foundation V1');
end;
$function$;

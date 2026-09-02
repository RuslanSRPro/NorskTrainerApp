create or replace function public.promote_pedagogical_projection_release_to_shadow_v1(
  p_batch_id uuid,
  p_release_code text default 'runtime-structural-v1.16'
)
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  rid uuid; st text; parent text; parent_st text; b record; parity int; expect int; active int; child_rules int;
  pg jsonb; sm jsonb; vals jsonb; ev text; expected_count int; pass_count int; fail_count int;
  legacy_hash text; core_hash text; tok_hash text;
begin
  select id,status,metadata->>'parent_release' into rid,st,parent from public.grammar_runtime_releases where code=p_release_code;
  if rid is null or st not in ('golden','shadow') then raise exception 'Release must be golden/shadow'; end if;
  select status into parent_st from public.grammar_runtime_releases where code=parent;
  if parent_st<>'shadow' then raise exception 'Parent % must be shadow',parent; end if;

  pg:=public.run_pedagogical_projection_golden_v1(p_release_code);
  if (pg->>'total')::int<>36 or (pg->>'passed')::int<>36 or (pg->>'failed')::int<>0 then raise exception 'Pedagogical Projection Golden gate failed: %',pg; end if;
  sm:=public.run_sentence_model_golden_v2(p_release_code);
  if (sm->>'total')::int<>36 or (sm->>'passed')::int<>36 or (sm->>'failed')::int<>0 then raise exception 'Sentence Model Golden gate failed: %',sm; end if;

  select * into b from public.grammar_shadow_v2_batches where id=p_batch_id and runtime_release_id=rid;
  if b.id is null or b.status not in ('completed','reviewed') or b.expected_cases<>34 or b.completed_cases<>34 or b.error_cases<>0 then raise exception 'Comparator batch incomplete'; end if;
  select count(*)::int into parity from public.grammar_shadow_v2_comparisons where batch_id=p_batch_id and execution_status='completed' and classification='parity';
  expect:=coalesce((b.metadata#>>'{comparator_v2_2,expectations,passed_cases}')::int,0);
  if parity<>34 or expect<>18 then raise exception 'Comparator gate failed parity=% expectations=%',parity,expect; end if;

  vals:=jsonb_build_object(
    'interpretation-golden-v2',33,'grammar-validation-golden-v2',26,'dependency-build-golden-v2',24,
    'clause-build-golden-v1',24,'predicate-build-golden-v1',24,'construction-resolution-golden-v1',24,
    'construction-recognition-golden-v1',23,'structural-pos-refinement-golden-v1',18,'phrase-build-golden-v1',18,
    'local-pos-disambiguation-golden-v1',21,'morphological-disambiguation-golden-v1',14,'lexical-class-resolver-v1',10,
    'structural-golden-v1',12,'structural-dependency-golden-v1.1-surface-normalized',7,
    'structural-tokenizer-integration-golden-v1',7,'sentence-segmentation-integration-golden-v1',6
  );
  for ev,expected_count in select key,(value::text)::int from jsonb_each(vals) loop
    select count(*) filter(where passed)::int,count(*) filter(where not passed)::int into pass_count,fail_count
    from public.grammar_golden_test_runs
    where runtime_release_id=rid and evaluator_version=ev
      and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=rid and evaluator_version=ev order by created_at desc limit 1);
    if coalesce(pass_count,0)<>expected_count or coalesce(fail_count,0)<>0 then raise exception 'Inherited gate % failed passed=% failed=% expected=%',ev,pass_count,fail_count,expected_count; end if;
  end loop;

  select count(*)::int into active from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
  select count(*)::int into child_rules from public.grammar_runtime_release_rules cr
  where cr.release_id=rid and cr.is_enabled and not exists(
    select 1 from public.grammar_runtime_releases pr join public.grammar_runtime_release_rules rr on rr.release_id=pr.id
    where pr.code=parent and rr.rule_id=cr.rule_id and rr.is_enabled
  );
  if active<>0 or child_rules<>0 then raise exception 'Isolation failed active=% child_rules=%',active,child_rules; end if;

  select md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure)) into legacy_hash;
  select md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure)) into core_hash;
  select md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure)) into tok_hash;
  if legacy_hash<>'40819fa48cc6e48372cbf42275f2bb0c' or core_hash<>'b15193a826907ea6082a1aae52f15fec' or tok_hash<>'f76f85eee4469e74079a101da442ec52' then
    raise exception 'Immutable hash gate failed legacy=% core=% tok=%',legacy_hash,core_hash,tok_hash;
  end if;

  update public.grammar_runtime_releases set status='shadow',metadata=metadata||jsonb_build_object(
    'shadow_v2_batch_id',p_batch_id,'shadow_v2_baseline',parent,'shadow_v2_corpus_size',34,
    'promotion_gate_version','pedagogical-projection-v1-shadow-gate-v1','promotion_pedagogical_projection_gate',36,
    'promotion_sentence_model_gate',36,'promotion_interpretation_gate',33,'promotion_grammar_validation_gate',26,
    'promotion_dependency_build_v2_gate',24,'promotion_clause_build_gate',24,'promotion_predicate_build_gate',24,
    'promotion_construction_resolution_gate',24,'promotion_construction_recognition_gate',23,'promotion_structural_pos_gate',18,
    'promotion_phrase_build_gate',18,'promotion_local_pos_gate',21,'promotion_morphology_gate',14,'promotion_lexical_gate',10,
    'promotion_structural_gate',12,'promotion_dependency_v1_gate',7,'promotion_tokenizer_integration_gate',7,
    'promotion_segmentation_integration_gate',6,'promotion_single_sentence_parity',34,'promotion_machine_expectations',18,
    'promotion_child_only_rules',0,'immutable_hash_gate',jsonb_build_object('legacy_tokenizer',legacy_hash,'structural_core_v1',core_hash,'tokenizer_v2',tok_hash)
  ) where id=rid;

  update public.grammar_shadow_v2_batches set status='reviewed',metadata=metadata||jsonb_build_object(
    'promotion','golden_to_shadow','promotion_gate_version','pedagogical-projection-v1-shadow-gate-v1',
    'causal_review',jsonb_build_object(
      'reviewed',true,'capability','Pedagogical Projection V1','comparison',parent||' -> '||p_release_code,
      'strict_parity_cases',34,'machine_expectations_passed',18,
      'interpretation','Pedagogical Projection V1 is an additive learner-facing projection; all Sentence Model V2 and upstream analysis remain identical.'
    )
  ),updated_at=now() where id=p_batch_id;

  return jsonb_build_object(
    'release_code',p_release_code,'release_status','shadow','parent_release',parent,'batch_id',p_batch_id,'batch_status','reviewed',
    'pedagogical_projection_golden',36,'sentence_model_golden',36,'interpretation_golden',33,'grammar_validation_golden',26,
    'dependency_build_v2_golden',24,'clause_build_golden',24,'predicate_build_golden',24,'construction_resolution_golden',24,
    'construction_recognition_golden',23,'structural_pos_golden',18,'phrase_build_golden',18,'local_pos_golden',21,
    'morphology_golden',14,'lexical',10,'structural',12,'dependency_v1',7,'tokenizer_integration',7,'segmentation_integration',6,
    'single_sentence_parity',34,'machine_expectations',18,'active_nrg_rules',active,'child_only_rules',child_rules,
    'promotion_gate_version','pedagogical-projection-v1-shadow-gate-v1'
  );
end;
$function$;

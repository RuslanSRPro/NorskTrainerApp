create or replace function public.run_local_pos_disambiguation_shadow_comparator_v1(
  p_release_code text default 'runtime-structural-v1.5',
  p_parent_release_code text default 'runtime-structural-v1.4',
  p_corpus_version text default 'shadow-corpus-v2.0'
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_child_id uuid;
  v_child_status text;
  v_parent_status text;
  v_expected integer;
  v_batch uuid;
  c record;
  v_parent_doc jsonb;
  v_child_doc jsonb;
  v_parent jsonb;
  v_child jsonb;
  v_bp jsonb;
  v_sp jsonb;
  v_cmp jsonb;
begin
  select id,status into v_child_id,v_child_status
  from public.grammar_runtime_releases where code=p_release_code;
  if v_child_id is null then raise exception 'Child release % not found',p_release_code; end if;
  if v_child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow, got %',v_child_status; end if;

  select status into v_parent_status
  from public.grammar_runtime_releases where code=p_parent_release_code;
  if v_parent_status<>'shadow' then raise exception 'Parent % must be shadow, got %',p_parent_release_code,v_parent_status; end if;

  select count(*)::int into v_expected
  from public.grammar_shadow_v2_corpus_cases
  where corpus_version=p_corpus_version and is_active;
  if v_expected<>34 then raise exception 'Local POS comparator expects 34 active cases, got %',v_expected; end if;

  insert into public.grammar_shadow_v2_batches(
    runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,
    active_legacy_rule_checksum,status,expected_cases,metadata,started_at
  ) values(
    v_child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v4','grammar-structural-shadow-v5',
    public.grammar_shadow_v2_legacy_rule_checksum(),'running',v_expected,
    jsonb_build_object(
      'comparison_contract','grammar-shadow-comparison-v2.2',
      'evaluation_contract','grammar-shadow-comparator-v2.2',
      'comparison_mode','parent_child_local_pos_disambiguation_causal',
      'parent_release',p_parent_release_code,
      'child_release',p_release_code,
      'single_capability','Local POS Disambiguation V1',
      'child_projection','document_graph.sentences[0].analysis; local_pos_v1 excluded from common semantic projection',
      'legacy_is_oracle',false
    ),clock_timestamp()
  ) returning id into v_batch;

  for c in
    select id,code,input_text
    from public.grammar_shadow_v2_corpus_cases
    where corpus_version=p_corpus_version and is_active
    order by code
  loop
    begin
      v_parent_doc := public.analyze_text_structural_shadow_v4(c.input_text,p_parent_release_code);
      v_child_doc := public.analyze_text_structural_shadow_v5(c.input_text,p_release_code);
      v_parent := coalesce(v_parent_doc#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
      v_child := coalesce(v_child_doc#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
      v_bp := public.project_structural_grammar_shadow_v2(v_parent);
      v_sp := public.project_structural_grammar_shadow_v2(v_child);
      v_cmp := public.compare_grammar_shadow_v2(v_bp,v_sp);

      insert into public.grammar_shadow_v2_comparisons(
        batch_id,case_id,case_code,input_text,execution_status,classification,labels,
        baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,
        baseline_duration_ms,shadow_duration_ms,baseline_version,shadow_version,error_message
      ) values(
        v_batch,c.id,c.code,c.input_text,'completed',v_cmp->>'classification',coalesce(v_cmp->'labels','[]'::jsonb),
        v_parent,v_child,v_bp,v_sp,v_cmp,null,null,
        'grammar-structural-shadow-v4','grammar-structural-shadow-v5',null
      );
    exception when others then
      insert into public.grammar_shadow_v2_comparisons(
        batch_id,case_id,case_code,input_text,execution_status,classification,labels,
        baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,
        baseline_version,shadow_version,error_message
      ) values(
        v_batch,c.id,c.code,c.input_text,'error',null,'[]'::jsonb,
        '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,
        'grammar-structural-shadow-v4','grammar-structural-shadow-v5',sqlerrm
      );
    end;
  end loop;

  perform public.finalize_grammar_shadow_v2_batch(v_batch);
  return v_batch;
end;
$function$;

create or replace function public.promote_local_pos_disambiguation_release_to_shadow_v1(
  p_batch_id uuid,
  p_release_code text default 'runtime-structural-v1.5'
)
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid;
  v_status text;
  v_parent text;
  v_parent_status text;
  v_batch record;
  v_local_total integer;
  v_local_pass integer;
  v_morph_total integer;
  v_morph_pass integer;
  v_lex_pass integer;
  v_struct_pass integer;
  v_dep_pass integer;
  v_tok_pass integer;
  v_seg_pass integer;
  v_active integer;
  v_child_rules integer;
  v_parity integer;
  v_expect integer;
begin
  select id,status,metadata->>'parent_release'
  into v_release_id,v_status,v_parent
  from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  if v_status not in ('golden','shadow') then raise exception 'Release must be golden/shadow, got %',v_status; end if;

  select status into v_parent_status from public.grammar_runtime_releases where code=v_parent;
  if v_parent_status<>'shadow' then raise exception 'Parent % must be shadow',v_parent; end if;

  select * into v_batch
  from public.grammar_shadow_v2_batches
  where id=p_batch_id and runtime_release_id=v_release_id;
  if v_batch.id is null then raise exception 'Comparator batch not found for release'; end if;
  if v_batch.status not in ('completed','reviewed')
     or v_batch.expected_cases<>34
     or v_batch.completed_cases<>34
     or v_batch.error_cases<>0 then
    raise exception 'Comparator batch incomplete: status %, expected %, completed %, errors %',
      v_batch.status,v_batch.expected_cases,v_batch.completed_cases,v_batch.error_cases;
  end if;

  select count(*)::int into v_parity
  from public.grammar_shadow_v2_comparisons
  where batch_id=p_batch_id and execution_status='completed' and classification='parity';
  if v_parity<>34 then raise exception 'Comparator strict parity requires 34, got %',v_parity; end if;

  v_expect := coalesce((v_batch.metadata#>>'{comparator_v2_2,expectations,passed_cases}')::integer,0);
  if v_expect<>18 then raise exception 'Machine expectations require 18, got %',v_expect; end if;

  select count(*)::int,count(*) filter(where passed)::int
  into v_local_total,v_local_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id
    and evaluator_version='local-pos-disambiguation-golden-v1'
    and run_batch_id=(
      select run_batch_id from public.grammar_golden_test_runs
      where runtime_release_id=v_release_id and evaluator_version='local-pos-disambiguation-golden-v1'
      order by created_at desc limit 1
    );
  if v_local_total<>21 or v_local_pass<>21 then
    raise exception 'Local POS Golden requires 21/21, got %/%',v_local_pass,v_local_total;
  end if;

  select count(*)::int,count(*) filter(where passed)::int
  into v_morph_total,v_morph_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id
    and evaluator_version='morphological-disambiguation-golden-v1'
    and run_batch_id=(
      select run_batch_id from public.grammar_golden_test_runs
      where runtime_release_id=v_release_id and evaluator_version='morphological-disambiguation-golden-v1'
      order by created_at desc limit 1
    );
  if v_morph_total<>14 or v_morph_pass<>14 then
    raise exception 'Morphology Golden requires 14/14, got %/%',v_morph_pass,v_morph_total;
  end if;

  select count(*) filter(where passed)::int into v_lex_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id and evaluator_version='lexical-class-resolver-v1'
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=v_release_id and evaluator_version='lexical-class-resolver-v1' order by created_at desc limit 1);

  select count(*) filter(where passed)::int into v_struct_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id and evaluator_version='structural-golden-v1'
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=v_release_id and evaluator_version='structural-golden-v1' order by created_at desc limit 1);

  select count(*) filter(where passed)::int into v_dep_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id and evaluator_version='structural-dependency-golden-v1.1-surface-normalized'
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=v_release_id and evaluator_version='structural-dependency-golden-v1.1-surface-normalized' order by created_at desc limit 1);

  select count(*) filter(where passed)::int into v_tok_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id and evaluator_version='structural-tokenizer-integration-golden-v1'
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=v_release_id and evaluator_version='structural-tokenizer-integration-golden-v1' order by created_at desc limit 1);

  select count(*) filter(where passed)::int into v_seg_pass
  from public.grammar_golden_test_runs
  where runtime_release_id=v_release_id and evaluator_version='sentence-segmentation-integration-golden-v1'
    and run_batch_id=(select run_batch_id from public.grammar_golden_test_runs where runtime_release_id=v_release_id and evaluator_version='sentence-segmentation-integration-golden-v1' order by created_at desc limit 1);

  if v_lex_pass<>10 or v_struct_pass<>12 or v_dep_pass<>7 or v_tok_pass<>7 or v_seg_pass<>6 then
    raise exception 'Inherited gates incomplete lexical=% structural=% dependency=% tokenizer=% segmentation=%',
      v_lex_pass,v_struct_pass,v_dep_pass,v_tok_pass,v_seg_pass;
  end if;

  select count(*)::int into v_active
  from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
  if v_active<>0 then raise exception 'Active NRG rules must remain 0, got %',v_active; end if;

  select count(*)::int into v_child_rules
  from public.grammar_runtime_release_rules cr
  where cr.release_id=v_release_id and cr.is_enabled and not exists(
    select 1
    from public.grammar_runtime_releases pr
    join public.grammar_runtime_release_rules rr on rr.release_id=pr.id
    where pr.code=v_parent and rr.rule_id=cr.rule_id and rr.is_enabled
  );
  if v_child_rules<>0 then raise exception 'Local POS infrastructure child must add 0 grammar rules, got %',v_child_rules; end if;

  update public.grammar_runtime_releases
  set status='shadow',
      metadata=metadata||jsonb_build_object(
        'shadow_v2_batch_id',p_batch_id,
        'shadow_v2_baseline',v_parent,
        'shadow_v2_corpus_size',34,
        'shadow_v2_legacy_is_oracle',false,
        'promotion_gate_version','local-pos-disambiguation-shadow-gate-v1',
        'promotion_local_pos_gate',21,
        'promotion_morphology_gate',14,
        'promotion_lexical_gate',10,
        'promotion_structural_gate',12,
        'promotion_dependency_gate',7,
        'promotion_tokenizer_integration_gate',7,
        'promotion_segmentation_integration_gate',6,
        'promotion_single_sentence_parity',34,
        'promotion_machine_expectations',18,
        'promotion_child_only_rules',0
      )
  where id=v_release_id;

  update public.grammar_shadow_v2_batches
  set status='reviewed',
      metadata=metadata||jsonb_build_object(
        'promotion','golden_to_shadow',
        'promotion_gate_version','local-pos-disambiguation-shadow-gate-v1',
        'causal_review',jsonb_build_object(
          'reviewed',true,
          'capability','Local POS Disambiguation V1',
          'comparison',v_parent||' -> '||p_release_code,
          'strict_parity_cases',34,
          'machine_expectations_passed',18,
          'interpretation','New local_pos_v1 evidence layer is additive; existing structural semantic projection remains strict parity.'
        )
      ),
      updated_at=now()
  where id=p_batch_id;

  return jsonb_build_object(
    'release_code',p_release_code,
    'release_status','shadow',
    'parent_release',v_parent,
    'batch_id',p_batch_id,
    'batch_status','reviewed',
    'local_pos_golden',21,
    'morphology_golden',14,
    'lexical',10,
    'structural',12,
    'dependency',7,
    'tokenizer_integration',7,
    'segmentation_integration',6,
    'single_sentence_parity',34,
    'machine_expectations',18,
    'active_nrg_rules',0,
    'child_only_rules',0,
    'promotion_gate_version','local-pos-disambiguation-shadow-gate-v1'
  );
end;
$function$;;

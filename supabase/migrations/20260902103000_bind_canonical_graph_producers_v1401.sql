begin;

-- Canonical Language Graph runtime binding v1.40.1
--
-- Idempotent migration:
--   * accepts the original v1.40 registry pre-state
--   * accepts the already-applied v1.40.1 post-state
--   * aborts on any third/partially-mutated state
--
-- Does NOT modify:
--   * grammar_language_contract_registry_v1
--   * canonical-language-graph-v1 core contract
--   * global_activation
--   * production grammar-analysis-orchestrator

do $$
declare
  v_pre_state boolean := false;
  v_post_state boolean := false;
begin
  with expected(
    producer_code,
    producer_version,
    source_layer_code,
    adapter_status,
    runtime_bound,
    implementation_hash
  ) as (
    values
      ('canonical_surface_adapter_v1','1','canonical-surface-boundary-v1','contract_ready',false,'sha256:86e691c8a2edf80bd4f0832a63d7cb1158e5583f7dd5f209372118ddff3e868f'),
      ('legacy_attachment_adapter_v1','1','clause_attachment_function_v1','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_clause_adapter_v1','1','clause_build_v1','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_morphology_adapter_v1','1','morphology','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_mwe_adapter_v1','1','multiword_function_expression_v1','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_phrase_adapter_v1','1','phrase_build_v1','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_pos_adapter_v1','1','local_pos+structural_pos','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc'),
      ('legacy_predicate_adapter_v1','1','predicate_build_v1','contract_ready',false,'sha256:81b7da125d0c64c509c5c95f8d19e76fff9822bd92eb16a0696e5b54909ce4fc')
  ),
  matches as (
    select count(*) as n
    from expected e
    join public.grammar_language_graph_producer_registry_v1 r
      on r.producer_code = e.producer_code
     and r.producer_version = e.producer_version
     and r.source_layer_code = e.source_layer_code
     and r.adapter_status = e.adapter_status
     and r.runtime_bound = e.runtime_bound
     and r.implementation_hash is not distinct from e.implementation_hash
  )
  select
    (n = 8)
    and not exists (
      select 1
      from public.grammar_language_graph_producer_registry_v1
      where producer_code = 'legacy_dependency_adapter_v1'
    )
  into v_pre_state
  from matches;

  with expected(
    producer_code,
    producer_version,
    source_layer_code,
    adapter_status,
    runtime_bound
  ) as (
    values
      ('canonical_surface_adapter_v1','1','canonical-surface-boundary-v1','runtime_bound',true),
      ('legacy_attachment_adapter_v1','1.1','clause_attachment_function_v1','contract_ready',false),
      ('legacy_clause_adapter_v1','1.1','clause_build_v1','runtime_bound',true),
      ('legacy_dependency_adapter_v1','1.1','dependency_build_v2','runtime_bound',true),
      ('legacy_morphology_adapter_v1','1.1','morphology','runtime_bound',true),
      ('legacy_mwe_adapter_v1','1.1','multiword_function_expression_v1','runtime_bound',true),
      ('legacy_phrase_adapter_v1','1.1','phrase_build_v1','runtime_bound',true),
      ('legacy_pos_adapter_v1','1.1','local_pos+structural_pos','runtime_bound',true),
      ('legacy_predicate_adapter_v1','1.1','predicate_build_v1','runtime_bound',true)
  ),
  matches as (
    select count(*) as n
    from expected e
    join public.grammar_language_graph_producer_registry_v1 r
      on r.producer_code = e.producer_code
     and r.producer_version = e.producer_version
     and r.source_layer_code = e.source_layer_code
     and r.adapter_status = e.adapter_status
     and r.runtime_bound = e.runtime_bound
  )
  select n = 9
  into v_post_state
  from matches;

  if v_post_state then
    return;
  end if;

  if not v_pre_state then
    raise exception
      'v1.40.1 producer registry binding aborted: registry is neither the expected pre-state nor the expected post-state';
  end if;

  update public.grammar_language_graph_producer_registry_v1
  set
    adapter_status = 'runtime_bound',
    runtime_bound = true,
    updated_at = now()
  where producer_code = 'canonical_surface_adapter_v1';

  update public.grammar_language_graph_producer_registry_v1
  set
    producer_version = '1.1',
    adapter_status = case
      when producer_code = 'legacy_attachment_adapter_v1'
        then 'contract_ready'
      else 'runtime_bound'
    end,
    runtime_bound = case
      when producer_code = 'legacy_attachment_adapter_v1'
        then false
      else true
    end,
    implementation_hash = null,
    updated_at = now()
  where producer_code in (
    'legacy_attachment_adapter_v1',
    'legacy_clause_adapter_v1',
    'legacy_morphology_adapter_v1',
    'legacy_mwe_adapter_v1',
    'legacy_phrase_adapter_v1',
    'legacy_pos_adapter_v1',
    'legacy_predicate_adapter_v1'
  );

  insert into public.grammar_language_graph_producer_registry_v1 (
    producer_code,
    producer_version,
    source_layer_code,
    adapter_status,
    runtime_bound,
    emits_node_types,
    emits_edge_relations,
    consumes_fact_types,
    contract,
    implementation_hash
  )
  values (
    'legacy_dependency_adapter_v1',
    '1.1',
    'dependency_build_v2',
    'runtime_bound',
    true,
    array[]::text[],
    array[
      'subject_of',
      'grammatical_head_of_predicate',
      'finite_member_of_predicate',
      'dependency'
    ]::text[],
    array['legacy_dependency_fact']::text[],
    jsonb_build_object(
      'relation_policy',
        'dependency_build_v2 relations are projected as canonical edges except predicate_of_clause',
      'ownership_policy',
        'predicate_of_clause is owned by legacy_clause_adapter_v1',
      'uncertainty_policy',
        'dependency hypotheses and blocked dependency facts remain diagnostics in v1.40.1'
    ),
    null
  );
end
$$;

do $$
declare
  v_matches integer;
  v_bound integer;
begin
  with expected(
    producer_code,
    producer_version,
    source_layer_code,
    adapter_status,
    runtime_bound
  ) as (
    values
      ('canonical_surface_adapter_v1','1','canonical-surface-boundary-v1','runtime_bound',true),
      ('legacy_attachment_adapter_v1','1.1','clause_attachment_function_v1','contract_ready',false),
      ('legacy_clause_adapter_v1','1.1','clause_build_v1','runtime_bound',true),
      ('legacy_dependency_adapter_v1','1.1','dependency_build_v2','runtime_bound',true),
      ('legacy_morphology_adapter_v1','1.1','morphology','runtime_bound',true),
      ('legacy_mwe_adapter_v1','1.1','multiword_function_expression_v1','runtime_bound',true),
      ('legacy_phrase_adapter_v1','1.1','phrase_build_v1','runtime_bound',true),
      ('legacy_pos_adapter_v1','1.1','local_pos+structural_pos','runtime_bound',true),
      ('legacy_predicate_adapter_v1','1.1','predicate_build_v1','runtime_bound',true)
  )
  select count(*)
  into v_matches
  from expected e
  join public.grammar_language_graph_producer_registry_v1 r
    on r.producer_code = e.producer_code
   and r.producer_version = e.producer_version
   and r.source_layer_code = e.source_layer_code
   and r.adapter_status = e.adapter_status
   and r.runtime_bound = e.runtime_bound;

  if v_matches <> 9 then
    raise exception
      'v1.40.1 producer registry postcondition failed: expected 9 matching scoped producers, got %',
      v_matches;
  end if;

  select count(*)
  into v_bound
  from public.grammar_language_graph_producer_registry_v1
  where producer_code in (
    'canonical_surface_adapter_v1',
    'legacy_attachment_adapter_v1',
    'legacy_clause_adapter_v1',
    'legacy_dependency_adapter_v1',
    'legacy_morphology_adapter_v1',
    'legacy_mwe_adapter_v1',
    'legacy_phrase_adapter_v1',
    'legacy_pos_adapter_v1',
    'legacy_predicate_adapter_v1'
  )
    and runtime_bound;

  if v_bound <> 8 then
    raise exception
      'v1.40.1 producer registry postcondition failed: expected exactly 8 bound scoped producers, got %',
      v_bound;
  end if;

  if exists (
    select 1
    from public.grammar_language_graph_producer_registry_v1
    where producer_code = 'legacy_dependency_adapter_v1'
      and (
        emits_node_types <> array[]::text[]
        or emits_edge_relations <> array[
          'subject_of',
          'grammatical_head_of_predicate',
          'finite_member_of_predicate',
          'dependency'
        ]::text[]
        or consumes_fact_types <> array['legacy_dependency_fact']::text[]
        or implementation_hash is not null
      )
  ) then
    raise exception
      'v1.40.1 dependency producer metadata postcondition failed';
  end if;

  if not exists (
    select 1
    from public.grammar_language_contract_registry_v1
    where contract_code = 'canonical-language-graph-v1'
      and contract_version = 'v1'
      and status = 'contract_ready'
      and contract ->> 'release_code' = 'runtime-structural-v1.39'
      and coalesce((contract ->> 'global_activation')::boolean, false) = false
  ) then
    raise exception
      'v1.40.1 binding aborted: canonical-language-graph-v1 core contract changed unexpectedly';
  end if;
end
$$;

commit;

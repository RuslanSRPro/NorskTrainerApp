-- v1.42 ? bind Canonical Constraint Propagation as a runtime graph producer.
-- Registry metadata only.
-- Does NOT activate grammar rules, activate runtime constraint families,
-- replace production parsing, or modify source rules.

begin;

-- ---------------------------------------------------------------------------
-- 1. Register the native v1.42 bounded constraint-propagation producer.
--
-- The producer does not own a new canonical node or edge type.
-- It consumes the existing Canonical Language Graph plus grounded,
-- source-backed constraint evaluations and may submit evidence-backed
-- status/alternative-set/trace patches.
-- ---------------------------------------------------------------------------

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
select
  'canonical_constraint_propagation_v1',
  '1',
  'canonical-constraint-propagation-v1',
  'runtime_bound',
  true,
  array[]::text[],
  array[]::text[],
  array[
    'canonical_language_graph_v1',
    'canonical_constraint_evaluation_v1'
  ]::text[],
  jsonb_build_object(
    'capability',
      'Bounded Constraint Propagation Engine V1',
    'graph_version',
      'canonical-language-graph-v1',
    'ownership_policy',
      'does not own lexical/POS/morph node types or structural node types; applies evidence-backed graph-state patches to existing canonical facts',
    'propagation_policy',
      'bounded agenda propagation to a fixpoint; default max 8 iterations and hard maximum 64; no recursive reparsing',
    'destructive_policy',
      'reject/block requires source-backed provenance, hard or categorical strength, satisfied capabilities and an existing unresolved graph target',
    'resolution_policy',
      'resolve an alternative set only when exactly one survivor remains and has sufficient positive constraint evidence; a single candidate alone is not sufficient',
    'ambiguity_policy',
      'preserve ambiguity whenever available evidence is insufficient',
    'capability_policy',
      'missing required capability produces no destructive transition',
    'trace_policy',
      'constraint decisions append evidence, provenance and constraint trace; source evidence is preserved',
    'learner_error_policy',
      'parser uncertainty and missing capability are not learner errors',
    'runtime_fact_policy',
      'runtime constraint facts are release-pinned and require an explicit compatible activation wave before evaluation',
    'v142_shadow_policy',
      'runtime-structural-v1.37 is observed in shadow with all current structural fact families deferred; zero runtime fact families are activated by this binding',
    'activation_policy',
      'shadow only; production parser unchanged; no grammar activation'
  ),
  'sha256:19cd427e4be2fae3a90201ded8deb644e6261ac27fc2e3f4ac6c65b9bbe5d56f'
where not exists (
  select 1
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_constraint_propagation_v1'
);

-- Keep the row exact/idempotent if it already exists.
update public.grammar_language_graph_producer_registry_v1
set
  producer_version = '1',
  source_layer_code = 'canonical-constraint-propagation-v1',
  adapter_status = 'runtime_bound',
  runtime_bound = true,
  emits_node_types = array[]::text[],
  emits_edge_relations = array[]::text[],
  consumes_fact_types = array[
    'canonical_language_graph_v1',
    'canonical_constraint_evaluation_v1'
  ]::text[],
  contract = jsonb_build_object(
    'capability',
      'Bounded Constraint Propagation Engine V1',
    'graph_version',
      'canonical-language-graph-v1',
    'ownership_policy',
      'does not own lexical/POS/morph node types or structural node types; applies evidence-backed graph-state patches to existing canonical facts',
    'propagation_policy',
      'bounded agenda propagation to a fixpoint; default max 8 iterations and hard maximum 64; no recursive reparsing',
    'destructive_policy',
      'reject/block requires source-backed provenance, hard or categorical strength, satisfied capabilities and an existing unresolved graph target',
    'resolution_policy',
      'resolve an alternative set only when exactly one survivor remains and has sufficient positive constraint evidence; a single candidate alone is not sufficient',
    'ambiguity_policy',
      'preserve ambiguity whenever available evidence is insufficient',
    'capability_policy',
      'missing required capability produces no destructive transition',
    'trace_policy',
      'constraint decisions append evidence, provenance and constraint trace; source evidence is preserved',
    'learner_error_policy',
      'parser uncertainty and missing capability are not learner errors',
    'runtime_fact_policy',
      'runtime constraint facts are release-pinned and require an explicit compatible activation wave before evaluation',
    'v142_shadow_policy',
      'runtime-structural-v1.37 is observed in shadow with all current structural fact families deferred; zero runtime fact families are activated by this binding',
    'activation_policy',
      'shadow only; production parser unchanged; no grammar activation'
  ),
  implementation_hash =
    'sha256:19cd427e4be2fae3a90201ded8deb644e6261ac27fc2e3f4ac6c65b9bbe5d56f',
  updated_at = now()
where producer_code = 'canonical_constraint_propagation_v1';

-- ---------------------------------------------------------------------------
-- 2. Migration gate.
--
-- v1.42 must be runtime-bound without stealing ownership from v1.41
-- Candidate Lattice or disturbing structural compatibility producers.
-- ---------------------------------------------------------------------------

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_constraint_propagation_v1'
    and producer_version = '1'
    and source_layer_code = 'canonical-constraint-propagation-v1'
    and runtime_bound = true
    and adapter_status = 'runtime_bound'
    and cardinality(emits_node_types) = 0
    and cardinality(emits_edge_relations) = 0
    and consumes_fact_types @> array[
      'canonical_language_graph_v1',
      'canonical_constraint_evaluation_v1'
    ]::text[]
    and implementation_hash =
      'sha256:19cd427e4be2fae3a90201ded8deb644e6261ac27fc2e3f4ac6c65b9bbe5d56f';

  if v_count <> 1 then
    raise exception
      'v1.42 registry gate: canonical_constraint_propagation_v1 is not correctly runtime-bound';
  end if;

  -- v1.41 remains the owner of canonical lexical/POS/morph candidates.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_candidate_lattice_v1'
    and producer_version = '1'
    and runtime_bound = true
    and adapter_status = 'runtime_bound'
    and emits_node_types @> array[
      'lexical_reading',
      'morph_reading'
    ]::text[];

  if v_count <> 1 then
    raise exception
      'v1.42 registry gate: canonical_candidate_lattice_v1 ownership changed unexpectedly';
  end if;

  -- Legacy POS/morph remain unbound after v1.41.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code in (
    'legacy_pos_adapter_v1',
    'legacy_morphology_adapter_v1'
  )
    and runtime_bound = false
    and adapter_status = 'contract_ready';

  if v_count <> 2 then
    raise exception
      'v1.42 registry gate: legacy POS/morph adapters changed unexpectedly';
  end if;

  -- Structural compatibility bridge remains available until later
  -- canonical graph completion waves.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code in (
    'legacy_phrase_adapter_v1',
    'legacy_mwe_adapter_v1',
    'legacy_predicate_adapter_v1',
    'legacy_clause_adapter_v1',
    'legacy_dependency_adapter_v1'
  )
    and runtime_bound = true;

  if v_count <> 5 then
    raise exception
      'v1.42 registry gate: structural compatibility producer binding changed unexpectedly';
  end if;
end
$$;

commit;

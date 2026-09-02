-- v1.41 — bind Canonical Candidate Lattice as the lexical/POS/morph graph producer.
-- This migration changes registry metadata only.
-- It does NOT activate grammar, replace production parsing, or modify source rules.

begin;

-- ---------------------------------------------------------------------------
-- 1. Register the native v1.41 candidate-lattice producer.
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
  'canonical_candidate_lattice_v1',
  '1',
  'canonical-candidate-lattice-v1',
  'runtime_bound',
  true,
  array[
    'lexical_reading',
    'morph_reading'
  ]::text[],
  array[
    'lexical_reading_of',
    'morph_reading_of',
    'pos_of',
    'lexical_supports_pos'
  ]::text[],
  array[
    'surface_token',
    'canonical_surface_candidate_batch_v1',
    'canonical_morph_registry_snapshot_v1'
  ]::text[],
  jsonb_build_object(
    'capability', 'Lexical / POS / Morph Candidate Lattice V1',
    'graph_version', 'canonical-language-graph-v1',
    'ownership_policy',
      'canonical lexical/POS/morph graph facts are owned by canonical_candidate_lattice_v1 from v1.41',
    'ambiguity_policy',
      'all v1.41 lexical/POS/morph facts remain candidate/open; a single candidate is not auto-resolved',
    'source_pos_policy',
      'source POS is evidence, not authority',
    'identity_policy',
      'form match does not by itself prove lexical identity',
    'morph_scope_policy',
      'only token-scoped morphology is materialized; construction-scoped forms remain outside token morphology',
    'learner_error_policy',
      'parser uncertainty is not learner error',
    'activation_policy',
      'shadow only; production parser unchanged; no grammar activation'
  ),
  'sha256:e72f2aacf1ad50d454190ce9ee1d9e64ae438d7f8aa0dbd2ca11f80ccc92396b'
where not exists (
  select 1
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_candidate_lattice_v1'
);

-- Keep the row exact/idempotent if it already exists.
update public.grammar_language_graph_producer_registry_v1
set
  producer_version = '1',
  source_layer_code = 'canonical-candidate-lattice-v1',
  adapter_status = 'runtime_bound',
  runtime_bound = true,
  emits_node_types = array[
    'lexical_reading',
    'morph_reading'
  ]::text[],
  emits_edge_relations = array[
    'lexical_reading_of',
    'morph_reading_of',
    'pos_of',
    'lexical_supports_pos'
  ]::text[],
  consumes_fact_types = array[
    'surface_token',
    'canonical_surface_candidate_batch_v1',
    'canonical_morph_registry_snapshot_v1'
  ]::text[],
  contract = jsonb_build_object(
    'capability', 'Lexical / POS / Morph Candidate Lattice V1',
    'graph_version', 'canonical-language-graph-v1',
    'ownership_policy',
      'canonical lexical/POS/morph graph facts are owned by canonical_candidate_lattice_v1 from v1.41',
    'ambiguity_policy',
      'all v1.41 lexical/POS/morph facts remain candidate/open; a single candidate is not auto-resolved',
    'source_pos_policy',
      'source POS is evidence, not authority',
    'identity_policy',
      'form match does not by itself prove lexical identity',
    'morph_scope_policy',
      'only token-scoped morphology is materialized; construction-scoped forms remain outside token morphology',
    'learner_error_policy',
      'parser uncertainty is not learner error',
    'activation_policy',
      'shadow only; production parser unchanged; no grammar activation'
  ),
  implementation_hash = 'sha256:e72f2aacf1ad50d454190ce9ee1d9e64ae438d7f8aa0dbd2ca11f80ccc92396b',
  updated_at = now()
where producer_code = 'canonical_candidate_lattice_v1';

-- ---------------------------------------------------------------------------
-- 2. Legacy POS/morph adapters remain defined as compatibility contracts,
--    but they no longer own runtime lexical/POS/morph facts in v1.41.
-- ---------------------------------------------------------------------------

update public.grammar_language_graph_producer_registry_v1
set
  runtime_bound = false,
  adapter_status = 'contract_ready',
  contract = coalesce(contract, '{}'::jsonb) || jsonb_build_object(
    'v141_runtime_policy',
      'not runtime-bound from v1.41; canonical_candidate_lattice_v1 owns canonical POS facts'
  ),
  updated_at = now()
where producer_code = 'legacy_pos_adapter_v1';

update public.grammar_language_graph_producer_registry_v1
set
  runtime_bound = false,
  adapter_status = 'contract_ready',
  contract = coalesce(contract, '{}'::jsonb) || jsonb_build_object(
    'v141_runtime_policy',
      'not runtime-bound from v1.41; canonical_candidate_lattice_v1 owns canonical morphology facts'
  ),
  updated_at = now()
where producer_code = 'legacy_morphology_adapter_v1';

-- ---------------------------------------------------------------------------
-- 3. Migration gate.
--    Fail transaction if registry ownership does not match the proven v1.41
--    shadow runtime, or if the structural compatibility bridge was disturbed.
-- ---------------------------------------------------------------------------

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_candidate_lattice_v1'
    and producer_version = '1'
    and runtime_bound = true
    and adapter_status = 'runtime_bound'
    and emits_node_types @> array['lexical_reading', 'morph_reading']::text[]
    and emits_edge_relations @> array[
      'lexical_reading_of',
      'morph_reading_of',
      'pos_of',
      'lexical_supports_pos'
    ]::text[];

  if v_count <> 1 then
    raise exception
      'v1.41 registry gate: canonical_candidate_lattice_v1 is not correctly runtime-bound';
  end if;

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
      'v1.41 registry gate: legacy POS/morph adapters were not cleanly unbound';
  end if;

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
      'v1.41 registry gate: structural compatibility producer binding changed unexpectedly';
  end if;
end
$$;

commit;

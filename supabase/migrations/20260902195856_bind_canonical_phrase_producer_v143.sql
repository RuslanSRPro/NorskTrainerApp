-- v1.43 - bind Canonical Phrase Candidate Lattice as Phrase graph owner.
--
-- Registry reconciliation only.
-- Runtime ownership has already been proven by local + remote shadow gates.
--
-- This migration:
--   * registers canonical_phrase_candidate_lattice_v1 as runtime-bound Phrase owner;
--   * unbinds legacy_phrase_adapter_v1 from the canonical graph;
--   * preserves legacy Phrase as a compatibility/comparator contract;
--   * does not activate grammar rules;
--   * does not replace the production parser;
--   * does not claim PP completion.

begin;

set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- ---------------------------------------------------------------------------
-- 1. Register native v1.43 Phrase producer.
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
values (
  'canonical_phrase_candidate_lattice_v1',
  '1',
  'canonical-phrase-candidate-lattice-v1',
  'runtime_bound',
  true,
  array[
    'phrase'
  ]::text[],
  array[
    'head_of',
    'member_of'
  ]::text[],
  array[
    'canonical_language_graph_v1',
    'canonical_phrase_runtime_snapshot_v1'
  ]::text[],
  jsonb_build_object(
    'capability',
      'Phrase / NP / AP Candidate Lattice V1',

    'graph_version',
      'canonical-language-graph-v1',

    'ownership_policy',
      'canonical NP/AP Phrase graph facts are owned by canonical_phrase_candidate_lattice_v1 from v1.43',

    'runtime_ir_policy',
      'phrase candidates are generated from validated allowlisted Runtime IR rows with source provenance preserved',

    'ambiguity_policy',
      'phrase candidates and structural alternative sets remain candidate/open; no phrase is auto-resolved',

    'compiled_activation_policy',
      'compiled Runtime IR does not mean grammar activation; phrase Runtime IR rules remain inactive',

    'legacy_phrase_policy',
      'legacy Phrase remains available only through raw/comparator compatibility paths and no longer writes Phrase facts into the canonical graph',

    'scope_policy',
      'v1.43 ownership currently covers native NP/AP Phrase candidates; PP completion is not claimed by this registry binding',

    'production_policy',
      'shadow only; production parser unchanged; production_replacement=false',

    'grammar_activation_policy',
      'grammar_activation=false'
  ),
  'sha256:6f85f94575ecb087c30beda726fb0e134653a5981c8d72eb25da0faddb867b98'
)
on conflict (producer_code) do update
set
  producer_version = excluded.producer_version,
  source_layer_code = excluded.source_layer_code,
  adapter_status = excluded.adapter_status,
  runtime_bound = excluded.runtime_bound,
  emits_node_types = excluded.emits_node_types,
  emits_edge_relations = excluded.emits_edge_relations,
  consumes_fact_types = excluded.consumes_fact_types,
  contract = excluded.contract,
  implementation_hash = excluded.implementation_hash,
  updated_at = now();


-- ---------------------------------------------------------------------------
-- 2. Remove legacy Phrase ownership from canonical runtime.
--    Keep its contract for raw/comparator compatibility.
-- ---------------------------------------------------------------------------

update public.grammar_language_graph_producer_registry_v1
set
  runtime_bound = false,
  adapter_status = 'contract_ready',
  contract =
    coalesce(contract, '{}'::jsonb)
    || jsonb_build_object(
      'v143_runtime_policy',
        'not runtime-bound from v1.43; canonical_phrase_candidate_lattice_v1 is the sole canonical Phrase graph owner',

      'compatibility_policy',
        'legacy Phrase remains raw/comparator compatibility only and does not write canonical Phrase graph facts',

      'production_policy',
        'production parser unchanged'
    ),
  updated_at = now()
where producer_code = 'legacy_phrase_adapter_v1';


-- ---------------------------------------------------------------------------
-- 3. Registry postconditions.
-- ---------------------------------------------------------------------------

do $$
declare
  v_count integer;
begin

  -- Native Phrase producer must be exactly registered and runtime-bound.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'canonical_phrase_candidate_lattice_v1'
    and producer_version = '1'
    and source_layer_code = 'canonical-phrase-candidate-lattice-v1'
    and adapter_status = 'runtime_bound'
    and runtime_bound = true
    and emits_node_types @> array['phrase']::text[]
    and emits_edge_relations @> array[
      'head_of',
      'member_of'
    ]::text[]
    and consumes_fact_types @> array[
      'canonical_language_graph_v1',
      'canonical_phrase_runtime_snapshot_v1'
    ]::text[]
    and implementation_hash =
      'sha256:6f85f94575ecb087c30beda726fb0e134653a5981c8d72eb25da0faddb867b98';

  if v_count <> 1 then
    raise exception
      'v1.43 registry gate: canonical_phrase_candidate_lattice_v1 is not correctly runtime-bound';
  end if;


  -- Legacy Phrase must no longer own canonical runtime Phrase facts.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'legacy_phrase_adapter_v1'
    and runtime_bound = false
    and adapter_status = 'contract_ready';

  if v_count <> 1 then
    raise exception
      'v1.43 registry gate: legacy_phrase_adapter_v1 was not cleanly unbound';
  end if;


  -- There must be one and only one runtime-bound producer claiming Phrase nodes.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where runtime_bound = true
    and emits_node_types @> array['phrase']::text[];

  if v_count <> 1 then
    raise exception
      'v1.43 registry gate: expected exactly one runtime-bound Phrase producer, got %',
      v_count;
  end if;


  -- And that sole Phrase producer must be canonical.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where runtime_bound = true
    and emits_node_types @> array['phrase']::text[]
    and producer_code = 'canonical_phrase_candidate_lattice_v1';

  if v_count <> 1 then
    raise exception
      'v1.43 registry gate: runtime-bound Phrase ownership is not canonical';
  end if;


  -- Existing structural compatibility ownership must remain unchanged.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code in (
    'legacy_mwe_adapter_v1',
    'legacy_predicate_adapter_v1',
    'legacy_clause_adapter_v1',
    'legacy_dependency_adapter_v1'
  )
    and runtime_bound = true
    and adapter_status = 'runtime_bound';

  if v_count <> 4 then
    raise exception
      'v1.43 registry gate: unrelated structural compatibility bindings changed';
  end if;


  -- Attachment remains outside runtime exactly as before.
  select count(*)
  into v_count
  from public.grammar_language_graph_producer_registry_v1
  where producer_code = 'legacy_attachment_adapter_v1'
    and runtime_bound = false
    and adapter_status = 'contract_ready';

  if v_count <> 1 then
    raise exception
      'v1.43 registry gate: legacy attachment binding changed unexpectedly';
  end if;

end
$$;

commit;
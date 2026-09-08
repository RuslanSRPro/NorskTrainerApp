-- Norsk Trainer
-- v1.45 A0 — Canonical Valency Projection Snapshot V1
--
-- READ-ONLY build/control boundary.
--
-- Frozen Grammar Knowledge remains authoritative and immutable.
--
-- This snapshot deliberately separates:
--
--   1. valency ontology/reference;
--   2. runtime source-backed lexical/frame evidence;
--   3. argument-structure definitions.
--
-- It DOES NOT:
--   - create predicate frames;
--   - create argument nodes;
--   - identify subjects or objects;
--   - infer main_verb from absence of auxiliary evidence;
--   - run word-order diagnostics;
--   - resolve semantic roles;
--   - materialize lexical valency;
--   - activate historical rules;
--   - modify Grammar Knowledge.
--
-- Later canonical flow:
--
-- frozen source
--   -> snapshot
--   -> projection adapter
--   -> predicate-frame candidates
--   -> argument-slot candidates
--   -> occurrence evidence
--   -> bounded constraint propagation
--
-- Candidate != resolved.

create or replace function public.canonical_valency_projection_snapshot_v1()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
with selected as (
  select
    g.id,
    g.source_section,
    g.status,
    g.requires_human_verification,

    g.extracted_payload ->> 'candidate_code'
      as candidate_code,

    g.extracted_payload,

    g.digital_model,

    g.execution_contract,

    g.digital_model #>> '{model,type}'
      as model_type,

    g.digital_model #>> '{model,subtype}'
      as model_subtype,

    g.digital_model #>> '{model,property_domain}'
      as property_domain,

    g.digital_model #>> '{model,grammar_category}'
      as grammar_category,

    g.digital_model #>> '{model,semantic_category}'
      as semantic_category,

    g.execution_contract #>> '{audit,disposition}'
      as disposition,

    g.execution_contract #>> '{execution,role}'
      as execution_role

  from public.grammar_knowledge_candidates g

  where
    g.status = 'source_verified'

    and g.requires_human_verification
      is not true

    and (
      g.extracted_payload ->> 'candidate_code'
    ) = any (
      array[
        -- ------------------------------------------------------------
        -- Valency ontology/reference
        -- ------------------------------------------------------------
        'verb.valency.definition_and_classes',
        'verb.valency.subject_not_complement',

        -- ------------------------------------------------------------
        -- Runtime-ready lexical / occurrence frame evidence
        -- ------------------------------------------------------------
        'verb.valency.avalent_dummy_det',
        'verb.complementation.valency_bound_adverbial_complements',

        -- ------------------------------------------------------------
        -- General argument-structure definitions
        -- ------------------------------------------------------------
        'sentence.direct_object.definition.verb_complement',
        'sentence.object.classification.direct_vs_indirect',
        'sentence.indirect_object.core.direct_object_dependency',
        'sentence.indirect_object.form.nominal_or_prepositional'
      ]::text[]
    )
),

projected as (
  select
    jsonb_build_object(
      'candidate_id',
        id,

      'candidate_code',
        candidate_code,

      'source_section',
        source_section,

      'status',
        status,

      'requires_human_verification',
        requires_human_verification,

      'model_type',
        model_type,

      'model_subtype',
        model_subtype,

      'property_domain',
        property_domain,

      'grammar_category',
        grammar_category,

      'semantic_category',
        semantic_category,

      'disposition',
        disposition,

      'execution_role',
        execution_role,

      'extracted_payload',
        extracted_payload,

      'digital_model',
        digital_model,

      'execution_contract',
        execution_contract
    ) as payload,

    candidate_code

  from selected
)

select jsonb_build_object(
  'version',
    'canonical-valency-projection-snapshot-v1',

  'plane',
    'build_control',

  'read_only',
    true,

  'write_performed',
    false,

  'frozen_grammar_immutable',
    true,

  'materialization_performed',
    false,

  'historical_rule_activation_performed',
    false,

  -- ------------------------------------------------------------------
  -- Reference ontology only.
  --
  -- These define vocabulary / structural distinctions.
  -- They do NOT themselves become occurrence evidence.
  -- ------------------------------------------------------------------

  'ontology_reference',
    coalesce(
      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from projected

        where candidate_code = any(
          array[
            'verb.valency.definition_and_classes',
            'verb.valency.subject_not_complement'
          ]::text[]
        )
      ),
      '[]'::jsonb
    ),

  -- ------------------------------------------------------------------
  -- Runtime-eligible source-backed frame evidence.
  --
  -- These may later generate candidate predicate frames when bound
  -- to an exact lexical/predicate occurrence.
  -- ------------------------------------------------------------------

  'runtime_frame_sources',
    coalesce(
      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from projected

        where candidate_code = any(
          array[
            'verb.valency.avalent_dummy_det',
            'verb.complementation.valency_bound_adverbial_complements'
          ]::text[]
        )
      ),
      '[]'::jsonb
    ),

  -- ------------------------------------------------------------------
  -- General argument-structure source facts.
  --
  -- These define relationships/constraints only.
  -- They are NOT an instruction to guess arguments from position.
  -- ------------------------------------------------------------------

  'argument_structure_sources',
    coalesce(
      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from projected

        where candidate_code = any(
          array[
            'sentence.direct_object.definition.verb_complement',
            'sentence.object.classification.direct_vs_indirect',
            'sentence.indirect_object.core.direct_object_dependency',
            'sentence.indirect_object.form.nominal_or_prepositional'
          ]::text[]
        )
      ),
      '[]'::jsonb
    ),

  -- ------------------------------------------------------------------
  -- Ownership boundaries.
  -- ------------------------------------------------------------------

  'deferred_families',
    jsonb_build_array(
      'subject_identification',
      'object_word_order_diagnostics',
      'indirect_object_word_order',
      'semantic_role_assignment',
      'passive_argument_mapping',
      'control_and_raising',
      'argument_ellipsis_and_gap_recovery',
      'chapter11_complement_classes',
      'information_structure',
      'lexical_valency_exceptions',
      'copular_predicative_structure'
    ),

  'ownership',
    jsonb_build_object(
      'subject',
        'valency_participant_not_verb_complement',

      'verb_complements',
        'valency_bound_constituents_inside_predicate',

      'direct_object',
        'verb_complement_licensed_by_main_verb',

      'indirect_object',
        'argument_with_direct_object_dependency',

      'lexical_frame_authority',
        'frozen_source_digital_model_until_dedicated_store_exists'
    ),

  'safety',
    jsonb_build_object(
      'grammar_knowledge_mutated',
        false,

      'grammar_rule_materialized',
        false,

      'legacy_parser_authority',
        false,

      'clause_layer_required',
        false,

      'word_order_used_as_primary_argument_authority',
        false,

      'absence_of_argument_evidence_means_rejection',
        false,

      'candidate_may_resolve_without_evidence',
        false
    )
);
$$;


comment on function public.canonical_valency_projection_snapshot_v1()
is
'Read-only v1.45 build-control snapshot of frozen valency ontology, runtime frame sources, and core argument-structure definitions. Performs no grammar mutation, materialization, activation, or argument resolution.';


revoke all
on function public.canonical_valency_projection_snapshot_v1()
from public;

revoke all
on function public.canonical_valency_projection_snapshot_v1()
from anon;

revoke all
on function public.canonical_valency_projection_snapshot_v1()
from authenticated;


-- ====================================================================
-- MIGRATION-TIME INVARIANT GATE
-- ====================================================================

do $$
declare
  v_snapshot jsonb;

  v_all_codes text[];

  v_ontology_codes text[];

  v_runtime_codes text[];

  v_argument_codes text[];
begin
  select
    public.canonical_valency_projection_snapshot_v1()
  into
    v_snapshot;


  -- ------------------------------------------------------------------
  -- Global safety
  -- ------------------------------------------------------------------

  if v_snapshot ->> 'plane'
      <> 'build_control'
  then
    raise exception
      'v1.45 valency snapshot plane mismatch';
  end if;


  if (v_snapshot ->> 'read_only')::boolean
      is not true
  then
    raise exception
      'v1.45 valency snapshot must be read-only';
  end if;


  if (v_snapshot ->> 'write_performed')::boolean
      is not false
  then
    raise exception
      'v1.45 valency snapshot write safety failed';
  end if;


  if (
    v_snapshot ->>
      'frozen_grammar_immutable'
  )::boolean is not true
  then
    raise exception
      'v1.45 frozen grammar immutability not proven';
  end if;


  if (
    v_snapshot ->>
      'materialization_performed'
  )::boolean is not false
  then
    raise exception
      'v1.45 snapshot unexpectedly materialized data';
  end if;


  -- ------------------------------------------------------------------
  -- Exact source cardinality
  -- ------------------------------------------------------------------

  select array_agg(
    x ->> 'candidate_code'
    order by x ->> 'candidate_code'
  )
  into v_ontology_codes
  from jsonb_array_elements(
    v_snapshot -> 'ontology_reference'
  ) x;


  select array_agg(
    x ->> 'candidate_code'
    order by x ->> 'candidate_code'
  )
  into v_runtime_codes
  from jsonb_array_elements(
    v_snapshot -> 'runtime_frame_sources'
  ) x;


  select array_agg(
    x ->> 'candidate_code'
    order by x ->> 'candidate_code'
  )
  into v_argument_codes
  from jsonb_array_elements(
    v_snapshot -> 'argument_structure_sources'
  ) x;


  v_all_codes :=
    coalesce(
      v_ontology_codes,
      array[]::text[]
    )
    ||
    coalesce(
      v_runtime_codes,
      array[]::text[]
    )
    ||
    coalesce(
      v_argument_codes,
      array[]::text[]
    );


  if cardinality(v_ontology_codes) <> 2 then
    raise exception
      'Expected 2 valency ontology sources, got %',
      cardinality(v_ontology_codes);
  end if;


  if cardinality(v_runtime_codes) <> 2 then
    raise exception
      'Expected 2 runtime frame sources, got %',
      cardinality(v_runtime_codes);
  end if;


  if cardinality(v_argument_codes) <> 4 then
    raise exception
      'Expected 4 argument structure sources, got %',
      cardinality(v_argument_codes);
  end if;


  if cardinality(v_all_codes) <> 8 then
    raise exception
      'Expected exactly 8 v1.45 A0 sources, got %',
      cardinality(v_all_codes);
  end if;


  -- ------------------------------------------------------------------
  -- Valency class ontology
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'ontology_reference'
    ) x

    where
      x ->> 'candidate_code'
        =
      'verb.valency.definition_and_classes'

      and
      x ->> 'model_type'
        =
      'reference_ontology_support'

      and
      x ->> 'disposition'
        =
      'KEEP_REFERENCE_ONLY'

      and
      x #>> '{digital_model,model,lexical_property,applies_to}'
        =
      'verb'

      and
      (
        x #>
          '{digital_model,model,lexical_property,classes}'
      ) @> '[
        "avalent",
        "monovalent",
        "bivalent",
        "trivalent"
      ]'::jsonb
  )
  then
    raise exception
      'Valency class ontology invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Subject/complement ownership
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'ontology_reference'
    ) x

    where
      x ->> 'candidate_code'
        =
      'verb.valency.subject_not_complement'

      and
      x #>> '{digital_model,model,structural_distinction,subject}'
        =
      'valency_participant_but_not_verb_complement'

      and
      x #>> '{digital_model,model,structural_distinction,verb_complements}'
        =
      'valency_bound_constituents_inside_predicate'
  )
  then
    raise exception
      'Subject/complement ownership invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Avalent runtime frame seed
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'runtime_frame_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'verb.valency.avalent_dummy_det'

      and
      x ->> 'disposition'
        =
      'KEEP_GRAMMAR_RUNTIME'

      and
      x #>> '{digital_model,model,lexical_property,valency}'
        =
      'avalent'

      and
      x #>> '{digital_model,model,lexical_property,applies_to}'
        =
      'verb'

      and
      x #>> '{digital_model,model,usage_constraints,det_semantic_role}'
        =
      'none'
  )
  then
    raise exception
      'Avalent runtime source invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Valency-bound complement frames
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'runtime_frame_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'verb.complementation.valency_bound_adverbial_complements'

      and
      x ->> 'disposition'
        =
      'KEEP_GRAMMAR_RUNTIME'

      and
      x #>> '{digital_model,model,property_domain}'
        =
      'argument_realization'

      and
      jsonb_array_length(
        x #>
          '{digital_model,model,lexical_frames}'
      ) >= 1
  )
  then
    raise exception
      'Valency-bound lexical frame invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Direct-object ownership
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'argument_structure_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'sentence.direct_object.definition.verb_complement'

      and
      x ->> 'disposition'
        =
      'KEEP_GRAMMAR_RUNTIME'

      and
      x #>> '{digital_model,model,usage_constraints,object_licensing_source}'
        =
      'main_verb'

      and
      x #>> '{digital_model,model,construction_schema,relation}'
        =
      'VERB_HEAD -> OBJECT_COMPLEMENT'
  )
  then
    raise exception
      'Direct-object ownership invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Object ontology
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'argument_structure_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'sentence.object.classification.direct_vs_indirect'

      and
      (
        x #>
          '{digital_model,model,construction_schema,object_types}'
      ) @> '[
        "direct_object",
        "indirect_object"
      ]'::jsonb
  )
  then
    raise exception
      'Direct/indirect object ontology invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Indirect-object dependency
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'argument_structure_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'sentence.indirect_object.core.direct_object_dependency'

      and
      x #>> '{digital_model,model,usage_constraints,direct_object_requirement}'
        =
      'normally_required'

      and
      (
        x #>>
          '{digital_model,model,usage_constraints,logical_presence_can_suffice}'
      )::boolean
        is true
  )
  then
    raise exception
      'Indirect-object direct-object dependency invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Indirect-object form alternatives
  -- ------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot ->
        'argument_structure_sources'
    ) x

    where
      x ->> 'candidate_code'
        =
      'sentence.indirect_object.form.nominal_or_prepositional'

      and
      x #>> '{digital_model,model,semantic_category}'
        =
      'indirect_object_form'
  )
  then
    raise exception
      'Indirect-object form ontology invariant failed';
  end if;


  -- ------------------------------------------------------------------
  -- Ownership exclusions
  -- ------------------------------------------------------------------

  if not (
    v_snapshot ->
      'deferred_families'
  ) @> '[
    "subject_identification",
    "object_word_order_diagnostics",
    "semantic_role_assignment",
    "passive_argument_mapping",
    "control_and_raising"
  ]'::jsonb
  then
    raise exception
      'v1.45 deferred ownership boundary incomplete';
  end if;

end
$$;
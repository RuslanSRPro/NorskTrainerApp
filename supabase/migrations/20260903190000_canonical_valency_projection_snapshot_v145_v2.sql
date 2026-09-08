-- Norsk Trainer
-- v1.45 A0.1
-- Canonical Valency Projection Snapshot V2
--
-- Extends, never mutates:
--   canonical_valency_projection_snapshot_v1()
--
-- Purpose:
--   read-only build/control inventory for General Valency.
--
-- No grammar mutation.
-- No rule activation.
-- No materialization.
-- No runtime cutover.


create or replace function public.canonical_valency_projection_snapshot_v2()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with expected as (

  select *
  from (
    values

      -- ---------------------------------------------------------------
      -- REFERENCE / ONTOLOGY
      -- ---------------------------------------------------------------

      (
        'ontology_reference',
        'verb.valency.definition_and_classes'
      ),

      (
        'ontology_reference',
        'verb.valency.subject_not_complement'
      ),

      (
        'ontology_reference',
        'verb_phrase.complement_inventory_and_free_adverbials'
      ),

      (
        'ontology_reference',
        'grammar.foundations.phrase.verb_complement_inventory'
      ),

      (
        'ontology_reference',
        'grammar.foundations.phrase.common_complement_patterns'
      ),


      -- ---------------------------------------------------------------
      -- EXECUTABLE COMPLEMENT CONCEPT
      -- ---------------------------------------------------------------

      (
        'runtime_complement_concept',
        'grammar.foundations.phrase.complement_subtype'
      ),


      -- ---------------------------------------------------------------
      -- BASE RUNTIME FRAME AUTHORITY
      --
      -- These are source_verified + KEEP_GRAMMAR_RUNTIME +
      -- source_strict_runtime=true.
      --
      -- They cover:
      --   avalency
      --   valency-bound adverbial complements
      --   lexical form selection
      --   PP requiredness
      --   obligatory / optional DO
      --   trivalent object requiredness
      -- ---------------------------------------------------------------

      (
        'runtime_frame',
        'verb.valency.avalent_dummy_det'
      ),

      (
        'runtime_frame',
        'verb.complementation.valency_bound_adverbial_complements'
      ),

      (
        'runtime_frame',
        'verb.complementation.form_selection'
      ),

      (
        'runtime_frame',
        'verb.complementation.pp_optional_vs_required'
      ),

      (
        'runtime_frame',
        'verb.transitivity.obligatory_direct_object'
      ),

      (
        'runtime_frame',
        'verb.transitivity.optional_direct_object'
      ),

      (
        'runtime_frame',
        'verb.transitivity.trivalent_object_requiredness'
      ),


      -- ---------------------------------------------------------------
      -- GENERAL ARGUMENT STRUCTURE
      -- ---------------------------------------------------------------

      (
        'argument_structure',
        'sentence.direct_object.definition.verb_complement'
      ),

      (
        'argument_structure',
        'sentence.object.classification.direct_vs_indirect'
      ),

      (
        'argument_structure',
        'sentence.indirect_object.core.direct_object_dependency'
      ),

      (
        'argument_structure',
        'sentence.indirect_object.form.nominal_or_prepositional'
      )

  ) as t(
    family,
    candidate_code
  )
),


source_rows as (

  select

    e.family,

    g.id
      as candidate_id,

    g.extracted_payload->>'candidate_code'
      as candidate_code,

    g.source_section,

    g.status,

    g.requires_human_verification,

    g.digital_model#>>'{model,type}'
      as model_type,

    g.digital_model#>>'{model,subtype}'
      as model_subtype,

    g.digital_model#>>'{model,property_domain}'
      as property_domain,

    g.digital_model#>>'{model,grammar_category}'
      as grammar_category,

    g.digital_model#>>'{model,semantic_category}'
      as semantic_category,

    g.execution_contract#>>'{audit,disposition}'
      as disposition,

    g.execution_contract#>>'{execution,role}'
      as execution_role,

    g.extracted_payload,

    g.digital_model,

    g.execution_contract

  from expected e

  left join public.grammar_knowledge_candidates g
    on (
      g.extracted_payload->>'candidate_code'
      =
      e.candidate_code
    )
),


json_rows as (

  select

    family,

    candidate_code,

    jsonb_build_object(

      'candidate_id',
        candidate_id,

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

    ) as payload

  from source_rows
)

select jsonb_build_object(

  'version',
    'canonical-valency-projection-snapshot-v2',

  'supersedes',
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

  'production_activation_performed',
    false,


  'ontology_reference',

    coalesce(

      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from json_rows

        where family =
          'ontology_reference'
      ),

      '[]'::jsonb
    ),


  'runtime_complement_concept_sources',

    coalesce(

      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from json_rows

        where family =
          'runtime_complement_concept'
      ),

      '[]'::jsonb
    ),


  'runtime_frame_sources',

    coalesce(

      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from json_rows

        where family =
          'runtime_frame'
      ),

      '[]'::jsonb
    ),


  'argument_structure_sources',

    coalesce(

      (
        select jsonb_agg(
          payload
          order by candidate_code
        )

        from json_rows

        where family =
          'argument_structure'
      ),

      '[]'::jsonb
    ),


  'deferred_runtime_families',

    jsonb_build_array(

      'object_omission_semantics',

      'derivational_valency_alternations',

      's_verb_valency_alternations',

      'passive_argument_mapping',

      'control_and_raising',

      'argument_ellipsis_and_gap_recovery',

      'chapter11_complement_classes',

      'semantic_participant_roles',

      'information_structure'
    ),


  'ownership',

    jsonb_build_object(

      'subject',
        'valency_participant_not_verb_complement',

      'verb_complement',
        'valency_bound_constituent_inside_predicate',

      'predicate_frame',
        'source_backed_lexical_frame_candidate',

      'predicate_complement_slot',
        'logical_complement_requirement_of_predicate_frame',

      'surface_realization',
        'separate_candidate_binding_layer',

      'direct_object',
        'later_specialization_requiring_source_licensing',

      'indirect_object',
        'later_specialization_with_direct_object_dependency',

      'lexical_frame_authority',
        'frozen_source_digital_model'
    ),


  'safety',

    jsonb_build_object(

      'candidate_not_resolved',
        true,

      'source_condition_not_occurrence_proof',
        true,

      'surface_type_not_phrase_type_without_bridge',
        true,

      'historical_rule_not_canonical_authority',
        true,

      'no_default_object_from_position',
        true,

      'no_default_frame_from_absence',
        true
    )
);
$$;


revoke all
on function public.canonical_valency_projection_snapshot_v2()
from public;


revoke all
on function public.canonical_valency_projection_snapshot_v2()
from anon;


revoke all
on function public.canonical_valency_projection_snapshot_v2()
from authenticated;



-- ===================================================================
-- MIGRATION-TIME CONTRACT VALIDATION
-- ===================================================================

do $$
declare

  s jsonb;

  ontology_count integer;

  concept_count integer;

  runtime_count integer;

  argument_count integer;

  total_count integer;

begin

  s :=
    public.canonical_valency_projection_snapshot_v2();


  -- -----------------------------------------------------------------
  -- BUILD CONTROL / IMMUTABILITY
  -- -----------------------------------------------------------------

  if s->>'plane' <>
       'build_control'
  then
    raise exception
      'V1.45 A0.1 invariant failed: plane';
  end if;


  if (s->>'read_only')::boolean
       is not true
  then
    raise exception
      'V1.45 A0.1 invariant failed: read_only';
  end if;


  if (s->>'write_performed')::boolean
       is not false
  then
    raise exception
      'V1.45 A0.1 invariant failed: write_performed';
  end if;


  if (s->>'frozen_grammar_immutable')::boolean
       is not true
  then
    raise exception
      'V1.45 A0.1 invariant failed: frozen grammar';
  end if;


  if (s->>'materialization_performed')::boolean
       is not false
  then
    raise exception
      'V1.45 A0.1 invariant failed: materialization';
  end if;


  if (s->>'historical_rule_activation_performed')::boolean
       is not false
  then
    raise exception
      'V1.45 A0.1 invariant failed: historical activation';
  end if;


  -- -----------------------------------------------------------------
  -- COUNTS
  -- -----------------------------------------------------------------

  ontology_count :=
    jsonb_array_length(
      s->'ontology_reference'
    );

  concept_count :=
    jsonb_array_length(
      s->'runtime_complement_concept_sources'
    );

  runtime_count :=
    jsonb_array_length(
      s->'runtime_frame_sources'
    );

  argument_count :=
    jsonb_array_length(
      s->'argument_structure_sources'
    );

  total_count :=
      ontology_count
    + concept_count
    + runtime_count
    + argument_count;


  if ontology_count <> 5 then
    raise exception
      'V1.45 A0.1 invariant failed: ontology_count=%',
      ontology_count;
  end if;


  if concept_count <> 1 then
    raise exception
      'V1.45 A0.1 invariant failed: concept_count=%',
      concept_count;
  end if;


  if runtime_count <> 7 then
    raise exception
      'V1.45 A0.1 invariant failed: runtime_count=%',
      runtime_count;
  end if;


  if argument_count <> 4 then
    raise exception
      'V1.45 A0.1 invariant failed: argument_count=%',
      argument_count;
  end if;


  if total_count <> 17 then
    raise exception
      'V1.45 A0.1 invariant failed: total_count=%',
      total_count;
  end if;


  -- -----------------------------------------------------------------
  -- EVERY EXPECTED SOURCE MUST EXIST
  -- -----------------------------------------------------------------

  if exists (

    select 1

    from jsonb_array_elements(
      (s->'ontology_reference')
      ||
      (s->'runtime_complement_concept_sources')
      ||
      (s->'runtime_frame_sources')
      ||
      (s->'argument_structure_sources')
    ) x

    where x->>'candidate_id'
      is null

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: missing source candidate';

  end if;


  -- -----------------------------------------------------------------
  -- RUNTIME FRAME SOURCES MUST BE SOURCE-STRICT RUNTIME
  -- -----------------------------------------------------------------

  if exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    where
      x->>'status' <>
        'source_verified'

      or coalesce(
        (x->>'requires_human_verification')::boolean,
        false
      ) is true

      or x->>'disposition' <>
        'KEEP_GRAMMAR_RUNTIME'

      or coalesce(
        (
          x#>>
          '{digital_model,model,learning,source_strict_runtime}'
        )::boolean,
        false
      ) is not true

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: runtime frame eligibility';

  end if;


  -- -----------------------------------------------------------------
  -- NEW V2 SOURCE MUST PROVIDE EXPLICIT PP + NOMINAL FORM SELECTION
  -- -----------------------------------------------------------------

  if not exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    cross join lateral
      jsonb_array_elements(
        x#>'{digital_model,model,lexical_frames}'
      ) frame

    cross join lateral
      jsonb_array_elements(
        coalesce(
          frame->'allowed_complements',
          '[]'::jsonb
        )
      ) complement

    where
      x->>'candidate_code' =
        'verb.complementation.form_selection'

      and complement->>'type' =
        'PP'

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: explicit PP selection missing';

  end if;


  if not exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    cross join lateral
      jsonb_array_elements(
        x#>'{digital_model,model,lexical_frames}'
      ) frame

    cross join lateral
      jsonb_array_elements(
        coalesce(
          frame->'allowed_complements',
          '[]'::jsonb
        )
      ) complement

    where
      x->>'candidate_code' =
        'verb.complementation.form_selection'

      and complement->>'type' =
        'nominal'

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: explicit nominal selection missing';

  end if;


  -- -----------------------------------------------------------------
  -- PP REQUIREDNESS SOURCE MUST EXIST
  -- -----------------------------------------------------------------

  if not exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    where
      x->>'candidate_code' =
        'verb.complementation.pp_optional_vs_required'

      and jsonb_array_length(
        x#>'{digital_model,model,lexical_frames}'
      ) > 0

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: PP requiredness source missing';

  end if;


  -- -----------------------------------------------------------------
  -- DIRECT OBJECT REQUIREDNESS SOURCES MUST BOTH EXIST
  -- -----------------------------------------------------------------

  if not exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    where
      x->>'candidate_code' =
        'verb.transitivity.obligatory_direct_object'

      and
      x#>>
        '{digital_model,model,lexical_property,direct_object}'
      =
        'required'

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: obligatory DO source missing';

  end if;


  if not exists (

    select 1

    from jsonb_array_elements(
      s->'runtime_frame_sources'
    ) x

    where
      x->>'candidate_code' =
        'verb.transitivity.optional_direct_object'

      and
      x#>>
        '{digital_model,model,lexical_property,direct_object}'
      =
        'optional'

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: optional DO source missing';

  end if;


  -- -----------------------------------------------------------------
  -- SUBJECT / COMPLEMENT BOUNDARY MUST REMAIN EXPLICIT
  -- -----------------------------------------------------------------

  if not exists (

    select 1

    from jsonb_array_elements(
      s->'ontology_reference'
    ) x

    where
      x->>'candidate_code' =
        'verb.valency.subject_not_complement'

      and
      x#>>
        '{digital_model,model,structural_distinction,subject}'
      =
        'valency_participant_but_not_verb_complement'

      and
      x#>>
        '{digital_model,model,structural_distinction,verb_complements}'
      =
        'valency_bound_constituents_inside_predicate'

  ) then

    raise exception
      'V1.45 A0.1 invariant failed: subject/complement boundary';

  end if;

end
$$;
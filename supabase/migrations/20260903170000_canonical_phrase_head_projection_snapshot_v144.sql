-- v1.44 — Canonical Phrase Head Projection Snapshot V1
--
-- BUILD / CONTROL PLANE ONLY.
--
-- Purpose:
--   expose the minimal safe read-only inputs required to construct
--   a canonical head-only phrase projection.
--
-- IMPORTANT:
--   Grammar Knowledge is frozen.
--
-- This snapshot DOES NOT export historical:
--   - phrase build strategy;
--   - transparent lexical classes;
--   - max_gap;
--   - dependency hints;
--   - compiler output;
--   - compiled grammar rule.
--
-- Morphological head constraints must be reconstructed from the frozen
-- morphology inventory + canonical morph registry, not copied from an
-- historical rule.
--
-- No grammar mutation.
-- No manifest mutation.
-- No grammar rule creation.
-- No activation.

create or replace function
public.canonical_phrase_head_projection_snapshot_v1(
  p_manifest_code text,
  p_source_candidate_code text,
  p_inventory_candidate_code text,
  p_pos text
)
returns jsonb
language sql
stable
security invoker
set search_path = 'public', 'pg_catalog'
as $function$

with source_row as (
  select
    c.id as candidate_id,
    e.candidate_code,
    c.status,
    c.requires_human_verification,
    c.source_section,
    c.extracted_payload,
    c.digital_model,
    e.execution_contract

  from public.grammar_knowledge_candidates c

  join public.grammar_knowledge_candidate_execution_v e
    on e.candidate_id = c.id

  where e.candidate_code =
    p_source_candidate_code
),

inventory_row as (
  select
    c.id as candidate_id,
    e.candidate_code,
    c.status,
    c.requires_human_verification,
    c.source_section,
    c.extracted_payload,
    c.digital_model,
    e.execution_contract

  from public.grammar_knowledge_candidates c

  join public.grammar_knowledge_candidate_execution_v e
    on e.candidate_id = c.id

  where e.candidate_code =
    p_inventory_candidate_code
),

manifest_row as (
  select
    m.id,
    m.code,
    m.authoring_status,
    m.runtime_family,
    m.execution_phase,
    m.constraint_strength,

    -- Only the structural action mapping is exposed.
    -- Historical dependencies/build strategy are intentionally excluded.
    m.actions,

    m.ir_spec#>>'{source,primary_candidate_code}'
      as primary_candidate_code,

    coalesce(
      m.ir_spec#>'{source,supporting_candidate_codes}',
      '[]'::jsonb
    ) as supporting_candidate_codes

  from public.grammar_runtime_manifests m

  where m.code = p_manifest_code
),

registry_rows as (
  select
    r.pos,
    r.form_key,
    r.form_scope,
    r.canonical_features,
    r.provenance_policy

  from public.grammar_morph_form_registry_v1 r

  where r.pos = p_pos
    and r.form_scope = 'token'
)

select jsonb_build_object(

  'version',
    'canonical-phrase-head-projection-snapshot-v1',

  'plane',
    'build_control',

  'read_only',
    true,

  'write_performed',
    false,

  'frozen_grammar_immutable',
    true,

  'historical_manifest_interpretation_only',
    true,

  'source',
    coalesce(
      (
        select jsonb_build_object(
          'candidate_id',
            s.candidate_id,

          'candidate_code',
            s.candidate_code,

          'status',
            s.status,

          'requires_human_verification',
            s.requires_human_verification,

          'source_section',
            s.source_section,

          'extracted_payload',
            s.extracted_payload,

          'digital_model',
            s.digital_model,

          'execution_contract',
            s.execution_contract
        )

        from source_row s
      ),
      '{}'::jsonb
    ),

  'morphology_inventory',
    coalesce(
      (
        select jsonb_build_object(
          'candidate_id',
            i.candidate_id,

          'candidate_code',
            i.candidate_code,

          'status',
            i.status,

          'requires_human_verification',
            i.requires_human_verification,

          'source_section',
            i.source_section,

          'extracted_payload',
            i.extracted_payload,

          'digital_model',
            i.digital_model,

          'execution_contract',
            i.execution_contract
        )

        from inventory_row i
      ),
      '{}'::jsonb
    ),

  'manifest_projection',
    coalesce(
      (
        select jsonb_build_object(
          'manifest_id',
            m.id,

          'manifest_code',
            m.code,

          'authoring_status',
            m.authoring_status,

          'runtime_family',
            m.runtime_family,

          'execution_phase',
            m.execution_phase,

          'constraint_strength',
            m.constraint_strength,

          'primary_candidate_code',
            m.primary_candidate_code,

          'supporting_candidate_codes',
            m.supporting_candidate_codes,

          'actions',
            m.actions
        )

        from manifest_row m
      ),
      '{}'::jsonb
    ),

  'morph_registry',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pos',
              r.pos,

            'form_key',
              r.form_key,

            'form_scope',
              r.form_scope,

            'canonical_features',
              r.canonical_features,

            'provenance_policy',
              r.provenance_policy
          )
          order by r.form_key
        )

        from registry_rows r
      ),
      '[]'::jsonb
    ),

  'excluded_historical_fields',
    jsonb_build_array(
      'dependencies',
      'bindings',
      'condition',
      'compiler',
      'compiled_rule',
      'build_strategy',
      'transparent_lexical_classes',
      'max_gap'
    ),

  'safety',
    jsonb_build_object(
      'grammar_mutation_allowed',
        false,

      'manifest_mutation_allowed',
        false,

      'grammar_rule_materialization_performed',
        false,

      'production_activation_performed',
        false
    )
);

$function$;


-- Build/control-plane only.
revoke all on function
public.canonical_phrase_head_projection_snapshot_v1(
  text,
  text,
  text,
  text
)
from anon, authenticated;


-- =====================================================================
-- Migration invariants
-- =====================================================================

do $block$
declare
  v_snapshot jsonb;
  v_manifest_before jsonb;
  v_manifest_after jsonb;
  v_count integer;
begin

  ----------------------------------------------------------------------
  -- Prove historical manifest is not modified by this migration.
  ----------------------------------------------------------------------

  select
    to_jsonb(m)
      - 'created_at'
      - 'updated_at'
  into v_manifest_before

  from public.grammar_runtime_manifests m

  where m.code =
    'ir.structural.verb_phrase.finite_head';


  if v_manifest_before is null then
    raise exception
      'v1.44 VP snapshot: historical finite-head manifest missing';
  end if;


  ----------------------------------------------------------------------
  -- Build exact read-only snapshot.
  ----------------------------------------------------------------------

  v_snapshot :=
    public.canonical_phrase_head_projection_snapshot_v1(
      'ir.structural.verb_phrase.finite_head',
      'verb.phrase.head.finite',
      'verb.form.finite.inventory',
      'verb'
    );


  if v_snapshot->>'version' <>
    'canonical-phrase-head-projection-snapshot-v1'
  then
    raise exception
      'v1.44 VP snapshot: version mismatch';
  end if;


  if not coalesce(
    (v_snapshot->>'read_only')::boolean,
    false
  ) then
    raise exception
      'v1.44 VP snapshot: snapshot must be read-only';
  end if;


  if coalesce(
    (v_snapshot->>'write_performed')::boolean,
    true
  ) then
    raise exception
      'v1.44 VP snapshot: unexpected write reported';
  end if;


  if not coalesce(
    (v_snapshot->>'frozen_grammar_immutable')::boolean,
    false
  ) then
    raise exception
      'v1.44 VP snapshot: frozen grammar invariant missing';
  end if;


  ----------------------------------------------------------------------
  -- Exact frozen source gate.
  ----------------------------------------------------------------------

  if v_snapshot#>>'{source,candidate_code}' <>
    'verb.phrase.head.finite'
  then
    raise exception
      'v1.44 VP snapshot: wrong source candidate';
  end if;


  if v_snapshot#>>'{source,status}' <>
    'source_verified'
  then
    raise exception
      'v1.44 VP snapshot: source is not source_verified';
  end if;


  if coalesce(
    (
      v_snapshot
        #>>'{source,requires_human_verification}'
    )::boolean,
    true
  ) then
    raise exception
      'v1.44 VP snapshot: source requires human verification';
  end if;


  if v_snapshot#>>'{source,extracted_payload,construction}' <>
    'verb_phrase'
  then
    raise exception
      'v1.44 VP snapshot: frozen construction is not verb_phrase';
  end if;


  if v_snapshot#>>'{source,extracted_payload,head_role}' <>
    'finite_verb'
  then
    raise exception
      'v1.44 VP snapshot: frozen head role is not finite_verb';
  end if;


  if v_snapshot#>>'{source,execution_contract,audit,disposition}' <>
    'KEEP_GRAMMAR_RUNTIME'
  then
    raise exception
      'v1.44 VP snapshot: source runtime disposition mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Exact frozen finite inventory.
  ----------------------------------------------------------------------

  if v_snapshot#>>'{morphology_inventory,candidate_code}' <>
    'verb.form.finite.inventory'
  then
    raise exception
      'v1.44 VP snapshot: finite inventory missing';
  end if;


  if v_snapshot
       #>'{morphology_inventory,extracted_payload,form_types}'
     <>
       '["present","past","imperative"]'::jsonb
  then
    raise exception
      'v1.44 VP snapshot: finite inventory drift';
  end if;


  ----------------------------------------------------------------------
  -- Historical manifest is interpretation metadata only.
  --
  -- We consume:
  --   source identity
  --   canonical phrase label
  --   head target
  --
  -- We explicitly do NOT export historical dependencies/build strategy.
  ----------------------------------------------------------------------

  if v_snapshot#>>'{manifest_projection,authoring_status}' <>
    'validated'
  then
    raise exception
      'v1.44 VP snapshot: manifest must be validated';
  end if;


  if v_snapshot#>>'{manifest_projection,primary_candidate_code}' <>
    'verb.phrase.head.finite'
  then
    raise exception
      'v1.44 VP snapshot: manifest primary source mismatch';
  end if;


  if v_snapshot#>>'{manifest_projection,runtime_family}' <>
    'verb_phrase'
  then
    raise exception
      'v1.44 VP snapshot: runtime family mismatch';
  end if;


  if v_snapshot#>>'{manifest_projection,execution_phase}' <>
    'phrase_build'
  then
    raise exception
      'v1.44 VP snapshot: execution phase mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Require create_phrase(VP) on finite.
  ----------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot#>'{manifest_projection,actions}'
    ) a

    where a->>'action' =
      'create_phrase'

      and a->>'target' =
        'finite'

      and a#>>'{value,phrase_type}' =
        'VP'
  ) then
    raise exception
      'v1.44 VP snapshot: create_phrase VP action missing';
  end if;


  ----------------------------------------------------------------------
  -- Require set_head(VP) on exactly the same finite binding.
  ----------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot#>'{manifest_projection,actions}'
    ) a

    where a->>'action' =
      'set_head'

      and a->>'target' =
        'finite'

      and a#>>'{value,phrase_type}' =
        'VP'
  ) then
    raise exception
      'v1.44 VP snapshot: set_head VP action missing';
  end if;


  ----------------------------------------------------------------------
  -- Morph registry proves Fin from DATA, independent of old manifest
  -- binding/dependencies.
  ----------------------------------------------------------------------

  select count(*)
  into v_count

  from jsonb_array_elements(
    v_snapshot->'morph_registry'
  ) r

  where r->>'form_key' in (
    'present',
    'past',
    'imperative'
  )

    and r->>'pos' = 'verb'

    and r->>'form_scope' = 'token'

    and r#>>'{canonical_features,VerbForm}' =
      'Fin';


  if v_count <> 3 then
    raise exception
      'v1.44 VP snapshot: finite registry evidence incomplete';
  end if;


  ----------------------------------------------------------------------
  -- Present / past / imperative must share VerbForm=Fin.
  -- Tense/Mood are deliberately NOT required as common features.
  ----------------------------------------------------------------------

  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) r

    where r->>'form_key' = 'present'
      and r#>>'{canonical_features,VerbForm}' = 'Fin'
  )
  or not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) r

    where r->>'form_key' = 'past'
      and r#>>'{canonical_features,VerbForm}' = 'Fin'
  )
  or not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) r

    where r->>'form_key' = 'imperative'
      and r#>>'{canonical_features,VerbForm}' = 'Fin'
  )
  then
    raise exception
      'v1.44 VP snapshot: common finite feature not data-backed';
  end if;


  ----------------------------------------------------------------------
  -- Ensure dangerous historical fields are not exported.
  ----------------------------------------------------------------------

  if v_snapshot#>'{manifest_projection,bindings}'
       is not null
     or
     v_snapshot#>'{manifest_projection,dependencies}'
       is not null
     or
     v_snapshot#>'{manifest_projection,build_strategy}'
       is not null
  then
    raise exception
      'v1.44 VP snapshot: historical execution fields leaked';
  end if;


  ----------------------------------------------------------------------
  -- Re-read and prove no manifest mutation occurred.
  ----------------------------------------------------------------------

  select
    to_jsonb(m)
      - 'created_at'
      - 'updated_at'
  into v_manifest_after

  from public.grammar_runtime_manifests m

  where m.code =
    'ir.structural.verb_phrase.finite_head';


  if v_manifest_before is distinct from
     v_manifest_after
  then
    raise exception
      'v1.44 VP snapshot: historical manifest unexpectedly modified';
  end if;

end;
$block$;
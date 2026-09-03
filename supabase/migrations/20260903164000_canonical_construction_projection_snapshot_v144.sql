-- v1.44 A3 — Canonical Construction Projection Snapshot V1
--
-- BUILD / CONTROL PLANE ONLY.
--
-- Purpose:
--   expose a read-only frozen Grammar Knowledge snapshot to the
--   canonical construction projection adapter.
--
-- This migration DOES NOT:
--   - update grammar_knowledge_candidates;
--   - update imported grammar;
--   - update digital_model / execution_contract;
--   - create grammar_rules;
--   - create runtime manifests;
--   - activate anything;
--   - mark construction.aux_nonfinite_core.v1 ready.
--
-- Frozen grammar remains immutable.

create or replace function
public.canonical_construction_projection_snapshot_v1(
  p_template_code text,
  p_reference_codes text[],
  p_pos text
)
returns jsonb
language sql
stable
security invoker
set search_path = 'public', 'pg_catalog'
as $function$

with template_row as (
  select
    t.template_code,
    t.execution_role,
    t.candidate_codes,
    t.model_type,
    t.semantic_category,
    t.pattern_type,
    t.rule_type,
    t.builder_contract,
    t.capability_status,
    t.required_capabilities,
    t.approval_status,
    t.notes

  from public.grammar_scoped_operator_templates_v1 t
  where t.template_code = p_template_code
),

candidate_rows as (
  select
    c.id as candidate_id,
    e.candidate_code,

    c.status,
    c.requires_human_verification,
    c.source_section,

    c.extracted_payload,
    c.digital_model,

    e.execution_contract

  from template_row t

  join public.grammar_knowledge_candidate_execution_v e
    on e.candidate_code = any(t.candidate_codes)

  join public.grammar_knowledge_candidates c
    on c.id = e.candidate_id
),

reference_rows as (
  select
    c.id as candidate_id,
    e.candidate_code,

    c.status,
    c.requires_human_verification,
    c.source_section,

    c.extracted_payload,
    c.digital_model,

    e.execution_contract

  from public.grammar_knowledge_candidate_execution_v e

  join public.grammar_knowledge_candidates c
    on c.id = e.candidate_id

  where e.candidate_code = any(
    coalesce(
      p_reference_codes,
      array[]::text[]
    )
  )
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
    'canonical-construction-projection-snapshot-v1',

  'write_performed',
    false,

  'read_only',
    true,

  'plane',
    'build_control',

  'frozen_grammar_immutable',
    true,

  'template',
    coalesce(
      (
        select jsonb_build_object(
          'template_code',
            t.template_code,

          'execution_role',
            t.execution_role,

          'candidate_codes',
            to_jsonb(t.candidate_codes),

          'model_type',
            t.model_type,

          'semantic_category',
            t.semantic_category,

          'pattern_type',
            t.pattern_type,

          'rule_type',
            t.rule_type,

          'builder_contract',
            t.builder_contract,

          'capability_status',
            t.capability_status,

          'required_capabilities',
            t.required_capabilities,

          'approval_status',
            t.approval_status,

          'notes',
            t.notes
        )
        from template_row t
      ),
      '{}'::jsonb
    ),

  'candidates',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'candidate_id',
              r.candidate_id,

            'candidate_code',
              r.candidate_code,

            'status',
              r.status,

            'requires_human_verification',
              r.requires_human_verification,

            'source_section',
              r.source_section,

            'extracted_payload',
              r.extracted_payload,

            'digital_model',
              r.digital_model,

            'execution_contract',
              r.execution_contract
          )
          order by r.candidate_code
        )
        from candidate_rows r
      ),
      '[]'::jsonb
    ),

  'reference_facts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'candidate_id',
              r.candidate_id,

            'candidate_code',
              r.candidate_code,

            'status',
              r.status,

            'requires_human_verification',
              r.requires_human_verification,

            'source_section',
              r.source_section,

            'extracted_payload',
              r.extracted_payload,

            'digital_model',
              r.digital_model,

            'execution_contract',
              r.execution_contract
          )
          order by r.candidate_code
        )
        from reference_rows r
      ),
      '[]'::jsonb
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

  'safety',
    jsonb_build_object(
      'grammar_mutation_allowed',
        false,

      'manifest_materialization_performed',
        false,

      'grammar_rule_materialization_performed',
        false,

      'production_activation_performed',
        false
    )
);

$function$;


-- This is a build/control-plane snapshot.
-- It must never become a per-text hot-path dependency.
revoke all on function
public.canonical_construction_projection_snapshot_v1(
  text,
  text[],
  text
)
from anon, authenticated;


-- ===================================================================
-- Migration invariants.
-- ===================================================================

do $block$
declare
  v_snapshot jsonb;

  v_template_before jsonb;
  v_template_after jsonb;

  v_count integer;
begin

  --------------------------------------------------------------------
  -- Scoped manifest template MUST stay blocked.
  --
  -- Canonical projection and legacy manifest materialization are
  -- intentionally separate paths.
  --------------------------------------------------------------------

  select
    to_jsonb(t) - 'created_at'
  into v_template_before
  from public.grammar_scoped_operator_templates_v1 t
  where t.template_code =
    'construction.aux_nonfinite_core.v1';

  if v_template_before is null then
    raise exception
      'v1.44 A3: construction scoped template missing';
  end if;

  if v_template_before->>'capability_status' <> 'blocked'
     or v_template_before->>'approval_status' <> 'blocked'
  then
    raise exception
      'v1.44 A3: scoped manifest template must remain blocked';
  end if;


  --------------------------------------------------------------------
  -- Read-only snapshot.
  --------------------------------------------------------------------

  v_snapshot :=
    public.canonical_construction_projection_snapshot_v1(
      'construction.aux_nonfinite_core.v1',

      array[
        'verb.form.finite.inventory',
        'verb.form.nonfinite.inventory'
      ],

      'verb'
    );


  if coalesce(
    (v_snapshot->>'write_performed')::boolean,
    true
  ) then
    raise exception
      'v1.44 A3: snapshot unexpectedly reports a write';
  end if;


  if not coalesce(
    (v_snapshot->>'read_only')::boolean,
    false
  ) then
    raise exception
      'v1.44 A3: snapshot must be read-only';
  end if;


  if not coalesce(
    (v_snapshot->>'frozen_grammar_immutable')::boolean,
    false
  ) then
    raise exception
      'v1.44 A3: frozen grammar invariant missing';
  end if;


  --------------------------------------------------------------------
  -- Existing scoped family remains exactly four frozen candidates.
  --------------------------------------------------------------------

  if jsonb_array_length(
    coalesce(
      v_snapshot->'candidates',
      '[]'::jsonb
    )
  ) <> 4 then
    raise exception
      'v1.44 A3: expected 4 scoped construction candidates';
  end if;


  select count(*)
  into v_count
  from jsonb_array_elements(
    v_snapshot->'candidates'
  ) x
  where x->>'status' = 'source_verified'
    and coalesce(
      (x->>'requires_human_verification')::boolean,
      true
    ) = false;

  if v_count <> 4 then
    raise exception
      'v1.44 A3: all 4 scoped candidates must remain source_verified';
  end if;


  --------------------------------------------------------------------
  -- Frozen morphology reference facts exist.
  --------------------------------------------------------------------

  if jsonb_array_length(
    coalesce(
      v_snapshot->'reference_facts',
      '[]'::jsonb
    )
  ) <> 2 then
    raise exception
      'v1.44 A3: expected finite + nonfinite reference facts';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'reference_facts'
    ) x
    where x->>'candidate_code' =
      'verb.form.finite.inventory'

      and x#>'{extracted_payload,form_types}' =
        '["present","past","imperative"]'::jsonb
  ) then
    raise exception
      'v1.44 A3: exact frozen finite inventory missing';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'reference_facts'
    ) x
    where x->>'candidate_code' =
      'verb.form.nonfinite.inventory'

      and x#>'{extracted_payload,form_types}' =
        '["infinitive","past_participle"]'::jsonb
  ) then
    raise exception
      'v1.44 A3: exact frozen nonfinite inventory missing';
  end if;


  --------------------------------------------------------------------
  -- Candidate-specific schema distinction.
  --
  -- No inference:
  -- source with explicit roles is executable by A2 mechanics;
  -- source without roles must remain adapter-blocked.
  --------------------------------------------------------------------

  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'candidates'
    ) x
    where x->>'candidate_code' =
      'verb.compound_form.finite_aux_nonfinite_main'

      and x#>>'{extracted_payload,finite_role}'
        is not null

      and x#>>'{extracted_payload,nonfinite_role}'
        is not null
  ) then
    raise exception
      'v1.44 A3: explicit finite/nonfinite role source missing';
  end if;


  if exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'candidates'
    ) x
    where x->>'candidate_code' =
      'verb.compound_form.finite_nonfinite.structure'

      and (
        x#>>'{extracted_payload,finite_role}'
          is not null

        or

        x#>>'{extracted_payload,nonfinite_role}'
          is not null
      )
  ) then
    raise exception
      'v1.44 A3: generic structure unexpectedly gained role schema';
  end if;


  --------------------------------------------------------------------
  -- Morphology is data-backed.
  --------------------------------------------------------------------

  select count(*)
  into v_count
  from jsonb_array_elements(
    v_snapshot->'morph_registry'
  ) x
  where x->>'form_key' in (
    'present',
    'past',
    'imperative',
    'infinitive',
    'past_participle',
    'present_participle'
  );

  if v_count <> 6 then
    raise exception
      'v1.44 A3: expected six canonical verb registry rows';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) x
    where x->>'form_key' = 'present'
      and x->'canonical_features' =
        '{"Tense":"Pres","VerbForm":"Fin"}'::jsonb
  ) then
    raise exception
      'v1.44 A3: present registry mapping drift';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) x
    where x->>'form_key' = 'past'
      and x->'canonical_features' =
        '{"Tense":"Past","VerbForm":"Fin"}'::jsonb
  ) then
    raise exception
      'v1.44 A3: past registry mapping drift';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) x
    where x->>'form_key' = 'imperative'
      and x->'canonical_features' =
        '{"Mood":"Imp","VerbForm":"Fin"}'::jsonb
  ) then
    raise exception
      'v1.44 A3: imperative registry mapping drift';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) x
    where x->>'form_key' = 'infinitive'
      and x->'canonical_features' =
        '{"VerbForm":"Inf"}'::jsonb
  ) then
    raise exception
      'v1.44 A3: infinitive registry mapping drift';
  end if;


  if not exists (
    select 1
    from jsonb_array_elements(
      v_snapshot->'morph_registry'
    ) x
    where x->>'form_key' = 'past_participle'
      and x->'canonical_features' =
        '{"Tense":"Past","VerbForm":"Part"}'::jsonb
  ) then
    raise exception
      'v1.44 A3: past participle registry mapping drift';
  end if;


  --------------------------------------------------------------------
  -- Re-read template and prove this migration did not unlock legacy
  -- manifest materialization.
  --------------------------------------------------------------------

  select
    to_jsonb(t) - 'created_at'
  into v_template_after
  from public.grammar_scoped_operator_templates_v1 t
  where t.template_code =
    'construction.aux_nonfinite_core.v1';


  if v_template_before is distinct from
     v_template_after
  then
    raise exception
      'v1.44 A3: scoped template was unexpectedly modified';
  end if;

end;
$block$;
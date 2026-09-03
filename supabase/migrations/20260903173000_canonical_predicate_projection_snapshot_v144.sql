-- v1.44 A4.0 — Canonical Predicate Projection Snapshot V1
--
-- BUILD / CONTROL PLANE ONLY.
--
-- Purpose:
--   expose the minimal frozen VP -> predicate contract required by
--   the canonical predicate producer.
--
-- Grammar Knowledge, manifest and grammar rule remain immutable.
--
-- Explicitly excluded from the canonical projection:
--   - grammar_rules.scope = clause
--   - compiler metadata
--   - compile hash
--   - priority/confidence
--   - legacy predicate-builder behavior
--   - clause construction
--   - valency / arguments
--
-- No grammar mutation.
-- No manifest mutation.
-- No grammar-rule mutation.
-- No activation.

create or replace function
public.canonical_predicate_projection_snapshot_v1(
  p_manifest_code text,
  p_rule_code text,
  p_source_candidate_code text
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

manifest_row as (
  select
    m.id as manifest_id,
    m.code as manifest_code,
    m.primary_candidate_id,
    m.runtime_family,
    m.execution_phase,
    m.execution_mode,
    m.constraint_strength,
    m.authoring_status,
    m.actions,

    m.ir_spec#>>'{source,primary_candidate_code}'
      as primary_candidate_code

  from public.grammar_runtime_manifests m

  where m.code =
    p_manifest_code
),

rule_row as (
  select
    r.id as rule_id,
    r.code as rule_code,
    r.runtime_manifest_id,
    r.pattern_type,
    r.rule_type,
    r.is_active,
    r.pattern,
    r.actions

  from public.grammar_rules r

  where r.code =
    p_rule_code
)

select jsonb_build_object(

  'version',
    'canonical-predicate-projection-snapshot-v1',

  'plane',
    'build_control',

  'read_only',
    true,

  'write_performed',
    false,

  'frozen_grammar_immutable',
    true,

  'historical_rule_interpretation_only',
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

  'manifest_projection',
    coalesce(
      (
        select jsonb_build_object(
          'manifest_id',
            m.manifest_id,

          'manifest_code',
            m.manifest_code,

          'primary_candidate_id',
            m.primary_candidate_id,

          'primary_candidate_code',
            m.primary_candidate_code,

          'runtime_family',
            m.runtime_family,

          'execution_phase',
            m.execution_phase,

          'execution_mode',
            m.execution_mode,

          'constraint_strength',
            m.constraint_strength,

          'authoring_status',
            m.authoring_status,

          'actions',
            m.actions
        )

        from manifest_row m
      ),
      '{}'::jsonb
    ),

  'rule_projection',
    coalesce(
      (
        select jsonb_build_object(
          'rule_id',
            r.rule_id,

          'rule_code',
            r.rule_code,

          'runtime_manifest_id',
            r.runtime_manifest_id,

          'pattern_type',
            r.pattern_type,

          'rule_type',
            r.rule_type,

          'is_active',
            r.is_active,

          'pattern',
            r.pattern,

          'actions',
            r.actions
        )

        from rule_row r
      ),
      '{}'::jsonb
    ),

  'excluded_historical_fields',
    jsonb_build_array(
      'scope',
      'priority',
      'base_confidence',
      'compiler_version',
      'compile_hash',
      'legacy_predicate_builder',
      'clause_structure',
      'valency',
      'arguments'
    ),

  'safety',
    jsonb_build_object(
      'grammar_mutation_allowed',
        false,

      'manifest_mutation_allowed',
        false,

      'grammar_rule_mutation_allowed',
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
public.canonical_predicate_projection_snapshot_v1(
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

  v_rule_before jsonb;
  v_rule_after jsonb;
begin

  ----------------------------------------------------------------------
  -- Historical artifacts must exist and must remain unchanged.
  ----------------------------------------------------------------------

  select
    to_jsonb(m)
      - 'created_at'
      - 'updated_at'
  into v_manifest_before

  from public.grammar_runtime_manifests m

  where m.code =
    'ir.structural.predicate.verb_phrase';


  if v_manifest_before is null then
    raise exception
      'v1.44 A4: predicate manifest missing';
  end if;


  select
    to_jsonb(r)
      - 'created_at'
      - 'updated_at'
  into v_rule_before

  from public.grammar_rules r

  where r.code =
    'nrg_rt_v1.structural.predicate.verb_phrase';


  if v_rule_before is null then
    raise exception
      'v1.44 A4: predicate rule missing';
  end if;


  ----------------------------------------------------------------------
  -- Build read-only snapshot.
  ----------------------------------------------------------------------

  v_snapshot :=
    public.canonical_predicate_projection_snapshot_v1(
      'ir.structural.predicate.verb_phrase',
      'nrg_rt_v1.structural.predicate.verb_phrase',
      'sentence.predicate.definition_verb_phrase'
    );


  ----------------------------------------------------------------------
  -- Global safety.
  ----------------------------------------------------------------------

  if v_snapshot->>'version' <>
    'canonical-predicate-projection-snapshot-v1'
  then
    raise exception
      'v1.44 A4: snapshot version mismatch';
  end if;


  if not coalesce(
    (v_snapshot->>'read_only')::boolean,
    false
  ) then
    raise exception
      'v1.44 A4: snapshot must be read-only';
  end if;


  if coalesce(
    (v_snapshot->>'write_performed')::boolean,
    true
  ) then
    raise exception
      'v1.44 A4: unexpected write reported';
  end if;


  if not coalesce(
    (v_snapshot->>'frozen_grammar_immutable')::boolean,
    false
  ) then
    raise exception
      'v1.44 A4: frozen grammar invariant missing';
  end if;


  ----------------------------------------------------------------------
  -- Frozen source.
  ----------------------------------------------------------------------

  if v_snapshot#>>'{source,candidate_code}' <>
    'sentence.predicate.definition_verb_phrase'
  then
    raise exception
      'v1.44 A4: wrong predicate source';
  end if;


  if v_snapshot#>>'{source,status}' <>
    'source_verified'
  then
    raise exception
      'v1.44 A4: predicate source not source_verified';
  end if;


  if coalesce(
    (
      v_snapshot
        #>>'{source,requires_human_verification}'
    )::boolean,
    true
  ) then
    raise exception
      'v1.44 A4: predicate source requires human verification';
  end if;


  if v_snapshot
       #>>'{source,extracted_payload,details,predicate_form}'
     <>
       'verb_phrase'
  then
    raise exception
      'v1.44 A4: frozen predicate form is not verb_phrase';
  end if;


  if not coalesce(
    (
      v_snapshot
        #>>'{source,extracted_payload,details,predicate_is_syntactic_unit}'
    )::boolean,
    false
  ) then
    raise exception
      'v1.44 A4: predicate syntactic-unit fact missing';
  end if;


  if v_snapshot
       #>>'{source,execution_contract,audit,disposition}'
     <>
       'KEEP_GRAMMAR_RUNTIME'
  then
    raise exception
      'v1.44 A4: source runtime disposition mismatch';
  end if;


  if v_snapshot
       #>>'{source,execution_contract,execution,role}'
     <>
       'predicate_structure'
  then
    raise exception
      'v1.44 A4: source execution role mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Validated manifest.
  ----------------------------------------------------------------------

  if v_snapshot
       #>>'{manifest_projection,manifest_code}'
     <>
       'ir.structural.predicate.verb_phrase'
  then
    raise exception
      'v1.44 A4: wrong predicate manifest';
  end if;


  if v_snapshot
       #>>'{manifest_projection,authoring_status}'
     <>
       'validated'
  then
    raise exception
      'v1.44 A4: predicate manifest not validated';
  end if;


  if v_snapshot
       #>>'{manifest_projection,primary_candidate_code}'
     <>
       'sentence.predicate.definition_verb_phrase'
  then
    raise exception
      'v1.44 A4: manifest primary source mismatch';
  end if;


  if v_snapshot
       #>>'{manifest_projection,execution_phase}'
     <>
       'predicate_build'
  then
    raise exception
      'v1.44 A4: predicate execution phase mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Manifest must assign predicate role to VP binding.
  ----------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot
        #>'{manifest_projection,actions}'
    ) a

    where a->>'action' =
      'set_role'

      and a->>'target' =
        'vp'

      and a#>>'{value,role}' =
        'predicate'
  ) then
    raise exception
      'v1.44 A4: predicate manifest set_role action missing';
  end if;


  ----------------------------------------------------------------------
  -- Frozen inactive graph rule.
  ----------------------------------------------------------------------

  if v_snapshot
       #>>'{rule_projection,rule_code}'
     <>
       'nrg_rt_v1.structural.predicate.verb_phrase'
  then
    raise exception
      'v1.44 A4: wrong predicate rule';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern_type}'
     <>
       'graph_pattern'
  then
    raise exception
      'v1.44 A4: predicate rule is not graph_pattern';
  end if;


  if coalesce(
    (
      v_snapshot
        #>>'{rule_projection,is_active}'
    )::boolean,
    true
  ) then
    raise exception
      'v1.44 A4: historical predicate rule must remain inactive';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,graph_operation}'
     <>
       'assign_role'
  then
    raise exception
      'v1.44 A4: graph operation is not assign_role';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,role}'
     <>
       'predicate'
  then
    raise exception
      'v1.44 A4: graph role is not predicate';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,target_ref}'
     <>
       'vp'
  then
    raise exception
      'v1.44 A4: predicate target ref mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Input must be phrase candidate with type VP.
  ----------------------------------------------------------------------

  if v_snapshot
       #>>'{rule_projection,pattern,bindings,vp,entity}'
     <>
       'phrase'
  then
    raise exception
      'v1.44 A4: VP binding entity mismatch';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,bindings,vp,where,op}'
     <>
       'eq'
  then
    raise exception
      'v1.44 A4: VP binding operation mismatch';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,bindings,vp,where,left,ref}'
     <>
       'vp.type'
  then
    raise exception
      'v1.44 A4: VP binding left ref mismatch';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,bindings,vp,where,right}'
     <>
       'VP'
  then
    raise exception
      'v1.44 A4: VP binding type mismatch';
  end if;


  ----------------------------------------------------------------------
  -- Head requirement must remain explicit.
  --
  -- Runtime adapter will map this to the canonical graph:
  --   head_of: TOKEN/MORPH -> VP
  -- and/or VP head metadata.
  ----------------------------------------------------------------------

  if v_snapshot
       #>>'{rule_projection,pattern,condition,op}'
     <>
       'exists'
  then
    raise exception
      'v1.44 A4: head condition operation mismatch';
  end if;


  if v_snapshot
       #>>'{rule_projection,pattern,condition,left,ref}'
     <>
       'vp.head'
  then
    raise exception
      'v1.44 A4: VP head requirement missing';
  end if;


  ----------------------------------------------------------------------
  -- Rule action agrees with manifest.
  ----------------------------------------------------------------------

  if not exists (
    select 1

    from jsonb_array_elements(
      v_snapshot
        #>'{rule_projection,actions}'
    ) a

    where a->>'action' =
      'set_role'

      and a->>'target' =
        'vp'

      and a#>>'{value,role}' =
        'predicate'
  ) then
    raise exception
      'v1.44 A4: predicate rule set_role action missing';
  end if;


  ----------------------------------------------------------------------
  -- Clause scope and compiler metadata MUST NOT be exported.
  ----------------------------------------------------------------------

  if v_snapshot
       #>'{rule_projection,scope}'
     is not null
  then
    raise exception
      'v1.44 A4: clause scope leaked into canonical projection';
  end if;


  if v_snapshot
       #>'{rule_projection,compiler_version}'
     is not null
     or
     v_snapshot
       #>'{rule_projection,compile_hash}'
     is not null
  then
    raise exception
      'v1.44 A4: historical compiler metadata leaked';
  end if;


  ----------------------------------------------------------------------
  -- Re-read and prove zero mutation.
  ----------------------------------------------------------------------

  select
    to_jsonb(m)
      - 'created_at'
      - 'updated_at'
  into v_manifest_after

  from public.grammar_runtime_manifests m

  where m.code =
    'ir.structural.predicate.verb_phrase';


  if v_manifest_before is distinct from
     v_manifest_after
  then
    raise exception
      'v1.44 A4: predicate manifest unexpectedly modified';
  end if;


  select
    to_jsonb(r)
      - 'created_at'
      - 'updated_at'
  into v_rule_after

  from public.grammar_rules r

  where r.code =
    'nrg_rt_v1.structural.predicate.verb_phrase';


  if v_rule_before is distinct from
     v_rule_after
  then
    raise exception
      'v1.44 A4: predicate rule unexpectedly modified';
  end if;

end;
$block$;
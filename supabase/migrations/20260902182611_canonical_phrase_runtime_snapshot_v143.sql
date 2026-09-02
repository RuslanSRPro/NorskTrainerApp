create or replace function public.canonical_phrase_runtime_snapshot_v1(
  p_manifest_codes text[] default array[
    'ir.structural.adjective_phrase.adjective_head',
    'ir.structural.noun_phrase.noun_head'
  ]::text[]
)
returns jsonb
language sql
stable
security invoker
set search_path = 'public', 'pg_catalog'
as $function$

with target_rows as (
  select
    m.id as manifest_id,
    m.code as manifest_code,
    m.runtime_family,
    m.execution_phase,
    m.authoring_status,
    m.constraint_strength,
    m.dependencies,
    m.compiler,

    r.id as rule_id,
    r.code as rule_code,
    r.rule_type,
    r.pattern_type,
    r.pattern,
    r.actions,
    r.result,
    r.parser_actions,
    r.compiler_version,
    r.compile_hash,
    r.is_active,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'candidate_id', c.id,
            'candidate_code', c.extracted_payload->>'candidate_code',
            'source_section', c.source_section,
            'status', c.status,
            'title', c.title
          )
          order by
            c.source_section,
            c.extracted_payload->>'candidate_code'
        )
        from public.grammar_runtime_manifest_sources ms
        join public.grammar_knowledge_candidates c
          on c.id = ms.candidate_id
        where ms.manifest_id = m.id
      ),
      '[]'::jsonb
    ) as manifest_sources,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'candidate_id', c.id,
            'candidate_code', c.extracted_payload->>'candidate_code',
            'source_section', c.source_section,
            'status', c.status,
            'title', c.title
          )
          order by
            c.source_section,
            c.extracted_payload->>'candidate_code'
        )
        from public.grammar_rule_sources gs
        join public.grammar_knowledge_candidates c
          on c.id = gs.candidate_id
        where gs.grammar_rule_id = r.id
      ),
      '[]'::jsonb
    ) as rule_sources

  from public.grammar_runtime_manifests m
  join public.grammar_rules r
    on r.runtime_manifest_id = m.id

  where m.code = any(p_manifest_codes)
    and m.authoring_status = 'validated'
    and m.execution_phase = 'phrase_build'
    and r.pattern_type = 'phrase_pattern'
)

select jsonb_build_object(
  'version',
    'canonical-phrase-runtime-snapshot-v1',

  'graph_version',
    'canonical-language-graph-v1',

  'consumer',
    'canonical_phrase_candidate_lattice_v1',

  'policy',
    jsonb_build_object(
      'read_only', true,
      'compiled_does_not_mean_activated', true,
      'production_parser_unchanged', true,
      'manifest_allowlist_required', true,
      'source_provenance_preserved', true
    ),

  'requested_manifest_codes',
    to_jsonb(p_manifest_codes),

  'row_count',
    (select count(*) from target_rows),

  'rows',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(t)
          order by t.manifest_code, t.rule_code
        )
        from target_rows t
      ),
      '[]'::jsonb
    )
);
$function$;

insert into public.pipeline_migration_registry (
  function_name,
  canonical_signature,
  canonical_migration
)
values
(
  'claim_next_semantic_normalization',
  '(p_limit integer, p_job_id uuid)',
  '20260614_make_semantic_normalization_job_scoped.sql'
),
(
  'claim_next_expression_semantic_normalization',
  '(p_limit integer, p_job_id uuid)',
  '20260614_make_semantic_normalization_job_scoped.sql'
)
on conflict (function_name)
do update
set
  canonical_signature = excluded.canonical_signature,
  canonical_migration = excluded.canonical_migration,
  recorded_at = now();
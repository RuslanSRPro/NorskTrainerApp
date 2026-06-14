-- canonical_pipeline_cleanup
-- Drops legacy RPC overloads left behind by superseded migrations.
-- Canonical versions remain:
-- - claim_* with (integer, uuid)
-- - update_*_semantic_audit_status with 13 params incl. learning_confidence
-- - promote_verification_results_for_job(uuid)

drop function if exists public.claim_next_expression_semantic_audit(integer);
drop function if exists public.claim_next_semantic_audit(integer);
drop function if exists public.claim_next_source_checks(integer);

drop function if exists public.update_expression_semantic_audit_status(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb
);

drop function if exists public.update_semantic_audit_status(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb
);

drop function if exists public.update_expression_semantic_audit_status(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  text,
  text,
  text
);

drop function if exists public.update_semantic_audit_status(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  text,
  text,
  text
);

create table if not exists public.pipeline_migration_registry (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  canonical_signature text not null,
  canonical_migration text not null,
  recorded_at timestamptz not null default now(),
  unique(function_name)
);

insert into public.pipeline_migration_registry (
  function_name,
  canonical_signature,
  canonical_migration
)
values
  (
    'claim_next_expression_semantic_audit',
    '(integer, uuid)',
    '20260614064635_unified_semantic_pipeline_v1.sql'
  ),
  (
    'claim_next_semantic_audit',
    '(integer, uuid)',
    '20260614064635_unified_semantic_pipeline_v1.sql'
  ),
  (
    'claim_next_source_checks',
    '(integer, uuid)',
    '20260612213129_make_claim_next_source_checks_job_scoped.sql'
  ),
  (
    'update_expression_semantic_audit_status',
    '(uuid,text,text,text,text,jsonb,jsonb,text,jsonb,text,text,text,text)',
    '20260614064635_unified_semantic_pipeline_v1.sql'
  ),
  (
    'update_semantic_audit_status',
    '(uuid,text,text,text,text,jsonb,jsonb,text,jsonb,text,text,text,text)',
    '20260614064635_unified_semantic_pipeline_v1.sql'
  ),
  (
    'promote_verification_results_for_job',
    '(uuid)',
    '20260614064635_unified_semantic_pipeline_v1.sql'
  )
on conflict (function_name) do update
set
  canonical_signature = excluded.canonical_signature,
  canonical_migration = excluded.canonical_migration,
  recorded_at = now();
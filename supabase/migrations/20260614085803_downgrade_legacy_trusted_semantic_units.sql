-- downgrade_legacy_trusted_semantic_units
-- Legacy semantic units were imported as trusted/high without passing
-- source_checks -> promotion -> semantic_audit.
-- They remain in semantic graph, but no longer count as verified/trusted evidence.

-- 1. Fix expression units that were attached as trusted_lexeme variants.

update public.semantic_unit_variants
set
  lexeme_id = null,
  variant_type = 'trusted_expression',
  updated_at = now()
where id in (
  '912abca5-0ef8-470c-8192-ad279f5173c8',
  '62f670b0-724f-4206-8224-1c4d60f4a5fb'
);

update public.canonical_semantic_units
set
  primary_source = 'trusted_expressions_v1',
  updated_at = now()
where id in (
  '5414fc7e-606d-4fc0-8358-e0ae150f2af0',
  'e49fb0df-091d-4c14-9734-1a3243d2ca83'
);

-- 2. Downgrade all legacy-imported units that were marked trusted/high
-- without the confidence model.

update public.canonical_semantic_units
set
  trusted = false,
  confidence = null,
  relation_status = 'pending',
  notes =
    case
      when notes ? 'legacy_trusted_import_without_verification'
      then notes
      else notes || '["legacy_trusted_import_without_verification"]'::jsonb
    end,
  updated_at = now()
where primary_source in (
    'trusted_lexemes_v1',
    'trusted_expressions_v1'
  )
  and trusted = true
  and confidence = 'high'
  and verification_confidence is null
  and semantic_confidence is null
  and form_confidence is null
  and source_confidence is null
  and learning_confidence is null;
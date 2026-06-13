update expression_catalog
set
  verification_status = 'component_verified',
  verification_tier = 'component_match',
  updated_at = now()
where id = 'e073363d-2ba8-44e1-ac1e-1ff118ca5339';

update expression_semantic_enrichment
set
  review_status = 'needs_review',
  semantic_confidence = 'low',
  audit_notes = coalesce(audit_notes, '[]'::jsonb)
    || '["downgraded_sentence_fragment_not_canonical_expression"]'::jsonb,
  updated_at = now()
where expression_id = 'e073363d-2ba8-44e1-ac1e-1ff118ca5339';
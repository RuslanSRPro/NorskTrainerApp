create or replace function update_semantic_audit_status(
  p_id uuid,
  p_status text,
  p_quality text,
  p_semantic_confidence text,
  p_review_status text,
  p_conflicts jsonb,
  p_audit_notes jsonb,
  p_source text,
  p_evidence jsonb,
  p_verification_confidence text,
  p_source_confidence text,
  p_form_confidence text,
  p_learning_confidence text
)
returns void
language plpgsql
security definer
as $$
begin
  update lexeme_semantic_enrichment
  set
    status = p_status,
    quality = p_quality,
    semantic_confidence = p_semantic_confidence,
    verification_confidence = p_verification_confidence,
    source_confidence = p_source_confidence,
    form_confidence = p_form_confidence,
    learning_confidence = p_learning_confidence,
    review_status = p_review_status,
    conflicts = coalesce(p_conflicts, '[]'::jsonb),
    audit_notes = coalesce(p_audit_notes, '[]'::jsonb),
    source = p_source,
    evidence = coalesce(p_evidence, '{}'::jsonb),
    updated_at = now()
  where id = p_id;
end;
$$;

create or replace function update_expression_semantic_audit_status(
  p_id uuid,
  p_status text,
  p_quality text,
  p_semantic_confidence text,
  p_review_status text,
  p_conflicts jsonb,
  p_audit_notes jsonb,
  p_source text,
  p_evidence jsonb,
  p_verification_confidence text,
  p_source_confidence text,
  p_form_confidence text,
  p_learning_confidence text
)
returns void
language plpgsql
security definer
as $$
begin
  update expression_semantic_enrichment
  set
    status = p_status,
    quality = p_quality,
    semantic_confidence = p_semantic_confidence,
    verification_confidence = p_verification_confidence,
    source_confidence = p_source_confidence,
    form_confidence = p_form_confidence,
    learning_confidence = p_learning_confidence,
    review_status = p_review_status,
    conflicts = coalesce(p_conflicts, '[]'::jsonb),
    audit_notes = coalesce(p_audit_notes, '[]'::jsonb),
    source = p_source,
    evidence = coalesce(p_evidence, '{}'::jsonb),
    updated_at = now()
  where id = p_id;
end;
$$;
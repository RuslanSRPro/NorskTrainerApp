create or replace function public.save_authoritative_semantic_relation(
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_relation_type text,
  p_target_text text,
  p_source text,
  p_confidence text default 'medium',
  p_status text default 'candidate',
  p_evidence jsonb default '{}'::jsonb,
  p_urls jsonb default '[]'::jsonb,
  p_target_entity_type text default null,
  p_target_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_id uuid;
begin
  insert into public.authoritative_semantic_relations (
    source_entity_type,
    source_entity_id,
    relation_type,
    target_text,
    target_entity_type,
    target_entity_id,
    source,
    confidence,
    status,
    evidence,
    urls,
    created_at,
    updated_at
  )
  values (
    p_source_entity_type,
    p_source_entity_id,
    p_relation_type,
    lower(trim(p_target_text)),
    p_target_entity_type,
    p_target_entity_id,
    p_source,
    p_confidence,
    p_status,
    p_evidence,
    p_urls,
    now(),
    now()
  )
  on conflict (
    source_entity_type,
    source_entity_id,
    relation_type,
    target_text,
    source
  )
  do update set
    confidence = excluded.confidence,
    status = excluded.status,
    evidence = excluded.evidence,
    urls = excluded.urls,
    target_entity_type = excluded.target_entity_type,
    target_entity_id = excluded.target_entity_id,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;
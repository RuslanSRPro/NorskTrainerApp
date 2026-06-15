create or replace function public.claim_next_relation_candidates(
  p_limit integer default 20
)
returns table(
  id uuid,
  source_entity_type text,
  source_entity_id uuid,
  relation_type text,
  target_text text
)
language plpgsql
as $function$
begin
  return query
  select
    r.id,
    r.source_entity_type,
    r.source_entity_id,
    r.relation_type,
    r.target_text
  from public.authoritative_semantic_relations r
  where
    r.status = 'candidate'
    and r.target_entity_id is null
  order by r.created_at asc
  limit p_limit
  for update skip locked;
end;
$function$;

create or replace function public.complete_relation_resolution(
  p_relation_id uuid,
  p_target_entity_type text,
  p_target_entity_id uuid,
  p_status text
)
returns void
language plpgsql
as $function$
begin
  update public.authoritative_semantic_relations
  set
    target_entity_type = p_target_entity_type,
    target_entity_id = p_target_entity_id,
    status = p_status,
    updated_at = now()
  where id = p_relation_id;
end;
$function$;
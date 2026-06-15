drop function if exists public.claim_next_source_checks(integer, uuid);

create function public.claim_next_source_checks(
  p_limit integer default 10,
  p_job_id uuid default null
)
returns table(
  id uuid,
  job_id uuid,
  item_id uuid,
  lexeme_id uuid,
  expression_id uuid,
  source text,
  stage text,
  query text,
  query_type text,
  attempt_count integer,
  max_attempts integer
)
language plpgsql
as $function$
begin
  return query
  with picked as (
    select c.id
    from public.lexeme_source_checks c
    where
      (
        c.status = 'pending'
        or (
          c.status = 'retry_scheduled'
          and c.next_retry_at is not null
          and c.next_retry_at <= now()
        )
      )
      and (
        p_job_id is null
        or c.job_id = p_job_id
      )
    order by c.created_at asc
    limit p_limit
    for update skip locked
  ),
  updated as (
    update public.lexeme_source_checks c
    set
      status = 'processing',
      updated_at = now()
    from picked
    where c.id = picked.id
    returning
      c.id,
      c.job_id,
      c.item_id,
      c.lexeme_id,
      c.source,
      c.stage,
      c.query,
      c.query_type,
      c.attempt_count,
      c.max_attempts
  )
  select
    u.id,
    u.job_id,
    u.item_id,
    u.lexeme_id,
    i.expression_id,
    u.source,
    u.stage,
    u.query,
    u.query_type,
    u.attempt_count,
    u.max_attempts
  from updated u
  left join public.lexeme_processing_items i
    on i.id = u.item_id;
end;
$function$;
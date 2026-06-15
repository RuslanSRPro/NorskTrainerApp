alter table public.source_lookup_cache
add column if not exists adapter_version text not null default 'legacy';

truncate table public.source_lookup_cache;

alter table public.source_lookup_cache
drop constraint if exists source_lookup_cache_source_query_type_normalized_query_key;

create unique index if not exists source_lookup_cache_versioned_key
on public.source_lookup_cache (
  source,
  query_type,
  normalized_query,
  adapter_version
);

drop function if exists public.get_cached_source_lookup(
  text,
  text,
  text
);

create function public.get_cached_source_lookup(
  p_source text,
  p_query text,
  p_query_type text default 'lemma',
  p_adapter_version text default 'legacy'
)
returns table(
  id uuid,
  status text,
  quality text,
  result_json jsonb,
  checked_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_expired boolean
)
language sql
stable
as $function$
  select
    c.id,
    c.status,
    c.quality,
    c.result_json,
    c.checked_at,
    c.expires_at,
    false as is_expired
  from public.source_lookup_cache c
  where
    c.source = p_source
    and c.query_type = p_query_type
    and c.normalized_query = lower(trim(p_query))
    and c.adapter_version = p_adapter_version
    and (
      c.expires_at is null
      or c.expires_at >= now()
    )
  order by c.checked_at desc
  limit 1;
$function$;

drop function if exists public.save_source_lookup_cache(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  integer
);

create function public.save_source_lookup_cache(
  p_source text,
  p_query text,
  p_query_type text,
  p_status text,
  p_quality text default null,
  p_result_json jsonb default '{}'::jsonb,
  p_error_message text default null,
  p_ttl_hours integer default 168,
  p_adapter_version text default 'legacy'
)
returns uuid
language plpgsql
as $function$
declare
  v_id uuid;
begin
  insert into public.source_lookup_cache (
    source,
    query,
    query_type,
    normalized_query,
    adapter_version,
    status,
    quality,
    result_json,
    error_message,
    checked_at,
    expires_at
  )
  values (
    p_source,
    p_query,
    p_query_type,
    lower(trim(p_query)),
    p_adapter_version,
    p_status,
    p_quality,
    p_result_json,
    p_error_message,
    now(),
    now() + make_interval(hours => p_ttl_hours)
  )
  on conflict (
    source,
    query_type,
    normalized_query,
    adapter_version
  )
  do update set
    status = excluded.status,
    quality = excluded.quality,
    result_json = excluded.result_json,
    error_message = excluded.error_message,
    checked_at = now(),
    expires_at = excluded.expires_at,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;
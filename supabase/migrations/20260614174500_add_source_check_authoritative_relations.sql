alter table public.lexeme_source_checks
add column if not exists authoritative_relations jsonb not null default '[]'::jsonb;

comment on column public.lexeme_source_checks.authoritative_relations is
'Authoritative relation candidates extracted from source lookup. Candidate-only, source-backed, not trusted automatically.';

drop function if exists public.update_lexeme_source_check_status(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  jsonb,
  jsonb
);

create function public.update_lexeme_source_check_status(
  p_check_id uuid,
  p_status text,
  p_quality text default null,
  p_found boolean default null,
  p_error_code text default null,
  p_error_message text default null,
  p_evidence jsonb default null,
  p_urls jsonb default null,
  p_authoritative_relations jsonb default '[]'::jsonb
)
returns void
language plpgsql
as $function$
declare
  v_attempt_count integer;
  v_max_attempts integer;
  v_next_retry_at timestamptz;
  v_final_status text;

  v_quality text;
  v_found boolean;
  v_registered_entry boolean;
  v_whole_unit_match boolean;
  v_component_match boolean;
  v_usage_match boolean;
begin
  select c.attempt_count + 1, c.max_attempts
  into v_attempt_count, v_max_attempts
  from public.lexeme_source_checks c
  where c.id = p_check_id;

  if v_attempt_count is null then
    raise exception 'Source check not found: %', p_check_id;
  end if;

  v_final_status := p_status;
  v_next_retry_at := null;

  v_quality := p_quality;
  v_found := p_found;

  v_registered_entry :=
    coalesce((p_evidence->>'registered_entry')::boolean, false);

  v_whole_unit_match :=
    coalesce((p_evidence->>'whole_unit_match')::boolean, false);

  v_component_match :=
    coalesce((p_evidence->>'component_match')::boolean, false);

  v_usage_match :=
    coalesce((p_evidence->>'usage_match')::boolean, false);

  if p_status in ('timeout', 'failed', 'error', 'rate_limited') then
    if v_attempt_count < v_max_attempts then
      v_final_status := 'retry_scheduled';
      v_next_retry_at := now() + public.get_retry_delay(v_attempt_count);
    else
      v_final_status := 'failed';
    end if;
  end if;

  update public.lexeme_source_checks c
  set
    status = v_final_status,
    quality = coalesce(v_quality, c.quality),
    found = coalesce(v_found, c.found),

    registered_entry = v_registered_entry,
    whole_unit_match = v_whole_unit_match,
    component_match = v_component_match,
    usage_match = v_usage_match,

    authoritative_relations = coalesce(
      p_authoritative_relations,
      c.authoritative_relations,
      '[]'::jsonb
    ),

    attempt_count = v_attempt_count,
    next_retry_at = v_next_retry_at,
    last_checked_at = now(),
    error_code = p_error_code,
    error_message = p_error_message,
    evidence = coalesce(p_evidence, c.evidence),
    urls = coalesce(p_urls, c.urls),
    updated_at = now()
  where c.id = p_check_id;
end;
$function$;
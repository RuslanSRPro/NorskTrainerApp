create or replace function normalize_text_unit(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          lower(coalesce(p_value, '')),
          '[\.,!\?;:"“”''«»\(\)\[\]\{\}]',
          '',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function create_text_analysis_job(
  p_text text,
  p_user_id text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_total_items integer := 0;
begin
  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'Text is required';
  end if;

  insert into lexeme_processing_jobs (
    user_id,
    input_type,
    input_text,
    status,
    total_items,
    done_items,
    partial_items,
    failed_items,
    skipped_items,
    summary,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    'text',
    p_text,
    'pending',
    0,
    0,
    0,
    0,
    0,
    '{}'::jsonb,
    now(),
    now()
  )
  returning id into v_job_id;

  with raw_tokens as (
    select
      token,
      ordinality as token_index
    from regexp_split_to_table(
      regexp_replace(
        lower(p_text),
        '[\.,!\?;:"“”''«»\(\)\[\]\{\}]',
        ' ',
        'g'
      ),
      '\s+'
    ) with ordinality as t(token, ordinality)
  ),
  cleaned_tokens as (
    select distinct on (normalize_text_unit(token))
      token,
      normalize_text_unit(token) as normalized_token,
      token_index
    from raw_tokens
    where normalize_text_unit(token) is not null
      and length(normalize_text_unit(token)) >= 2
    order by normalize_text_unit(token), token_index
  ),
  inserted_items as (
    insert into lexeme_processing_items (
      job_id,
      raw_input,
      normalized_input,
      normalized_lemma,
      surface_form,
      pos,
      match_type,
      status,
      current_stage,
      attempt_count,
      max_attempts,
      result_summary,
      created_at,
      updated_at
    )
    select
      v_job_id,
      token,
      normalized_token,
      normalized_token,
      token,
      null,
      'token',
      'pending',
      'source_checks',
      0,
      3,
      jsonb_build_object(
        'token_index', token_index,
        'ingestion_version', 'text_ingestion_v1'
      ),
      now(),
      now()
    from cleaned_tokens
    returning id, raw_input, normalized_input, normalized_lemma, surface_form
  ),
  inserted_checks as (
    insert into lexeme_source_checks (
      job_id,
      item_id,
      lexeme_id,
      source,
      stage,
      query,
      query_type,
      status,
      attempt_count,
      max_attempts,
      evidence,
      urls,
      verification_version,
      created_at,
      updated_at
    )
    select
      v_job_id,
      i.id,
      null,
      source_name,
      'verification',
      coalesce(i.surface_form, i.raw_input, i.normalized_lemma, i.normalized_input),
      'token',
      'pending',
      0,
      3,
      '{}'::jsonb,
      '[]'::jsonb,
      1,
      now(),
      now()
    from inserted_items i
    cross join (
      values
        ('NAOB'),
        ('Ordbokene'),
        ('Lexin'),
        ('Språkrådet'),
        ('Wiktionary')
    ) as sources(source_name)
    returning id
  )
  select count(*) into v_total_items
  from inserted_items;

  update lexeme_processing_jobs
  set
    total_items = v_total_items,
    summary = jsonb_build_object(
      'ingestion_version', 'text_ingestion_v1',
      'total_items', v_total_items,
      'source_checks_per_item', 5
    ),
    updated_at = now()
  where id = v_job_id;

  return v_job_id;
end;
$$;
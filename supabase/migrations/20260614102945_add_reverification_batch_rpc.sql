create or replace function public.enqueue_reverification_batch(
  p_limit integer default 20,
  p_entity_type text default 'all'
)
returns table (
  job_id uuid,
  item_count integer,
  source_check_count integer
)
language plpgsql
security definer
as $function$
declare
  v_job_id uuid;
  v_item_count integer := 0;
  v_check_count integer := 0;
begin
  insert into public.lexeme_processing_jobs (
    user_id,
    input_type,
    input_text,
    status,
    total_items,
    summary,
    created_at,
    updated_at
  )
  values (
    'system',
    'reverification',
    'reverification_batch_' || to_char(now(), 'YYYYMMDD_HH24MISS'),
    'pending',
    0,
    jsonb_build_object(
      'type', 'reverification_batch',
      'entity_type', p_entity_type,
      'limit', p_limit
    ),
    now(),
    now()
  )
  returning id into v_job_id;

  with candidates as (
    select
      'lexeme'::text as entity_type,
      l.id as lexeme_id,
      null::uuid as expression_id,
      l.lemma as raw_input,
      l.lemma as normalized_input,
      l.lemma as normalized_lemma,
      coalesce(l.display_form, l.lemma) as surface_form,
      coalesce(l.pos, 'unknown') as pos,
      'reverification'::text as match_type,
      l.created_at as created_at
    from public.lexemes l
    where p_entity_type in ('all', 'lexeme')
      and coalesce(l.lemma, '') <> ''

    union all

    select
      'expression'::text as entity_type,
      null::uuid as lexeme_id,
      e.id as expression_id,
      e.lemma as raw_input,
      e.normalized_key as normalized_input,
      e.normalized_key as normalized_lemma,
      e.display_form as surface_form,
      coalesce(e.pos, 'expression') as pos,
      'reverification'::text as match_type,
      e.created_at as created_at
    from public.expression_catalog e
    where p_entity_type in ('all', 'expression')
      and coalesce(e.normalized_key, e.lemma, '') <> ''
  ),

  selected as (
    select *
    from candidates c
    where not exists (
      select 1
      from public.lexeme_processing_items i
      join public.lexeme_processing_jobs j
        on j.id = i.job_id
      where j.input_type = 'reverification'
        and (
          (c.lexeme_id is not null and i.lexeme_id = c.lexeme_id)
          or
          (c.expression_id is not null and i.expression_id = c.expression_id)
        )
    )
    order by created_at
    limit p_limit
  ),

  inserted_items as (
    insert into public.lexeme_processing_items (
      job_id,
      lexeme_id,
      expression_id,
      raw_input,
      normalized_input,
      normalized_lemma,
      surface_form,
      pos,
      match_type,
      status,
      current_stage,
      result_summary,
      created_at,
      updated_at
    )
    select
      v_job_id,
      s.lexeme_id,
      s.expression_id,
      s.raw_input,
      s.normalized_input,
      s.normalized_lemma,
      s.surface_form,
      s.pos,
      s.match_type,
      'pending',
      'source_check',
      jsonb_build_object(
        'source', 'enqueue_reverification_batch',
        'entity_type', s.entity_type
      ),
      now(),
      now()
    from selected s
    returning id, lexeme_id, expression_id, normalized_lemma
  ),

  inserted_checks as (
    insert into public.lexeme_source_checks (
      job_id,
      item_id,
      lexeme_id,
      source,
      stage,
      query,
      query_type,
      status,
      registered_entry,
      whole_unit_match,
      component_match,
      usage_match,
      evidence,
      urls,
      created_at,
      updated_at
    )
    select
      v_job_id,
      ii.id,
      ii.lexeme_id,
      src.source,
      'verification',
      ii.normalized_lemma,
      case
        when ii.expression_id is not null then 'expression'
        else 'lemma'
      end,
      'pending',
      false,
      false,
      false,
      false,
      '{}'::jsonb,
      '[]'::jsonb,
      now(),
      now()
    from inserted_items ii
    cross join (
      values
        ('NAOB'),
        ('Ordbokene'),
        ('Lexin'),
        ('Språkrådet'),
        ('Wiktionary')
    ) as src(source)
    returning id
  )

  select
    (select count(*) from inserted_items),
    (select count(*) from inserted_checks)
  into
    v_item_count,
    v_check_count;

  update public.lexeme_processing_jobs
  set
    total_items = v_item_count,
    summary = coalesce(summary, '{}'::jsonb)
      || jsonb_build_object(
        'item_count', v_item_count,
        'source_check_count', v_check_count
      ),
    updated_at = now()
  where id = v_job_id;

  return query
  select
    v_job_id,
    v_item_count,
    v_check_count;
end;
$function$;
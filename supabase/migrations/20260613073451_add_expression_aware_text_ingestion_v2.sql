create or replace function public.create_text_analysis_job_v2(
  p_text text,
  p_user_id text default null
)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_job_id uuid;
  v_clean_text text;
  v_tokens text[];
  v_token_count int;
  v_covered int[] := '{}';
  v_i int;
  v_j int;
  v_k int;

  v_expr record;
  v_expr_tokens text[];
  v_expr_len int;
  v_slice text[];
  v_has_overlap boolean;

  v_item_id uuid;
  v_total_items int := 0;
  v_expression_items int := 0;
  v_token_items int := 0;

  v_sources text[] := array[
    'NAOB',
    'Ordbokene',
    'Lexin',
    'Språkrådet',
    'Wiktionary'
  ];
  v_source text;
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

  v_clean_text :=
    regexp_replace(
      lower(p_text),
      '[\.,!\?;:"“”''«»\(\)\[\]\{\}]',
      ' ',
      'g'
    );

  v_tokens :=
    regexp_split_to_array(
      regexp_replace(trim(v_clean_text), '\s+', ' ', 'g'),
      '\s+'
    );

  v_token_count := coalesce(array_length(v_tokens, 1), 0);

  -- 1. Expressions first: longest match wins
  for v_expr in
    select
      id,
      lemma,
      display_form,
      normalized_key,
      pos,
      expression_subtype,
      array_length(
        regexp_split_to_array(
          regexp_replace(trim(normalized_key), '\s+', ' ', 'g'),
          '\s+'
        ),
        1
      ) as token_len
    from expression_catalog
    where normalized_key is not null
      and length(trim(normalized_key)) > 0
      and normalized_key not like '%/%'
      and normalized_key !~ '[гґ]'
      and array_length(
        regexp_split_to_array(
          regexp_replace(trim(normalized_key), '\s+', ' ', 'g'),
          '\s+'
        ),
        1
      ) >= 2
    order by token_len desc, length(normalized_key) desc
  loop
    v_expr_tokens :=
      regexp_split_to_array(
        regexp_replace(trim(lower(v_expr.normalized_key)), '\s+', ' ', 'g'),
        '\s+'
      );

    v_expr_len := coalesce(array_length(v_expr_tokens, 1), 0);

    if v_expr_len = 0 or v_token_count < v_expr_len then
      continue;
    end if;

    v_i := 1;

    while v_i <= v_token_count loop
      v_has_overlap := false;

      -- exact phrase match
      v_slice := v_tokens[v_i : v_i + v_expr_len - 1];

      if v_slice = v_expr_tokens then
        for v_j in v_i .. v_i + v_expr_len - 1 loop
          if v_j = any(v_covered) then
            v_has_overlap := true;
          end if;
        end loop;

        if not v_has_overlap then
          insert into lexeme_processing_items (
            job_id,
            expression_id,
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
          values (
            v_job_id,
            v_expr.id,
            v_expr.display_form,
            v_expr.normalized_key,
            v_expr.normalized_key,
            v_expr.display_form,
            'expression',
            'expression',
            'pending',
            'source_checks',
            0,
            3,
            jsonb_build_object(
              'ingestion_version', 'expression_aware_text_ingestion_v2',
              'expression_subtype', v_expr.expression_subtype,
              'matched_token_start', v_i,
              'matched_token_end', v_i + v_expr_len - 1
            ),
            now(),
            now()
          )
          returning id into v_item_id;

          foreach v_source in array v_sources loop
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
            values (
              v_job_id,
              v_item_id,
              null,
              v_source,
              'lemma',
              v_expr.normalized_key,
              'expression',
              'pending',
              0,
              3,
              '{}'::jsonb,
              '[]'::jsonb,
              1,
              now(),
              now()
            );
          end loop;

          for v_j in v_i .. v_i + v_expr_len - 1 loop
            v_covered := array_append(v_covered, v_j);
          end loop;

          v_expression_items := v_expression_items + 1;
        end if;
      end if;

      v_i := v_i + 1;
    end loop;
  end loop;

  -- 2. Single words only for uncovered tokens
  for v_i in 1 .. v_token_count loop
    if v_i = any(v_covered) then
      continue;
    end if;

    if normalize_text_unit(v_tokens[v_i]) is null
       or length(normalize_text_unit(v_tokens[v_i])) < 2
    then
      continue;
    end if;

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
    values (
      v_job_id,
      v_tokens[v_i],
      normalize_text_unit(v_tokens[v_i]),
      normalize_text_unit(v_tokens[v_i]),
      v_tokens[v_i],
      null,
      'token',
      'pending',
      'source_checks',
      0,
      3,
      jsonb_build_object(
        'token_index', v_i,
        'ingestion_version', 'expression_aware_text_ingestion_v2'
      ),
      now(),
      now()
    )
    returning id into v_item_id;

    foreach v_source in array v_sources loop
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
      values (
        v_job_id,
        v_item_id,
        null,
        v_source,
        'lemma',
        normalize_text_unit(v_tokens[v_i]),
        'token',
        'pending',
        0,
        3,
        '{}'::jsonb,
        '[]'::jsonb,
        1,
        now(),
        now()
      );
    end loop;

    v_token_items := v_token_items + 1;
  end loop;

  v_total_items := v_expression_items + v_token_items;

  update lexeme_processing_jobs
  set
    total_items = v_total_items,
    summary = jsonb_build_object(
      'ingestion_version', 'expression_aware_text_ingestion_v2',
      'total_items', v_total_items,
      'expression_items', v_expression_items,
      'token_items', v_token_items,
      'source_checks_per_item', 5
    ),
    updated_at = now()
  where id = v_job_id;

  return v_job_id;
end;
$function$;

create or replace function public.create_text_analysis_job(
  p_text text,
  p_user_id text default null
)
returns uuid
language plpgsql
security definer
as $function$
begin
  return public.create_text_analysis_job_v2(p_text, p_user_id);
end;
$function$;
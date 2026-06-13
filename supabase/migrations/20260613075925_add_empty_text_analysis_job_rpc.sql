create or replace function public.create_empty_text_analysis_job(
  p_text text,
  p_user_id text default null,
  p_ingestion_version text default 'ts_expression_aware_ingestion_v1'
)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_job_id uuid;
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
    jsonb_build_object(
      'ingestion_version', p_ingestion_version,
      'created_by', 'analyze_text_edge_function'
    ),
    now(),
    now()
  )
  returning id into v_job_id;

  return v_job_id;
end;
$function$;
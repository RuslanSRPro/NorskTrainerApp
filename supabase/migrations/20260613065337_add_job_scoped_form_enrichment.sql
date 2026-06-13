create or replace function public.enqueue_form_enrichment_for_job(
  p_job_id uuid
)
returns integer
language plpgsql
security definer
as $function$
declare
  v_count integer := 0;
begin
  insert into lexeme_form_enrichment (
    item_id,
    job_id,
    lexeme_id,
    expression_id,
    surface_form,
    normalized_lemma,
    pos,
    status,
    grammatical_features,
    accepted_variants,
    evidence,
    created_at,
    updated_at
  )
  select
    i.id,
    i.job_id,
    i.lexeme_id,
    i.expression_id,
    coalesce(i.surface_form, i.raw_input),
    i.normalized_lemma,
    coalesce(l.pos, i.pos),
    'pending',
    '{}'::jsonb,
    '[]'::jsonb,
    jsonb_build_object(
      'source', 'enqueue_form_enrichment_for_job',
      'version', 'form_enrichment_enqueue_v1'
    ),
    now(),
    now()
  from lexeme_processing_items i
  left join lexemes l
    on l.id = i.lexeme_id
  where i.job_id = p_job_id
    and i.lexeme_id is not null
    and not exists (
      select 1
      from lexeme_form_enrichment f
      where f.item_id = i.id
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.claim_next_form_enrichment(
  p_limit integer default 20,
  p_job_id uuid default null
)
returns setof lexeme_form_enrichment
language plpgsql
security definer
as $function$
begin
  return query
  update lexeme_form_enrichment f
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    updated_at = now()
  where f.id in (
    select q.id
    from lexeme_form_enrichment q
    where q.status in ('pending', 'retry')
      and q.attempt_count < q.max_attempts
      and (
        p_job_id is null
        or q.job_id = p_job_id
      )
    order by q.created_at
    limit p_limit
    for update skip locked
  )
  returning f.*;
end;
$function$;

create or replace function public.update_form_enrichment_status(
  p_id uuid,
  p_status text,
  p_quality text,
  p_canonical_form text,
  p_form_type text,
  p_grammatical_features jsonb,
  p_accepted_variants jsonb,
  p_source text,
  p_evidence jsonb,
  p_error_message text
)
returns void
language plpgsql
security definer
as $function$
declare
  v_lexeme_id uuid;
  v_inferred_pos text;
begin
  update lexeme_form_enrichment
  set
    status = p_status,
    quality = p_quality,
    canonical_form = p_canonical_form,
    form_type = p_form_type,
    grammatical_features = coalesce(p_grammatical_features, '{}'::jsonb),
    accepted_variants = coalesce(p_accepted_variants, '[]'::jsonb),
    source = p_source,
    evidence = coalesce(p_evidence, '{}'::jsonb),
    error_message = p_error_message,
    updated_at = now()
  where id = p_id
  returning
    lexeme_id,
    coalesce(
      p_grammatical_features ->> 'pos',
      p_grammatical_features ->> 'inferred_pos'
    )
  into
    v_lexeme_id,
    v_inferred_pos;

  if p_status = 'done'
     and v_lexeme_id is not null
     and v_inferred_pos is not null
     and v_inferred_pos <> 'unknown'
  then
    update lexemes
    set
      pos = v_inferred_pos,
      updated_at = now()
    where id = v_lexeme_id
      and (
        pos is null
        or pos = 'unknown'
      );
  end if;
end;
$function$;
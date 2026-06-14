-- unified_semantic_pipeline_v1
-- Finalized verification → promotion → semantic audit → form enrichment pipeline

create table if not exists public.expression_semantic_enrichment (
  id uuid primary key default gen_random_uuid(),

  expression_id uuid not null references public.expression_catalog(id) on delete cascade,

  status text not null default 'pending',
  quality text null,

  semantic_confidence text null,
  verification_confidence text null,
  source_confidence text null,
  form_confidence text null,
  learning_confidence text null,

  review_status text null,
  conflicts jsonb not null default '[]'::jsonb,
  audit_notes jsonb not null default '[]'::jsonb,

  semantic_unit_id uuid null references public.canonical_semantic_units(id),
  normalization_status text not null default 'pending',

  source text null,
  evidence jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(expression_id)
);

alter table public.expression_semantic_enrichment
  add column if not exists verification_confidence text null,
  add column if not exists source_confidence text null,
  add column if not exists form_confidence text null,
  add column if not exists learning_confidence text null;

alter table public.lexeme_semantic_enrichment
  add column if not exists verification_confidence text null,
  add column if not exists source_confidence text null,
  add column if not exists form_confidence text null,
  add column if not exists learning_confidence text null;

create or replace function public.promote_verification_results_for_job(
  p_job_id uuid
)
returns integer
language plpgsql
security definer
as $function$
declare
  v_count integer := 0;
begin
  with source_summary as (
    select
      i.id as item_id,
      i.lexeme_id,
      i.expression_id,
      i.normalized_lemma,
      i.surface_form,
      i.match_type,

      max(
        case sc.quality
          when 'strong' then 5
          when 'medium' then 4
          when 'weak' then 3
          when 'not_found' then 1
          when 'error' then 0
          else 0
        end
      ) as best_rank,

      string_agg(distinct sc.source, '+') filter (
        where sc.found = true
          and sc.quality in ('strong', 'medium')
      ) as source_verified,

      jsonb_object_agg(
        sc.source,
        jsonb_build_object(
          'status', sc.status,
          'quality', sc.quality,
          'found', sc.found,
          'registered_entry', sc.registered_entry,
          'whole_unit_match', sc.whole_unit_match,
          'component_match', sc.component_match,
          'usage_match', sc.usage_match,
          'evidence', sc.evidence
        )
      ) as verification_evidence

    from public.lexeme_processing_items i
    join public.lexeme_source_checks sc
      on sc.item_id = i.id
    where i.job_id = p_job_id
      and sc.status in ('done', 'partial')
    group by
      i.id,
      i.lexeme_id,
      i.expression_id,
      i.normalized_lemma,
      i.surface_form,
      i.match_type
  ),

  expression_candidates as (
    select *
    from source_summary
    where expression_id is not null
      and best_rank >= 3
  ),

  expression_updates as (
    update public.expression_catalog e
    set
      source_verified = ec.source_verified,
      verification_status = 'promoted',
      verification_tier =
        case ec.best_rank
          when 5 then 'dictionary_entry'
          when 4 then 'dictionary_match'
          when 3 then 'weak_match'
          when 1 then 'not_found'
          else 'unknown'
        end,
      verification_evidence = ec.verification_evidence,
      updated_at = now()
    from expression_candidates ec
    where e.id = ec.expression_id
    returning e.id
  ),

  expression_items as (
    update public.lexeme_processing_items i
    set
      status = 'done',
      current_stage = 'semantic_audit',
      result_summary =
        coalesce(i.result_summary, '{}'::jsonb)
        || jsonb_build_object(
          'promotion_status', 'expression_promoted',
          'expression_id', i.expression_id,
          'promotion_version', 'expression_promotion_v1'
        ),
      updated_at = now()
    where i.job_id = p_job_id
      and i.expression_id in (
        select expression_id
        from expression_candidates
      )
    returning i.id, i.expression_id
  ),

  inserted_expression_enrichment as (
    insert into public.expression_semantic_enrichment (
      expression_id,
      status,
      created_at,
      updated_at
    )
    select distinct
      ei.expression_id,
      'pending',
      now(),
      now()
    from expression_items ei
    where ei.expression_id is not null
    on conflict (expression_id) do update
    set
      status = 'pending',
      updated_at = now()
    returning id
  ),

  token_candidates as (
    select *
    from source_summary
    where expression_id is null
      and lexeme_id is null
      and best_rank >= 4
      and normalized_lemma is not null
  ),

  inserted_lexemes as (
    insert into public.lexemes (
      lemma,
      pos,
      display_form,
      source,
      verification_status,
      verification_tier,
      source_verified,
      verification_evidence,
      created_at,
      updated_at
    )
    select
      tc.normalized_lemma,
      'unknown',
      coalesce(tc.surface_form, tc.normalized_lemma),
      'pipeline_promotion',
      'promoted',
      case tc.best_rank
        when 5 then 'dictionary_entry'
        when 4 then 'dictionary_match'
        when 3 then 'weak_match'
        when 1 then 'not_found'
        else 'unknown'
      end,
      tc.source_verified,
      tc.verification_evidence,
      now(),
      now()
    from token_candidates tc
    where not exists (
      select 1
      from public.lexemes l
      where lower(l.lemma) = lower(tc.normalized_lemma)
    )
    returning id, lemma
  ),

  lexeme_matches as (
    select
      tc.item_id,
      l.id as lexeme_id,
      tc.best_rank,
      tc.source_verified,
      tc.verification_evidence
    from token_candidates tc
    join public.lexemes l
      on lower(l.lemma) = lower(tc.normalized_lemma)
  ),

  updated_lexemes as (
    update public.lexemes l
    set
      source_verified = lm.source_verified,
      verification_status = 'promoted',
      verification_tier =
        case lm.best_rank
          when 5 then 'dictionary_entry'
          when 4 then 'dictionary_match'
          when 3 then 'weak_match'
          when 1 then 'not_found'
          else 'unknown'
        end,
      verification_evidence = lm.verification_evidence,
      updated_at = now()
    from lexeme_matches lm
    where l.id = lm.lexeme_id
    returning l.id
  ),

  updated_items as (
    update public.lexeme_processing_items i
    set
      lexeme_id = lm.lexeme_id,
      status = 'done',
      current_stage = 'semantic_audit',
      result_summary =
        coalesce(i.result_summary, '{}'::jsonb)
        || jsonb_build_object(
          'promotion_status', 'promoted',
          'lexeme_id', lm.lexeme_id,
          'promotion_version', 'verification_promotion_v2'
        ),
      updated_at = now()
    from lexeme_matches lm
    where i.id = lm.item_id
    returning i.id, i.lexeme_id
  ),

  inserted_semantic_enrichment as (
    insert into public.lexeme_semantic_enrichment (
      lexeme_id,
      status,
      created_at,
      updated_at
    )
    select
      ui.lexeme_id,
      'pending',
      now(),
      now()
    from updated_items ui
    where ui.lexeme_id is not null
    on conflict (lexeme_id) do update
    set
      status = 'pending',
      updated_at = now()
    returning id
  )

  select
    (select count(*) from expression_items)
    +
    (select count(*) from updated_items)
  into v_count;

  return v_count;
end;
$function$;

create or replace function public.claim_next_semantic_audit(
  p_limit integer default 20,
  p_job_id uuid default null
)
returns table (
  id uuid,
  lexeme_id uuid,
  lemma text,
  pos text,
  translation_ua text,
  translation_en text,
  cefr text,
  frequency_rank integer,
  frequency_level text,
  topic text,
  verification_tier text,
  source_verified text,
  verification_status text,
  verification_evidence jsonb
)
language plpgsql
security definer
as $function$
begin
  return query
  update public.lexeme_semantic_enrichment se
  set
    status = 'processing',
    updated_at = now()
  from public.lexemes l
  where se.lexeme_id = l.id
    and se.id in (
      select q.id
      from public.lexeme_semantic_enrichment q
      where q.status in ('pending', 'retry')
        and (
          p_job_id is null
          or exists (
            select 1
            from public.lexeme_processing_items i
            where i.job_id = p_job_id
              and i.lexeme_id = q.lexeme_id
          )
        )
      order by q.created_at
      limit p_limit
      for update skip locked
    )
  returning
    se.id,
    se.lexeme_id,
    l.lemma,
    l.pos,
    l.translation_ua,
    l.translation_en,
    l.cefr::text,
    l.frequency_rank,
    l.frequency_level,
    l.topic,
    l.verification_tier,
    l.source_verified,
    l.verification_status,
    l.verification_evidence;
end;
$function$;

create or replace function public.claim_next_expression_semantic_audit(
  p_limit integer default 20,
  p_job_id uuid default null
)
returns table (
  id uuid,
  expression_id uuid,
  lemma text,
  display_form text,
  normalized_key text,
  pos text,
  expression_subtype text,
  translation_ua text,
  translation_en text,
  cefr text,
  frequency_rank integer,
  frequency_level text,
  topic text,
  verification_tier text,
  source_verified text,
  verification_status text,
  verification_evidence jsonb
)
language plpgsql
security definer
as $function$
begin
  return query
  update public.expression_semantic_enrichment ese
  set
    status = 'processing',
    updated_at = now()
  from public.expression_catalog ec
  where ese.expression_id = ec.id
    and ese.id in (
      select q.id
      from public.expression_semantic_enrichment q
      where q.status in ('pending', 'retry')
        and (
          p_job_id is null
          or exists (
            select 1
            from public.lexeme_processing_items i
            where i.job_id = p_job_id
              and i.expression_id = q.expression_id
          )
        )
      order by q.created_at
      limit p_limit
      for update skip locked
    )
  returning
    ese.id,
    ese.expression_id,
    ec.lemma,
    ec.display_form,
    ec.normalized_key,
    ec.pos,
    ec.expression_subtype,
    ec.translation_ua,
    ec.translation_en,
    ec.cefr,
    ec.frequency_rank,
    ec.frequency_level,
    ec.topic,
    ec.verification_tier,
    ec.source_verified,
    ec.verification_status,
    ec.verification_evidence;
end;
$function$;

create or replace function public.update_expression_semantic_audit_status(
  p_id uuid,
  p_status text,
  p_quality text,
  p_semantic_confidence text,
  p_review_status text,
  p_conflicts jsonb,
  p_audit_notes jsonb,
  p_source text,
  p_evidence jsonb,
  p_verification_confidence text default null,
  p_source_confidence text default null,
  p_form_confidence text default null,
  p_learning_confidence text default null
)
returns void
language plpgsql
security definer
as $function$
begin
  update public.expression_semantic_enrichment
  set
    status = p_status,
    quality = p_quality,
    semantic_confidence = p_semantic_confidence,
    verification_confidence = p_verification_confidence,
    source_confidence = p_source_confidence,
    form_confidence = p_form_confidence,
    learning_confidence = p_learning_confidence,
    review_status = p_review_status,
    conflicts = coalesce(p_conflicts, '[]'::jsonb),
    audit_notes = coalesce(p_audit_notes, '[]'::jsonb),
    source = p_source,
    evidence = coalesce(p_evidence, '{}'::jsonb),
    updated_at = now()
  where id = p_id;
end;
$function$;

create or replace function public.claim_next_expression_semantic_normalization(
  p_limit integer default 50
)
returns table (
  enrichment_id uuid,
  expression_id uuid,
  lemma text,
  pos text,
  review_status text,
  semantic_confidence text
)
language plpgsql
security definer
as $function$
begin
  return query
  update public.expression_semantic_enrichment ese
  set
    normalization_status = 'processing',
    updated_at = now()
  from public.expression_catalog ec
  where ese.expression_id = ec.id
    and ese.review_status = 'trusted'
    and coalesce(ese.normalization_status, 'pending') in ('pending', 'retry')
    and ese.id in (
      select q.id
      from public.expression_semantic_enrichment q
      where q.review_status = 'trusted'
        and coalesce(q.normalization_status, 'pending') in ('pending', 'retry')
      order by q.created_at
      limit p_limit
      for update skip locked
    )
  returning
    ese.id,
    ese.expression_id,
    ec.lemma,
    coalesce(ec.pos, 'expression') as pos,
    ese.review_status,
    ese.semantic_confidence;
end;
$function$;

create or replace function public.complete_expression_semantic_normalization(
  p_enrichment_id uuid,
  p_semantic_unit_id uuid
)
returns void
language plpgsql
security definer
as $function$
begin
  update public.expression_semantic_enrichment
  set
    normalization_status = 'done',
    semantic_unit_id = p_semantic_unit_id,
    updated_at = now()
  where id = p_enrichment_id;
end;
$function$;

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
  insert into public.lexeme_form_enrichment (
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
  from public.lexeme_processing_items i
  left join public.lexemes l
    on l.id = i.lexeme_id
  where i.job_id = p_job_id
    and i.lexeme_id is not null
    and not exists (
      select 1
      from public.lexeme_form_enrichment f
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
returns setof public.lexeme_form_enrichment
language plpgsql
security definer
as $function$
begin
  return query
  update public.lexeme_form_enrichment f
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    updated_at = now()
  where f.id in (
    select q.id
    from public.lexeme_form_enrichment q
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
  update public.lexeme_form_enrichment
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
    update public.lexemes
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
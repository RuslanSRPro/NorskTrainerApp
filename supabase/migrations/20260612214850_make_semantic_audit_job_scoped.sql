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
  update lexeme_semantic_enrichment se
  set
    status = 'processing',
    updated_at = now()
  from lexemes l
  where se.lexeme_id = l.id
    and se.id in (
      select q.id
      from lexeme_semantic_enrichment q
      where q.status in ('pending', 'retry')
        and (
          p_job_id is null
          or exists (
            select 1
            from lexeme_processing_items i
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
  update expression_semantic_enrichment ese
  set
    status = 'processing',
    updated_at = now()
  from expression_catalog ec
  where ese.expression_id = ec.id
    and ese.id in (
      select q.id
      from expression_semantic_enrichment q
      where q.status in ('pending', 'retry')
        and (
          p_job_id is null
          or exists (
            select 1
            from lexeme_processing_items i
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
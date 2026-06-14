create or replace function public.claim_next_semantic_normalization(
  p_limit integer default 50,
  p_job_id uuid default null
)
returns table (
  enrichment_id uuid,
  lexeme_id uuid,
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
  update public.lexeme_semantic_enrichment se
  set
    normalization_status = 'processing',
    updated_at = now()
  from public.lexemes l
  where se.lexeme_id = l.id
    and se.review_status = 'trusted'
    and coalesce(se.normalization_status, 'pending') in ('pending', 'retry')
    and se.id in (
      select q.id
      from public.lexeme_semantic_enrichment q
      where q.review_status = 'trusted'
        and coalesce(q.normalization_status, 'pending') in ('pending', 'retry')
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
    se.review_status,
    se.semantic_confidence;
end;
$function$;

create or replace function public.claim_next_expression_semantic_normalization(
  p_limit integer default 50,
  p_job_id uuid default null
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
    coalesce(ec.pos, 'expression') as pos,
    ese.review_status,
    ese.semantic_confidence;
end;
$function$;

drop function if exists public.claim_next_semantic_normalization(integer);
drop function if exists public.claim_next_expression_semantic_normalization(integer);
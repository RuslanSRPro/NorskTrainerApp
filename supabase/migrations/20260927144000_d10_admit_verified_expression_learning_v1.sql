-- Admit only expressions whose own Bokmal subarticle was bound and audited.
-- New expression lexemes are intentionally created as non-learning candidates.
-- Verification is refreshed before this RPC runs at the start of job audit.
begin;

create or replace function public.admit_verified_job_expressions_v1(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_enabled_ids uuid[] := '{}'::uuid[];
  v_root_id uuid;
  v_roots integer := 0;
begin
  if p_job_id is null then
    raise exception 'job_id required';
  end if;

  with eligible as (
    select distinct e.lexeme_id
    from public.lexeme_processing_items i
    join public.expression_catalog e on e.id = i.expression_id
    join public.lexemes l on l.id = e.lexeme_id
    join lateral (
      select count(distinct c.candidate_article_id::text) as article_count,
             min(c.candidate_article_id::text) as article_id
      from public.ordbokene_expression_candidates c
      where c.promoted_expression_id = e.id
        and lower(btrim(c.normalized_key)) = lower(btrim(e.normalized_key))
        and upper(c.candidate_dictionary_code) = 'BM'
        and c.candidate_kind = 'expression'
        and c.status in ('promoted', 'duplicate')
        and c.candidate_article_id is not null
        and c.parent_article_id is not null
    ) article on true
    where i.job_id = p_job_id
      and i.expression_id is not null
      and i.result_summary->>'promotion_status' = 'expression_promoted'
      and e.expression_subtype = 'ordbokene_sub_article'
      and e.verification_status in ('authoritative', 'multi_source')
      and l.pos = 'expression'
      and l.verification_tier = 'dictionary_match'
      and l.dictionary_status = 'active'
      and l.dictionary_exclusion_reason is null
      and l.is_learning_lexeme = false
      and article.article_count = 1
      and coalesce(
        l.verification_evidence->'Ordbokene'->'evidence'->>'article_id',
        l.verification_evidence->'Ordbokene'->>'article_id'
      ) = article.article_id
      and exists (
        select 1 from private.lexeme360_expression_roots_v1 binding
        where binding.expression_id = e.id
      )
  ), enabled as (
    update public.lexemes l
    set is_learning_lexeme = true, updated_at = now()
    from eligible e
    where l.id = e.lexeme_id and l.is_learning_lexeme = false
    returning l.id
  )
  select coalesce(array_agg(id), '{}'::uuid[])
  into v_enabled_ids
  from enabled;

  -- Refresh each affected family once after all its members changed.
  for v_root_id in
    select distinct binding.root_lexeme_id
    from private.lexeme360_expression_roots_v1 binding
    join public.expression_catalog e on e.id = binding.expression_id
    where e.lexeme_id = any(v_enabled_ids)
  loop
    perform private.refresh_lexeme360_root_v2(v_root_id);
    v_roots := v_roots + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'admitted', cardinality(v_enabled_ids),
    'refreshed_roots', v_roots
  );
end;
$function$;

revoke all on function public.admit_verified_job_expressions_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.admit_verified_job_expressions_v1(uuid)
  to service_role;

-- Repair exactly the eight reviewed expressions in the FÅ canary job.
-- A changed article, exclusion, or missing binding aborts the migration.
do $backfill$
declare
  v_result jsonb;
begin
  v_result := public.admit_verified_job_expressions_v1(
    '5f0ccf01-76bb-448d-bd52-04e10d0270be'::uuid
  );
  if (v_result->>'admitted')::integer <> 8
     or (v_result->>'refreshed_roots')::integer <> 1 then
    raise exception 'D10 FAA admission precondition failed: %', v_result;
  end if;
end;
$backfill$;

commit;

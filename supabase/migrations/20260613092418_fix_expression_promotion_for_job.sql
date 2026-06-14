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
    from lexeme_processing_items i
    join lexeme_source_checks sc on sc.item_id = i.id
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
    update expression_catalog e
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
    update lexeme_processing_items i
    set
      status = 'done',
      current_stage = 'semantic_audit',
      result_summary = coalesce(i.result_summary, '{}'::jsonb)
        || jsonb_build_object(
          'promotion_status', 'expression_promoted',
          'expression_id', i.expression_id,
          'promotion_version', 'expression_promotion_v1'
        ),
      updated_at = now()
    where i.job_id = p_job_id
      and i.expression_id in (
        select expression_id from expression_candidates
      )
    returning i.id, i.expression_id
  ),

  inserted_expression_enrichment as (
  insert into expression_semantic_enrichment (
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
    insert into lexemes (
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
      from lexemes l
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
    join lexemes l
      on lower(l.lemma) = lower(tc.normalized_lemma)
  ),

  updated_lexemes as (
    update lexemes l
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
    update lexeme_processing_items i
    set
      lexeme_id = lm.lexeme_id,
      status = 'done',
      current_stage = 'semantic_audit',
      result_summary = coalesce(i.result_summary, '{}'::jsonb)
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
    insert into lexeme_semantic_enrichment (
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
    on conflict (lexeme_id) do nothing
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
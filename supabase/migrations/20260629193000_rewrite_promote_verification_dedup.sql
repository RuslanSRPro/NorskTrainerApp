CREATE OR REPLACE FUNCTION public.promote_verification_results_for_job(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
      i.pos,
      i.match_type,

      max(
        case
          when sc.registered_entry = true then 5
          when sc.whole_unit_match = true then 4
          when sc.usage_match = true then 3
          when sc.component_match = true then 2
          when sc.found = true then 1
          else 0
        end
      ) as best_rank,

      string_agg(distinct sc.source, '+') filter (
        where sc.found = true
          and (
            sc.registered_entry = true
            or sc.whole_unit_match = true
            or sc.usage_match = true
            or sc.component_match = true
          )
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
          'authoritative_relations', coalesce(sc.authoritative_relations, '[]'::jsonb),
          'evidence', sc.evidence
        )
      ) as verification_evidence

    from public.lexeme_processing_items i
    join public.lexeme_source_checks sc on sc.item_id = i.id
    where i.job_id = p_job_id
      and sc.status in ('done', 'partial')
    group by
      i.id,
      i.lexeme_id,
      i.expression_id,
      i.normalized_lemma,
      i.surface_form,
      i.pos,
      i.match_type
  ),

  expression_candidates_raw as (
    select *
    from source_summary
    where expression_id is not null
      and best_rank >= 3
  ),

  expression_candidates as (
    select distinct on (expression_id)
      *
    from expression_candidates_raw
    order by expression_id, best_rank desc, item_id
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
          when 3 then 'usage_evidence'
          when 2 then 'component_match'
          when 1 then 'ai_candidate'
          else 'ai_candidate'
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
          'promotion_version', 'expression_promotion_v5_dedup'
        ),
      updated_at = now()
    where i.job_id = p_job_id
      and i.expression_id in (
        select expression_id from expression_candidates
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

  token_item_candidates as (
    select *
    from source_summary
    where expression_id is null
      and best_rank >= 4
      and normalized_lemma is not null
  ),

  token_lemma_candidates as (
    select distinct on (lower(normalized_lemma))
      lower(normalized_lemma) as lemma_key,
      normalized_lemma,
      coalesce(nullif(pos, ''), 'unknown') as pos,
      coalesce(surface_form, normalized_lemma) as display_form,
      best_rank,
      source_verified,
      verification_evidence
    from token_item_candidates
    order by lower(normalized_lemma), best_rank desc, item_id
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
      tlc.normalized_lemma,
      tlc.pos,
      tlc.display_form,
      'pipeline_promotion',
      'promoted',
      case tlc.best_rank
        when 5 then 'dictionary_entry'
        when 4 then 'dictionary_match'
        when 3 then 'usage_evidence'
        when 2 then 'component_match'
        when 1 then 'ai_candidate'
        else 'ai_candidate'
      end,
      tlc.source_verified,
      tlc.verification_evidence,
      now(),
      now()
    from token_lemma_candidates tlc
    where not exists (
      select 1
      from public.lexemes l
      where lower(l.lemma) = tlc.lemma_key
    )
    returning id, lemma
  ),

  lexeme_matches as (
    select
      tic.item_id,
      l.id as lexeme_id,
      tic.best_rank,
      tic.source_verified,
      tic.verification_evidence
    from token_item_candidates tic
    join public.lexemes l
      on lower(l.lemma) = lower(tic.normalized_lemma)
  ),

  lexeme_update_source as (
    select distinct on (lexeme_id)
      lexeme_id,
      best_rank,
      source_verified,
      verification_evidence
    from lexeme_matches
    order by lexeme_id, best_rank desc
  ),

  updated_lexemes as (
    update public.lexemes l
    set
      source_verified = lus.source_verified,
      verification_status = 'promoted',
      verification_tier =
        case lus.best_rank
          when 5 then 'dictionary_entry'
          when 4 then 'dictionary_match'
          when 3 then 'usage_evidence'
          when 2 then 'component_match'
          when 1 then 'ai_candidate'
          else 'ai_candidate'
        end,
      verification_evidence = lus.verification_evidence,
      updated_at = now()
    from lexeme_update_source lus
    where l.id = lus.lexeme_id
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
          'promotion_version', 'verification_promotion_v6_dedup_by_lemma'
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
    select distinct
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
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
      i.match_type,
      i.pos,

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
      i.match_type,
      i.pos
  ),

  expression_candidates as (
    select distinct on (expression_id)
      *
    from source_summary
    where expression_id is not null
      and best_rank >= 3
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
          'promotion_version', 'expression_promotion_v7_admission_gate'
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

  token_occurrences as (
    select
      ss.*,
      public.dictionary_admission_decision(
        ss.normalized_lemma,
        ss.surface_form,
        ss.pos,
        ss.match_type,
        case ss.best_rank
          when 5 then 'dictionary_entry'
          when 4 then 'dictionary_match'
          when 3 then 'usage_evidence'
          when 2 then 'component_match'
          when 1 then 'ai_candidate'
          else 'ai_candidate'
        end
      ) as admission_decision
    from source_summary ss
    where ss.expression_id is null
      and ss.best_rank >= 4
      and ss.normalized_lemma is not null
  ),

  admitted_token_occurrences as (
    select *
    from token_occurrences
    where (admission_decision ->> 'admit')::boolean = true
  ),

  rejected_token_occurrences as (
    select *
    from token_occurrences
    where coalesce((admission_decision ->> 'admit')::boolean, false) = false
  ),

  rejected_token_items as (
    update public.lexeme_processing_items i
    set
      status = 'done',
      current_stage = 'admission_gate',
      result_summary =
        coalesce(i.result_summary, '{}'::jsonb)
        || jsonb_build_object(
          'promotion_status', 'not_promoted',
          'admission_status', rto.admission_decision ->> 'status',
          'admission_reason', rto.admission_decision ->> 'reason',
          'admission_decision', rto.admission_decision,
          'promotion_version', 'verification_promotion_v7_admission_gate'
        ),
      updated_at = now()
    from rejected_token_occurrences rto
    where i.id = rto.item_id
    returning i.id
  ),

  unique_lemmas as (
    select distinct on (lower(normalized_lemma))
      normalized_lemma,
      surface_form,
      pos,
      best_rank,
      source_verified,
      verification_evidence
    from admitted_token_occurrences
    order by
      lower(normalized_lemma),
      best_rank desc,
      item_id
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
      ul.normalized_lemma,
      coalesce(nullif(ul.pos, ''), 'unknown'),
      coalesce(ul.surface_form, ul.normalized_lemma),
      'pipeline_promotion',
      'promoted',
      case ul.best_rank
        when 5 then 'dictionary_entry'
        when 4 then 'dictionary_match'
        when 3 then 'usage_evidence'
        when 2 then 'component_match'
        when 1 then 'ai_candidate'
        else 'ai_candidate'
      end,
      ul.source_verified,
      ul.verification_evidence,
      now(),
      now()
    from unique_lemmas ul
    where not exists (
      select 1
      from public.lexemes l
      where lower(l.lemma) = lower(ul.normalized_lemma)
    )
    returning id, lemma
  ),

  all_matching_lexemes as (
    select l.id, l.lemma
    from public.lexemes l
    join unique_lemmas ul
      on lower(l.lemma) = lower(ul.normalized_lemma)

    union

    select il.id, il.lemma
    from inserted_lexemes il
  ),

  lexeme_matches as (
    select
      ato.item_id,
      aml.id as lexeme_id,
      ato.best_rank,
      ato.source_verified,
      ato.verification_evidence
    from admitted_token_occurrences ato
    join all_matching_lexemes aml
      on lower(aml.lemma) = lower(ato.normalized_lemma)
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
          'admission_status', 'allowed',
          'promotion_version', 'verification_promotion_v7_admission_gate'
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
    +
    (select count(*) from rejected_token_items)
  into v_count;

  return v_count;
end;
$function$;
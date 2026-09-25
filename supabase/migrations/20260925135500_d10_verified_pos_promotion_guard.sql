-- D10: preserve source-backed part of speech during promotion.
-- New migration; never modify the previously applied promotion function.
CREATE OR REPLACE FUNCTION public.promote_verification_results_for_job(p_job_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_count integer := 0;
  v_run_id text := 'verification-v5-full-refresh';
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

  ranked_summary as (
    select
      ss.*,

      case
        when ss.source_verified like '%+%' and ss.best_rank >= 3 then 'multi_source'
        when ss.best_rank >= 4 then 'authoritative'
        when ss.best_rank = 3 then 'usage_verified'
        else 'candidate'
      end as new_verification_status,

      case
        when ss.best_rank = 5 then 'dictionary_entry'
        when ss.best_rank = 4 then 'sub_article'
        when ss.best_rank = 3 then 'sub_article'
        when ss.best_rank = 2 then 'component'
        else null
      end as new_verification_method,

      case ss.best_rank
        when 5 then 'dictionary_entry'
        when 4 then 'dictionary_match'
        when 3 then 'usage_evidence'
        when 2 then 'component_match'
        when 1 then 'ai_candidate'
        else 'ai_candidate'
      end as new_verification_tier
    from source_summary ss
  ),

  expression_candidates as (
    select distinct on (expression_id)
      *
    from ranked_summary
    where expression_id is not null
      and best_rank >= 3
      and exists (
        select 1 from public.expression_catalog ec
        where ec.id = ranked_summary.expression_id
      )
    order by expression_id, best_rank desc, item_id
  ),

  old_expression_rows as (
    select
      e.id,
      e.lemma,
      e.lexeme_id,
      e.root_lemma,
      e.verification_status,
      e.verification_method,
      e.verification_source,
      e.verification_method_version,
      e.verification_version,
      e.last_verification_run
    from public.expression_catalog e
    join expression_candidates ec
      on e.id = ec.expression_id
  ),

  expression_updates as (
    update public.expression_catalog e
    set
      source_verified = ec.source_verified,
      verification_status = ec.new_verification_status,
      verification_method = ec.new_verification_method,
      verification_source = coalesce(ec.source_verified, 'pipeline'),
      verification_method_version = 1,
      verification_version = 5,
      last_verification_run = v_run_id,
      source_checked_at = now(),
      verification_tier = ec.new_verification_tier,
      verification_evidence = ec.verification_evidence,
      updated_at = now()
    from expression_candidates ec
    where e.id = ec.expression_id
    returning e.id
  ),

  expression_change_log as (
    insert into public.lexicon_change_log (
      entity_type,
      entity_id,
      lemma,
      run_id,
      worker_name,
      job_id,
      change_type,
      change_source,
      old_values,
      new_values,
      changed_fields,
      verification_version,
      method_version,
      created_at
    )
    select
      'expression_catalog',
      old.id,
      old.lemma,
      v_run_id,
      'promote_verification_results_for_job',
      p_job_id::text,
      'verification',
      'sql_promotion_function',
      jsonb_build_object(
        'lexeme_id', old.lexeme_id,
        'root_lemma', old.root_lemma,
        'verification_status', old.verification_status,
        'verification_method', old.verification_method,
        'verification_source', old.verification_source,
        'verification_method_version', old.verification_method_version,
        'verification_version', old.verification_version,
        'last_verification_run', old.last_verification_run
      ),
      jsonb_build_object(
        'lexeme_id', old.lexeme_id,
        'root_lemma', old.root_lemma,
        'verification_status', ec.new_verification_status,
        'verification_method', ec.new_verification_method,
        'verification_source', coalesce(ec.source_verified, 'pipeline'),
        'verification_method_version', 1,
        'verification_version', 5,
        'last_verification_run', v_run_id
      ),
      array_remove(array[
        case when old.verification_status is distinct from ec.new_verification_status then 'verification_status' end,
        case when old.verification_method is distinct from ec.new_verification_method then 'verification_method' end,
        case when old.verification_source is distinct from coalesce(ec.source_verified, 'pipeline') then 'verification_source' end,
        case when old.verification_method_version is distinct from 1 then 'verification_method_version' end,
        case when old.verification_version is distinct from 5 then 'verification_version' end,
        case when old.last_verification_run is distinct from v_run_id then 'last_verification_run' end
      ], null),
      5,
      1,
      now()
    from old_expression_rows old
    join expression_candidates ec
      on old.id = ec.expression_id
    where array_length(array_remove(array[
        case when old.verification_status is distinct from ec.new_verification_status then 'verification_status' end,
        case when old.verification_method is distinct from ec.new_verification_method then 'verification_method' end,
        case when old.verification_source is distinct from coalesce(ec.source_verified, 'pipeline') then 'verification_source' end,
        case when old.verification_method_version is distinct from 1 then 'verification_method_version' end,
        case when old.verification_version is distinct from 5 then 'verification_version' end,
        case when old.last_verification_run is distinct from v_run_id then 'last_verification_run' end
      ], null), 1) > 0
    returning id
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
          'promotion_version', 'expression_promotion_v9_change_log',
          'verification_status', ec.new_verification_status,
          'verification_method', ec.new_verification_method,
          'verification_source', ec.source_verified
        ),
      updated_at = now()
    from expression_candidates ec
    where i.job_id = p_job_id
      and i.expression_id = ec.expression_id
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

  -- ФИКС (15.08.2026): добавлен третий аргумент rs.normalized_lemma во
  -- все три вызова extract_pos_from_source_evidence — та же
  -- lemma-anchoring правка, что уже применена в Шаге Б
  -- (extract_all_pos_from_source_evidence). Прежняя версия сканировала
  -- всю страницу результатов поиска NAOB целиком, могла подхватить
  -- POS-слово из СОВЕРШЕННО ПОСТОРОННЕЙ статьи на той же странице —
  -- подтверждённый источник как минимум части случаев системной
  -- проблемы "словоформа вместо леммы" (bevisene/hoppet и др., найдено
  -- 14-15.08.2026).
  -- A rank-five source check does not establish the requested POS. A
  -- confirmed, lemma-anchored NAOB article can contradict the analyzer;
  -- ambiguous duplicate POS without any article must remain unpromoted.
  blocked_pos_occurrences as (
    select
      rs.item_id,
      rs.pos as requested_pos,
      public.extract_pos_from_source_evidence(
        rs.verification_evidence, rs.normalized_lemma
      ) as authoritative_pos,
      case
        when coalesce((rs.verification_evidence->'NAOB'->>'registered_entry')::boolean, false)
          and public.extract_pos_from_source_evidence(
            rs.verification_evidence, rs.normalized_lemma
          ) is distinct from rs.pos
          then 'CONFIRMED_ARTICLE_POS_CONFLICT'
        else 'AMBIGUOUS_POS_WITHOUT_ARTICLE'
      end as reason
    from ranked_summary rs
    where rs.expression_id is null
      and rs.best_rank >= 4
      and rs.normalized_lemma is not null
      and nullif(rs.pos, '') is not null
      and (
        (
          coalesce((rs.verification_evidence->'NAOB'->>'registered_entry')::boolean, false)
          and public.extract_pos_from_source_evidence(
            rs.verification_evidence, rs.normalized_lemma
          ) is not null
          and public.extract_pos_from_source_evidence(
            rs.verification_evidence, rs.normalized_lemma
          ) <> rs.pos
        )
        or (
          exists (
            select 1 from ranked_summary sibling
            where sibling.item_id <> rs.item_id
              and lower(sibling.normalized_lemma) = lower(rs.normalized_lemma)
              and sibling.pos is distinct from rs.pos
          )
          and not coalesce((rs.verification_evidence->'Ordbokene'->>'registered_entry')::boolean, false)
          and not (
            coalesce((rs.verification_evidence->'NAOB'->>'registered_entry')::boolean, false)
            and public.extract_pos_from_source_evidence(
              rs.verification_evidence, rs.normalized_lemma
            ) = rs.pos
          )
        )
      )
  ),

  token_occurrences as (
    select
      rs.*,
      coalesce(nullif(rs.pos, ''), public.extract_pos_from_source_evidence(rs.verification_evidence, rs.normalized_lemma)) as effective_pos,
      (nullif(rs.pos, '') is null and public.extract_pos_from_source_evidence(rs.verification_evidence, rs.normalized_lemma) is not null) as pos_from_evidence,
      public.dictionary_admission_decision(
        rs.normalized_lemma,
        rs.surface_form,
        coalesce(nullif(rs.pos, ''), public.extract_pos_from_source_evidence(rs.verification_evidence, rs.normalized_lemma)),
        rs.match_type,
        rs.new_verification_tier
      ) as admission_decision
    from ranked_summary rs
    where rs.expression_id is null
      and rs.best_rank >= 4
      and rs.normalized_lemma is not null
      and not exists (
        select 1 from blocked_pos_occurrences blocked
        where blocked.item_id = rs.item_id
      )
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
          'promotion_version', 'verification_promotion_v9_change_log'
        ),
      updated_at = now()
    from rejected_token_occurrences rto
    where i.id = rto.item_id
    returning i.id
  ),

  blocked_pos_items as (
    update public.lexeme_processing_items i
    set status = 'done',
        current_stage = 'admission_gate',
        result_summary = coalesce(i.result_summary, '{}'::jsonb)
          || jsonb_build_object(
            'promotion_status', 'not_promoted',
            'admission_status', 'pos_unverified',
            'admission_reason', blocked.reason,
            'requested_pos', blocked.requested_pos,
            'authoritative_pos', blocked.authoritative_pos,
            'promotion_version', 'verification_promotion_v10_pos_guard'
          ),
        updated_at = now()
    from blocked_pos_occurrences blocked
    where i.id = blocked.item_id
    returning i.id
  ),

  unique_lemmas as (
    select distinct on (lower(normalized_lemma), effective_pos)
      normalized_lemma,
      surface_form,
      effective_pos as pos,
      pos_from_evidence,
      best_rank,
      source_verified,
      verification_evidence,
      new_verification_status,
      new_verification_tier
    from admitted_token_occurrences
    order by
      lower(normalized_lemma),
      effective_pos,
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
      verification_version,
      last_verification_run,
      created_at,
      updated_at
    )
    select
      ul.normalized_lemma,
      coalesce(nullif(ul.pos, ''), 'unknown'),
      coalesce(ul.surface_form, ul.normalized_lemma),
      'pipeline_promotion',
      ul.new_verification_status,
      ul.new_verification_tier,
      ul.source_verified,
      ul.verification_evidence,
      5,
      v_run_id,
      now(),
      now()
    from unique_lemmas ul
    where not exists (
      select 1
      from public.lexemes l
      where lower(l.lemma) = lower(ul.normalized_lemma)
        and l.pos = coalesce(nullif(ul.pos, ''), 'unknown')
    )
    returning id, lemma, pos
  ),

  all_matching_lexemes as (
    select l.id, l.lemma, l.pos
    from public.lexemes l
    join unique_lemmas ul
      on lower(l.lemma) = lower(ul.normalized_lemma)
      and l.pos = coalesce(nullif(ul.pos, ''), 'unknown')

    union

    select il.id, il.lemma, il.pos
    from inserted_lexemes il
  ),

  lexeme_matches as (
    select
      ato.item_id,
      aml.id as lexeme_id,
      ato.best_rank,
      ato.source_verified,
      ato.verification_evidence,
      ato.new_verification_status,
      ato.new_verification_tier,
      ato.pos_from_evidence
    from admitted_token_occurrences ato
    join all_matching_lexemes aml
      on lower(aml.lemma) = lower(ato.normalized_lemma)
      and aml.pos = coalesce(nullif(ato.effective_pos, ''), 'unknown')
  ),

  lexeme_update_source as (
    select distinct on (lexeme_id)
      lexeme_id,
      best_rank,
      source_verified,
      verification_evidence,
      new_verification_status,
      new_verification_tier
    from lexeme_matches
    order by lexeme_id, best_rank desc
  ),

  updated_lexemes as (
    update public.lexemes l
    set
      source_verified = lus.source_verified,
      verification_status = lus.new_verification_status,
      verification_tier = lus.new_verification_tier,
      verification_evidence = lus.verification_evidence,
      verification_version = 5,
      last_verification_run = v_run_id,
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
          'promotion_version', 'verification_promotion_v9_change_log',
          'verification_status', lm.new_verification_status,
          'verification_tier', lm.new_verification_tier,
          'pos_source', case when lm.pos_from_evidence then 'naob_evidence_extraction' else 'resolve_surface_form' end
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
    +
    (select count(*) from blocked_pos_items)
  into v_count;

  return v_count;
end;
$function$

-- D10: bounded verification promotion for large analyze-text jobs.
-- Each call advances at most 10 source_checks items; job-orchestrator invokes
-- the next page on a later supervisor tick. This keeps each PostgREST RPC below
-- the authenticated role statement budget without repeating source lookups.
-- This is a new migration: the already-applied 20260927121500 migration remains unchanged.

-- The production helper previously existed only as a dashboard-created VOLATILE
-- function. It reads only its arguments, so record it in migration history and
-- allow PostgreSQL to treat repeated calls as deterministic and parallel-safe.
CREATE OR REPLACE FUNCTION public.extract_pos_from_source_evidence(
  p_verification_evidence jsonb,
  p_lemma text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
declare
  v_naob jsonb;
  v_lexin jsonb;
  v_preview text;
  v_lemma_norm text;
  v_pos text;
begin
  if p_verification_evidence is null or p_lemma is null then
    return null;
  end if;

  v_lemma_norm := lower(trim(p_lemma));
  if v_lemma_norm = '' then
    return null;
  end if;

  v_naob := p_verification_evidence -> 'NAOB';
  if v_naob is not null then
    v_preview := lower(coalesce(
      v_naob -> 'evidence' ->> 'raw_preview',
      v_naob ->> 'raw_preview'
    ));
    if v_preview is not null then
      if v_preview ~ ('\m' || v_lemma_norm || '\s+verb\M') then return 'verb';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+substantiv\M') then return 'noun';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+adjektiv\M') then return 'adjective';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+adverb\M') then return 'adverb';
      end if;
    end if;
  end if;

  v_lexin := p_verification_evidence -> 'Lexin';
  if v_lexin is not null then
    v_preview := coalesce(
      v_lexin -> 'evidence' ->> 'raw_preview',
      v_lexin ->> 'raw_preview'
    );
    if v_preview is not null then
      v_pos := (regexp_match(
        v_preview,
        '"type":"[EN]-kat"[^}]*?"text":"(verb|substantiv|adjektiv|adverb)"'
      ))[1];
      if v_pos = 'verb' then return 'verb';
      elsif v_pos = 'substantiv' then return 'noun';
      elsif v_pos = 'adjektiv' then return 'adjective';
      elsif v_pos = 'adverb' then return 'adverb';
      end if;
    end if;
  end if;

  return null;
end;
$function$;

-- Persist the production queue-discovery repair that was previously applied
-- directly in SQL Editor. Terminal jobs must never be selected again merely
-- because supervisor_state still contains an older non-terminal stage.
CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  status text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
AS $function$
  select j.id, j.status, j.created_at
  from public.lexeme_processing_jobs j
  left join public.pipeline_supervisor_state s
    on s.job_id = j.id
  where j.status in (
    'pending',
    'processing',
    'ready',
    'done',
    'retry_scheduled'
  )
    and (
      s.stage is null
      or s.stage not in ('done', 'needs_manual_review')
    )
  order by j.created_at asc
  limit p_limit;
$function$;

-- Same promotion semantics as 20260927121500; only page selection and
-- one-time POS extraction were added.
CREATE OR REPLACE FUNCTION public.promote_verification_results_for_job(p_job_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_count integer := 0;
  v_run_id text := 'verification-v5-full-refresh';
begin
  with selected_items as materialized (
    select i.id
    from public.lexeme_processing_items i
    where i.job_id = p_job_id
      and i.current_stage = 'source_checks'
    order by i.id
    limit 10
  ),

  source_summary as (
    select
      i.id as item_id, i.lexeme_id, i.expression_id,
      i.normalized_lemma, i.surface_form, i.match_type, i.pos,
      max(case
        when sc.registered_entry = true and
          sc.evidence->>'original_quality' in ('registered_entry', 'structured_entry_match') then 5
        when sc.whole_unit_match = true and
          sc.evidence->>'original_quality' = 'structured_entry_match' then 4
        when sc.usage_match = true and
          sc.evidence->>'original_quality' in ('learner_dictionary', 'usage_example_match', 'normative_reference') then 3
        when sc.component_match = true then 2
        when sc.found = true then 1
        else 0
      end) as check_best_rank,
      string_agg(distinct sc.source, '+') filter (
        where sc.found = true and (
          (sc.registered_entry = true and sc.evidence->>'original_quality' in ('registered_entry', 'structured_entry_match'))
          or (sc.whole_unit_match = true and sc.evidence->>'original_quality' = 'structured_entry_match')
          or (sc.usage_match = true and sc.evidence->>'original_quality' in ('learner_dictionary', 'usage_example_match', 'normative_reference'))
        )
      ) as check_sources,
      jsonb_object_agg(sc.source, jsonb_build_object(
        'status', sc.status, 'quality', sc.quality, 'found', sc.found,
        'registered_entry', sc.registered_entry, 'whole_unit_match', sc.whole_unit_match,
        'component_match', sc.component_match, 'usage_match', sc.usage_match,
        'authoritative_relations', coalesce(sc.authoritative_relations, '[]'::jsonb),
        'evidence', sc.evidence
      )) as check_evidence,
      max(article.article_id) as official_expression_article_id,
      max(article.parent_article_id) as official_parent_article_id,
      max(article.article_count) as official_article_count
    from public.lexeme_processing_items i
    join selected_items selected on selected.id = i.id
    join public.lexeme_source_checks sc on sc.item_id = i.id
    left join lateral (
      select min(c.candidate_article_id::text) as article_id,
        (array_agg(c.parent_article_id::text
          order by (c.status = 'promoted') desc, c.parent_article_id::text))[1]
          as parent_article_id,
        count(distinct c.candidate_article_id::text)::integer as article_count
      from public.ordbokene_expression_candidates c
      join public.expression_catalog ec on ec.id = c.promoted_expression_id
      where ec.id = i.expression_id
        and lower(btrim(c.normalized_key)) = lower(btrim(ec.normalized_key))
        and upper(c.candidate_dictionary_code) = 'BM'
        and c.status in ('promoted', 'duplicate')
        and c.candidate_article_id is not null
        and c.parent_article_id is not null
    ) article on true
    where i.job_id = p_job_id and sc.status in ('done', 'partial')
    group by i.id, i.lexeme_id, i.expression_id,
      i.normalized_lemma, i.surface_form, i.match_type, i.pos
  ),

  verified_summary as (
    select ss.*,
      greatest(ss.check_best_rank,
        case when ss.official_article_count = 1 then 4 else 0 end) as best_rank,
      case when ss.official_article_count = 1 and
        coalesce(ss.check_sources, '') !~ '(^|\+)Ordbokene(\+|$)'
      then concat_ws('+', ss.check_sources, 'Ordbokene')
      else ss.check_sources end as source_verified,
      case when ss.official_article_count = 1 then
        ss.check_evidence || jsonb_build_object('Ordbokene', jsonb_build_object(
          'status', 'done', 'quality', 'structured_entry_match', 'found', true,
          'registered_entry', false, 'whole_unit_match', true,
          'component_match', false, 'usage_match', false,
          'article_id', ss.official_expression_article_id,
          'parent_article_id', ss.official_parent_article_id,
          'dictionary_code', 'BM',
          'evidence', jsonb_build_object(
            'original_quality', 'structured_entry_match',
            'article_id', ss.official_expression_article_id,
            'parent_article_id', ss.official_parent_article_id,
            'dictionary_code', 'BM',
            'evidence_label', 'Ordbokene verified expression sub-article'
          )))
      else ss.check_evidence end as verification_evidence
    from source_summary ss
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
    from verified_summary ss
  ),

  pos_evidence as materialized (
    select
      rs.item_id,
      case
        when coalesce((rs.verification_evidence->'Ordbokene'->>'registered_entry')::boolean, false)
          and rs.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
        then nullif(rs.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'pos', '')
      end as ordbokene_bm_pos,
      public.extract_pos_from_source_evidence(
        rs.verification_evidence, rs.normalized_lemma
      ) as extracted_pos
    from ranked_summary rs
    where rs.expression_id is null
      and rs.best_rank >= 4
      and rs.normalized_lemma is not null
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
      coalesce(pe.ordbokene_bm_pos, pe.extracted_pos) as authoritative_pos,
      case
        when coalesce((rs.verification_evidence->'Ordbokene'->>'registered_entry')::boolean, false)
          and rs.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
          and pe.ordbokene_bm_pos is not null
          and pe.ordbokene_bm_pos <> rs.pos
          then 'CONFIRMED_ORDBOKENE_POS_CONFLICT'
        when coalesce((rs.verification_evidence->'NAOB'->>'registered_entry')::boolean, false)
          and pe.extracted_pos is distinct from rs.pos
          then 'CONFIRMED_ARTICLE_POS_CONFLICT'
        else 'AMBIGUOUS_POS_WITHOUT_ARTICLE'
      end as reason
    from ranked_summary rs
    join pos_evidence pe on pe.item_id = rs.item_id
    where rs.expression_id is null
      and rs.best_rank >= 4
      and rs.normalized_lemma is not null
      and nullif(rs.pos, '') is not null
      and (
        (
          coalesce((rs.verification_evidence->'Ordbokene'->>'registered_entry')::boolean, false)
          and rs.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
          and pe.ordbokene_bm_pos is not null
          and pe.ordbokene_bm_pos <> rs.pos
        )
        or (
          coalesce((rs.verification_evidence->'NAOB'->>'registered_entry')::boolean, false)
          and pe.extracted_pos is not null
          and pe.extracted_pos <> rs.pos
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
            and pe.extracted_pos = rs.pos
          )
        )
      )
  ),

  token_occurrences as (
    select
      rs.*,
      coalesce(nullif(rs.pos, ''), pe.extracted_pos) as effective_pos,
      (nullif(rs.pos, '') is null and pe.extracted_pos is not null) as pos_from_evidence,
      public.dictionary_admission_decision(
        rs.normalized_lemma,
        rs.surface_form,
        coalesce(nullif(rs.pos, ''), pe.extracted_pos),
        rs.match_type,
        rs.new_verification_tier
      ) as admission_decision
    from ranked_summary rs
    join pos_evidence pe on pe.item_id = rs.item_id
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

  weak_evidence_items as (
    update public.lexeme_processing_items i
    set status = 'done',
        current_stage = 'admission_gate',
        result_summary = coalesce(i.result_summary, '{}'::jsonb)
          || jsonb_build_object(
            'promotion_status', 'not_promoted',
            'admission_status', case when rs.best_rank = 0 then 'not_found_anywhere'
              else 'weak_evidence_only' end,
            'admission_reason', 'NO_CONFIRMED_WHOLE_UNIT_REGISTRATION',
            'best_evidence_rank', rs.best_rank,
            'promotion_version', 'verification_promotion_v11_evidence_identity'
          ),
        updated_at = now()
    from ranked_summary rs
    where i.id = rs.item_id
      and rs.expression_id is null
      and rs.best_rank < 4
      and i.lexeme_id is null
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
    +
    (select count(*) from weak_evidence_items)
  into v_count;

  return v_count;
end;
$function$;

-- D10 pipeline recovery v2. Function definitions only; no job resets.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(
  p_limit integer DEFAULT 200
)
RETURNS TABLE(id uuid, status text, created_at timestamp with time zone)
LANGUAGE sql STABLE
AS $function$
  select j.id, j.status, j.created_at
  from public.lexeme_processing_jobs j
  left join public.pipeline_supervisor_state s on s.job_id = j.id
  where j.status in ('pending','processing','ready','done','retry_scheduled','partial')
    and (s.stage is null or s.stage not in ('done', 'needs_manual_review'))
    and (j.status <> 'partial' or exists (
      select 1 from public.lexeme_processing_items i
      where i.job_id = j.id and i.current_stage = 'source_checks'
    ))
  order by j.created_at asc
  limit p_limit;
$function$;


CREATE OR REPLACE FUNCTION public.promote_verification_results_for_job(
  p_job_id uuid,
  p_limit integer
)
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
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),

  job_pos_siblings as materialized (
    select distinct
      i.id as item_id,
      lower(btrim(i.normalized_lemma)) as normalized_lemma,
      nullif(i.pos, '') as pos
    from public.lexeme_processing_items i
    where i.job_id = p_job_id
      and nullif(btrim(i.normalized_lemma), '') is not null
      and exists (
        select 1
        from public.lexeme_source_checks sc
        where sc.item_id = i.id
          and sc.status in ('done', 'partial')
      )
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
          'promotion_version', 'expression_promotion_v10_page_scoped',
          'verification_status', ec.new_verification_status,
          'verification_method', ec.new_verification_method,
          'verification_source', ec.source_verified
        ),
      updated_at = now()
    from expression_candidates ec
    where i.job_id = p_job_id
      and i.expression_id = ec.expression_id
      and i.id in (select id from selected_items)
      and exists (select 1 from ranked_summary own
        where own.item_id = i.id and own.best_rank >= 3)
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
            select 1 from job_pos_siblings sibling
            where sibling.item_id <> rs.item_id
              and sibling.normalized_lemma = lower(btrim(rs.normalized_lemma))
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

  weak_evidence_expression_items as (
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
            'promotion_version', 'verification_promotion_v12_expression_evidence_identity'
          ),
        updated_at = now()
    from ranked_summary rs
    where i.id = rs.item_id
      and rs.expression_id is not null
      and rs.best_rank < 3
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
    +
    (select count(*) from weak_evidence_expression_items)
  into v_count;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.promote_verification_results_for_job(
  p_job_id uuid
)
RETURNS integer
LANGUAGE sql
VOLATILE
AS $function$
  select public.promote_verification_results_for_job(p_job_id, 10);
$function$;


CREATE OR REPLACE FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  p_expression_ids uuid[], p_parent_article_id bigint,
  p_dictionary_code text, p_parent_lemma text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  resolved_root_id uuid;
  resolved_pos text;
  requested_count integer;
  changed_binding_count integer;
BEGIN
  requested_count := (SELECT count(DISTINCT id) FROM unnest(p_expression_ids) AS requested(id));
  IF requested_count IS NULL OR requested_count < 1 OR requested_count > 500
     OR p_parent_article_id IS NULL OR p_parent_article_id <= 0
     OR nullif(btrim(p_parent_lemma), '') IS NULL
     OR p_dictionary_code IS NULL
     OR lower(btrim(p_dictionary_code)) NOT IN ('bm', 'nn') THEN
    RAISE EXCEPTION 'INVALID_BATCH_BINDING_IDENTITY';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_expression_ids) AS requested(id) WHERE id IS NULL) THEN
    RAISE EXCEPTION 'NULL_EXPRESSION_ID';
  END IF;

  SELECT min(alias.lexeme_id::text)::uuid, min(alias.pos)
  INTO resolved_root_id, resolved_pos
  FROM public.lexeme_headword_aliases_v2 alias
  WHERE alias.dictionary_code = lower(btrim(p_dictionary_code))
    AND alias.article_id = p_parent_article_id
    AND alias.normalized_headword =
      private.normalize_lexeme360_root_v1(p_parent_lemma)
    AND alias.is_active
  HAVING count(DISTINCT alias.lexeme_id) = 1;
  IF resolved_root_id IS NULL THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM (SELECT DISTINCT id FROM unnest(p_expression_ids) AS ids(id)) requested
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ordbokene_expression_candidates candidate
      WHERE candidate.promoted_expression_id = requested.id
        AND candidate.parent_article_id = p_parent_article_id
        AND lower(candidate.parent_dictionary_code) = lower(btrim(p_dictionary_code))
        AND private.normalize_lexeme360_root_v1(candidate.parent_lemma) =
            private.normalize_lexeme360_root_v1(p_parent_lemma)
        AND candidate.status IN ('promoted', 'duplicate')
    )
  ) THEN RAISE EXCEPTION 'EXPRESSION_PARENT_ARTICLE_MISMATCH'; END IF;

  -- Lock existing catalog identities until binding completes. Never report
  -- a root for an expression that was skipped or concurrently deleted.
  PERFORM cat.id FROM public.expression_catalog cat
  WHERE cat.id = ANY(p_expression_ids) ORDER BY cat.id FOR KEY SHARE;
  IF EXISTS (
    SELECT 1 FROM unnest(p_expression_ids) requested(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.expression_catalog cat
                      WHERE cat.id = requested.id)
  ) THEN RAISE EXCEPTION 'EXPRESSION_CATALOG_ID_MISSING'; END IF;

  INSERT INTO private.lexeme360_expression_roots_v1 AS binding (
    expression_id, root_lexeme_id, source_kind, dictionary_code,
    source_article_id, source_pos, evidence, updated_at
  )
  SELECT requested.id, resolved_root_id, 'ordbokene_parent_article',
    lower(btrim(p_dictionary_code)), p_parent_article_id, resolved_pos,
    jsonb_build_object('resolver', 'lexeme_headword_aliases_v2',
      'policy', 'exact_article_headword_identity'), clock_timestamp()
  FROM (SELECT DISTINCT id FROM unnest(p_expression_ids) AS ids(id)) requested
  WHERE true
  ON CONFLICT (expression_id, root_lexeme_id) DO UPDATE SET
    source_kind = excluded.source_kind,
    dictionary_code = excluded.dictionary_code,
    source_article_id = excluded.source_article_id,
    source_pos = excluded.source_pos,
    evidence = excluded.evidence,
    updated_at = excluded.updated_at
  WHERE (binding.source_kind, binding.dictionary_code,
         binding.source_article_id, binding.source_pos, binding.evidence)
    IS DISTINCT FROM
        (excluded.source_kind, excluded.dictionary_code,
         excluded.source_article_id, excluded.source_pos, excluded.evidence);

  GET DIAGNOSTICS changed_binding_count = ROW_COUNT;
  IF changed_binding_count = 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      ARRAY[resolved_root_id], p_expression_ids
    );
  END IF;

  RETURN resolved_root_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  uuid[], bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  uuid[], bigint, text, text) TO service_role;

COMMIT;

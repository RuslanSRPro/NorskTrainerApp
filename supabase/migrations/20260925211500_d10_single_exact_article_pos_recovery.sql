-- Resolve a missing analyzer POS only from one exact verified Bokmål article.
CREATE OR REPLACE FUNCTION public.expand_multi_pos_occurrences_for_job(p_job_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_item record;
  v_pos_array text[];
  v_new_item_id uuid;
  v_cloned integer := 0;
  v_i integer;
  v_target_pos text;
  v_official_pos text;
  v_official_article_id text;
  v_official_count integer;
begin
  for v_item in
    select
      i.id as item_id,
      i.pos as existing_pos,
      i.normalized_lemma,
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
      and i.expression_id is null
      and i.match_type = 'token'
      and sc.status in ('done', 'partial')
    group by i.id, i.pos, i.normalized_lemma
  loop
    -- ФИКС (11.08.2026): добавлен второй аргумент v_item.normalized_lemma
    -- — extract_all_pos_from_source_evidence теперь требует лемму для
    -- lemma-anchored извлечения (см. её собственный комментарий, случай
    -- "blå"→ложный verb от чужой статьи "bla" на той же странице).
    v_pos_array := public.extract_all_pos_from_source_evidence(v_item.verification_evidence, v_item.normalized_lemma);

    -- A single exact Bokmål article with a verified POS can resolve an
    -- analyzer's missing POS. Never override an explicit analyzer POS or
    -- conflicting/multiple extracted POS values.
    if nullif(v_item.existing_pos, '') is null then
      select
        min(sc.evidence #>> '{raw_preview,pos}'),
        min(sc.evidence #>> '{raw_preview,article_ids,0}'),
        count(*)
      into v_official_pos, v_official_article_id, v_official_count
      from public.lexeme_source_checks sc
      where sc.item_id = v_item.item_id
        and sc.source = 'Ordbokene'
        and sc.query_type = 'token'
        and sc.status = 'done'
        and sc.registered_entry = true
        and sc.quality = 'strong'
        and sc.evidence #>> '{raw_preview,dictionary_code}' = 'bm'
        and sc.evidence #>> '{raw_preview,lookup_scope}' = 'e'
        and sc.evidence #>> '{raw_preview,candidate_article_count}' = '1'
        and sc.evidence #>> '{raw_preview,pos}' in
          ('noun', 'verb', 'adjective', 'determiner')
        and case
          when jsonb_typeof(sc.evidence #> '{raw_preview,article_ids}') = 'array'
          then jsonb_array_length(sc.evidence #> '{raw_preview,article_ids}') = 1
          else false
        end;

      if v_official_count = 1 and v_official_article_id is not null and
        (array_length(v_pos_array, 1) is null or
          (array_length(v_pos_array, 1) = 1 and v_pos_array[1] = v_official_pos)) then
        update public.lexeme_processing_items
        set pos = v_official_pos,
            result_summary = coalesce(result_summary, '{}'::jsonb) ||
              jsonb_build_object(
                'pos_source', 'ordbokene_single_exact_article',
                'pos_article_id', v_official_article_id,
                'pos_version', 'd10_exact_article_v1'
              ),
            updated_at = now()
        where id = v_item.item_id
          and nullif(pos, '') is null
          and lexeme_id is null
          and current_stage in ('source_checks', 'admission_gate');
        if found then
          continue;
        end if;
      end if;
    end if;

    if nullif(v_item.existing_pos, '') is not null then
      v_pos_array := array(
        select p from unnest(v_pos_array) p
        where p is distinct from v_item.existing_pos
      );
    end if;

    if v_pos_array is null or array_length(v_pos_array, 1) is null then
      continue;
    end if;

    if nullif(v_item.existing_pos, '') is null then
      if array_length(v_pos_array, 1) > 1 then
        update public.lexeme_processing_items
        set pos = v_pos_array[1], updated_at = now()
        where id = v_item.item_id;

        for v_i in 2 .. array_length(v_pos_array, 1) loop
          v_target_pos := v_pos_array[v_i];

          if exists (
            select 1 from public.lexeme_processing_items
            where job_id = p_job_id
              and normalized_lemma = v_item.normalized_lemma
              and pos = v_target_pos
          ) then
            continue;
          end if;

          insert into public.lexeme_processing_items (
            job_id, lexeme_id, raw_input, normalized_input, normalized_lemma,
            surface_form, pos, match_type, status, current_stage,
            attempt_count, max_attempts, next_retry_at, last_error,
            result_summary, created_at, started_at, finished_at, updated_at,
            expression_id
          )
          select
            job_id, null, raw_input, normalized_input, normalized_lemma,
            surface_form, v_target_pos, match_type, status, current_stage,
            attempt_count, max_attempts, next_retry_at, last_error,
            coalesce(result_summary, '{}'::jsonb) || jsonb_build_object(
              'cloned_from_item_id', id,
              'clone_reason', 'multi_pos_evidence_expansion',
              'clone_version', 'step_b_v4_lemma_anchored'
            ),
            now(), started_at, finished_at, now(),
            null
          from public.lexeme_processing_items
          where id = v_item.item_id
          returning id into v_new_item_id;

          insert into public.lexeme_source_checks (
            job_id, item_id, lexeme_id, source, stage, query, query_type,
            status, quality, found, registered_entry, whole_unit_match,
            component_match, usage_match, attempt_count, max_attempts,
            next_retry_at, last_checked_at, error_code, error_message,
            evidence, urls, created_at, updated_at, verification_run_id,
            verification_version, previous_status, previous_quality,
            previous_found, authoritative_relations, surface_form
          )
          select
            lsc.job_id, v_new_item_id, lsc.lexeme_id, lsc.source, lsc.stage, lsc.query, lsc.query_type,
            lsc.status, lsc.quality, lsc.found, lsc.registered_entry, lsc.whole_unit_match,
            lsc.component_match, lsc.usage_match, lsc.attempt_count, lsc.max_attempts,
            lsc.next_retry_at, lsc.last_checked_at, lsc.error_code, lsc.error_message,
            lsc.evidence, lsc.urls, now(), now(), lsc.verification_run_id,
            lsc.verification_version, lsc.previous_status, lsc.previous_quality,
            lsc.previous_found, lsc.authoritative_relations, lsc.surface_form
          from public.lexeme_source_checks lsc
          where lsc.item_id = v_item.item_id;

          v_cloned := v_cloned + 1;
        end loop;
      end if;
    else
      for v_i in 1 .. array_length(v_pos_array, 1) loop
        v_target_pos := v_pos_array[v_i];

        if exists (
          select 1 from public.lexeme_processing_items
          where job_id = p_job_id
            and normalized_lemma = v_item.normalized_lemma
            and pos = v_target_pos
        ) then
          continue;
        end if;

        insert into public.lexeme_processing_items (
          job_id, lexeme_id, raw_input, normalized_input, normalized_lemma,
          surface_form, pos, match_type, status, current_stage,
          attempt_count, max_attempts, next_retry_at, last_error,
          result_summary, created_at, started_at, finished_at, updated_at,
          expression_id
        )
        select
          job_id, null, raw_input, normalized_input, normalized_lemma,
          surface_form, v_target_pos, match_type, status, current_stage,
          attempt_count, max_attempts, next_retry_at, last_error,
          coalesce(result_summary, '{}'::jsonb) || jsonb_build_object(
            'cloned_from_item_id', id,
            'clone_reason', 'multi_pos_evidence_expansion_known_pos',
            'clone_version', 'step_b_v4_lemma_anchored'
          ),
          now(), started_at, finished_at, now(),
          null
        from public.lexeme_processing_items
        where id = v_item.item_id
        returning id into v_new_item_id;

        insert into public.lexeme_source_checks (
          job_id, item_id, lexeme_id, source, stage, query, query_type,
          status, quality, found, registered_entry, whole_unit_match,
          component_match, usage_match, attempt_count, max_attempts,
          next_retry_at, last_checked_at, error_code, error_message,
          evidence, urls, created_at, updated_at, verification_run_id,
          verification_version, previous_status, previous_quality,
          previous_found, authoritative_relations, surface_form
        )
        select
          lsc.job_id, v_new_item_id, lsc.lexeme_id, lsc.source, lsc.stage, lsc.query, lsc.query_type,
          lsc.status, lsc.quality, lsc.found, lsc.registered_entry, lsc.whole_unit_match,
          lsc.component_match, lsc.usage_match, lsc.attempt_count, lsc.max_attempts,
          lsc.next_retry_at, lsc.last_checked_at, lsc.error_code, lsc.error_message,
          lsc.evidence, lsc.urls, now(), now(), lsc.verification_run_id,
          lsc.verification_version, lsc.previous_status, lsc.previous_quality,
          lsc.previous_found, lsc.authoritative_relations, lsc.surface_form
        from public.lexeme_source_checks lsc
        where lsc.item_id = v_item.item_id;

        v_cloned := v_cloned + 1;
      end loop;
    end if;
  end loop;

  return v_cloned;
end;
$function$

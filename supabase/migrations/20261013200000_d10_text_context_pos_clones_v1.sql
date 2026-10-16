-- D10 plan B1 (D10_homonym_pos_plan_v2, rules R1-R3).
-- expand_multi_pos_occurrences_for_job clones a token item for every extra POS
-- found in its source evidence. In a TEXT job the analyzer has often already
-- chosen the POS from context (resolved_features.disambiguation_rule, e.g.
-- preceded_by_subject_pronoun for "Jeg husker"); the clone then promoted the
-- wrong homonym (huske noun 'swing').
-- Change: in a text job (summary.isolated_mode = false) no other-POS clones
-- for items whose POS was chosen by a context rule. Unchanged:
--   - word_list jobs (all POS, R1);
--   - text items without a context signal (no_signal_fallback_*,
--     no_context_all_candidates_returned): all POS, TEMPORARY until the
--     grammar graph (R3);
--   - legacy jobs without the isolated_mode flag;
--   - the missing-POS / single exact article branch.
-- The function body is otherwise identical to the live definition (export
-- 10.10.2026 = migration 20261001082822_d10_pos_isolation_v1).

DO $preflight$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.expand_multi_pos_occurrences_for_job(uuid)'::regprocedure) INTO v_def;
  IF position('multi_pos_evidence_expansion_known_pos' IN v_def) = 0
     OR position('d10_exact_article_v1' IN v_def) = 0 THEN
    RAISE EXCEPTION 'D10_B1_PREFLIGHT: live expand_multi_pos_occurrences_for_job differs from the expected base; nothing changed';
  END IF;
END
$preflight$;

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
  v_is_text_job boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text, 1010));
  -- D10 plan B1: text job = the analyzer ran with mode text
  -- (summary.isolated_mode = false). Missing flag (legacy jobs) keeps the
  -- previous behaviour.
  select coalesce((j.summary->>'isolated_mode')::boolean = false, false)
    into v_is_text_job
  from public.lexeme_processing_jobs j where j.id = p_job_id;
  v_is_text_job := coalesce(v_is_text_job, false);
  for v_item in
    select
      i.id as item_id,
      i.pos as existing_pos,
      i.normalized_lemma,
      i.result_summary->'resolved_features'->>'disambiguation_rule' as context_rule,
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
    group by i.id, i.pos, i.normalized_lemma,
      i.result_summary->'resolved_features'->>'disambiguation_rule'
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
      -- Ambiguous missing POS requires identity resolution; do not pick array[1].
      continue;
    elsif v_is_text_job
      and v_item.context_rule is not null
      and v_item.context_rule not like 'no_signal_fallback_%'
      and v_item.context_rule <> 'no_context_all_candidates_returned' then
      -- D10 plan B1 (rules R2/R3): in a text the analyzer chose this POS from
      -- context (e.g. preceded_by_subject_pronoun -> verb); only that POS is
      -- processed, no other-POS clones. A single word (word_list) keeps all
      -- POS (R1).
      -- TEMPORARY until the grammar graph: without a context signal
      -- (no_signal_fallback_*, no_context_all_candidates_returned) all POS
      -- found in the evidence are still offered, as for a single word.
      continue;
    else
      for v_i in 1 .. array_length(v_pos_array, 1) loop
        v_target_pos := v_pos_array[v_i];
        if v_target_pos not in ('noun', 'verb', 'adjective', 'determiner') then
          continue;
        end if;

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
          surface_form, v_target_pos, match_type, 'pending', 'source_checks',
          0, max_attempts, null, null,
          jsonb_build_object(
            'cloned_from_item_id', id,
            'clone_reason', 'multi_pos_evidence_expansion_known_pos',
            'clone_version', 'd10_pos_isolation_v1',
            'candidate_provenance', v_item.verification_evidence
          ),
          now(), null, null, now(),
          null
        from public.lexeme_processing_items
        where id = v_item.item_id
        returning id into v_new_item_id;

        insert into public.lexeme_source_checks (
          job_id, item_id, lexeme_id, source, stage, query, query_type,
          status, attempt_count, max_attempts, evidence, urls,
          authoritative_relations, surface_form, created_at, updated_at
        )
        select lsc.job_id, v_new_item_id, null, lsc.source, lsc.stage,
          lsc.query, lsc.query_type, 'pending', 0, lsc.max_attempts,
          '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, lsc.surface_form,
          now(), now()
        from public.lexeme_source_checks lsc
        where lsc.item_id = v_item.item_id;

        v_cloned := v_cloned + 1;
      end loop;
    end if;
  end loop;

  if v_cloned > 0 then
    update public.lexeme_processing_jobs j
    set total_items = (select count(*) from public.lexeme_processing_items i where i.job_id = p_job_id),
        updated_at = now()
    where j.id = p_job_id;
  end if;
  return v_cloned;
end;
$function$;

COMMENT ON FUNCTION public.expand_multi_pos_occurrences_for_job(uuid) IS
  'D10 B1 13.10.2026: text jobs keep only the context-chosen POS; TEMPORARY all-POS fallback without a context signal until the grammar graph.';

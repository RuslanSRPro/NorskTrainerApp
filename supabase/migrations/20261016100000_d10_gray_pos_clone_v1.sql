-- D10 16.10.2026 (agreed, step B point 4): a part-of-speech clone without an
-- article of its own (brenne noun: Ordbøkene has only the verb) becomes a
-- GREY CARD instead of stopping the job at admission_gate.
--
-- 1. d10_promote_gray_pos_clones_v1(job): clone items that promotion left at
--    admission_gate (POS not confirmed / weak evidence) get a card:
--      - an existing card (lemma, POS, no homograph key) is linked; otherwise
--        a new card is created;
--      - the card gets the clone's fresh evidence, status 'candidate',
--        tier 'ai_candidate' (grey, 1-2 stars by verification_stars_v1);
--      - the item goes to semantic_audit, so the enrichment chains give it
--        translations like any card. No forms are invented: a word without
--        an article has no forms.
--    Only POS the admission rules allow (noun / verb / adjective / adverb,
--    function-word rules respected). Idempotent.
-- 2. d10_job_gray_family_audit_v1: grey clone cards are reported as grey
--    (not checked for forms) and clones still at admission_gate no longer
--    count as blocked. Every existing key of the result is unchanged; the
--    family rule and the function-word rule are unchanged.

create or replace function public.d10_promote_gray_pos_clones_v1(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  v_item record;
  v_evidence jsonb;
  v_lexeme_id uuid;
  v_created integer := 0;
  v_linked integer := 0;
  v_skipped integer := 0;
  v_decision jsonb;
begin
  if p_job_id is null then raise exception 'INVALID_JOB_ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text, 1016));

  for v_item in
    select i.id, i.normalized_lemma, i.surface_form, i.pos, i.result_summary
    from public.lexeme_processing_items i
    where i.job_id = p_job_id
      and i.expression_id is null
      and i.lexeme_id is null
      and i.match_type = 'token'
      and i.current_stage = 'admission_gate'
      and i.result_summary->>'clone_reason' = 'multi_pos_evidence_expansion_known_pos'
      and i.result_summary->>'promotion_status' = 'not_promoted'
      and i.result_summary->>'admission_status' in ('pos_unverified', 'weak_evidence_only')
      and nullif(btrim(i.normalized_lemma), '') is not null
    order by i.id
    for update of i skip locked
  loop
    v_decision := public.dictionary_admission_decision(
      v_item.normalized_lemma, v_item.surface_form, v_item.pos, 'token', null);
    if coalesce((v_decision->>'admit')::boolean, false) is not true then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Same evidence shape as promote_verification_results_for_job.
    select jsonb_object_agg(sc.source, jsonb_build_object(
             'status', sc.status, 'quality', sc.quality, 'found', sc.found,
             'registered_entry', sc.registered_entry, 'whole_unit_match', sc.whole_unit_match,
             'component_match', sc.component_match, 'usage_match', sc.usage_match,
             'authoritative_relations', coalesce(sc.authoritative_relations, '[]'::jsonb),
             'evidence', sc.evidence))
      into v_evidence
    from public.lexeme_source_checks sc
    where sc.item_id = v_item.id and sc.status in ('done', 'partial');

    select l.id into v_lexeme_id
    from public.lexemes l
    where lower(l.lemma) = lower(v_item.normalized_lemma)
      and l.pos = v_item.pos
      and coalesce(l.homograph_key, '') = ''
    order by l.created_at nulls last, l.id
    limit 1;

    if v_lexeme_id is null then
      insert into public.lexemes (
        lemma, pos, display_form, source,
        verification_status, verification_tier, source_verified,
        verification_evidence, verification_version, last_verification_run,
        created_at, updated_at)
      values (
        v_item.normalized_lemma, v_item.pos,
        coalesce(nullif(v_item.surface_form, ''), v_item.normalized_lemma),
        'pipeline_gray_pos_clone',
        'candidate', 'ai_candidate', null,
        v_evidence, 5, 'd10-gray-pos-clone-v1', now(), now())
      on conflict do nothing
      returning id into v_lexeme_id;

      if v_lexeme_id is null then  -- created meanwhile by another job
        select l.id into v_lexeme_id
        from public.lexemes l
        where lower(l.lemma) = lower(v_item.normalized_lemma)
          and l.pos = v_item.pos and coalesce(l.homograph_key, '') = ''
        limit 1;
      else
        v_created := v_created + 1;
      end if;
    else
      -- Like the normal promotion, the card takes the fresh evidence of this
      -- job; without an article of its own it is a grey card.
      update public.lexemes l
      set verification_evidence = v_evidence,
          source_verified = null,
          verification_status = 'candidate',
          verification_tier = 'ai_candidate',
          verification_version = 5,
          last_verification_run = 'd10-gray-pos-clone-v1',
          updated_at = now()
      where l.id = v_lexeme_id;
      v_linked := v_linked + 1;
    end if;

    if v_lexeme_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    update public.lexeme_processing_items i
    set lexeme_id = v_lexeme_id,
        status = 'done',
        current_stage = 'semantic_audit',
        result_summary = coalesce(i.result_summary, '{}'::jsonb) || jsonb_build_object(
          'promotion_status', 'promoted_gray',
          'lexeme_id', v_lexeme_id,
          'gray_reason', coalesce(i.result_summary->>'admission_reason', i.result_summary->>'admission_status'),
          'promotion_version', 'd10_gray_pos_clone_v1'),
        updated_at = now()
    where i.id = v_item.id;

    insert into public.lexeme_semantic_enrichment (lexeme_id, status, created_at, updated_at)
    values (v_lexeme_id, 'pending', now(), now())
    on conflict (lexeme_id) do update set status = 'pending', updated_at = now();
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'linked', v_linked, 'skipped', v_skipped);
end;
$$;

revoke all on function public.d10_promote_gray_pos_clones_v1(uuid) from public, anon, authenticated;
grant execute on function public.d10_promote_gray_pos_clones_v1(uuid) to service_role;

-- Gray audit: previous body + grey POS clones (marked "D10 gray POS clone").
CREATE OR REPLACE FUNCTION public.d10_job_gray_family_audit_v1(p_job_id uuid, p_item_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE v_gray_ids uuid[]; v_gray_count integer; v_blocked_count integer;
  v_function_word_count integer;
  v_clone_gray_ids uuid[]; v_clone_gray_count integer;
BEGIN
  IF p_job_id IS NULL OR p_item_ids IS NULL OR cardinality(p_item_ids)>30
     OR array_position(p_item_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_FAMILY_AUDIT_IDS';
  END IF;
  SELECT coalesce(array_agg(i.id),'{}'::uuid[]) INTO v_gray_ids
  FROM public.lexeme_processing_items i
  JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  WHERE i.job_id=p_job_id AND i.id=ANY(p_item_ids)
    AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  -- D10 gray POS clone: grey cards of this page are not checked for forms.
  SELECT coalesce(array_agg(i.id),'{}'::uuid[]) INTO v_clone_gray_ids
  FROM public.lexeme_processing_items i
  WHERE i.job_id=p_job_id AND i.id=ANY(p_item_ids)
    AND i.result_summary->>'promotion_status'='promoted_gray';
  SELECT count(*) FILTER (WHERE family.item_id IS NOT NULL),
    count(*) FILTER (WHERE family.item_id IS NULL AND NOT fw.is_function_word AND NOT cl.is_clone),
    count(*) FILTER (WHERE family.item_id IS NULL AND fw.is_function_word)
    INTO v_gray_count,v_blocked_count,v_function_word_count
  FROM public.lexeme_processing_items i
  LEFT JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  -- Same rule as get_completion_evidence_snapshot_v1 (intentionally_excluded).
  CROSS JOIN LATERAL (SELECT coalesce(
        i.result_summary->>'admission_status'='rejected'
    AND i.result_summary->>'admission_reason' LIKE 'function_word_%'
    AND i.result_summary->'admission_decision'->>'admit'='false'
    AND i.result_summary->'admission_decision'->>'status'='rejected'
    AND i.result_summary->'admission_decision'->>'rule_type'='function_word',
    false) AS is_function_word) fw
  -- D10 gray POS clone: a POS clone left at the gate is a grey candidate, not a block.
  CROSS JOIN LATERAL (SELECT coalesce(
        i.result_summary->>'clone_reason'='multi_pos_evidence_expansion_known_pos',
    false) AS is_clone) cl
  WHERE i.job_id=p_job_id AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  SELECT count(*) INTO v_clone_gray_count
  FROM public.lexeme_processing_items i
  WHERE i.job_id=p_job_id
    AND i.result_summary->>'clone_reason'='multi_pos_evidence_expansion_known_pos'
    AND (i.result_summary->>'promotion_status'='promoted_gray'
         OR (i.current_stage='admission_gate' AND i.result_summary->>'promotion_status'='not_promoted'));
  RETURN jsonb_build_object('ok',true,'gray_ids',v_gray_ids || v_clone_gray_ids,
    'gray_count',v_gray_count,'blocked_count',v_blocked_count,
    'excluded_function_word_count',v_function_word_count,
    'gray_pos_clone_count',v_clone_gray_count);
END;
$function$;

do $$ begin raise notice 'd10 gray pos clone v1 installed'; end $$;

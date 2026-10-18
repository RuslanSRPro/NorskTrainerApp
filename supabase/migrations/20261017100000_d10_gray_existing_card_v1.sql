-- D10 17.10.2026 (agreed, variant A): an item left at admission_gate without
-- an article of its part of speech no longer stops the job when a card of
-- the same lemma and part of speech already exists (brenne, noun, in a word
-- check of "brenne"). The item is linked to that card as grey:
--   * no new card is created, the admission rule is unchanged;
--   * the existing card is NOT changed (its evidence and stars stay);
--   * no card -> the item stays at the gate, as before.
-- Same function as D10_gray_ambiguous_v1 (query 147) with one more condition
-- and one more branch; the clone and several-articles paths are unchanged.
-- The migration stops if the live definition is not the D10_gray_ambiguous one.

do $guard$
declare
  v_def text := pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure);
begin
  if position('d10_gray_existing_card_v1' in v_def) > 0 then
    return;  -- already applied
  end if;
  if md5(replace(v_def, E'\r', '')) <> '7e37b4689423e128be4c444a2682a778' then
    raise exception 'd10_promote_gray_pos_clones_v1 differs from D10_gray_ambiguous_v1 (md5 %); nothing changed', md5(v_def);
  end if;
end
$guard$;

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
  v_existing integer := 0;
begin
  if p_job_id is null then raise exception 'INVALID_JOB_ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text, 1016));

  for v_item in
    select i.id, i.normalized_lemma, i.surface_form, i.pos, i.result_summary,
      f.is_clone, f.is_ambiguous
    from public.lexeme_processing_items i
    cross join lateral (
      select
        coalesce(i.result_summary->>'clone_reason' = 'multi_pos_evidence_expansion_known_pos', false) as is_clone,
        exists (
          select 1 from public.lexeme_source_checks sc
          where sc.item_id = i.id and sc.source = 'Ordbokene' and sc.query_type = 'token'
            and sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
            and sc.evidence->'raw_preview'->>'pos' = i.pos
            and jsonb_typeof(sc.evidence->'raw_preview'->'candidate_article_ids') = 'array'
            and jsonb_array_length(sc.evidence->'raw_preview'->'candidate_article_ids') >= 2
        ) as is_ambiguous
    ) f
    where i.job_id = p_job_id
      and i.expression_id is null
      and i.lexeme_id is null
      and i.match_type = 'token'
      and i.current_stage = 'admission_gate'
      and (
        -- a part-of-speech clone (step B point 4)
        f.is_clone
        -- D10 16.10.2026: or Ordbøkene has SEVERAL Bokmål articles of this
        -- part of speech and none is bound to a card yet (passe adj.: I, II).
        -- The card is created here; the homograph step then gives it the
        -- article with the lowest number and creates the other cards (R8/R9).
        or f.is_ambiguous
        -- D10 17.10.2026 (agreed, variant A): or a card of this lemma and
        -- part of speech already exists (brenne, noun). The item is only
        -- linked to it: no new card, the card itself is not changed.
        or exists (
          select 1 from public.lexemes l
          where lower(l.lemma) = lower(i.normalized_lemma) and l.pos = i.pos
        )
      )
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

    -- D10 17.10.2026 (variant A): neither a clone nor several articles ->
    -- link to the existing card only (main card first), nothing created and
    -- the card's evidence is kept.
    if not v_item.is_clone and not v_item.is_ambiguous then
      select l.id into v_lexeme_id
      from public.lexemes l
      where lower(l.lemma) = lower(v_item.normalized_lemma) and l.pos = v_item.pos
      order by (coalesce(l.homograph_key, '') = '') desc, l.created_at nulls last, l.id
      limit 1;
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
            'promotion_version', 'd10_gray_existing_card_v1'),
          updated_at = now()
      where i.id = v_item.id;
      insert into public.lexeme_semantic_enrichment (lexeme_id, status, created_at, updated_at)
      values (v_lexeme_id, 'pending', now(), now())
      on conflict (lexeme_id) do update set status = 'pending', updated_at = now();
      v_existing := v_existing + 1;
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
          'promotion_version', 'd10_gray_pos_clone_v2'),
        updated_at = now()
    where i.id = v_item.id;

    insert into public.lexeme_semantic_enrichment (lexeme_id, status, created_at, updated_at)
    values (v_lexeme_id, 'pending', now(), now())
    on conflict (lexeme_id) do update set status = 'pending', updated_at = now();
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'linked', v_linked,
    'linked_existing', v_existing, 'skipped', v_skipped);
end;
$$;

revoke all on function public.d10_promote_gray_pos_clones_v1(uuid) from public, anon, authenticated;
grant execute on function public.d10_promote_gray_pos_clones_v1(uuid) to service_role;

do $$ begin raise notice 'd10 gray existing card v1 installed'; end $$;

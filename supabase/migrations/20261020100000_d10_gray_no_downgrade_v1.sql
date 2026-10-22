-- D10 20.10.2026 (agreed after the review of 17.10): a grey job item NEVER
-- changes an existing card. Before, a part-of-speech clone or a word with
-- several Ordbøkene articles overwrote the evidence of an existing card of
-- the same lemma and part of speech and set it to ai_candidate (a possible
-- downgrade of a confirmed card, with or without a bound article).
-- Now on every path: card exists -> the item is linked to it, the card is
-- not touched; no card -> clone / several articles create a new grey card
-- as before; otherwise the item stays at the gate.
-- Same function as D10_translation_cards_v1 (variant A), only this change.
-- The migration stops if the live definition is a different one.

do $guard$
declare
  v_def text := pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure);
begin
  if position('d10_gray_existing_card_v2' in v_def) > 0 then
    return;  -- already applied
  end if;
  if md5(replace(v_def, E'\r', '')) <> '5556e639b4b76a3e77033eeb05c599aa' then
    raise exception 'd10_promote_gray_pos_clones_v1 differs from D10_translation_cards_v1 (md5 %); nothing changed', md5(v_def);
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

    -- D10 17.10.2026 (variant A) + 20.10.2026 (agreed, no downgrade): a card
    -- of this lemma and part of speech already exists -> the item is only
    -- linked to it (main card first). The card itself is NEVER changed, on
    -- every path (clone, several articles, existing card): grey stays on the
    -- job item; the card's level changes only by its own promotion rule.
    select l.id into v_lexeme_id
    from public.lexemes l
    where lower(l.lemma) = lower(v_item.normalized_lemma) and l.pos = v_item.pos
    order by (coalesce(l.homograph_key, '') = '') desc, l.created_at nulls last, l.id
    limit 1;
    if v_lexeme_id is null and not v_item.is_clone and not v_item.is_ambiguous then
      v_skipped := v_skipped + 1;   -- no card and no clone/articles: stays at the gate
      continue;
    end if;
    if v_lexeme_id is not null then
      update public.lexeme_processing_items i
      set lexeme_id = v_lexeme_id,
          status = 'done',
          current_stage = 'semantic_audit',
          result_summary = coalesce(i.result_summary, '{}'::jsonb) || jsonb_build_object(
            'promotion_status', 'promoted_gray',
            'lexeme_id', v_lexeme_id,
            'gray_reason', coalesce(i.result_summary->>'admission_reason', i.result_summary->>'admission_status'),
            'gray_path', case when v_item.is_clone then 'pos_clone'
                              when v_item.is_ambiguous then 'several_articles'
                              else 'existing_card' end,
            'promotion_version', 'd10_gray_existing_card_v2'),
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

    -- no card yet (checked above): a new grey card for a clone or for a
    -- word with several Ordbøkene articles of this part of speech.
    begin
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
    end;

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

do $$ begin raise notice 'd10 gray no downgrade v1 installed'; end $$;

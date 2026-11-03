-- D10_resolver_skip_excluded_v1 (28.10.2026, agreed): the resolver does not
-- offer cards excluded from the dictionary, except function words.
-- Only public.collect_surface_candidates changes: one WHERE on the final
-- select (covers all parts A, B, C, E). merge_surface_candidates and
-- resolve_surface_form_v2 read it and are not changed. Today this removes one
-- card: bære II (3addea72..., d10_r9_false_card_no_own_forms_8440).
-- Guard: stops if the live body (whitespace ignored) is not the one read on
-- 28.10.2026 (query 238).
begin;

do $guard$
declare v_key text;
begin
  select md5(regexp_replace(p.prosrc, '\s+', '', 'g')) into v_key
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'collect_surface_candidates';
  if v_key is distinct from 'ee664a5b6d96bc9da81391ebf883272f' then
    raise exception 'BASE_CHANGED: collect_surface_candidates key %, expected ee664a5b6d96bc9da81391ebf883272f', v_key;
  end if;
end
$guard$;

CREATE OR REPLACE FUNCTION public.collect_surface_candidates(p_surface_form text)
 RETURNS TABLE(lexeme_id uuid, lemma text, pos text, form_type text, grammatical_features jsonb, confidence text, source text, match_priority integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_norm text;
begin
  v_norm := public.normalize_surface_form(p_surface_form);

  if v_norm is null or btrim(v_norm) = '' then
    return;
  end if;

  return query

  with raw_candidates as (

    -- ========================================================================
    -- A. V2 FORMS (canonical Bokmål morphology from Ordbøkene)
    -- One row per projection row (lexeme + form_key). A primary value ranks
    -- above an alternative value of the same row.
    -- ========================================================================

    select
      l.id as lexeme_id,
      l.lemma,
      coalesce(nullif(f.pos, ''), l.pos) as pos,
      f.form_key::text as form_type,

      jsonb_build_object(
        'resolver', 'lexeme_form_display_v2',
        'surface', p_surface_form,
        'normalized_surface', v_norm,
        'form_key', f.form_key,
        'matched_value', m.value,
        'is_primary', m.is_primary,
        'primary_values', f.primary_values,
        'alternative_values', f.alternative_values,
        'accepted_articles', f.accepted_articles,
        'article_ids', f.article_ids,
        'regularity_marker', f.regularity_marker,
        'headword', f.headword,
        'is_compound', f.is_compound,
        'snapshot_id', f.snapshot_id
      ) as grammatical_features,

      case when m.is_primary then 'high' else 'medium' end::text as confidence,

      'lexeme_form_display_v2'::text as source,

      case when m.is_primary then 95 else 90 end::integer as match_priority

    from public.lexeme_form_display_v2 f
    join public.lexemes l
      on l.id = f.lexeme_id

    cross join lateral (
      select v.value, v.is_primary
      from (
        select unnest(f.primary_values) as value, true as is_primary
        union all
        select unnest(f.alternative_values), false
      ) v
      where public.normalize_surface_form(v.value) = v_norm
      order by v.is_primary desc
      limit 1
    ) m

    where
      f.dictionary_code = 'bm'
      and public.d10_normalized_form_values_v1(f.primary_values, f.alternative_values) @> array[v_norm]


    union all


    -- ========================================================================
    -- B. COMPOUND HEAD FORMS (D10 16.10.2026, D10_compound_v1)
    -- A compound without its own Ordbøkene article (vinterjakke) has its forms
    -- built from the head card (vinterjakka, vinterjakker...). Used only for
    -- cards that have no V2 forms of their own (the table holds only those).
    -- Ranks below V2 forms, above a bare lemma match.
    -- ========================================================================

    select
      l.id as lexeme_id,
      l.lemma,
      coalesce(nullif(h.pos, ''), l.pos) as pos,
      h.form_key::text as form_type,

      jsonb_build_object(
        'resolver', 'lexeme_compound_head_forms_v1',
        'surface', p_surface_form,
        'normalized_surface', v_norm,
        'form_key', h.form_key,
        'matched_value', m.value,
        'is_primary', m.is_primary,
        'primary_values', h.primary_values,
        'alternative_values', h.alternative_values,
        'accepted_articles', h.accepted_articles,
        'compound_parts', h.compound_parts,
        'head_lemma', h.head_lemma,
        'is_compound', true
      ) as grammatical_features,

      'medium'::text as confidence,

      'lexeme_compound_head_forms_v1'::text as source,

      case when m.is_primary then 88 else 86 end::integer as match_priority

    from public.lexeme_compound_head_forms_v1 h
    join public.lexemes l
      on l.id = h.lexeme_id

    cross join lateral (
      select v.value, v.is_primary
      from (
        select unnest(h.primary_values) as value, true as is_primary
        union all
        select unnest(h.alternative_values), false
      ) v
      where public.normalize_surface_form(v.value) = v_norm
      order by v.is_primary desc
      limit 1
    ) m

    where public.d10_normalized_form_values_v1(h.primary_values, h.alternative_values) @> array[v_norm]
      and not exists (
        select 1 from public.lexeme_form_display_v2 own
        where own.lexeme_id = h.lexeme_id and own.dictionary_code = 'bm'
      )


    union all


    -- ========================================================================
    -- C. NAOB FORMS (D10 16.10.2026, D10_naob_forms_v1)
    -- A noun without Ordbøkene forms and without compound head forms has the
    -- forms NAOB lists in its article (brenne: brennen, brenner). Ranks below
    -- the bare lemma match, so a lemma in the text resolves as before.
    -- ========================================================================

    select
      l.id as lexeme_id,
      l.lemma,
      coalesce(nullif(n.pos, ''), l.pos) as pos,
      n.form_key::text as form_type,

      jsonb_build_object(
        'resolver', 'lexeme_naob_forms_v1',
        'surface', p_surface_form,
        'normalized_surface', v_norm,
        'form_key', n.form_key,
        'matched_value', m.value,
        'is_primary', m.is_primary,
        'primary_values', n.primary_values,
        'alternative_values', n.alternative_values,
        'accepted_articles', n.accepted_articles,
        'naob_slugs', n.naob_slugs
      ) as grammatical_features,

      'medium'::text as confidence,

      'lexeme_naob_forms_v1'::text as source,

      case when m.is_primary then 84 else 83 end::integer as match_priority

    from public.lexeme_naob_forms_v1 n
    join public.lexemes l
      on l.id = n.lexeme_id

    cross join lateral (
      select v.value, v.is_primary
      from (
        select unnest(n.primary_values) as value, true as is_primary
        union all
        select unnest(n.alternative_values), false
      ) v
      where public.normalize_surface_form(v.value) = v_norm
      order by v.is_primary desc
      limit 1
    ) m

    where public.d10_normalized_form_values_v1(n.primary_values, n.alternative_values) @> array[v_norm]
      and not exists (
        select 1 from public.lexeme_form_display_v2 own
        where own.lexeme_id = n.lexeme_id and own.dictionary_code = 'bm'
      )
      and not exists (
        select 1 from public.lexeme_compound_head_forms_v1 h
        where h.lexeme_id = n.lexeme_id
      )


    union all


    -- ========================================================================
    -- E. DIRECT LEXEME MATCH (unchanged)
    --
    -- All POS: adverbs, pronouns, conjunctions, prepositions, determiners,
    -- numerals, interjections, particles and lexemes without V2 forms yet.
    -- ========================================================================

    select
      l.id as lexeme_id,
      l.lemma,
      l.pos,
      'base'::text as form_type,

      jsonb_build_object(
        'resolver', 'lexemes_exact',
        'surface', p_surface_form,
        'normalized_surface', v_norm,
        'matched_by',
          case
            when public.normalize_surface_form(l.lemma) = v_norm
              and public.normalize_surface_form(l.display_form) = v_norm
              then 'lemma_and_display_form'
            when public.normalize_surface_form(l.lemma) = v_norm
              then 'lemma'
            else 'display_form'
          end,
        'display_form', l.display_form,
        'verification_status', l.verification_status,
        'verification_version', l.verification_version
      ) as grammatical_features,

      case
        when l.pos is null or l.pos = 'unknown' then 'low'
        else 'high'
      end::text as confidence,

      'lexemes'::text as source,

      case
        when l.pos is null or l.pos = 'unknown' then 50
        else 85
      end::integer as match_priority

    from public.lexemes l

    where
      public.normalize_surface_form(l.lemma) = v_norm
      or public.normalize_surface_form(l.display_form) = v_norm
  )

  select
    rc.lexeme_id,
    rc.lemma,
    rc.pos,
    rc.form_type,
    rc.grammatical_features,
    rc.confidence,
    rc.source,
    rc.match_priority

  from raw_candidates rc

  -- D10 28.10.2026 (agreed): a card excluded from the dictionary is not a
  -- candidate (bære II, d10_r9_false_card_no_own_forms_8440). Function words
  -- (dictionary_exclusion_reason function_word_*) are excluded only from
  -- learning and are still recognised in a text, as before.
  where not exists (
    select 1
    from public.lexemes excluded
    where excluded.id = rc.lexeme_id
      and excluded.dictionary_status = 'excluded'
      and coalesce(excluded.dictionary_exclusion_reason, '') not like 'function_word%'
  )

  order by
    rc.match_priority desc,
    rc.lemma,
    rc.pos,
    rc.lexeme_id,
    rc.form_type,
    rc.source;

end;
$function$;

commit;

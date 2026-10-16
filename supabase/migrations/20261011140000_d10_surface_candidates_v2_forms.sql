-- D10: surface-form candidates are read from the canonical V2 morphology
-- projection (public.lexeme_form_display_v2) instead of the legacy form tables.
--
-- Why: migration 20260916103514_d10_v2_only_forms_cutover emptied
-- lexeme_form_variants, verb_forms, noun_forms and adjective_forms and blocks
-- writes to them. Inflected forms ("gikk", "huset") can therefore only be
-- recognised from lexeme_form_display_v2.
--
-- Contract kept: collect_surface_candidates keeps its signature and output
-- columns, so merge_surface_candidates and resolve_surface_form_v2 (and every
-- caller of them) are unchanged. Only the candidate source changes:
--   A. V2 forms      lexeme_form_display_v2 (primary and alternative values)
--   E. exact lexeme  lexemes.lemma / lexemes.display_form   (unchanged)
-- The legacy tables are no longer read by this path. The legacy function
-- public.resolve_surface_form is left in place untouched; analyze-text stops
-- calling it in the same patch.
--
-- GRAMMAR GRAPH (future): this function stays the candidate source for words
-- that exist in the database. Context choice between candidates (today done in
-- analyze-text/surface-resolver-v2.ts) moves to the grammar graph, which fills
-- merge_surface_candidates.score/trace. Words with no candidate here (not in
-- the database) will be analysed by grammar-graph morphology rules; the
-- insertion point is the "no candidates" branch in analyze-text.
BEGIN;

-- Normalised set of every form value of one projection row. IMMUTABLE so it
-- can back the GIN index below; normalize_surface_form is IMMUTABLE.
CREATE OR REPLACE FUNCTION public.d10_normalized_form_values_v1(
  p_primary text[], p_alternative text[]
) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$
  SELECT coalesce(array_agg(DISTINCT n.value ORDER BY n.value), '{}'::text[])
  FROM unnest(coalesce(p_primary, '{}'::text[]) || coalesce(p_alternative, '{}'::text[])) AS v(raw)
  CROSS JOIN LATERAL (SELECT public.normalize_surface_form(v.raw) AS value) n
  WHERE n.value IS NOT NULL;
$fn$;

CREATE INDEX IF NOT EXISTS lexeme_form_display_v2_normalized_values_gin
  ON public.lexeme_form_display_v2
  USING gin (public.d10_normalized_form_values_v1(primary_values, alternative_values))
  WHERE dictionary_code = 'bm';

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

  order by
    rc.match_priority desc,
    rc.lemma,
    rc.pos,
    rc.lexeme_id,
    rc.form_type,
    rc.source;

end;
$function$;

COMMIT;

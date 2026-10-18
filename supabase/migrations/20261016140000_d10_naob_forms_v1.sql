-- D10 16.10.2026 (agreed: "если нет форм в Ordbøkene то смотреть в НАОБ").
-- Noun forms from the NAOB article (BØYNING) for a card that has no
-- Ordbøkene forms and no forms built from a compound head (brenne, noun:
-- en brenne, brennen, brenner).
--   1. Separate table lexeme_naob_forms_v1. lexeme_form_display_v2, its
--      snapshots and lexeme_compound_head_forms_v1 are NOT touched.
--   2. d10_publish_naob_forms_v1: checks the values on the server and writes
--      them; d10_record_naob_forms_review_v1: NAOB articles disagree, nothing
--      written.
--   3. collect_surface_candidates gets block C (the forms in a text:
--      "brennen" -> brenne). Blocks A, B and E are copied unchanged from
--      D10_compound_surface (query 142). The migration stops before any
--      change if the live definition is different.
-- Re-running is safe.

do $guard$
declare
  v_def text := pg_get_functiondef('public.collect_surface_candidates(text)'::regprocedure);
begin
  if position('lexeme_naob_forms_v1' in v_def) > 0 then
    return;  -- this migration was already applied
  end if;
  -- D10_compound_surface_v2 definition, LF or CRLF line endings
  if md5(replace(v_def, E'\r', '')) <> '52cbf7a5b48aa3abe7ec27b1680043e2' then
    raise exception 'collect_surface_candidates differs from D10_compound_surface (md5 %); nothing changed. Send the current definition for review.', md5(v_def);
  end if;
end
$guard$;

-- ---------------------------------------------------------------------------
-- Forms from NAOB (read by the app only when the word has no rows in
-- lexeme_form_display_v2 and no compound head forms).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lexeme_naob_forms_v1 (
  lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  pos text NOT NULL,
  lemma text NOT NULL,
  primary_values text[] NOT NULL,
  alternative_values text[] NOT NULL DEFAULT '{}'::text[],
  accepted_articles text[] NOT NULL DEFAULT '{}'::text[],
  regularity_marker text NOT NULL DEFAULT 'unknown',
  display_order integer NOT NULL,
  genus text,
  naob_slugs text[] NOT NULL,
  source text NOT NULL DEFAULT 'd10_naob_boeyning_v1',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lexeme_id, form_key),
  CHECK (cardinality(primary_values) > 0),
  CHECK (cardinality(naob_slugs) > 0)
);

ALTER TABLE public.lexeme_naob_forms_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexeme_naob_forms_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lexeme_naob_forms_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.lexeme_naob_forms_v1 TO authenticated;
DROP POLICY IF EXISTS lexeme_naob_forms_v1_authenticated_read ON public.lexeme_naob_forms_v1;
CREATE POLICY lexeme_naob_forms_v1_authenticated_read
  ON public.lexeme_naob_forms_v1
  FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lexeme_naob_forms_v1 TO service_role;

-- NAOB articles of the word give different forms: shown for review only.
CREATE TABLE IF NOT EXISTS private.d10_naob_forms_review_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.d10_naob_forms_review_v1 FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Publish the NAOB forms of one noun card. p_forms:
--   [{form_key, primary_values[], alternative_values[], accepted_articles[]}]
-- Refuses when:
--   the card is not a noun, has its own forms or compound head forms;
--   a form key is not a noun key, or is repeated;
--   a value is not one word, or the indefinite singular is not the lemma;
--   there is no form beyond the lemma itself.
-- Replaces the earlier NAOB rows of the card. Returns the number of rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_publish_naob_forms_v1(
  p_lexeme_id uuid,
  p_forms jsonb,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
DECLARE
  v_lexeme record;
  v_keys text[] := ARRAY['noun_singular_indefinite', 'noun_singular_definite',
                         'noun_plural_indefinite', 'noun_plural_definite'];
  v_slugs text[];
  v_rows integer;
BEGIN
  SELECT l.id, l.lemma, l.pos INTO v_lexeme FROM public.lexemes l WHERE l.id = p_lexeme_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  END IF;
  IF v_lexeme.pos IS DISTINCT FROM 'noun' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'POS_NOT_SUPPORTED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = p_lexeme_id) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'OWN_FORMS_EXIST';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = p_lexeme_id) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'COMPOUND_FORMS_EXIST';
  END IF;
  IF jsonb_typeof(p_forms) IS DISTINCT FROM 'array' OR jsonb_array_length(p_forms) = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORMS_REQUIRED';
  END IF;

  v_slugs := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_evidence -> 'naob_slugs', '[]'::jsonb)));
  IF coalesce(cardinality(v_slugs), 0) = 0
     OR EXISTS (SELECT 1 FROM unnest(v_slugs) s WHERE s !~ '^[A-Za-z0-9%._-]+$') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'NAOB_SLUGS_REQUIRED';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.d10_naob_forms_in (
    form_key text, primary_values text[], alternative_values text[], accepted_articles text[]
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.d10_naob_forms_in;
  INSERT INTO pg_temp.d10_naob_forms_in
  SELECT e ->> 'form_key',
    ARRAY(SELECT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'primary_values', '[]'::jsonb)) WITH ORDINALITY x(v, o) ORDER BY o),
    ARRAY(SELECT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'alternative_values', '[]'::jsonb)) WITH ORDINALITY x(v, o) ORDER BY o),
    ARRAY(SELECT DISTINCT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'accepted_articles', '[]'::jsonb)) v)
  FROM jsonb_array_elements(p_forms) e;

  IF EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in i WHERE i.form_key IS NULL OR NOT (i.form_key = ANY (v_keys)))
     OR (SELECT count(*) <> count(DISTINCT i.form_key) FROM pg_temp.d10_naob_forms_in i) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORM_KEY_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in i WHERE cardinality(i.primary_values) = 0)
     OR EXISTS (
       SELECT 1 FROM pg_temp.d10_naob_forms_in i, unnest(i.primary_values || i.alternative_values) v
       WHERE v !~ '^[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+(-[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+)*$')
     OR EXISTS (
       SELECT 1 FROM pg_temp.d10_naob_forms_in i, unnest(i.accepted_articles) a
       WHERE a NOT IN ('en', 'ei', 'et')) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORM_VALUE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.d10_naob_forms_in i
    WHERE i.form_key = 'noun_singular_indefinite'
      AND NOT (lower(btrim(v_lexeme.lemma)) = ANY (i.primary_values))) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'INDEFINITE_SINGULAR_NOT_LEMMA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in i WHERE i.form_key <> 'noun_singular_indefinite') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'NO_INFLECTED_FORM';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d10_naob_forms:' || p_lexeme_id::text, 0));
  DELETE FROM public.lexeme_naob_forms_v1 n WHERE n.lexeme_id = p_lexeme_id;

  INSERT INTO public.lexeme_naob_forms_v1 (
    lexeme_id, form_key, pos, lemma, primary_values, alternative_values,
    accepted_articles, regularity_marker, display_order, genus, naob_slugs,
    evidence, updated_at
  )
  SELECT p_lexeme_id, i.form_key, v_lexeme.pos, v_lexeme.lemma,
    i.primary_values,
    ARRAY(SELECT a FROM unnest(i.alternative_values) WITH ORDINALITY u(a, o)
          WHERE NOT (a = ANY (i.primary_values)) ORDER BY o),
    ARRAY(SELECT a FROM unnest(ARRAY['en', 'ei', 'et']) WITH ORDINALITY u(a, o)
          WHERE a = ANY (i.accepted_articles) ORDER BY o),
    'unknown', array_position(v_keys, i.form_key),
    nullif(left(btrim(coalesce(p_evidence ->> 'genus', '')), 80), ''),
    v_slugs, coalesce(p_evidence, '{}'::jsonb), now()
  FROM pg_temp.d10_naob_forms_in i;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  DELETE FROM private.d10_naob_forms_review_v1 r WHERE r.lexeme_id = p_lexeme_id;
  RETURN v_rows;
END;
$body$;

-- ---------------------------------------------------------------------------
-- NAOB articles disagree (or cannot be read safely): recorded for review.
-- Earlier NAOB rows of the card are removed: they are no longer confirmed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_record_naob_forms_review_v1(
  p_lexeme_id uuid, p_reason text, p_detail jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
BEGIN
  DELETE FROM public.lexeme_naob_forms_v1 n WHERE n.lexeme_id = p_lexeme_id;
  INSERT INTO private.d10_naob_forms_review_v1 (lexeme_id, reason, detail, recorded_at)
  VALUES (p_lexeme_id, left(coalesce(p_reason, 'unknown'), 200), coalesce(p_detail, '{}'::jsonb), now())
  ON CONFLICT (lexeme_id) DO UPDATE
    SET reason = excluded.reason, detail = excluded.detail, recorded_at = excluded.recorded_at;
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_publish_naob_forms_v1(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_record_naob_forms_review_v1(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_publish_naob_forms_v1(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_record_naob_forms_review_v1(uuid, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Forms in a text: block C added, A / B / E unchanged.
-- ---------------------------------------------------------------------------
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

  order by
    rc.match_priority desc,
    rc.lemma,
    rc.pos,
    rc.lexeme_id,
    rc.form_type,
    rc.source;

end;
$function$;

do $$ begin raise notice 'd10 naob forms v1 installed'; end $$;

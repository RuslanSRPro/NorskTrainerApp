-- D10 15.10.2026 (agreed): compound words.
--   1. Dictionary split of a word without its own Ordbøkene article
--      (vinterjakke = vinter + jakke) -> lexeme_compound_analyses.
--   2. Forms of such a word built from the article-backed forms of its head
--      card -> separate table lexeme_compound_head_forms_v1. The canonical
--      lexeme_form_display_v2 and its snapshots are NOT touched: they stay
--      "source forms only" and keep their article identity.
--   3. NAOB candidates of the job's words promoted per word.
-- Adds only. Existing tables, functions and the coloring trigger unchanged.

-- ---------------------------------------------------------------------------
-- Forms by the head component (read by the app only when the word has no
-- rows in lexeme_form_display_v2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lexeme_compound_head_forms_v1 (
  lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  pos text NOT NULL,
  lemma text NOT NULL,
  primary_values text[] NOT NULL,
  alternative_values text[] NOT NULL DEFAULT '{}'::text[],
  accepted_articles text[] NOT NULL DEFAULT '{}'::text[],
  regularity_marker text NOT NULL DEFAULT 'unknown',
  display_order integer NOT NULL,
  compound_parts text[] NOT NULL,
  headword text NOT NULL,
  head_lemma text NOT NULL,
  head_lexeme_ids uuid[] NOT NULL,
  head_article_ids bigint[] NOT NULL,
  prefix_surface text NOT NULL,
  source text NOT NULL DEFAULT 'd10_compound_head_v1',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lexeme_id, form_key),
  CHECK (cardinality(primary_values) > 0),
  CHECK (cardinality(compound_parts) >= 2)
);

ALTER TABLE public.lexeme_compound_head_forms_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexeme_compound_head_forms_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lexeme_compound_head_forms_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.lexeme_compound_head_forms_v1 TO authenticated;
DROP POLICY IF EXISTS lexeme_compound_head_forms_v1_authenticated_read
  ON public.lexeme_compound_head_forms_v1;
CREATE POLICY lexeme_compound_head_forms_v1_authenticated_read
  ON public.lexeme_compound_head_forms_v1
  FOR SELECT TO authenticated USING (true);

-- Words whose split is ambiguous: shown for review, nothing written.
CREATE TABLE IF NOT EXISTS private.d10_compound_review_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  reason text NOT NULL,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.d10_compound_review_v1 FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Write one verified analysis. Precedence by source:
--   naob_sammensatt / naob_annet_ledd (2) > dictionary_split (1).
-- An analysis written by anything else (manual, the old promoter run) is
-- never replaced. Same surface parts -> kept as is.
-- Returns: written | kept_same | kept_existing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_write_compound_analysis_v1(
  p_lexeme_id uuid,
  p_parts text[],
  p_links text[],
  p_source text,
  p_confidence numeric DEFAULT 0.7,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
DECLARE
  v_lemma text;
  v_n integer := coalesce(cardinality(p_parts), 0);
  v_built text := '';
  v_surfaces text[] := '{}';
  v_rank integer;
  v_existing record;
  v_existing_rank integer;
  v_existing_surfaces text[];
  v_analysis_id uuid;
  v_verified text[];
  i integer;
BEGIN
  v_rank := CASE p_source
    WHEN 'dictionary_split' THEN 1
    WHEN 'naob_sammensatt' THEN 2
    WHEN 'naob_annet_ledd' THEN 2
    ELSE NULL END;
  IF v_rank IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'COMPOUND_SOURCE_UNKNOWN';
  END IF;
  IF v_n < 2 OR coalesce(cardinality(p_links), 0) <> v_n - 1 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'COMPOUND_PARTS_INVALID';
  END IF;

  SELECT l.lemma INTO v_lemma FROM public.lexemes l WHERE l.id = p_lexeme_id;
  IF v_lemma IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  END IF;

  FOR i IN 1..v_n LOOP
    IF btrim(coalesce(p_parts[i], '')) = '' OR p_parts[i] ~ '\s' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'COMPOUND_PARTS_INVALID';
    END IF;
    IF i < v_n AND coalesce(p_links[i], '') NOT IN ('', 's', 'e') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'COMPOUND_LINK_INVALID';
    END IF;
    v_surfaces := v_surfaces || (lower(p_parts[i]) || CASE WHEN i < v_n THEN coalesce(p_links[i], '') ELSE '' END);
  END LOOP;
  v_built := array_to_string(v_surfaces, '');
  IF v_built <> lower(btrim(v_lemma)) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'COMPOUND_PARTS_DO_NOT_SPELL_LEMMA';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d10_compound:' || p_lexeme_id::text, 0));

  SELECT a.id, a.notes, a.status INTO v_existing
  FROM public.lexeme_compound_analyses a
  WHERE a.compound_lexeme_id = p_lexeme_id AND a.analysis_type = 'compound'
  FOR UPDATE;

  IF FOUND THEN
    SELECT array_agg(lower(c.component_surface) || coalesce(c.linking_element_after, '')
                     ORDER BY c.component_position)
    INTO v_existing_surfaces
    FROM public.lexeme_compound_components c
    WHERE c.compound_analysis_id = v_existing.id;

    IF v_existing_surfaces = v_surfaces AND v_existing.status = 'source_verified' THEN
      DELETE FROM private.d10_compound_review_v1 r WHERE r.lexeme_id = p_lexeme_id;
      RETURN 'kept_same';
    END IF;

    v_existing_rank := CASE
      WHEN v_existing.notes = 'd10_compound_v1:dictionary_split' THEN 1
      WHEN v_existing.notes IN ('d10_compound_v1:naob_sammensatt', 'd10_compound_v1:naob_annet_ledd') THEN 2
      ELSE NULL END;
    IF v_existing_rank IS NULL OR v_rank < v_existing_rank THEN
      RETURN 'kept_existing';
    END IF;
    DELETE FROM public.lexeme_compound_analyses a WHERE a.id = v_existing.id;
    -- forms built from the old head are no longer valid; the job step
    -- publishes them again from the new head when it applies.
    DELETE FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = p_lexeme_id;
  END IF;

  INSERT INTO public.lexeme_compound_analyses (
    compound_lexeme_id, analysis_type, status, component_count,
    head_component_position, confidence, notes, source_excerpt
  ) VALUES (
    p_lexeme_id, 'compound', 'source_verified', v_n, v_n,
    least(greatest(coalesce(p_confidence, 0.7), 0), 1),
    'd10_compound_v1:' || p_source,
    left(coalesce(p_evidence->>'excerpt', p_evidence::text), 1000)
  ) RETURNING id INTO v_analysis_id;

  INSERT INTO public.lexeme_compound_components (
    compound_analysis_id, component_position, component_role, component_lexeme_id,
    component_surface, linking_element_after, is_head, metadata
  )
  SELECT v_analysis_id, g.pos,
    CASE WHEN g.pos = 1 THEN 'forledd' WHEN g.pos = v_n THEN 'etterledd' ELSE 'intermediate_component' END,
    public.d10_lexeme_for_lemma_v1(p_parts[g.pos]),
    lower(p_parts[g.pos]),
    CASE WHEN g.pos < v_n THEN nullif(p_links[g.pos], '') ELSE NULL END,
    g.pos = v_n,
    jsonb_build_object('source', p_source, 'written_by', 'd10_write_compound_analysis_v1',
                       'evidence', coalesce(p_evidence, '{}'::jsonb))
  FROM generate_series(1, v_n) AS g(pos);

  DELETE FROM private.d10_compound_review_v1 r WHERE r.lexeme_id = p_lexeme_id;

  -- Coloring of the existing canonical rows (same rule as the trigger).
  v_verified := public.d10_verified_compound_parts(p_lexeme_id, v_lemma);
  IF coalesce(cardinality(v_verified), 0) >= 2 THEN
    UPDATE public.lexeme_form_display_v2 f
    SET is_compound = true, compound_parts = v_verified, headword = f.lemma
    WHERE f.lexeme_id = p_lexeme_id;
    UPDATE public.lexeme_compound_head_forms_v1 h
    SET compound_parts = v_verified, updated_at = now()
    WHERE h.lexeme_id = p_lexeme_id;
  END IF;
  RETURN 'written';
END;
$body$;

-- ---------------------------------------------------------------------------
-- Ambiguous split: recorded for review only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_record_compound_review_v1(
  p_lexeme_id uuid, p_reason text, p_candidates jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  INSERT INTO private.d10_compound_review_v1 (lexeme_id, reason, candidates, recorded_at)
  VALUES (p_lexeme_id, left(p_reason, 200), coalesce(p_candidates, '[]'::jsonb), now())
  ON CONFLICT (lexeme_id) DO UPDATE
    SET reason = excluded.reason, candidates = excluded.candidates, recorded_at = excluded.recorded_at;
$body$;

-- ---------------------------------------------------------------------------
-- Publish forms of a compound from its head card(s). Builds the values on
-- the server from the head's canonical rows; the client sends no forms.
-- Refuses when:
--   the word has its own canonical forms,
--   there is no verified split ending with the head,
--   the head cards differ (homographs with other forms),
--   a head card has another POS or no canonical forms.
-- Returns the number of rows written.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_publish_compound_head_forms_v1(
  p_lexeme_id uuid,
  p_head_lexeme_ids uuid[],
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
DECLARE
  v_lexeme record;
  v_parts text[];
  v_head text;
  v_prefix text;
  v_signatures integer;
  v_heads uuid[];
  v_rep uuid;
  v_articles bigint[];
  v_rows integer;
BEGIN
  SELECT l.id, l.lemma, l.pos INTO v_lexeme FROM public.lexemes l WHERE l.id = p_lexeme_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = p_lexeme_id) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'OWN_FORMS_EXIST';
  END IF;

  v_parts := public.d10_verified_compound_parts(p_lexeme_id, v_lexeme.lemma);
  IF coalesce(cardinality(v_parts), 0) < 2 THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'NO_VERIFIED_SPLIT';
  END IF;
  v_head := lower(v_parts[cardinality(v_parts)]);
  v_prefix := array_to_string(v_parts[1:cardinality(v_parts) - 1], '');

  v_heads := ARRAY(SELECT DISTINCT unnest(p_head_lexeme_ids) ORDER BY 1);
  IF coalesce(cardinality(v_heads), 0) = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'HEAD_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_heads) h(id)
    LEFT JOIN public.lexemes l ON l.id = h.id
    WHERE l.id IS NULL OR lower(btrim(l.lemma)) <> v_head OR l.pos <> v_lexeme.pos
       OR NOT EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f
                      WHERE f.lexeme_id = h.id AND f.dictionary_code = 'bm')
  ) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'HEAD_CARD_MISMATCH';
  END IF;

  -- every head card must give the same forms
  SELECT count(DISTINCT sig) INTO v_signatures FROM (
    SELECT f.lexeme_id,
      string_agg(f.form_key || '=' || array_to_string(f.primary_values, ',') || '|'
                 || array_to_string(f.alternative_values, ','), ';' ORDER BY f.form_key) AS sig
    FROM public.lexeme_form_display_v2 f
    WHERE f.lexeme_id = ANY (v_heads) AND f.dictionary_code = 'bm'
    GROUP BY f.lexeme_id
  ) s;
  IF v_signatures <> 1 THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'HEAD_FORMS_DIVERGE';
  END IF;
  -- only single-word forms can take the prefix ("har kjørt" cannot)
  IF EXISTS (
    SELECT 1 FROM public.lexeme_form_display_v2 f,
      unnest(f.primary_values || f.alternative_values) v
    WHERE f.lexeme_id = ANY (v_heads) AND v ~ '\s'
  ) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'HEAD_FORM_NOT_SINGLE_WORD';
  END IF;

  v_rep := v_heads[1];
  SELECT array_agg(DISTINCT a ORDER BY a) INTO v_articles
  FROM public.lexeme_form_display_v2 f, unnest(f.article_ids) a
  WHERE f.lexeme_id = ANY (v_heads);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d10_compound:' || p_lexeme_id::text, 0));
  DELETE FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = p_lexeme_id;

  INSERT INTO public.lexeme_compound_head_forms_v1 (
    lexeme_id, form_key, pos, lemma, primary_values, alternative_values,
    accepted_articles, regularity_marker, display_order, compound_parts,
    headword, head_lemma, head_lexeme_ids, head_article_ids, prefix_surface,
    evidence, updated_at
  )
  SELECT p_lexeme_id, f.form_key, v_lexeme.pos, v_lexeme.lemma,
    ARRAY(SELECT v_prefix || x FROM unnest(f.primary_values) WITH ORDINALITY u(x, o) ORDER BY o),
    ARRAY(SELECT v_prefix || x FROM unnest(f.alternative_values) WITH ORDINALITY u(x, o) ORDER BY o),
    coalesce(f.accepted_articles, '{}'::text[]),
    f.regularity_marker, f.display_order, v_parts, v_lexeme.lemma, v_head,
    v_heads, coalesce(v_articles, '{}'::bigint[]), v_prefix,
    coalesce(p_evidence, '{}'::jsonb), now()
  FROM public.lexeme_form_display_v2 f
  WHERE f.lexeme_id = v_rep AND f.dictionary_code = 'bm'
    AND cardinality(f.primary_values) > 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$body$;

-- ---------------------------------------------------------------------------
-- NAOB compound candidates of given words (for the job step).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_compound_candidates_for_lexemes_v1(p_lexeme_ids uuid[])
RETURNS TABLE(id uuid, source_entity_type text, source_entity_id uuid, target_text text,
              source text, confidence text, evidence jsonb, urls jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT r.id, r.source_entity_type, r.source_entity_id, r.target_text, r.source,
         r.confidence, r.evidence, r.urls
  FROM public.authoritative_semantic_relations r
  WHERE r.status = 'candidate'
    AND r.relation_type = 'compound_component_candidate'
    AND r.source_entity_type = 'lexeme'
    AND r.source_entity_id = ANY (p_lexeme_ids)
  ORDER BY r.created_at, r.id;
$body$;

REVOKE ALL ON FUNCTION public.d10_write_compound_analysis_v1(uuid, text[], text[], text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_record_compound_review_v1(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_publish_compound_head_forms_v1(uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_compound_candidates_for_lexemes_v1(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_write_compound_analysis_v1(uuid, text[], text[], text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_record_compound_review_v1(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_publish_compound_head_forms_v1(uuid, uuid[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_compound_candidates_for_lexemes_v1(uuid[]) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lexeme_compound_head_forms_v1 TO service_role;

DO $check$
BEGIN
  IF to_regprocedure('public.d10_verified_compound_parts(uuid,text)') IS NULL
     OR to_regprocedure('public.d10_lexeme_for_lemma_v1(text)') IS NULL THEN
    RAISE EXCEPTION 'd10 compound v1: required functions missing';
  END IF;
  RAISE NOTICE 'd10 compound v1 installed';
END
$check$;

-- D10_naob_bind_speed_v1 (10.11.2026): the NAOB family step of a verb with a big family ("leve") failed with
-- "canceling statement due to statement timeout": d10_naob_family_bind_v1 computed the match keys once per
-- compared PAIR (catalog x expressions, referenced glosses x expressions). Now every key is computed once per row
-- (MATERIALIZED) and the catalog rows of the verb are read once. Same rows, same order, same results
-- (test base: identical catalog and bindings; 150 expressions: 32 s -> 0.5 s).
-- NAOB runs that failed on the timeout get a new try (attempts reset) at the next analysis of that verb.
-- Rollback: optional/rollback_d10_naob_bind_speed_v1.sql (previous function from D10_naob_reference_v1).

CREATE OR REPLACE FUNCTION public.d10_naob_family_bind_v1(p_root_lexeme_id uuid, p_slugs text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_lemma text;
  v_c record;
  v_id uuid;
  v_glosses integer := 0;
  v_eligible integer := 0;
  v_matched integer := 0;
  v_inserted integer := 0;
  v_bound integer := 0;
  v_n integer;
BEGIN
  SELECT l.lemma INTO v_lemma FROM public.lexemes l WHERE l.id = p_root_lexeme_id AND l.pos = 'verb';
  IF v_lemma IS NULL THEN RAISE EXCEPTION 'NAOB_FAMILY_ROOT_NOT_VERB'; END IF;
  v_lemma := lower(btrim(v_lemma));
  IF coalesce(cardinality(p_slugs), 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'lemma', v_lemma, 'glosses', 0, 'eligible', 0);
  END IF;

  SELECT count(*) INTO v_glosses FROM public.naob_expression_glosses g WHERE g.naob_slug = ANY(p_slugs);

  FOR v_c IN
    -- D10_naob_bind_speed_v1: every match key is computed ONCE per row (MATERIALIZED), not once per compared
    -- pair; the catalog rows of this verb are read once. Same rows, same order, same results as before.
    WITH g AS MATERIALIZED (
      SELECT lower(btrim(regexp_replace(g.expression_lemma, '\s+', ' ', 'g'))) AS raw, g.*
      FROM public.naob_expression_glosses g
      WHERE g.naob_slug = ANY(p_slugs)
    ), ok AS MATERIALIZED (
      SELECT private.d10_naob_expr_notation_v1(g.raw) AS expr, g.*
      FROM g
      WHERE g.raw LIKE v_lemma || ' %'
        AND g.raw !~ '_{2,}|\?|…|\.\.\.|[0-9]'
    ), agg0 AS MATERIALIZED (
      SELECT x.*, private.d10_expr_match_keys_v1(x.expr) AS keys,
        NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x.glosses) d WHERE d->>'type' = 'direct') AS no_direct
      FROM (
        SELECT expr,
          jsonb_agg(jsonb_build_object('slug', naob_slug, 'anchor_id', anchor_id, 'type', gloss_type,
            'gloss', gloss_text, 'context', context_label, 'naob_form', raw) ORDER BY naob_slug, gloss_index, anchor_id) AS glosses,
          (array_agg(naob_slug ORDER BY naob_slug))[1] AS slug
        FROM ok GROUP BY expr) x
    ), refsrc AS MATERIALIZED (
      -- D10_naob_reference_v1: direct definitions in the referenced articles; keys once per gloss row
      SELECT g.naob_slug, g.anchor_id, g.gloss_text, g.context_label, lower(btrim(g.expression_lemma)) AS original,
        private.d10_expr_match_keys_v1(private.d10_naob_expr_notation_v1(g.expression_lemma)) AS keys
      FROM public.naob_expression_glosses g
      WHERE EXISTS (SELECT 1 FROM agg0 WHERE agg0.no_direct)
        AND g.gloss_type = 'direct' AND NOT (g.naob_slug = ANY (p_slugs))
        AND nullif(btrim(g.gloss_text), '') IS NOT NULL
        AND lower(btrim(g.expression_lemma)) LIKE v_lemma || ' %'
    ), refs AS (
      SELECT a.expr, jsonb_agg(DISTINCT jsonb_build_object('slug', r.naob_slug, 'anchor_id', r.anchor_id, 'type', 'direct',
          'gloss', r.gloss_text, 'context', r.context_label, 'naob_form', a.expr,
          'naob_form_original', r.original, 'via_reference', true)) AS rg
      FROM agg0 a JOIN refsrc r ON r.keys && a.keys
      WHERE a.no_direct
      GROUP BY a.expr
    ), cand AS MATERIALIZED (
      SELECT c.id, c.is_ob, c.created_at, private.d10_expr_match_keys_v1(c.lemma) AS keys
      FROM (
        SELECT e.id, e.lemma, (e.expression_subtype::text = 'ordbokene_sub_article') AS is_ob, e.created_at
        FROM public.expression_catalog e WHERE e.root_lemma = v_lemma
        UNION
        SELECT e.id, e.lemma, (e.expression_subtype::text = 'ordbokene_sub_article'), e.created_at
        FROM private.lexeme360_expression_roots_v1 b JOIN public.expression_catalog e ON e.id = b.expression_id
        WHERE b.root_lexeme_id = p_root_lexeme_id) c
    )
    SELECT a0.expr, a0.glosses || coalesce(r.rg, '[]'::jsonb) AS glosses, a0.slug, a0.keys,
      (SELECT c.id FROM cand c WHERE c.keys && a0.keys
       ORDER BY c.is_ob DESC, c.created_at, c.id LIMIT 1) AS existing_id
    FROM agg0 a0 LEFT JOIN refs r ON r.expr = a0.expr
  LOOP
    v_eligible := v_eligible + 1;
    v_id := v_c.existing_id;
    IF v_id IS NULL THEN
      SELECT e.id INTO v_id FROM public.expression_catalog e WHERE e.normalized_key = v_c.expr LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
      v_matched := v_matched + 1;
      UPDATE public.expression_catalog SET source_naob = true, updated_at = now()
      WHERE id = v_id AND source_naob IS DISTINCT FROM true;
      -- D10_naob_reference_v1: an expression that came from NAOB gets the (new) glosses, e.g. resolved references
      UPDATE public.expression_catalog
      SET raw_sources = raw_sources || jsonb_build_object('glosses', v_c.glosses), updated_at = now()
      WHERE id = v_id AND raw_sources->>'source' = 'NAOB' AND raw_sources->'glosses' IS DISTINCT FROM v_c.glosses;
    ELSE
      BEGIN
        -- D10_naob_family_v3: values are converted to the real column types
        -- (source_urls is jsonb in production, enums, text ...) by jsonb_populate_record;
        -- columns not listed keep their defaults (id, created_at ...).
        INSERT INTO public.expression_catalog (lemma, display_form, normalized_key, language, pos,
          expression_subtype, root_lemma, source_ordbokene, source_manual, source_gemini, source_naob,
          source_wiktionary, source_urls, raw_sources, verification, confidence, verification_status,
          verification_tier, verification_evidence, updated_at)
        SELECT r.lemma, r.display_form, r.normalized_key, r.language, r.pos,
          r.expression_subtype, r.root_lemma, r.source_ordbokene, r.source_manual, r.source_gemini, r.source_naob,
          r.source_wiktionary, r.source_urls, r.raw_sources, r.verification, r.confidence, r.verification_status,
          r.verification_tier, r.verification_evidence, r.updated_at
        FROM jsonb_populate_record(NULL::public.expression_catalog, jsonb_build_object(
          'lemma', v_c.expr, 'display_form', v_c.expr, 'normalized_key', v_c.expr,
          'language', 'no', 'pos', 'expression', 'expression_subtype', 'naob_expression',
          'root_lemma', v_lemma,
          'source_ordbokene', false, 'source_manual', false, 'source_gemini', false,
          'source_naob', true, 'source_wiktionary', false,
          'source_urls', jsonb_build_array('https://naob.no/ordbok/' || v_c.slug),
          'raw_sources', jsonb_build_object('source', 'NAOB', 'source_type', 'uttrykk', 'root_lemma', v_lemma,
            'glosses', v_c.glosses, 'rule', 'd10_naob_family_v1'),
          'verification', 'needs_review', 'confidence', 'medium',
          'verification_status', 'candidate', 'verification_tier', 'candidate',
          'verification_evidence', jsonb_build_object('source', 'NAOB', 'evidence_type', 'uttrykk',
            'naob_slugs', to_jsonb(p_slugs), 'source_url', 'https://naob.no/ordbok/' || v_c.slug),
          'updated_at', now())) r
        RETURNING id INTO v_id;
        v_inserted := v_inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        SELECT e.id INTO v_id FROM public.expression_catalog e WHERE e.normalized_key = v_c.expr LIMIT 1;
        IF v_id IS NULL THEN RAISE; END IF;
        v_matched := v_matched + 1;
      END;
    END IF;

    INSERT INTO private.lexeme360_expression_roots_v1 AS b
      (expression_id, root_lexeme_id, source_kind, dictionary_code, source_article_id, source_pos, evidence)
    VALUES (v_id, p_root_lexeme_id, 'naob_parent_article', 'naob', NULL, 'verb',
      jsonb_build_object('naob', jsonb_build_object('slugs', p_slugs, 'glosses', v_c.glosses,
        'rule', 'd10_naob_family_v1')))
    ON CONFLICT (expression_id, root_lexeme_id) DO UPDATE
      SET evidence = b.evidence || jsonb_build_object('naob', jsonb_build_object('slugs', p_slugs,
            'glosses', v_c.glosses, 'rule', 'd10_naob_family_v1')),
          updated_at = clock_timestamp();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_bound := v_bound + v_n;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'lemma', v_lemma, 'slugs', p_slugs, 'glosses', v_glosses,
    'eligible', v_eligible, 'matched_existing', v_matched, 'inserted', v_inserted, 'bound', v_bound);
END;
$function$;


REVOKE ALL ON FUNCTION public.d10_naob_family_bind_v1(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_naob_family_bind_v1(uuid, text[]) TO service_role;

WITH reset AS (
  UPDATE private.d10_family_naob_runs_v1
  SET status = 'retry', attempts = 0, updated_at = now() - interval '3 minutes'
  WHERE status = 'failed' AND detail::text LIKE '%statement timeout%'
  RETURNING root_lexeme_id
)
SELECT 'D10_naob_bind_speed_v1 installed' AS result,
  (SELECT string_agg(l.lemma, ', ' ORDER BY l.lemma) FROM reset r JOIN public.lexemes l ON l.id = r.root_lexeme_id) AS naob_runs_reset;

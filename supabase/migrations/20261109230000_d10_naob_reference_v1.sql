-- D10_naob_reference_v1 (09.11.2026, agreed): NAOB references ("se vask") are followed.
-- An expression of the verb article that NAOB only refers elsewhere (gå i vasken -> se vask) gets the direct definition
-- the referenced article gives for the same expression: naob-family-expressions-worker extracts the referenced
-- articles (a few per call; status 'partial' while some remain), d10_naob_family_bind_v1 takes their direct glosses
-- (same match keys as the dedupe) and also refreshes the glosses of expressions that came from NAOB.
-- Partial runs come back at once (no attempt counted). The verbs already done go through the step again once.
-- Still no definition -> the AI translation with "≈" (next package, D10_expression_approx_v1).

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
    WITH g AS (
      SELECT lower(btrim(regexp_replace(g.expression_lemma, '\s+', ' ', 'g'))) AS raw, g.*
      FROM public.naob_expression_glosses g
      WHERE g.naob_slug = ANY(p_slugs)
    ), ok AS (
      SELECT private.d10_naob_expr_notation_v1(g.raw) AS expr, g.*
      FROM g
      WHERE g.raw LIKE v_lemma || ' %'
        AND g.raw !~ '_{2,}|\?|…|\.\.\.|[0-9]'
    ), agg0 AS (
      SELECT expr,
        jsonb_agg(jsonb_build_object('slug', naob_slug, 'anchor_id', anchor_id, 'type', gloss_type,
          'gloss', gloss_text, 'context', context_label, 'naob_form', raw) ORDER BY naob_slug, gloss_index, anchor_id) AS glosses,
        (array_agg(naob_slug ORDER BY naob_slug))[1] AS slug
      FROM ok GROUP BY expr
    ), refs AS (
      -- D10_naob_reference_v1: an expression with only a reference ("se vask") gets the direct definition the
      -- referenced article gives for the same expression (the worker extracted those articles first)
      SELECT a.expr, jsonb_agg(DISTINCT jsonb_build_object('slug', g.naob_slug, 'anchor_id', g.anchor_id, 'type', 'direct',
          'gloss', g.gloss_text, 'context', g.context_label, 'naob_form', a.expr,
          'naob_form_original', lower(btrim(g.expression_lemma)), 'via_reference', true)) AS rg
      FROM agg0 a
      JOIN public.naob_expression_glosses g
        ON g.gloss_type = 'direct' AND NOT (g.naob_slug = ANY (p_slugs))
       AND nullif(btrim(g.gloss_text), '') IS NOT NULL
       AND lower(btrim(g.expression_lemma)) LIKE v_lemma || ' %'
       AND private.d10_expr_match_keys_v1(private.d10_naob_expr_notation_v1(g.expression_lemma))
           && private.d10_expr_match_keys_v1(a.expr)
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.glosses) x WHERE x->>'type' = 'direct')
      GROUP BY a.expr
    ), agg AS (
      SELECT a0.expr, a0.glosses || coalesce(r.rg, '[]'::jsonb) AS glosses, a0.slug
      FROM agg0 a0 LEFT JOIN refs r ON r.expr = a0.expr
    )
    SELECT a.*, private.d10_expr_match_keys_v1(a.expr) AS keys,
      (SELECT e.id FROM public.expression_catalog e
       WHERE (e.root_lemma = v_lemma
              OR EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
                         WHERE b.expression_id = e.id AND b.root_lexeme_id = p_root_lexeme_id))
         AND private.d10_expr_match_keys_v1(e.lemma) && private.d10_expr_match_keys_v1(a.expr)
       ORDER BY (e.expression_subtype::text = 'ordbokene_sub_article') DESC, e.created_at, e.id
       LIMIT 1) AS existing_id
    FROM agg a
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

CREATE OR REPLACE FUNCTION public.d10_family_naob_record_v1(
  p_job_id uuid, p_root_lexeme_id uuid, p_ok boolean, p_slugs text[] DEFAULT '{}', p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_row private.d10_family_naob_runs_v1;
  v_partial boolean := p_ok AND coalesce(p_detail->>'status', '') = 'partial';
BEGIN
  IF p_root_lexeme_id IS NULL OR p_ok IS NULL THEN RAISE EXCEPTION 'INVALID_FAMILY_NAOB_RECORD'; END IF;
  INSERT INTO private.d10_family_naob_runs_v1 AS d (root_lexeme_id, status, attempts, slugs, last_job_id, detail, updated_at)
  VALUES (p_root_lexeme_id, CASE WHEN v_partial THEN 'retry' WHEN p_ok THEN 'done' ELSE 'retry' END,
    CASE WHEN v_partial THEN 0 ELSE 1 END, coalesce(p_slugs, '{}'), p_job_id, coalesce(p_detail, '{}'::jsonb),
    CASE WHEN v_partial THEN now() - interval '3 minutes' ELSE now() END)
  ON CONFLICT (root_lexeme_id) DO UPDATE
    SET attempts = CASE WHEN v_partial THEN d.attempts ELSE d.attempts + 1 END,
        status = CASE WHEN v_partial THEN 'retry' WHEN p_ok THEN 'done' WHEN d.attempts + 1 >= 3 THEN 'failed' ELSE 'retry' END,
        slugs = CASE WHEN p_ok THEN coalesce(p_slugs, '{}') ELSE d.slugs END,
        last_job_id = p_job_id, detail = coalesce(p_detail, '{}'::jsonb),
        -- a partial run is eligible again at once (the 2-minute pause is only after a failure)
        updated_at = CASE WHEN v_partial THEN now() - interval '3 minutes' ELSE now() END
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'attempts', v_row.attempts, 'partial', v_partial);
END;
$function$;

-- once: the verbs already done go through the NAOB step again (their references are followed now)
DELETE FROM private.d10_family_naob_runs_v1 WHERE status = 'done';

SELECT 'd10_naob_reference_v1 installed' AS result,
  (SELECT count(*) FROM private.d10_family_naob_runs_v1) AS naob_ledger_rows_left;

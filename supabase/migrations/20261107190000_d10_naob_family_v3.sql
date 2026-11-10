-- D10_naob_family_v3 (07.11.2026): fix of d10_naob_family_bind_v1.
-- Test gripe: the NAOB article was found, the insert into expression_catalog failed:
-- "column source_urls is of type jsonb but expression is of type text[]".
-- The insert now converts every value to the real column type (jsonb_populate_record).
-- Everything else as in D10_naob_family_v1. Then the NAOB ledger row of gripe (retry) is
-- cleared so the next analysis of gripe runs the step at once.

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
    ), agg AS (
      SELECT expr,
        jsonb_agg(jsonb_build_object('slug', naob_slug, 'anchor_id', anchor_id, 'type', gloss_type,
          'gloss', gloss_text, 'context', context_label, 'naob_form', raw) ORDER BY naob_slug, gloss_index, anchor_id) AS glosses,
        (array_agg(naob_slug ORDER BY naob_slug))[1] AS slug
      FROM ok GROUP BY expr
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

DELETE FROM private.d10_family_naob_runs_v1 WHERE status IN ('retry', 'failed');

SELECT 'd10_naob_family_v3 installed' AS result,
  (SELECT count(*) FROM private.d10_family_naob_runs_v1 WHERE status IN ('retry', 'failed')) AS retry_rows_left;

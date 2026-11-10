-- D10 07.11.2026 (agreed): family 360 of a verb from NAOB too (union with Ordbøkene).
--
-- At the start of the job, in the same step as Ordbøkene (D10_family_dictionary_first_v1),
-- for every promoted verb root of the job (once per verb, any job):
--   naob-family-expressions-worker: NAOB search -> the verb articles of this headword (not a
--   noun homograph, fare_2) -> article in naob_article_cache -> naob-synonym-extractor ->
--   naob_expression_glosses -> d10_naob_family_bind_v1 (below):
--     * only expressions of the verb's own article that start with its lemma; no ___, no ?,
--       no digits; "direct", "reference" and "no_gloss" entries are all taken (agreed);
--     * NAOB notation -> Ordbøkene notation: a/b -> [a|b], noe(n) -> [noe|noen], (i)mellom -> [imellom|mellom];
--     * an expression Ordbøkene already has (same words; optional parts, alternatives,
--       frem/fram, sten/stein ignored) is NOT added again, it only gets the NAOB binding;
--     * a new one -> expression_catalog (subtype naob_expression, root_lemma = the verb, so the
--       analysis of later texts adds it too) + binding source_kind 'naob_parent_article';
--   no AI check (dictionary expression). Verbs only. No limit per verb (agreed).
-- Family injection takes both kinds of bindings, so NAOB expressions get into the same job,
-- count in total_items / the progress bar and go through all enrichment chains.

-- 1) subtype naob_expression (enum) + displayable in 360
DO $$
DECLARE v_type regtype;
BEGIN
  SELECT a.atttypid::regtype INTO v_type FROM pg_attribute a
  WHERE a.attrelid = 'public.expression_catalog'::regclass AND a.attname = 'expression_subtype' AND NOT a.attisdropped;
  IF v_type IS NOT NULL AND EXISTS (SELECT 1 FROM pg_type t WHERE t.oid = v_type::oid AND t.typtype = 'e') THEN
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', v_type, 'naob_expression');
  END IF;
END $$;

create or replace function private.lexeme360_subtype_is_displayable_v1(
  subtype text,
  allow_empty boolean default true
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when nullif(btrim(subtype), '') is null then allow_empty
    else lower(btrim(subtype)) = any(array[
      'particle_variant',
      'expression_family',
      'idiom_extension',
      'grammar_pattern',
      'prepositional_verb',
      'reflexive_expression',
      'collocation_with_shift',
      'particle_verb',
      'reflexive_particle_verb',
      'reflexive_construction',
      'verb_expression',
      'idiom',
      'ordbokene_sub_article',
      'has_expression',
      'naob_expression'
    ])
  end;
$$;

-- 2) ledger: which verb already went through the NAOB step
CREATE TABLE IF NOT EXISTS private.d10_family_naob_runs_v1 (
  root_lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('done', 'retry', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  slugs text[] NOT NULL DEFAULT '{}',
  last_job_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_family_naob_runs_v1 FROM PUBLIC;

-- 3) NAOB notation -> Ordbøkene notation, token by token
CREATE OR REPLACE FUNCTION private.d10_naob_expr_notation_v1(p_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE
  v_tok text;
  v_out text[] := '{}';
  v_m text[];
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  FOREACH v_tok IN ARRAY regexp_split_to_array(
      regexp_replace(regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g'), '[,.;:!]+$', ''), ' ') LOOP
    IF v_tok ~ '^[[:alpha:]æøå]+\([[:alpha:]æøå]+\)$' THEN          -- noe(n) -> [noe|noen]
      v_m := regexp_match(v_tok, '^([[:alpha:]æøå]+)\(([[:alpha:]æøå]+)\)$');
      v_tok := '[' || v_m[1] || '|' || v_m[1] || v_m[2] || ']';
    ELSIF v_tok ~ '^\([[:alpha:]æøå]+\)[[:alpha:]æøå]+$' THEN       -- (i)mellom -> [imellom|mellom]
      v_m := regexp_match(v_tok, '^\(([[:alpha:]æøå]+)\)([[:alpha:]æøå]+)$');
      v_tok := '[' || v_m[1] || v_m[2] || '|' || v_m[2] || ']';
    ELSIF v_tok ~ '^[[:alpha:]æøå]+(/[[:alpha:]æøå]+)+$' THEN      -- a/b/c -> [a|b|c]
      v_tok := '[' || replace(v_tok, '/', '|') || ']';
    END IF;
    v_out := v_out || v_tok;
  END LOOP;
  RETURN array_to_string(v_out, ' ');
END $$;

-- 4) comparison keys (both sources): with optional parts and without them, first alternative,
--    leading "å", riksmål spellings frem/sten/efter/nu/sne/hvad
CREATE OR REPLACE FUNCTION private.d10_expr_match_keys_v1(p_text text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE
  v text;
  k_with text;
  k_without text;
BEGIN
  IF p_text IS NULL THEN RETURN '{}'; END IF;
  v := regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g');
  v := regexp_replace(v, '^å ', '');
  v := regexp_replace(v, '\[([^]|]*)\|[^]]*\]', '\1', 'g');           -- [a|b] -> a
  v := regexp_replace(v, '([[:alpha:]æøå]+)(/[[:alpha:]æøå]+)+', '\1', 'g'); -- a/b -> a
  k_with := regexp_replace(replace(replace(v, '(', ''), ')', ''), '\s+', ' ', 'g');
  k_without := regexp_replace(regexp_replace(v, '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g');
  RETURN ARRAY(SELECT DISTINCT btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(regexp_replace(' ' || k || ' ',
        ' frem ', ' fram ', 'g'), ' sten ', ' stein ', 'g'), ' efter ', ' etter ', 'g'),
        ' nu ', ' nå ', 'g'), ' sne ', ' snø ', 'g'), ' hvad ', ' hva ', 'g'))
    FROM unnest(ARRAY[k_with, k_without]) AS k WHERE btrim(k) <> '');
END $$;

-- 5) NAOB expressions of the verb -> catalog + bindings
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
        INSERT INTO public.expression_catalog (lemma, display_form, normalized_key, language, pos,
          expression_subtype, root_lemma, example, notes_ua,
          source_ordbokene, source_manual, source_gemini, source_naob, source_wiktionary,
          source_urls, raw_sources, verification, confidence, verification_status, verification_tier,
          verification_evidence, updated_at)
        VALUES (v_c.expr, v_c.expr, v_c.expr, 'no', 'expression',
          'naob_expression', v_lemma, NULL, NULL,
          false, false, false, true, false,
          ARRAY['https://naob.no/ordbok/' || v_c.slug],
          jsonb_build_object('source', 'NAOB', 'source_type', 'uttrykk', 'root_lemma', v_lemma,
            'glosses', v_c.glosses, 'rule', 'd10_naob_family_v1'),
          'needs_review', 'medium', 'candidate', 'candidate',
          jsonb_build_object('source', 'NAOB', 'evidence_type', 'uttrykk', 'naob_slugs', p_slugs,
            'source_url', 'https://naob.no/ordbok/' || v_c.slug),
          now())
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
DECLARE v_row private.d10_family_naob_runs_v1;
BEGIN
  IF p_root_lexeme_id IS NULL OR p_ok IS NULL THEN RAISE EXCEPTION 'INVALID_FAMILY_NAOB_RECORD'; END IF;
  INSERT INTO private.d10_family_naob_runs_v1 AS d (root_lexeme_id, status, attempts, slugs, last_job_id, detail)
  VALUES (p_root_lexeme_id, CASE WHEN p_ok THEN 'done' ELSE 'retry' END, 1, coalesce(p_slugs, '{}'), p_job_id,
    coalesce(p_detail, '{}'::jsonb))
  ON CONFLICT (root_lexeme_id) DO UPDATE
    SET attempts = d.attempts + 1,
        status = CASE WHEN p_ok THEN 'done' WHEN d.attempts + 1 >= 3 THEN 'failed' ELSE 'retry' END,
        slugs = CASE WHEN p_ok THEN coalesce(p_slugs, '{}') ELSE d.slugs END,
        last_job_id = p_job_id, detail = coalesce(p_detail, '{}'::jsonb), updated_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'attempts', v_row.attempts);
END;
$function$;

-- 6) roots of the job for the dictionary step, v2: Ordbøkene (no bindings yet, as v1) and/or NAOB
CREATE OR REPLACE FUNCTION public.d10_family_dictionary_roots_page_v2(p_job_id uuid, p_limit integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_roots jsonb;
  v_total integer;
BEGIN
  IF p_job_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_DICTIONARY_REQUEST';
  END IF;

  WITH verified_roots AS MATERIALIZED (
    SELECT DISTINCT l.id AS lexeme_id, l.lemma, l.pos::text AS pos,
      root_article.article_id::bigint AS article_id
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos = 'verb'
    JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
      AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
      AND sc.status = 'done' AND sc.found IS TRUE
      AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
      AND sc.query_type = 'token'
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN sc.evidence->'raw_preview'->'article_ids' ELSE '[]'::jsonb END
    ) AS root_article(article_id)
    WHERE i.job_id = p_job_id AND i.match_type = 'token'
      AND i.status = 'done' AND i.current_stage = 'semantic_audit'
      AND i.result_summary->>'promotion_status' = 'promoted'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
      AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
      AND sc.evidence->'raw_preview'->>'pos' = l.pos
      AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
      AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
          OR (jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') > 1
              AND sc.evidence->'raw_preview'->>'article_selection' = 'bound_lexeme_article_set')
        ELSE false END
      AND root_article.article_id ~ '^[0-9]+$'
  ), flagged AS (
    SELECT r.*,
      (NOT EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
          WHERE b.root_lexeme_id = r.lexeme_id AND b.source_article_id = r.article_id
            AND b.dictionary_code = 'bm' AND b.source_kind = 'ordbokene_parent_article')
       AND NOT EXISTS (SELECT 1 FROM private.d10_family_dictionary_runs_v1 d
          WHERE d.root_lexeme_id = r.lexeme_id AND d.article_id = r.article_id
            AND (d.status IN ('done', 'failed')
                 OR (d.status = 'retry' AND d.updated_at > now() - interval '2 minutes')))) AS need_ordbokene,
      (NOT EXISTS (SELECT 1 FROM private.d10_family_naob_runs_v1 n
          WHERE n.root_lexeme_id = r.lexeme_id
            AND (n.status IN ('done', 'failed')
                 OR (n.status = 'retry' AND n.updated_at > now() - interval '2 minutes')))) AS need_naob
    FROM verified_roots r
  ), need AS (
    -- NAOB is per verb, not per article: one row per verb carries it
    SELECT f.lexeme_id, f.lemma, f.pos, f.article_id, f.need_ordbokene,
      f.need_naob AND f.article_id = min(f.article_id) OVER (PARTITION BY f.lexeme_id) AS need_naob
    FROM flagged f
  ), todo AS (
    SELECT * FROM need WHERE need_ordbokene OR need_naob
  )
  SELECT (SELECT count(*) FROM todo),
    coalesce((SELECT jsonb_agg(jsonb_build_object('lexeme_id', t.lexeme_id, 'lemma', t.lemma, 'pos', t.pos,
        'article_id', t.article_id, 'need_ordbokene', t.need_ordbokene, 'need_naob', t.need_naob)
        ORDER BY t.lemma, t.article_id)
      FROM (SELECT * FROM todo ORDER BY lemma, article_id LIMIT p_limit) t), '[]'::jsonb)
  INTO v_total, v_roots;

  RETURN jsonb_build_object('ok', true, 'roots', v_roots,
    'remaining', greatest(v_total - jsonb_array_length(v_roots), 0));
END;
$function$;

-- 7) family injection takes NAOB bindings too (copy of the 31.10 version; changes marked D10_naob_family_v1)
CREATE OR REPLACE FUNCTION public.d10_inject_verified_job_family_page_v1(p_job_id uuid, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_status text;
  v_candidate record;
  v_item_id uuid;
  v_claimed integer;
  v_added integer := 0;
  v_has_more boolean;
BEGIN
  IF p_job_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_PAGE_REQUEST';
  END IF;
  -- Serialize the ledger and job count with every retry for this job.
  SELECT j.status::text INTO v_status
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF v_status IS NULL OR v_status NOT IN ('processing', 'ready', 'done', 'partial') THEN
    RAISE EXCEPTION 'FAMILY_JOB_NOT_PROCESSING';
  END IF;

  FOR v_candidate IN
    WITH verified_roots AS MATERIALIZED (
      SELECT DISTINCT i.lexeme_id AS root_lexeme_id,
        root_article.article_id::bigint AS article_id
      FROM public.lexeme_processing_items i
      JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos = 'verb'
      JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
        AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
        AND sc.status = 'done' AND sc.found IS TRUE
        AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
        AND sc.query_type = 'token'
      -- D10 plan C (A1 follow-up): every article of the evidence is a root
      -- (one article as before, or a bound article set, see below).
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
          THEN sc.evidence->'raw_preview'->'article_ids' ELSE '[]'::jsonb END
      ) AS root_article(article_id)
      WHERE i.job_id = p_job_id AND i.match_type = 'token'
        AND i.status = 'done' AND i.current_stage = 'semantic_audit'
        AND i.result_summary->>'promotion_status' = 'promoted'
        AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
        AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
        AND sc.evidence->'raw_preview'->>'pos' = l.pos
        AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
        -- One article, or the bound article set of a homonym whose articles
        -- all belong to this lexeme (huske 24686 + 24687, rule R8).
        AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
          THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
            OR (jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') > 1
                AND sc.evidence->'raw_preview'->>'article_selection' = 'bound_lexeme_article_set')
          ELSE false END
        AND root_article.article_id ~ '^[0-9]+$'
    ), candidates AS (
      SELECT DISTINCT ON (b.expression_id) b.expression_id,
        b.root_lexeme_id,
        -- NAOB binding has no Ordbøkene article: the verb's own article (ledger needs one)
        coalesce(b.source_article_id, root.article_id) AS root_article_id,
        e.lemma, e.expression_subtype
      FROM verified_roots root
      JOIN private.lexeme360_expression_roots_v1 b
        ON b.root_lexeme_id = root.root_lexeme_id
       AND ((b.source_article_id = root.article_id
             AND b.dictionary_code = 'bm'
             AND b.source_kind = 'ordbokene_parent_article')
            -- D10 07.11.2026 (D10_naob_family_v1): NAOB expressions of the verb
            OR b.source_kind = 'naob_parent_article')
      JOIN public.expression_catalog e ON e.id = b.expression_id
      WHERE nullif(btrim(e.lemma), '') IS NOT NULL
        AND private.lexeme360_subtype_is_displayable_v1(e.expression_subtype, true)
        AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items existing
          WHERE existing.job_id = p_job_id AND existing.expression_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 prior
          WHERE prior.job_id = p_job_id AND prior.expression_id = e.id)
      ORDER BY b.expression_id, b.root_lexeme_id, b.source_article_id
    )
    SELECT * FROM candidates ORDER BY expression_id LIMIT p_limit
  LOOP
    INSERT INTO private.d10_job_family_injections_v1 (
      job_id, expression_id, root_lexeme_id, root_article_id
    ) VALUES (
      p_job_id, v_candidate.expression_id, v_candidate.root_lexeme_id,
      v_candidate.root_article_id
    ) ON CONFLICT (job_id, expression_id) DO NOTHING;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN CONTINUE; END IF;

    INSERT INTO public.lexeme_processing_items (
      job_id, expression_id, lexeme_id, raw_input, normalized_input,
      normalized_lemma, surface_form, pos, match_type, status,
      current_stage, attempt_count, max_attempts, result_summary
    ) VALUES (
      p_job_id, v_candidate.expression_id, NULL, v_candidate.lemma,
      lower(btrim(v_candidate.lemma)), lower(btrim(v_candidate.lemma)),
      v_candidate.lemma, 'expression', 'expression', 'pending',
      'source_checks', 0, 3,
      jsonb_build_object('match_strategy', 'lexeme360_family_injection',
        'expression_subtype', v_candidate.expression_subtype,
        'root_lexeme_id', v_candidate.root_lexeme_id,
        'root_article_id', v_candidate.root_article_id,
        'identity_source', 'family_binding_v2')
    ) RETURNING id INTO v_item_id;

    UPDATE private.d10_job_family_injections_v1 SET item_id = v_item_id
    WHERE job_id = p_job_id AND expression_id = v_candidate.expression_id;

    INSERT INTO public.lexeme_source_checks (
      job_id, item_id, lexeme_id, source, stage, query, surface_form,
      query_type, status, attempt_count, max_attempts, evidence, urls,
      verification_version
    ) SELECT p_job_id, v_item_id, NULL, source_name, 'lemma',
      lower(btrim(v_candidate.lemma)), v_candidate.lemma, 'expression',
      'pending', 0, 3, '{}'::jsonb, '[]'::jsonb, 1
    FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS sources(source_name);
    v_added := v_added + 1;
  END LOOP;

  IF v_added > 0 THEN
    UPDATE public.lexeme_processing_jobs j
    SET total_items = (SELECT count(*) FROM public.lexeme_processing_items i
                       WHERE i.job_id = p_job_id), updated_at = now()
    WHERE j.id = p_job_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos = 'verb'
    JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
      AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
      AND sc.status = 'done' AND sc.found IS TRUE
      AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
      AND sc.query_type = 'token'
    JOIN private.lexeme360_expression_roots_v1 b ON b.root_lexeme_id = l.id
      AND ((b.dictionary_code = 'bm'
            AND b.source_kind = 'ordbokene_parent_article'
            AND b.source_article_id::text IN (
              SELECT jsonb_array_elements_text(sc.evidence->'raw_preview'->'article_ids')))
           -- D10 07.11.2026 (D10_naob_family_v1): NAOB expressions of the verb
           OR b.source_kind = 'naob_parent_article')
    JOIN public.expression_catalog e ON e.id = b.expression_id
    WHERE i.job_id = p_job_id AND i.match_type = 'token'
      AND i.status = 'done' AND i.current_stage = 'semantic_audit'
      AND i.result_summary->>'promotion_status' = 'promoted'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
      AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
      AND sc.evidence->'raw_preview'->>'pos' = l.pos
      AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
      AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
          OR (jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') > 1
              AND sc.evidence->'raw_preview'->>'article_selection' = 'bound_lexeme_article_set')
        ELSE false END
      AND nullif(btrim(e.lemma), '') IS NOT NULL
        AND private.lexeme360_subtype_is_displayable_v1(e.expression_subtype, true)
      AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items existing
        WHERE existing.job_id = p_job_id AND existing.expression_id = e.id)
      AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 prior
        WHERE prior.job_id = p_job_id AND prior.expression_id = e.id)
  ) INTO v_has_more;

  IF NOT v_has_more THEN
    INSERT INTO private.synonym_family_completed_v1(job_id) VALUES(p_job_id) ON CONFLICT(job_id) DO UPDATE SET checked_at=now();
  END IF;
  RETURN jsonb_build_object('ok', true, 'added', v_added,
    'has_more', v_has_more, 'version', 'd10_verified_verb_family_v4');
END;
$function$
;

REVOKE ALL ON FUNCTION public.d10_naob_family_bind_v1(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_family_naob_record_v1(uuid, uuid, boolean, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_family_dictionary_roots_page_v2(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_naob_family_bind_v1(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_family_naob_record_v1(uuid, uuid, boolean, text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_family_dictionary_roots_page_v2(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION private.d10_naob_expr_notation_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.d10_expr_match_keys_v1(text) FROM PUBLIC;

SELECT 'd10_naob_family_v1 installed' AS result,
  (SELECT count(*) FROM pg_proc WHERE proname IN ('d10_naob_family_bind_v1', 'd10_family_naob_record_v1',
     'd10_family_dictionary_roots_page_v2', 'd10_naob_expr_notation_v1', 'd10_expr_match_keys_v1')) AS functions,
  private.d10_naob_expr_notation_v1('gripe dypt i pungen/lommene') AS notation_1,
  private.d10_naob_expr_notation_v1('det går (noe) i/over noe(n)') AS notation_2,
  private.d10_expr_match_keys_v1('gripe (inn) i (hverandre)') && private.d10_expr_match_keys_v1('gripe inn i hverandre') AS match_test;

-- D10_synonym_quality_v1 (30.10.2026, agreed in chat after the external review).
-- 1. Verifier v4 (edge: verifier-core.ts): substitution both ways + same construction; the version becomes
--    ai:synonym_pair_v4:<model>; ALL AI pairs of older versions are checked again (published ones too:
--    their links are withdrawn by the publish trigger until the new decision; dictionary-rule pairs stay).
-- 2. Rule "one gloss item": no automatic links any more. Two synonyms of one gloss item become a
--    CANDIDATE PAIR for the verifier (source = one synonym with its matched sense); the 58 links of
--    source 'synonym-same-gloss' are removed.
-- 3. Bokmålsordboka items keep their place in the article: sense_path ("2", "2.1") and item number
--    (synonym_bm_gloss_v1 + backfill); the second spelling of "kvass / hvass" is taken when it has a card.
-- 4. get_synonym_carousel_v2: one row per card AND sense of the opened word (a synonym of two senses is
--    no longer lost), the sense path for the numbers in the window.
-- Changed existing functions are md5-guarded (text without \r); otherwise STOP, nothing changed.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
DECLARE r record;
BEGIN
  IF to_regprocedure('public.d10_synonym_reverify_v2()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_quality_v1 is already installed; nothing changed';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.d10_synonym_verifier_version_v1()', '5a335f832ef41cdf9db1184d28f6c859'),
      ('public.d10_synonym_publish_siblings_v1(uuid)', '5e0d06c723715d5f1b0a6d8ab45cbd6d'),
      ('public.d10_synonym_siblings_trg_v1()', 'a1b30dc749fada61746affd7cd3cfc53'),
      ('public.d10_synonym_bm_collect_lexeme_v1(uuid,uuid,integer)', 'dc037ccd08be41e816221b98067225f6'),
      ('public.get_synonym_carousel_v2(uuid)', 'cd9e56b335c25187f4b173835ee12d6f')) v(fn, md5)
  LOOP
    IF to_regprocedure(r.fn) IS NULL THEN
      RAISE EXCEPTION 'STOP: % is missing; nothing changed', r.fn;
    END IF;
    IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = r.fn::regprocedure) <> r.md5 THEN
      RAISE EXCEPTION 'STOP: % differs from the version this package was built on; nothing changed', r.fn;
    END IF;
  END LOOP;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Verifier v4: version name + check again
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
  SELECT 'ai:synonym_pair_v4:' || model FROM public.synonym_verifier_config_v1 WHERE singleton;
$fn$;

-- every AI pair of an older version goes back to the queue, published ones too
CREATE FUNCTION public.d10_synonym_reverify_v2()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_version text := public.d10_synonym_verifier_version_v1();
  v_n integer;
BEGIN
  UPDATE public.synonym_pair_v1
  SET status = 'queued',
      history = history || jsonb_build_array(jsonb_build_object('decision', decision, 'confidence', confidence,
        'verifier_version', verifier_version, 'verified_at', verified_at, 'reason', verification_evidence->>'reason',
        'published', published, 'superseded_at', now(), 'why', 'reverify_' || v_version)),
      decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL,
      verified_at = NULL, attempts = 0, next_attempt_at = NULL, last_error = NULL,
      lease_token = NULL, lease_until = NULL, updated_at = now()
  WHERE status IN ('done', 'failed') AND verifier_version LIKE 'ai:%' AND verifier_version <> v_version;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'requeued', v_n, 'verifier_version', v_version);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Place of a sense in its article
-- ---------------------------------------------------------------------------
-- the gloss items of an article WITH their place: sense path as shown in the article ("2", "2.1", "" for
-- an article with one sense) and the item number; texts are built exactly as d10_ordbokene_explanations_v1
CREATE FUNCTION public.d10_ordbokene_explanation_paths_v1(p_payload jsonb)
RETURNS TABLE (sense_path text, def_ord integer, txt text)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
DECLARE
  v_nodes jsonb[] := ARRAY[coalesce(p_payload->'body'->'definitions', '[]'::jsonb)];
  v_paths text[] := ARRAY[''];
  v_node jsonb;
  v_path text;
  v_child jsonb;
  v_parts text[];
  v_text text;
  v_item jsonb;
  v_i integer;
  v_k integer;
  v_defs integer;
  v_seen text[] := '{}';
  v_ord integer := 0;
  v_guard integer := 0;
  v_n integer;
BEGIN
  WHILE coalesce(array_length(v_nodes, 1), 0) > 0 AND v_guard < 2000 LOOP
    v_guard := v_guard + 1;
    v_n := array_length(v_nodes, 1);
    v_node := v_nodes[v_n];
    v_path := v_paths[v_n];
    v_nodes := v_nodes[1:v_n - 1];
    v_paths := v_paths[1:v_n - 1];
    IF jsonb_typeof(v_node) = 'array' THEN
      -- definitions among these siblings are numbered 1, 2, 3 …; a single one keeps the parent's number
      SELECT count(*) INTO v_defs FROM jsonb_array_elements(v_node) e WHERE e->>'type_' = 'definition';
      v_k := v_defs + 1;
      FOR v_i IN REVERSE jsonb_array_length(v_node) - 1 .. 0 LOOP
        v_child := v_node -> v_i;
        IF v_child->>'type_' = 'definition' THEN
          v_k := v_k - 1;
          v_nodes := v_nodes || v_child;
          v_paths := v_paths || CASE WHEN v_defs = 1 THEN v_path
                                     WHEN v_path = '' THEN v_k::text ELSE v_path || '.' || v_k END;
        ELSE
          v_nodes := v_nodes || v_child;
          v_paths := v_paths || v_path;
        END IF;
      END LOOP;
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_node) <> 'object' THEN CONTINUE; END IF;
    IF v_node->>'type_' = 'sub_article' THEN CONTINUE; END IF;
    IF v_node->>'type_' = 'explanation' AND jsonb_typeof(v_node->'content') = 'string' THEN
      v_parts := string_to_array(v_node->>'content', '$');
      v_text := v_parts[1];
      FOR v_i IN 2 .. coalesce(array_length(v_parts, 1), 1) LOOP
        v_item := v_node->'items'->(v_i - 2);
        v_text := v_text || CASE
          WHEN v_item->>'type_' = 'article_ref' THEN coalesce((
            SELECT string_agg(l->>'lemma', ' / ') FROM jsonb_array_elements(coalesce(v_item->'lemmas', '[]'::jsonb)) l
            WHERE coalesce(l->>'lemma', '') <> ''), '')
          WHEN v_item->>'type_' = 'usage' THEN coalesce(v_item->>'text', '')
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' = 'mots' THEN 'motsatt'
          ELSE '' END || v_parts[v_i];
      END LOOP;
      v_text := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
      IF v_text <> '' AND NOT (v_text = ANY (v_seen)) AND coalesce(array_length(v_seen, 1), 0) < 12 THEN
        v_seen := v_seen || v_text;
        v_ord := v_ord + 1;
        sense_path := v_path; def_ord := v_ord; txt := v_text;
        RETURN NEXT;
      END IF;
      CONTINUE;
    END IF;
    IF v_node->>'type_' = 'example' THEN CONTINUE; END IF;
    v_child := coalesce(v_node->'elements', v_node->'definitions');
    IF v_child IS NOT NULL THEN
      v_nodes := v_nodes || v_child;
      v_paths := v_paths || v_path;
    END IF;
  END LOOP;
END
$fn$;


ALTER TABLE public.synonym_bm_gloss_v1 ADD COLUMN sense_path text, ADD COLUMN def_ord integer;

-- path of one gloss text in a cached Bokmålsordboka article
CREATE FUNCTION public.d10_synonym_sense_path_v1(p_article_id bigint, p_text text)
RETURNS TABLE (sense_path text, def_ord integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  SELECT x.sense_path, x.def_ord
  FROM (SELECT k.payload FROM public.ordbokene_article_cache k
        WHERE p_article_id IS NOT NULL AND k.article_id = p_article_id AND lower(k.dictionary_code) = 'bm'
        ORDER BY k.updated_at DESC LIMIT 1) a
  CROSS JOIN LATERAL public.d10_ordbokene_explanation_paths_v1(a.payload) x
  WHERE x.txt = btrim(p_text)
  ORDER BY x.def_ord LIMIT 1;
$fn$;

UPDATE public.synonym_bm_gloss_v1 g SET sense_path = p.sense_path, def_ord = p.def_ord
FROM public.synonym_bm_gloss_v1 g2
CROSS JOIN LATERAL public.d10_synonym_sense_path_v1(g2.article_id, g2.gloss_text) p
WHERE g2.id = g.id;

CREATE OR REPLACE FUNCTION public.d10_synonym_bm_collect_lexeme_v1(p_lexeme_id uuid, p_job_id uuid, p_depth integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private' AS $fn$
DECLARE
  l record;
  v_version text;
  v_art bigint;
  v_arts bigint[];
  v_payload jsonb;
  v_forms text[];
  v_expl text;
  v_pos record;
  v_terms text[];
  v_gloss uuid;
  v_missing bigint[] := '{}';
  v_glosses integer := 0;
  v_cands integer := 0;
  v_n integer;
BEGIN
  SELECT x.id, x.lemma, x.pos INTO l FROM public.lexemes x WHERE x.id = p_lexeme_id;
  IF NOT FOUND OR coalesce(l.pos, '') NOT IN ('verb', 'noun', 'adjective', 'adverb') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'pos');
  END IF;
  SELECT pipeline_version INTO STRICT v_version FROM public.synonym_pipeline_config WHERE singleton;
  v_arts := coalesce(public.d10_lexeme_article_ids_v1(p_lexeme_id), '{}'::bigint[]);

  FOREACH v_art IN ARRAY v_arts LOOP
    SELECT k.payload INTO v_payload FROM public.ordbokene_article_cache k
    WHERE k.article_id = v_art AND lower(k.dictionary_code) = 'bm' ORDER BY k.updated_at DESC LIMIT 1;
    IF v_payload IS NULL THEN v_missing := v_missing || v_art; CONTINUE; END IF;
    SELECT coalesce(array_agg(DISTINCT lower(f #>> '{}')), '{}') INTO v_forms
    FROM jsonb_path_query(v_payload, 'lax $.lemmas[*].paradigm_info[*].inflection[*].word_form') f;

    -- D10 30.10.2026 (agreed after review): items with their place in the article (sense path)
    FOR v_pos IN SELECT * FROM public.d10_ordbokene_explanation_paths_v1(v_payload) LOOP
      v_expl := v_pos.txt;
      -- single words; 2-3 words only when the expression is in the catalog
      SELECT coalesce(array_agg(t.term ORDER BY t.ord), '{}') INTO v_terms
      FROM public.d10_synonym_bm_terms_v1(v_expl, l.lemma, v_forms) t
      WHERE t.term !~ ' ' OR EXISTS (SELECT 1 FROM public.expression_catalog x WHERE x.normalized_key = t.term);
      CONTINUE WHEN coalesce(array_length(v_terms, 1), 0) = 0;
      -- "kvass / hvass", "høy / høg": the second spelling too when it has its own card
      -- (no new card for a spelling variant: it may belong to the same article)
      SELECT v_terms || coalesce(array_agg(DISTINCT v.w), '{}') INTO v_terms
      FROM (SELECT lower(btrim(split_part(p.part, ' / ', 2))) AS w
            FROM regexp_split_to_table(v_expl, '\s*[,;]\s*') p(part) WHERE p.part ~ ' / ') v
      WHERE v.w <> '' AND v.w <> lower(btrim(l.lemma)) AND NOT (v.w = ANY (v_terms))
        AND EXISTS (SELECT 1 FROM public.lexemes x WHERE lower(btrim(x.lemma)) = v.w AND x.pos = l.pos);

      INSERT INTO public.synonym_bm_gloss_v1 AS g (lexeme_id, article_id, gloss_text, terms, sense_path, def_ord)
      VALUES (p_lexeme_id, v_art, v_expl, v_terms, v_pos.sense_path, v_pos.def_ord)
      ON CONFLICT (article_id, gloss_text) DO UPDATE SET terms = EXCLUDED.terms, sense_path = EXCLUDED.sense_path,
        def_ord = EXCLUDED.def_ord, updated_at = now()
      RETURNING g.id INTO v_gloss;
      v_glosses := v_glosses + 1;

      INSERT INTO public.synonym_candidate_queue (
        bm_gloss_id, pipeline_version, source_entity_type, source_entity_id,
        source_sense_anchor, naob_slug, naob_gloss, context_label,
        target_text, target_kind, expected_pos, origin_depth, stage1_status,
        synonym_group_key, root_synonym_lemma, source_job_id, dispatch_status, verification_evidence)
      SELECT v_gloss, v_version, 'lexeme', p_lexeme_id,
        'bm:' || v_art || ':' || left(md5(v_expl), 12), 'bm:' || v_art, v_expl, NULL,
        t.term, CASE WHEN t.term ~ ' ' THEN 'expression' ELSE 'lexeme' END,
        CASE WHEN t.term ~ ' ' THEN NULL ELSE l.pos END, p_depth,
        CASE WHEN t.term ~ ' ' THEN 'awaiting_target_resolution' ELSE 'candidate' END,
        'bm:' || v_art || '#' || left(md5(v_expl), 12), l.lemma, p_job_id,
        CASE WHEN p_depth > 0 THEN 'deferred_depth' ELSE 'pending' END,
        jsonb_build_object('collected_by', 'd10_synonym_bm_collect_lexeme_v1', 'source', 'bokmaalsordboka',
          'article_id', v_art, 'gloss_part', t.ord)
      FROM unnest(v_terms) WITH ORDINALITY t(term, ord)
      ON CONFLICT (bm_gloss_id, lower(btrim(target_text)), pipeline_version) WHERE bm_gloss_id IS NOT NULL
      DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_cands := v_cands + v_n;
    END LOOP;
  END LOOP;

  INSERT INTO public.synonym_bm_word_v1 AS w (lexeme_id, status, missing_articles, glosses, candidates, attempts, processed_at)
  VALUES (p_lexeme_id,
    CASE WHEN cardinality(v_missing) > 0 THEN 'waiting_article'
         WHEN cardinality(v_arts) = 0 THEN 'no_article' ELSE 'done' END,
    v_missing, v_glosses, v_cands, 1, now())
  ON CONFLICT (lexeme_id) DO UPDATE SET status = EXCLUDED.status, missing_articles = EXCLUDED.missing_articles,
    glosses = greatest(w.glosses, EXCLUDED.glosses), candidates = w.candidates + EXCLUDED.candidates,
    attempts = w.attempts + 1, processed_at = now();

  RETURN jsonb_build_object('ok', true, 'articles', cardinality(v_arts), 'missing', to_jsonb(v_missing),
    'glosses', v_glosses, 'candidates', v_cands);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Rule "one gloss item" -> candidate pairs for the verifier (no automatic links)
-- ---------------------------------------------------------------------------
DELETE FROM public.authoritative_semantic_relations WHERE source = 'synonym-same-gloss' AND relation_type = 'synonym';

CREATE OR REPLACE FUNCTION public.d10_synonym_publish_siblings_v1(p_gloss_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private' AS $fn$
DECLARE
  v_version text;
  r record;
  v_id uuid;
  v_new integer := 0;
BEGIN
  IF p_gloss_id IS NULL OR NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END IF;
  SELECT pipeline_version INTO v_version FROM public.synonym_pipeline_config WHERE singleton;

  -- published synonyms of this gloss item (from the head word, not from earlier sibling candidates)
  FOR r IN
    WITH t AS (
      SELECT DISTINCT ON (p.target_entity_type, p.target_entity_id)
             p.target_entity_type tt, p.target_entity_id ti, p.id pair_id, c.gloss_id, c.bm_gloss_id,
             c.naob_gloss AS item_text, c.root_synonym_lemma AS head_lemma,
             public.d10_synonym_target_sense_v1(p.verification_evidence, p.snapshot) AS sense,
             p.snapshot->'target'->>'article_id' AS article_id
      FROM public.synonym_pair_v1 p
      JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
      WHERE coalesce(c.gloss_id, c.bm_gloss_id) = p_gloss_id
        AND coalesce(c.source_sense_anchor, '') NOT LIKE 'sib:%'
        AND p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')
      ORDER BY p.target_entity_type, p.target_entity_id, p.verified_at DESC
    )
    SELECT a.*, b.tt AS b_tt, b.ti AS b_ti, b.pair_id AS b_pair,
           public.d10_synonym_entity_lemma_v1(b.tt, b.ti) AS b_lemma
    FROM t a JOIN t b ON a.ti::text < b.ti::text
    WHERE public.d10_synonym_entity_lemma_v1(a.tt, a.ti) IS NOT NULL
      AND public.d10_synonym_entity_lemma_v1(b.tt, b.ti) IS NOT NULL
      -- already linked by the verifier: nothing to do
      AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations v
                      WHERE v.relation_type = 'synonym' AND v.source = 'synonym-verifier'
                        AND v.source_entity_type = a.tt AND v.source_entity_id = a.ti
                        AND v.target_entity_type = b.tt AND v.target_entity_id = b.ti)
  LOOP
    v_id := NULL;
    INSERT INTO public.synonym_candidate_queue (
      gloss_id, bm_gloss_id, pipeline_version, source_entity_type, source_entity_id,
      source_sense_anchor, naob_slug, naob_gloss, target_text, target_kind, origin_depth, stage1_status,
      synonym_group_key, root_synonym_lemma, dispatch_status, enrichment_done_at, target_entity_ids,
      verification_evidence)
    VALUES (r.gloss_id, r.bm_gloss_id,
      -- own version per source: the unique (gloss, target, version) of the head word is not touched
      v_version || ':sib:' || r.ti::text, r.tt, r.ti,
      'sib:' || p_gloss_id::text, 'sibling', coalesce(nullif(r.sense, ''), r.item_text),
      r.b_lemma, r.b_tt, 0, 'waiting_enrichment',
      'sib:' || p_gloss_id::text, r.head_lemma, 'skipped_ready', now(),
      jsonb_build_array(jsonb_build_object('entity_type', r.b_tt, 'id', r.b_ti)),
      jsonb_build_object('collected_by', 'd10_synonym_siblings_v2', 'gloss_key', p_gloss_id,
        'item_text', r.item_text, 'parent_pairs', jsonb_build_array(r.pair_id, r.b_pair),
        'source_article_id', r.article_id))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
      v_new := v_new + 1;
      BEGIN
        PERFORM public.d10_synonym_prepare_candidate_v1(v_id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'd10_synonym_publish_siblings_v1: prepare % failed: %', v_id, SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'gloss_id', p_gloss_id, 'candidates_written', v_new,
    'links_written', 0, 'links_removed', 0);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_siblings_trg_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_gloss uuid; v_anchor text;
BEGIN
  IF public.d10_synonym_publication_on_v1() THEN
    SELECT coalesce(c.gloss_id, c.bm_gloss_id), c.source_sense_anchor INTO v_gloss, v_anchor
    FROM public.synonym_candidate_queue c WHERE c.id = NEW.candidate_id;
    -- decisions on sibling candidates do not create further siblings
    IF v_gloss IS NOT NULL AND coalesce(v_anchor, '') NOT LIKE 'sib:%' THEN
      PERFORM public.d10_synonym_publish_siblings_v1(v_gloss);
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Window: one row per card and sense; sense paths
-- ---------------------------------------------------------------------------
DROP FUNCTION public.d10_synonym_pair_sides_v1();
CREATE FUNCTION public.d10_synonym_pair_sides_v1()
RETURNS TABLE (pair_id uuid, gloss_key uuid, head_type text, head_id uuid, head_lemma text, head_sense text,
               target_type text, target_id uuid, target_lemma text, target_sense text,
               decision text, verifier_version text, reason text,
               head_article bigint, target_article bigint, bm_gloss_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  SELECT p.id, coalesce(c.gloss_id, c.bm_gloss_id),
         p.source_entity_type, p.source_entity_id, public.d10_synonym_entity_lemma_v1(p.source_entity_type, p.source_entity_id),
         nullif(btrim(c.naob_gloss), ''),
         p.target_entity_type, p.target_entity_id, public.d10_synonym_entity_lemma_v1(p.target_entity_type, p.target_entity_id),
         public.d10_synonym_target_sense_v1(p.verification_evidence, p.snapshot),
         p.decision, p.verifier_version, p.verification_evidence->>'reason',
         CASE WHEN coalesce(c.source_sense_anchor, '') LIKE 'sib:%'
              THEN CASE WHEN c.verification_evidence->>'source_article_id' ~ '^\d+$' THEN (c.verification_evidence->>'source_article_id')::bigint END
              ELSE (SELECT g.article_id FROM public.synonym_bm_gloss_v1 g WHERE g.id = c.bm_gloss_id) END,
         CASE WHEN p.snapshot->'target'->>'article_id' ~ '^\d+$' THEN (p.snapshot->'target'->>'article_id')::bigint END,
         c.bm_gloss_id
  FROM public.synonym_pair_v1 p
  JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
  WHERE p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym');
$fn$;

DROP FUNCTION public.get_synonym_carousel_v2(uuid);
CREATE FUNCTION public.get_synonym_carousel_v2(p_lexeme_id uuid)
RETURNS TABLE (card_id uuid, lemma text, pos text, decision text, level text, target_entity_type text,
               target_entity_id uuid, my_sense text, my_sense_key text, my_sense_uk text, my_sense_en text,
               their_sense text, their_sense_uk text, their_sense_en text, reason text,
               my_sense_path text, my_sense_ord integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  WITH me AS (
    SELECT 'lexeme'::text AS t, p_lexeme_id AS i WHERE p_lexeme_id IS NOT NULL
    UNION SELECT 'expression', x.id FROM public.expression_catalog x WHERE p_lexeme_id IS NOT NULL AND x.lexeme_id = p_lexeme_id
  ), rel AS (   -- the same links as the badge (lexemes.synonyms)
    SELECT r.* FROM public.authoritative_semantic_relations r JOIN me ON me.t = r.source_entity_type AND me.i = r.source_entity_id
    WHERE r.relation_type = 'synonym' AND (NOT public.d10_synonym_publication_on_v1() OR r.status = 'verified')
  ), sides AS (SELECT * FROM public.d10_synonym_pair_sides_v1()),
  info AS (   -- every pair behind a link: one row per pair (a synonym of two senses gives two rows)
    SELECT r.target_text, r.target_entity_type, r.target_entity_id, r.relation_class,
           CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.head_sense ELSE x.target_sense END AS my_s,
           CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.head_lemma ELSE x.target_lemma END AS my_l,
           CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.head_article ELSE x.target_article END AS my_art,
           CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.target_sense ELSE x.head_sense END AS their_s,
           CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.target_lemma ELSE x.head_lemma END AS their_l,
           x.verifier_version AS vv, x.reason AS why, x.decision AS pair_decision
    FROM rel r
    LEFT JOIN sides x
      ON (x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id AND x.target_type = r.target_entity_type AND x.target_id = r.target_entity_id)
      OR (x.target_type = r.source_entity_type AND x.target_id = r.source_entity_id AND x.head_type = r.target_entity_type AND x.head_id = r.target_entity_id)
  )
  SELECT DISTINCT ON (coalesce(card.cid::text, lower(i.target_text)), coalesce(public.d10_synonym_sense_key_v1(i.my_l, i.my_s), ''))
    card.cid, i.target_text,
    coalesce(l.pos, CASE WHEN i.target_entity_type = 'expression' THEN 'expression' END),
    coalesce(i.pair_decision, i.relation_class),
    CASE WHEN i.vv LIKE 'rule:%' THEN 'dictionary' ELSE 'ai' END,
    i.target_entity_type, i.target_entity_id,
    i.my_s, public.d10_synonym_sense_key_v1(i.my_l, i.my_s), ml.uk, ml.en,
    i.their_s, tl.uk, tl.en, i.why,
    sp.sense_path, sp.def_ord
  FROM info i
  CROSS JOIN LATERAL (SELECT CASE WHEN i.target_entity_type = 'lexeme' THEN i.target_entity_id
                                  ELSE (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id = i.target_entity_id) END AS cid) card
  LEFT JOIN public.lexemes l ON l.id = card.cid
  LEFT JOIN public.synonym_sense_label_v1 ml ON ml.sense_key = public.d10_synonym_sense_key_v1(i.my_l, i.my_s) AND ml.status = 'done'
  LEFT JOIN public.synonym_sense_label_v1 tl ON tl.sense_key = public.d10_synonym_sense_key_v1(i.their_l, i.their_s) AND tl.status = 'done'
  LEFT JOIN LATERAL public.d10_synonym_sense_path_v1(i.my_art, i.my_s) sp ON true
  WHERE card.cid IS DISTINCT FROM p_lexeme_id
  ORDER BY coalesce(card.cid::text, lower(i.target_text)), coalesce(public.d10_synonym_sense_key_v1(i.my_l, i.my_s), ''),
           (i.pair_decision = 'verified_synonym') DESC;
$fn$;

REVOKE ALL ON FUNCTION public.d10_synonym_reverify_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_ordbokene_explanation_paths_v1(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_sense_path_v1(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_pair_sides_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_synonym_carousel_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_synonym_reverify_v2() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_ordbokene_explanation_paths_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_sense_path_v1(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_pair_sides_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v2(uuid) TO authenticated, service_role;

-- now: AI pairs to the v4 check, sibling candidates from every gloss item
SELECT public.d10_synonym_reverify_v2() AS reverify;
SELECT public.d10_synonym_publish_siblings_all_v1() AS siblings;

COMMIT;

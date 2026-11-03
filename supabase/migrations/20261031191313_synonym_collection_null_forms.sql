BEGIN;
CREATE OR REPLACE FUNCTION public.d10_synonym_bm_terms_v1(p_text text, p_lemma text, p_forms text[])
 RETURNS TABLE(term text, ord integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  WITH g AS (
    SELECT btrim(p_text) AS t
    WHERE btrim(coalesce(p_text, '')) <> ''
      AND p_text !~* '^\s*(motsatt|ikke|brukt|om |i |som |se |jf|særlig|især|til |for |med |av |på )'
      AND p_text !~ '[():"«»\[\]!?]'
  ), parts AS (
    SELECT lower(btrim(split_part(p.part, ' / ', 1))) AS w, p.n::integer AS n
    FROM g CROSS JOIN LATERAL regexp_split_to_table(g.t, '\s*[,;]\s*') WITH ORDINALITY p(part, n)
  )
  SELECT p.w, p.n FROM parts p
  -- the whole item must be a list of short words, at most 8
  WHERE NOT EXISTS (SELECT 1 FROM parts q WHERE q.w !~ '^[[:alpha:]-]+( [[:alpha:]-]+){0,2}$')
    AND (SELECT count(*) FROM parts) <= 8
    AND p.w <> lower(btrim(p_lemma))
    AND p.w <> lower(btrim(p_lemma)) || 's'
    AND NOT (p.w = ANY (array_remove(coalesce(p_forms, '{}'::text[]),NULL)));
$function$
;
CREATE OR REPLACE FUNCTION public.d10_synonym_bm_collect_lexeme_v1(p_lexeme_id uuid, p_job_id uuid, p_depth integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  l record;
  v_run uuid:=gen_random_uuid();
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
    IF v_payload IS NULL OR jsonb_typeof(v_payload->'body'->'definitions') IS DISTINCT FROM 'array' THEN v_missing := v_missing || v_art; CONTINUE; END IF;
    SELECT coalesce(array_agg(DISTINCT lower(f #>> '{}')), '{}') INTO v_forms
    FROM jsonb_path_query(v_payload, 'lax $.lemmas[*].paradigm_info[*].inflection[*].word_form') f
    WHERE nullif(btrim(f #>> '{}'),'') IS NOT NULL;

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

      INSERT INTO public.synonym_candidate_queue AS c (
        last_seen_collection, bm_gloss_id, pipeline_version, source_entity_type, source_entity_id,
        source_sense_anchor, naob_slug, naob_gloss, context_label,
        target_text, target_kind, expected_pos, origin_depth, stage1_status,
        synonym_group_key, root_synonym_lemma, source_job_id, dispatch_status, verification_evidence)
      SELECT v_run, v_gloss, v_version, 'lexeme', p_lexeme_id,
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
      DO UPDATE SET source_active=true,last_seen_collection=EXCLUDED.last_seen_collection,
       naob_gloss=EXCLUDED.naob_gloss,context_label=EXCLUDED.context_label,expected_pos=EXCLUDED.expected_pos,
       source_job_id=EXCLUDED.source_job_id,origin_depth=least(c.origin_depth,EXCLUDED.origin_depth),
       dispatch_status=CASE WHEN NOT c.source_active OR (c.dispatch_status='deferred_depth' AND EXCLUDED.origin_depth=0)
         THEN EXCLUDED.dispatch_status ELSE c.dispatch_status END,updated_at=now();
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

  IF cardinality(v_missing)=0 AND cardinality(v_arts)>0 THEN
    UPDATE public.synonym_candidate_queue SET source_active=false,updated_at=now()
    WHERE source_entity_type='lexeme' AND source_entity_id=p_lexeme_id AND bm_gloss_id IS NOT NULL
      AND coalesce(source_sense_anchor,'') NOT LIKE 'sib:%' AND pipeline_version=v_version
      AND last_seen_collection IS DISTINCT FROM v_run AND source_active;
  END IF;
  INSERT INTO private.synonym_collection_state_v1(entity_type,entity_id,job_id,status,reason)
  VALUES('lexeme',p_lexeme_id,p_job_id,
    CASE WHEN cardinality(v_missing)>0 THEN 'waiting' WHEN cardinality(v_arts)=0 THEN 'error' ELSE 'complete' END,
    CASE WHEN cardinality(v_missing)>0 THEN 'article_missing' WHEN cardinality(v_arts)=0 THEN 'no_article'
         WHEN v_cands=0 THEN 'no_candidates_in_source' ELSE 'candidates_collected' END)
  ON CONFLICT(entity_type,entity_id) DO UPDATE SET job_id=EXCLUDED.job_id,status=EXCLUDED.status,
    reason=EXCLUDED.reason,checked_at=now();
  RETURN jsonb_build_object('ok', true, 'articles', cardinality(v_arts), 'missing', to_jsonb(v_missing),
    'glosses', v_glosses, 'candidates', v_cands);
END
$function$
;
CREATE OR REPLACE FUNCTION public.d10_ordbokene_explanations_v1(p_payload jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_out text[] := '{}';
  v_stack jsonb[] := ARRAY[coalesce(p_payload->'body'->'definitions', '[]'::jsonb)];
  v_node jsonb;
  v_child jsonb;
  v_parts text[];
  v_text text;
  v_item jsonb;
  v_i integer;
  v_guard integer := 0;
BEGIN
  WHILE array_length(v_stack, 1) > 0 AND v_guard < 2000 LOOP
    v_guard := v_guard + 1;
    v_node := v_stack[array_length(v_stack, 1)];
    v_stack := v_stack[1:array_length(v_stack, 1) - 1];
    IF jsonb_typeof(v_node) = 'array' THEN
      -- push in reverse so the first element is visited first
      FOR v_i IN REVERSE jsonb_array_length(v_node) - 1 .. 0 LOOP
        v_stack := v_stack || (v_node -> v_i);
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
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' IN ('jf','jfr') THEN 'jf.'
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' = 'se' THEN 'se'
          ELSE '' END || v_parts[v_i];
      END LOOP;
      v_text := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
      IF v_text <> '' AND NOT (v_text = ANY (v_out)) AND coalesce(array_length(v_out, 1), 0) < 12 THEN
        v_out := v_out || v_text;
      END IF;
      CONTINUE;
    END IF;
    IF v_node->>'type_' = 'example' THEN CONTINUE; END IF;
    v_child := coalesce(v_node->'elements', v_node->'definitions');
    IF v_child IS NOT NULL THEN v_stack := v_stack || v_child; END IF;
  END LOOP;
  RETURN v_out;
END
$function$
;
CREATE OR REPLACE FUNCTION public.d10_ordbokene_explanation_paths_v1(p_payload jsonb)
 RETURNS TABLE(sense_path text, def_ord integer, txt text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
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
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' IN ('jf','jfr') THEN 'jf.'
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' = 'se' THEN 'se'
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
$function$
;
CREATE OR REPLACE FUNCTION public.d10_synonym_collection_event_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
 INSERT INTO private.synonym_collection_events_v1(entity_type,entity_id,job_id,status,reason,checked_at,evidence)
 VALUES(NEW.entity_type,NEW.entity_id,NEW.job_id,NEW.status,NEW.reason,NEW.checked_at,
 jsonb_build_object('pipeline_version',(SELECT pipeline_version FROM public.synonym_pipeline_config WHERE singleton),
 'collector_version','lifecycle-v2',
 'source',CASE WHEN NEW.entity_type='lexeme' THEN 'Bokmaalsordboka' ELSE 'NAOB' END,
 'collection',CASE WHEN NEW.entity_type='lexeme' THEN
   (SELECT to_jsonb(w) FROM public.synonym_bm_word_v1 w WHERE lexeme_id=NEW.entity_id) ELSE NULL END,
 'source_evidence',CASE WHEN NEW.entity_type='lexeme' THEN
 (SELECT jsonb_agg(jsonb_build_object('article_id',k.article_id,'updated_at',k.updated_at,
   'payload_hash',md5(k.payload::text),'definitions',public.d10_ordbokene_explanations_v1(k.payload)))
  FROM public.ordbokene_article_cache k WHERE lower(k.dictionary_code)='bm'
   AND k.article_id=ANY(public.d10_lexeme_article_ids_v1(NEW.entity_id)))
 ELSE (SELECT jsonb_agg(jsonb_build_object('gloss_id',g.id,'slug',g.naob_slug,'anchor',g.anchor_id,
   'type',g.gloss_type,'text',g.gloss_text,'context',g.context_label,'extractor_version',g.extractor_version))
  FROM public.naob_expression_glosses g JOIN public.expression_catalog x ON x.id=NEW.entity_id AND x.normalized_key=g.normalized_key) END,
 'active_candidates',(SELECT count(*) FROM public.synonym_candidate_queue c WHERE c.source_active
   AND c.source_entity_type=NEW.entity_type AND c.source_entity_id=NEW.entity_id)));
 RETURN NEW;
END $function$
;
COMMIT;

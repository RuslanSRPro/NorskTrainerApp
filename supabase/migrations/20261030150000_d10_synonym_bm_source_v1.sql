-- D10_synonym_bm_source_v1 (30.10.2026, agreed in chat: synonyms of ordinary words from Bokmålsordboka,
-- new cards for missing synonyms with the existing limits, new words after every analysis + the whole
-- base step by step).
--
-- Source: a gloss item of a word's Bokmålsordboka article that is only a list of words
--   snakke: "prate, samtale"   rask: "hurtig, kvikk"   stor: "diger, dryg, svær"
-- Not taken: "motsatt …", "ikke …", "brukt …" and other descriptions, items with brackets, phrases
-- longer than 3 words, forms of the word itself (større, størst, snakkes), phrases of 2-3 words that are
-- not in the expression catalog.
-- Each item -> public.synonym_bm_gloss_v1 -> candidates in synonym_candidate_queue (column bm_gloss_id;
-- naob_gloss holds the item text, naob_slug = 'bm:<article>') -> the existing chain: dispatch (unknown
-- word -> resolver -> child job with the card, 50 jobs / day), prepare, synonym-verifier
-- (mutual reference -> rule, no AI), publication, rule "one gloss item".
--
-- When:
--   1. after every job (d10_synonym_after_job_v1 + one call; the rest of it unchanged);
--   2. pg_cron 'd10-synonym-bm-tick' every 5 min: the whole base step by step
--      (synonym_bm_config_v1: 10 words a tick, 100 words / 24 h); articles that are not cached yet are
--      fetched with ordbokene-article-fetcher (pg_net, as call_pipeline_supervisor); the verifier is woken
--      when pairs wait.
-- Off: update public.synonym_bm_config_v1 set enabled = false;
--
-- Changed existing objects (md5-guarded): d10_synonym_after_job_v1 (+ call), the source check of
-- synonym_candidate_queue (+ bm_gloss_id), d10_synonym_publish_siblings_v1 / _trg_v1 / _all_v1
-- (NAOB or Bokmålsordboka item).
BEGIN;
SET LOCAL lock_timeout = '5s';

-- md5 of the function text without \r (installed from Windows the text has CRLF line ends)
DO $pre$
DECLARE v_n integer;
BEGIN
  IF to_regclass('public.synonym_bm_gloss_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_bm_source_v1 is already installed; nothing changed';
  END IF;
  IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.d10_synonym_after_job_v1(uuid)'::regprocedure)
     IS DISTINCT FROM '15f567b9984bfc35b12c32ddfe186a60' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_after_job_v1 differs from the version this package was built on; nothing changed';
  END IF;
  IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.d10_synonym_publish_siblings_v1(uuid)'::regprocedure)
     IS DISTINCT FROM 'b9f740d96761bd1f9cf50ce7a7761ca6'
  OR (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.d10_synonym_siblings_trg_v1()'::regprocedure)
     IS DISTINCT FROM 'ab2c4af3283c8f5c280c9de23c132191'
  OR (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.d10_synonym_publish_siblings_all_v1()'::regprocedure)
     IS DISTINCT FROM '3dfa34802c66f8daa5d824017936a30e' THEN
    RAISE EXCEPTION 'STOP: D10_synonym_same_gloss_v1 functions differ from the installed version; nothing changed';
  END IF;
  SELECT count(*) INTO v_n FROM pg_constraint
  WHERE conrelid = 'public.synonym_candidate_queue'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ~ 'relation_id IS NOT NULL' AND pg_get_constraintdef(oid) ~ 'gloss_id IS NOT NULL';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'STOP: the source check of synonym_candidate_queue was not found exactly once (%); nothing changed', v_n;
  END IF;
  IF to_regprocedure('public.d10_lexeme_article_ids_v1(uuid)') IS NULL
     OR to_regprocedure('public.d10_ordbokene_explanations_v1(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STOP: d10_lexeme_article_ids_v1 / d10_ordbokene_explanations_v1 missing; nothing changed';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.synonym_bm_gloss_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lexeme_id uuid NOT NULL,
  article_id bigint NOT NULL,
  gloss_text text NOT NULL,
  terms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, gloss_text)
);
CREATE INDEX synonym_bm_gloss_lexeme_idx ON public.synonym_bm_gloss_v1 (lexeme_id);

-- every word the source has looked at
CREATE TABLE public.synonym_bm_word_v1 (
  lexeme_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('done', 'waiting_article', 'no_article', 'skipped')),
  missing_articles bigint[] NOT NULL DEFAULT '{}',
  glosses integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  fetch_requested_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonym_bm_word_status_idx ON public.synonym_bm_word_v1 (status, processed_at);

CREATE TABLE public.synonym_bm_config_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  words_per_tick integer NOT NULL DEFAULT 10 CHECK (words_per_tick BETWEEN 1 AND 100),
  daily_word_limit integer NOT NULL DEFAULT 100 CHECK (daily_word_limit BETWEEN 0 AND 5000),
  fetches_per_tick integer NOT NULL DEFAULT 20 CHECK (fetches_per_tick BETWEEN 0 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.synonym_bm_config_v1 (singleton) VALUES (true);

ALTER TABLE public.synonym_bm_gloss_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synonym_bm_word_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synonym_bm_config_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_bm_gloss_v1, public.synonym_bm_word_v1, public.synonym_bm_config_v1 FROM PUBLIC, anon, authenticated;

-- candidates: a third kind of source
ALTER TABLE public.synonym_candidate_queue ADD COLUMN bm_gloss_id uuid
  REFERENCES public.synonym_bm_gloss_v1(id) ON DELETE RESTRICT;
DO $chk$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name FROM pg_constraint
  WHERE conrelid = 'public.synonym_candidate_queue'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ~ 'relation_id IS NOT NULL' AND pg_get_constraintdef(oid) ~ 'gloss_id IS NOT NULL';
  EXECUTE format('ALTER TABLE public.synonym_candidate_queue DROP CONSTRAINT %I', v_name);
END
$chk$;
ALTER TABLE public.synonym_candidate_queue ADD CONSTRAINT synonym_candidate_queue_source_check
  CHECK (relation_id IS NOT NULL OR gloss_id IS NOT NULL OR bm_gloss_id IS NOT NULL);
CREATE UNIQUE INDEX synonym_candidate_bm_gloss_target_uidx ON public.synonym_candidate_queue
  (bm_gloss_id, lower(btrim(target_text)), pipeline_version) WHERE bm_gloss_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Which words of a gloss item are synonym candidates
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.d10_synonym_bm_terms_v1(p_text text, p_lemma text, p_forms text[])
RETURNS TABLE (term text, ord integer)
LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
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
    AND NOT (p.w = ANY (coalesce(p_forms, '{}'::text[])));
$fn$;

-- ---------------------------------------------------------------------------
-- 3. One word: its cached articles -> gloss items -> candidates
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.d10_synonym_bm_collect_lexeme_v1(p_lexeme_id uuid, p_job_id uuid, p_depth integer DEFAULT 0)
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

    FOREACH v_expl IN ARRAY coalesce(public.d10_ordbokene_explanations_v1(v_payload), '{}'::text[]) LOOP
      -- single words; 2-3 words only when the expression is in the catalog
      SELECT coalesce(array_agg(t.term ORDER BY t.ord), '{}') INTO v_terms
      FROM public.d10_synonym_bm_terms_v1(v_expl, l.lemma, v_forms) t
      WHERE t.term !~ ' ' OR EXISTS (SELECT 1 FROM public.expression_catalog x WHERE x.normalized_key = t.term);
      CONTINUE WHEN coalesce(array_length(v_terms, 1), 0) = 0;

      INSERT INTO public.synonym_bm_gloss_v1 AS g (lexeme_id, article_id, gloss_text, terms)
      VALUES (p_lexeme_id, v_art, v_expl, v_terms)
      ON CONFLICT (article_id, gloss_text) DO UPDATE SET terms = EXCLUDED.terms, updated_at = now()
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

-- the words of a job (called by d10_synonym_after_job_v1)
CREATE FUNCTION public.d10_synonym_bm_collect_job_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private' AS $fn$
DECLARE
  v_depth integer;
  r record;
  v jsonb;
  v_words integer := 0;
  v_cands integer := 0;
  v_waiting integer := 0;
BEGIN
  IF NOT coalesce((SELECT enabled FROM public.synonym_bm_config_v1 WHERE singleton), false) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;
  SELECT CASE WHEN j.input_type = 'synonym_candidate' THEN 1 ELSE 0 END INTO v_depth
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id;
  IF v_depth IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'JOB_NOT_FOUND'); END IF;
  FOR r IN SELECT DISTINCT i.lexeme_id FROM public.lexeme_processing_items i
           JOIN public.lexemes l ON l.id = i.lexeme_id
           WHERE i.job_id = p_job_id AND l.pos IN ('verb', 'noun', 'adjective', 'adverb')
           LIMIT 300
  LOOP
    v := public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id, p_job_id, v_depth);
    v_words := v_words + 1;
    v_cands := v_cands + coalesce((v->>'candidates')::integer, 0);
    IF jsonb_array_length(coalesce(v->'missing', '[]'::jsonb)) > 0 THEN v_waiting := v_waiting + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'words', v_words, 'candidates', v_cands, 'waiting_article', v_waiting);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 4. pg_net helpers (same way as call_pipeline_supervisor)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.d10_synonym_bm_call_edge_v1(p_function text, p_body jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE k text;
BEGIN
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN RETURN false; END IF;
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF k IS NULL THEN RETURN false; END IF;
  PERFORM net.http_post(
    url := 'https://kevpkawrbtovrgyjkkvu.supabase.co/functions/v1/' || p_function,
    headers := jsonb_build_object('apikey', k, 'Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := p_body,
    timeout_milliseconds := 60000);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'd10_synonym_bm_call_edge_v1(%): %', p_function, SQLERRM;
  RETURN false;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 5. The tick (pg_cron every 5 min): waiting words, fetches, the base step by step,
--    dispatch, prepare, wake the verifier
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.d10_synonym_bm_tick_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private' AS $fn$
DECLARE
  v_cfg public.synonym_bm_config_v1%rowtype;
  r record;
  v jsonb;
  v_left integer;
  v_words integer := 0;
  v_cands integer := 0;
  v_fetch integer := 0;
  v_prepared integer := 0;
  v_dispatch jsonb := '{}'::jsonb;
  v_woke boolean := false;
  v_art bigint;
BEGIN
  SELECT * INTO v_cfg FROM public.synonym_bm_config_v1 WHERE singleton;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'skipped', 'disabled'); END IF;
  IF NOT pg_try_advisory_xact_lock(20261030, 1) THEN RETURN jsonb_build_object('ok', true, 'skipped', 'busy'); END IF;

  -- a) words that waited for an article: again once the fetch had time (or give up after 3 tries)
  FOR r IN SELECT w.lexeme_id FROM public.synonym_bm_word_v1 w
           WHERE w.status = 'waiting_article' AND w.fetch_requested_at < now() - interval '2 minutes'
           ORDER BY w.fetch_requested_at LIMIT v_cfg.words_per_tick
  LOOP
    v := public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id,
      (SELECT i.job_id FROM public.lexeme_processing_items i JOIN public.lexeme_processing_jobs j ON j.id = i.job_id
       WHERE i.lexeme_id = r.lexeme_id ORDER BY j.created_at DESC LIMIT 1), 0);
    v_cands := v_cands + coalesce((v->>'candidates')::integer, 0);
    UPDATE public.synonym_bm_word_v1 SET status = 'skipped'
    WHERE lexeme_id = r.lexeme_id AND status = 'waiting_article' AND attempts >= 4;
  END LOOP;

  -- b) the base step by step: words never looked at (most frequent first), daily limit
  SELECT greatest(0, v_cfg.daily_word_limit - count(*)) INTO v_left
  FROM public.synonym_bm_word_v1 w WHERE w.processed_at > now() - interval '24 hours' AND w.attempts = 1;
  FOR r IN SELECT l.id, (SELECT i.job_id FROM public.lexeme_processing_items i
                         JOIN public.lexeme_processing_jobs j ON j.id = i.job_id
                         WHERE i.lexeme_id = l.id ORDER BY j.created_at DESC LIMIT 1) AS job_id
           FROM public.lexemes l
           WHERE l.pos IN ('verb', 'noun', 'adjective', 'adverb')
             AND coalesce(l.dictionary_status, 'active') = 'active'
             AND NOT EXISTS (SELECT 1 FROM public.synonym_bm_word_v1 w WHERE w.lexeme_id = l.id)
             AND EXISTS (SELECT 1 FROM public.lexeme_processing_items i WHERE i.lexeme_id = l.id)
           ORDER BY l.frequency_rank NULLS LAST, l.created_at
           LIMIT least(v_cfg.words_per_tick, v_left)
  LOOP
    v := public.d10_synonym_bm_collect_lexeme_v1(r.id, r.job_id, 0);
    v_words := v_words + 1;
    v_cands := v_cands + coalesce((v->>'candidates')::integer, 0);
  END LOOP;

  -- c) fetch the missing articles (ordbokene-article-fetcher saves them to the cache)
  FOR r IN SELECT w.lexeme_id, w.missing_articles FROM public.synonym_bm_word_v1 w
           WHERE w.status = 'waiting_article'
             AND (w.fetch_requested_at IS NULL OR w.fetch_requested_at < now() - interval '1 hour')
           ORDER BY w.processed_at LIMIT v_cfg.fetches_per_tick
  LOOP
    FOREACH v_art IN ARRAY r.missing_articles LOOP
      IF public.d10_synonym_bm_call_edge_v1('ordbokene-article-fetcher',
           jsonb_build_object('article_id', v_art, 'dictionary_code', 'bm')) THEN
        v_fetch := v_fetch + 1;
      END IF;
    END LOOP;
    UPDATE public.synonym_bm_word_v1 SET fetch_requested_at = now() WHERE lexeme_id = r.lexeme_id;
  END LOOP;

  -- d) the existing chain: dispatch new candidates, prepare those whose targets are ready
  IF v_cands > 0 OR EXISTS (SELECT 1 FROM public.synonym_candidate_queue c
                            WHERE c.bm_gloss_id IS NOT NULL AND c.dispatch_status = 'pending') THEN
    BEGIN
      v_dispatch := public.d10_synonym_dispatch_v1(NULL);
    EXCEPTION WHEN OTHERS THEN
      v_dispatch := jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
    END;
  END IF;
  FOR r IN SELECT c.id FROM public.synonym_candidate_queue c
           WHERE c.bm_gloss_id IS NOT NULL AND c.dispatch_status IN ('enrichment_done', 'skipped_ready')
             AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id)
             AND coalesce(c.verification_evidence->'stage_a'->>'prepared_at', '') = ''
           ORDER BY c.created_at LIMIT 200
  LOOP
    BEGIN
      PERFORM public.d10_synonym_prepare_candidate_v1(r.id, false);
      v_prepared := v_prepared + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'd10_synonym_bm_tick_v1: prepare % failed: %', r.id, SQLERRM;
    END;
  END LOOP;

  -- e) pairs or resolutions wait: wake synonym-verifier (it answers at once, works in the background)
  IF coalesce(public.d10_synonym_verifier_pending_v1(), 0) > 0 THEN
    v_woke := public.d10_synonym_bm_call_edge_v1('synonym-verifier', jsonb_build_object('reason', 'bm_tick'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_words', v_words, 'candidates', v_cands, 'fetches', v_fetch,
    'prepared', v_prepared, 'dispatch', v_dispatch, 'verifier_woken', v_woke);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 6. After every job: + Bokmålsordboka collect (the rest unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_after_job_v1(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_job public.lexeme_processing_jobs%rowtype;
  v_collected integer := 0;
  v_done integer := 0;
  v_deferred integer := 0;
  v_cleared integer := 0;
  v_dispatch jsonb := '{}'::jsonb;
  v_pairs jsonb := '{}'::jsonb;
  v_bm jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_job FROM public.lexeme_processing_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'JOB_NOT_FOUND'); END IF;

  v_collected := public.d10_synonym_collect_job_v1(p_job_id);
  -- D10 30.10.2026 (agreed): synonyms of ordinary words from Bokmålsordboka
  -- (gloss items that are a list of words); never breaks the job
  BEGIN
    v_bm := public.d10_synonym_bm_collect_job_v1(p_job_id);
  EXCEPTION WHEN OTHERS THEN
    v_bm := jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
  END;

  IF v_job.input_type = 'synonym_candidate' THEN
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'enrichment_done',
      enrichment_done_at = now(),
      target_entity_ids = public.d10_synonym_target_entities_v1(lower(btrim(c.target_text)), c.target_kind),
      updated_at = now()
    WHERE c.child_job_id = p_job_id AND c.dispatch_status = 'in_child_job';
    GET DIAGNOSTICS v_done = ROW_COUNT;
    -- cards CREATED by this child job: no family 360, no own synonyms yet
    INSERT INTO private.d10_deferred_enrichment_v1 (lexeme_id, facets, reason, job_id)
    SELECT DISTINCT i.lexeme_id, ARRAY['family_360','synonyms'], 'synonym_child_job', p_job_id
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id
    WHERE i.job_id = p_job_id AND i.lexeme_id IS NOT NULL AND l.created_at >= v_job.created_at
    ON CONFLICT (lexeme_id) DO NOTHING;
    GET DIAGNOSTICS v_deferred = ROW_COUNT;
  ELSE
    -- a normal job processes everything (family 360 included)
    DELETE FROM private.d10_deferred_enrichment_v1 d
    USING public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.lexeme_id = d.lexeme_id;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
  END IF;

  v_dispatch := public.d10_synonym_dispatch_v1(p_job_id);

  -- D10 28.10.2026 (stage A): pairs for verification; never breaks the job
  BEGIN
    v_pairs := public.d10_synonym_prepare_for_job_v1(p_job_id);
  EXCEPTION WHEN OTHERS THEN
    v_pairs := jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
  END;

  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'enrichment_done', v_done,
    'deferred_marked', v_deferred, 'deferred_cleared', v_cleared, 'dispatch', v_dispatch, 'pairs', v_pairs,
    'bm', v_bm);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
END
$function$;

-- ---------------------------------------------------------------------------
-- 7. Rule "one gloss item": NAOB or Bokmålsordboka item (only the gloss lookup changed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_publish_siblings_v1(p_gloss_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE
  v_key text := p_gloss_id::text;
  v_added integer := 0;
  v_removed integer := 0;
  r record;
BEGIN
  IF p_gloss_id IS NULL OR NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS d10_sib_want (st text, si uuid, tt text, ti uuid, tlemma text, decision text) ON COMMIT DROP;
  TRUNCATE d10_sib_want;

  -- published targets of this gloss (one row per target card)
  INSERT INTO d10_sib_want
  WITH t AS (
    SELECT p.target_entity_type tt, p.target_entity_id ti,
           bool_or(p.decision = 'verified_synonym') AS verified
    FROM public.synonym_pair_v1 p
    JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
    WHERE coalesce(c.gloss_id, c.bm_gloss_id) = p_gloss_id  -- D10 30.10.2026: NAOB or Bokmålsordboka item
      AND p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')
    GROUP BY 1, 2
  )
  SELECT a.tt, a.ti, b.tt, b.ti, public.d10_synonym_entity_lemma_v1(b.tt, b.ti),
         CASE WHEN a.verified AND b.verified THEN 'verified_synonym' ELSE 'contextual_synonym' END
  FROM t a JOIN t b ON (a.tt, a.ti) <> (b.tt, b.ti)
  WHERE public.d10_synonym_entity_lemma_v1(a.tt, a.ti) IS NOT NULL
    AND public.d10_synonym_entity_lemma_v1(b.tt, b.ti) IS NOT NULL
    -- the verifier already links them: no second link
    AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations v
                    WHERE v.relation_type = 'synonym' AND v.source = 'synonym-verifier'
                      AND ((v.source_entity_type = a.tt AND v.source_entity_id = a.ti
                            AND v.target_entity_type = b.tt AND v.target_entity_id = b.ti)
                        OR (v.source_entity_type = b.tt AND v.source_entity_id = b.ti
                            AND v.target_entity_type = a.tt AND v.target_entity_id = a.ti)));

  -- this gloss no longer supports a link: drop the gloss from it; no gloss left -> delete
  FOR r IN SELECT x.id, x.verification_evidence FROM public.authoritative_semantic_relations x
           WHERE x.source = 'synonym-same-gloss' AND x.relation_type = 'synonym'
             AND x.verification_evidence->'gloss_ids' ? v_key
             AND NOT EXISTS (SELECT 1 FROM d10_sib_want w WHERE w.st = x.source_entity_type AND w.si = x.source_entity_id
                               AND w.tt = x.target_entity_type AND w.ti = x.target_entity_id)
  LOOP
    IF jsonb_array_length(r.verification_evidence->'gloss_ids') <= 1 THEN
      DELETE FROM public.authoritative_semantic_relations WHERE id = r.id;
    ELSE
      UPDATE public.authoritative_semantic_relations
      SET verification_evidence = jsonb_set(verification_evidence, '{gloss_ids}', (verification_evidence->'gloss_ids') - v_key),
          updated_at = now()
      WHERE id = r.id;
    END IF;
    v_removed := v_removed + 1;
  END LOOP;

  -- add / refresh
  INSERT INTO public.authoritative_semantic_relations AS x (source_entity_type, source_entity_id, relation_type, target_text,
    source, confidence, status, evidence, target_entity_type, target_entity_id, relation_class, recognition_level,
    verification_evidence, verified_at, verifier_version)
  SELECT w.st, w.si, 'synonym', w.tlemma, 'synonym-same-gloss',
    CASE WHEN w.decision = 'verified_synonym' THEN 'high' ELSE 'medium' END, 'verified',
    jsonb_build_object('published_by', 'd10_synonym_publish_siblings_v1'), w.tt, w.ti, w.decision, 'rule',
    jsonb_build_object('gloss_ids', jsonb_build_array(v_key), 'rule', 'same_gloss_item'), now(), 'rule:same_gloss_v1'
  FROM d10_sib_want w
  ON CONFLICT (source_entity_type, source_entity_id, relation_type, target_text, source) DO UPDATE SET
    status = 'verified', target_entity_type = EXCLUDED.target_entity_type, target_entity_id = EXCLUDED.target_entity_id,
    -- several glosses: verified when any of them says verified
    relation_class = CASE WHEN x.relation_class = 'verified_synonym' AND x.verification_evidence->'gloss_ids' <> jsonb_build_array(v_key)
                          THEN 'verified_synonym' ELSE EXCLUDED.relation_class END,
    confidence = CASE WHEN x.relation_class = 'verified_synonym' AND x.verification_evidence->'gloss_ids' <> jsonb_build_array(v_key)
                      THEN 'high' ELSE EXCLUDED.confidence END,
    verification_evidence = jsonb_set(x.verification_evidence, '{gloss_ids}',
      CASE WHEN x.verification_evidence->'gloss_ids' ? v_key THEN x.verification_evidence->'gloss_ids'
           ELSE coalesce(x.verification_evidence->'gloss_ids', '[]'::jsonb) || jsonb_build_array(v_key) END),
    verified_at = now(), updated_at = now()
  WHERE x.relation_class IS DISTINCT FROM EXCLUDED.relation_class OR NOT (x.verification_evidence->'gloss_ids' ? v_key)
     OR x.status <> 'verified';
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'gloss_id', p_gloss_id, 'links_written', v_added, 'links_removed', v_removed);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_siblings_trg_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_gloss uuid;
BEGIN
  IF public.d10_synonym_publication_on_v1() THEN
    SELECT coalesce(c.gloss_id, c.bm_gloss_id) INTO v_gloss FROM public.synonym_candidate_queue c WHERE c.id = NEW.candidate_id;
    IF v_gloss IS NOT NULL THEN
      PERFORM public.d10_synonym_publish_siblings_v1(v_gloss);
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_publish_siblings_all_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE r record; v jsonb; v_glosses integer := 0; v_written integer := 0; v_removed integer := 0;
BEGIN
  IF NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PUBLICATION_OFF');
  END IF;
  FOR r IN SELECT DISTINCT coalesce(c.gloss_id, c.bm_gloss_id) AS gloss_id FROM public.synonym_pair_v1 p
           JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
           WHERE coalesce(c.gloss_id, c.bm_gloss_id) IS NOT NULL AND p.status = 'done'
  LOOP
    v := public.d10_synonym_publish_siblings_v1(r.gloss_id);
    v_glosses := v_glosses + 1;
    v_written := v_written + coalesce((v->>'links_written')::int, 0);
    v_removed := v_removed + coalesce((v->>'links_removed')::int, 0);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'glosses', v_glosses, 'links_written', v_written, 'links_removed', v_removed);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Rights, schedule
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_synonym_bm_terms_v1(text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_bm_collect_lexeme_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_bm_collect_job_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_bm_call_edge_v1(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_bm_tick_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_bm_terms_v1(text, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_bm_collect_lexeme_v1(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_bm_collect_job_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_bm_tick_v1() TO service_role;

DO $cron$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'd10-synonym-bm-tick';
    PERFORM cron.schedule('d10-synonym-bm-tick', '*/5 * * * *', 'select public.d10_synonym_bm_tick_v1();');
  ELSE
    RAISE WARNING 'pg_cron not found: run select public.d10_synonym_bm_tick_v1(); by hand';
  END IF;
END
$cron$;

COMMIT;

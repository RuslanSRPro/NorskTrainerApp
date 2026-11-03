BEGIN;
ALTER TABLE public.synonym_bm_config_v1 ADD COLUMN after_analysis_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.synonym_bm_word_v1 ADD COLUMN analysis_job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.synonym_bm_config_v1.enabled IS 'Mass collection only; after_analysis_enabled controls completed jobs separately.';
CREATE OR REPLACE FUNCTION public.d10_synonym_bm_collect_job_v1(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_depth integer;
  r record;
  v jsonb;
  v_words integer := 0;
  v_cands integer := 0;
  v_waiting integer := 0;
BEGIN
  IF NOT coalesce((SELECT after_analysis_enabled FROM public.synonym_bm_config_v1 WHERE singleton), false) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;
  SELECT CASE WHEN j.input_type = 'synonym_candidate' THEN 1 ELSE 0 END INTO v_depth
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id;
  IF v_depth IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'JOB_NOT_FOUND'); END IF;
  IF v_depth > 0 THEN RETURN jsonb_build_object('ok',true,'skipped','synonym_child'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lexeme_processing_jobs WHERE id=p_job_id AND status IN ('completed','needs_manual_review')) THEN
    RETURN jsonb_build_object('ok',true,'skipped','job_not_finished');
  END IF;
  FOR r IN SELECT DISTINCT i.lexeme_id FROM public.lexeme_processing_items i
           JOIN public.lexemes l ON l.id = i.lexeme_id
           WHERE i.job_id = p_job_id AND l.pos IN ('verb', 'noun', 'adjective', 'adverb')
           LIMIT 300
  LOOP
    v := public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id, p_job_id, v_depth);
    UPDATE public.synonym_bm_word_v1 SET analysis_job_id=p_job_id WHERE lexeme_id=r.lexeme_id;
    v_words := v_words + 1;
    v_cands := v_cands + coalesce((v->>'candidates')::integer, 0);
    IF jsonb_array_length(coalesce(v->'missing', '[]'::jsonb)) > 0 THEN v_waiting := v_waiting + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'words', v_words, 'candidates', v_cands, 'waiting_article', v_waiting);
END
$function$;

CREATE OR REPLACE FUNCTION public.d10_synonym_bm_retry_analysis_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
DECLARE r record; a bigint; v jsonb; n integer:=0; cfg public.synonym_bm_config_v1%rowtype;
BEGIN
 SELECT * INTO cfg FROM public.synonym_bm_config_v1 WHERE singleton;
 IF NOT coalesce(cfg.after_analysis_enabled,false) THEN RETURN jsonb_build_object('skipped','disabled'); END IF;
 IF NOT pg_try_advisory_xact_lock(20261030,1) THEN RETURN jsonb_build_object('skipped','busy'); END IF;
 FOR r IN SELECT w.* FROM public.synonym_bm_word_v1 w
   JOIN public.lexeme_processing_jobs j ON j.id=w.analysis_job_id
   WHERE w.status='waiting_article' AND w.analysis_job_id IS NOT NULL
     AND j.input_type IS DISTINCT FROM 'synonym_candidate'
     AND j.status IN ('completed','needs_manual_review')
     AND (w.fetch_requested_at IS NULL OR w.fetch_requested_at < now()-interval '2 minutes')
   ORDER BY w.processed_at LIMIT cfg.words_per_tick
 LOOP
   IF r.fetch_requested_at IS NOT NULL THEN
     v:=public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id,r.analysis_job_id,0);
     IF (SELECT status FROM public.synonym_bm_word_v1 WHERE lexeme_id=r.lexeme_id) <> 'waiting_article' THEN
       PERFORM public.d10_synonym_dispatch_v1(r.analysis_job_id);
       PERFORM public.d10_synonym_prepare_for_job_v1(r.analysis_job_id);
       CONTINUE;
     END IF;
     UPDATE public.synonym_bm_word_v1 SET status='skipped'
       WHERE lexeme_id=r.lexeme_id AND attempts>=4;
     IF FOUND THEN CONTINUE; END IF;
   END IF;
   FOR a IN SELECT unnest(missing_articles) FROM public.synonym_bm_word_v1 WHERE lexeme_id=r.lexeme_id LOOP
     PERFORM public.d10_synonym_bm_call_edge_v1('ordbokene-article-fetcher',
       jsonb_build_object('article_id',a,'dictionary_code','bm'));
   END LOOP;
   UPDATE public.synonym_bm_word_v1 SET fetch_requested_at=now() WHERE lexeme_id=r.lexeme_id;
   n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('mode','analysis_only','new_words',0,'article_retries',n);
END $fn$;
REVOKE ALL ON FUNCTION public.d10_synonym_bm_retry_analysis_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_bm_retry_analysis_v1() TO service_role;
CREATE OR REPLACE FUNCTION public.d10_synonym_bm_tick_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'skipped', 'disabled'); END IF;
  IF NOT v_cfg.enabled THEN RETURN public.d10_synonym_bm_retry_analysis_v1(); END IF;
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
$function$;

COMMIT;

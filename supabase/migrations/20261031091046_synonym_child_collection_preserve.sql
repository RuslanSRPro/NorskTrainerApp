BEGIN;
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
 FOR r IN SELECT w.*, CASE WHEN j.input_type='synonym_candidate' THEN 1 ELSE 0 END AS origin_depth FROM public.synonym_bm_word_v1 w
   JOIN public.lexeme_processing_jobs j ON j.id=w.analysis_job_id
   WHERE w.status='waiting_article' AND w.analysis_job_id IS NOT NULL
     AND j.status IN ('completed','needs_manual_review')
     AND (w.fetch_requested_at IS NULL OR w.fetch_requested_at < now()-interval '2 minutes')
   ORDER BY w.processed_at LIMIT cfg.words_per_tick
 LOOP
   IF r.fetch_requested_at IS NOT NULL THEN
     v:=public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id,r.analysis_job_id,r.origin_depth);
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

COMMIT;

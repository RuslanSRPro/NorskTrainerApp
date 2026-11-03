BEGIN;
CREATE TABLE private.synonym_job_retry_v1 (
 job_id uuid PRIMARY KEY REFERENCES public.lexeme_processing_jobs(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'pending',
 next_attempt_at timestamptz NOT NULL DEFAULT now(),last_error text,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status IN ('pending','done','failed'))
);
ALTER TABLE private.synonym_job_retry_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_job_retry_v1 FROM PUBLIC,anon,authenticated;
CREATE INDEX synonym_job_retry_due_idx ON private.synonym_job_retry_v1(next_attempt_at) WHERE status='pending';
CREATE FUNCTION public.d10_synonym_job_error_v1(p_job uuid,p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 INSERT INTO private.synonym_job_retry_v1 AS r(job_id,attempts,status,next_attempt_at,last_error)
 VALUES(p_job,1,'pending',now()+interval '5 minutes',left(p_error,500))
 ON CONFLICT(job_id) DO UPDATE SET attempts=r.attempts+1,
 status=CASE WHEN r.attempts>=2 THEN 'failed' ELSE 'pending' END,
 next_attempt_at=now()+interval '5 minutes',last_error=EXCLUDED.last_error,updated_at=now();
 INSERT INTO private.synonym_collection_state_v1(entity_type,entity_id,job_id,status,reason)
 SELECT DISTINCT CASE WHEN i.expression_id IS NOT NULL THEN 'expression' ELSE 'lexeme' END,
   coalesce(i.expression_id,i.lexeme_id),p_job,'error','collection_failed'
 FROM public.lexeme_processing_items i WHERE i.job_id=p_job AND coalesce(i.expression_id,i.lexeme_id) IS NOT NULL
 ON CONFLICT(entity_type,entity_id) DO UPDATE SET job_id=EXCLUDED.job_id,status='error',reason=EXCLUDED.reason,checked_at=now();
END $f$;
REVOKE ALL ON FUNCTION public.d10_synonym_job_error_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_job_error_v1(uuid,text) TO service_role;

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
    SELECT DISTINCT i.lexeme_id, ARRAY['family_360'], 'synonym_child_job', p_job_id
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id
    WHERE i.job_id = p_job_id AND i.lexeme_id IS NOT NULL AND l.created_at >= v_job.created_at
    ON CONFLICT (lexeme_id) DO NOTHING;
    GET DIAGNOSTICS v_deferred = ROW_COUNT;
  ELSE
    -- a normal job processes everything (family 360 included)
    DELETE FROM private.d10_deferred_enrichment_v1 d
    USING public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.lexeme_id = d.lexeme_id
      AND v_job.status='completed'
      AND EXISTS(SELECT 1 FROM private.synonym_family_completed_v1 f WHERE f.job_id=p_job_id)
      AND NOT EXISTS(SELECT 1 FROM public.pipeline_supervisor_state s WHERE s.job_id=p_job_id
        AND coalesce(s.enrichment_offsets->>'__d10_family_injection_skipped_v1__','0')='1')
      AND EXISTS(SELECT 1 FROM private.d10_job_enrichment_item_state_v1 e
        WHERE e.job_id=p_job_id AND e.item_id=i.id AND e.chain='ordbokene' AND e.status IN ('done','no_data'))
      AND NOT EXISTS(SELECT 1 FROM private.d10_job_enrichment_item_state_v1 e
        WHERE e.job_id=p_job_id AND e.status NOT IN ('done','no_data'));
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
  END IF;

  v_dispatch := public.d10_synonym_dispatch_v1(p_job_id);

  -- D10 28.10.2026 (stage A): pairs for verification; never breaks the job
  BEGIN
    v_pairs := public.d10_synonym_prepare_for_job_v1(p_job_id);
  EXCEPTION WHEN OTHERS THEN
    v_pairs := jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
  END;

  IF v_bm->>'ok'='false' THEN
    PERFORM public.d10_synonym_job_error_v1(p_job_id,v_bm->>'error');
  ELSE
    UPDATE private.synonym_job_retry_v1 SET status='done',last_error=NULL,updated_at=now() WHERE job_id=p_job_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'enrichment_done', v_done,
    'deferred_marked', v_deferred, 'deferred_cleared', v_cleared, 'dispatch', v_dispatch, 'pairs', v_pairs,
    'bm', v_bm);
EXCEPTION WHEN OTHERS THEN
  PERFORM public.d10_synonym_job_error_v1(p_job_id,SQLSTATE || ':' || SQLERRM);
  RETURN jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
END
$function$
;
CREATE OR REPLACE FUNCTION public.d10_synonym_bm_retry_analysis_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
     IF FOUND THEN
       UPDATE private.synonym_collection_state_v1 SET status='error',reason='article_fetch_exhausted',checked_at=now()
       WHERE entity_type='lexeme' AND entity_id=r.lexeme_id;
       CONTINUE;
     END IF;
   END IF;
   FOR a IN SELECT unnest(missing_articles) FROM public.synonym_bm_word_v1 WHERE lexeme_id=r.lexeme_id LOOP
     PERFORM public.d10_synonym_bm_call_edge_v1('ordbokene-article-fetcher',
       jsonb_build_object('article_id',a,'dictionary_code','bm'));
   END LOOP;
   UPDATE public.synonym_bm_word_v1 SET fetch_requested_at=now() WHERE lexeme_id=r.lexeme_id;
   n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('mode','analysis_only','new_words',0,'article_retries',n);
END $function$
;
CREATE OR REPLACE FUNCTION public.d10_synonym_maintenance_v1() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; v jsonb; fetched integer:=0; prepared jsonb; woke boolean:=false;
BEGIN
 IF NOT coalesce((SELECT after_analysis_enabled FROM public.synonym_bm_config_v1 WHERE singleton),false) THEN
  RETURN jsonb_build_object('skipped','disabled');
 END IF;
 IF NOT pg_try_advisory_xact_lock(20261031,2) THEN RETURN jsonb_build_object('skipped','busy'); END IF;
 FOR r IN SELECT job_id FROM private.synonym_job_retry_v1
    WHERE status='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 5 FOR UPDATE SKIP LOCKED
 LOOP
   PERFORM public.d10_synonym_after_job_v1(r.job_id);
 END LOOP;
 v:=public.d10_synonym_bm_retry_analysis_v1();
 -- Resume dispatch after a child/job daily limit or a resolver completion.
 PERFORM public.d10_synonym_dispatch_v1(NULL);
 FOR r IN SELECT DISTINCT CASE WHEN p.target_article_key ~ '^[0-9]+$' THEN p.target_article_key::bigint END article_id FROM public.synonym_pair_v1 p
  JOIN public.synonym_candidate_queue c ON c.id=p.candidate_id
  LEFT JOIN private.synonym_article_retry_v1 a ON a.article_id=CASE WHEN p.target_article_key ~ '^[0-9]+$' THEN p.target_article_key::bigint END
  WHERE p.status='waiting_article_cache' AND c.source_active AND p.target_article_key ~ '^[0-9]+$'
    AND NOT EXISTS(SELECT 1 FROM public.ordbokene_article_cache k WHERE k.article_id=CASE WHEN p.target_article_key ~ '^[0-9]+$' THEN p.target_article_key::bigint END AND lower(k.dictionary_code)='bm')
    AND coalesce(a.attempts,0)<4 AND (a.requested_at IS NULL OR a.requested_at<now()-interval '5 minutes')
  ORDER BY 1 LIMIT 10
 LOOP
  INSERT INTO private.synonym_article_retry_v1 AS a(article_id,attempts,requested_at)
   VALUES(r.article_id,1,now()) ON CONFLICT(article_id) DO UPDATE SET attempts=a.attempts+1,requested_at=now();
  IF public.d10_synonym_bm_call_edge_v1('ordbokene-article-fetcher',jsonb_build_object('article_id',r.article_id,'dictionary_code','bm'))
    THEN fetched:=fetched+1;
  ELSE UPDATE private.synonym_article_retry_v1 SET last_error='fetch_request_failed' WHERE article_id=r.article_id; END IF;
 END LOOP;
 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='article_fetch_exhausted',updated_at=now()
 FROM private.synonym_article_retry_v1 a
 WHERE p.status='waiting_article_cache' AND p.target_article_key=a.article_id::text AND a.attempts>=4
  AND a.requested_at<now()-interval '5 minutes'
  AND NOT EXISTS(SELECT 1 FROM public.ordbokene_article_cache k WHERE k.article_id=a.article_id AND lower(k.dictionary_code)='bm');
 FOR r IN SELECT DISTINCT c.id,c.source_job_id FROM public.synonym_candidate_queue c
  WHERE c.source_active AND c.dispatch_status IN ('skipped_ready','enrichment_done')
   AND (NOT EXISTS(SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id)
       AND coalesce(c.verification_evidence->'stage_a'->>'prepared_at','')=''
     OR EXISTS(SELECT 1 FROM public.synonym_pair_v1 p JOIN public.ordbokene_article_cache k
        ON k.article_id::text=p.target_article_key AND lower(k.dictionary_code)='bm'
        WHERE p.candidate_id=c.id AND p.status='waiting_article_cache'))
   AND NOT EXISTS(SELECT 1 FROM private.synonym_refresh_queue_v1 q WHERE q.candidate_id=c.id AND q.status IN ('pending','failed'))
  ORDER BY c.id LIMIT 100
 LOOP PERFORM public.d10_synonym_enqueue_refresh_v1(r.id,r.source_job_id,'resume_ready'); END LOOP;
 prepared:=public.d10_synonym_drain_refresh_v1(50);
 IF public.d10_synonym_verifier_pending_v1()>0 THEN
  woke:=public.d10_synonym_bm_call_edge_v1('synonym-verifier',jsonb_build_object('reason','analysis_queue_tick'));
 END IF;
 RETURN jsonb_build_object('mode','analysis_only','new_words',0,'retry',v,'article_requests',fetched,'refresh',prepared,'verifier_woken',woke);
END $f$;


CREATE OR REPLACE FUNCTION public.d10_synonym_collect_job_v1(p_job_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_version text;
  v_run uuid:=gen_random_uuid();
  v_depth integer;
  v_count integer;
BEGIN
  SELECT pipeline_version INTO STRICT v_version FROM public.synonym_pipeline_config WHERE singleton;
  SELECT CASE WHEN j.input_type = 'synonym_candidate' THEN 1 ELSE 0 END INTO v_depth
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id;
  IF v_depth IS NULL THEN RETURN 0; END IF;

  WITH src AS (
    SELECT DISTINCT ON (i.expression_id, g.id)
      i.id AS item_id, i.expression_id, g.id AS gloss_id, g.naob_slug, g.anchor_id,
      g.gloss_text, g.context_label, g.normalized_key
    FROM public.lexeme_processing_items i
    JOIN public.naob_expression_glosses g
      ON g.normalized_key = lower(btrim(regexp_replace(coalesce(i.normalized_lemma, ''), '\s+', ' ', 'g')))
     AND g.gloss_type = 'direct' AND g.gloss_text IS NOT NULL
    WHERE i.job_id = p_job_id AND i.match_type = 'expression' AND i.expression_id IS NOT NULL
      AND EXISTS(SELECT 1 FROM private.d10_job_enrichment_item_state_v1 checked
        WHERE checked.job_id=i.job_id AND checked.item_id=i.id AND checked.chain='naob_synonyms' AND checked.status='done')
    ORDER BY i.expression_id, g.id, i.id
  ), ins AS (
    INSERT INTO public.synonym_candidate_queue AS c (
      last_seen_collection, gloss_id, pipeline_version, source_entity_type, source_entity_id,
      source_sense_anchor, naob_slug, naob_gloss, context_label,
      target_text, target_kind, origin_depth, stage1_status,
      synonym_group_key, root_synonym_lemma, source_job_id, source_item_id, dispatch_status,
      verification_evidence)
    SELECT v_run, s.gloss_id, v_version, 'expression', s.expression_id,
      s.anchor_id, s.naob_slug, s.gloss_text, s.context_label,
      t.term, CASE WHEN t.term ~ ' ' THEN 'expression' ELSE 'lexeme' END, v_depth,
      CASE WHEN t.term ~ ' ' THEN 'awaiting_target_resolution' ELSE 'candidate' END,
      s.naob_slug || '#' || coalesce(s.anchor_id, ''), s.normalized_key, p_job_id, s.item_id,
      CASE WHEN v_depth > 0 THEN 'deferred_depth' ELSE 'pending' END,
      jsonb_build_object('collected_by', 'd10_synonym_collect_job_v1', 'gloss_part', t.ord,
        'pos_policy', 'not_guessed_verifier_decides')
    FROM src s CROSS JOIN LATERAL public.d10_synonym_gloss_terms_v1(s.gloss_text, s.normalized_key) t
    ON CONFLICT (gloss_id, lower(btrim(target_text)), pipeline_version) WHERE gloss_id IS NOT NULL
    DO UPDATE SET source_active=true,last_seen_collection=EXCLUDED.last_seen_collection,
      naob_gloss=EXCLUDED.naob_gloss,context_label=EXCLUDED.context_label,
      source_sense_anchor=EXCLUDED.source_sense_anchor,source_job_id=EXCLUDED.source_job_id,source_item_id=EXCLUDED.source_item_id,
      origin_depth=least(c.origin_depth,EXCLUDED.origin_depth),
      dispatch_status=CASE WHEN NOT c.source_active OR (c.dispatch_status='deferred_depth' AND EXCLUDED.origin_depth=0)
        THEN EXCLUDED.dispatch_status ELSE c.dispatch_status END,updated_at=now()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM ins;
  -- Retire disappeared terms only after successful source extraction; never on a network failure.
  UPDATE public.synonym_candidate_queue c SET source_active=false,updated_at=now()
  WHERE c.source_entity_type='expression' AND c.gloss_id IS NOT NULL AND c.pipeline_version=v_version
    AND coalesce(c.source_sense_anchor,'') NOT LIKE 'sib:%' AND c.last_seen_collection IS DISTINCT FROM v_run AND c.source_active
    AND EXISTS(SELECT 1 FROM public.lexeme_processing_items i JOIN private.d10_job_enrichment_item_state_v1 s
      ON s.job_id=i.job_id AND s.item_id=i.id AND s.chain='naob_synonyms' AND s.status IN ('done','no_data')
      WHERE i.job_id=p_job_id AND i.expression_id=c.source_entity_id);
  INSERT INTO private.synonym_collection_state_v1(entity_type,entity_id,job_id,status,reason)
  SELECT 'expression',i.expression_id,p_job_id,
    CASE WHEN bool_or(s.status IN ('done','no_data')) THEN 'complete'
         WHEN bool_or(s.status='failed') THEN 'error' ELSE 'waiting' END,
    CASE WHEN bool_or(s.status IN ('done','no_data')) THEN
      CASE WHEN EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.source_entity_type='expression'
        AND c.source_entity_id=i.expression_id AND c.source_active) THEN 'candidates_collected' ELSE 'no_candidates_in_source' END
      ELSE 'source_extraction_incomplete' END
  FROM public.lexeme_processing_items i LEFT JOIN private.d10_job_enrichment_item_state_v1 s
    ON s.job_id=i.job_id AND s.item_id=i.id AND s.chain='naob_synonyms'
  WHERE i.job_id=p_job_id AND i.expression_id IS NOT NULL GROUP BY i.expression_id
  ON CONFLICT(entity_type,entity_id) DO UPDATE SET job_id=EXCLUDED.job_id,status=EXCLUDED.status,
    reason=EXCLUDED.reason,checked_at=now();
  RETURN v_count;
END
$function$
;

-- Gold decisions are written by a reviewer, not copied from the AI. A stale review is not scored.
CREATE FUNCTION public.d10_synonym_review_metrics_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 WITH latest AS (
  SELECT DISTINCT ON (pair_id,snapshot_hash) * FROM private.synonym_human_reviews_v1 ORDER BY pair_id,snapshot_hash,created_at DESC,id DESC
 ), scored AS (
  SELECT r.expected_decision,p.decision,p.status,
   r.snapshot_hash=p.snapshot_hash AS current_input FROM latest r JOIN public.synonym_pair_v1 p ON p.id=r.pair_id
 )
 SELECT jsonb_build_object('reviewed',count(*),'stale_reviews',count(*) FILTER(WHERE NOT current_input),
  'current_decided',count(*) FILTER(WHERE current_input AND status='done'),
  'true_strict',count(*) FILTER(WHERE current_input AND status='done' AND expected_decision='verified_synonym' AND decision='verified_synonym'),
  'false_strict',count(*) FILTER(WHERE current_input AND status='done' AND expected_decision<>'verified_synonym' AND decision='verified_synonym'),
  'missed_strict',count(*) FILTER(WHERE current_input AND status='done' AND expected_decision='verified_synonym' AND decision<>'verified_synonym'),
  'note','Pair classification only. Candidate discovery recall needs a gold list including pairs never collected.')
 FROM scored
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_review_metrics_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_review_metrics_v1() TO service_role;
COMMIT;

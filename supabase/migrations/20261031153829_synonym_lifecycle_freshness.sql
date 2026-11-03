-- Synonym lifecycle: scoped refresh, stable evidence, durable history. No mass requeue.
BEGIN;
ALTER TABLE public.synonym_candidate_queue ADD COLUMN source_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.synonym_candidate_queue ADD COLUMN last_seen_collection uuid;
ALTER TABLE public.synonym_pair_v1 ADD COLUMN force_recheck boolean NOT NULL DEFAULT false;
ALTER TABLE public.synonym_verifier_log_v1 ADD COLUMN input_snapshot jsonb;
ALTER TABLE public.synonym_verifier_log_v1 ADD COLUMN input_hash text;

CREATE TABLE private.synonym_refresh_queue_v1 (
 candidate_id uuid PRIMARY KEY REFERENCES public.synonym_candidate_queue(id) ON DELETE CASCADE,
 job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
 reason text NOT NULL, force_ai boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 requested_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, last_error text
);
CREATE INDEX synonym_refresh_due_idx ON private.synonym_refresh_queue_v1(next_attempt_at,requested_at) WHERE status='pending';
CREATE TABLE private.synonym_collection_state_v1 (
 entity_type text NOT NULL, entity_id uuid NOT NULL, job_id uuid,
 status text NOT NULL CHECK(status IN ('complete','waiting','error','not_applicable')),
 reason text, checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(entity_type,entity_id)
);
CREATE TABLE private.synonym_pair_events_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pair_id uuid NOT NULL, event text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 before_row jsonb, after_row jsonb
);
CREATE INDEX synonym_pair_events_pair_idx ON private.synonym_pair_events_v1(pair_id,recorded_at);
CREATE TABLE private.synonym_human_reviews_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, pair_id uuid NOT NULL,
 snapshot_hash text NOT NULL, expected_decision text NOT NULL,
 reviewer text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expected_decision IN ('verified_synonym','contextual_synonym','near_synonym','related','rejected','needs_manual_review'))
);
CREATE TABLE private.synonym_collection_budget_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, lexeme_id uuid NOT NULL,
 collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonym_collection_budget_time_idx ON private.synonym_collection_budget_v1(collected_at);
CREATE TABLE private.synonym_family_completed_v1 (
 job_id uuid PRIMARY KEY REFERENCES public.lexeme_processing_jobs(id) ON DELETE CASCADE,
 checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.synonym_refresh_queue_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_collection_state_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_pair_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_human_reviews_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_collection_budget_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_family_completed_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_refresh_queue_v1,private.synonym_collection_state_v1,
 private.synonym_pair_events_v1,private.synonym_human_reviews_v1,private.synonym_collection_budget_v1,
 private.synonym_family_completed_v1 FROM PUBLIC,anon,authenticated;

-- Every result and every invalidation retains the exact input, not just the latest mutable pair.
CREATE FUNCTION public.d10_synonym_event_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO private.synonym_pair_events_v1(pair_id,event,after_row) VALUES(NEW.id,'created',to_jsonb(NEW)-'history');
 ELSIF (OLD.snapshot_hash,OLD.status,OLD.decision,OLD.verification_evidence,OLD.force_recheck)
   IS DISTINCT FROM (NEW.snapshot_hash,NEW.status,NEW.decision,NEW.verification_evidence,NEW.force_recheck) THEN
  INSERT INTO private.synonym_pair_events_v1(pair_id,event,before_row,after_row)
  VALUES(NEW.id,CASE WHEN OLD.snapshot_hash IS DISTINCT FROM NEW.snapshot_hash THEN 'input_changed'
    WHEN NEW.force_recheck AND NOT OLD.force_recheck THEN 'forced'
    WHEN NEW.status='done' THEN 'decision' ELSE 'transition' END,to_jsonb(OLD)-'history',to_jsonb(NEW)-'history');
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER synonym_event_v1 AFTER INSERT OR UPDATE ON public.synonym_pair_v1
FOR EACH ROW EXECUTE FUNCTION public.d10_synonym_event_v1();

-- No job IDs / timestamps in this key. All semantic evidence, including translations and POS, is included.
CREATE OR REPLACE FUNCTION public.d10_synonym_pair_content_key_v1(p_snapshot jsonb,p_target_entity_id uuid,p_article_key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO pg_catalog AS $f$
 SELECT md5(jsonb_build_object('contract','synonym-evidence-v2',
  'source',p_snapshot->'source','target',p_snapshot->'target',
  'target_id',p_target_entity_id,'article',p_article_key,
  'verification_contract',p_snapshot->'verification_contract',
  'pipeline_version',p_snapshot->'candidate'->'pipeline_version')::text)
$f$;

CREATE FUNCTION public.d10_synonym_examples_v1(p_type text,p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT coalesce(jsonb_agg(example_text ORDER BY example_text),'[]'::jsonb) FROM (
  SELECT DISTINCT btrim(e.example_text) example_text FROM public.entity_examples e
  WHERE e.language_code='nb' AND nullif(btrim(e.example_text),'') IS NOT NULL
   AND CASE WHEN p_type='expression' THEN e.expression_id=p_id ELSE e.lexeme_id=p_id AND e.expression_id IS NULL END
  ORDER BY 1 LIMIT 3
 ) x
$f$;

CREATE FUNCTION public.d10_synonym_enqueue_refresh_v1(p_candidate uuid,p_job uuid,p_reason text,p_force boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 INSERT INTO private.synonym_refresh_queue_v1 AS q(candidate_id,job_id,reason,force_ai)
 VALUES(p_candidate,p_job,p_reason,p_force)
 ON CONFLICT(candidate_id) DO UPDATE SET job_id=coalesce(EXCLUDED.job_id,q.job_id),reason=EXCLUDED.reason,
 force_ai=q.force_ai OR EXCLUDED.force_ai,status='pending',attempts=0,next_attempt_at=now(),requested_at=now(),
 finished_at=NULL,last_error=NULL
$f$;

CREATE FUNCTION public.d10_synonym_drain_refresh_v1(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; v jsonb; n integer:=0; errors integer:=0;
BEGIN
 FOR r IN SELECT q.* FROM private.synonym_refresh_queue_v1 q
  WHERE status='pending' AND next_attempt_at<=now()
  ORDER BY requested_at,candidate_id LIMIT least(greatest(p_limit,1),200) FOR UPDATE SKIP LOCKED
 LOOP
  BEGIN
   IF r.force_ai THEN
    UPDATE public.synonym_pair_v1 SET force_recheck=true WHERE candidate_id=r.candidate_id AND status<>'superseded';
   END IF;
   v:=public.d10_synonym_prepare_candidate_v1(r.candidate_id,false);
   IF coalesce(v->>'ok','false')<>'true' THEN RAISE EXCEPTION 'PREPARE_FAILED: %',v; END IF;
   -- Targets still being enriched are retried by their child completion, not called successful.
   IF v->>'skipped'='not_ready' THEN
    UPDATE private.synonym_refresh_queue_v1 SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',
     status=CASE WHEN attempts>=11 THEN 'failed' ELSE 'pending' END,last_error='target_not_ready'
     WHERE candidate_id=r.candidate_id;
   ELSE
    UPDATE private.synonym_refresh_queue_v1 SET status='done',force_ai=false,finished_at=now(),last_error=NULL WHERE candidate_id=r.candidate_id;
    n:=n+1;
   END IF;
  EXCEPTION WHEN OTHERS THEN
   UPDATE private.synonym_refresh_queue_v1 SET attempts=attempts+1,
    status=CASE WHEN attempts>=2 THEN 'failed' ELSE 'pending' END,
    next_attempt_at=now()+interval '5 minutes',last_error=left(SQLERRM,500) WHERE candidate_id=r.candidate_id;
   errors:=errors+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('processed',n,'errors',errors);
END $f$;

CREATE OR REPLACE FUNCTION public.d10_synonym_prepare_for_job_v1(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; n integer:=0; v jsonb;
BEGIN
 FOR r IN
  WITH cards AS (
   SELECT lexeme_id id FROM public.lexeme_processing_items WHERE job_id=p_job_id AND lexeme_id IS NOT NULL
   UNION SELECT expression_id FROM public.lexeme_processing_items WHERE job_id=p_job_id AND expression_id IS NOT NULL
  )
  SELECT c.id FROM public.synonym_candidate_queue c
  WHERE c.dispatch_status IN ('enrichment_done','skipped_ready')
   AND (c.source_job_id=p_job_id OR c.child_job_id=p_job_id OR c.source_entity_id IN (SELECT id FROM cards)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.target_entity_ids) e WHERE (e->>'id')::uuid IN (SELECT id FROM cards)))
 LOOP
  PERFORM public.d10_synonym_enqueue_refresh_v1(r.id,p_job_id,'analysis_completed');
  n:=n+1;
 END LOOP;
 v:=public.d10_synonym_drain_refresh_v1(50);
 RETURN jsonb_build_object('ok',true,'candidates',n,'refresh',v);
END $f$;

-- Explicit administrative recheck: bounded to one card, all of its relations, never the whole database.
CREATE FUNCTION public.d10_synonym_recheck_entity_v1(p_entity_type text,p_entity_id uuid,p_force_ai boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; n integer:=0;
BEGIN
 IF p_entity_type NOT IN ('lexeme','expression') THEN RAISE EXCEPTION 'INVALID_ENTITY_TYPE'; END IF;
 FOR r IN SELECT DISTINCT c.id FROM public.synonym_candidate_queue c
 WHERE c.source_active AND (c.source_entity_type=p_entity_type AND c.source_entity_id=p_entity_id
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.target_entity_ids)e WHERE e->>'entity_type'=p_entity_type AND e->>'id'=p_entity_id::text))
 LOOP
  PERFORM public.d10_synonym_enqueue_refresh_v1(r.id,NULL,'manual_recheck',p_force_ai);
  n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'queued',n,'force_ai',p_force_ai);
END $f$;

-- Append-only collection history includes zero-candidate and failed searches with a date.
CREATE TABLE private.synonym_collection_events_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL,entity_id uuid NOT NULL,
 job_id uuid,status text NOT NULL,reason text,checked_at timestamptz NOT NULL,
 evidence jsonb NOT NULL
);
ALTER TABLE private.synonym_collection_events_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_collection_events_v1 FROM PUBLIC,anon,authenticated;
CREATE INDEX synonym_collection_events_entity_idx ON private.synonym_collection_events_v1(entity_type,entity_id,checked_at);
CREATE FUNCTION public.d10_synonym_collection_event_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 INSERT INTO private.synonym_collection_events_v1(entity_type,entity_id,job_id,status,reason,checked_at,evidence)
 VALUES(NEW.entity_type,NEW.entity_id,NEW.job_id,NEW.status,NEW.reason,NEW.checked_at,
 jsonb_build_object('pipeline_version',(SELECT pipeline_version FROM public.synonym_pipeline_config WHERE singleton),
 'collector_version','lifecycle-v2',
 'source',CASE WHEN NEW.entity_type='lexeme' THEN 'Bokmaalsordboka' ELSE 'NAOB' END,
 'collection',CASE WHEN NEW.entity_type='lexeme' THEN
   (SELECT to_jsonb(w) FROM public.synonym_bm_word_v1 w WHERE lexeme_id=NEW.entity_id) ELSE NULL END,
 'active_candidates',(SELECT count(*) FROM public.synonym_candidate_queue c WHERE c.source_active
   AND c.source_entity_type=NEW.entity_type AND c.source_entity_id=NEW.entity_id)));
 RETURN NEW;
END $f$;
CREATE TRIGGER synonym_collection_event_v1 AFTER INSERT OR UPDATE ON private.synonym_collection_state_v1
FOR EACH ROW EXECUTE FUNCTION public.d10_synonym_collection_event_v1();

CREATE FUNCTION public.d10_synonym_candidate_changed_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF TG_OP='UPDATE' AND NOT NEW.source_active AND OLD.source_active THEN
  UPDATE public.synonym_pair_v1 SET status='superseded',published=false,lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE candidate_id=NEW.id AND status<>'superseded';
 END IF;
 IF NEW.source_active AND NEW.dispatch_status IN ('enrichment_done','skipped_ready') THEN
  IF TG_OP='INSERT' OR (NEW.naob_gloss,NEW.context_label,NEW.expected_pos,NEW.source_active,NEW.dispatch_status,NEW.target_entity_ids)
   IS DISTINCT FROM (OLD.naob_gloss,OLD.context_label,OLD.expected_pos,OLD.source_active,OLD.dispatch_status,OLD.target_entity_ids) THEN
    PERFORM public.d10_synonym_enqueue_refresh_v1(NEW.id,NEW.source_job_id,'candidate_changed');
  END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER synonym_candidate_changed_v1 AFTER INSERT OR UPDATE ON public.synonym_candidate_queue
FOR EACH ROW EXECUTE FUNCTION public.d10_synonym_candidate_changed_v1();

-- A sibling relation depends on two parent decisions; invalidate it when either parent becomes stale.
CREATE FUNCTION public.d10_synonym_parent_changed_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF OLD.status='done' AND (NEW.status<>'done' OR NEW.decision IS DISTINCT FROM OLD.decision
    OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash) THEN
  UPDATE public.synonym_candidate_queue c SET source_active=false,updated_at=now()
  WHERE c.source_active AND c.source_sense_anchor LIKE 'sib:%'
    AND c.verification_evidence->'parent_pairs' @> jsonb_build_array(NEW.id);
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER aa_synonym_parent_changed_v1 AFTER UPDATE ON public.synonym_pair_v1
FOR EACH ROW EXECUTE FUNCTION public.d10_synonym_parent_changed_v1();

CREATE TABLE private.synonym_article_retry_v1(
 article_id bigint PRIMARY KEY,attempts integer NOT NULL DEFAULT 0,requested_at timestamptz,last_error text
);
ALTER TABLE private.synonym_article_retry_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_article_retry_v1 FROM PUBLIC,anon,authenticated;

-- This runs queued work only. It never enumerates lexemes to discover new source words.
CREATE FUNCTION public.d10_synonym_maintenance_v1() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; v jsonb; fetched integer:=0; prepared jsonb; woke boolean:=false;
BEGIN
 IF NOT coalesce((SELECT after_analysis_enabled FROM public.synonym_bm_config_v1 WHERE singleton),false) THEN
  RETURN jsonb_build_object('skipped','disabled');
 END IF;
 IF NOT pg_try_advisory_xact_lock(20261031,2) THEN RETURN jsonb_build_object('skipped','busy'); END IF;
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

CREATE FUNCTION public.d10_synonym_entity_status_v1(p_type text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE s private.synonym_collection_state_v1%rowtype; n integer; unfinished integer; errors integer; deferred integer; positive integer; status text;
BEGIN
 SELECT * INTO s FROM private.synonym_collection_state_v1 WHERE entity_type=p_type AND entity_id=p_id;
 SELECT count(*),count(*) FILTER(WHERE c.dispatch_status='deferred_depth'),
 count(*) FILTER(WHERE c.stage1_status IN ('failed','needs_manual_review')
  OR (c.dispatch_status IN ('skipped_ready','enrichment_done','not_dispatchable') AND c.stage1_status<>'rejected'
    AND NOT EXISTS(SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id AND p.status<>'superseded'))
  OR EXISTS(SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id
   AND (p.status IN ('failed','needs_manual_review') OR p.decision='needs_manual_review'))
  OR EXISTS(SELECT 1 FROM private.synonym_refresh_queue_v1 q WHERE q.candidate_id=c.id AND q.status='failed')),
 count(*) FILTER(WHERE c.dispatch_status IN ('pending','awaiting_parent','in_child_job')
  OR EXISTS(SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id
    AND p.status IN ('queued','processing','retry_wait','waiting_article_cache'))
  OR EXISTS(SELECT 1 FROM private.synonym_refresh_queue_v1 q WHERE q.candidate_id=c.id AND q.status='pending')),
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id
    AND p.status='done' AND p.decision='verified_synonym'))
 INTO n,deferred,errors,unfinished,positive
 FROM public.synonym_candidate_queue c WHERE c.source_active AND c.source_entity_type=p_type AND c.source_entity_id=p_id;
 status:=CASE WHEN s.status='error' OR errors>0 THEN 'error'
   WHEN s.status='waiting' OR unfinished>0 THEN 'waiting'
   WHEN deferred>0 THEN 'deferred'
   WHEN s.entity_id IS NULL THEN 'not_checked'
   WHEN n=0 AND s.status='complete' THEN 'no_candidates'
   WHEN positive>0 THEN 'verified'
   WHEN s.status='complete' THEN 'no_verified_synonyms' ELSE s.status END;
 RETURN jsonb_build_object('status',status,'checked_at',s.checked_at,'collection_status',s.status,'reason',s.reason,
  'candidates',n,'deferred',deferred,'waiting',unfinished,'errors',errors,'verified_candidates',positive,
  'last_verified_at',(SELECT max(p.verified_at) FROM public.synonym_pair_v1 p WHERE p.source_entity_type=p_type AND p.source_entity_id=p_id));
END $f$;

CREATE FUNCTION public.d10_synonym_coverage_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT jsonb_build_object('as_of',now(),'mass_enabled',(SELECT enabled FROM public.synonym_bm_config_v1 WHERE singleton),
 'collection',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
   SELECT entity_type,status,reason,count(*) count FROM private.synonym_collection_state_v1 GROUP BY 1,2,3)x),
 'pairs',(SELECT jsonb_agg(x) FROM (SELECT status,decision,count(*) count FROM public.synonym_pair_v1 GROUP BY 1,2)x),
 'refresh_queue',(SELECT jsonb_agg(x) FROM (SELECT status,count(*) count FROM private.synonym_refresh_queue_v1 GROUP BY 1)x),
 'human_reviews',(SELECT count(*) FROM private.synonym_human_reviews_v1),
 'note','Collection success measures this extractor, not all Norwegian synonyms')
$f$;


CREATE OR REPLACE FUNCTION public.d10_synonym_prepare_candidate_v1(p_candidate_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  c public.synonym_candidate_queue%rowtype;
  v_src_lemma text;
  v_src_lexeme uuid;
  v_src_pos text;
  v_src_tr jsonb;
  v_src_sense uuid;
  v_src jsonb;
  v_t jsonb;
  v_card record;
  v_art bigint;
  v_arts bigint[];
  v_payload jsonb;
  v_defs text[];
  v_tr jsonb;
  v_pairs jsonb := '[]'::jsonb;
  v_pair jsonb;
  v_status text;
  v_reason text;
  v_sense uuid;
  v_snapshot jsonb;
  v_hash text;
  v_open integer;
  v_written integer := 0;
  v_reset integer := 0;
  v_keys text[] := '{}';
  v_key text;
  v_explanation boolean := false;
BEGIN
  SELECT * INTO c FROM public.synonym_candidate_queue WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'CANDIDATE_NOT_FOUND'); END IF;
  IF NOT c.source_active THEN
    UPDATE public.synonym_pair_v1 SET status='superseded',published=false,lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE candidate_id=c.id AND status<>'superseded';
    RETURN jsonb_build_object('ok',true,'skipped','source_withdrawn');
  END IF;
  IF c.dispatch_status IN ('enrichment_done','skipped_ready') THEN
    c.target_entity_ids := public.d10_synonym_target_entities_v1(lower(btrim(c.target_text)),c.target_kind);
    UPDATE public.synonym_candidate_queue SET target_entity_ids=c.target_entity_ids WHERE id=c.id;
  END IF;
  IF c.dispatch_status NOT IN ('enrichment_done', 'skipped_ready') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'not_ready', 'dispatch_status', c.dispatch_status);
  END IF;

  -- source side
  IF c.source_entity_type = 'expression' THEN
    SELECT x.lemma, x.lexeme_id INTO v_src_lemma, v_src_lexeme FROM public.expression_catalog x WHERE x.id = c.source_entity_id;
  ELSE
    SELECT l.lemma, l.id INTO v_src_lemma, v_src_lexeme FROM public.lexemes l WHERE l.id = c.source_entity_id;
  END IF;
  v_src_pos := public.d10_synonym_source_pos_v1(c.source_entity_type, c.source_entity_id);
  SELECT coalesce(jsonb_object_agg(t.language_code, t.translation), '{}'::jsonb) INTO v_src_tr
  FROM public.get_canonical_lexeme_translations_v1(CASE WHEN v_src_lexeme IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_src_lexeme] END) t;
  v_src := jsonb_build_object('entity_type', c.source_entity_type, 'entity_id', c.source_entity_id,
    'lemma', v_src_lemma, 'part_of_speech', v_src_pos, 'definition_nb', c.naob_gloss,
    'context_label', c.context_label, 'naob_slug', c.naob_slug, 'anchor_id', c.source_sense_anchor,
    'translations', v_src_tr, 'examples_nb', public.d10_synonym_examples_v1(c.source_entity_type,c.source_entity_id));

  IF NOT p_dry_run AND coalesce(btrim(c.naob_gloss), '') <> '' THEN
    INSERT INTO public.semantic_senses AS s (entity_type, entity_id, semantic_pos, source, source_article_id,
      source_sense_key, definition, context_label, definition_hash, evidence)
    VALUES (c.source_entity_type, c.source_entity_id, v_src_pos, CASE WHEN c.bm_gloss_id IS NOT NULL THEN 'Ordbokene' ELSE 'NAOB' END, coalesce(c.naob_slug, '?'),
      coalesce(nullif(c.source_sense_anchor, ''), 'gloss:' || c.gloss_id::text), c.naob_gloss, c.context_label,
      md5(c.naob_gloss), jsonb_build_object('gloss_id', c.gloss_id, 'by', 'd10_synonym_prepare_candidate_v1'))
    ON CONFLICT (source, source_article_id, source_sense_key) DO UPDATE SET
      definition = EXCLUDED.definition, context_label = EXCLUDED.context_label,
      definition_hash = EXCLUDED.definition_hash, semantic_pos = EXCLUDED.semantic_pos, updated_at = now()
    RETURNING s.id INTO v_src_sense;
    UPDATE public.synonym_candidate_queue SET source_sense_id = v_src_sense,
      source_semantic_pos = coalesce(v_src_pos, source_semantic_pos), updated_at = now()
    WHERE id = c.id AND source_sense_id IS DISTINCT FROM v_src_sense;
  END IF;

  -- target side: every card of the target (not excluded), every article of it
  FOR v_t IN SELECT e FROM jsonb_array_elements(c.target_entity_ids) e LOOP
    FOR v_card IN
      SELECT CASE WHEN v_t->>'entity_type' = 'expression' THEN 'expression' ELSE 'lexeme' END AS etype,
             (v_t->>'id')::uuid AS eid,
             coalesce(l.id, x.lexeme_id) AS card_lexeme,
             coalesce(l.lemma, x.lemma) AS lemma,
             -- D10 29.10.2026: an expression gets its semantic part of speech (first word)
             CASE WHEN v_t->>'entity_type' = 'expression' THEN public.d10_expression_semantic_pos_v1(x.lemma)
                  ELSE nullif(l.pos, '') END AS pos,
             coalesce(l.homograph_key, '') AS hk,
             coalesce(l.dictionary_status, 'active') AS dstatus,
             (x.verification_evidence->'Ordbokene'->>'article_id') AS expr_article
      FROM (SELECT 1) one
      LEFT JOIN public.lexemes l ON v_t->>'entity_type' = 'lexeme' AND l.id = (v_t->>'id')::uuid
      LEFT JOIN public.expression_catalog x ON v_t->>'entity_type' = 'expression' AND x.id = (v_t->>'id')::uuid
    LOOP
      CONTINUE WHEN v_card.lemma IS NULL OR v_card.dstatus = 'excluded';
      SELECT coalesce(jsonb_object_agg(t.language_code, t.translation), '{}'::jsonb) INTO v_tr
      FROM public.get_canonical_lexeme_translations_v1(CASE WHEN v_card.card_lexeme IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_card.card_lexeme] END) t;
      v_arts := CASE WHEN v_card.etype = 'expression'
        THEN CASE WHEN v_card.expr_article ~ '^\d+$' THEN ARRAY[v_card.expr_article::bigint] ELSE '{}'::bigint[] END
        ELSE public.d10_lexeme_article_ids_v1(v_card.eid) END;
      IF coalesce(array_length(v_arts, 1), 0) = 0 THEN v_arts := ARRAY[NULL::bigint]; END IF;
      FOREACH v_art IN ARRAY v_arts LOOP
        v_defs := NULL; v_payload := NULL; v_status := 'queued'; v_reason := NULL;
        IF v_art IS NOT NULL THEN
          SELECT k.payload INTO v_payload FROM public.ordbokene_article_cache k
          WHERE k.article_id = v_art AND lower(k.dictionary_code) = 'bm' ORDER BY k.updated_at DESC LIMIT 1;
          IF v_payload IS NULL THEN v_status := 'waiting_article_cache';
          ELSE v_defs := public.d10_ordbokene_explanations_v1(v_payload); END IF;
        ELSE
          SELECT array_agg(d.definition ORDER BY d.source_entry_id NULLS LAST) INTO v_defs
          FROM public.entity_definitions d
          WHERE d.lexeme_id = v_card.card_lexeme AND d.expression_id IS NULL AND d.language_code = 'nb'
            AND coalesce(btrim(d.definition), '') <> '';
        END IF;
        -- cheap rules
        IF v_card.eid = c.source_entity_id OR (v_src_lexeme IS NOT NULL AND v_card.card_lexeme = v_src_lexeme) THEN
          v_status := 'rejected_rule'; v_reason := 'self_relation';
        -- an expression's semantic part of speech is a guess: never a rule (the verifier sees it)
        ELSIF v_card.etype = 'lexeme' AND (v_card.pos IS NULL OR v_card.pos = 'unknown') THEN
          v_status := 'needs_manual_review'; v_reason := 'target_pos_unknown';
        -- the rule needs a card on the target side (its part of speech is known for sure)
        ELSIF v_card.etype = 'lexeme' AND v_src_pos IS NOT NULL
              AND v_card.pos IN ('verb','noun','adjective','adverb') AND v_card.pos <> v_src_pos THEN
          v_status := 'rejected_rule'; v_reason := 'incompatible_part_of_speech';
        ELSIF coalesce(btrim(c.naob_gloss), '') = '' THEN
          v_status := 'needs_manual_review'; v_reason := 'no_source_gloss';
        ELSIF v_status = 'queued' AND coalesce(array_length(v_defs, 1), 0) = 0 THEN
          v_status := 'needs_manual_review'; v_reason := 'target_without_definition';
        END IF;
        v_pairs := v_pairs || jsonb_build_object('etype', v_card.etype, 'eid', v_card.eid,
          'key', coalesce(v_art::text, 'none'), 'status', v_status, 'reason', v_reason,
          'target', jsonb_build_object('entity_type', v_card.etype, 'entity_id', v_card.eid, 'lemma', v_card.lemma,
            'homograph_key', v_card.hk, 'part_of_speech', v_card.pos, 'article_id', v_art,
            'pos_basis', CASE WHEN v_card.etype = 'expression' THEN 'first_word' ELSE 'card' END,
            'definitions_nb', to_jsonb(coalesce(v_defs, '{}'::text[])),
            'definition_source', CASE WHEN v_art IS NULL THEN 'Lexin' ELSE 'Ordbokene' END,
            'translations', v_tr, 'examples_nb', public.d10_synonym_examples_v1(v_card.etype,v_card.eid)));
      END LOOP;
    END LOOP;
  END LOOP;

  -- more than 5 possible target senses after the rules -> manual review
  SELECT count(*) INTO v_open FROM jsonb_array_elements(v_pairs) p WHERE p->>'status' IN ('queued','waiting_article_cache');
  IF v_open > 5 THEN
    SELECT coalesce(jsonb_agg(CASE WHEN p->>'status' IN ('queued','waiting_article_cache')
      THEN p || jsonb_build_object('status', 'needs_manual_review', 'reason', 'too_many_target_senses') ELSE p END), '[]'::jsonb)
    INTO v_pairs FROM jsonb_array_elements(v_pairs) p;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'candidate_id', c.id, 'source', v_src, 'pairs', v_pairs);
  END IF;

  FOR v_pair IN SELECT p FROM jsonb_array_elements(v_pairs) p LOOP
    v_sense := NULL;
    IF v_pair->>'key' <> 'none' AND jsonb_array_length(v_pair->'target'->'definitions_nb') > 0 THEN
      INSERT INTO public.semantic_senses AS s (entity_type, entity_id, semantic_pos, source, source_article_id,
        source_sense_key, definition, definition_hash, evidence)
      VALUES (v_pair->>'etype', (v_pair->>'eid')::uuid, v_pair->'target'->>'part_of_speech', 'Ordbokene',
        v_pair->>'key', (v_pair->>'etype') || ':' || (v_pair->>'eid'),
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_pair->'target'->'definitions_nb')), ' | '),
        md5((v_pair->'target'->'definitions_nb')::text), jsonb_build_object('by', 'd10_synonym_prepare_candidate_v1'))
      ON CONFLICT (source, source_article_id, source_sense_key) DO UPDATE SET
        definition = EXCLUDED.definition, definition_hash = EXCLUDED.definition_hash,
        semantic_pos = EXCLUDED.semantic_pos, updated_at = now()
      RETURNING s.id INTO v_sense;
    END IF;
    v_snapshot := jsonb_build_object('source', v_src, 'target', v_pair->'target',
      'verification_contract',public.d10_synonym_verifier_version_v1() || ':rules-v3',
      'candidate', jsonb_build_object('candidate_id', c.id, 'gloss_id', c.gloss_id, 'naob_gloss', c.naob_gloss,
        'target_text', c.target_text, 'source_job_id', c.source_job_id, 'child_job_id', c.child_job_id,
        'pipeline_version', c.pipeline_version));
    v_hash := public.d10_synonym_pair_content_key_v1(v_snapshot,(v_pair->>'eid')::uuid,v_pair->>'key');
    v_key := (v_pair->>'etype') || ':' || (v_pair->>'eid') || ':' || (v_pair->>'key');
    v_keys := v_keys || v_key;
    INSERT INTO public.synonym_pair_v1 AS p (candidate_id, source_entity_type, source_entity_id, source_sense_id,
      target_entity_type, target_entity_id, target_article_key, target_sense_id, status, rule_reason, snapshot, snapshot_hash)
    VALUES (c.id, c.source_entity_type, c.source_entity_id, v_src_sense, v_pair->>'etype', (v_pair->>'eid')::uuid,
      v_pair->>'key', v_sense, v_pair->>'status', v_pair->>'reason', v_snapshot, v_hash)
    ON CONFLICT (candidate_id, target_entity_type, target_entity_id, target_article_key) DO UPDATE SET
      -- a changed snapshot resets the result; the old one goes to the history
      history = CASE WHEN p.decision IS NOT NULL OR p.status IN ('done','failed') THEN p.history || jsonb_build_array(
        jsonb_build_object('snapshot_hash', p.snapshot_hash, 'snapshot_version', p.snapshot_version, 'status', p.status,
          'decision', p.decision, 'confidence', p.confidence, 'verified_at', p.verified_at, 'published', p.published,
          'snapshot',p.snapshot,'verification_evidence',p.verification_evidence,'verifier_version',p.verifier_version,
          'superseded_at', now())) ELSE p.history END,
      snapshot = EXCLUDED.snapshot, snapshot_hash = EXCLUDED.snapshot_hash,
      snapshot_version = p.snapshot_version + 1, status = EXCLUDED.status, rule_reason = EXCLUDED.rule_reason,
      source_sense_id = EXCLUDED.source_sense_id, target_sense_id = EXCLUDED.target_sense_id,
      decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL,
      verified_at = NULL, published = false, attempts = 0, next_attempt_at = NULL, last_error = NULL,
      lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE p.snapshot_hash IS DISTINCT FROM EXCLUDED.snapshot_hash OR p.status = 'superseded' OR p.force_recheck;
    IF FOUND THEN v_written := v_written + 1; END IF;
  END LOOP;

  -- pairs that are no longer possible (card excluded, article gone)
  UPDATE public.synonym_pair_v1 p SET status = 'superseded', published = false, updated_at = now(),
    history = p.history || jsonb_build_array(jsonb_build_object('superseded_at', now(), 'reason', 'pair_no_longer_possible',
      'decision', p.decision, 'snapshot_hash', p.snapshot_hash))
  WHERE p.candidate_id = c.id AND p.status <> 'superseded'
    AND NOT ((p.target_entity_type || ':' || p.target_entity_id::text || ':' || p.target_article_key) = ANY (v_keys));
  GET DIAGNOSTICS v_reset = ROW_COUNT;

  -- candidate status from its pairs (superseded pairs do not count):
  --   a pair to verify -> verification_queued; one for manual review ->
  --   needs_manual_review; NO target card at all (the child job made none,
  --   e.g. feste) -> needs_manual_review 'no_target_card'; only rule
  --   rejections -> rejected
  -- D10 28.10.2026 (agreed, variant B): an expression without a card whose
  -- Ordbøkene check in the child job really ran (done) and found no own
  -- article is an explanation from NAOB, not a lexical unit: rejected
  -- 'naob_explanation' (out of the problem words). A check that failed
  -- (technical) keeps 'no_target_card' (stays in the list for a re-run).
  v_explanation := c.target_kind = 'expression' AND c.child_job_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.lexeme_processing_items i
    JOIN public.lexeme_source_checks s ON s.item_id = i.id AND s.source = 'Ordbokene'
    WHERE i.job_id = c.child_job_id AND i.match_type = 'expression'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(c.target_text))
      AND s.status = 'done' AND coalesce(s.whole_unit_match, false) = false);
  UPDATE public.synonym_candidate_queue q SET stage1_status = s.new_status,
    verification_evidence = q.verification_evidence || jsonb_build_object('stage_a',
      jsonb_build_object('reason', s.reason, 'prepared_at', now())),
    updated_at = now()
  FROM (
    SELECT CASE
        WHEN bool_or(p.status IN ('queued','waiting_article_cache','processing','retry_wait')) THEN 'verification_queued'
        WHEN bool_or(p.status = 'needs_manual_review') THEN 'needs_manual_review'
        WHEN count(p.id) = 0 AND v_explanation THEN 'rejected'
        WHEN count(p.id) = 0 THEN 'needs_manual_review'
        WHEN bool_and(p.status = 'rejected_rule') THEN 'rejected'
        ELSE NULL END AS new_status,
      CASE WHEN count(p.id) = 0 AND v_explanation THEN 'naob_explanation'
        WHEN count(p.id) = 0 THEN 'no_target_card'
        WHEN bool_and(p.status = 'rejected_rule') THEN string_agg(DISTINCT p.rule_reason, ',')
        ELSE NULL END AS reason
    FROM public.synonym_pair_v1 p
    WHERE p.candidate_id = c.id AND p.status <> 'superseded'
  ) s
  WHERE q.id = c.id AND s.new_status IS NOT NULL
    AND q.stage1_status IN ('candidate','waiting_enrichment','verification_queued','needs_manual_review','rejected');

  RETURN jsonb_build_object('ok', true, 'candidate_id', c.id, 'pairs', jsonb_array_length(v_pairs),
    'written', v_written, 'superseded', v_reset);
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1(p_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE v_n integer;
BEGIN
  WITH decided AS (
    SELECT DISTINCT ON (public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key))
      public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key) AS k,
      d.id, d.decision, d.confidence, d.verification_evidence, d.verifier_version
    FROM public.synonym_pair_v1 d
    WHERE d.status = 'done' AND d.decision IS NOT NULL
      AND (d.verifier_version = 'rule:mutual_reference_v3' OR (d.verifier_version = p_version
        AND jsonb_typeof(d.verification_evidence->'substitution_forward') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'substitution_reverse') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'same_construction') = 'boolean'))
    ORDER BY public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key), d.verified_at DESC
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = x.decision, confidence = x.confidence,
      verification_evidence = (x.verification_evidence - 'copied_from')
        || jsonb_build_object('copied_from', x.id, 'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      verifier_version = x.verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM decided x
  WHERE p.status IN ('queued', 'retry_wait') AND NOT p.force_recheck AND p.id <> x.id
    AND public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) = x.k;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_record_decision_v1(p_pair_id uuid, p_lease_token uuid, p_snapshot_hash text, p_decision text, p_confidence numeric, p_evidence jsonb, p_verifier_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('verified_synonym','contextual_synonym','near_synonym',
       'related','rejected','needs_manual_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;
  UPDATE public.synonym_pair_v1
  SET status = 'done', force_recheck=false, decision = p_decision,
      confidence = least(greatest(coalesce(p_confidence, 0), 0), 1),
      verification_evidence = coalesce(p_evidence, '{}'::jsonb)
        || jsonb_build_object('snapshot_hash', p_snapshot_hash, 'dry_run', true),
      verifier_version = p_verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  WHERE id = p_pair_id AND status = 'processing' AND lease_token = p_lease_token
    AND snapshot_hash IS NOT DISTINCT FROM p_snapshot_hash;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- D10 29.10.2026 (agreed, v2): waiting pairs with the same content get it too
  IF v_n = 1 THEN PERFORM public.d10_synonym_copy_decisions_v1(p_verifier_version); END IF;
  RETURN jsonb_build_object('ok', true, 'applied', v_n = 1, 'stale', v_n = 0);
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_log_ai_call_v2(p_call jsonb, p_rows jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE v_call uuid;
BEGIN
  INSERT INTO public.synonym_verifier_calls_v1 (reason, job_id, model, pairs, decided, ok, prompt_tokens,
    output_tokens, duration_ms, error, prompt_version)
  VALUES (p_call->>'reason', nullif(p_call->>'job_id', '')::uuid, p_call->>'model',
    coalesce((p_call->>'pairs')::integer, 0), coalesce((p_call->>'decided')::integer, 0),
    coalesce((p_call->>'ok')::boolean, false), (p_call->>'prompt_tokens')::integer,
    (p_call->>'output_tokens')::integer, (p_call->>'duration_ms')::integer, left(p_call->>'error', 500),
    p_call->>'prompt_version')
  RETURNING id INTO v_call;
  INSERT INTO public.synonym_verifier_log_v1 (call_id, pair_id, content_key, model, prompt_version, verifier_version,
    source_lemma, naob_meaning, target_lemma, target_definitions, matched_definition, matched_text, pattern,
    ai_decision, final_decision, guard, confidence, reason, example_nb, applied, error, input_snapshot, input_hash, substitution_forward, substitution_reverse, same_construction)
  SELECT v_call, (r->>'pair_id')::uuid, r->>'content_key', p_call->>'model', p_call->>'prompt_version',
    coalesce(r->>'verifier_version', 'ai:synonym_pair_' || (p_call->>'prompt_version') || ':' || (p_call->>'model')),
    r->'snapshot'->'source'->>'lemma', r->'snapshot'->'source'->>'definition_nb',
    r->'snapshot'->'target'->>'lemma', r->'snapshot'->'target'->'definitions_nb',
    (r->>'matched_definition')::integer, r->>'matched_text', r->>'pattern',
    r->>'ai_decision', r->>'final_decision', r->>'guard', (r->>'confidence')::numeric,
    left(r->>'reason', 500), left(r->>'example_nb', 300), (r->>'applied')::boolean, left(r->>'error', 500), r->'snapshot', r->>'content_key',
    (r->>'substitution_forward')::boolean, (r->>'substitution_reverse')::boolean, (r->>'same_construction')::boolean
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  WHERE EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.id = (r->>'pair_id')::uuid);
  RETURN v_call;
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_rule_verify_v1(p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_n integer;
BEGIN
  WITH cand AS (
    SELECT p.id, m.def
    FROM public.synonym_pair_v1 p
    CROSS JOIN LATERAL (
      SELECT d.def FROM jsonb_array_elements_text(coalesce(p.snapshot->'target'->'definitions_nb', '[]'::jsonb)) AS d(def)
      -- D10 29.10.2026 (agreed): only a WHOLE item of the definition counts
      -- ("slå fast, bevise, hevde som sikkert" -> item "slå fast"); a mention
      -- inside a longer text (comparison, example, context) goes to the AI
      WHERE length(public.d10_synonym_norm_text_v1(p.snapshot->'source'->>'lemma')) >= 2
        AND EXISTS (SELECT 1 FROM regexp_split_to_table(regexp_replace(d.def, '\([^)]*\)', ' ', 'g'), '[,;:]') item
                    WHERE public.d10_synonym_norm_text_v1(item) = public.d10_synonym_norm_text_v1(p.snapshot->'source'->>'lemma'))
      LIMIT 1) m
    WHERE p.status = 'queued' AND NOT p.force_recheck
      AND coalesce(p.snapshot->'source'->>'context_label','')=''
      AND p.snapshot->'source'->>'part_of_speech'=p.snapshot->'target'->>'part_of_speech'
    ORDER BY p.created_at
    LIMIT greatest(coalesce(p_limit, 500), 1)
    FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = 'verified_synonym', confidence = 0.9,
      verifier_version = 'rule:mutual_reference_v3', verified_at = now(), published = false,
      verification_evidence = jsonb_build_object('rule', 'mutual_reference_item',
        'matched_definition', c.def, 'source_lemma', p.snapshot->'source'->>'lemma',
        'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM cand c WHERE p.id = c.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'verified_by_rule', v_n);
END
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
  LOOP
    v := public.d10_synonym_bm_collect_lexeme_v1(r.lexeme_id, p_job_id, v_depth);
    UPDATE public.synonym_bm_word_v1 SET analysis_job_id=p_job_id WHERE lexeme_id=r.lexeme_id;
    v_words := v_words + 1;
    v_cands := v_cands + coalesce((v->>'candidates')::integer, 0);
    IF jsonb_array_length(coalesce(v->'missing', '[]'::jsonb)) > 0 THEN v_waiting := v_waiting + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'words', v_words, 'candidates', v_cands, 'waiting_article', v_waiting);
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_dispatch_v1(p_exclude_job_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_cfg public.synonym_pipeline_config%rowtype;
  v_job uuid;
  v_user text;
  v_target record;
  v_card record;
  v_item uuid;
  v_items integer := 0;
  v_targets integer := 0;
  v_ready integer := 0;
  v_not integer := 0;
  v_pos integer := 0;
  v_unready integer;
  v_today integer;
  v_in_job integer := 0;
  v_jobs jsonb := '[]'::jsonb;
  v_known integer;
  v_in_catalog boolean := true;
  v_new_expr integer := 0;
  v_resolution text;
  v_accepted constant text[] := ARRAY['multi_source','usage_verified','authoritative','verified',
    'source_verified','multi_source_verified'];
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_pipeline_config WHERE singleton;
  IF NOT v_cfg.pipeline_enabled THEN RETURN jsonb_build_object('ok', true, 'dispatched', false, 'reason', 'pipeline_disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261027, 2);

  -- agreed 27.10.2026: no wait for another active child job. A target that
  -- already waits in an active child job is joined to it (no second item for
  -- the same word). dispatcher_batch_size targets per child job; the daily
  -- limit is checked before each new child job.
  SELECT count(*) INTO v_today FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'synonym_candidate' AND j.created_at > now() - interval '24 hours';

  FOR v_target IN
    SELECT lower(btrim(c.target_text)) AS norm, c.target_kind AS kind, min(c.created_at) AS first_at
    FROM public.synonym_candidate_queue c
    WHERE c.dispatch_status = 'pending' AND c.source_active AND c.origin_depth = 0
      AND c.pipeline_version = v_cfg.pipeline_version AND c.target_kind IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 3, 1
  LOOP
    -- the same target already waits in an active child job: join it
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'in_child_job',
      child_job_id = o.child_job_id, dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now()
    FROM (SELECT c2.child_job_id FROM public.synonym_candidate_queue c2
          JOIN public.lexeme_processing_jobs j2 ON j2.id = c2.child_job_id
          LEFT JOIN public.pipeline_supervisor_state s2 ON s2.job_id = j2.id
          WHERE c2.dispatch_status = 'in_child_job' AND lower(btrim(c2.target_text)) = v_target.norm
            AND c2.child_job_id IS DISTINCT FROM p_exclude_job_id  -- the job that is just ending
            AND c2.target_kind = v_target.kind
            AND (s2.stage IS NULL OR s2.stage NOT IN ('done','needs_manual_review'))
          ORDER BY c2.dispatched_at LIMIT 1) o
    WHERE c.dispatch_status = 'pending' AND c.source_active AND c.origin_depth = 0
      AND lower(btrim(c.target_text)) = v_target.norm AND c.target_kind = v_target.kind;
    IF FOUND THEN CONTINUE; END IF;

    IF v_target.kind = 'expression' THEN
      SELECT x.id, x.normalized_key, x.verification_status INTO v_card
      FROM public.expression_catalog x WHERE x.normalized_key = v_target.norm
      ORDER BY (x.lexeme_id IS NULL), x.id LIMIT 1;
      v_in_catalog := FOUND;
      IF NOT v_in_catalog THEN
        -- D10 29.10.2026 (agreed, variant A): an expression that is not in the
        -- catalog first goes to the expression resolver (synonym-verifier):
        -- Ordbøkene phrase search -> its own article -> the head word article
        -- (referers) -> the expressions of that article are extracted by the
        -- existing ordbokene chain -> the expression comes back here as a
        -- catalog entry. Not found in Ordbøkene -> NAOB explanation.
        INSERT INTO public.synonym_expression_resolution_v1 AS r (norm_text, status)
        VALUES (v_target.norm, 'queued')
        ON CONFLICT (norm_text) DO UPDATE SET status = 'queued', attempts = 0, rounds = 0,
          next_attempt_at = NULL, last_error = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
        WHERE r.status IN ('failed', 'resolved')
        RETURNING r.status INTO v_resolution;
        IF v_resolution IS NULL THEN
          SELECT r.status INTO v_resolution FROM public.synonym_expression_resolution_v1 r WHERE r.norm_text = v_target.norm;
        END IF;
        IF v_resolution = 'explanation' THEN
          UPDATE public.synonym_candidate_queue SET dispatch_status = 'not_dispatchable', stage1_status = 'rejected',
            verification_evidence = verification_evidence || jsonb_build_object('stage_a',
              jsonb_build_object('reason', 'naob_explanation', 'prepared_at', now(), 'by', 'expression_resolver')),
            updated_at = now()
          WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        ELSE
          UPDATE public.synonym_candidate_queue SET dispatch_status = 'awaiting_parent',
            stage1_status = 'awaiting_target_resolution', updated_at = now()
          WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        END IF;
        v_new_expr := v_new_expr + 1;
        CONTINUE;
      ELSIF coalesce(v_card.verification_status, '') = ANY (v_accepted) THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'expression'), updated_at = now()
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        v_ready := v_ready + 1; CONTINUE;
      END IF;
    ELSE
      -- a word: main cards with a known part of speech; ready when none of
      -- them needs work (active + accepted verification)
      SELECT count(*) FILTER (WHERE NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))),
             count(*)
        INTO v_unready, v_known
      FROM public.lexemes l
      WHERE lower(btrim(l.lemma)) = v_target.norm AND coalesce(l.homograph_key, '') = ''
        AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown');
      IF v_known > 0 AND v_unready = 0 THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'lexeme'), updated_at = now()
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'lexeme';
        v_ready := v_ready + 1; CONTINUE;
      END IF;
      IF v_known = 0 THEN
        -- D10 29.10.2026 (agreed): a word that has no card yet first goes to the
        -- resolver, which reads its Ordbøkene articles: one item per part of
        -- speech found (was: one item without part of speech -> the gate stopped
        -- it with unknown_pos_requires_review: feste, overstå, rangle).
        INSERT INTO public.synonym_expression_resolution_v1 AS r (norm_text, status, kind)
        VALUES (v_target.norm, 'queued', 'word')
        ON CONFLICT (norm_text) DO UPDATE SET status = 'queued', kind = 'word', attempts = 0, rounds = 0,
          next_attempt_at = NULL, last_error = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
        WHERE r.status IN ('failed', 'resolved');
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'awaiting_parent',
          stage1_status = 'awaiting_target_resolution', updated_at = now()
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'lexeme';
        v_new_expr := v_new_expr + 1;
        CONTINUE;
      END IF;
    END IF;

    -- a full child job is closed; the next target opens a new one
    IF v_job IS NOT NULL AND v_in_job >= v_cfg.dispatcher_batch_size THEN
      PERFORM public.d10_synonym_close_child_job_v1(v_job);
      v_jobs := v_jobs || to_jsonb(v_job);
      v_job := NULL;
      v_in_job := 0;
    END IF;
    -- the child job is created with the first target that needs work
    IF v_job IS NULL THEN
      EXIT WHEN v_today >= v_cfg.daily_job_limit;
      v_today := v_today + 1;
      SELECT j.user_id INTO v_user FROM public.synonym_candidate_queue c
      JOIN public.lexeme_processing_jobs j ON j.id = c.source_job_id
      WHERE c.dispatch_status = 'pending' AND lower(btrim(c.target_text)) = v_target.norm
      ORDER BY c.created_at LIMIT 1;
      INSERT INTO public.lexeme_processing_jobs (user_id, input_type, input_text, status,
        total_items, done_items, partial_items, failed_items, skipped_items, summary, created_at, updated_at)
      VALUES (v_user, 'synonym_candidate', '', 'pending', 0, 0, 0, 0, 0,
        jsonb_build_object('created_by', 'd10_synonym_dispatch_v1', 'origin_type', 'synonym_candidate',
          'origin_depth', 1, 'pipeline_version', v_cfg.pipeline_version,
          'ingestion_version', 'd10_synonym_child_job_v1'), now(), now())
      RETURNING id INTO v_job;
    END IF;

    IF v_target.kind = 'expression' THEN
      INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
      VALUES (v_job, CASE WHEN v_in_catalog THEN v_card.id END, NULL, v_target.norm, v_target.norm,
        CASE WHEN v_in_catalog THEN v_card.normalized_key ELSE v_target.norm END, v_target.norm,
        'expression', 'expression', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
          'expression_in_catalog', v_in_catalog))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', CASE WHEN v_in_catalog THEN v_card.normalized_key ELSE v_target.norm END,
        v_target.norm, 'expression', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
      v_items := v_items + 1; v_pos := v_pos + 1;
    ELSE
      -- like analyze-text for a single word: one item per known part of
      -- speech that still needs work (not the first homonym!), or one item
      -- without part of speech for a word that is not in the database yet
      IF v_known > 0 THEN
        FOR v_card IN
          SELECT l.id, l.lemma, l.pos FROM public.lexemes l
          WHERE lower(btrim(l.lemma)) = v_target.norm AND coalesce(l.homograph_key, '') = ''
            AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
            AND NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))
          ORDER BY l.pos, l.id
        LOOP
          INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
            normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
          VALUES (v_job, NULL, NULL, v_target.norm, v_target.norm, lower(btrim(v_card.lemma)), v_target.norm,
            v_card.pos, 'token', 'pending', 'source_checks', 0, 3,
            jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
              'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
              'resolved_lexeme_id', v_card.id, 'resolved_lemma', v_card.lemma, 'resolved_pos', v_card.pos))
          RETURNING id INTO v_item;
          INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
            query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
          SELECT v_job, v_item, v_card.id, s, 'lemma', lower(btrim(v_card.lemma)), v_target.norm, 'token', 'pending', 0, 3,
            '{}'::jsonb, '[]'::jsonb, 1
          FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
          v_items := v_items + 1;
        END LOOP;
      ELSE
        INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
          normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
        VALUES (v_job, NULL, NULL, v_target.norm, v_target.norm, v_target.norm, v_target.norm,
          NULL, 'token', 'pending', 'source_checks', 0, 3,
          jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
            'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1))
        RETURNING id INTO v_item;
        INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
          query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
        SELECT v_job, v_item, NULL, s, 'lemma', v_target.norm, v_target.norm, 'token', 'pending', 0, 3,
          '{}'::jsonb, '[]'::jsonb, 1
        FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
        v_items := v_items + 1;
      END IF;
      v_pos := v_pos + 1;
    END IF;

    UPDATE public.synonym_candidate_queue SET dispatch_status = 'in_child_job', child_job_id = v_job,
      dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now()
    WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
      AND lower(btrim(target_text)) = v_target.norm AND target_kind = v_target.kind;
    v_targets := v_targets + 1;
    v_in_job := v_in_job + 1;
  END LOOP;

  IF v_job IS NOT NULL THEN
    PERFORM public.d10_synonym_close_child_job_v1(v_job);
    v_jobs := v_jobs || to_jsonb(v_job);
  END IF;
  RETURN jsonb_build_object('ok', true, 'dispatched', jsonb_array_length(v_jobs) > 0, 'child_job_ids', v_jobs,
    'targets', v_targets, 'items', v_items, 'skipped_ready', v_ready, 'not_dispatchable', v_not, 'new_expressions', v_new_expr,
    'daily_limit_reached', v_today >= v_cfg.daily_job_limit);
END
$function$
;

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
        b.root_lexeme_id, b.source_article_id AS root_article_id,
        e.lemma, e.expression_subtype
      FROM verified_roots root
      JOIN private.lexeme360_expression_roots_v1 b
        ON b.root_lexeme_id = root.root_lexeme_id
       AND b.source_article_id = root.article_id
       AND b.dictionary_code = 'bm'
       AND b.source_kind = 'ordbokene_parent_article'
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
        'identity_source', 'ordbokene_parent_article_binding_v1')
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
      AND b.dictionary_code = 'bm'
      AND b.source_kind = 'ordbokene_parent_article'
      AND b.source_article_id::text IN (
        SELECT jsonb_array_elements_text(sc.evidence->'raw_preview'->'article_ids'))
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
    'has_more', v_has_more, 'version', 'd10_verified_verb_family_v3');
END;
$function$
;

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

  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'enrichment_done', v_done,
    'deferred_marked', v_deferred, 'deferred_cleared', v_cleared, 'dispatch', v_dispatch, 'pairs', v_pairs,
    'bm', v_bm);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
END
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_publish_siblings_v1(p_gloss_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
        AND c.source_active AND p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')
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
    IF v_id IS NULL THEN
      UPDATE public.synonym_candidate_queue SET source_active=true,
        naob_gloss=coalesce(nullif(r.sense,''),r.item_text),
        verification_evidence=verification_evidence || jsonb_build_object('parent_pairs',jsonb_build_array(r.pair_id,r.b_pair)),
        updated_at=now()
      WHERE coalesce(gloss_id,bm_gloss_id)=p_gloss_id AND source_entity_type=r.tt AND source_entity_id=r.ti
        AND target_kind=r.b_tt AND lower(btrim(target_text))=lower(btrim(r.b_lemma))
        AND source_sense_anchor LIKE 'sib:%' AND (NOT source_active OR naob_gloss IS DISTINCT FROM coalesce(nullif(r.sense,''),r.item_text))
      RETURNING id INTO v_id;
    END IF;
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
$function$
;

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
  IF NOT v_cfg.enabled THEN RETURN public.d10_synonym_maintenance_v1(); END IF;
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
  FROM private.synonym_collection_budget_v1 w WHERE w.collected_at > now() - interval '24 hours';
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
    INSERT INTO private.synonym_collection_budget_v1(lexeme_id) VALUES(r.id);
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
$function$
;

CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT 'ai:synonym_pair_v5:' || model FROM public.synonym_verifier_config_v1 WHERE singleton;
$function$
;

DROP TRIGGER trg_d10_synonym_pair_publish_v1 ON public.synonym_pair_v1;
CREATE TRIGGER trg_d10_synonym_pair_publish_v1 AFTER INSERT OR UPDATE OF status,decision ON public.synonym_pair_v1 FOR EACH ROW EXECUTE FUNCTION public.d10_synonym_pair_publish_trg_v1();

-- Family 360 remains deliberately incomplete until a successful full run confirms it.
UPDATE private.d10_deferred_enrichment_v1 SET facets=array_remove(facets,'synonyms')
WHERE 'synonyms'=ANY(facets) AND 'family_360'=ANY(facets);

CREATE FUNCTION public.d10_problem_cards_v3(p_limit integer DEFAULT 300)
RETURNS TABLE(lexeme_id uuid,lemma text,pos text,display_form text,homograph_key text,
 missing_translation boolean,missing_example boolean,review_reason text,legacy boolean,
 deferred_by_policy boolean,deferred_facets text[],synonym_status text,synonym_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 WITH base AS (SELECT * FROM public.d10_problem_cards_v2(1000)),
 states AS MATERIALIZED (
  SELECT DISTINCT ON (card_id) card_id,state
  FROM (SELECT CASE WHEN s.entity_type='lexeme' THEN s.entity_id ELSE x.lexeme_id END card_id,
     public.d10_synonym_entity_status_v1(s.entity_type,s.entity_id) state
   FROM private.synonym_collection_state_v1 s
   LEFT JOIN public.expression_catalog x ON s.entity_type='expression' AND x.id=s.entity_id) q
  WHERE card_id IS NOT NULL ORDER BY card_id,CASE state->>'status' WHEN 'error' THEN 0 WHEN 'waiting' THEN 1 WHEN 'deferred' THEN 2 ELSE 3 END
 ), ids AS (
  SELECT b.lexeme_id id FROM base b UNION SELECT card_id FROM states WHERE state->>'status' IN ('error','waiting','deferred')
 )
 SELECT l.id,l.lemma,l.pos,l.display_form,coalesce(l.homograph_key,''),
  coalesce(b.missing_translation,false),coalesce(b.missing_example,false),b.review_reason,coalesce(b.legacy,false),
  coalesce(b.deferred_by_policy,false),b.deferred_facets,s.state->>'status',(s.state->>'checked_at')::timestamptz
 FROM ids JOIN public.lexemes l ON l.id=ids.id LEFT JOIN base b ON b.lexeme_id=l.id LEFT JOIN states s ON s.card_id=l.id
 ORDER BY coalesce(b.missing_translation,false) DESC,(s.state->>'status'='error') DESC NULLS LAST,l.lemma,l.id
 LIMIT least(greatest(coalesce(p_limit,300),1),1000)
$f$;
CREATE FUNCTION public.d10_problem_cards_count_v3()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT count(*)::integer FROM public.d10_problem_cards_v3(1000)
$f$;

-- New internal functions and history remain service-only. Lexical read-only status uses existing app roles.
DO $acl$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
  'd10_synonym_event_v1','d10_synonym_examples_v1','d10_synonym_enqueue_refresh_v1',
  'd10_synonym_drain_refresh_v1','d10_synonym_recheck_entity_v1','d10_synonym_collection_event_v1',
  'd10_synonym_candidate_changed_v1','d10_synonym_parent_changed_v1','d10_synonym_maintenance_v1',
  'd10_synonym_entity_status_v1','d10_synonym_coverage_v1','d10_problem_cards_v3','d10_problem_cards_count_v3')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.sig);
 END LOOP;
END $acl$;
GRANT EXECUTE ON FUNCTION public.d10_problem_cards_v3(integer),public.d10_problem_cards_count_v3(),
 public.d10_synonym_entity_status_v1(text,uuid) TO anon,authenticated;
-- Preserve operator choices. In particular, NEVER enable the mass collector here.
COMMIT;

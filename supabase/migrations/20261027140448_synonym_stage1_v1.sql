-- Stage 1 only. No jobs, network, cron, backfill invocation or publication changes.
-- Reviewed supplied Production function/trigger definitions; full table DDL is not supplied.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fail closed if the assumed identity types are not present.
DO $preflight$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['naob_expression_glosses','authoritative_semantic_relations','lexeme_processing_jobs'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = to_regclass('public.' || t) AND attname = 'id'
        AND atttypid = 'uuid'::regtype AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Stage 1 requires public.%.id uuid; review actual DDL first', t;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TABLE public.synonym_pipeline_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  pipeline_enabled boolean NOT NULL DEFAULT false,
  publish_verified_only boolean NOT NULL DEFAULT false,
  daily_job_limit integer NOT NULL DEFAULT 20 CHECK (daily_job_limit BETWEEN 0 AND 500),
  dispatcher_batch_size integer NOT NULL DEFAULT 5 CHECK (dispatcher_batch_size BETWEEN 1 AND 50),
  max_concurrent_jobs integer NOT NULL DEFAULT 1 CHECK (max_concurrent_jobs BETWEEN 1 AND 2),
  max_auto_origin_depth integer NOT NULL DEFAULT 0 CHECK (max_auto_origin_depth = 0),
  pipeline_version text NOT NULL DEFAULT 'synonym-v1',
  normalization_version text NOT NULL DEFAULT 'nb-v1',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.synonym_pipeline_config(singleton) VALUES (true);

CREATE TABLE public.semantic_senses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('lexeme','expression')),
  entity_id uuid NOT NULL,
  semantic_pos text,
  source text NOT NULL,
  source_article_id text NOT NULL,
  source_sense_key text NOT NULL,
  definition text,
  context_label text,
  definition_hash text,
  verification_status text NOT NULL DEFAULT 'candidate'
    CHECK (verification_status IN ('candidate','verified','needs_review','rejected')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source, source_article_id, source_sense_key)
);
CREATE INDEX semantic_senses_entity_idx ON public.semantic_senses(entity_type,entity_id);

CREATE TABLE public.synonym_gloss_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gloss_id uuid NOT NULL REFERENCES public.naob_expression_glosses(id) ON DELETE RESTRICT,
  pipeline_version text NOT NULL DEFAULT 'synonym-v1',
  queue_status text NOT NULL CHECK (queue_status IN
    ('queued','reference_pending','processing','processed','retry_wait','failed','ignored')),
  source_fingerprint text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  origin_depth integer NOT NULL DEFAULT 0 CHECK (origin_depth BETWEEN 0 AND 8),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gloss_id,pipeline_version)
);
CREATE INDEX synonym_gloss_queue_claim_idx ON public.synonym_gloss_queue
  (queue_status,next_attempt_at,created_at);

CREATE TABLE public.synonym_target_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_norm text NOT NULL CHECK (length(btrim(target_norm)) > 0),
  target_kind text NOT NULL CHECK (target_kind IN ('lexeme','expression')),
  semantic_pos text NOT NULL CHECK (length(btrim(semantic_pos)) > 0),
  normalization_version text NOT NULL DEFAULT 'nb-v1',
  pipeline_version text NOT NULL DEFAULT 'synonym-v1',
  queue_status text NOT NULL DEFAULT 'queued' CHECK (queue_status IN
    ('queued','enriching','skipped_ready','enrichment_ready','retry_wait','enrichment_failed')),
  job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  origin_depth integer NOT NULL DEFAULT 0 CHECK (origin_depth BETWEEN 0 AND 8),
  target_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(target_entity_ids) = 'array'),
  snapshot_hash text,
  snapshot_version integer NOT NULL DEFAULT 0 CHECK (snapshot_version >= 0),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_norm,target_kind,semantic_pos,normalization_version,pipeline_version)
);
CREATE INDEX synonym_target_queue_claim_idx ON public.synonym_target_queue
  (queue_status,next_attempt_at,created_at);
CREATE INDEX synonym_target_queue_job_idx ON public.synonym_target_queue(job_id) WHERE job_id IS NOT NULL;

CREATE TABLE public.synonym_candidate_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relation_id uuid REFERENCES public.authoritative_semantic_relations(id) ON DELETE RESTRICT,
  gloss_id uuid REFERENCES public.naob_expression_glosses(id) ON DELETE RESTRICT,
  pipeline_version text NOT NULL DEFAULT 'synonym-v1',
  source_entity_type text NOT NULL CHECK (source_entity_type IN ('lexeme','expression')),
  source_entity_id uuid NOT NULL,
  source_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE RESTRICT,
  source_semantic_pos text,
  source_sense_anchor text,
  naob_slug text,
  naob_gloss text,
  context_label text,
  target_text text NOT NULL CHECK (length(btrim(target_text)) > 0),
  target_kind text CHECK (target_kind IN ('lexeme','expression')),
  expected_pos text,
  target_queue_id uuid REFERENCES public.synonym_target_queue(id) ON DELETE RESTRICT,
  stage1_status text NOT NULL DEFAULT 'candidate' CHECK (stage1_status IN
    ('candidate','awaiting_pos_resolution','awaiting_target_resolution','needs_manual_review','waiting_enrichment','verification_queued',
     'verified_synonym','contextual_synonym','near_synonym','related','rejected','failed')),
  origin_depth integer NOT NULL DEFAULT 0 CHECK (origin_depth BETWEEN 0 AND 8),
  target_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE RESTRICT,
  recognition_level text,
  verification_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  verifier_version text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (relation_id IS NOT NULL OR gloss_id IS NOT NULL),
  UNIQUE(relation_id,pipeline_version)
);
CREATE UNIQUE INDEX synonym_candidate_gloss_target_uidx ON public.synonym_candidate_queue
  (gloss_id,lower(btrim(target_text)),pipeline_version) WHERE gloss_id IS NOT NULL;
CREATE INDEX synonym_candidate_target_idx ON public.synonym_candidate_queue(target_queue_id,stage1_status);
CREATE INDEX synonym_candidate_source_idx ON public.synonym_candidate_queue(source_entity_type,source_entity_id);

CREATE TABLE public.synonym_verification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.synonym_candidate_queue(id) ON DELETE RESTRICT,
  target_queue_id uuid NOT NULL REFERENCES public.synonym_target_queue(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
  pipeline_version text NOT NULL DEFAULT 'synonym-v1',
  snapshot_version integer NOT NULL CHECK (snapshot_version > 0),
  snapshot_hash text NOT NULL,
  source_fingerprint text NOT NULL,
  verifier_version text NOT NULL DEFAULT 'synonym-verifier-v1',
  queue_status text NOT NULL DEFAULT 'queued' CHECK (queue_status IN
    ('queued','processing','retry_wait','done','failed','superseded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id,target_queue_id,pipeline_version,snapshot_version,source_fingerprint,verifier_version)
);
CREATE INDEX synonym_verification_claim_idx ON public.synonym_verification_queue
  (queue_status,next_attempt_at,created_at);

ALTER TABLE public.authoritative_semantic_relations
  ADD COLUMN source_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE RESTRICT,
  ADD COLUMN target_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE RESTRICT,
  ADD COLUMN relation_class text CHECK (relation_class IN
    ('verified_synonym','contextual_synonym','near_synonym','related','rejected')),
  ADD COLUMN recognition_level text,
  ADD COLUMN verification_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN verifier_version text,
  ADD COLUMN verified_at timestamptz;

-- No existing rows are scanned or enqueued. Only future extractor writes are captured.
-- Invoker is intentional: extractor uses service_role; ordinary clients cannot write queues.
CREATE FUNCTION public.enqueue_naob_synonym_gloss_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  v_hash text;
  v_status text;
  v_version text;
  v_depth integer;
BEGIN
  SELECT pipeline_version INTO STRICT v_version FROM public.synonym_pipeline_config WHERE singleton;
  v_hash := md5(jsonb_build_array(NEW.normalized_key,NEW.naob_slug,NEW.anchor_id,
    NEW.expression_lemma,NEW.gloss_index,NEW.gloss_type,NEW.gloss_text,
    NEW.context_label,NEW.extractor_version,NEW.anchor_id_source)::text);
  -- Future dispatcher must SET LOCAL this value for extractor writes in its transaction.
  -- Stage 1 itself dispatches nothing. Depth enforcement is required again in dispatcher.
  v_depth := coalesce(nullif(current_setting('norsktrainer.synonym_origin_depth',true),''),'0')::integer;
  IF v_depth NOT BETWEEN 0 AND 8 THEN RAISE EXCEPTION 'Invalid synonym origin depth'; END IF;
  v_status := CASE NEW.gloss_type WHEN 'direct' THEN 'queued'
    WHEN 'reference' THEN 'reference_pending' ELSE 'ignored' END;
  IF v_status = 'ignored' THEN
    -- Invalidate a previous queued direct/reference when the source loses its gloss.
    UPDATE public.synonym_gloss_queue SET queue_status='ignored',source_fingerprint=v_hash,
      lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE gloss_id=NEW.id AND pipeline_version=v_version
      AND (source_fingerprint IS DISTINCT FROM v_hash OR queue_status <> 'ignored');
    RETURN NEW;
  END IF;
  INSERT INTO public.synonym_gloss_queue AS q
    (gloss_id,pipeline_version,queue_status,source_fingerprint,origin_depth)
  VALUES (NEW.id,v_version,v_status,v_hash,v_depth)
  ON CONFLICT(gloss_id,pipeline_version) DO UPDATE SET
    queue_status=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint
      THEN EXCLUDED.queue_status ELSE q.queue_status END,
    source_fingerprint=EXCLUDED.source_fingerprint,
    origin_depth=least(q.origin_depth,EXCLUDED.origin_depth),
    attempts=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN 0 ELSE q.attempts END,
    next_attempt_at=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN NULL ELSE q.next_attempt_at END,
    last_error=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN NULL ELSE q.last_error END,
    lease_token=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN NULL ELSE q.lease_token END,
    lease_until=CASE WHEN q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint THEN NULL ELSE q.lease_until END,
    updated_at=now()
  WHERE q.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint
    OR EXCLUDED.origin_depth < q.origin_depth;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER enqueue_naob_synonym_gloss_v1
AFTER INSERT OR UPDATE OF normalized_key,naob_slug,anchor_id,expression_lemma,
  gloss_index,gloss_type,gloss_text,context_label,extractor_version,anchor_id_source
ON public.naob_expression_glosses FOR EACH ROW
EXECUTE FUNCTION public.enqueue_naob_synonym_gloss_v1();

-- Definition only. Never invoked by this migration or by the read-only check.
-- Unknown POS/kind is retained for review, never guessed from the old target binding.
CREATE FUNCTION public.d10_synonym_backfill_v1(p_limit integer DEFAULT 20,p_dry_run boolean DEFAULT true)
RETURNS TABLE(dry_run boolean,selected_relations integer,unique_targets integer,
  awaiting_resolution integer,inserted_targets integer,inserted_candidates integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  v_rows jsonb;
  v_selected integer;
  v_unique integer;
  v_review integer;
  v_targets integer := 0;
  v_candidates integer := 0;
  v_version text;
  v_norm_version text;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'limit must be 1..100 and dry_run must be explicit non-null';
  END IF;
  IF NOT p_dry_run THEN
    -- Serialize this bounded maintenance operation, without locking source rows.
    PERFORM pg_catalog.pg_advisory_xact_lock(20261027,1);
  END IF;
  SELECT pipeline_version,normalization_version INTO STRICT v_version,v_norm_version
    FROM public.synonym_pipeline_config WHERE singleton;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
    SELECT r.id AS relation_id,r.source_entity_type,r.source_entity_id,
      coalesce(r.target_text,'') AS target_text,
      lower(btrim(regexp_replace(coalesce(r.target_text,''),'\s+',' ','g'))) AS target_norm,
      -- Single tokens are lexeme candidates; multiword kind needs semantic review.
      CASE WHEN btrim(r.target_text) !~ '\s' AND btrim(r.target_text) <> ''
        THEN 'lexeme'::text END AS target_kind,
      CASE WHEN r.source_entity_type='lexeme' THEN nullif(btrim(l.pos::text),'') END AS semantic_pos,
      coalesce(r.evidence,'{}'::jsonb) AS legacy_evidence
    FROM public.authoritative_semantic_relations r
    LEFT JOIN public.lexemes l ON r.source_entity_type='lexeme' AND l.id=r.source_entity_id
    WHERE r.relation_type='synonym' AND r.status='candidate'
      AND length(btrim(coalesce(r.target_text,''))) > 0
      AND NOT EXISTS (SELECT 1 FROM public.synonym_candidate_queue c
        WHERE c.relation_id=r.id AND c.pipeline_version=v_version)
    ORDER BY r.created_at,r.id LIMIT p_limit
  ) x;
  SELECT count(*)::integer,
    count(*) FILTER (WHERE x->>'semantic_pos' IS NULL OR x->>'target_kind' IS NULL)::integer
    INTO v_selected,v_review FROM jsonb_array_elements(v_rows) x;
  SELECT count(*)::integer INTO v_unique FROM (
    SELECT DISTINCT x->>'target_norm',x->>'target_kind',x->>'semantic_pos'
    FROM jsonb_array_elements(v_rows) x
    WHERE x->>'semantic_pos' IS NOT NULL AND x->>'target_kind' IS NOT NULL
  ) q;
  IF p_dry_run THEN
    RETURN QUERY SELECT true,v_selected,v_unique,v_review,0,0; RETURN;
  END IF;
  WITH ins AS (
    INSERT INTO public.synonym_target_queue(target_norm,target_kind,semantic_pos,
      pipeline_version,normalization_version)
    SELECT DISTINCT x->>'target_norm',x->>'target_kind',x->>'semantic_pos',v_version,v_norm_version
    FROM jsonb_array_elements(v_rows) x
    WHERE x->>'semantic_pos' IS NOT NULL AND x->>'target_kind' IS NOT NULL
    ON CONFLICT(target_norm,target_kind,semantic_pos,normalization_version,pipeline_version) DO NOTHING
    RETURNING id
  ) SELECT count(*)::integer INTO v_targets FROM ins;
  WITH ins AS (
    INSERT INTO public.synonym_candidate_queue(relation_id,source_entity_type,source_entity_id,
      target_text,target_kind,source_semantic_pos,expected_pos,target_queue_id,stage1_status,
      verification_evidence,pipeline_version)
    SELECT (x->>'relation_id')::uuid,x->>'source_entity_type',(x->>'source_entity_id')::uuid,
      x->>'target_text',x->>'target_kind',x->>'semantic_pos',x->>'semantic_pos',q.id,
      CASE WHEN x->>'semantic_pos' IS NULL THEN 'awaiting_pos_resolution'
        WHEN q.id IS NULL THEN 'awaiting_target_resolution' ELSE 'waiting_enrichment' END,
      jsonb_build_object('legacy_evidence',x->'legacy_evidence','identity_requires_reverification',true,
        'kind_policy','single_token_lexeme_multiword_review','source','bounded_legacy_backfill'),v_version
    FROM jsonb_array_elements(v_rows) x
    LEFT JOIN public.synonym_target_queue q ON q.target_norm=x->>'target_norm'
      AND q.target_kind=x->>'target_kind' AND q.semantic_pos=x->>'semantic_pos'
      AND q.pipeline_version=v_version AND q.normalization_version=v_norm_version
    ON CONFLICT(relation_id,pipeline_version) DO NOTHING RETURNING id
  ) SELECT count(*)::integer INTO v_candidates FROM ins;
  RETURN QUERY SELECT false,v_selected,v_unique,v_review,v_targets,v_candidates;
END
$fn$;

ALTER TABLE public.synonym_pipeline_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_pipeline_config FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.synonym_pipeline_config TO service_role;

ALTER TABLE public.semantic_senses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.semantic_senses FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.semantic_senses TO service_role;

ALTER TABLE public.synonym_gloss_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_gloss_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.synonym_gloss_queue TO service_role;

ALTER TABLE public.synonym_target_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_target_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.synonym_target_queue TO service_role;

ALTER TABLE public.synonym_candidate_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_candidate_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.synonym_candidate_queue TO service_role;

ALTER TABLE public.synonym_verification_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_verification_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.synonym_verification_queue TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_naob_synonym_gloss_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_backfill_v1(integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_naob_synonym_gloss_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_backfill_v1(integer,boolean) TO service_role;
-- Publication, legacy relations, resolver, UI and cron are intentionally untouched.
COMMIT;

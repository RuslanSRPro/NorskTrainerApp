-- D10 text-analysis recovery: per-item residue tracking.
-- New migration; no previously applied migration is modified.
BEGIN;

CREATE TABLE private.d10_job_enrichment_item_state_v1 (
  job_id uuid NOT NULL REFERENCES public.lexeme_processing_jobs(id) ON DELETE CASCADE,
  chain text NOT NULL CHECK (chain IN (
    'ordbokene','naob','naob_synonyms','lexeme_translation',
    'expression_translation','authoritative','expression_ai_fallback',
    'authoritative_ai_fallback','translation_reorder',
    'translation_canonicalization','forms'
  )),
  item_id uuid NOT NULL REFERENCES public.lexeme_processing_items(id) ON DELETE CASCADE,
  lexeme_id uuid REFERENCES public.lexemes(id),
  expression_id uuid REFERENCES public.expression_catalog(id),
  status text NOT NULL CHECK (status IN ('processing','done','no_data','retry','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  outcome_code text,
  last_error text,
  result_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (job_id, chain, item_id),
  CHECK (lexeme_id IS NOT NULL OR expression_id IS NOT NULL)
);

CREATE INDEX d10_job_enrichment_residue_v1_idx
  ON private.d10_job_enrichment_item_state_v1(job_id, chain, status, next_retry_at);

ALTER TABLE private.d10_job_enrichment_item_state_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.d10_job_enrichment_item_state_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.d10_job_enrichment_item_state_v1 FROM PUBLIC, anon, authenticated;

-- Multi-example read model reserved for Lexeme360. The general card/audit
-- RPC intentionally remains one row per lexeme.
CREATE OR REPLACE FUNCTION public.get_lexeme360_examples_v1(
  p_lexeme_ids uuid[] DEFAULT '{}'::uuid[],
  p_expression_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS TABLE(lexeme_id uuid, expression_id uuid, id uuid,
  example_text text, translation_uk text, source text, cefr_level text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $body$
  WITH requested_lexemes AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_lexeme_ids,'{}'::uuid[])) id
  ), requested_expressions AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_expression_ids,'{}'::uuid[])) id
  ), candidates AS (
    SELECT coalesce(e.lexeme_id, mapped.lexeme_id) AS resolved_lexeme_id,
      e.expression_id,e.id,e.example_text,e.translation_uk,e.source,NULL::text AS cefr_level,
      row_number() OVER (PARTITION BY coalesce(e.lexeme_id,mapped.lexeme_id),e.expression_id
      ORDER BY CASE WHEN e.source='ai_fallback' THEN 10 ELSE 0 END,
        CASE WHEN e.translation_uk ~ '[[:alpha:]]' THEN 0 ELSE 2 END,e.id) AS rank
    FROM public.entity_examples e
    LEFT JOIN public.expression_catalog mapped ON mapped.id=e.expression_id
    WHERE e.language_code='nb' AND e.example_text ~ '[[:alpha:]]'
      AND e.example_text !~* '^[[:space:]]*(https?://|<)'
      AND (coalesce(e.lexeme_id,mapped.lexeme_id) IN (SELECT id FROM requested_lexemes)
        OR e.expression_id IN (SELECT id FROM requested_expressions))
  )
  SELECT c.resolved_lexeme_id,c.expression_id,c.id,c.example_text,c.translation_uk,c.source,c.cefr_level
  FROM candidates c WHERE c.rank<=3
  ORDER BY coalesce(c.resolved_lexeme_id,c.expression_id),c.rank;
$body$;
REVOKE ALL ON FUNCTION public.get_lexeme360_examples_v1(uuid[],uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lexeme360_examples_v1(uuid[],uuid[]) TO authenticated,service_role;

-- Claim only the unresolved residue supplied by the stable worker page.
-- Missing rows are pending. Expired processing rows are reclaimable.
CREATE OR REPLACE FUNCTION public.d10_claim_enrichment_residue_v1(
  p_job_id uuid,
  p_chain text,
  p_item_ids uuid[],
  p_stale_seconds integer DEFAULT 180
) RETURNS TABLE(item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
#variable_conflict use_column
BEGIN
  IF p_job_id IS NULL OR nullif(btrim(p_chain),'') IS NULL
     OR p_item_ids IS NULL OR cardinality(p_item_ids) > 30
     OR array_position(p_item_ids,NULL) IS NOT NULL
     OR p_stale_seconds NOT BETWEEN 60 AND 3600 THEN
    RAISE EXCEPTION 'INVALID_ENRICHMENT_RESIDUE_CLAIM';
  END IF;

  -- A worker that died before recording an outcome leaves `processing` behind.
  -- Count that execution as an attempt before making it claimable again.
  UPDATE private.d10_job_enrichment_item_state_v1 state
  SET attempt_count=state.attempt_count+1,
      status=CASE WHEN state.attempt_count+1>=3 THEN 'failed' ELSE 'retry' END,
      finished_at=CASE WHEN state.attempt_count+1>=3 THEN clock_timestamp() ELSE NULL END,
      next_retry_at=CASE WHEN state.attempt_count+1>=3 THEN NULL ELSE clock_timestamp() END,
      outcome_code=CASE WHEN state.attempt_count+1>=3 THEN 'stale_processing_exhausted' ELSE 'stale_processing_recovered' END,
      last_error='worker ended before recording an enrichment outcome',
      updated_at=clock_timestamp()
  WHERE state.job_id=p_job_id AND state.chain=p_chain
    AND state.item_id=ANY(p_item_ids) AND state.status='processing'
    AND coalesce(state.started_at,'-infinity'::timestamptz)
      <=clock_timestamp()-make_interval(secs=>p_stale_seconds);

  UPDATE private.d10_job_enrichment_item_state_v1 state
  SET status='failed',finished_at=clock_timestamp(),next_retry_at=NULL,
      outcome_code=coalesce(state.outcome_code,'retry_exhausted'),
      last_error=coalesce(state.last_error,'retry attempts exhausted'),
      updated_at=clock_timestamp()
  WHERE state.job_id=p_job_id AND state.chain=p_chain
    AND state.item_id=ANY(p_item_ids) AND state.status='retry'
    AND state.attempt_count>=3;

  RETURN QUERY
  WITH requested AS MATERIALIZED (
    SELECT DISTINCT requested_id AS item_id
    FROM unnest(p_item_ids) requested_id
  ), eligible AS MATERIALIZED (
    SELECT i.id AS item_id, i.lexeme_id, i.expression_id
    FROM requested r
    JOIN public.lexeme_processing_items i
      ON i.id=r.item_id AND i.job_id=p_job_id
    LEFT JOIN private.d10_job_enrichment_item_state_v1 state
      ON state.job_id=p_job_id AND state.chain=p_chain AND state.item_id=i.id
    WHERE state.item_id IS NULL
       OR (state.status='retry' AND coalesce(state.next_retry_at,'-infinity'::timestamptz)<=clock_timestamp())
       OR (state.status='processing' AND coalesce(state.started_at,'-infinity'::timestamptz)
             <= clock_timestamp()-make_interval(secs=>p_stale_seconds))
  ), claimed AS (
    INSERT INTO private.d10_job_enrichment_item_state_v1 AS state(
      job_id,chain,item_id,lexeme_id,expression_id,status,started_at,
      finished_at,next_retry_at,outcome_code,last_error,result_evidence,updated_at
    )
    SELECT p_job_id,p_chain,e.item_id,e.lexeme_id,e.expression_id,'processing',
      clock_timestamp(),NULL,NULL,NULL,NULL,'{}'::jsonb,clock_timestamp()
    FROM eligible e
    ON CONFLICT (job_id,chain,item_id) DO UPDATE SET
      status='processing',started_at=clock_timestamp(),finished_at=NULL,
      next_retry_at=NULL,outcome_code=NULL,last_error=NULL,
      lexeme_id=excluded.lexeme_id,expression_id=excluded.expression_id,
      updated_at=clock_timestamp()
    RETURNING state.item_id
  )
  SELECT claimed.item_id FROM claimed ORDER BY claimed.item_id;
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_claim_enrichment_residue_v1(uuid,text,uuid[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_claim_enrichment_residue_v1(uuid,text,uuid[],integer) TO service_role;

CREATE OR REPLACE FUNCTION public.d10_record_enrichment_outcome_v1(
  p_job_id uuid,
  p_chain text,
  p_item_id uuid,
  p_status text,
  p_outcome_code text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_retry_after_seconds integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
BEGIN
  IF p_job_id IS NULL OR p_item_id IS NULL
     OR p_status NOT IN ('done','no_data','retry','failed')
     OR (p_retry_after_seconds IS NOT NULL AND p_retry_after_seconds NOT BETWEEN 1 AND 86400)
     OR NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items i
       WHERE i.id=p_item_id AND i.job_id=p_job_id) THEN
    RAISE EXCEPTION 'INVALID_ENRICHMENT_OUTCOME';
  END IF;

  UPDATE private.d10_job_enrichment_item_state_v1 state
  SET status=p_status,
      attempt_count=state.attempt_count + CASE WHEN p_status IN ('retry','failed') THEN 1 ELSE 0 END,
      finished_at=CASE WHEN p_status IN ('done','no_data','failed') THEN clock_timestamp() ELSE NULL END,
      next_retry_at=CASE WHEN p_status='retry' THEN
        clock_timestamp()+make_interval(secs=>coalesce(p_retry_after_seconds,30)) ELSE NULL END,
      outcome_code=nullif(btrim(p_outcome_code),''),
      last_error=nullif(left(coalesce(p_error,''),2000),''),
      result_evidence=coalesce(p_evidence,'{}'::jsonb),
      updated_at=clock_timestamp()
  WHERE state.job_id=p_job_id AND state.chain=p_chain AND state.item_id=p_item_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'ENRICHMENT_OUTCOME_WITHOUT_CLAIM'; END IF;
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_record_enrichment_outcome_v1(uuid,text,uuid,text,text,text,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_record_enrichment_outcome_v1(uuid,text,uuid,text,text,text,jsonb,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.d10_enrichment_residue_summary_v1(
  p_job_id uuid,
  p_chain text,
  p_item_ids uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
  WITH requested AS (
    SELECT DISTINCT requested_id AS item_id FROM unnest(coalesce(p_item_ids,'{}'::uuid[])) requested_id
  ), states AS (
    SELECT r.item_id,s.status,s.attempt_count,s.next_retry_at,s.outcome_code,s.last_error
    FROM requested r LEFT JOIN private.d10_job_enrichment_item_state_v1 s
      ON s.job_id=p_job_id AND s.chain=p_chain AND s.item_id=r.item_id
  )
  SELECT jsonb_build_object(
    'ok',true,
    'total',count(*),
    'terminal',count(*) FILTER (WHERE status IN ('done','no_data','failed')),
    'done',count(*) FILTER (WHERE status='done'),
    'no_data',count(*) FILTER (WHERE status='no_data'),
    'failed',count(*) FILTER (WHERE status='failed'),
    'waiting',count(*) FILTER (WHERE status IS NULL OR status IN ('processing','retry')),
    'failed_items',coalesce(jsonb_agg(jsonb_build_object(
      'item_id',item_id,'outcome_code',outcome_code,'error',last_error)
      ORDER BY item_id) FILTER (WHERE status='failed'),'[]'::jsonb)
  ) FROM states;
$body$;

REVOKE ALL ON FUNCTION public.d10_enrichment_residue_summary_v1(uuid,text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_enrichment_residue_summary_v1(uuid,text,uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.d10_job_enrichment_failures_v1(p_job_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'chain',s.chain,'item_id',s.item_id,'lexeme_id',s.lexeme_id,
    'expression_id',s.expression_id,'attempt_count',s.attempt_count,
    'outcome_code',s.outcome_code,'error',s.last_error)
    ORDER BY s.chain,s.item_id),'[]'::jsonb)
  FROM private.d10_job_enrichment_item_state_v1 s
  WHERE s.job_id=p_job_id AND s.status='failed';
$body$;
REVOKE ALL ON FUNCTION public.d10_job_enrichment_failures_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_job_enrichment_failures_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.d10_job_family_item_ids_v1(
  p_job_id uuid,p_item_ids uuid[]
) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
  SELECT coalesce(array_agg(f.item_id ORDER BY f.item_id),'{}'::uuid[])
  FROM private.d10_job_family_injections_v1 f
  WHERE f.job_id=p_job_id AND f.item_id=ANY(coalesce(p_item_ids,'{}'::uuid[]));
$body$;
REVOKE ALL ON FUNCTION public.d10_job_family_item_ids_v1(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_job_family_item_ids_v1(uuid,uuid[]) TO service_role;

-- Keep old partial jobs dormant. The cutoff is the moment this migration is
-- applied. Without the setting row no partial job is resumed automatically;
-- jobs in any other active status are still returned.
CREATE TABLE IF NOT EXISTS private.d10_runtime_settings_v1(
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.d10_runtime_settings_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.d10_runtime_settings_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.d10_runtime_settings_v1 FROM PUBLIC,anon,authenticated;
INSERT INTO private.d10_runtime_settings_v1(key,value)
VALUES ('enrichment_residue_cutoff',to_jsonb(clock_timestamp()))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid,status text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
  WITH cutoff AS (
    SELECT (value #>> '{}')::timestamptz AS installed_at
    FROM private.d10_runtime_settings_v1 WHERE key='enrichment_residue_cutoff'
  )
  SELECT j.id,j.status,j.created_at
  FROM public.lexeme_processing_jobs j
  LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
  LEFT JOIN cutoff ON true
  WHERE j.status IN ('pending','processing','ready','done','retry_scheduled','partial')
    AND (s.stage IS NULL OR s.stage NOT IN ('done','needs_manual_review'))
    AND (j.status<>'partial' OR j.created_at>=coalesce(cutoff.installed_at,'infinity'::timestamptz))
  ORDER BY j.created_at LIMIT greatest(1,least(coalesce(p_limit,200),200));
$body$;
REVOKE ALL ON FUNCTION public.get_active_pipeline_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_pipeline_jobs(integer) TO service_role;

COMMIT;

-- D10_synonym_verifier_b_v1 (28.10.2026, agreed in chat: stage B, dry-run)
--
-- The verifier decides the pairs prepared by stage A (synonym_pair_v1,
-- status 'queued'). DRY-RUN: decisions are written to synonym_pair_v1 only
-- (decision, confidence, evidence); published stays false, nothing reaches
-- lexemes.synonyms, authoritative_semantic_relations or the carousel
-- (publication = stage C).
--   1. Rule without AI (agreed): the Ordbøkene definitions of the target
--      article contain the source word/expression itself (mutual reference)
--      -> verified_synonym, verifier 'rule:mutual_reference_v1'.
--   2. The rest: edge function synonym-verifier, Gemini (GEMINI_MODEL), 10
--      pairs per call, at most 200 pairs per 24 h (agreed). Woken by
--      pipeline-supervisor after a finished job; no cron, no pg_net.
--   Lease (processing + token + lease_until) so two runs never take the same
--   pair; a changed snapshot (stage A rehash) makes a late answer stale.
--   Every AI call is logged in synonym_verifier_calls_v1 (pairs, tokens).
-- Pairs waiting for an article in the cache stay as they are (separate step).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
BEGIN
  IF to_regclass('public.synonym_pair_v1') IS NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_stage_a_v1 is not installed; nothing changed';
  END IF;
  IF to_regclass('public.synonym_verifier_config_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_verifier_b_v1 is already installed; nothing changed';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Settings and the AI call log
-- ---------------------------------------------------------------------------
CREATE TABLE public.synonym_verifier_config_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  dry_run boolean NOT NULL DEFAULT true CHECK (dry_run),        -- stage C lifts this
  pairs_per_call integer NOT NULL DEFAULT 10 CHECK (pairs_per_call BETWEEN 1 AND 20),
  daily_ai_pair_limit integer NOT NULL DEFAULT 200 CHECK (daily_ai_pair_limit BETWEEN 0 AND 2000),
  lease_seconds integer NOT NULL DEFAULT 180 CHECK (lease_seconds BETWEEN 30 AND 900),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.synonym_verifier_config_v1 (singleton) VALUES (true);

CREATE TABLE public.synonym_verifier_calls_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  job_id uuid,
  model text,
  pairs integer NOT NULL DEFAULT 0 CHECK (pairs >= 0),
  decided integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL,
  prompt_tokens integer,
  output_tokens integer,
  duration_ms integer,
  error text
);
CREATE INDEX synonym_verifier_calls_v1_created_idx ON public.synonym_verifier_calls_v1 (created_at);

ALTER TABLE public.synonym_verifier_config_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synonym_verifier_calls_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_verifier_config_v1, public.synonym_verifier_calls_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.synonym_verifier_config_v1, public.synonym_verifier_calls_v1 TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Text normalisation for the rule (letters only, single spaces)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_norm_text_v1(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  SELECT btrim(regexp_replace(lower(coalesce(p, '')), '[^a-zæøåéèêóòôüä]+', ' ', 'g'));
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Rule: mutual reference (no AI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_rule_verify_v1(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_n integer;
BEGIN
  WITH cand AS (
    SELECT p.id, m.def
    FROM public.synonym_pair_v1 p
    CROSS JOIN LATERAL (
      SELECT d.def FROM jsonb_array_elements_text(coalesce(p.snapshot->'target'->'definitions_nb', '[]'::jsonb)) AS d(def)
      WHERE length(public.d10_synonym_norm_text_v1(p.snapshot->'source'->>'lemma')) >= 2
        AND (' ' || public.d10_synonym_norm_text_v1(d.def) || ' ')
            LIKE ('% ' || public.d10_synonym_norm_text_v1(p.snapshot->'source'->>'lemma') || ' %')
      LIMIT 1) m
    WHERE p.status = 'queued'
    ORDER BY p.created_at
    LIMIT greatest(coalesce(p_limit, 500), 1)
    FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = 'verified_synonym', confidence = 0.9,
      verifier_version = 'rule:mutual_reference_v1', verified_at = now(), published = false,
      verification_evidence = jsonb_build_object('rule', 'mutual_reference',
        'matched_definition', c.def, 'source_lemma', p.snapshot->'source'->>'lemma',
        'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM cand c WHERE p.id = c.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'verified_by_rule', v_n);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Lease pairs for the AI (within the 24 h budget)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_lease_pairs_v1(p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_cfg public.synonym_verifier_config_v1%rowtype;
  v_used integer;
  v_live integer;
  v_budget integer;
  v_rows jsonb;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb, 'reason', 'disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261028, 3);
  SELECT coalesce(sum(pairs), 0) INTO v_used FROM public.synonym_verifier_calls_v1
  WHERE created_at > now() - interval '24 hours';
  SELECT count(*) INTO v_live FROM public.synonym_pair_v1 WHERE status = 'processing' AND lease_until > now();
  v_budget := greatest(v_cfg.daily_ai_pair_limit - v_used - v_live, 0);
  IF v_budget = 0 THEN
    RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb, 'reason', 'daily_limit', 'used_24h', v_used);
  END IF;

  WITH picked AS (
    SELECT p.id FROM public.synonym_pair_v1 p
    WHERE p.status = 'queued'
       OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
       OR (p.status = 'processing' AND p.lease_until <= now())
    ORDER BY (p.status = 'queued') DESC, p.created_at
    LIMIT least(greatest(coalesce(p_limit, v_cfg.pairs_per_call), 1), v_cfg.pairs_per_call, v_budget)
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_pair_v1 p
    SET status = 'processing', lease_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => v_cfg.lease_seconds),
        attempts = p.attempts + 1, updated_at = now()
    FROM picked WHERE p.id = picked.id
    RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'lease_token', lease_token, 'snapshot', snapshot,
    'snapshot_hash', snapshot_hash, 'attempts', attempts)), '[]'::jsonb) INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_left', v_budget - jsonb_array_length(v_rows),
    'used_24h', v_used);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 5. A decision (only with the lease and the same snapshot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_record_decision_v1(p_pair_id uuid, p_lease_token uuid,
  p_snapshot_hash text, p_decision text, p_confidence numeric, p_evidence jsonb, p_verifier_version text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('verified_synonym','contextual_synonym','near_synonym',
       'related','rejected','needs_manual_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;
  UPDATE public.synonym_pair_v1
  SET status = 'done', decision = p_decision,
      confidence = least(greatest(coalesce(p_confidence, 0), 0), 1),
      verification_evidence = coalesce(p_evidence, '{}'::jsonb)
        || jsonb_build_object('snapshot_hash', p_snapshot_hash, 'dry_run', true),
      verifier_version = p_verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  WHERE id = p_pair_id AND status = 'processing' AND lease_token = p_lease_token
    AND snapshot_hash IS NOT DISTINCT FROM p_snapshot_hash;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'applied', v_n = 1, 'stale', v_n = 0);
END
$fn$;

-- A pair the AI did not answer: try again later, after max_attempts 'failed'.
CREATE OR REPLACE FUNCTION public.d10_synonym_release_pair_v1(p_pair_id uuid, p_lease_token uuid, p_error text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_max integer;
  v_status text;
BEGIN
  SELECT max_attempts INTO v_max FROM public.synonym_verifier_config_v1 WHERE singleton;
  UPDATE public.synonym_pair_v1
  SET status = CASE WHEN attempts >= coalesce(v_max, 3) THEN 'failed' ELSE 'retry_wait' END,
      next_attempt_at = now() + make_interval(mins => 10 * attempts),
      last_error = left(coalesce(p_error, 'unknown'), 500),
      lease_token = NULL, lease_until = NULL, updated_at = now()
  WHERE id = p_pair_id AND status = 'processing' AND lease_token = p_lease_token
  RETURNING status INTO v_status;
  RETURN jsonb_build_object('ok', true, 'status', v_status);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_log_ai_call_v1(p_call jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  INSERT INTO public.synonym_verifier_calls_v1 (reason, job_id, model, pairs, decided, ok, prompt_tokens,
    output_tokens, duration_ms, error)
  VALUES (p_call->>'reason', nullif(p_call->>'job_id', '')::uuid, p_call->>'model',
    coalesce((p_call->>'pairs')::integer, 0), coalesce((p_call->>'decided')::integer, 0),
    coalesce((p_call->>'ok')::boolean, false), (p_call->>'prompt_tokens')::integer,
    (p_call->>'output_tokens')::integer, (p_call->>'duration_ms')::integer, left(p_call->>'error', 500));
$fn$;

-- Is there anything for the verifier? (the supervisor asks before waking it)
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_pending_v1()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT count(*)::integer FROM public.synonym_pair_v1 p
  WHERE p.status = 'queued'
     OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
     OR (p.status = 'processing' AND p.lease_until <= now());
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Rights: service_role only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_synonym_norm_text_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_rule_verify_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_lease_pairs_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_record_decision_v1(uuid, uuid, text, text, numeric, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_release_pair_v1(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_log_ai_call_v1(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_verifier_pending_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_norm_text_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_rule_verify_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_lease_pairs_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_record_decision_v1(uuid, uuid, text, text, numeric, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_release_pair_v1(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_log_ai_call_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_verifier_pending_v1() TO service_role;

COMMIT;

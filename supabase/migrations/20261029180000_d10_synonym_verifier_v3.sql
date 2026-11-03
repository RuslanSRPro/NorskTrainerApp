-- D10_synonym_verifier_v3 (29.10.2026, agreed in chat)
--   1. Decision log synonym_verifier_log_v1: every AI answer (model, prompt
--      version, matched target definition, kind of case = pattern, AI decision,
--      final decision after the code checks, confidence, reason, example) -
--      kept, never overwritten: to check the work and to find repeated cases
--      that can become rules without AI.
--   2. The model is a setting: synonym_verifier_config_v1.model (now
--      gemini-2.5-flash-lite). The verifier version names it
--      (ai:synonym_pair_v3:<model>); decisions are copied between twins only
--      within the same version.
--   3. d10_synonym_reverify_v1(): AI decisions of OTHER versions go back to the
--      queue (old decision -> history) - to compare models:
--        update public.synonym_verifier_config_v1 set model = 'gemini-2.5-flash';
--        select public.d10_synonym_reverify_v1();
--   4. Now: the AI decisions (v2) are checked once more with prompt v3.
-- Still DRY-RUN (published = false). Guards: md5 of the three replaced functions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('public.d10_synonym_lease_pairs_v1(integer)', '5a8c53080bda49037fc72d942422bb8f'),
      ('public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)', 'f8c0b54f5e49699b8e3827238da0382f'),
      ('public.d10_synonym_copy_decisions_v1()', 'eddf9ce6f080f0bdf29622482c925b7b')) v(fn, md5)
  LOOP
    IF (SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) FROM pg_proc p WHERE p.oid = to_regprocedure(r.fn))
       IS DISTINCT FROM r.md5 THEN
      RAISE EXCEPTION 'STOP: % is not the expected version; nothing changed', r.fn;
    END IF;
  END LOOP;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Model setting + decision log
-- ---------------------------------------------------------------------------
ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN model text NOT NULL DEFAULT 'gemini-2.5-flash-lite' CHECK (model ~ '^gemini-[a-z0-9.-]+$');
ALTER TABLE public.synonym_verifier_calls_v1 ADD COLUMN prompt_version text;

CREATE TABLE public.synonym_verifier_log_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES public.synonym_verifier_calls_v1(id) ON DELETE SET NULL,
  pair_id uuid REFERENCES public.synonym_pair_v1(id) ON DELETE SET NULL,
  content_key text,
  model text,
  prompt_version text,
  verifier_version text,
  source_lemma text,
  naob_meaning text,
  target_lemma text,
  target_definitions jsonb,
  matched_definition integer,
  matched_text text,
  pattern text,
  ai_decision text,
  final_decision text,
  guard text,
  confidence numeric,
  reason text,
  example_nb text,
  applied boolean,
  error text
);
CREATE INDEX synonym_verifier_log_v1_content_idx ON public.synonym_verifier_log_v1 (content_key, created_at);
CREATE INDEX synonym_verifier_log_v1_pattern_idx ON public.synonym_verifier_log_v1 (pattern, final_decision);
ALTER TABLE public.synonym_verifier_log_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_verifier_log_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.synonym_verifier_log_v1 TO service_role;

CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
  SELECT 'ai:synonym_pair_v3:' || model FROM public.synonym_verifier_config_v1 WHERE singleton;
$fn$;

-- one AI call (budget, tokens) + its answers -> calls + decision log
CREATE OR REPLACE FUNCTION public.d10_synonym_log_ai_call_v2(p_call jsonb, p_rows jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
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
    ai_decision, final_decision, guard, confidence, reason, example_nb, applied, error)
  SELECT v_call, (r->>'pair_id')::uuid, r->>'content_key', p_call->>'model', p_call->>'prompt_version',
    'ai:synonym_pair_v3:' || (p_call->>'model'),
    r->'snapshot'->'source'->>'lemma', r->'snapshot'->'source'->>'definition_nb',
    r->'snapshot'->'target'->>'lemma', r->'snapshot'->'target'->'definitions_nb',
    (r->>'matched_definition')::integer, r->>'matched_text', r->>'pattern',
    r->>'ai_decision', r->>'final_decision', r->>'guard', (r->>'confidence')::numeric,
    left(r->>'reason', 500), left(r->>'example_nb', 300), (r->>'applied')::boolean, left(r->>'error', 500)
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  WHERE EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.id = (r->>'pair_id')::uuid);
  RETURN v_call;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Copy between twins: only within one verifier version (or the rule)
-- ---------------------------------------------------------------------------
DROP FUNCTION public.d10_synonym_copy_decisions_v1();
CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1(p_version text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE v_n integer;
BEGIN
  WITH decided AS (
    SELECT DISTINCT ON (public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key))
      public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key) AS k,
      d.id, d.decision, d.confidence, d.verification_evidence, d.verifier_version
    FROM public.synonym_pair_v1 d
    WHERE d.status = 'done' AND d.decision IS NOT NULL
      AND (d.verifier_version = p_version OR d.verifier_version LIKE 'rule:%')
    ORDER BY public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key), d.verified_at DESC
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = x.decision, confidence = x.confidence,
      verification_evidence = (x.verification_evidence - 'copied_from')
        || jsonb_build_object('copied_from', x.id, 'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      verifier_version = x.verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM decided x
  WHERE p.status IN ('queued', 'retry_wait') AND p.id <> x.id
    AND public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) = x.k;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

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

  -- D10 29.10.2026 (agreed, v2): a pair with the same content as a pair that
  -- is already decided gets that decision without AI (copied_from); of several
  -- waiting pairs with the same content only ONE goes to the AI.
  -- v3: decisions are copied only from the CURRENT verifier (model) or the rule
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
  WITH due AS (
    SELECT p.id, p.status, p.created_at, public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS k
    FROM public.synonym_pair_v1 p
    WHERE p.status = 'queued'
       OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
       OR (p.status = 'processing' AND p.lease_until <= now())
  ), one_per_content AS (
    SELECT DISTINCT ON (d.k) d.id, d.status, d.created_at FROM due d
    WHERE NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 o
      WHERE o.status = 'processing' AND o.lease_until > now()
        AND public.d10_synonym_pair_content_key_v1(o.snapshot, o.target_entity_id, o.target_article_key) = d.k)
    ORDER BY d.k, (d.status = 'queued') DESC, d.created_at
  ), picked AS (
    SELECT p.id FROM public.synonym_pair_v1 p JOIN one_per_content c ON c.id = p.id
    ORDER BY (c.status = 'queued') DESC, c.created_at
    LIMIT least(greatest(coalesce(p_limit, v_cfg.pairs_per_call), 1), v_cfg.pairs_per_call, v_budget)
    FOR UPDATE OF p SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_pair_v1 p
    SET status = 'processing', lease_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => v_cfg.lease_seconds),
        attempts = p.attempts + 1, updated_at = now()
    FROM picked WHERE p.id = picked.id
    RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts,
      public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS content_key
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'lease_token', lease_token, 'snapshot', snapshot,
    'snapshot_hash', snapshot_hash, 'attempts', attempts, 'content_key', content_key)), '[]'::jsonb) INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_left', v_budget - jsonb_array_length(v_rows),
    'used_24h', v_used, 'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1());
END
$fn$;

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
  -- D10 29.10.2026 (agreed, v2): waiting pairs with the same content get it too
  IF v_n = 1 THEN PERFORM public.d10_synonym_copy_decisions_v1(p_verifier_version); END IF;
  RETURN jsonb_build_object('ok', true, 'applied', v_n = 1, 'stale', v_n = 0);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Model comparison: AI decisions of other versions back to the queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_reverify_v1()
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
        'superseded_at', now(), 'why', 'reverify_' || v_version)),
      decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL,
      verified_at = NULL, attempts = 0, next_attempt_at = NULL, last_error = NULL,
      lease_token = NULL, lease_until = NULL, updated_at = now()
  WHERE status IN ('done', 'failed') AND published = false
    AND verifier_version LIKE 'ai:%' AND verifier_version <> v_version;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'requeued', v_n, 'verifier_version', v_version);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Rights; the v2 AI decisions go through prompt v3 once
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_synonym_verifier_version_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_log_ai_call_v2(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_copy_decisions_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_reverify_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_verifier_version_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_log_ai_call_v2(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_copy_decisions_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_reverify_v1() TO service_role;

SELECT public.d10_synonym_reverify_v1();

COMMIT;

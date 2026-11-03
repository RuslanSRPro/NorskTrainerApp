-- D10_synonym_verifier_v2 (29.10.2026, agreed in chat)
-- After the first dry run (query 257):
--   1. same content checked several times (stå for -> forestå x3 ...): a pair whose
--      content (source word, NAOB meaning, target card + article + definitions) is
--      already decided by the current verifier or the rule gets that decision
--      without AI (copied_from); of several waiting pairs with the same content only
--      one goes to the AI.
--   2. prompt v2 (edge, verifier-core.ts): the target's own definitions decide;
--      a bracket-limited NAOB meaning -> contextual; three worked examples.
--   3. the 29 pairs decided by the v1 prompt are checked once more (their old
--      decision goes to history). Still DRY-RUN: published stays false.
-- Guards: md5 of the two replaced functions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE v_md5 text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_synonym_lease_pairs_v1(integer)');
  IF v_md5 IS DISTINCT FROM '0885ef2adc60248080ddd02417c26f7b' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_lease_pairs_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)');
  IF v_md5 IS DISTINCT FROM 'a2df93e75892a06fd38a40f17e04e0da' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_record_decision_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- Content of a pair (without the candidate): source word, its NAOB meaning,
-- target card and article. Same content = same decision.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_pair_content_key_v1(p_snapshot jsonb, p_target_entity_id uuid, p_article_key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  SELECT md5(lower(btrim(coalesce(p_snapshot->'source'->>'lemma', ''))) || '|' ||
    lower(btrim(coalesce(p_snapshot->'source'->>'definition_nb', ''))) || '|' ||
    coalesce(p_target_entity_id::text, '') || '|' || coalesce(p_article_key, '') || '|' ||
    md5(coalesce((p_snapshot->'target'->'definitions_nb')::text, '')));
$fn$;

-- Waiting pairs (queued / retry_wait) whose content is already decided by the
-- CURRENT verifier (or the rule) get that decision, marked copied_from.
CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1()
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
      AND (d.verifier_version = 'ai:synonym_pair_v2' OR d.verifier_version LIKE 'rule:%')
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
  PERFORM public.d10_synonym_copy_decisions_v1();
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
    RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'lease_token', lease_token, 'snapshot', snapshot,
    'snapshot_hash', snapshot_hash, 'attempts', attempts)), '[]'::jsonb) INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_left', v_budget - jsonb_array_length(v_rows),
    'used_24h', v_used);
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
  IF v_n = 1 THEN PERFORM public.d10_synonym_copy_decisions_v1(); END IF;
  RETURN jsonb_build_object('ok', true, 'applied', v_n = 1, 'stale', v_n = 0);
END
$fn$;

-- the pairs decided by the v1 prompt: once more with v2 (old decision -> history)
UPDATE public.synonym_pair_v1
SET status = 'queued',
    history = history || jsonb_build_array(jsonb_build_object('decision', decision, 'confidence', confidence,
      'verifier_version', verifier_version, 'verified_at', verified_at, 'reason', verification_evidence->>'reason',
      'superseded_at', now(), 'why', 'reverify_prompt_v2')),
    decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL,
    verified_at = NULL, attempts = 0, next_attempt_at = NULL, last_error = NULL,
    lease_token = NULL, lease_until = NULL, updated_at = now()
WHERE status = 'done' AND verifier_version = 'ai:synonym_pair_v1' AND published = false;

REVOKE ALL ON FUNCTION public.d10_synonym_pair_content_key_v1(jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_copy_decisions_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_pair_content_key_v1(jsonb, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_copy_decisions_v1() TO service_role;

COMMIT;

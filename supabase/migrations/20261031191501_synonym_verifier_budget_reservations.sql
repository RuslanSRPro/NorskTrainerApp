BEGIN;
CREATE TABLE private.synonym_ai_budget_epoch_v1(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO private.synonym_ai_budget_epoch_v1 DEFAULT VALUES;
CREATE TABLE private.synonym_ai_budget_v1(
 pair_id uuid NOT NULL,lease_token uuid NOT NULL,model text NOT NULL,reserved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(pair_id,lease_token)
);
CREATE INDEX synonym_ai_budget_time_idx ON private.synonym_ai_budget_v1(reserved_at);
ALTER TABLE private.synonym_ai_budget_epoch_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.synonym_ai_budget_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_ai_budget_epoch_v1,private.synonym_ai_budget_v1 FROM PUBLIC,anon,authenticated;
INSERT INTO private.synonym_ai_budget_v1(pair_id,lease_token,model)
 SELECT p.id,p.lease_token,c.model FROM public.synonym_pair_v1 p CROSS JOIN public.synonym_verifier_config_v1 c
 WHERE p.status='processing' AND p.lease_token IS NOT NULL AND c.singleton;
CREATE OR REPLACE FUNCTION public.d10_synonym_lease_pairs_v1(p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
  -- Reserve budget at lease time. A crash or a failed log cannot erase a paid attempt.
  SELECT (SELECT count(*) FROM private.synonym_ai_budget_v1 WHERE reserved_at>now()-interval '24 hours')
   + (SELECT coalesce(sum(pairs),0) FROM public.synonym_verifier_calls_v1
      WHERE created_at>now()-interval '24 hours'
      AND created_at<(SELECT started_at FROM private.synonym_ai_budget_epoch_v1 WHERE singleton))
   INTO v_used;
  v_live:=0;
  UPDATE public.synonym_pair_v1 SET status='failed',last_error='lease_attempts_exhausted',
   lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE status='processing' AND lease_until<=now() AND attempts>=v_cfg.max_attempts;
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
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
  INSERT INTO private.synonym_ai_budget_v1(pair_id,lease_token,model)
  SELECT (r->>'id')::uuid,(r->>'lease_token')::uuid,v_cfg.model FROM jsonb_array_elements(v_rows) r;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_left', v_budget - jsonb_array_length(v_rows),
    'used_24h', v_used, 'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1());
END
$function$
;
COMMIT;

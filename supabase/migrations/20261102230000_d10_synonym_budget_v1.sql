-- 20261102230000_d10_synonym_budget_v1.sql
-- D10_synonym_budget_v1 (agreed 02.11.2026): the daily AI pair limit counts only pairs that really ask the AI and do
-- not come from a text analysis.
--  * lease: pairs with a reusable v10 relation answer (prior, no AI call) and pairs of candidates collected by a text
--    analysis in the last 24 h are not reserved in the budget and are leased also when the limit is used up;
--  * after_job: candidates of a text analysis get 'analysis_job' / 'analysis_at' in their evidence;
--  * data: candidates of text analyses of the last 24 h are marked the same way.
-- The whole-base walk stays limited. Guards: md5 of both functions; reinstall -> STOP.
-- Rollback: optional/20261102230000_d10_synonym_budget_v1_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_budget_report;
CREATE TEMP TABLE d10_budget_report(part text, name text, info jsonb);

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_lease_pairs_v1(integer)', $h_lease$CREATE OR REPLACE FUNCTION public.d10_synonym_lease_pairs_v1(p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_lease$, '0a160942856842a8191d1efebbbc88a1', '25624df9d442a7a8bca759bca74e23f8', $b_lease$
DECLARE
  v_cfg public.synonym_verifier_config_v1%rowtype;
  v_used integer;
  v_live integer;
  v_budget integer;
  v_rows jsonb;
  v_free integer;
BEGIN
  -- D10_synonym_budget_v1 (02.11.2026, agreed): the daily AI limit counts only pairs that really go to the AI and
  -- do not come from a text analysis. Not counted: a pair whose relation answer is reused (v10 'prior', no AI call)
  -- and a pair of a candidate collected by a text analysis in the last 24 h (candidate evidence 'analysis_at').
  -- Such pairs are leased also when the limit is used up.
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

 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='standard_enrichment_not_ready',
 lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE p.status IN ('queued','retry_wait') AND
 (NOT private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 OR NOT private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id));
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
  v_budget := greatest(v_cfg.daily_ai_pair_limit - v_used - v_live, 0);

  -- D10 29.10.2026 (agreed, v2): a pair with the same content as a pair that
  -- is already decided gets that decision without AI (copied_from); of several
  -- waiting pairs with the same content only ONE goes to the AI.
  -- v3: decisions are copied only from the CURRENT verifier (model) or the rule

 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='standard_enrichment_not_ready',
 lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE p.status IN ('queued','retry_wait') AND
 (NOT private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 OR NOT private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id));
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
  WITH due AS (
    SELECT p.id, p.status, p.created_at, public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS k,
      (EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = p.candidate_id
                 AND (c.verification_evidence->>'analysis_at')::timestamptz > now() - interval '24 hours')
       OR EXISTS (SELECT 1 FROM public.synonym_pair_v1 d
                  WHERE d.decision IS NOT NULL AND d.verifier_version = public.d10_synonym_verifier_version_v1()
                    AND d.verification_evidence->>'contract' = 'v10'
                    AND jsonb_typeof(d.verification_evidence->'substitution_forward') = 'boolean'
                    AND jsonb_typeof(d.verification_evidence->'substitution_reverse') = 'boolean'
                    AND jsonb_typeof(d.verification_evidence->'same_construction') = 'boolean'
                    AND d.verification_evidence->>'relation_key'
                        = private.synonym_relation_key_v1(p.snapshot, p.target_entity_id, p.target_article_key))) AS free
    FROM public.synonym_pair_v1 p
    WHERE p.status = 'queued'
       OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
       OR (p.status = 'processing' AND p.lease_until <= now())
  ), one_per_content AS (
    SELECT DISTINCT ON (d.k) d.id, d.status, d.created_at, d.free FROM due d
    WHERE NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 o
      WHERE o.status = 'processing' AND o.lease_until > now()
        AND public.d10_synonym_pair_content_key_v1(o.snapshot, o.target_entity_id, o.target_article_key) = d.k)
    ORDER BY d.k, (d.status = 'queued') DESC, d.created_at
  ), ranked AS (
    SELECT c.id, c.status, c.created_at, c.free,
      row_number() OVER (PARTITION BY c.free ORDER BY (c.status = 'queued') DESC, c.created_at) AS rn
    FROM one_per_content c
  ), picked AS (
    SELECT p.id FROM public.synonym_pair_v1 p JOIN ranked c ON c.id = p.id
    WHERE c.free OR c.rn <= v_budget
    ORDER BY (c.status = 'queued') DESC, c.created_at
    LIMIT least(greatest(coalesce(p_limit, v_cfg.pairs_per_call), 1), v_cfg.pairs_per_call)
    FOR UPDATE OF p SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_pair_v1 p
    SET status = 'processing', lease_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => v_cfg.lease_seconds),
        attempts = p.attempts + 1, updated_at = now()
    FROM picked WHERE p.id = picked.id
    RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts, p.candidate_id,
      public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS content_key,
      private.synonym_relation_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS relation_key
  )
  -- D10_synonym_stable_v1 (02.11.2026): 'prior' = the relation answer already given by the CURRENT verifier for
  -- the same relation content (same senses / definitions; translations and examples do not count). The verifier
  -- reuses it instead of asking the AI again; only the translation fit is (re)evaluated.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'lease_token', u.lease_token, 'snapshot', u.snapshot,
    'snapshot_hash', u.snapshot_hash, 'attempts', u.attempts, 'content_key', u.content_key, 'relation_key', u.relation_key,
    'prior', (SELECT d.verification_evidence || jsonb_build_object('confidence', d.confidence, 'prior_pair_id', d.id)
              FROM public.synonym_pair_v1 d
              WHERE d.decision IS NOT NULL AND d.verifier_version = public.d10_synonym_verifier_version_v1()
                AND d.verification_evidence->>'relation_key' = u.relation_key
                AND d.verification_evidence->>'contract' = 'v10'
              ORDER BY d.verified_at DESC NULLS LAST LIMIT 1),
    'budget_free', (EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = u.candidate_id
                              AND (c.verification_evidence->>'analysis_at')::timestamptz > now() - interval '24 hours')
       OR EXISTS (SELECT 1 FROM public.synonym_pair_v1 d
                  WHERE d.decision IS NOT NULL AND d.verifier_version = public.d10_synonym_verifier_version_v1()
                    AND d.verification_evidence->>'contract' = 'v10'
                    AND jsonb_typeof(d.verification_evidence->'substitution_forward') = 'boolean'
                    AND jsonb_typeof(d.verification_evidence->'substitution_reverse') = 'boolean'
                    AND jsonb_typeof(d.verification_evidence->'same_construction') = 'boolean'
                    AND d.verification_evidence->>'relation_key' = u.relation_key)))), '[]'::jsonb) INTO v_rows FROM upd u;
  -- reserve only pairs that will really ask the AI and are not from a text analysis
  INSERT INTO private.synonym_ai_budget_v1(pair_id,lease_token,model)
  SELECT (r->>'id')::uuid,(r->>'lease_token')::uuid,v_cfg.model FROM jsonb_array_elements(v_rows) r
  WHERE NOT (r->>'budget_free')::boolean;
  GET DIAGNOSTICS v_free = ROW_COUNT;
  v_free := jsonb_array_length(v_rows) - v_free;
  IF jsonb_array_length(v_rows) = 0 AND v_budget = 0 THEN
    RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb, 'reason', 'daily_limit', 'used_24h', v_used);
  END IF;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_free', v_free,
    'budget_left', v_budget - (jsonb_array_length(v_rows) - v_free),
    'used_24h', v_used, 'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1());
END
$b_lease$),
    ('public.d10_synonym_after_job_v1(uuid)', $h_after_job$CREATE OR REPLACE FUNCTION public.d10_synonym_after_job_v1(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_after_job$, '38a9409deb61e8a086e918a055cd1d02', 'bff5ebd9c90244a74e900d37b130276f', $b_after_job$
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

  -- D10_synonym_force_dispatch_v1 (02.11.2026, agreed): a text analysis ALWAYS sends the target cards of its
  -- candidates to a child job again (fresh translations and data), even when they are ready. Only the candidates
  -- this job collected (source_job_id), active, depth 0, already enriched or skipped as ready. Child jobs
  -- (input_type synonym_candidate) never force, so there is no chain. Waiting pairs of these candidates are
  -- superseded, parked ones included (no AI on data that is about to change); new pairs are prepared after the
  -- child job.
  IF coalesce(v_job.input_type, '') <> 'synonym_candidate' THEN
    -- D10_synonym_budget_v1: candidates of a text analysis are marked; their pairs do not count in the daily AI
    -- limit for 24 h (the whole-base walk does not go through here and stays limited)
    UPDATE public.synonym_candidate_queue c SET verification_evidence = coalesce(c.verification_evidence, '{}'::jsonb)
        || jsonb_build_object('analysis_job', p_job_id, 'analysis_at', now()), updated_at = now()
    WHERE c.source_job_id = p_job_id AND c.source_active AND c.origin_depth = 0;
    WITH f AS (
      UPDATE public.synonym_candidate_queue c SET dispatch_status = 'pending', stage1_status = 'candidate',
        verification_evidence = coalesce(c.verification_evidence, '{}'::jsonb)
          || jsonb_build_object('force_dispatch_job', p_job_id, 'force_dispatch_at', now(),
               'force_dispatch_from', c.dispatch_status),
        updated_at = now()
      WHERE c.source_job_id = p_job_id AND c.source_active AND c.origin_depth = 0
        AND c.dispatch_status IN ('enrichment_done', 'skipped_ready')
      RETURNING c.id
    )
    UPDATE public.synonym_pair_v1 p SET status = 'superseded', rule_reason = 'force_dispatch', lease_token = NULL,
      lease_until = NULL, updated_at = now()
    FROM f WHERE p.candidate_id = f.id AND p.status IN ('queued', 'retry_wait');
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
$b_after_job$)
  ) t(reg, hdr, md5_before, md5_after, body) LOOP
    v_body := replace(r.body, E'\r', '');
    IF md5(v_body) <> r.md5_after THEN RAISE EXCEPTION 'STOP: file body of % damaged (md5 %)', r.reg, md5(v_body); END IF;
    SELECT p.oid, p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_oid, v_secdef, v_cfg, v_md5
    FROM pg_proc p WHERE p.oid = to_regprocedure(r.reg);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: % not found', r.reg; END IF;
    IF v_md5 <> r.md5_before THEN RAISE EXCEPTION 'STOP: % has md5 %, expected %', r.reg, v_md5, r.md5_before; END IF;
    EXECUTE replace(r.hdr, E'\r', '') || 'AS ' || quote_literal(v_body);
    SELECT p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_secdef2, v_cfg2, v_md5 FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> r.md5_after OR v_secdef2 IS DISTINCT FROM v_secdef OR v_cfg2 IS DISTINCT FROM v_cfg THEN
      RAISE EXCEPTION 'STOP: % after replace: md5 %, secdef %, config %', r.reg, v_md5, v_secdef2, v_cfg2;
    END IF;
    INSERT INTO d10_budget_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $data$
DECLARE n int;
BEGIN
  UPDATE public.synonym_candidate_queue c SET verification_evidence = coalesce(c.verification_evidence, '{}'::jsonb)
      || jsonb_build_object('analysis_job', j.id, 'analysis_at', coalesce(j.finished_at, j.created_at)), updated_at = now()
  FROM public.lexeme_processing_jobs j
  WHERE j.id = c.source_job_id AND coalesce(j.input_type, '') <> 'synonym_candidate' AND j.created_at > now() - interval '24 hours'
    AND c.source_active AND c.origin_depth = 0 AND NOT (c.verification_evidence ? 'analysis_at');
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO d10_budget_report VALUES ('03_data', 'candidates of text analyses (24 h) marked', jsonb_build_object('candidates', n));
END
$data$;

DO $probe$
DECLARE v jsonb; v_msg text; v_info jsonb;
BEGIN
  BEGIN
    -- limit 0 for the probe: only budget-free pairs may be leased, and nothing is reserved for them
    UPDATE public.synonym_verifier_config_v1 SET daily_ai_pair_limit = 0 WHERE singleton;
    v := public.d10_synonym_lease_pairs_v1(NULL);
    v_info := jsonb_build_object('reason', v->>'reason', 'leased', jsonb_array_length(coalesce(v->'pairs', '[]'::jsonb)),
      'budget_free', v->'budget_free',
      'non_free_leased', (SELECT count(*) FROM jsonb_array_elements(coalesce(v->'pairs', '[]'::jsonb)) r WHERE NOT (r->>'budget_free')::boolean),
      'reserved_for_these', (SELECT count(*) FROM private.synonym_ai_budget_v1 b
         WHERE b.lease_token IN (SELECT (r->>'lease_token')::uuid FROM jsonb_array_elements(coalesce(v->'pairs', '[]'::jsonb)) r)));
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'D10_PROBE_DONE' THEN RAISE EXCEPTION 'STOP: probe failed: %', v_msg; END IF;
  END;
  IF (v_info->>'non_free_leased')::int > 0 OR (v_info->>'reserved_for_these')::int > 0 THEN
    RAISE EXCEPTION 'STOP: probe: with limit 0 a counted pair was leased or reserved: %', v_info;
  END IF;
  INSERT INTO d10_budget_report VALUES ('04_probe', 'lease with limit 0 (rolled back)', v_info);
  INSERT INTO d10_budget_report SELECT '05_budget', 'now', jsonb_build_object(
    'limit', (SELECT daily_ai_pair_limit FROM public.synonym_verifier_config_v1 WHERE singleton),
    'reserved_24h', (SELECT count(*) FROM private.synonym_ai_budget_v1 WHERE reserved_at > now() - interval '24 hours'));
END
$probe$;

SELECT part, name, info FROM d10_budget_report ORDER BY 1, 2;

-- 20261102240000_d10_synonym_refresh_rules_v1.sql
-- D10_synonym_refresh_rules_v1 (agreed 02.11.2026): the synonym refresh queue stops useless retries and keeps the
-- refresh of known links.
--  * existing pairs (not superseded) are always rechecked, whatever the depth of origin;
--  * next generation (deferred_depth) without pairs -> status skipped (not_dispatched_by_rule:next_generation);
--  * rejected without pairs: final (no target card, word not in Ordbokene / NAOB explanation only) -> skipped
--    (not_dispatched_by_rule:rejected_final); target ready now -> pending; otherwise skipped 'waiting_target_ready',
--    re-evaluated by the drain and back to pending when the target becomes ready;
--  * candidates left 'in_child_job' after their child job finished (> 10 min) are repaired and queued;
--  * new status 'skipped' in the refresh queue: not retried, not an error.
-- Changes: d10_synonym_enqueue_refresh_v1 (now plpgsql, same signature), d10_synonym_drain_refresh_v1, the queue
-- status check; new private.synonym_refresh_rule_v1, private.synonym_repair_stale_child_v1. Nothing is deleted.
-- Guards: md5 of both functions, objects not yet present; reinstall -> STOP.
-- Rollback: optional/20261102240000_d10_synonym_refresh_rules_v1_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_refresh_report;
CREATE TEMP TABLE d10_refresh_report(part text, name text, info jsonb);

DO $mig$
DECLARE v_ts text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
BEGIN
  IF (SELECT md5(replace(p.prosrc, E'\r', '')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.d10_synonym_enqueue_refresh_v1(uuid,uuid,text,boolean)'))
     = '8b5eae7847bc98a7dd7c88f49e7218ae' THEN
    RAISE EXCEPTION 'STOP: D10_synonym_refresh_rules_v1 already installed';
  END IF;
  -- backups left by an earlier install + rollback are kept under another name (nothing is deleted)
  IF to_regclass('private.synonym_refresh_queue_v1_backup_d10_rules') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE private.synonym_refresh_queue_v1_backup_d10_rules RENAME TO %I', 'synonym_refresh_queue_v1_backup_d10_rules_' || v_ts);
  END IF;
  IF to_regclass('private.synonym_candidate_queue_backup_d10_rules') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE private.synonym_candidate_queue_backup_d10_rules RENAME TO %I', 'synonym_candidate_queue_backup_d10_rules_' || v_ts);
  END IF;
END
$mig$;

CREATE TABLE private.synonym_refresh_queue_v1_backup_d10_rules AS SELECT *, now() AS saved_at FROM private.synonym_refresh_queue_v1;
REVOKE ALL ON TABLE private.synonym_refresh_queue_v1_backup_d10_rules FROM PUBLIC;
CREATE TABLE private.synonym_candidate_queue_backup_d10_rules AS
  SELECT id, dispatch_status, enrichment_done_at, target_entity_ids, verification_evidence, now() AS saved_at
  FROM public.synonym_candidate_queue WHERE dispatch_status = 'in_child_job';
REVOKE ALL ON TABLE private.synonym_candidate_queue_backup_d10_rules FROM PUBLIC;

INSERT INTO d10_refresh_report SELECT '01_before', cls, jsonb_build_object('rows', count(*)) FROM (
  SELECT CASE
      WHEN q.last_error IS NOT NULL AND q.last_error NOT IN ('target_not_ready') AND q.status <> 'skipped' THEN 'E_real_error'
      WHEN q.status = 'skipped' THEN 'S_skipped:' || q.last_error
      WHEN c.dispatch_status = 'deferred_depth' AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id AND p.status <> 'superseded') THEN 'A_next_generation_no_pairs'
      WHEN c.dispatch_status = 'deferred_depth' THEN 'A2_next_generation_with_pairs'
      WHEN c.dispatch_status = 'in_child_job' THEN 'B_C_in_child_job'
      WHEN c.dispatch_status IN ('pending', 'awaiting_parent') THEN 'B_current_unfinished'
      WHEN c.dispatch_status = 'not_dispatchable' THEN 'D_rejected'
      ELSE 'F_other:' || c.dispatch_status END AS cls
  FROM private.synonym_refresh_queue_v1 q JOIN public.synonym_candidate_queue c ON c.id = q.candidate_id
  WHERE q.status IN ('pending', 'failed')) z GROUP BY cls;

-- D10_synonym_refresh_rules_v1: what the refresh queue should do with a candidate.
--  * existing pairs (not superseded) are ALWAYS rechecked, whatever the depth of origin -> pending;
--  * the next generation (deferred_depth) without pairs is not processed -> skipped, not_dispatched_by_rule:next_generation;
--  * a rejected candidate (not_dispatchable) without pairs:
--      target card ready now -> pending (rejected before for missing data, can be checked now);
--      no target card and a final reason (word not in Ordbokene, NAOB explanation only) -> skipped, not_dispatched_by_rule:rejected_final;
--      otherwise -> skipped, waiting_target_ready (re-evaluated by the drain when the target becomes ready);
--  * everything else -> pending (unchanged behaviour).
CREATE OR REPLACE FUNCTION private.synonym_refresh_rule_v1(p_candidate uuid)
RETURNS TABLE(status text, reason text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH c AS (SELECT * FROM public.synonym_candidate_queue WHERE id = p_candidate),
  x AS (
    SELECT c.dispatch_status,
      EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id AND p.status <> 'superseded') AS live_pairs,
      CASE WHEN c.target_kind = 'expression'
        THEN EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.normalized_key = lower(btrim(c.target_text)))
        ELSE EXISTS (SELECT 1 FROM public.lexemes l WHERE lower(btrim(l.lemma)) = lower(btrim(c.target_text))) END AS target_exists,
      CASE WHEN c.target_kind = 'expression'
        THEN coalesce((SELECT bool_or(private.synonym_card_ready_v1('expression', e.id)) FROM public.expression_catalog e
                       WHERE e.normalized_key = lower(btrim(c.target_text))), false)
        ELSE coalesce((SELECT bool_or(private.synonym_card_ready_v1('lexeme', l.id)) FROM public.lexemes l
                       WHERE lower(btrim(l.lemma)) = lower(btrim(c.target_text))), false) END AS target_ready,
      coalesce(c.verification_evidence->'stage_a'->>'reason', c.verification_evidence->>'rejected_reason') AS reject_reason
    FROM c
  )
  SELECT CASE
      WHEN x.live_pairs THEN 'pending'
      WHEN x.dispatch_status = 'deferred_depth' THEN 'skipped'
      WHEN x.dispatch_status = 'not_dispatchable' AND x.target_ready THEN 'pending'
      WHEN x.dispatch_status = 'not_dispatchable' THEN 'skipped'
      ELSE 'pending' END,
    CASE
      WHEN x.live_pairs THEN NULL
      WHEN x.dispatch_status = 'deferred_depth' THEN 'not_dispatched_by_rule:next_generation'
      WHEN x.dispatch_status = 'not_dispatchable' AND x.target_ready THEN NULL
      WHEN x.dispatch_status = 'not_dispatchable' AND NOT x.target_exists
           AND x.reject_reason IN ('resolver_word_not_in_ordbokene', 'naob_explanation') THEN 'not_dispatched_by_rule:rejected_final'
      WHEN x.dispatch_status = 'not_dispatchable' THEN 'waiting_target_ready'
      ELSE NULL END
  FROM x
  UNION ALL
  SELECT 'pending', NULL WHERE NOT EXISTS (SELECT 1 FROM c);
$f$;
REVOKE ALL ON FUNCTION private.synonym_refresh_rule_v1(uuid) FROM PUBLIC;

-- candidates still 'in_child_job' although their child job finished more than 10 minutes ago: the same step the
-- child's after_job does (enrichment_done + target ids), so their pairs can be prepared
CREATE OR REPLACE FUNCTION private.synonym_repair_stale_child_v1(p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE n integer := 0; r record;
BEGIN
  FOR r IN SELECT c.id, c.source_job_id FROM public.synonym_candidate_queue c JOIN public.lexeme_processing_jobs j ON j.id = c.child_job_id
           WHERE c.dispatch_status = 'in_child_job' AND j.finished_at IS NOT NULL AND j.finished_at < now() - interval '10 minutes'
           ORDER BY c.id LIMIT greatest(coalesce(p_limit, 50), 1) FOR UPDATE OF c SKIP LOCKED LOOP
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'enrichment_done', enrichment_done_at = now(),
      target_entity_ids = public.d10_synonym_target_entities_v1(lower(btrim(c.target_text)), c.target_kind),
      verification_evidence = coalesce(c.verification_evidence, '{}'::jsonb) || jsonb_build_object('stale_child_repaired_at', now()),
      updated_at = now()
    WHERE c.id = r.id;
    PERFORM public.d10_synonym_enqueue_refresh_v1(r.id, r.source_job_id, 'stale_child_repaired');
    n := n + 1;
  END LOOP;
  RETURN n;
END
$f$;
REVOKE ALL ON FUNCTION private.synonym_repair_stale_child_v1(integer) FROM PUBLIC;

ALTER TABLE private.synonym_refresh_queue_v1 DROP CONSTRAINT synonym_refresh_queue_v1_status_check,
  ADD CONSTRAINT synonym_refresh_queue_v1_status_check CHECK (status = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text, 'skipped'::text]));

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_enqueue_refresh_v1(uuid,uuid,text,boolean)', $h_enqueue$CREATE OR REPLACE FUNCTION public.d10_synonym_enqueue_refresh_v1(p_candidate uuid, p_job uuid, p_reason text, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_enqueue$, 'abc38b87c860b718c3ff8e9024a9018c', '8b5eae7847bc98a7dd7c88f49e7218ae', $b_enqueue$
-- D10_synonym_refresh_rules_v1 (02.11.2026): the refresh rule decides pending or skipped (private.synonym_refresh_rule_v1);
-- existing pairs are always rechecked; skipped rows are not retried and are not errors.
DECLARE v_status text; v_reason text;
BEGIN
 SELECT r.status, r.reason INTO v_status, v_reason FROM private.synonym_refresh_rule_v1(p_candidate) r;
 v_status := coalesce(v_status, 'pending');
 INSERT INTO private.synonym_refresh_queue_v1 AS q(candidate_id,job_id,reason,force_ai,status,last_error,finished_at)
 VALUES(p_candidate,p_job,p_reason,p_force,v_status,v_reason,CASE WHEN v_status='skipped' THEN now() END)
 ON CONFLICT(candidate_id) DO UPDATE SET job_id=coalesce(EXCLUDED.job_id,q.job_id),reason=EXCLUDED.reason,
 force_ai=q.force_ai OR EXCLUDED.force_ai,status=EXCLUDED.status,attempts=0,next_attempt_at=now(),requested_at=now(),
 finished_at=EXCLUDED.finished_at,last_error=EXCLUDED.last_error;
END
$b_enqueue$),
    ('public.d10_synonym_drain_refresh_v1(integer)', $h_drain$CREATE OR REPLACE FUNCTION public.d10_synonym_drain_refresh_v1(p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_drain$, 'f7b1b702432a684e51842f1d8538e864', '850355ed34226cc3ce62974f3a98105b', $b_drain$
DECLARE r record; v jsonb; n integer:=0; errors integer:=0; v_back uuid[];
BEGIN
 -- D10_synonym_refresh_rules_v1 (02.11.2026): candidates left 'in_child_job' after their child job finished are
 -- repaired and queued; rejected candidates skipped as 'waiting_target_ready' go back to the dispatcher when the target became ready.
 PERFORM private.synonym_repair_stale_child_v1(50);
 -- a rejected candidate whose target became ready goes back to the dispatcher (existing d10_synonym_rerun_v1:
 -- not_dispatchable -> pending, then dispatch resolves the targets); its queue row is closed as done
 SELECT array_agg(w.candidate_id) INTO v_back
 FROM (SELECT s.candidate_id FROM private.synonym_refresh_queue_v1 s
       WHERE s.status='skipped' AND s.last_error='waiting_target_ready'
       ORDER BY s.requested_at LIMIT 100) w
 WHERE (SELECT x.status FROM private.synonym_refresh_rule_v1(w.candidate_id) x)='pending';
 IF v_back IS NOT NULL THEN
  UPDATE private.synonym_refresh_queue_v1 SET status='done',finished_at=now(),last_error='returned_to_dispatch'
  WHERE candidate_id=ANY(v_back);
  PERFORM public.d10_synonym_rerun_v1(v_back);
 END IF;
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
END $b_drain$)
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
    INSERT INTO d10_refresh_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $data$
DECLARE r record; v_s text; v_r text; n_rep int; n_skip int := 0;
BEGIN
  n_rep := private.synonym_repair_stale_child_v1(500);
  FOR r IN SELECT q.candidate_id FROM private.synonym_refresh_queue_v1 q WHERE q.status IN ('pending', 'failed') ORDER BY q.candidate_id LOOP
    SELECT x.status, x.reason INTO v_s, v_r FROM private.synonym_refresh_rule_v1(r.candidate_id) x;
    IF v_s = 'skipped' THEN
      UPDATE private.synonym_refresh_queue_v1 SET status = 'skipped', last_error = v_r, finished_at = now(), attempts = 0
      WHERE candidate_id = r.candidate_id;
      n_skip := n_skip + 1;
    END IF;
  END LOOP;
  INSERT INTO d10_refresh_report VALUES ('03_data', 'applied', jsonb_build_object('stale_child_repaired', n_rep, 'rows_skipped_by_rule', n_skip));
END
$data$;

DO $probe$
DECLARE v_bad int; v_id uuid; v_st text; v_msg text; v_info jsonb := '{}'::jsonb;
BEGIN
  -- P1 no skipped row has live pairs (existing links are always rechecked)
  SELECT count(*) INTO v_bad FROM private.synonym_refresh_queue_v1 q
  WHERE q.status = 'skipped' AND EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = q.candidate_id AND p.status <> 'superseded');
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P1 % skipped rows have live pairs', v_bad; END IF;
  -- P2 enqueue: next generation without pairs -> skipped; candidate with live pairs -> pending (rolled back)
  BEGIN
    SELECT c.id INTO v_id FROM public.synonym_candidate_queue c WHERE c.dispatch_status = 'deferred_depth'
      AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id AND p.status <> 'superseded') LIMIT 1;
    IF v_id IS NOT NULL THEN
      PERFORM public.d10_synonym_enqueue_refresh_v1(v_id, NULL, 'probe', false);
      SELECT status INTO v_st FROM private.synonym_refresh_queue_v1 WHERE candidate_id = v_id;
      v_info := v_info || jsonb_build_object('next_generation_no_pairs', v_st);
    END IF;
    v_id := NULL;
    SELECT c.id INTO v_id FROM public.synonym_candidate_queue c
      WHERE EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id AND p.status <> 'superseded') LIMIT 1;
    IF v_id IS NOT NULL THEN
      PERFORM public.d10_synonym_enqueue_refresh_v1(v_id, NULL, 'probe', false);
      SELECT status INTO v_st FROM private.synonym_refresh_queue_v1 WHERE candidate_id = v_id;
      v_info := v_info || jsonb_build_object('with_live_pairs', v_st);
    END IF;
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'D10_PROBE_DONE' THEN RAISE EXCEPTION 'STOP: probe P2 failed: %', v_msg; END IF;
  END;
  IF coalesce(v_info->>'next_generation_no_pairs', 'skipped') <> 'skipped' OR coalesce(v_info->>'with_live_pairs', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'STOP: probe P2 enqueue rule wrong: %', v_info;
  END IF;
  INSERT INTO d10_refresh_report VALUES ('04_probe', 'enqueue rule (rolled back)', v_info || jsonb_build_object('skipped_with_live_pairs', 0));
  INSERT INTO d10_refresh_report SELECT '05_after', cls, jsonb_build_object('rows', count(*)) FROM (
    SELECT CASE
      WHEN q.last_error IS NOT NULL AND q.last_error NOT IN ('target_not_ready') AND q.status <> 'skipped' THEN 'E_real_error'
      WHEN q.status = 'skipped' THEN 'S_skipped:' || q.last_error
      WHEN c.dispatch_status = 'deferred_depth' AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id AND p.status <> 'superseded') THEN 'A_next_generation_no_pairs'
      WHEN c.dispatch_status = 'deferred_depth' THEN 'A2_next_generation_with_pairs'
      WHEN c.dispatch_status = 'in_child_job' THEN 'B_C_in_child_job'
      WHEN c.dispatch_status IN ('pending', 'awaiting_parent') THEN 'B_current_unfinished'
      WHEN c.dispatch_status = 'not_dispatchable' THEN 'D_rejected'
      ELSE 'F_other:' || c.dispatch_status END AS cls
    FROM private.synonym_refresh_queue_v1 q JOIN public.synonym_candidate_queue c ON c.id = q.candidate_id
    WHERE q.status IN ('pending', 'failed', 'skipped') AND q.requested_at > now() - interval '7 days') z GROUP BY cls;
END
$probe$;

SELECT part, name, info FROM d10_refresh_report ORDER BY 1, 2;

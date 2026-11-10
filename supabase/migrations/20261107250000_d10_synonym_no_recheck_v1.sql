-- D10_synonym_no_recheck_v1 (07.11.2026, agreed): a synonym pair is rechecked by the AI only when its own data
-- (snapshot: article, definition ...) changed, or by hand.
-- Cause (query 369, gripe): every analysis changes the card (translations, status ...) -> the card change put ALL
-- pairs of the card to needs_manual_review with force_recheck -> the AI answered again on the same data and the
-- decisions flipped (trive: verified / contextual / verified / contextual ...; fange: verified -> contextual).
-- 1) private.synonym_card_change_apply_v1: no forced reset any more; it only queues the candidate for the normal
--    preparation (d10_synonym_prepare_candidate_v1), which resets a pair only when its snapshot_hash changed.
-- 2) once: a pair whose history has a better decision for the SAME snapshot_hash by the same verifier gets that
--    decision back (query 370: 1 pair, fange -> gripe contextual -> verified). Publication follows by its trigger.
-- Backup of changed pairs: private.d10_synonym_no_recheck_backup_v1. Rollback: optional/.
-- One DO block + final SELECT. Guard: the apply function must be the expected (forcing) version.

CREATE TABLE IF NOT EXISTS private.d10_synonym_no_recheck_backup_v1 (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,              -- function | pair
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_synonym_no_recheck_backup_v1 FROM PUBLIC;

DO $mig$
DECLARE v_src text; v_n integer;
BEGIN
  SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('private.synonym_card_change_apply_v1(uuid)');
  IF v_src IS NULL THEN RAISE EXCEPTION 'STOP: private.synonym_card_change_apply_v1(uuid) not found'; END IF;
  IF position('force_recheck=true' IN replace(v_src, ' ', '')) = 0 THEN
    RAISE EXCEPTION 'STOP: synonym_card_change_apply_v1 is not the expected version (already installed?)';
  END IF;
  INSERT INTO private.d10_synonym_no_recheck_backup_v1(kind, row_data)
  VALUES ('function', jsonb_build_object('name', 'private.synonym_card_change_apply_v1(uuid)', 'prosrc', v_src));

  EXECUTE $f$
CREATE OR REPLACE FUNCTION private.synonym_card_change_apply_v1(p_candidate_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $body$
-- D10_synonym_no_recheck_v1 (07.11.2026): a card change no longer resets the pairs (no needs_manual_review, no
-- force_recheck). The candidate is only queued for the normal preparation, which resets a pair only when its
-- snapshot (the data the AI sees) changed. Manual recheck: force_recheck on the pair or enqueue with p_force.
BEGIN
  PERFORM public.d10_synonym_enqueue_refresh_v1(p_candidate_id, NULL, 'card_content_changed', false);
END;
$body$;
$f$;

  -- 2) restore the best decision given on the same data
  WITH rank(decision, r) AS (VALUES ('verified_synonym', 5), ('one_way_synonym', 4), ('contextual_synonym', 3),
    ('near_synonym', 2), ('related', 1), ('rejected', 0)),
  cur AS (
    SELECT p.id, p.status, p.decision, p.snapshot_hash, p.verifier_version, p.history,
      coalesce((SELECT r FROM rank WHERE rank.decision = p.decision), -1) AS cur_rank
    FROM public.synonym_pair_v1 p
    WHERE p.status IN ('done', 'needs_manual_review') AND jsonb_typeof(p.history) = 'array'
  ),
  best AS (
    SELECT c.id, h.value AS entry, rk.r AS hist_rank,
      row_number() OVER (PARTITION BY c.id ORDER BY rk.r DESC, (h.value->>'verified_at') DESC) AS rn
    FROM cur c
    CROSS JOIN LATERAL jsonb_array_elements(c.history) h
    JOIN rank rk ON rk.decision = h.value->>'decision'
    WHERE h.value->>'snapshot_hash' = c.snapshot_hash
      AND h.value->>'status' = 'done'
      AND (c.verifier_version IS NULL OR h.value->>'verifier_version' = c.verifier_version
           OR split_part(h.value->>'verifier_version', ':', 2) = split_part(c.verifier_version, ':', 2))
  ),
  todo AS (
    SELECT c.id, b.entry FROM cur c JOIN best b ON b.id = c.id AND b.rn = 1 WHERE b.hist_rank > c.cur_rank
  ),
  saved AS (
    INSERT INTO private.d10_synonym_no_recheck_backup_v1(kind, row_data)
    SELECT 'pair', to_jsonb(p) - 'history' - 'snapshot' FROM public.synonym_pair_v1 p JOIN todo t ON t.id = p.id
    RETURNING 1
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = t.entry->>'decision',
      confidence = coalesce((jsonb_populate_record(p, jsonb_build_object('confidence', t.entry->'confidence'))).confidence, p.confidence),
      verification_evidence = coalesce(t.entry->'verification_evidence', p.verification_evidence),
      verifier_version = coalesce(t.entry->>'verifier_version', p.verifier_version),
      verified_at = coalesce((t.entry->>'verified_at')::timestamptz, p.verified_at),
      force_recheck = false, rule_reason = 'restored_d10_no_recheck_v1', lease_token = NULL, lease_until = NULL,
      updated_at = now()
  FROM todo t WHERE p.id = t.id AND (SELECT count(*) FROM saved) >= 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO private.d10_synonym_no_recheck_backup_v1(kind, row_data)
  VALUES ('report', jsonb_build_object('restored_pairs', v_n));
END
$mig$;

SELECT 'd10_synonym_no_recheck_v1 installed' AS result,
  (SELECT row_data->>'restored_pairs' FROM private.d10_synonym_no_recheck_backup_v1 WHERE kind = 'report' ORDER BY id DESC LIMIT 1) AS restored_pairs,
  position('force_recheck' IN (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('private.synonym_card_change_apply_v1(uuid)'))) = 0
    OR position('no longer resets' IN (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('private.synonym_card_change_apply_v1(uuid)'))) > 0 AS apply_replaced;

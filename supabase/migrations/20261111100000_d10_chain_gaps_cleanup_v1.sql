-- D10_chain_gaps_cleanup_v1 (11.11.2026, agreed after 442).
-- 1. Ordbøkene expression candidates whose promoted_expression_id points to an expression that no longer
--    exists (deleted collocations: bruke, finger, kald, leve ...) get promoted_expression_id = NULL and a
--    review_reason, so the sub-article relation worker no longer reads them. Status is not changed (they are
--    not re-promoted). Every changed row is saved in private.d10_chain_gaps_backup_v1 first.
-- 2. NAOB chain rows left in 'processing' / 'retry' for more than 2 hours (jobs stopped during the database
--    outage of 10.11) are closed as failed (stale_processing_exhausted); a next run of the word redoes them.
-- One DO block + final SELECT (report). Re-run = changes nothing more.
CREATE TABLE IF NOT EXISTS private.d10_chain_gaps_backup_v1 (
  id bigserial PRIMARY KEY, kind text NOT NULL, row_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_chain_gaps_backup_v1 FROM PUBLIC;

DO $mig$
DECLARE v_n integer;
BEGIN
  -- 1. stale candidate links
  INSERT INTO private.d10_chain_gaps_backup_v1 (kind, row_data)
  SELECT 'stale_candidate', to_jsonb(c)
  FROM public.ordbokene_expression_candidates c
  WHERE c.promoted_expression_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.id = c.promoted_expression_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.ordbokene_expression_candidates c
  SET promoted_expression_id = NULL,
      review_reason = 'd10_expression_deleted_v1'
  WHERE c.promoted_expression_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.id = c.promoted_expression_id);
  INSERT INTO private.d10_chain_gaps_backup_v1 (kind, row_data)
  VALUES ('report', jsonb_build_object('stale_candidate_links_cleared', v_n));

  -- 2. stuck NAOB chain rows
  INSERT INTO private.d10_chain_gaps_backup_v1 (kind, row_data)
  SELECT 'stuck_naob', to_jsonb(s)
  FROM private.d10_job_enrichment_item_state_v1 s
  WHERE s.chain = 'naob' AND s.status::text IN ('processing', 'retry')
    AND s.updated_at < now() - interval '2 hours';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE private.d10_job_enrichment_item_state_v1 s
  SET status = 'failed', outcome_code = 'stale_processing_exhausted',
      next_retry_at = NULL, finished_at = now(), updated_at = now()
  WHERE s.chain = 'naob' AND s.status::text IN ('processing', 'retry')
    AND s.updated_at < now() - interval '2 hours';
  INSERT INTO private.d10_chain_gaps_backup_v1 (kind, row_data)
  VALUES ('report', jsonb_build_object('stuck_naob_rows_closed', v_n));
END
$mig$;

SELECT row_data AS report, created_at FROM private.d10_chain_gaps_backup_v1 WHERE kind = 'report' ORDER BY id;

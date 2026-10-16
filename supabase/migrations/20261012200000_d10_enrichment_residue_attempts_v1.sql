-- D10 plan compliance v1: per-item attempt counts of the enrichment residue.
-- Read-only helper for job-enrichment-batch-worker. Aggregate source calls
-- (AI fallback, translation reorder/canonicalization, forms) send the residue
-- of a page as one batch; when such a call fails as a whole, no item can be
-- attributed. The worker uses these attempt counts to shrink the retry batch
-- (whole residue -> half -> single items on the last attempt), so one
-- poisonous item ends as failed alone and its neighbours still succeed.
-- Rows without a ledger entry are reported as attempt 0 / status NULL.
-- Nothing existing is changed or dropped.

CREATE OR REPLACE FUNCTION public.d10_enrichment_residue_attempts_v1(
  p_job_id uuid,
  p_chain text,
  p_item_ids uuid[]
) RETURNS TABLE(item_id uuid, status text, attempt_count integer, next_retry_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private'
AS $body$
  SELECT r.id, s.status, coalesce(s.attempt_count, 0), s.next_retry_at
  FROM (SELECT DISTINCT unnest(coalesce(p_item_ids, '{}'::uuid[])) AS id) r
  LEFT JOIN private.d10_job_enrichment_item_state_v1 s
    ON s.job_id = p_job_id AND s.chain = p_chain AND s.item_id = r.id
  WHERE r.id IS NOT NULL
  ORDER BY r.id;
$body$;

REVOKE ALL ON FUNCTION public.d10_enrichment_residue_attempts_v1(uuid, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_enrichment_residue_attempts_v1(uuid, text, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_enrichment_residue_attempts_v1(uuid, text, uuid[]) TO service_role;

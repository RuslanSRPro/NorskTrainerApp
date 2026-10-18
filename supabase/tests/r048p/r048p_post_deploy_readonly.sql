-- R048P read-only regression against saved R048M capture.
-- Run in Supabase SQL Editor ONLY AFTER explicit authorization to deploy R048P.
-- Until then this is a review artifact, not an instruction to run.
-- Check actual canonical output from the existing RPC after deployment.
WITH source AS (
  SELECT rpc_input->'rpcTokens' AS tokens,
         rpc_input->>'structuralReleaseCode' AS release_code
  FROM private.grammar_rpc_capture_v1
  WHERE capture_id='cd7891d9-d600-448e-8f55-3e63d4b276cb'
), result AS (
  SELECT public.run_canonical_legacy_compatibility_v140(tokens,release_code) AS output
  FROM source
)
SELECT
  output#>'{language_graph,clauses}' AS clauses,
  output#>'{language_graph,predicate_build_v1,summary}' AS predicate_summary,
  output#>'{language_graph,clause_build_v1,summary}' AS clause_summary,
  output#>'{language_graph,dependency_build_v2,summary}' AS dependency_summary,
  output#>'{language_graph,dependency_build_v2,dependencies}' AS dependencies
FROM result;

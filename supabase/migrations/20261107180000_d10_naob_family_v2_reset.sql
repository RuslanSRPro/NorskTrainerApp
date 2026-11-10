-- D10_naob_family_v2: verbs that went through the NAOB step with no article found (v1 search
-- missed single-hit words like gripe) go through it again with the fixed worker.
-- Changes only the ledger private.d10_family_naob_runs_v1 (rows with no slugs).
WITH removed AS (
  DELETE FROM private.d10_family_naob_runs_v1 WHERE coalesce(cardinality(slugs), 0) = 0 RETURNING root_lexeme_id
)
SELECT 'd10_naob_family_v2 reset' AS result, count(*) AS verbs_to_retry FROM removed;

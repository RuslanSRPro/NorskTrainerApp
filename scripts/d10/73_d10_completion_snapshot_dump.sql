-- 73_d10_completion_snapshot_dump.sql
-- Read only. The learner completion snapshot of one finished job (what
-- get-job-status evaluates before it answers completed / needs_manual_review),
-- all pages. Job: 3779546f-5aa0-42f2-9e7b-d781a50eec9f ("Er tiden. Jeg husker det.")
-- The result is long: send it as a file.
WITH RECURSIVE pages AS (
  SELECT 1 AS n,
         public.get_completion_evidence_snapshot_v2(
           '3779546f-5aa0-42f2-9e7b-d781a50eec9f'::uuid, NULL, 50, NULL) AS s
  UNION ALL
  SELECT p.n + 1,
         public.get_completion_evidence_snapshot_v2(
           '3779546f-5aa0-42f2-9e7b-d781a50eec9f'::uuid,
           p.s->'page'->>'next_cursor', 50, p.s->>'snapshot_token')
  FROM pages p
  WHERE coalesce((p.s->'page'->>'has_more')::boolean, false) AND p.n < 20
)
SELECT (SELECT s->>'execution_state' FROM pages WHERE n = 1) AS execution_state,
       (SELECT s->'counts' FROM pages WHERE n = 1)            AS counts,
       (SELECT s->'unresolved_items' FROM pages ORDER BY n DESC LIMIT 1) AS unresolved_items,
       (SELECT count(*) FROM pages)                           AS pages,
       (SELECT jsonb_agg(e ORDER BY p.n, o)
          FROM pages p, jsonb_array_elements(p.s->'page'->'entities') WITH ORDINALITY AS x(e, o)) AS entities;

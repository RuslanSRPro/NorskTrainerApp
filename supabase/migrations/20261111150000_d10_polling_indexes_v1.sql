-- D10_polling_indexes_v1 (11.11.2026, after 454 / 455): the three most expensive database calls are background
-- polls (~27 000 s in total, many hitting the 8 s limit) that keep the app waiting (learning screen 30-40 s,
-- family 360 not opening):
--   get_stranded_expression_candidates    authoritative_semantic_relations: has_expression / candidate, oldest first
--   claim_next_semantic_audit             lexeme_semantic_enrichment: status pending / retry, oldest first (+ job)
--   claim_next_expression_semantic_audit  expression_semantic_enrichment: the same for expressions
-- Without matching indexes every poll scans the whole table. Partial indexes on exactly these conditions make
-- each poll a short index read. The functions themselves are not changed.
-- An index is created only when no index with the same leading columns exists. The report at the end shows the
-- queue sizes and which indexes were created. Takes a few seconds (brief write lock on the tables).

DO $idx$
DECLARE r record;
  FUNCTION_UNUSED integer;
BEGIN
  NULL;
END
$idx$;

-- helper: does an index on table t start with exactly these columns?
CREATE OR REPLACE FUNCTION pg_temp.d10_has_index(t regclass, cols text[]) RETURNS boolean LANGUAGE sql AS $f$
  SELECT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = t
      AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
           FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
           JOIN pg_attribute a ON a.attrelid = t AND a.attnum = k.attnum
           WHERE k.ord <= cardinality(cols)) = cols)
$f$;

CREATE TEMP TABLE d10_idx_report(part text, info text) ON COMMIT DROP;

DO $idx$
BEGIN
  -- 1. stranded expression candidates
  CREATE INDEX IF NOT EXISTS d10_asr_has_expression_candidate_v1
    ON public.authoritative_semantic_relations (created_at)
    WHERE relation_type = 'has_expression' AND status = 'candidate' AND target_entity_id IS NOT NULL;
  INSERT INTO d10_idx_report VALUES ('index', 'd10_asr_has_expression_candidate_v1');

  -- 2. semantic audit queues (only the waiting rows are indexed)
  CREATE INDEX IF NOT EXISTS d10_lse_waiting_v1
    ON public.lexeme_semantic_enrichment (created_at) WHERE status IN ('pending', 'retry');
  CREATE INDEX IF NOT EXISTS d10_ese_waiting_v1
    ON public.expression_semantic_enrichment (created_at) WHERE status IN ('pending', 'retry');
  INSERT INTO d10_idx_report VALUES ('index', 'd10_lse_waiting_v1, d10_ese_waiting_v1');

  -- 3. job filter of the claims (items of one job by card)
  IF NOT pg_temp.d10_has_index('public.lexeme_processing_items', ARRAY['job_id', 'lexeme_id']) THEN
    CREATE INDEX d10_lpi_job_lexeme_v1 ON public.lexeme_processing_items (job_id, lexeme_id);
    INSERT INTO d10_idx_report VALUES ('index', 'd10_lpi_job_lexeme_v1 (new)');
  ELSE
    INSERT INTO d10_idx_report VALUES ('index', 'lexeme_processing_items (job_id, lexeme_id): already exists');
  END IF;
  IF NOT pg_temp.d10_has_index('public.lexeme_processing_items', ARRAY['job_id', 'expression_id']) THEN
    CREATE INDEX d10_lpi_job_expression_v1 ON public.lexeme_processing_items (job_id, expression_id);
    INSERT INTO d10_idx_report VALUES ('index', 'd10_lpi_job_expression_v1 (new)');
  ELSE
    INSERT INTO d10_idx_report VALUES ('index', 'lexeme_processing_items (job_id, expression_id): already exists');
  END IF;

  ANALYZE public.authoritative_semantic_relations;
  ANALYZE public.lexeme_semantic_enrichment;
  ANALYZE public.expression_semantic_enrichment;

  INSERT INTO d10_idx_report SELECT 'queue', 'lexeme_semantic_enrichment waiting: ' || count(*)
    FROM public.lexeme_semantic_enrichment WHERE status IN ('pending', 'retry');
  INSERT INTO d10_idx_report SELECT 'queue', 'expression_semantic_enrichment waiting: ' || count(*)
    FROM public.expression_semantic_enrichment WHERE status IN ('pending', 'retry');
  INSERT INTO d10_idx_report SELECT 'queue', 'has_expression candidates: ' || count(*) ||
      ', of them stranded: ' || count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM public.expression_catalog ec WHERE ec.id = r.target_entity_id))
    FROM public.authoritative_semantic_relations r
    WHERE r.relation_type = 'has_expression' AND r.status = 'candidate' AND r.target_entity_id IS NOT NULL;
END
$idx$;

SELECT part, info FROM d10_idx_report;

-- D10 15.10.2026 (agreed): progress counter of the job window ("plan / fact").
-- public.get_job_chain_progress: same signature, same columns, same
-- current/complete rules. Only the numbers change:
--   done  = items the chain FINISHED (done, no data or failed) in the per-item
--           ledger private.d10_job_enrichment_item_state_v1 (was: the page
--           offset of the supervisor, 0 for batch chains like AI);
--   total = while the chain is not finished: the items it will take, counted by
--           the same selection as job-enrichment-batch-worker; when finished:
--           the items it actually took (ledger), so plan = fact at the end.
-- Preflight: the live definition must be the known one (anchors), otherwise
-- nothing changes. Re-running is a no-op.

DO $patch$
DECLARE
  v text := pg_get_functiondef('public.get_job_chain_progress(uuid)'::regprocedure);
BEGIN
  IF position('d10_counter_v1' IN v) > 0 THEN
    RAISE NOTICE 'D10 counter: already installed';
    RETURN;
  END IF;
  IF position('fact_done_count' IN v) = 0 OR position('enrichment_offsets->>ct.chain_key' IN v) = 0 THEN
    RAISE EXCEPTION 'D10_COUNTER_PREFLIGHT: live get_job_chain_progress is not the expected version; nothing changed';
  END IF;

  EXECUTE $def$
CREATE OR REPLACE FUNCTION public.get_job_chain_progress(p_job_id uuid)
 RETURNS TABLE(chain_index integer, chain_key text, display_label text, done_count integer, total_count integer, is_current boolean, is_complete boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
-- d10_counter_v1 (15.10.2026): numbers from the per-item ledger.
BEGIN
  RETURN QUERY
  WITH job_row AS (
    SELECT j.id, j.status FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id
  ),
  items AS (
    SELECT i.id, i.lexeme_id, i.expression_id, i.match_type, i.current_stage, l.pos
    FROM public.lexeme_processing_items i
    LEFT JOIN public.lexemes l ON l.id = i.lexeme_id
    WHERE i.job_id = p_job_id
  ),
  estimate AS (
    SELECT
      -- ordbokene: promoted words and expressions (family admission included)
      (SELECT count(*) FROM items WHERE current_stage IN ('semantic_audit', 'admission_gate')
         AND (lexeme_id IS NOT NULL OR expression_id IS NOT NULL))::int AS ordbokene,
      -- expression chains: one per expression item
      (SELECT count(*) FROM items WHERE expression_id IS NOT NULL)::int AS expressions,
      -- word chains deduplicated by card (Lexin, reorder, canonicalization)
      (SELECT count(DISTINCT lexeme_id) FROM items WHERE current_stage = 'semantic_audit'
         AND match_type = 'token' AND lexeme_id IS NOT NULL)::int AS word_cards,
      -- word chains per item (authoritative, AI for words)
      (SELECT count(*) FROM items WHERE current_stage = 'semantic_audit'
         AND match_type = 'token' AND lexeme_id IS NOT NULL)::int AS word_items,
      -- forms: cards of verbs, nouns, adjectives, determiners
      (SELECT count(DISTINCT lexeme_id) FROM items WHERE current_stage = 'semantic_audit'
         AND match_type = 'token' AND lexeme_id IS NOT NULL
         AND pos IN ('verb', 'noun', 'adjective', 'determiner'))::int AS form_cards
  ),
  ledger AS (
    SELECT s.chain,
           count(*) FILTER (WHERE s.status IN ('done', 'no_data', 'failed'))::int AS finished,
           count(*)::int AS claimed
    FROM private.d10_job_enrichment_item_state_v1 s
    WHERE s.job_id = p_job_id
    GROUP BY s.chain
  ),
  supervisor AS (
    SELECT p.enrichment_chain_index, p.enrichment_offsets
    FROM public.pipeline_supervisor_state p
    WHERE p.job_id = p_job_id
  ),
  chains AS (
    SELECT c.chain_index, c.chain_key, c.display_label,
      CASE
        WHEN c.chain_key = 'ordbokene' THEN e.ordbokene
        WHEN c.chain_key IN ('naob', 'naob_synonyms', 'expression_translation', 'expression_ai_fallback') THEN e.expressions
        WHEN c.chain_key IN ('lexeme_translation', 'translation_reorder', 'translation_canonicalization') THEN e.word_cards
        WHEN c.chain_key IN ('authoritative', 'authoritative_ai_fallback') THEN e.word_items
        WHEN c.chain_key = 'forms' THEN e.form_cards
        ELSE (SELECT count(*)::int FROM items)
      END AS planned,
      coalesce(lg.finished, 0) AS finished,
      coalesce(lg.claimed, 0) AS claimed,
      (
        (SELECT status FROM job_row) IN ('done', 'completed')
        OR c.chain_index < coalesce((SELECT enrichment_chain_index FROM supervisor), 0)
      ) AS chain_passed
    FROM public.pipeline_enrichment_chains c
    CROSS JOIN estimate e
    LEFT JOIN ledger lg ON lg.chain = c.chain_key
  )
  SELECT
    ch.chain_index,
    ch.chain_key,
    ch.display_label,
    ch.finished AS done_count,
    CASE WHEN ch.chain_passed AND ch.claimed > 0 THEN ch.claimed
         WHEN ch.chain_passed THEN ch.finished
         ELSE greatest(ch.planned, ch.claimed) END AS total_count,
    coalesce((ch.chain_index = s.enrichment_chain_index)
      AND (SELECT status FROM job_row) NOT IN ('done', 'completed'), false) AS is_current,
    (
      ch.chain_passed
      OR coalesce((s.enrichment_offsets->>ch.chain_key)::int, 0) >= greatest(ch.planned, ch.claimed)
    ) AS is_complete
  FROM chains ch
  LEFT JOIN supervisor s ON true
  ORDER BY ch.chain_index;
END;
$function$
$def$;
  RAISE NOTICE 'D10 counter: get_job_chain_progress counts from the per-item ledger';
END
$patch$;

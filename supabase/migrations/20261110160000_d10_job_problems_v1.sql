-- D10_job_problems_v1 (10.11.2026, agreed): the analysis report lists the problem words and the reason, instead of
-- only "2 enrichment items failed". public.get_job_problem_items_v1(job) returns one row per word and reason:
--   no_translation / no_translation_en / no_example / example_no_translation  (state of the card NOW, as the app loads it)
--   ai_rejected            AI translation rejected by the AI quality review (empty rather than wrong)
--   ai_example_highlight   AI example rejected: the highlighted words are not in the sentence
--   no_unique_article      the card has several Ordbøkene articles or none, AI cannot choose a sense
--   not_confirmed          the dictionaries did not confirm the expression as a whole (grey card)
--   pos_unconfirmed        part of speech not confirmed by a dictionary (grey card)
--   not_found              no source knows the word
--   enrichment_error       any other failed step (detail = error code)
-- Read-only. The owner of the job (or the service role) may read it. Re-running is a no-op.
CREATE OR REPLACE FUNCTION public.get_job_problem_items_v1(p_job_id uuid)
RETURNS TABLE(lemma text, kind text, reason text, detail text, lexeme_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_owner uuid;
  v_ids uuid[];
  v_page uuid[];
  v_i integer;
BEGIN
  SELECT j.user_id INTO v_owner FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;
  -- SQL Editor (session postgres), the service role, or the owner of the job
  IF session_user NOT IN ('postgres', 'supabase_admin') AND auth.role() IS DISTINCT FROM 'service_role'
     AND v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'JOB_NOT_OWNED';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS d10_jp_items(item_id uuid, lemma text, kind text, card uuid, stage text, summary jsonb) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS d10_jp_out(lemma text, kind text, reason text, detail text, lexeme_id uuid) ON COMMIT DROP;
  TRUNCATE d10_jp_items; TRUNCATE d10_jp_out;

  INSERT INTO d10_jp_items
  SELECT i.id, coalesce(e.lemma, l.lemma, i.normalized_lemma),
    CASE WHEN i.expression_id IS NOT NULL OR l.pos = 'expression' THEN 'expression' ELSE 'word' END,
    coalesce(i.lexeme_id, e.lexeme_id), i.current_stage, coalesce(i.result_summary, '{}'::jsonb)
  FROM public.lexeme_processing_items i
  LEFT JOIN public.expression_catalog e ON e.id = i.expression_id
  LEFT JOIN public.lexemes l ON l.id = i.lexeme_id
  WHERE i.job_id = p_job_id;

  -- 1) stopped before the card became a learning card
  INSERT INTO d10_jp_out
  SELECT it.lemma, it.kind,
    CASE
      WHEN it.summary->>'admission_status' = 'pos_unverified' OR it.summary->>'admission_reason' LIKE '%POS%' THEN 'pos_unconfirmed'
      WHEN it.summary->>'admission_status' = 'not_found_anywhere' THEN 'not_found'
      ELSE 'not_confirmed' END,
    it.summary->>'admission_reason', it.card
  FROM d10_jp_items it WHERE it.stage = 'admission_gate';

  -- 2) enrichment steps that ended without a result
  INSERT INTO d10_jp_out
  SELECT it.lemma, it.kind,
    CASE
      WHEN s.outcome_code = 'ai_review_rejected' THEN 'ai_rejected'
      WHEN s.last_error LIKE '%AI_EXAMPLE_HIGHLIGHTS_INVALID%' THEN 'ai_example_highlight'
      WHEN s.last_error LIKE '%SELECTED_BM_ARTICLE_REQUIRED%' THEN 'no_unique_article'
      WHEN s.last_error LIKE '%AI_POS_SENSE_REVIEW_REJECTED%' THEN 'ai_rejected'
      ELSE 'enrichment_error' END,
    s.chain || ': ' || coalesce(substring(s.last_error FROM '([A-Z][A-Z0-9_]{5,})'), s.outcome_code, s.status),
    it.card
  FROM private.d10_job_enrichment_item_state_v1 s
  JOIN d10_jp_items it ON it.item_id = s.item_id
  WHERE s.job_id = p_job_id
    AND (s.status = 'failed' OR (s.status = 'no_data' AND (s.outcome_code = 'ai_review_rejected'
         OR s.last_error LIKE '%SELECTED_BM_ARTICLE_REQUIRED%' OR s.last_error LIKE '%AI_%')));

  -- 3) the learning cards of the job as the app shows them now
  SELECT array_agg(DISTINCT it.card) INTO v_ids FROM d10_jp_items it
  JOIN public.lexemes l ON l.id = it.card
  WHERE it.stage <> 'admission_gate' AND l.is_learning_lexeme AND coalesce(l.dictionary_status, 'active') = 'active';
  IF v_ids IS NOT NULL THEN
    CREATE TEMP TABLE IF NOT EXISTS d10_jp_tr(lexeme_id uuid, language_code text) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS d10_jp_ex(lexeme_id uuid, n bigint, example_text text, translation_uk text) ON COMMIT DROP;
    TRUNCATE d10_jp_tr; TRUNCATE d10_jp_ex;
    FOR v_i IN 0 .. (cardinality(v_ids) - 1) / 50 LOOP
      v_page := v_ids[v_i * 50 + 1 : v_i * 50 + 50];
      INSERT INTO d10_jp_tr SELECT t.lexeme_id, t.language_code
        FROM public.get_canonical_lexeme_translations_v1(v_page) t WHERE nullif(btrim(t.translation), '') IS NOT NULL;
      INSERT INTO d10_jp_ex SELECT x.lexeme_id, x.n, x.example_text, x.translation_uk
        FROM public.get_canonical_lexeme_examples_v1(v_page)
          WITH ORDINALITY AS x(lexeme_id, expression_id, id, example_text, translation_uk, source, cefr_level, enrichment_evidence, n);
    END LOOP;
    INSERT INTO d10_jp_out
    SELECT DISTINCT ON (c.id, r.reason) coalesce(it.lemma, l.lemma), CASE WHEN l.pos = 'expression' THEN 'expression' ELSE 'word' END,
      r.reason, NULL, c.id
    FROM unnest(v_ids) AS c(id)
    JOIN public.lexemes l ON l.id = c.id
    LEFT JOIN d10_jp_items it ON it.card = c.id
    CROSS JOIN LATERAL (
      SELECT 'no_translation' AS reason WHERE NOT EXISTS (SELECT 1 FROM d10_jp_tr t WHERE t.lexeme_id = c.id AND t.language_code = 'uk')
      UNION ALL SELECT 'no_translation_en' WHERE NOT EXISTS (SELECT 1 FROM d10_jp_tr t WHERE t.lexeme_id = c.id AND t.language_code = 'en')
      UNION ALL SELECT 'no_example' WHERE NOT EXISTS (SELECT 1 FROM d10_jp_ex x WHERE x.lexeme_id = c.id AND nullif(btrim(x.example_text), '') IS NOT NULL)
      UNION ALL SELECT 'example_no_translation' WHERE EXISTS (
        SELECT 1 FROM (SELECT DISTINCT ON (x.lexeme_id) x.* FROM d10_jp_ex x WHERE x.lexeme_id = c.id ORDER BY x.lexeme_id, x.n) f
        WHERE nullif(btrim(f.example_text), '') IS NOT NULL AND nullif(btrim(f.translation_uk), '') IS NULL)
    ) r;
  END IF;

  RETURN QUERY SELECT DISTINCT o.lemma, o.kind, o.reason, o.detail, o.lexeme_id FROM d10_jp_out o
    ORDER BY o.reason, o.lemma;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_job_problem_items_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_problem_items_v1(uuid) TO authenticated, service_role;

SELECT 'D10_job_problems_v1 installed' AS result;

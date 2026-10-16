-- 71_d10_stage_a_impact.sql
-- Read only. Impact check for stage A of D10_homonym_pos_plan_v1 before any change.
-- One result set: section | name | detail
--
-- 1_multi_article  lexemes whose Bokmål forms are bound to several articles of
--                  the same POS (the cases the A1 "bound article set" rule touches),
--                  with the CURRENT Ordbokene evidence stored on the lexeme.
--                  ai_guard_passes_now = true means the AI enrichment / AI review
--                  guard (pos-sense-guard selectedArticle: exactly one bm article,
--                  same POS) works for it today. After A1 a re-promotion would
--                  store the article SET there, and that guard would stop working
--                  for this lexeme. false = the guard already fails today.
-- 2_multi_summary  counts of section 1.
-- 3_jobs_blocked   last 30 jobs: items counted as "admission_blocked" by the
--                  supervisor (admission_gate, not promoted, not a family
--                  candidate), split into intentionally excluded function words
--                  (same rule as get_completion_evidence_snapshot_v1) and others.
WITH multi AS (
  SELECT f.lexeme_id, f.pos,
         array_agg(DISTINCT a::text ORDER BY a::text) AS bound_articles
  FROM public.lexeme_form_display_v2 f, unnest(f.article_ids) a
  WHERE f.dictionary_code = 'bm' AND a IS NOT NULL
  GROUP BY f.lexeme_id, f.pos
  HAVING count(DISTINCT a) > 1
),
multi_lex AS (
  SELECT m.*, l.lemma, l.verification_evidence->'Ordbokene' AS ord
  FROM multi m JOIN public.lexemes l ON l.id = m.lexeme_id
),
multi_eval AS (
  SELECT ml.*,
    (ml.ord->>'status' = 'done'
      AND ml.ord->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
      AND ml.ord->'evidence'->'raw_preview'->>'pos' = ml.pos
      AND jsonb_typeof(ml.ord->'evidence'->'raw_preview'->'article_ids') = 'array'
      AND jsonb_array_length(ml.ord->'evidence'->'raw_preview'->'article_ids') = 1
      AND ml.ord->'evidence'->'raw_preview'->'article_ids'->>0 ~ '^[0-9]+$') AS ai_guard_passes_now
  FROM multi_lex ml
),
recent_jobs AS (
  SELECT j.id, j.status, j.created_at, left(j.input_text, 60) AS input
  FROM public.lexeme_processing_jobs j
  ORDER BY j.created_at DESC
  LIMIT 30
),
blocked AS (
  SELECT i.job_id,
    count(*) FILTER (WHERE fw.is_fw) AS function_words,
    count(*) FILTER (WHERE NOT fw.is_fw) AS other_blocked,
    jsonb_agg(jsonb_build_object('lemma', i.normalized_lemma, 'pos', i.pos,
      'admission_status', i.result_summary->>'admission_status',
      'admission_reason', i.result_summary->>'admission_reason')
      ORDER BY i.created_at) FILTER (WHERE NOT fw.is_fw) AS other_items
  FROM public.lexeme_processing_items i
  JOIN recent_jobs r ON r.id = i.job_id
  LEFT JOIN private.d10_job_family_injections_v1 family
    ON family.job_id = i.job_id AND family.item_id = i.id
   AND family.expression_id = i.expression_id
  CROSS JOIN LATERAL (SELECT coalesce(
        i.result_summary->>'admission_status' = 'rejected'
    AND i.result_summary->>'admission_reason' LIKE 'function_word_%'
    AND i.result_summary->'admission_decision'->>'admit' = 'false'
    AND i.result_summary->'admission_decision'->>'status' = 'rejected'
    AND i.result_summary->'admission_decision'->>'rule_type' = 'function_word', false) AS is_fw) fw
  WHERE i.current_stage = 'admission_gate'
    AND i.result_summary->>'promotion_status' = 'not_promoted'
    AND family.item_id IS NULL
  GROUP BY i.job_id
)
SELECT '1_multi_article' AS section, me.lemma || ' (' || me.pos || ')' AS name,
       jsonb_build_object(
         'lexeme_id', me.lexeme_id,
         'bound_articles', me.bound_articles,
         'ai_guard_passes_now', me.ai_guard_passes_now,
         'current_ordbokene', jsonb_build_object(
           'status', me.ord->>'status', 'found', me.ord->>'found',
           'article_ids', me.ord->'evidence'->'raw_preview'->'article_ids',
           'candidate_article_ids', me.ord->'evidence'->'raw_preview'->'candidate_article_ids',
           'article_selection', me.ord->'evidence'->'raw_preview'->>'article_selection',
           'label', me.ord->'evidence'->>'evidence_label')) AS detail
FROM multi_eval me
UNION ALL
SELECT '2_multi_summary', 'lexemes_with_several_bound_articles',
       jsonb_build_object(
         'total', count(*),
         'ai_guard_passes_now', count(*) FILTER (WHERE ai_guard_passes_now),
         'ai_guard_fails_now', count(*) FILTER (WHERE NOT coalesce(ai_guard_passes_now, false)))
FROM multi_eval
UNION ALL
SELECT '3_jobs_blocked', to_char(r.created_at, 'YYYY-MM-DD HH24:MI') || ' ' || r.status,
       jsonb_build_object('job_id', r.id, 'input', r.input,
         'function_words', coalesce(b.function_words, 0),
         'other_blocked', coalesce(b.other_blocked, 0),
         'other_items', b.other_items)
FROM recent_jobs r LEFT JOIN blocked b ON b.job_id = r.id
ORDER BY 1, 2;

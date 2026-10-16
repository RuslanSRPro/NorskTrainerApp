-- 74_d10_function_words_inventory.sql
-- Read only. What the base already holds for function words (служебные слова)
-- before planning "function words in the base, marked, with their forms;
-- used by text analysis, never by learning".
-- One result set: section | name | detail
--   1_rules      active function_word admission rules (dictionary_admission_rules)
--   2_lexemes    per rule value: lexeme rows with that lemma, their POS,
--                dictionary_status / is_learning_lexeme marking, number of
--                Bokmål forms and form values in lexeme_form_display_v2,
--                learning_progress rows (should be 0 for function words)
--   3_form_rules surface forms that ARE a function-word form of some lexeme
--                but have NO rule of their own (e.g. meg, min, dem) - these
--                would not be recognised as function words in a text today
--   4_summary    counts
WITH rules AS (
  SELECT r.normalized_value, r.reason, r.pos, r.match_type, r.priority, r.action
  FROM public.dictionary_admission_rules r
  WHERE r.rule_type = 'function_word' AND r.is_active
),
lex AS (
  SELECT r.normalized_value, l.id, l.lemma, l.pos, l.dictionary_status,
         l.dictionary_exclusion_reason, l.is_learning_lexeme
  FROM rules r
  JOIN public.lexemes l ON lower(l.lemma) = r.normalized_value
),
forms AS (
  SELECT f.lexeme_id,
         count(*) AS form_rows,
         array_agg(DISTINCT v ORDER BY v) AS form_values
  FROM public.lexeme_form_display_v2 f
  CROSS JOIN LATERAL unnest(coalesce(f.primary_values, '{}'::text[])
                            || coalesce(f.alternative_values, '{}'::text[])) v
  WHERE f.dictionary_code = 'bm' AND f.lexeme_id IN (SELECT id FROM lex)
  GROUP BY f.lexeme_id
),
progress AS (
  SELECT lp.lexeme_id, count(*) AS rows
  FROM public.learning_progress lp
  WHERE lp.lexeme_id IN (SELECT id FROM lex)
  GROUP BY lp.lexeme_id
),
form_values AS (
  SELECT DISTINCT lower(v) AS value, l.normalized_value AS rule_lemma
  FROM lex l JOIN forms f ON f.lexeme_id = l.id, unnest(f.form_values) v
)
SELECT '1_rules' AS section, r.normalized_value AS name,
       jsonb_build_object('reason', r.reason, 'pos', r.pos, 'match_type', r.match_type,
                          'action', r.action, 'priority', r.priority) AS detail
FROM rules r
UNION ALL
SELECT '2_lexemes', r.normalized_value,
       coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'lexeme_id', l.id, 'pos', l.pos,
                  'dictionary_status', l.dictionary_status,
                  'exclusion_reason', l.dictionary_exclusion_reason,
                  'is_learning_lexeme', l.is_learning_lexeme,
                  'bm_form_rows', coalesce(f.form_rows, 0),
                  'form_values', f.form_values,
                  'learning_progress_rows', coalesce(p.rows, 0)) ORDER BY l.pos)
                 FROM lex l
                 LEFT JOIN forms f ON f.lexeme_id = l.id
                 LEFT JOIN progress p ON p.lexeme_id = l.id
                 WHERE l.normalized_value = r.normalized_value),
                '"NO LEXEME"'::jsonb)
FROM rules r
UNION ALL
SELECT '3_form_rules', fv.value, jsonb_build_object('form_of', fv.rule_lemma)
FROM form_values fv
WHERE NOT EXISTS (SELECT 1 FROM rules r WHERE r.normalized_value = fv.value)
UNION ALL
SELECT '4_summary', 'counts', jsonb_build_object(
  'rules', (SELECT count(*) FROM rules),
  'rules_without_lexeme', (SELECT count(*) FROM rules r WHERE NOT EXISTS (SELECT 1 FROM lex l WHERE l.normalized_value = r.normalized_value)),
  'lexemes', (SELECT count(*) FROM lex),
  'lexemes_marked_excluded', (SELECT count(*) FROM lex WHERE dictionary_status = 'excluded' AND NOT is_learning_lexeme),
  'lexemes_with_bm_forms', (SELECT count(*) FROM forms),
  'lexemes_in_learning_progress', (SELECT count(*) FROM progress),
  'form_values_without_rule', (SELECT count(*) FROM form_values fv WHERE NOT EXISTS (SELECT 1 FROM rules r WHERE r.normalized_value = fv.value)))
ORDER BY 1, 2;

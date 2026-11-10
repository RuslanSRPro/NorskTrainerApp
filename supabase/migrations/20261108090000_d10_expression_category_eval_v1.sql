-- D10_expression_category_eval_v1 (08.11.2026): test of 3 models for expression categories (changes no category).
-- Sample (fixed, deterministic): expressions with a trusted category as reference (idiom, time, conversation,
-- discourse, collocation, fixed) + particle_verb rows without any particle (suspected wrong) + dictionary expressions
-- without category (no reference: judged by eye). Results: private.d10_expr_category_eval_v1, compare with query 373.

CREATE TABLE IF NOT EXISTS private.d10_expr_category_eval_v1 (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL,
  model text NOT NULL,
  thinking text,
  batch_no integer NOT NULL,
  expression_id uuid NOT NULL,
  lemma text NOT NULL,
  reference text,
  answer text,
  confidence text,
  tokens_in integer,
  tokens_out integer,
  tokens_thought integer,
  batch_ms integer,
  batch_size integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_expr_category_eval_v1 FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.d10_expr_category_eval_sample_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH base AS (
    SELECT e.id, e.lemma, e.expression_subtype::text AS subtype,
      coalesce(nullif(e.raw_sources->>'definition_preview', ''),
               nullif(e.raw_sources->'glosses'->0->>'gloss', ''),
               nullif(e.verification_evidence->>'definition_preview', '')) AS gloss,
      (SELECT string_agg(t.translation, '; ' ORDER BY t.language_code, t.translation)
       FROM (SELECT DISTINCT t.language_code, t.translation FROM public.entity_translations t
             WHERE t.expression_id = e.id AND t.language_code IN ('uk', 'en') LIMIT 4) t) AS translations,
      md5(e.id::text) AS ord
    FROM public.expression_catalog e
    WHERE nullif(btrim(e.lemma), '') IS NOT NULL
  ),
  picked AS (
    (SELECT *, subtype AS reference FROM base WHERE subtype = 'idiom' ORDER BY ord LIMIT 15)
    UNION ALL (SELECT *, subtype FROM base WHERE subtype = 'time_expression' ORDER BY ord LIMIT 10)
    UNION ALL (SELECT *, subtype FROM base WHERE subtype = 'conversation_phrase' ORDER BY ord LIMIT 8)
    UNION ALL (SELECT *, subtype FROM base WHERE subtype = 'discourse_marker' ORDER BY ord LIMIT 8)
    UNION ALL (SELECT *, subtype FROM base WHERE subtype = 'collocation' ORDER BY ord LIMIT 10)
    UNION ALL (SELECT *, subtype FROM base WHERE subtype = 'fixed_expression' AND lemma !~ '[\./]' ORDER BY ord LIMIT 10)
    UNION ALL (SELECT *, 'suspect:particle_verb' FROM base WHERE subtype = 'particle_verb'
                 AND lemma !~* ' (inn|ut|opp|ned|fram|frem|av|på|an|til|bort|igjen|sammen|over|unna|vekk|tilbake|rundt|innom|gjennom|forbi|etter|med|om)$'
               ORDER BY ord LIMIT 9)
    UNION ALL (SELECT *, NULL FROM base WHERE subtype IN ('ordbokene_sub_article', 'naob_expression') AND gloss IS NOT NULL
               ORDER BY ord LIMIT 20)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'lemma', lemma, 'reference', reference,
           'gloss', left(gloss, 300), 'translations', left(translations, 200)) ORDER BY ord), '[]'::jsonb)
  FROM picked
$function$;

CREATE OR REPLACE FUNCTION public.d10_expr_category_eval_record_v1(p_rows jsonb)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH ins AS (
    INSERT INTO private.d10_expr_category_eval_v1 (run_id, model, thinking, batch_no, expression_id, lemma, reference,
      answer, confidence, tokens_in, tokens_out, tokens_thought, batch_ms, batch_size, error)
    SELECT r.run_id, r.model, r.thinking, r.batch_no, r.expression_id, r.lemma, r.reference, r.answer, r.confidence,
      r.tokens_in, r.tokens_out, r.tokens_thought, r.batch_ms, r.batch_size, r.error
    FROM jsonb_to_recordset(p_rows) AS r(run_id text, model text, thinking text, batch_no integer, expression_id uuid,
      lemma text, reference text, answer text, confidence text, tokens_in integer, tokens_out integer,
      tokens_thought integer, batch_ms integer, batch_size integer, error text)
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins
$function$;

REVOKE ALL ON FUNCTION public.d10_expr_category_eval_sample_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_category_eval_record_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_expr_category_eval_sample_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_category_eval_record_v1(jsonb) TO service_role;

SELECT 'd10_expression_category_eval_v1 installed' AS result,
  jsonb_array_length(public.d10_expr_category_eval_sample_v1()) AS sample_size;

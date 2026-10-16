-- D10 15.10.2026: family 360 of a NEW second homograph card stayed empty.
-- An Ordbøkene sub-article expression (like tall, like for like, uten like)
-- is bound to its card through lexeme_headword_aliases_v2 in the first
-- chain, but the alias "article -> card" of a new card is written only when
-- its forms are published (last chain). The binding then returns NULL
-- silently and was never repeated.
-- Adds a repeat of the SAME binding (bind_lexeme360_expression_roots_batch_v1,
-- unchanged, with all its checks) for expressions that still have no family
-- card. Nothing existing is changed.

CREATE OR REPLACE FUNCTION public.d10_rebind_expression_roots_v1(p_expression_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_group record;
  v_root uuid;
  v_bound integer := 0;
  v_no_card integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  FOR v_group IN
    SELECT c.parent_article_id, lower(c.parent_dictionary_code) AS dict,
           min(c.parent_lemma) AS parent_lemma,
           array_agg(DISTINCT c.promoted_expression_id) AS expression_ids
    FROM public.ordbokene_expression_candidates c
    WHERE c.status IN ('promoted', 'duplicate')
      AND c.promoted_expression_id IS NOT NULL
      AND c.parent_article_id > 0
      AND lower(c.parent_dictionary_code) IN ('bm', 'nn')
      AND (p_expression_ids IS NULL OR c.promoted_expression_id = ANY (p_expression_ids))
      AND NOT EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 r
                      WHERE r.expression_id = c.promoted_expression_id)
      AND EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.id = c.promoted_expression_id)
    GROUP BY c.parent_article_id, lower(c.parent_dictionary_code),
             private.normalize_lexeme360_root_v1(c.parent_lemma)
  LOOP
    BEGIN
      v_root := public.bind_lexeme360_expression_roots_batch_v1(
        v_group.expression_ids[1:500], v_group.parent_article_id, v_group.dict, v_group.parent_lemma);
      IF v_root IS NULL THEN
        v_no_card := v_no_card + cardinality(v_group.expression_ids);
      ELSE
        v_bound := v_bound + least(cardinality(v_group.expression_ids), 500);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + cardinality(v_group.expression_ids);
      IF jsonb_array_length(v_errors) < 10 THEN
        v_errors := v_errors || jsonb_build_object('article', v_group.parent_article_id, 'error', SQLERRM);
      END IF;
    END;
  END LOOP;
  RETURN jsonb_build_object('bound', v_bound, 'no_card_yet', v_no_card, 'failed', v_failed, 'errors', v_errors);
END;
$body$;

-- The job step: expressions of the job and Ordbøkene sub-articles of the
-- articles of the job's words (cards).
CREATE OR REPLACE FUNCTION public.d10_rebind_job_expression_roots_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT x.id) INTO v_ids FROM (
    SELECT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
    UNION
    SELECT c.promoted_expression_id
    FROM public.lexeme_processing_items i
    JOIN public.lexeme_headword_aliases_v2 a ON a.lexeme_id = i.lexeme_id AND a.is_active
    JOIN public.ordbokene_expression_candidates c
      ON c.parent_article_id = a.article_id AND lower(c.parent_dictionary_code) = a.dictionary_code
    WHERE i.job_id = p_job_id AND i.lexeme_id IS NOT NULL AND c.promoted_expression_id IS NOT NULL
  ) x WHERE x.id IS NOT NULL;
  IF coalesce(cardinality(v_ids), 0) = 0 THEN
    RETURN jsonb_build_object('bound', 0, 'no_card_yet', 0, 'failed', 0, 'errors', '[]'::jsonb);
  END IF;
  RETURN public.d10_rebind_expression_roots_v1(v_ids);
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_rebind_expression_roots_v1(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_rebind_job_expression_roots_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_rebind_expression_roots_v1(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_rebind_job_expression_roots_v1(uuid) TO service_role;

DO $check$
BEGIN
  IF to_regprocedure('public.bind_lexeme360_expression_roots_batch_v1(uuid[],bigint,text,text)') IS NULL THEN
    RAISE EXCEPTION 'd10 family rebind: binding function missing';
  END IF;
  RAISE NOTICE 'd10 family rebind v1 installed';
END
$check$;

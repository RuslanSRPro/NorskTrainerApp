-- D10_expression_resolver_fix_v1 (29.10.2026)
-- D10_expression_resolver_v1 added public.d10_lexeme_for_article_v1(bigint) next to the
-- existing public.d10_lexeme_for_article_v1(bigint, text DEFAULT, text DEFAULT) (headword
-- aliases). A call with one argument became ambiguous ("is not unique"): 11 real
-- expressions stopped at the head word step. The existing function was NOT changed.
--   1. the resolver's helper is removed and comes back under its own name
--      d10_expr_resolver_head_card_v1(bigint); it also uses the existing headword alias
--      function (called with all three arguments) as a second source;
--   2. d10_expr_resolver_state_v1 calls the new name (nothing else changed);
--   3. resolutions that failed on this error are queued again with attempts reset.
-- Guards: md5 of the helper (must be the resolver's one) and of the state function.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE v_md5 text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_lexeme_for_article_v1(bigint)');
  IF v_md5 IS DISTINCT FROM '5be85ad5d38350dd253e1bd33bcaacb0' THEN
    RAISE EXCEPTION 'STOP: d10_lexeme_for_article_v1(bigint) is not the resolver version (md5 %); nothing changed', v_md5;
  END IF;
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_expr_resolver_state_v1(text,bigint,bigint[])');
  IF v_md5 IS DISTINCT FROM '20bfdf527e307d92a332be50c06cb1b8' THEN
    RAISE EXCEPTION 'STOP: d10_expr_resolver_state_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
END
$pre$;

DROP FUNCTION public.d10_lexeme_for_article_v1(bigint);

CREATE OR REPLACE FUNCTION public.d10_expr_resolver_head_card_v1(p_article_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT jsonb_build_object('lexeme_id', l.id, 'lemma', l.lemma, 'pos', l.pos)
  FROM public.lexemes l
  WHERE l.id IN (
      SELECT b.lexeme_id FROM private.authoritative_morphology_article_bindings_v2 b
      WHERE b.article_id = p_article_id AND b.is_active AND b.dictionary_code = 'bm'
      UNION
      SELECT ms.lexeme_id FROM private.authoritative_morphology_snapshots_v2 ms
      WHERE ms.is_active AND p_article_id = ANY (ms.source_article_ids)
      UNION
      SELECT public.d10_lexeme_for_article_v1(p_article_id, 'bm'::text, NULL::text))
    AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
  ORDER BY (coalesce(l.dictionary_status, '') = 'active') DESC, l.created_at, l.id
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.d10_expr_resolver_state_v1(p_norm text, p_own_article_id bigint,
  p_parent_article_ids bigint[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_expr uuid;
  v_parent jsonb;
  v_art bigint;
BEGIN
  SELECT x.id INTO v_expr FROM public.expression_catalog x
  WHERE x.normalized_key = lower(btrim(p_norm)) ORDER BY (x.lexeme_id IS NULL), x.id LIMIT 1;
  IF v_expr IS NULL AND p_own_article_id IS NOT NULL THEN
    SELECT c.promoted_expression_id INTO v_expr FROM public.ordbokene_expression_candidates c
    WHERE c.candidate_article_id = p_own_article_id AND upper(c.candidate_dictionary_code) = 'BM'
      AND c.promoted_expression_id IS NOT NULL
    ORDER BY c.created_at LIMIT 1;
  END IF;
  FOREACH v_art IN ARRAY coalesce(p_parent_article_ids, '{}'::bigint[]) LOOP
    v_parent := public.d10_expr_resolver_head_card_v1(v_art);
    IF v_parent IS NOT NULL THEN
      v_parent := v_parent || jsonb_build_object('article_id', v_art);
      EXIT;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expression_id', v_expr, 'parent', v_parent);
END
$fn$;

-- a resolution that already gave up on this error sent its candidates to the
-- problem words ('resolver_network'): they wait for the resolver again
UPDATE public.synonym_candidate_queue c
SET dispatch_status = 'awaiting_parent', stage1_status = 'awaiting_target_resolution',
    verification_evidence = c.verification_evidence - 'stage_a', updated_at = now()
FROM public.synonym_expression_resolution_v1 r
WHERE r.status = 'failed' AND r.last_error LIKE '%d10_lexeme_for_article_v1%'
  AND c.dispatch_status = 'not_dispatchable' AND c.origin_depth = 0 AND c.target_kind = 'expression'
  AND lower(btrim(c.target_text)) = r.norm_text
  AND c.verification_evidence->'stage_a'->>'reason' = 'resolver_network';

UPDATE public.synonym_expression_resolution_v1
SET status = 'queued', attempts = 0, next_attempt_at = NULL, last_error = NULL,
    lease_token = NULL, lease_until = NULL, updated_at = now()
WHERE status IN ('retry_wait', 'failed', 'processing') AND last_error LIKE '%d10_lexeme_for_article_v1%';

REVOKE ALL ON FUNCTION public.d10_expr_resolver_head_card_v1(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_expr_resolver_head_card_v1(bigint) TO service_role;

COMMIT;

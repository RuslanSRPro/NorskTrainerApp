-- D10 25.10.2026 (agreed, point 4): "for review" instead of a job error.
--   1. public.d10_ai_review_marked_v1(ids): which lexemes carry the "for
--      review" mark of 15.10.2026 (read by job-completion-auditor).
--   2. get_completion_evidence_snapshot_v2: each unresolved item also carries
--      its admission reason/status, promotion status, lemma and POS, so the
--      completion contract can tell a word "for review" (reason in
--      _shared/d10-review-decisions.ts) from a real blocker. One text
--      insertion after the v1 call; nothing else in the function changes.
--      Snapshot token, entities, counts and execution state are unchanged.
-- Repeatable: an already patched function is left alone.

CREATE OR REPLACE FUNCTION public.d10_ai_review_marked_v1(p_lexeme_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT rr.lexeme_id FROM private.d10_ai_review_rejections_v1 rr
  WHERE rr.lexeme_id = ANY(coalesce(p_lexeme_ids, '{}'::uuid[]));
$body$;
REVOKE ALL ON FUNCTION public.d10_ai_review_marked_v1(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_ai_review_marked_v1(uuid[]) TO service_role;

DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.get_completion_evidence_snapshot_v2(uuid,text,integer,text)'::regprocedure);
  v_anchor text := $a$snapshot := public\.get_completion_evidence_snapshot_v1\(\s*p_job_id,\s*p_cursor,\s*p_limit,\s*p_expected_snapshot_token\);$a$;
  v_count integer;
BEGIN
  IF position('D10 25.10.2026 (point 4)' IN v_def) > 0 THEN
    RAISE NOTICE 'snapshot v2 already carries the admission fields';
    RETURN;
  END IF;
  SELECT count(*) INTO v_count FROM regexp_matches(v_def, v_anchor, 'g');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anchor found % times in get_completion_evidence_snapshot_v2 (expected 1); nothing changed', v_count;
  END IF;
  v_def := regexp_replace(v_def, '(' || v_anchor || ')', $r$\1
  -- D10 25.10.2026 (point 4): admission fields of each unresolved item
  snapshot := jsonb_set(snapshot, '{unresolved_items}', coalesce((
    SELECT jsonb_agg(u.item || coalesce((
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'admission_reason', i.result_summary->>'admission_reason',
        'admission_status', i.result_summary->>'admission_status',
        'promotion_status', i.result_summary->>'promotion_status',
        'normalized_lemma', i.normalized_lemma,
        'pos', i.pos))
      FROM public.lexeme_processing_items i
      WHERE i.job_id = p_job_id AND i.id::text = u.item->>'item_id'), '{}'::jsonb) ORDER BY u.ord)
    FROM jsonb_array_elements(coalesce(snapshot->'unresolved_items', '[]'::jsonb)) WITH ORDINALITY AS u(item, ord)
  ), '[]'::jsonb));$r$);
  EXECUTE v_def;
  RAISE NOTICE 'snapshot v2 patched: unresolved items carry the admission fields';
END
$patch$;

-- 3. Reading mode "problem words" (agreed 25.10.2026, point 4 "B"): learning
--    cards without a translation (the same canonical translations the app
--    shows) or without a Norwegian example (the same rule as
--    get_canonical_lexeme_examples_v1). Read only. legacy = an old record with
--    an unknown part of speech (it goes to the database audit, not re-run).
CREATE OR REPLACE FUNCTION public.d10_problem_cards_v1(p_limit integer DEFAULT 300)
RETURNS TABLE(lexeme_id uuid, lemma text, pos text, display_form text, homograph_key text,
  missing_translation boolean, missing_example boolean, review_reason text, legacy boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  WITH learning AS (
    SELECT l.id FROM public.lexemes l WHERE l.is_learning_lexeme
  ), translated AS (
    SELECT DISTINCT t.lexeme_id
    FROM public.get_canonical_lexeme_translations_v1((SELECT coalesce(array_agg(id), '{}'::uuid[]) FROM learning)) t
    WHERE nullif(btrim(t.translation), '') IS NOT NULL
  ), cards AS (
    SELECT l.id, l.lemma, l.pos, l.display_form, coalesce(l.homograph_key, '') AS homograph_key, l.created_at,
      NOT EXISTS (SELECT 1 FROM translated tr WHERE tr.lexeme_id = l.id) AS missing_translation,
      NOT EXISTS (
        SELECT 1 FROM public.entity_examples e
        WHERE ((e.lexeme_id = l.id AND e.expression_id IS NULL)
          OR (e.expression_id IS NOT NULL AND e.lexeme_id IS NULL AND EXISTS (
            SELECT 1 FROM public.expression_catalog x WHERE x.id = e.expression_id AND x.lexeme_id = l.id)))
          AND e.language_code = 'nb'
          AND e.example_text ~ '[[:alpha:]]'
          AND e.example_text !~* '^[[:space:]]*(https?://|<)') AS missing_example
    FROM public.lexemes l
    WHERE l.is_learning_lexeme
  )
  SELECT c.id, c.lemma, c.pos, c.display_form, c.homograph_key, c.missing_translation, c.missing_example,
    rr.reason, coalesce(c.pos, 'unknown') = 'unknown'
  FROM cards c
  LEFT JOIN private.d10_ai_review_rejections_v1 rr ON rr.lexeme_id = c.id
  WHERE c.missing_translation OR c.missing_example
  ORDER BY c.missing_translation DESC, (coalesce(c.pos, 'unknown') = 'unknown'), c.created_at DESC, c.id
  LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000);
$body$;
REVOKE ALL ON FUNCTION public.d10_problem_cards_v1(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_problem_cards_v1(integer) TO authenticated, service_role;

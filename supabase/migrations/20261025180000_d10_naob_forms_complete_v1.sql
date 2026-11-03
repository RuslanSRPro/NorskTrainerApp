-- D10 25.10.2026 (agreed, variant A): a card without an Ordbøkene article but
-- with NAOB forms (noun divided by NAOB, brenne I/II) is "ready with a mark"
-- like an AI translation with "≈": it does not block the job.
-- Here: every lexeme entity of the completion snapshot gets
-- identity.naob_forms = true when the card has published NAOB forms
-- (public.lexeme_naob_forms_v1). The completion contract runtime accepts such
-- a card when its only gaps are the missing Ordbøkene identity/forms (and an
-- AI-only translation). One text replacement in
-- get_completion_evidence_snapshot_v2; nothing else changes. Repeatable.

DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.get_completion_evidence_snapshot_v2(uuid,text,integer,text)'::regprocedure);
  v_old text := $o$jsonb_set(entity,'{relations}',$o$;
  v_new text := $n$jsonb_set(jsonb_set(entity,'{identity,naob_forms}',to_jsonb(EXISTS (
        SELECT 1 FROM public.lexeme_naob_forms_v1 nf WHERE nf.lexeme_id::text = entity->>'entity_id'))),'{relations}',$n$;
  v_count integer;
BEGIN
  IF position('{identity,naob_forms}' IN v_def) > 0 THEN
    RAISE NOTICE 'snapshot v2 already carries naob_forms';
    RETURN;
  END IF;
  IF position('D10 25.10.2026 (point 4)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'snapshot v2 is not the 20261025140000 version; nothing changed';
  END IF;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anchor found % times in get_completion_evidence_snapshot_v2 (expected 1); nothing changed', v_count;
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'snapshot v2 patched: lexeme entities carry identity.naob_forms';
END
$patch$;

-- Reading mode "problem words": the real number for the button (the list
-- itself stays limited). Same rule as d10_problem_cards_v1. Read only.
CREATE OR REPLACE FUNCTION public.d10_problem_cards_count_v1()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT count(*)::integer FROM public.d10_problem_cards_v1(1000);
$body$;
REVOKE ALL ON FUNCTION public.d10_problem_cards_count_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_problem_cards_count_v1() TO authenticated, service_role;

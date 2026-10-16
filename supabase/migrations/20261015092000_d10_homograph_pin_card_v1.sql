-- D10 stage D2 fix (14.10.2026, live test "bok"): the item added to a job for
-- a second card is promoted to THAT card.
--
-- Live test: Ordbøkene answered HTTP 502 for both "bok" items, so the item of
-- bok II had no article evidence; promotion then fell back to the main card
-- (rule "main card first") and bok II got no forms and no translations.
-- The card of an added item is already known: it is recorded when the item is
-- added (private.d10_job_homograph_injections_v1). Promotion now takes that
-- card first, before the article rule.
--
-- Unchanged: items from the text (not added for a card) - for them the new
-- rank is equal for every card, so the order stays: article, main card, id.
-- Patch in place on the live definition; the anchor must match exactly once,
-- otherwise nothing changes. Re-running is a no-op.

-- 0 = the item was added for this card, 1 = the item was not added for a
-- card (text item), 2 = the item was added for another card.
CREATE OR REPLACE FUNCTION public.d10_injected_card_rank_v1(p_item_id uuid, p_lexeme_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM private.d10_job_homograph_injections_v1 h
                 WHERE h.item_id = p_item_id AND h.card_lexeme_id = p_lexeme_id) THEN 0
    WHEN EXISTS (SELECT 1 FROM private.d10_job_homograph_injections_v1 h
                 WHERE h.item_id = p_item_id) THEN 2
    ELSE 1 END;
$body$;
REVOKE ALL ON FUNCTION public.d10_injected_card_rank_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_injected_card_rank_v1(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION pg_temp.d10_patch_v1(p_def text, p_pattern text, p_replacement text, p_label text)
RETURNS text LANGUAGE plpgsql AS $body$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM regexp_matches(p_def, p_pattern, 'g');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'D10_PIN_PREFLIGHT: anchor "%" found % times; nothing changed', p_label, v_count;
  END IF;
  RETURN regexp_replace(p_def, p_pattern, p_replacement);
END
$body$;

DO $patch$
DECLARE
  v text;
BEGIN
  v := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
  IF position('d10_injected_card_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$order by ato\.item_id,\s+public\.d10_card_article_rank_v1\(aml\.id, ato\.verification_evidence\),$p$,
      $r$order by ato.item_id,
      -- D10 14.10.2026: an item added for a second card stays with that card
      public.d10_injected_card_rank_v1(ato.item_id, aml.id),
      public.d10_card_article_rank_v1(aml.id, ato.verification_evidence),$r$,
      'promotion card order');
    EXECUTE v;
  END IF;
  RAISE NOTICE 'D10: item of a second card is promoted to its card';
END
$patch$;

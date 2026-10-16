-- 101b_d10_homograph_pin_rollback.sql
-- Rollback of 20261015092000: removes the injected-card rank from promotion.
-- Run only if the change has to be undone. Re-running is a no-op.
DO $rb$
DECLARE v text; n integer;
BEGIN
  v := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
  IF position('d10_injected_card_rank_v1' IN v) = 0 THEN
    RAISE NOTICE 'nothing to roll back'; RETURN;
  END IF;
  SELECT count(*) INTO n FROM regexp_matches(v,
    '\s+-- D10 14\.10\.2026: an item added for a second card stays with that card\s+public\.d10_injected_card_rank_v1\(ato\.item_id, aml\.id\),', 'g');
  IF n <> 1 THEN RAISE EXCEPTION 'ROLLBACK: anchor found % times; nothing changed', n; END IF;
  v := regexp_replace(v,
    '\s+-- D10 14\.10\.2026: an item added for a second card stays with that card\s+public\.d10_injected_card_rank_v1\(ato\.item_id, aml\.id\),', '');
  EXECUTE v;
  RAISE NOTICE 'rolled back';
END
$rb$;

-- 118_d10_family_rebind_backfill.sql
-- WRITES. One-time: binds expressions without a family card whose parent
-- article now has exactly one card (same binding function as the pipeline).
-- Expected after migration 20261015170000: bound ~49 (T2 of the check),
-- no_card_yet ~28 (T4), failed 0. Safe to repeat (second run binds 0).
SELECT public.d10_rebind_expression_roots_v1(NULL) AS result;

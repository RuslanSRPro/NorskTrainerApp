BEGIN;
INSERT INTO private.d10_ai_review_rejections_v1(lexeme_id,reason,detail,recorded_at)
SELECT id,'AI_POS_SENSE_REVIEW_REJECTED','{"test":"active review with complete translation"}',now()
FROM public.lexemes WHERE lemma='søppel' AND pos='noun'
ON CONFLICT(lexeme_id) DO UPDATE SET reason=EXCLUDED.reason,detail=EXCLUDED.detail,recorded_at=now();
CREATE TEMP TABLE reviewed_result ON COMMIT DROP AS SELECT * FROM private.d10_problem_cards_all_v4();
DO $test$
BEGIN
 ASSERT EXISTS(SELECT 1 FROM reviewed_result WHERE lemma='søppel' AND NOT missing_translation
  AND review_reason='AI_POS_SENSE_REVIEW_REJECTED'),'review mark lost because a translation exists';
 ASSERT (SELECT count(*)=count(DISTINCT lexeme_id) FROM reviewed_result),'review marks duplicated cards';
END $test$;
SELECT 'PASS: active review survives complete translations; unique IDs' tests;
ROLLBACK;

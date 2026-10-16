-- 111_d10_ai_review_mark_check.sql
-- Read only. After migration 20261015150000: T1, T2 PASS. T3 lists words
-- currently marked "for review" (AI translation rejected twice).
SELECT 'T1 mark functions exist' AS test,
       CASE WHEN to_regprocedure('public.d10_record_ai_review_rejection_v1(uuid,text,jsonb,uuid)') IS NOT NULL
             AND to_regprocedure('public.d10_clear_ai_review_rejection_v1(uuid)') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'T2 snapshot exposes the mark (once)',
       CASE WHEN (SELECT count(*) FROM regexp_matches(
              pg_get_functiondef('public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure),
              'ai_review_rejected', 'g')) = 1 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'T3 marked: ' || l.lemma || ' (' || l.pos || ')', r.reason || ' ' || to_char(r.recorded_at, 'MM-DD HH24:MI')
FROM private.d10_ai_review_rejections_v1 r JOIN public.lexemes l ON l.id = r.lexeme_id;

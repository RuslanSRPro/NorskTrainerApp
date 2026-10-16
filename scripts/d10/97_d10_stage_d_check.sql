-- 97_d10_stage_d_check.sql
-- Read only. Run after the migrations of package D10_stage_d_v1.
--   T1 helper functions exist                                   PASS
--   T2 candidate order / first-match lookups prefer main card   PASS
--   T3 promotion picks the card by article                      PASS
--   T4 second-card functions and tables exist                    PASS
--   T5 second cards enabled (old index (lemma, pos) dropped)     PASS after the LAST migration
SELECT 'T1 helpers' AS check,
       CASE WHEN to_regprocedure('public.d10_homograph_rank_v1(uuid)') IS NOT NULL
             AND to_regprocedure('public.d10_lexeme_article_ids_v1(uuid)') IS NOT NULL
             AND to_regprocedure('public.d10_card_article_rank_v1(uuid,jsonb)') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END AS result, NULL::text AS detail
UNION ALL
SELECT 'T2 main card first',
       CASE WHEN count(*) FILTER (WHERE position('d10_homograph_rank_v1' IN pg_get_functiondef(p.oid)) > 0) = 6
            THEN 'PASS' ELSE 'FAIL' END,
       string_agg(p.proname || CASE WHEN position('d10_homograph_rank_v1' IN pg_get_functiondef(p.oid)) > 0 THEN ' ok' ELSE ' MISSING' END, ', ')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.oid IN ('public.resolve_surface_form_v2(text,text,text,boolean)'::regprocedure,
                'public.merge_surface_candidates(text)'::regprocedure,
                'public.find_local_lexeme_candidate(text)'::regprocedure,
                'public.resolve_lexeme_for_surface_v1(text,text,text)'::regprocedure,
                'public.resolve_adjective_lexeme_for_surface_v1(text,text)'::regprocedure,
                'public.d10_homograph_rank_v1(uuid)'::regprocedure)
UNION ALL
SELECT 'T3 promotion by article',
       CASE WHEN position('d10_card_article_rank_v1' IN pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) > 0
             AND position('family_unverified_items' IN pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) > 0
            THEN 'PASS' ELSE 'FAIL' END, NULL
UNION ALL
SELECT 'T4 second-card objects',
       CASE WHEN to_regprocedure('public.d10_homograph_candidates_for_job_v1(uuid,integer)') IS NOT NULL
             AND to_regprocedure('public.d10_record_homograph_decision_v1(uuid,bigint,text,integer,uuid,jsonb)') IS NOT NULL
             AND to_regprocedure('public.d10_inject_homograph_item_v1(uuid,uuid,uuid)') IS NOT NULL
             AND to_regprocedure('public.d10_existing_homograph_cards_for_job_v1(uuid)') IS NOT NULL
             AND to_regclass('private.d10_homograph_article_decisions_v1') IS NOT NULL
             AND to_regclass('private.d10_job_homograph_injections_v1') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END, NULL
UNION ALL
SELECT 'T5 second cards enabled',
       CASE WHEN to_regclass('public.lexemes_lemma_pos_unique') IS NULL
             AND to_regclass('public.lexemes_lemma_pos_homograph_unique') IS NOT NULL
            THEN 'PASS' ELSE 'NOT YET' END,
       (SELECT count(*)::text || ' second cards' FROM public.lexemes WHERE homograph_key <> '')
ORDER BY 1;

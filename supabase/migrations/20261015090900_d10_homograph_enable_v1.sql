-- D10 stage D2, LAST step of the package (run after deploying the functions
-- and installing the app of this package): allow second cards.
-- Drops the old unique index (lemma, pos). The index (lemma, pos,
-- homograph_key) from D1-1 keeps every card unique.
DO $pre$
BEGIN
  IF to_regclass('public.lexemes_lemma_pos_homograph_unique') IS NULL THEN
    RAISE EXCEPTION 'D10_ENABLE_PREFLIGHT: index lexemes_lemma_pos_homograph_unique missing (install D1-1 first)';
  END IF;
  IF position('ON CONFLICT (lemma, pos, homograph_key)' IN
       pg_get_functiondef('public.sync_expression_to_lexemes(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'D10_ENABLE_PREFLIGHT: sync_expression_to_lexemes still uses ON CONFLICT (lemma, pos)';
  END IF;
  IF to_regprocedure('public.d10_record_homograph_decision_v1(uuid,bigint,text,integer,uuid,jsonb)') IS NULL
     OR position('d10_card_article_rank_v1' IN
       pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'D10_ENABLE_PREFLIGHT: card choice / homograph migrations of this package are not applied';
  END IF;
END
$pre$;

DROP INDEX IF EXISTS public.lexemes_lemma_pos_unique;

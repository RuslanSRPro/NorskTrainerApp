BEGIN;
DO $test$
DECLARE card uuid;expr uuid;v jsonb;before_tr jsonb;after_tr jsonb;expected timestamptz;
BEGIN
 SELECT id INTO STRICT card FROM public.lexemes WHERE lemma='ta' AND pos='verb' LIMIT 1;
 SELECT jsonb_agg(t ORDER BY language_code) INTO before_tr FROM public.get_canonical_lexeme_translations_v1(ARRAY[card]) t;
 v:=public.get_card_help_context_v1(card);
 SELECT max(j.created_at) INTO expected FROM public.lexeme_processing_jobs j
 WHERE EXISTS(SELECT 1 FROM public.lexeme_processing_items i WHERE i.job_id=j.id AND
  (i.lexeme_id=card OR EXISTS(SELECT 1 FROM public.expression_catalog x WHERE x.id=i.expression_id AND x.lexeme_id=card)));
 ASSERT (v->'analysis'->>'started_at')::timestamptz=expected,'not the last analysis launch';
 ASSERT jsonb_typeof(v->'alternatives')='array','alternative translations not an array';
 SELECT jsonb_agg(t ORDER BY language_code) INTO after_tr FROM public.get_canonical_lexeme_translations_v1(ARRAY[card]) t;
 ASSERT before_tr=after_tr,'help changed master translations';
 ASSERT public.get_card_help_context_v1(gen_random_uuid()) IS NULL,'unknown entity invented metadata';
 SELECT id INTO expr FROM public.expression_catalog WHERE lexeme_id IS NOT NULL LIMIT 1;
 IF expr IS NOT NULL THEN
  ASSERT public.get_card_help_context_v1(expr)=public.get_card_help_context_v1(
   (SELECT lexeme_id FROM public.expression_catalog WHERE id=expr)), 'expression/card identity mismatch';
 END IF;
END $test$;
SELECT 'PASS: last analysis launch, alternatives, unchanged masters and expression identity' tests;
ROLLBACK;

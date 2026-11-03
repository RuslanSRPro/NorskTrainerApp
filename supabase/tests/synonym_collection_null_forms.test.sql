BEGIN;
DO $test$
DECLARE terms text[]; payload jsonb; defs text[]; v jsonb;
BEGIN
 SELECT array_agg(term ORDER BY ord) INTO terms FROM public.d10_synonym_bm_terms_v1('prate, samtale','snakke',ARRAY['snakke',NULL,'snakker']);
 ASSERT terms=ARRAY['prate','samtale'],'NULL forms must not suppress synonyms';
 SELECT array_agg(term ORDER BY ord) INTO terms FROM public.d10_synonym_bm_terms_v1('snakker, prate','snakke',ARRAY['snakker',NULL]);
 ASSERT terms=ARRAY['prate'],'real inflections must still be excluded';
 payload:='{"body":{"definitions":[{"type_":"definition","elements":[{"type_":"explanation","content":"$ $","items":[{"type_":"entity","id":"jf"},{"type_":"article_ref","lemmas":[{"lemma":"snakkes"}]}]}]}]}}';
 defs:=public.d10_ordbokene_explanations_v1(payload);
 ASSERT defs=ARRAY['jf. snakkes'],'reference marker lost';
 ASSERT NOT EXISTS(SELECT 1 FROM public.d10_synonym_bm_terms_v1(defs[1],'snakke','{}')),'reference is not a direct synonym';
 ASSERT (SELECT txt FROM public.d10_ordbokene_explanation_paths_v1(payload) LIMIT 1)='jf. snakkes','path extractor lost reference';
 SELECT k.payload INTO payload FROM public.ordbokene_article_cache k WHERE k.article_id=55031 AND lower(k.dictionary_code)='bm';
 -- Actual cached snakke fixture: source is read, nothing downloaded.
 ASSERT EXISTS(SELECT 1 FROM public.d10_ordbokene_explanation_paths_v1(payload) d
  CROSS JOIN LATERAL public.d10_synonym_bm_terms_v1(d.txt,'snakke',ARRAY['snakke',NULL]) t WHERE t.term='prate'),'snakke regression';
END $test$;
SELECT 'PASS: NULL inflections, excluded real forms, reference-only markers, snakke fixture' tests;
ROLLBACK;

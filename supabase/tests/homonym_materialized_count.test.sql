BEGIN;
DO $test$
DECLARE card uuid;k text;n integer;
BEGIN
 SELECT lower(btrim(lemma)),count(*) INTO k,n FROM public.lexemes
 WHERE pos<>'expression' AND dictionary_status<>'excluded'
 GROUP BY 1 HAVING count(*)>1 ORDER BY count(*) LIMIT 1;
 ASSERT k IS NOT NULL,'requires an existing homonym family';
 SELECT id INTO card FROM public.lexemes WHERE lower(btrim(lemma))=k
 AND pos<>'expression' AND dictionary_status<>'excluded' ORDER BY id LIMIT 1;
 ASSERT NOT EXISTS(SELECT 1 FROM public.lexemes WHERE lower(btrim(lemma))=k
  AND pos<>'expression' AND dictionary_status<>'excluded' AND homonym_card_count<>n),'initial count mismatch';
 ASSERT NOT EXISTS(SELECT 1 FROM public.lexemes l WHERE lower(btrim(l.lemma))=k
  AND l.pos<>'expression' AND l.dictionary_status<>'excluded'
  AND (cardinality(l.homonym_card_ids)<>n-1 OR l.id=ANY(l.homonym_card_ids))), 'explicit links missing or contain self';
 UPDATE public.lexemes SET dictionary_status='excluded' WHERE id=card;
 ASSERT (SELECT homonym_card_count=0 FROM public.lexemes WHERE id=card),'excluded card has icon';
 ASSERT NOT EXISTS(SELECT 1 FROM public.lexemes WHERE lower(btrim(lemma))=k
  AND card=ANY(homonym_card_ids)),'excluded target remains linked';
 ASSERT NOT EXISTS(SELECT 1 FROM public.lexemes WHERE lower(btrim(lemma))=k
 AND pos<>'expression' AND dictionary_status<>'excluded' AND homonym_card_count<>n-1),'old family did not refresh';
 UPDATE public.lexemes SET lemma='homonym-count-test-'||gen_random_uuid(),dictionary_status='active' WHERE id=card;
 ASSERT (SELECT homonym_card_count=1 FROM public.lexemes WHERE id=card),'renamed card count incorrect';
END $test$;
SELECT 'PASS: stored count, exclusion, old family refresh and renamed family' tests;
ROLLBACK;

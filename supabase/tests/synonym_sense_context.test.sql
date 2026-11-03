BEGIN;
DO $test$
DECLARE c jsonb;gloss uuid;p public.synonym_pair_v1%rowtype;clone uuid:=gen_random_uuid();n integer;
BEGIN
 SELECT id INTO STRICT gloss FROM public.synonym_bm_gloss_v1 WHERE article_id=59502 AND gloss_text='stjele' LIMIT 1;
 c:=public.d10_synonym_source_context_v1(gloss);
 ASSERT c->>'sense_path'='3','wrong dictionary section';
 ASSERT EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'examples_nb') e WHERE e LIKE '%lommeboka%'),
  'relevant example lost at capacity boundary';
 ASSERT private.synonym_render_quote_v1('{"content":"tillitsvervene $ mye tid","items":[{"type_":"usage","text":"stjeler"}]}')
  ='tillitsvervene stjeler mye tid','usage substitution not rendered';
 ASSERT private.synonym_endpoint_key_v1('lexeme',gen_random_uuid(),57272,'ta') IS NOT NULL;
 ASSERT (SELECT private.synonym_endpoint_key_v1('lexeme',id,57272,'ta')<>
  private.synonym_endpoint_key_v1('lexeme',id,57272,'ta noe som tilhører en annen')
  FROM public.lexemes WHERE lemma='stjele' AND pos='verb' LIMIT 1),'different dictionary senses conflated';

 SELECT pp.* INTO STRICT p FROM public.synonym_pair_v1 pp
 JOIN private.synonym_sense_links_v1 l ON pp.id=l.representative_pair_id
 WHERE pp.source_entity_type='lexeme' AND pp.target_entity_type='lexeme'
 AND pp.decision='verified_synonym' ORDER BY pp.id LIMIT 1;
 SELECT count(*) INTO n FROM public.get_synonym_carousel_v3(p.source_entity_id);
 INSERT INTO public.synonym_pair_v1
 SELECT (jsonb_populate_record(NULL::public.synonym_pair_v1,to_jsonb(p)||jsonb_build_object(
  'id',clone,'target_article_key','test-evidence-'||clone))).*;
 ASSERT EXISTS(SELECT 1 FROM private.synonym_sense_links_v1
  WHERE clone=ANY(evidence_pair_ids) AND p.id=ANY(evidence_pair_ids)), 'second proof lost its canonical relation';
 ASSERT (SELECT count(*)=n FROM public.get_synonym_carousel_v3(p.source_entity_id)), 'extra proof created an extra displayed relation';
 UPDATE public.synonym_pair_v1 SET status='superseded',published=false WHERE id=clone;
 ASSERT NOT EXISTS(SELECT 1 FROM private.synonym_sense_links_v1 WHERE clone=ANY(evidence_pair_ids)), 'withdrawn proof remained active';
 ASSERT EXISTS(SELECT 1 FROM private.synonym_sense_links_v1 WHERE p.id=ANY(evidence_pair_ids)), 'withdrawing a proof removed another valid proof';
END $test$;
SELECT 'PASS: sense scope, substituted quotes, different meanings, multiple proofs and withdrawal' tests;
ROLLBACK;

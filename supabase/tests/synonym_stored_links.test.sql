BEGIN;
DO $test$
DECLARE p public.synonym_pair_v1%rowtype; old_status text; def text;
BEGIN
 def:=pg_get_functiondef('public.get_synonym_carousel_v3(uuid)'::regprocedure);
 ASSERT position('synonym_stored_pair_sides_v1' in def)>0;
 ASSERT position('d10_synonym_pair_sides_v1()' in def)=0;
 ASSERT position('d10_synonym_sense_path_v1(' in def)=0;
 SELECT pp.* INTO STRICT p FROM public.synonym_pair_v1 pp
 JOIN private.synonym_sense_links_v1 l ON pp.id=l.representative_pair_id
 WHERE pp.source_entity_type='lexeme' AND pp.target_entity_type='lexeme' AND pp.decision='verified_synonym' LIMIT 1;
 SELECT dictionary_status INTO old_status FROM public.lexemes WHERE id=p.target_entity_id;
 UPDATE public.lexemes SET dictionary_status='excluded' WHERE id=p.target_entity_id;
 ASSERT NOT EXISTS(SELECT 1 FROM private.synonym_sense_link_state_v1 WHERE family_key=private.synonym_family_key_v1(p.source_entity_type,p.source_entity_id,p.target_entity_type,p.target_entity_id)), 'excluded endpoint retained stored link';
 ASSERT NOT EXISTS(SELECT 1 FROM public.synonym_pair_v1 WHERE published AND ((source_entity_id=p.source_entity_id AND target_entity_id=p.target_entity_id) OR (target_entity_id=p.source_entity_id AND source_entity_id=p.target_entity_id))), 'excluded endpoint retained publication';
 UPDATE public.lexemes SET dictionary_status=old_status WHERE id=p.target_entity_id;
 ASSERT EXISTS(SELECT 1 FROM private.synonym_sense_links_v1 WHERE p.id=ANY(evidence_pair_ids)), 'restored endpoint lost valid proof';
END $test$;
SELECT 'PASS: stored reader, exclusion and restoration' tests;
ROLLBACK;

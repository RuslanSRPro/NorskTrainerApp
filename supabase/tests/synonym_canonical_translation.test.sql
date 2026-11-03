BEGIN;
DO $t$
DECLARE p public.synonym_pair_v1%rowtype;
BEGIN
 ASSERT public.d10_synonym_sense_lease_v1(1)->'rows'='[]'::jsonb;
 ASSERT public.d10_synonym_rule_verify_v1(1)->>'verified_by_rule'='0';
 SELECT * INTO STRICT p FROM public.synonym_pair_v1 q WHERE q.status='done'
 AND q.decision='verified_synonym' AND q.verifier_version NOT LIKE 'ai:synonym_pair_v9:%' AND q.source_entity_type='lexeme' AND q.target_entity_type='lexeme'
 AND private.synonym_card_ready_v1(q.source_entity_type,q.source_entity_id)
 AND private.synonym_card_ready_v1(q.target_entity_type,q.target_entity_id) LIMIT 1;
 ASSERT NOT private.synonym_publishable_v1(p),'legacy decision must not publish';
 UPDATE public.synonym_pair_v1 SET status='done',decision='verified_synonym',
 verification_evidence=verification_evidence||'{"publication_ready":true,"source_translation_matches":true,"target_translation_matches":true,"additional_restriction":false,"substitution_forward":true,"substitution_reverse":true,"same_construction":true}'::jsonb
 WHERE id=p.id;
 ASSERT (SELECT published FROM public.synonym_pair_v1 WHERE id=p.id),'ready canonical pair did not publish';
 UPDATE public.lexemes SET translation_ua=coalesce(translation_ua,'')||' test' WHERE id=p.target_entity_id;
 ASSERT NOT (SELECT published FROM public.synonym_pair_v1 WHERE id=p.id),'changed card retained old publication';
 ASSERT EXISTS(SELECT 1 FROM private.synonym_refresh_queue_v1 WHERE candidate_id=p.candidate_id AND status='pending'),'no incident refresh';
END $t$;
SELECT 'PASS: labels disabled, references do not autoapprove, canonical publication, card invalidation' tests;
ROLLBACK;

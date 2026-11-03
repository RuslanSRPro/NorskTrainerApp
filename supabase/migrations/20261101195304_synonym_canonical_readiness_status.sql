BEGIN;
DO $p$
DECLARE d text;anchor text;
BEGIN
 d:=pg_get_functiondef('public.d10_synonym_copy_decisions_v1(text)'::regprocedure);
 d:=replace(d,'d.verifier_version = ''rule:mutual_reference_v3'' OR ','');
 d:=replace(d,'AND jsonb_typeof(d.verification_evidence->''same_construction'') = ''boolean''',
 'AND jsonb_typeof(d.verification_evidence->''same_construction'') = ''boolean''
 AND jsonb_typeof(d.verification_evidence->''publication_ready'') = ''boolean''
 AND jsonb_typeof(d.verification_evidence->''additional_restriction'') = ''boolean''');
 EXECUTE d;
 d:=pg_get_functiondef('public.d10_synonym_lease_pairs_v1(integer)'::regprocedure);
 anchor:='  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'lease anchor changed'; END IF;
 d:=replace(d,anchor,$a$
 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='standard_enrichment_not_ready',
 lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE p.status IN ('queued','retry_wait') AND
 (NOT private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 OR NOT private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id));
$a$||anchor);
 EXECUTE d;
 d:=pg_get_functiondef('public.d10_synonym_entity_status_v1(text,uuid)'::regprocedure);
 d:=replace(d,'p.decision=''needs_manual_review''',
 'p.decision=''needs_manual_review'' OR (p.status=''done'' AND p.decision=''verified_synonym''
 AND p.verification_evidence->>''publication_ready'' IS DISTINCT FROM ''true'')');
 d:=replace(d,'p.status=''done'' AND p.decision=''verified_synonym''))',
 'p.status=''done'' AND p.decision=''verified_synonym'' AND p.published))');
 EXECUTE d;
END $p$;
COMMIT;

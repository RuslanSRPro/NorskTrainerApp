-- Read-only diagnostic. Change the lemma in params; words and expressions are both supported.
WITH params AS (SELECT 'snakke'::text AS lemma),
entities AS (
 SELECT 'lexeme'::text entity_type,l.id,l.lemma FROM public.lexemes l,params p WHERE lower(l.lemma)=lower(p.lemma)
 UNION ALL
 SELECT 'expression',x.id,x.lemma FROM public.expression_catalog x,params p WHERE lower(x.lemma)=lower(p.lemma)
)
SELECT e.entity_type,e.id,e.lemma,
 public.d10_synonym_entity_status_v1(e.entity_type,e.id) AS lifecycle,
 (SELECT jsonb_agg(jsonb_build_object('candidate_id',c.id,'target',c.target_text,'active',c.source_active,
   'dispatch',c.dispatch_status,'stage',c.stage1_status,'child_job',c.child_job_id,
   'pairs',(SELECT jsonb_agg(jsonb_build_object('pair_id',p.id,'status',p.status,'decision',p.decision,
     'rule',p.rule_reason,'verified_at',p.verified_at,
     'checked_at',coalesce(p.verified_at,(SELECT max(h.recorded_at) FROM private.synonym_pair_events_v1 h
       WHERE h.pair_id=p.id AND h.after_row->>'status' IN ('done','rejected_rule','needs_manual_review','failed'))),
     'snapshot_hash',p.snapshot_hash,
     'verifier',p.verifier_version,'evidence',p.verification_evidence))
    FROM public.synonym_pair_v1 p WHERE p.candidate_id=c.id)))
  FROM public.synonym_candidate_queue c WHERE c.source_entity_type=e.entity_type AND c.source_entity_id=e.id) candidates,
 (SELECT jsonb_agg(h ORDER BY h.checked_at DESC) FROM (
   SELECT status,reason,checked_at,evidence FROM private.synonym_collection_events_v1 h
   WHERE h.entity_type=e.entity_type AND h.entity_id=e.id ORDER BY checked_at DESC LIMIT 20)h) collection_history
FROM entities e;

-- Independent read-only summaries (run separately if the editor displays only the last result):
-- SELECT public.d10_synonym_coverage_v1();
-- SELECT public.d10_synonym_review_metrics_v1();

-- Optional, ADMIN ONLY, causes scoped processing; replace CARD_UUID from the query above.
-- This bypasses the decision cache for existing relations of one entity.
-- It does not collect new source words or enable the mass collector.
-- SELECT public.d10_synonym_recheck_entity_v1('lexeme','CARD_UUID'::uuid,true);
-- For a phrase use entity_type='expression' and the expression ID.
-- The cron processes this queue on its next tick (every 5 minutes).
-- A full text audit is needed to refresh source material / discover new candidates.

-- Human review must refer to an exact input version. Never automatically fill it from the AI answer:
-- INSERT INTO private.synonym_human_reviews_v1(pair_id,snapshot_hash,expected_decision,reviewer,note)
-- SELECT id,snapshot_hash,'rejected','reviewer name','Independent reason'
-- FROM public.synonym_pair_v1 WHERE id='PAIR_UUID'::uuid;


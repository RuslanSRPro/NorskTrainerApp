BEGIN;
DO $test$
DECLARE p public.synonym_pair_v1%rowtype; budget integer; v jsonb; n integer;
BEGIN
 SELECT * INTO STRICT p FROM public.synonym_pair_v1 WHERE status='done' AND decision='verified_synonym' LIMIT 1;
 SELECT count(*)::integer + (SELECT coalesce(sum(pairs),0)::integer FROM public.synonym_verifier_calls_v1
   WHERE created_at>now()-interval '24 hours' AND created_at<(SELECT started_at FROM private.synonym_ai_budget_epoch_v1))
 INTO budget FROM private.synonym_ai_budget_v1 WHERE reserved_at>now()-interval '24 hours';
 UPDATE public.synonym_verifier_config_v1 SET daily_ai_pair_limit=greatest(budget+1,1) WHERE singleton;
 UPDATE public.synonym_pair_v1 SET status='queued',decision=NULL,force_recheck=true,attempts=0,created_at='2000-01-01' WHERE id=p.id;
 v:=public.d10_synonym_lease_pairs_v1(1);
 ASSERT jsonb_array_length(v->'pairs')=1,'one remaining unit should be available';
 ASSERT EXISTS(SELECT 1 FROM private.synonym_ai_budget_v1 WHERE pair_id=(v->'pairs'->0->>'id')::uuid
  AND lease_token=(v->'pairs'->0->>'lease_token')::uuid),'lease budget not reserved';
 -- Simulate a crash BEFORE any call log was written.
 UPDATE public.synonym_pair_v1 SET lease_until=now()-interval '1 minute' WHERE id=(v->'pairs'->0->>'id')::uuid;
 v:=public.d10_synonym_lease_pairs_v1(1);
 ASSERT v->>'reason'='daily_limit' AND jsonb_array_length(v->'pairs')=0,'unlogged crashed call bypassed daily budget';
END $test$;
SELECT 'PASS: reservation survives missing AI log and expired lease' tests;
ROLLBACK;

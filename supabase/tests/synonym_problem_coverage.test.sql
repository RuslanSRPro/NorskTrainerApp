-- Integration regression; changes are rolled back. Requires existing analysed cards.
BEGIN;
CREATE TEMP TABLE coverage_result ON COMMIT DROP AS SELECT * FROM private.d10_problem_cards_all_v4();
DO $test$
DECLARE j uuid;c public.synonym_candidate_queue%rowtype;before_jobs bigint;v jsonb;
BEGIN
 ASSERT (SELECT count(*)=count(DISTINCT lexeme_id) FROM coverage_result),'duplicate card IDs';
 ASSERT EXISTS(SELECT 1 FROM coverage_result WHERE lemma='frisk' AND pos='noun' AND missing_translation),
   'untranslated frisk noun is missing';
 ASSERT NOT EXISTS(SELECT 1 FROM coverage_result WHERE lemma='søppel' AND missing_translation),
   'translated søppel incorrectly missing translations';
 SELECT * INTO STRICT c FROM public.synonym_candidate_queue
 WHERE target_text='søppel' AND root_synonym_lemma='avfall' AND source_active LIMIT 1;
 SELECT i.job_id INTO STRICT j FROM public.lexeme_processing_items i
 JOIN public.lexemes l ON l.id=i.lexeme_id
 JOIN public.lexeme_processing_jobs jobs ON jobs.id=i.job_id
 WHERE l.lemma='søppel' AND i.status='done' AND jobs.input_type<>'synonym_candidate'
 ORDER BY jobs.created_at DESC LIMIT 1;
 UPDATE public.synonym_candidate_queue SET dispatch_status='deferred_depth',target_entity_ids='[]',origin_depth=1
 WHERE id=c.id;
 SELECT count(*) INTO before_jobs FROM public.lexeme_processing_jobs;
 v:=public.d10_synonym_prepare_for_job_v1(j);
 ASSERT v->>'ok'='true','dependency refresh failed';
 ASSERT EXISTS(SELECT 1 FROM public.synonym_candidate_queue WHERE id=c.id AND dispatch_status='skipped_ready'),
   'deferred inbound candidate without stored target IDs was not resumed';
 ASSERT EXISTS(SELECT 1 FROM public.synonym_pair_v1 WHERE candidate_id=c.id AND status<>'superseded'),
   'resumed candidate did not produce a pair';
 ASSERT (SELECT count(*)=before_jobs FROM public.lexeme_processing_jobs),'refresh created another generation';
END $test$;
SELECT 'PASS: unique cards, untranslated noun, translated card, deferred inbound discovery, no new jobs' tests;
ROLLBACK;

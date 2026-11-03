BEGIN;
-- A completed child job is not proof that its target passed the admission gate.
CREATE FUNCTION private.synonym_child_admission_guard_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF NEW.dispatch_status='enrichment_done' AND NEW.child_job_id IS NOT NULL
 AND EXISTS (
  SELECT 1 FROM public.lexeme_processing_items i
  WHERE i.job_id=NEW.child_job_id
   AND lower(btrim(i.raw_input))=lower(btrim(NEW.target_text))
   AND i.result_summary->>'promotion_status'='not_promoted')
 AND NOT EXISTS (
  SELECT 1 FROM public.lexeme_processing_items i
  WHERE i.job_id=NEW.child_job_id
   AND lower(btrim(i.raw_input))=lower(btrim(NEW.target_text))
   AND i.status='done'
   AND coalesce(i.result_summary->>'promotion_status','')<>'not_promoted'
   AND coalesce(i.lexeme_id,i.expression_id) IS NOT NULL)
 THEN
  NEW.dispatch_status:='not_dispatchable';
  NEW.stage1_status:='needs_manual_review';
  NEW.enrichment_done_at:=NULL;
  NEW.verification_evidence:=coalesce(NEW.verification_evidence,'{}'::jsonb)
    ||jsonb_build_object('enrichment_blocked',true,'enrichment_block_reason','target_not_admitted');
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION private.synonym_child_admission_guard_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_synonym_child_admission_guard_v1
 BEFORE INSERT OR UPDATE OF dispatch_status ON public.synonym_candidate_queue
 FOR EACH ROW EXECUTE FUNCTION private.synonym_child_admission_guard_v1();
-- Correct only existing false completion claims, retaining cards and evidence.
UPDATE public.synonym_candidate_queue c SET dispatch_status=c.dispatch_status,updated_at=now()
WHERE c.dispatch_status='enrichment_done' AND c.child_job_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.lexeme_processing_items i WHERE i.job_id=c.child_job_id
  AND lower(btrim(i.raw_input))=lower(btrim(c.target_text))
  AND i.result_summary->>'promotion_status'='not_promoted');
COMMIT;

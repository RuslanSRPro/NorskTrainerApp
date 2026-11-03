-- Prevent old AI cache entries from losing the new direction evidence. No mass requeue.
BEGIN;
CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1(p_version text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE v_n integer;
BEGIN
  WITH decided AS (
    SELECT DISTINCT ON (public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key))
      public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key) AS k,
      d.id, d.decision, d.confidence, d.verification_evidence, d.verifier_version
    FROM public.synonym_pair_v1 d
    WHERE d.status = 'done' AND d.decision IS NOT NULL
      AND (d.verifier_version LIKE 'rule:%' OR (d.verifier_version = p_version
        AND jsonb_typeof(d.verification_evidence->'substitution_forward') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'substitution_reverse') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'same_construction') = 'boolean'))
    ORDER BY public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key), d.verified_at DESC
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = x.decision, confidence = x.confidence,
      verification_evidence = (x.verification_evidence - 'copied_from')
        || jsonb_build_object('copied_from', x.id, 'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      verifier_version = x.verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM decided x
  WHERE p.status IN ('queued', 'retry_wait') AND p.id <> x.id
    AND public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) = x.k;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;
COMMIT;

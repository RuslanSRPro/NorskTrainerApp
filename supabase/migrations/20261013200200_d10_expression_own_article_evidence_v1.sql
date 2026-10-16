-- D10 plan C (option b, agreed 13.10.2026): record the own-article
-- confirmation of an expression as dictionary evidence.
--
-- Problem: family expressions confirmed by their OWN exact Bokmål sub-article
-- (lexical-worker Ordbokene check "Own exact Bokmål expression article") leave
-- no row in expression_source_evidence, and their expression_review_status
-- stays 'partial' (compute_expression_review_status knows only expr_entry /
-- uttrykk). The learner completion snapshot (get_completion_evidence_snapshot_v1)
-- therefore reports IDENTITY_NOT_VERIFIED + EXPRESSION_WHOLE_UNIT_EVIDENCE_MISSING
-- for all of them (55 of 62 entities of job 3779546f).
--
-- Change (the snapshot / completion contract itself is NOT changed):
--  1. d10_record_expression_own_article_evidence_v1(check row): when an
--     Ordbokene expression check is done, found, registered_entry and
--     whole_unit_match with lookup_scope = 'candidate_article', write ONE row
--     expression_source_evidence(source 'ordbokene', source_status
--     'own_article') with the article id, parent article and job/item, and set
--     expression_review_status = 'verified' for that expression when its
--     catalog status is ordbokene sub_article ('partial' today).
--  2. trigger on lexeme_source_checks calls it for every such check.
--  3. expression_catalog_recompute_review_status keeps 'verified' for a
--     sub_article expression that has own_article evidence, so a later update
--     of ordbokene_status / naob_status does not drop it back to 'partial'.
--  4. backfill from the already finished checks.
-- A gray family expression (own-article check not matched) gets no row and
-- stays as it is.

CREATE OR REPLACE FUNCTION public.d10_record_expression_own_article_evidence_v1(
  p_check_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_check record;
  v_expression_id uuid;
  v_article text;
  v_lemma text;
  v_evidence jsonb;
BEGIN
  SELECT sc.id, sc.job_id, sc.item_id, sc.evidence, sc.urls
    INTO v_check
  FROM public.lexeme_source_checks sc
  WHERE sc.id = p_check_id
    AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
    AND sc.status = 'done' AND sc.found IS TRUE
    AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
    AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
    AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article';
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT i.expression_id INTO v_expression_id
  FROM public.lexeme_processing_items i WHERE i.id = v_check.item_id;
  v_article := v_check.evidence->'raw_preview'->'article_ids'->>0;
  IF v_expression_id IS NULL OR v_article IS NULL OR v_article !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;
  SELECT e.lemma INTO v_lemma FROM public.expression_catalog e WHERE e.id = v_expression_id;
  IF v_lemma IS NULL THEN RETURN false; END IF;

  v_evidence := jsonb_build_object(
    'kind', 'own_exact_expression_article',
    'dictionary_code', 'bm',
    'article_id', v_article::bigint,
    'parent_article_id', v_check.evidence->'raw_preview'->'parent_article_id',
    'parent_article_ids', v_check.evidence->'raw_preview'->'parent_article_ids',
    'canonical_lemma', v_check.evidence->'raw_preview'->>'canonical_lemma',
    'evidence_label', v_check.evidence->>'evidence_label',
    'job_id', v_check.job_id, 'item_id', v_check.item_id, 'check_id', v_check.id,
    'version', 'd10_expression_own_article_evidence_v1');

  -- One row per expression and article (lexeme_id is NULL, so the unique
  -- constraint cannot detect duplicates: check explicitly).
  UPDATE public.expression_source_evidence s
     SET evidence = v_evidence, updated_at = now()
   WHERE s.expression_id = v_expression_id AND s.lexeme_id IS NULL
     AND s.source = 'ordbokene' AND s.source_status = 'own_article'
     AND s.evidence->>'article_id' = v_article;
  IF NOT FOUND THEN
    INSERT INTO public.expression_source_evidence (
      expression_id, lexeme_id, source, source_status, surface_form,
      expression_text, evidence, urls)
    VALUES (v_expression_id, NULL, 'ordbokene', 'own_article', v_lemma,
      v_lemma, v_evidence,
      ARRAY['https://ord.uib.no/bm/article/' || v_article || '.json']);
  END IF;

  UPDATE public.expression_catalog e
     SET expression_review_status = 'verified', updated_at = now()
   WHERE e.id = v_expression_id
     AND e.ordbokene_status = 'sub_article'
     AND coalesce(e.expression_review_status, '') <> 'verified';
  RETURN true;
END;
$body$;
REVOKE ALL ON FUNCTION public.d10_record_expression_own_article_evidence_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_record_expression_own_article_evidence_v1(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_record_expression_own_article_evidence_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.d10_expression_own_article_evidence_trigger_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
BEGIN
  -- Never break the source-check write of lexical-worker: an error here is
  -- logged and the evidence can be recorded later (backfill block below).
  BEGIN
    PERFORM public.d10_record_expression_own_article_evidence_v1(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'd10_expression_own_article_evidence: check % skipped: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$body$;
REVOKE ALL ON FUNCTION private.d10_expression_own_article_evidence_trigger_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_d10_expression_own_article_evidence_v1 ON public.lexeme_source_checks;
CREATE TRIGGER trg_d10_expression_own_article_evidence_v1
AFTER INSERT OR UPDATE OF status, found, evidence ON public.lexeme_source_checks
FOR EACH ROW
WHEN (NEW.source = 'Ordbokene' AND NEW.query_type = 'expression'
      AND NEW.status = 'done' AND NEW.found IS TRUE AND NEW.whole_unit_match IS TRUE)
EXECUTE FUNCTION private.d10_expression_own_article_evidence_trigger_v1();

-- 3. Keep 'verified' for a sub_article expression with own_article evidence.
--    Everything else is computed exactly as before.
CREATE OR REPLACE FUNCTION public.expression_catalog_recompute_review_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.expression_review_status := public.compute_expression_review_status(
    new.ordbokene_status,
    new.naob_status
  );
  -- D10 13.10.2026: own exact Ordbokene sub-article confirmed for this
  -- expression (expression_source_evidence ordbokene / own_article).
  if new.expression_review_status = 'partial'
     and new.ordbokene_status = 'sub_article'
     and new.id is not null
     and exists (select 1 from public.expression_source_evidence s
                 where s.expression_id = new.id and s.lexeme_id is null
                   and s.source = 'ordbokene' and s.source_status = 'own_article') then
    new.expression_review_status := 'verified';
  end if;
  return new;
end;
$function$;

-- 4. Backfill from finished checks.
DO $backfill$
DECLARE v_check uuid; v_done integer := 0;
BEGIN
  FOR v_check IN
    SELECT sc.id FROM public.lexeme_source_checks sc
    WHERE sc.source = 'Ordbokene' AND sc.query_type = 'expression'
      AND sc.status = 'done' AND sc.found IS TRUE AND sc.whole_unit_match IS TRUE
      AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article'
    ORDER BY sc.updated_at
  LOOP
    IF public.d10_record_expression_own_article_evidence_v1(v_check) THEN
      v_done := v_done + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'D10 own-article evidence backfill: % checks recorded', v_done;
END
$backfill$;

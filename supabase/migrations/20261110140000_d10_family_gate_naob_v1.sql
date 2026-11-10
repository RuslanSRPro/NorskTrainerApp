-- D10_family_gate_naob_v1 (10.11.2026): 77 NAOB expressions of the "ta" family stopped at admission_gate with
-- FAMILY_EXPRESSION_NOT_VERIFIED although NAOB confirmed each of them in the same job (found, whole expression,
-- registered entry). The family gate looked only at expression_catalog.expression_review_status, which a trigger
-- recomputes from ordbokene_status / naob_status and which was not yet 'verified' when the job promoted the items
-- (later it became 'verified' for 74 of them; vite passed because its status was already set).
-- Now a family expression also counts as verified when, in THIS job, its own NAOB check confirmed the whole
-- expression as a registered entry and it is bound to the verb from NAOB - the same conditions the admission of
-- NAOB expressions (d10_admit_own_article_job_expressions_page_v2, branch eligible_naob) already requires.
-- The Ordbøkene path is unchanged. Rollback: optional/rollback_d10_family_gate_naob_v1.sql.

CREATE OR REPLACE FUNCTION public.d10_family_unverified_expression_items_v1(p_job_id uuid)
 RETURNS TABLE(item_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT f.item_id
  FROM private.d10_job_family_injections_v1 f
  JOIN public.lexeme_processing_items i
    ON i.id = f.item_id AND i.job_id = f.job_id AND i.expression_id = f.expression_id
  JOIN public.expression_catalog e ON e.id = f.expression_id
  WHERE f.job_id = p_job_id
    AND f.item_id IS NOT NULL
    AND coalesce(e.expression_review_status, '') <> 'verified'
    -- D10_family_gate_naob_v1: own NAOB confirmation in this job
    AND NOT (
      e.source_naob IS TRUE
      AND EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
                  WHERE b.expression_id = e.id AND b.root_lexeme_id = f.root_lexeme_id AND b.evidence ? 'naob')
      AND EXISTS (SELECT 1 FROM public.lexeme_source_checks sc
                  WHERE sc.item_id = f.item_id AND sc.job_id = p_job_id
                    AND sc.source = 'NAOB' AND sc.query_type = 'expression'
                    AND sc.status = 'done' AND sc.found IS TRUE
                    AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE)
    );
$function$;

SELECT 'D10_family_gate_naob_v1 installed' AS result,
  (SELECT count(*) FROM public.lexeme_processing_items i
   WHERE i.result_summary->>'admission_reason' = 'FAMILY_EXPRESSION_NOT_VERIFIED'
     AND NOT EXISTS (SELECT 1 FROM public.d10_family_unverified_expression_items_v1(i.job_id) u WHERE u.item_id = i.id)
  ) AS stopped_items_that_would_pass_now;

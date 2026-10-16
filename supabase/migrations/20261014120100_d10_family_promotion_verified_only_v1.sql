-- D10 14.10.2026 (owner decision): a Lexeme 360 family member becomes a
-- colored (learning) expression only when the expression itself is verified
-- (expression_catalog.expression_review_status = 'verified': own Ordbøkene
-- article - recorded by the C-3 evidence trigger at check time -, a separate
-- Ordbøkene entry, or a NAOB uttrykk). Otherwise it ends gray, exactly like the
-- other weak family members: done / admission_gate / not_promoted, reason
-- FAMILY_EXPRESSION_NOT_VERIFIED. The gray path (completion snapshot v2,
-- family audit, gray enrichment of C-2) already recognises these items by
-- stage + family ledger, so nothing else has to change.
--
-- Why: until now an expression needed only evidence rank >= 3. A family
-- member could reach it through the stored Ordbøkene candidate bonus or a
-- Lexin usage signal although its own article check failed ("på tide": the
-- live article 131994 has no headword; the Lexin hit is the entry "inne").
-- It became colored, but the completion contract (which requires 'verified')
-- kept the whole job in manual review.
--
-- Scope: ONLY items of the family ledger (private.d10_job_family_injections_v1).
-- Expressions found in the text itself, tokens, the catalog verification
-- update and the counters are unchanged. Promotion is patched in place: four
-- anchors of the live definition, each must occur exactly once.

CREATE OR REPLACE FUNCTION public.d10_family_unverified_expression_items_v1(p_job_id uuid)
RETURNS TABLE(item_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT f.item_id
  FROM private.d10_job_family_injections_v1 f
  JOIN public.lexeme_processing_items i
    ON i.id = f.item_id AND i.job_id = f.job_id AND i.expression_id = f.expression_id
  JOIN public.expression_catalog e ON e.id = f.expression_id
  WHERE f.job_id = p_job_id
    AND f.item_id IS NOT NULL
    AND coalesce(e.expression_review_status, '') <> 'verified';
$body$;
REVOKE ALL ON FUNCTION public.d10_family_unverified_expression_items_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_family_unverified_expression_items_v1(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_family_unverified_expression_items_v1(uuid) TO service_role;

DO $patch$
DECLARE
  v_def text;
  a_items constant text := $a$
  expression_items as (
$a$;
  a_items_new constant text := $a$
  family_unverified as materialized (
    -- D10 14.10.2026: family members whose expression is not verified.
    select rs.item_id, rs.best_rank
    from ranked_summary rs
    where rs.expression_id is not null
      and rs.best_rank >= 3
      and rs.item_id in (
        select fu.item_id
        from public.d10_family_unverified_expression_items_v1(p_job_id) fu
      )
  ),

  expression_items as (
$a$;
  a_where constant text := $a$      and exists (select 1 from ranked_summary own
        where own.item_id = i.id and own.best_rank >= 3)
    returning i.id, i.expression_id
  ),
$a$;
  a_where_new constant text := $a$      and exists (select 1 from ranked_summary own
        where own.item_id = i.id and own.best_rank >= 3)
      and not exists (select 1 from family_unverified fu
        where fu.item_id = i.id)
    returning i.id, i.expression_id
  ),
$a$;
  a_weak constant text := $a$      and rs.expression_id is not null
      and rs.best_rank < 3
    returning i.id
  ),
$a$;
  a_weak_new constant text := $a$      and rs.expression_id is not null
      and rs.best_rank < 3
    returning i.id
  ),

  family_unverified_items as (
    update public.lexeme_processing_items i
    set status = 'done',
        current_stage = 'admission_gate',
        result_summary = coalesce(i.result_summary, '{}'::jsonb)
          || jsonb_build_object(
            'promotion_status', 'not_promoted',
            'admission_status', 'weak_evidence_only',
            'admission_reason', 'FAMILY_EXPRESSION_NOT_VERIFIED',
            'best_evidence_rank', fu.best_rank,
            'promotion_version', 'verification_promotion_v13_family_verified_only'
          ),
        updated_at = now()
    from family_unverified fu
    where i.id = fu.item_id
      and i.job_id = p_job_id
    returning i.id
  ),
$a$;
  a_count constant text := $a$    (select count(*) from weak_evidence_expression_items)
  into v_count;$a$;
  a_count_new constant text := $a$    (select count(*) from weak_evidence_expression_items)
    +
    (select count(*) from family_unverified_items)
  into v_count;$a$;
BEGIN
  v_def := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);

  IF position('family_unverified_items' IN v_def) > 0 THEN
    RAISE NOTICE 'D10 promotion: family rule already applied, nothing to do';
    RETURN;
  END IF;

  IF (length(v_def) - length(replace(v_def, a_items, ''))) / length(a_items) <> 1
     OR (length(v_def) - length(replace(v_def, a_where, ''))) / length(a_where) <> 1
     OR (length(v_def) - length(replace(v_def, a_weak, ''))) / length(a_weak) <> 1
     OR (length(v_def) - length(replace(v_def, a_count, ''))) / length(a_count) <> 1 THEN
    RAISE EXCEPTION 'D10_FAMILY_PROMOTION_PREFLIGHT: live promote_verification_results_for_job differs from the expected base; nothing changed';
  END IF;

  v_def := replace(v_def, a_items, a_items_new);
  v_def := replace(v_def, a_where, a_where_new);
  v_def := replace(v_def, a_weak, a_weak_new);
  v_def := replace(v_def, a_count, a_count_new);
  EXECUTE v_def;
  RAISE NOTICE 'D10 promotion: family members colored only when verified';
END
$patch$;

-- D10 v12 patch v2: exact identity; examples; independent display and family enrichment.
-- New migration; prior applied migrations are untouched.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_canonical_lexeme_examples_v1(p_lexeme_ids uuid[])
 RETURNS TABLE(lexeme_id uuid, id uuid, expression_id uuid, language_code text, example_text text, translation_uk text, source text, enrichment_evidence jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
BEGIN
  IF p_lexeme_ids IS NULL OR cardinality(p_lexeme_ids)>200 OR array_position(p_lexeme_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'EXAMPLE_RPC_EXPLICIT_IDS_REQUIRED';
  END IF;
  RETURN QUERY
  SELECT scoped.id::uuid,e.id::uuid,e.expression_id::uuid,e.language_code::text,e.example_text::text,e.translation_uk::text,e.source::text,e.enrichment_evidence::jsonb
  FROM (SELECT DISTINCT u.id FROM unnest(p_lexeme_ids)AS u(id))AS requested
  JOIN public.lexemes AS scoped ON scoped.id=requested.id
  JOIN LATERAL (
    SELECT candidate.* FROM public.entity_examples AS candidate
    WHERE ((candidate.lexeme_id=scoped.id AND candidate.expression_id IS NULL)
      OR (candidate.expression_id IS NOT NULL AND candidate.lexeme_id IS NULL
        AND EXISTS (SELECT 1 FROM public.expression_catalog expression
          WHERE expression.id=candidate.expression_id AND expression.lexeme_id=scoped.id)))
      AND candidate.language_code='nb'
      AND candidate.example_text ~ '[[:alpha:]]'
      AND candidate.example_text !~* '^[[:space:]]*(https?://|<)'
    ORDER BY (CASE WHEN candidate.source='ai_fallback' THEN 10 ELSE 0 END)
      +(CASE WHEN candidate.translation_uk ~ '[[:alpha:]]'
        AND candidate.translation_uk !~* '^[[:space:]]*(https?://|<)' THEN 0 ELSE 2 END), candidate.id
    LIMIT 1
  )AS e ON true
  ORDER BY scoped.id,e.id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.d10_project_expression_own_article_page_v1(p_job_id uuid, p_offset integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_projected integer := 0;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid expression projection page';
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS MATERIALIZED (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  ), eligible AS MATERIALIZED (
    SELECT e.id AS expression_id, e.lexeme_id, e.verification_status,
      e.source_verified, article.article_id,
      own_check.evidence->'raw_preview'->>'parent_article_id' AS parent_article_id,
      own_check.evidence AS source_evidence
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT c.candidate_article_id::text) AS article_count,
        count(DISTINCT c.parent_article_id::text) AS parent_count,
        min(c.candidate_article_id::text) AS article_id,
        min(c.parent_article_id::bigint) AS parent_article_id
      FROM public.ordbokene_expression_candidates c
      WHERE c.promoted_expression_id = e.id
        AND lower(btrim(c.normalized_key)) = lower(btrim(e.normalized_key))
        AND upper(c.candidate_dictionary_code) = 'BM'
        AND upper(c.parent_dictionary_code) = 'BM'
        AND c.candidate_kind = 'expression'
        AND c.status IN ('promoted', 'duplicate')
        AND c.candidate_article_id IS NOT NULL
        AND c.parent_article_id IS NOT NULL
    ) article
    JOIN LATERAL (
      SELECT sc.evidence
      FROM public.lexeme_processing_items own_item
      JOIN public.lexeme_source_checks sc ON sc.item_id = own_item.id
      WHERE own_item.job_id = p_job_id
        AND own_item.expression_id = e.id
        AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
        AND sc.status = 'done' AND sc.found IS TRUE
        AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
        AND lower(btrim(sc.query)) = lower(btrim(e.lemma))
        AND lower(btrim(sc.evidence->>'canonical_query')) = lower(btrim(e.lemma))
        AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
        AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article'
        AND EXISTS (SELECT 1 FROM public.ordbokene_expression_candidates bound
          WHERE bound.promoted_expression_id=e.id
            AND bound.candidate_article_id::text=article.article_id
            AND bound.parent_article_id::text=sc.evidence->'raw_preview'->>'parent_article_id'
            AND lower(btrim(bound.normalized_key))=lower(btrim(e.normalized_key))
            AND upper(bound.candidate_dictionary_code)='BM'
            AND upper(bound.parent_dictionary_code)='BM'
            AND bound.candidate_kind='expression' AND bound.status IN ('promoted','duplicate'))
        AND CASE
          WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
          THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
            AND sc.evidence->'raw_preview'->'article_ids'->>0 = article.article_id
          ELSE false
        END
      ORDER BY sc.id LIMIT 1
    ) own_check ON true
    WHERE article.article_count = 1 AND article.parent_count >= 1
      AND (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND lower(btrim(l.lemma)) = lower(btrim(e.lemma))
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme IS FALSE
      AND (l.verification_tier IS NULL
        OR (l.verification_tier IN ('dictionary_match','dictionary_entry')
          AND l.verification_evidence->'Ordbokene'->>'article_id'=article.article_id))
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
          AND b.dictionary_code = 'bm'
          AND b.source_article_id::text = own_check.evidence->'raw_preview'->>'parent_article_id'
      )
  ), projected AS (
    UPDATE public.lexemes l
    SET verification_tier = coalesce(l.verification_tier, 'dictionary_match'),
        verification_status = eligible.verification_status,
        source_verified = coalesce(nullif(eligible.source_verified, ''), 'Ordbokene'),
        verification_evidence = coalesce(l.verification_evidence, '{}'::jsonb)
          || jsonb_build_object('Ordbokene', jsonb_build_object(
            'status', 'done', 'found', true, 'registered_entry', true,
            'whole_unit_match', true, 'article_id', eligible.article_id,
            'parent_article_id', eligible.parent_article_id,
            'dictionary_code', 'bm',
            'prior_evidence', l.verification_evidence->'Ordbokene',
            'evidence', jsonb_build_object(
              'article_id', eligible.article_id,
              'parent_article_id', eligible.parent_article_id,
              'dictionary_code', 'bm',
              'raw_preview', eligible.source_evidence->'raw_preview',
              'source_check_query', eligible.source_evidence->>'canonical_query'
            )
          )),
        updated_at = now()
    FROM eligible
    WHERE l.id = eligible.lexeme_id
      AND l.verification_tier IS NULL
    RETURNING l.id
  )
  SELECT count(*) INTO v_projected FROM projected;

  RETURN jsonb_build_object('ok', true, 'projected', v_projected,
    'job_id', p_job_id, 'offset', p_offset);
END;
$function$;


CREATE OR REPLACE FUNCTION public.d10_admit_own_article_job_expressions_page_v2(p_job_id uuid, p_offset integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_expression_ids uuid[] := '{}'::uuid[];
  v_next_offset integer;
  v_has_more boolean;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_OWN_ARTICLE_ADMISSION_PAGE';
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS MATERIALIZED (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  ), eligible AS MATERIALIZED (
    SELECT e.id AS expression_id, e.lexeme_id
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT c.candidate_article_id::text) AS article_count,
        count(DISTINCT c.parent_article_id::text) AS parent_count,
        min(c.candidate_article_id::text) AS article_id,
        min(c.parent_article_id::text) AS parent_article_id
      FROM public.ordbokene_expression_candidates c
      WHERE c.promoted_expression_id = e.id
        AND lower(btrim(c.normalized_key)) = lower(btrim(e.normalized_key))
        AND upper(c.candidate_dictionary_code) = 'BM'
        AND upper(c.parent_dictionary_code) = 'BM'
        AND c.candidate_kind = 'expression'
        AND c.status IN ('promoted', 'duplicate')
        AND c.candidate_article_id IS NOT NULL
        AND c.parent_article_id IS NOT NULL
    ) article
    WHERE (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND l.verification_tier IN ('dictionary_match', 'dictionary_entry')
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme = false
      AND lower(btrim(l.lemma)) = lower(btrim(e.lemma))
      AND article.article_count = 1 AND article.parent_count >= 1
      AND upper(l.verification_evidence->'Ordbokene'->>'dictionary_code') = 'BM'
      AND l.verification_evidence->'Ordbokene'->>'article_id' = article.article_id
      AND EXISTS (SELECT 1 FROM public.ordbokene_expression_candidates bound
        WHERE bound.promoted_expression_id=e.id
          AND bound.candidate_article_id::text=article.article_id
          AND bound.parent_article_id::text=l.verification_evidence->'Ordbokene'->>'parent_article_id'
          AND lower(btrim(bound.normalized_key))=lower(btrim(e.normalized_key))
          AND upper(bound.candidate_dictionary_code)='BM'
          AND upper(bound.parent_dictionary_code)='BM'
          AND bound.candidate_kind='expression' AND bound.status IN ('promoted','duplicate'))
      AND l.verification_evidence->'Ordbokene'->'evidence'->>'article_id' = article.article_id
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
          AND b.dictionary_code = 'bm'
          AND b.source_article_id::text = l.verification_evidence->'Ordbokene'->>'parent_article_id'
      )
      AND EXISTS (
        SELECT 1
        FROM public.lexeme_processing_items own_item
        JOIN public.lexeme_source_checks sc ON sc.item_id = own_item.id
        WHERE own_item.job_id = p_job_id
          AND own_item.expression_id = e.id
          AND own_item.result_summary->>'promotion_status' = 'expression_promoted'
          AND sc.job_id = p_job_id
          AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
          AND sc.status = 'done' AND sc.found IS TRUE
          AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
          AND lower(btrim(sc.query)) = lower(btrim(e.lemma))
          AND lower(btrim(sc.evidence->>'canonical_query')) = lower(btrim(e.lemma))
          AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
          AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article'
        AND EXISTS (SELECT 1 FROM public.ordbokene_expression_candidates checked_parent
          WHERE checked_parent.promoted_expression_id=e.id
            AND checked_parent.candidate_article_id::text=article.article_id
            AND checked_parent.parent_article_id::text=sc.evidence->'raw_preview'->>'parent_article_id'
            AND lower(btrim(checked_parent.normalized_key))=lower(btrim(e.normalized_key))
            AND upper(checked_parent.candidate_dictionary_code)='BM'
            AND upper(checked_parent.parent_dictionary_code)='BM'
            AND checked_parent.candidate_kind='expression'
            AND checked_parent.status IN ('promoted','duplicate'))
          AND CASE
            WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
            THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
              AND sc.evidence->'raw_preview'->'article_ids'->>0 = article.article_id
            ELSE false
          END
      )
  ), enabled AS (
    UPDATE public.lexemes l
    SET is_learning_lexeme = true, updated_at = now()
    FROM eligible e
    WHERE l.id = e.lexeme_id AND l.is_learning_lexeme = false
    RETURNING e.expression_id
  )
  SELECT coalesce(array_agg(expression_id), '{}'::uuid[])
  INTO v_expression_ids FROM enabled;

  IF cardinality(v_expression_ids) > 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      '{}'::uuid[], v_expression_ids
    );
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  )
  SELECT p_offset + count(*)::integer,
    EXISTS (SELECT 1 FROM job_expressions ORDER BY id
            OFFSET (p_offset + p_limit) LIMIT 1)
  INTO v_next_offset, v_has_more FROM page;

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id,
    'admitted', cardinality(v_expression_ids), 'next_offset', v_next_offset,
    'has_more', v_has_more, 'version', 'd10_expression_own_article_admission_v2');
END;
$function$;


CREATE OR REPLACE FUNCTION public.recalculate_lexeme_processing_item(p_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total integer;
  v_done integer;
  v_not_found integer;
  v_failed integer;
  v_retry integer;
  v_processing integer;
  v_pending integer;
  v_success integer;
  v_status text;
  v_job_id uuid;
BEGIN
  SELECT job_id
  INTO v_job_id
  FROM lexeme_processing_items
  WHERE id = p_item_id;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE c.status = 'done')::integer,
    count(*) FILTER (WHERE c.status = 'not_found')::integer,
    count(*) FILTER (WHERE c.status = 'failed')::integer,
    count(*) FILTER (WHERE c.status = 'retry_scheduled')::integer,
    count(*) FILTER (WHERE c.status = 'processing')::integer,
    count(*) FILTER (WHERE c.status = 'pending')::integer,
    count(*) FILTER (
      WHERE c.status = 'done'
        AND (
          c.found = true
          OR c.registered_entry = true
          OR c.whole_unit_match = true
          OR c.component_match = true
          OR c.usage_match = true
        )
    )::integer
  INTO
    v_total, v_done, v_not_found, v_failed,
    v_retry, v_processing, v_pending, v_success
  FROM lexeme_source_checks c
  WHERE c.item_id = p_item_id;

  IF v_total = 0 THEN
    v_status := 'pending';
  ELSIF v_processing > 0 THEN
    v_status := 'processing';
  ELSIF v_pending > 0 THEN
    v_status := 'pending';
  ELSIF v_retry > 0 THEN
    v_status := 'retry_scheduled';
  ELSIF v_failed > 0 THEN
    IF v_success > 0 THEN
      v_status := 'partial';
    ELSE
      v_status := 'failed';
    END IF;
  ELSIF v_success > 0 THEN
    v_status := 'done';
  ELSIF v_not_found = v_total THEN
    v_status := 'failed';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE lexeme_processing_items AS i
  SET
    status = v_status,
    current_stage = CASE WHEN i.current_stage IN ('semantic_audit','admission_gate')
      THEN i.current_stage ELSE 'source_checks' END,
    finished_at = CASE
      WHEN v_status IN ('done', 'partial', 'failed')
        THEN coalesce(i.finished_at, now())
      ELSE NULL
    END,
    result_summary = coalesce(i.result_summary, '{}'::jsonb) || jsonb_build_object(
      'total_source_checks', v_total,
      'done', v_done,
      'not_found', v_not_found,
      'failed', v_failed,
      'retry_scheduled', v_retry,
      'processing', v_processing,
      'pending', v_pending,
      'successful_evidence', v_success
    )
  WHERE i.id = p_item_id;

  PERFORM recalculate_lexeme_processing_job(v_job_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.d10_family_enrichment_items_page_v1(
  p_job_id uuid, p_offset integer, p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE v_total integer; v_rows jsonb;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_ENRICHMENT_PAGE';
  END IF;
  SELECT count(*) INTO v_total FROM public.lexeme_processing_items i
  WHERE i.job_id=p_job_id AND i.expression_id IS NOT NULL
    AND i.match_type='expression'
    AND (i.current_stage='semantic_audit' OR
      (i.current_stage='admission_gate' AND EXISTS (
        SELECT 1 FROM private.d10_job_family_injections_v1 ledger
        WHERE ledger.job_id=p_job_id AND ledger.expression_id=i.expression_id
          AND ledger.item_id=i.id)));
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.id), '[]'::jsonb)
    INTO v_rows FROM (
      SELECT i.id,i.expression_id,i.normalized_lemma,i.surface_form,i.match_type,i.current_stage
      FROM public.lexeme_processing_items i
      WHERE i.job_id=p_job_id AND i.expression_id IS NOT NULL
        AND i.match_type='expression'
        AND (i.current_stage='semantic_audit' OR
          (i.current_stage='admission_gate' AND EXISTS (
            SELECT 1 FROM private.d10_job_family_injections_v1 ledger
            WHERE ledger.job_id=p_job_id AND ledger.expression_id=i.expression_id
              AND ledger.item_id=i.id)))
      ORDER BY i.id OFFSET p_offset LIMIT p_limit
    ) page;
  RETURN jsonb_build_object('ok',true,'items',v_rows,'total',v_total);
END;
$body$;
REVOKE ALL ON FUNCTION public.d10_family_enrichment_items_page_v1(uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_family_enrichment_items_page_v1(uuid,integer,integer) TO service_role;

-- One canonical read for candidate content. The v2 candidate decision is
-- retained unchanged; enrichment must never set verification status.
CREATE OR REPLACE FUNCTION public.get_lexeme360_candidate_display_v1(p_lexeme_id uuid)
RETURNS TABLE(id uuid, lemma text, expression_subtype text, status text,
  lexeme_id uuid, translation_uk text, translation_en text,
  example_text text, example_translation_uk text, verification_reason text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
WITH base AS MATERIALIZED (
  SELECT c.id,c.lemma,c.expression_subtype,c.status,e.lexeme_id
  FROM public.get_lexeme360_candidate_expressions_v2(p_lexeme_id) c
  JOIN public.expression_catalog e ON e.id=c.id
), own_ranked AS (
  SELECT b.id,tr.language_code,
    coalesce(nullif(btrim(tr.canonical_translation),''),btrim(tr.translation)) AS translation,
    row_number() OVER (PARTITION BY b.id,tr.language_code ORDER BY
      CASE lower(coalesce(tr.source,'')) WHEN 'manual_verified' THEN 1
        WHEN 'lexin' THEN 2 WHEN 'ai_fallback' THEN 3 ELSE 9 END,
      coalesce(tr.entry_order,999999),coalesce(tr.sense_rank,999),
      coalesce(tr.translation_rank,999),tr.id) AS rank
  FROM base b JOIN public.entity_translations tr ON tr.expression_id=b.id
  WHERE b.lexeme_id IS NULL AND tr.lexeme_id IS NULL
    AND tr.language_code IN ('uk','en')
    AND tr.translation_type IN ('primary','expression_primary')
    AND nullif(btrim(tr.translation),'') IS NOT NULL
)
SELECT b.id,b.lemma,b.expression_subtype,b.status,b.lexeme_id,
  coalesce(canonical.translation_uk,
    (SELECT o.translation FROM own_ranked o WHERE o.id=b.id AND o.language_code='uk' AND o.rank=1)),
  coalesce(canonical.translation_en,
    (SELECT o.translation FROM own_ranked o WHERE o.id=b.id AND o.language_code='en' AND o.rank=1)),
  ex.example_text,ex.translation_uk,
  CASE
    WHEN b.status IN ('ready','verified','active') THEN 'verified'
    WHEN b.lexeme_id IS NOT NULL THEN 'linked_to_verified_lexeme'
    ELSE 'awaiting_source_verification'
  END
FROM base b
LEFT JOIN LATERAL (
  SELECT max(t.translation) FILTER (WHERE t.language_code='uk') AS translation_uk,
    max(t.translation) FILTER (WHERE t.language_code='en') AS translation_en
  FROM public.get_canonical_lexeme_translations_v1(
    CASE WHEN b.lexeme_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[b.lexeme_id] END) t
) canonical ON true
LEFT JOIN LATERAL (
  SELECT e.example_text,e.translation_uk FROM public.entity_examples e
  WHERE e.expression_id=b.id AND e.language_code='nb'
    AND e.example_text ~ '[[:alpha:]]'
    AND e.example_text !~* '^[[:space:]]*(https?://|<)'
  ORDER BY (CASE WHEN e.source='ai_fallback' THEN 10 ELSE 0 END)
    +(CASE WHEN e.translation_uk ~ '[[:alpha:]]'
      AND e.translation_uk !~* '^[[:space:]]*(https?://|<)' THEN 0 ELSE 2 END),e.id
  LIMIT 1
) ex ON true
ORDER BY b.lemma,b.id;
$body$;
REVOKE ALL ON FUNCTION public.get_lexeme360_candidate_display_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lexeme360_candidate_display_v1(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_lexeme360_root_options_v1(p_lexeme_id uuid)
RETURNS TABLE(root_lexeme_id uuid, lemma text, pos text, article_id text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
SELECT root.id,root.lemma,root.pos,
  root.verification_evidence->'Ordbokene'->>'article_id'
FROM private.lexeme360_roots_for_lexeme_v2(p_lexeme_id) family
JOIN public.lexemes root ON root.id=family.root_lexeme_id
ORDER BY root.lemma,root.pos,root.id;
$body$;
REVOKE ALL ON FUNCTION public.get_lexeme360_root_options_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lexeme360_root_options_v1(uuid) TO authenticated, service_role;

-- The ledger distinguishes weak family candidates from unrelated admission
-- failures. Return the IDs on this audit page and both terminal counts.
CREATE OR REPLACE FUNCTION public.d10_job_gray_family_audit_v1(
  p_job_id uuid, p_item_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE v_gray_ids uuid[]; v_gray_count integer; v_blocked_count integer;
BEGIN
  IF p_job_id IS NULL OR p_item_ids IS NULL OR cardinality(p_item_ids)>30
     OR array_position(p_item_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_FAMILY_AUDIT_IDS';
  END IF;
  SELECT coalesce(array_agg(i.id),'{}'::uuid[]) INTO v_gray_ids
  FROM public.lexeme_processing_items i
  JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  WHERE i.job_id=p_job_id AND i.id=ANY(p_item_ids)
    AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  SELECT count(*) FILTER (WHERE family.item_id IS NOT NULL),
    count(*) FILTER (WHERE family.item_id IS NULL)
    INTO v_gray_count,v_blocked_count
  FROM public.lexeme_processing_items i
  LEFT JOIN private.d10_job_family_injections_v1 family
    ON family.job_id=i.job_id AND family.item_id=i.id
       AND family.expression_id=i.expression_id
  WHERE i.job_id=p_job_id AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';
  RETURN jsonb_build_object('ok',true,'gray_ids',v_gray_ids,
    'gray_count',v_gray_count,'blocked_count',v_blocked_count);
END;
$body$;
REVOKE ALL ON FUNCTION public.d10_job_gray_family_audit_v1(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_job_gray_family_audit_v1(uuid,uuid[]) TO service_role;

-- Preserve v1 unchanged. Filter only ledger-backed weak family candidates
-- from the readiness contract; report every exclusion explicitly.
CREATE OR REPLACE FUNCTION public.get_completion_evidence_snapshot_v2(
  p_job_id uuid, p_cursor text DEFAULT NULL, p_limit integer DEFAULT 20,
  p_expected_snapshot_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  snapshot jsonb;
  gray_ids uuid[];
  gray_items jsonb;
  gray_count integer;
  page_entities jsonb;
  effective_state text;
BEGIN
  snapshot := public.get_completion_evidence_snapshot_v1(
    p_job_id,p_cursor,p_limit,p_expected_snapshot_token);
  SELECT coalesce(array_agg(i.expression_id),'{}'::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,
      'expression_id',i.expression_id,'reason','unverified_family_candidate')
      ORDER BY i.id),'[]'::jsonb), count(*)
  INTO gray_ids,gray_items,gray_count
  FROM public.lexeme_processing_items i
  JOIN private.d10_job_family_injections_v1 ledger
    ON ledger.job_id=i.job_id AND ledger.item_id=i.id
      AND ledger.expression_id=i.expression_id
  WHERE i.job_id=p_job_id AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted';

  SELECT coalesce(jsonb_agg(
    CASE WHEN entity->>'entity_kind'='lexeme' THEN
      jsonb_set(entity,'{relations}',coalesce((
        SELECT jsonb_agg(relation)
        FROM jsonb_array_elements(coalesce(entity->'relations','[]'::jsonb)) relation
        WHERE NOT (relation->>'expression_id'=ANY(
          SELECT unnest(gray_ids)::text))
      ),'[]'::jsonb))
    ELSE entity END ORDER BY ordinal), '[]'::jsonb)
  INTO page_entities
  FROM jsonb_array_elements(snapshot->'page'->'entities')
    WITH ORDINALITY AS page(entity,ordinal)
  WHERE NOT (entity->>'entity_kind'='expression'
    AND entity->>'entity_id'=ANY(SELECT unnest(gray_ids)::text));

  -- A gray member has completed its own checks but has insufficient
  -- evidence. It cannot turn the whole job failed or under review.
  SELECT CASE
    WHEN job.status='failed' THEN 'failed'
    WHEN job.status IN ('partial','needs_manual_review')
      OR coalesce(supervisor.stage,'')='needs_manual_review'
      THEN 'needs_manual_review'
    WHEN EXISTS (SELECT 1 FROM public.lexeme_processing_items i
      WHERE i.job_id=p_job_id AND i.status='failed'
        AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 f
          WHERE f.job_id=i.job_id AND f.item_id=i.id
            AND f.expression_id=i.expression_id
            AND i.current_stage='admission_gate'
            AND i.result_summary->>'promotion_status'='not_promoted'))
      THEN 'failed'
    WHEN EXISTS (SELECT 1 FROM public.lexeme_processing_items i
      WHERE i.job_id=p_job_id AND i.status IS DISTINCT FROM 'done'
        AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 f
          WHERE f.job_id=i.job_id AND f.item_id=i.id
            AND f.expression_id=i.expression_id
            AND i.current_stage='admission_gate'
            AND i.result_summary->>'promotion_status'='not_promoted'))
      THEN 'needs_manual_review'
    ELSE 'completed' END INTO effective_state
  FROM public.lexeme_processing_jobs job
  LEFT JOIN public.pipeline_supervisor_state supervisor ON supervisor.job_id=job.id
  WHERE job.id=p_job_id;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(snapshot,'{page,entities}',page_entities),
          '{counts,total_entities}',
          to_jsonb(greatest(0,(snapshot->'counts'->>'total_entities')::integer
            - cardinality(gray_ids)))),
        '{counts,excluded_items}',
        to_jsonb(coalesce((snapshot->'counts'->>'excluded_items')::integer,0)
          + gray_count)),
      '{excluded_items}',coalesce(snapshot->'excluded_items','[]'::jsonb)||gray_items),
    '{execution_state}',to_jsonb(effective_state));
END;
$body$;
REVOKE ALL ON FUNCTION public.get_completion_evidence_snapshot_v2(uuid,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_completion_evidence_snapshot_v2(uuid,text,integer,text) TO service_role;

-- A weak family member may make the aggregate partial after its own
-- checks finish. Continue the supervisor's active enrichment/audit stage.
CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, status text, created_at timestamptz)
LANGUAGE sql STABLE
AS $body$
  SELECT j.id,j.status,j.created_at
  FROM public.lexeme_processing_jobs j
  LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
  WHERE j.status IN ('pending','processing','ready','done','retry_scheduled','partial')
    AND (s.stage IS NULL OR s.stage NOT IN ('done','needs_manual_review'))
    AND (j.status <> 'partial' OR s.stage IN ('orchestrator','enrichment','audit')
      OR EXISTS (SELECT 1 FROM public.lexeme_processing_items i
        WHERE i.job_id=j.id AND i.current_stage='source_checks'))
  ORDER BY j.created_at ASC LIMIT p_limit;
$body$;

-- Keep the job-scoped enrichment/audit metadata when a source-check trigger
-- recalculates counters; the old function replaced the entire summary JSON.
CREATE OR REPLACE FUNCTION public.recalculate_lexeme_processing_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql
AS $body$
DECLARE
  v_total integer; v_done integer; v_partial integer; v_failed integer;
  v_skipped integer; v_processing integer; v_pending integer; v_retry integer;
  v_status text;
BEGIN
  SELECT count(*)::integer,
    count(*) FILTER (WHERE status='done')::integer,
    count(*) FILTER (WHERE status='partial')::integer,
    count(*) FILTER (WHERE status='failed')::integer,
    count(*) FILTER (WHERE status='skipped')::integer,
    count(*) FILTER (WHERE status='processing')::integer,
    count(*) FILTER (WHERE status='pending')::integer,
    count(*) FILTER (WHERE status='retry_scheduled')::integer
  INTO v_total,v_done,v_partial,v_failed,v_skipped,v_processing,v_pending,v_retry
  FROM public.lexeme_processing_items WHERE job_id=p_job_id;
  IF v_total=0 THEN v_status:='pending';
  ELSIF v_processing>0 THEN v_status:='processing';
  ELSIF v_retry>0 THEN v_status:='partial';
  ELSIF v_failed>0 OR v_partial>0 THEN v_status:='partial';
  ELSIF v_pending>0 THEN v_status:='pending';
  ELSE v_status:='done'; END IF;
  UPDATE public.lexeme_processing_jobs AS j
  SET total_items=v_total,done_items=v_done,partial_items=v_partial,
      failed_items=v_failed,skipped_items=v_skipped,status=v_status,
      finished_at=CASE WHEN v_status IN ('done','partial','failed')
        THEN coalesce(j.finished_at,now()) ELSE NULL END,
      summary=coalesce(j.summary,'{}'::jsonb)||jsonb_build_object(
        'total',v_total,'done',v_done,'partial',v_partial,'failed',v_failed,
        'skipped',v_skipped,'processing',v_processing,'pending',v_pending,
        'retry_scheduled',v_retry)
  WHERE j.id=p_job_id;
END;
$body$;

COMMIT;

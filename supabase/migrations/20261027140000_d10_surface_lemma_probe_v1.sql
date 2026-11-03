-- D10_surface_lemma_probe_v1 (27.10.2026, agreed)
-- "Surface as lemma" probe: a checked word known in the database only as a
-- form of other lemmas (bar -> bære, bare) is also asked as a headword of its
-- own. See supabase/functions/_shared/d10-surface-probe.ts.
--
-- 1. d10_resolve_surface_probe_v1 (new): split the probe into part-of-speech
--    items (normal path from source_checks) or close it; retry counting.
-- 2. get_completion_evidence_snapshot_v2 (replaced, additive): a closed probe
--    leaves unresolved_items and is listed in excluded_items. The rest of the
--    function is unchanged (version from query 202, 27.10.2026).
-- Nothing else is changed. No data is changed by this migration.

-- ---------------------------------------------------------------------------
-- 1. Resolve one probe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_resolve_surface_probe_v1(
  p_item_id uuid,
  p_outcome text,
  p_pos text[] DEFAULT '{}'::text[],
  p_evidence jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_job_id uuid;
  v_item public.lexeme_processing_items%ROWTYPE;
  v_pos text;
  v_new_id uuid;
  v_cloned integer := 0;
  v_attempts integer;
  v_reason text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('split', 'no_headword', 'retry') THEN
    RAISE EXCEPTION 'INVALID_SURFACE_PROBE_OUTCOME: %', p_outcome;
  END IF;

  SELECT i.job_id INTO v_job_id
  FROM public.lexeme_processing_items i WHERE i.id = p_item_id;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'SURFACE_PROBE_NOT_FOUND: %', p_item_id;
  END IF;

  -- Same lock as expand_multi_pos_occurrences_for_job (step B): clones of one
  -- job are never created by two calls at once.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_job_id::text, 1010));

  SELECT * INTO v_item
  FROM public.lexeme_processing_items i
  WHERE i.id = p_item_id
  FOR UPDATE;

  -- Already resolved (a repeated tick): nothing to do, no new clones.
  IF v_item.current_stage IS DISTINCT FROM 'surface_probe'
     OR v_item.result_summary->>'match_strategy' IS DISTINCT FROM 'surface_as_lemma_probe' THEN
    RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'already_resolved', true,
      'closed', false, 'cloned', 0);
  END IF;

  IF p_outcome = 'retry' THEN
    v_attempts := coalesce(v_item.attempt_count, 0) + 1;
    IF v_attempts < coalesce(v_item.max_attempts, 3) THEN
      UPDATE public.lexeme_processing_items
      SET attempt_count = v_attempts,
          last_error = left(coalesce(p_evidence->>'error', 'Ordbokene lookup failed'), 500),
          updated_at = now()
      WHERE id = p_item_id;
      RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'outcome', 'retry',
        'attempt', v_attempts, 'closed', false, 'cloned', 0);
    END IF;
    v_reason := 'surface_probe_lookup_failed';
  ELSIF p_outcome = 'no_headword' THEN
    v_reason := 'surface_probe_no_headword';
  ELSE
    v_reason := 'surface_probe_split';
    FOREACH v_pos IN ARRAY coalesce(p_pos, '{}'::text[]) LOOP
      IF v_pos IS NULL OR v_pos NOT IN ('noun', 'verb', 'adjective') THEN
        CONTINUE;
      END IF;
      -- One item per (job, lemma, part of speech), as in step B.
      IF EXISTS (
        SELECT 1 FROM public.lexeme_processing_items x
        WHERE x.job_id = v_item.job_id
          AND lower(btrim(x.normalized_lemma)) = lower(btrim(v_item.normalized_lemma))
          AND x.pos = v_pos
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.lexeme_processing_items (
        job_id, lexeme_id, expression_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status,
        current_stage, attempt_count, max_attempts, result_summary
      ) VALUES (
        v_item.job_id, NULL, NULL, v_item.raw_input, v_item.normalized_input,
        v_item.normalized_lemma, v_item.surface_form, v_pos, 'token', 'pending',
        'source_checks', 0, 3,
        jsonb_build_object(
          'ingestion_version', v_item.result_summary->'ingestion_version',
          'token_start', v_item.result_summary->'token_start',
          'token_end', v_item.result_summary->'token_end',
          'match_strategy', 'surface_as_lemma_probe_clone',
          'cloned_from_item_id', v_item.id,
          'clone_reason', 'surface_as_lemma_probe_split',
          'clone_version', 'd10_surface_probe_v1',
          'probe_headword_pos', p_evidence->'headword_pos'
        )
      ) RETURNING id INTO v_new_id;

      INSERT INTO public.lexeme_source_checks (
        job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls,
        verification_version
      )
      SELECT v_item.job_id, v_new_id, NULL, source_name, 'lemma',
        v_item.normalized_lemma, v_item.surface_form, 'token', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB', 'Ordbokene', 'Lexin', 'Språkrådet', 'Wiktionary']) AS sources(source_name);

      v_cloned := v_cloned + 1;
    END LOOP;
  END IF;

  -- Close the probe: rejected by design, like a function word (excluded by
  -- the completion snapshot v2 and by pipeline-supervisor).
  UPDATE public.lexeme_processing_items
  SET status = 'done',
      current_stage = 'admission_gate',
      finished_at = coalesce(finished_at, now()),
      updated_at = now(),
      result_summary = coalesce(result_summary, '{}'::jsonb) || jsonb_build_object(
        'promotion_status', 'not_promoted',
        'admission_status', 'rejected',
        'admission_reason', v_reason,
        'admission_decision', jsonb_build_object(
          'admit', false, 'status', 'rejected', 'rule_type', 'surface_probe',
          'reason', v_reason),
        'surface_probe_outcome', p_outcome,
        'surface_probe_clones', v_cloned,
        'surface_probe_evidence', coalesce(p_evidence, '{}'::jsonb),
        'promotion_version', 'd10_surface_probe_v1')
  WHERE id = p_item_id;

  UPDATE public.lexeme_processing_jobs j
  SET total_items = (SELECT count(*) FROM public.lexeme_processing_items i
                     WHERE i.job_id = v_item.job_id),
      updated_at = now()
  WHERE j.id = v_item.job_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'outcome', p_outcome,
    'reason', v_reason, 'closed', true, 'cloned', v_cloned);
END;
$function$;

REVOKE ALL ON FUNCTION public.d10_resolve_surface_probe_v1(uuid, text, text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_resolve_surface_probe_v1(uuid, text, text[], jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_resolve_surface_probe_v1(uuid, text, text[], jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Completion snapshot v2: closed probes are excluded
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_completion_evidence_snapshot_v2(p_job_id uuid, p_cursor text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_expected_snapshot_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  snapshot jsonb;
  gray_ids uuid[];
  gray_items jsonb;
  gray_count integer;
  page_entities jsonb;
  effective_state text;
  probe_ids uuid[];
  probe_items jsonb;
  probe_count integer;
BEGIN
  snapshot := public.get_completion_evidence_snapshot_v1(
    p_job_id,p_cursor,p_limit,p_expected_snapshot_token);
  -- D10 25.10.2026 (point 4): admission fields of each unresolved item
  snapshot := jsonb_set(snapshot, '{unresolved_items}', coalesce((
    SELECT jsonb_agg(u.item || coalesce((
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'admission_reason', i.result_summary->>'admission_reason',
        'admission_status', i.result_summary->>'admission_status',
        'promotion_status', i.result_summary->>'promotion_status',
        'normalized_lemma', i.normalized_lemma,
        'pos', i.pos))
      FROM public.lexeme_processing_items i
      WHERE i.job_id = p_job_id AND i.id::text = u.item->>'item_id'), '{}'::jsonb) ORDER BY u.ord)
    FROM jsonb_array_elements(coalesce(snapshot->'unresolved_items', '[]'::jsonb)) WITH ORDINALITY AS u(item, ord)
  ), '[]'::jsonb));
  -- D10 27.10.2026 (agreed): a closed "surface as lemma" probe is not a word
  -- of the job (like a function word): it leaves unresolved_items and is
  -- listed in excluded_items. A probe that still waits stays unresolved.
  SELECT coalesce(array_agg(i.id ORDER BY i.id),'{}'::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,
      'raw_input',i.raw_input,'normalized_input',i.normalized_input,
      'status',i.status,'current_stage',i.current_stage,
      'promotion_status',i.result_summary->>'promotion_status',
      'admission_status',i.result_summary->>'admission_status',
      'admission_reason',i.result_summary->>'admission_reason',
      'reason','surface_probe') ORDER BY i.id),'[]'::jsonb),
    count(*)
  INTO probe_ids, probe_items, probe_count
  FROM public.lexeme_processing_items i
  WHERE i.job_id=p_job_id AND i.lexeme_id IS NULL AND i.expression_id IS NULL
    AND i.status='done' AND i.current_stage='admission_gate'
    AND i.result_summary->>'promotion_status'='not_promoted'
    AND i.result_summary->>'admission_status'='rejected'
    AND i.result_summary->>'admission_reason' LIKE 'surface\_probe\_%'
    AND i.result_summary->'admission_decision'->>'rule_type'='surface_probe';
  IF probe_count > 0 THEN
    snapshot := jsonb_set(snapshot,'{unresolved_items}',coalesce((
      SELECT jsonb_agg(u.item ORDER BY u.ord)
      FROM jsonb_array_elements(coalesce(snapshot->'unresolved_items','[]'::jsonb))
        WITH ORDINALITY AS u(item, ord)
      WHERE NOT ((u.item->>'item_id') = ANY(SELECT unnest(probe_ids)::text))
    ),'[]'::jsonb));
    snapshot := jsonb_set(snapshot,'{counts,unresolved_items}',
      to_jsonb(greatest(0,coalesce((snapshot->'counts'->>'unresolved_items')::integer,0)-probe_count)));
    snapshot := jsonb_set(snapshot,'{counts,excluded_items}',
      to_jsonb(coalesce((snapshot->'counts'->>'excluded_items')::integer,0)+probe_count));
    snapshot := jsonb_set(snapshot,'{excluded_items}',
      coalesce(snapshot->'excluded_items','[]'::jsonb)||probe_items);
  END IF;

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
      jsonb_set(jsonb_set(entity,'{identity,naob_forms}',to_jsonb(EXISTS (
        SELECT 1 FROM public.lexeme_naob_forms_v1 nf WHERE nf.lexeme_id::text = entity->>'entity_id'))),'{relations}',coalesce((
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
$function$;

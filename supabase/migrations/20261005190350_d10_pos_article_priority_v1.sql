BEGIN;
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('public.extract_pos_from_source_evidence(jsonb,text)'::regprocedure)) <> 'bbabf829ae0c8de4d2283e6203dd562e'
 OR md5(pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) <> 'bdef3428a432a4638af8a0fc84cf86a0' THEN
 RAISE EXCEPTION 'STOP: exact live function fingerprint changed since export'; END IF;
END;
$guard$;
CREATE OR REPLACE FUNCTION public.extract_pos_from_source_evidence(p_verification_evidence jsonb, p_lemma text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $function$
DECLARE
  v_lemma text := lower(btrim(p_lemma));
  v_source jsonb;
  v_preview text;
  v_positions text[];
BEGIN
  IF p_verification_evidence IS NULL OR coalesce(v_lemma, '') = '' THEN RETURN NULL; END IF;
  v_source := p_verification_evidence->'Ordbokene';
  IF v_source->>'status' = 'done'
    AND v_source->>'found' = 'true'
    AND v_source->>'registered_entry' = 'true'
    AND v_source->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
    AND lower(btrim(v_source->'evidence'->>'canonical_query')) = v_lemma
    AND jsonb_typeof(v_source->'evidence'->'raw_preview'->'article_ids') = 'array'
    AND v_source->'evidence'->'raw_preview'->'article_ids' <> '[]'::jsonb
    AND v_source->'evidence'->'raw_preview'->>'pos' IN ('noun','verb','adjective','adverb','determiner')
  THEN RETURN v_source->'evidence'->'raw_preview'->>'pos'; END IF;

  -- Search pages suggest separate candidates; they never select a single POS.
  -- Flat Lexin previews may mix entry IDs and are not used for POS admission.
  v_source := p_verification_evidence->'NAOB';
  IF v_source->>'status' IS DISTINCT FROM 'done'
    OR v_source->>'found' IS DISTINCT FROM 'true'
    OR v_source->>'registered_entry' IS DISTINCT FROM 'true'
    OR lower(btrim(v_source->'evidence'->>'canonical_query')) IS DISTINCT FROM v_lemma
  THEN RETURN NULL; END IF;
  v_preview := lower(coalesce(v_source->'evidence'->>'raw_preview',v_source->>'raw_preview'));
  v_preview := regexp_replace(replace(v_preview, chr(160), ' '), '&nbsp;|&#0*160;|&#x0*a0;', ' ', 'g');
  SELECT array_agg(DISTINCT CASE m[2]
    WHEN 'substantiv' THEN 'noun' WHEN 'adjektiv' THEN 'adjective' ELSE m[2] END)
  INTO v_positions
  FROM regexp_matches(v_preview,
    '([[:alpha:]æøå][[:alpha:]æøå-]*)[[:space:]]+(verb|substantiv|adjektiv|adverb)\M', 'g') AS m
  WHERE m[1] = v_lemma;
  IF cardinality(v_positions) = 1 THEN RETURN v_positions[1]; END IF;
  RETURN NULL;
END;
$function$;
DO $patch$
DECLARE v_definition text;
BEGIN
 v_definition := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
 IF position($old$'pos_source', case when lm.pos_from_evidence then 'naob_evidence_extraction' else 'resolve_surface_form' end$old$ IN v_definition) = 0
   OR position($anchor$coalesce(nullif(rs.pos, ''), pe.extracted_pos)$anchor$ IN v_definition) = 0 THEN
   RAISE EXCEPTION 'STOP: promotion anchors changed since export'; END IF;
 v_definition := replace(v_definition, $old$'pos_source', case when lm.pos_from_evidence then 'naob_evidence_extraction' else 'resolve_surface_form' end$old$, $new$'pos_source', case
            when not lm.pos_from_evidence then 'resolve_surface_form'
            when lm.verification_evidence->'Ordbokene'->>'status' = 'done'
              and lm.verification_evidence->'Ordbokene'->>'found' = 'true'
              and lm.verification_evidence->'Ordbokene'->>'registered_entry' = 'true'
              and lower(btrim(lm.verification_evidence->'Ordbokene'->'evidence'->>'canonical_query')) = lower(btrim(i.normalized_lemma))
              and jsonb_typeof(lm.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'article_ids') = 'array'
              and lm.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'article_ids' <> '[]'::jsonb
              and lm.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
              and lm.verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->>'pos' = public.extract_pos_from_source_evidence(lm.verification_evidence, i.normalized_lemma)
              then 'ordbokene_bm_evidence'
            else 'registered_naob_evidence' end$new$);
 EXECUTE v_definition;
END;
$patch$;
COMMIT;

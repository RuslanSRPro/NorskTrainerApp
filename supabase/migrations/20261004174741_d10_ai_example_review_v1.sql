BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.bind_reviewed_ai_example_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb)') IS NOT NULL THEN
 RAISE EXCEPTION 'STOP: example binder already exists'; END IF;
END $$;
CREATE FUNCTION public.bind_reviewed_ai_example_v1(
  p_example_id uuid, p_lexeme_id uuid, p_lemma text, p_pos text,
  p_example_nb text, p_translation_uk text, p_expected_updated_at timestamptz, p_article_id text, p_evidence jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $binder$
DECLARE
  l public.lexemes%rowtype;
  t public.entity_examples%rowtype;
  current_snapshot uuid;
  b jsonb := p_evidence->'example_binding';
  r jsonb := p_evidence->'review';
  s jsonb := p_evidence->'source';
  c jsonb := p_evidence->'review'->'approved_proposal'->'context';
BEGIN
  IF p_example_id IS NULL OR p_lexeme_id IS NULL OR p_expected_updated_at IS NULL
     OR nullif(btrim(p_example_nb),'') IS NULL OR nullif(btrim(p_translation_uk),'') IS NULL OR p_article_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'AI_BINDING_INPUT_INVALID';
  END IF;
  IF NOT coalesce(
    p_evidence->>'version' = 'd10_ai_pos_sense_v3'
    AND p_evidence->>'status' = 'ai_reviewed'
    AND p_evidence->'source_verified' = 'false'::jsonb
    AND b->>'version' = 'd10_example_evidence_v1' AND b->>'kind' = 'ai_example'
    AND b->>'lexeme_id' = p_lexeme_id::text AND b->>'language_code' = 'nb' AND b->>'translation_language_code' = 'uk' AND b->'expression_id' = 'null'::jsonb
    AND b->>'translation_value' = btrim(p_translation_uk) AND b->>'value' = btrim(p_example_nb) AND b->>'lemma' = p_lemma AND b->>'pos' = p_pos
    AND b->>'dictionary' = 'bm' AND b->>'article_id' = p_article_id
    AND r->>'version' = 'd10_ai_pos_sense_v3' AND r->>'status' = 'accepted'
    AND r->>'provider' = 'gemini' AND nullif(btrim(r->>'model'),'') IS NOT NULL
    AND nullif(btrim(r->>'reason'),'') IS NOT NULL
    AND nullif(r->>'reviewed_at','') IS NOT NULL
    AND s->>'provider' = 'Ordbokene' AND s->>'dictionary' = 'bm'
    AND s->>'article_id' = p_article_id AND s->>'lemma' = p_lemma AND s->>'pos' = p_pos
    AND c->>'dictionary' = 'bm' AND c->>'article_id' = p_article_id
    AND c->>'lemma' = p_lemma AND c->>'pos' = p_pos
    AND jsonb_typeof(c->'definitions') = 'array' AND c->'definitions' <> '[]'::jsonb
    AND c->'definitions' = s->'definitions' AND c->'examples' = s->'examples'
    AND coalesce(c->'translation_constraints','[]'::jsonb) = coalesce(s->'translation_constraints','[]'::jsonb)
    AND r->'approved_proposal'->'missing' @> jsonb_build_array('example')
    AND r->'approved_proposal'->'answer'->>'example_nb' = btrim(p_example_nb)
    AND r->'approved_proposal'->'answer'->>'example_translation_ua' = btrim(p_translation_uk), false) THEN
    RAISE EXCEPTION 'AI_BINDING_PROOF_INVALID';
  END IF;
  PERFORM (r->>'reviewed_at')::timestamptz;
  SELECT * INTO l FROM public.lexemes WHERE id=p_lexeme_id FOR SHARE;
  IF NOT FOUND OR l.lemma IS DISTINCT FROM p_lemma OR l.pos IS DISTINCT FROM p_pos THEN
    RAISE EXCEPTION 'AI_BINDING_LEXEME_CHANGED';
  END IF;
  SELECT ms.id INTO current_snapshot
  FROM private.authoritative_morphology_snapshots_v2 ms
  WHERE ms.lexeme_id=l.id AND ms.is_active AND ms.is_complete AND ms.state='ready'
    AND ms.requested_pos=l.pos AND ms.normalized_query=lower(btrim(l.lemma))
    AND 'bm'=any(ms.dictionaries) AND p_article_id::bigint=any(ms.source_article_ids)
    AND ms.finalized_at IS NOT NULL AND ms.superseded_at IS NULL
    AND ms.expected_article_count > 0 AND ms.fetched_article_count=ms.expected_article_count
  FOR SHARE;
  IF current_snapshot IS NULL THEN RAISE EXCEPTION 'AI_BINDING_ARTICLE_CHANGED'; END IF;
  SELECT * INTO t FROM public.entity_examples WHERE id=p_example_id FOR UPDATE;
  IF NOT FOUND OR t.lexeme_id IS DISTINCT FROM p_lexeme_id OR t.expression_id IS NOT NULL
    OR t.source IS DISTINCT FROM 'ai_fallback' OR t.language_code IS DISTINCT FROM 'nb'
    OR t.example_text IS DISTINCT FROM p_example_nb OR t.translation_uk IS DISTINCT FROM p_translation_uk
    OR t.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'AI_BINDING_EXAMPLE_CHANGED';
  END IF;
  UPDATE public.entity_examples SET enrichment_evidence=p_evidence, updated_at=now() WHERE id=t.id;
  RETURN t.id;
END;
$binder$;
REVOKE ALL ON FUNCTION public.bind_reviewed_ai_example_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_reviewed_ai_example_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb) TO service_role;

COMMIT;

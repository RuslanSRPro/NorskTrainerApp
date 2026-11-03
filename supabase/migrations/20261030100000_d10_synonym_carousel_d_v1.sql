-- D10_synonym_carousel_d_v1 (30.10.2026, agreed in chat: stage D - synonym carousel like the 360 family,
-- badge in reading + "Синоніми" block inside the 360 card).
-- New read-only RPC for the app: the published synonyms of one card, each with the card that opens
-- (lexeme -> itself, expression -> expression_catalog.lexeme_id), its part of speech, the verifier
-- decision (verified_synonym / contextual_synonym) and the verifier's reason.
-- Same filter as sync_lexeme_synonym_column (publication on -> only status verified).
-- Nothing existing is changed.
BEGIN;

DO $pre$
BEGIN
  IF to_regprocedure('public.d10_synonym_publication_on_v1()') IS NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_publish_c_v1 is not installed; nothing changed';
  END IF;
  IF to_regprocedure('public.get_synonym_carousel_v1(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: get_synonym_carousel_v1 already exists; nothing changed';
  END IF;
END
$pre$;

CREATE FUNCTION public.get_synonym_carousel_v1(p_lexeme_id uuid)
RETURNS TABLE (card_id uuid, lemma text, pos text, decision text, target_entity_type text,
               target_entity_id uuid, reason text, confidence text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  WITH rel AS (
    SELECT r.target_text, r.target_entity_type, r.target_entity_id, r.relation_class, r.confidence,
           r.verification_evidence
    FROM public.authoritative_semantic_relations r
    WHERE p_lexeme_id IS NOT NULL
      AND r.relation_type = 'synonym'
      AND (NOT public.d10_synonym_publication_on_v1() OR r.status = 'verified')
      AND ((r.source_entity_type = 'lexeme' AND r.source_entity_id = p_lexeme_id)
        OR (r.source_entity_type = 'expression'
            AND r.source_entity_id IN (SELECT x.id FROM public.expression_catalog x WHERE x.lexeme_id = p_lexeme_id)))
  ), card AS (
    SELECT rel.*,
           CASE WHEN rel.target_entity_type = 'lexeme' THEN rel.target_entity_id
                WHEN rel.target_entity_type = 'expression' THEN (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id = rel.target_entity_id)
           END AS cid
    FROM rel
  )
  SELECT DISTINCT ON (coalesce(c.cid::text, lower(c.target_text)))
         c.cid, c.target_text, coalesce(l.pos, CASE WHEN c.target_entity_type = 'expression' THEN 'expression' END),
         c.relation_class, c.target_entity_type, c.target_entity_id,
         (SELECT e->>'reason' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.verification_evidence->'pairs') = 'array'
                 THEN c.verification_evidence->'pairs' ELSE '[]'::jsonb END) e WHERE e->>'reason' IS NOT NULL LIMIT 1),
         c.confidence::text
  FROM card c LEFT JOIN public.lexemes l ON l.id = c.cid
  WHERE c.cid IS DISTINCT FROM p_lexeme_id
  ORDER BY coalesce(c.cid::text, lower(c.target_text)),
           (c.relation_class = 'verified_synonym') DESC, c.confidence::text DESC NULLS LAST;
$fn$;

REVOKE ALL ON FUNCTION public.get_synonym_carousel_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v1(uuid) TO authenticated, service_role;

COMMIT;

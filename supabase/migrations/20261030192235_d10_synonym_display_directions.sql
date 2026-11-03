-- Additive display contract. No canonical translations, jobs or existing verdicts are rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.synonym_verifier_log_v1
  ADD COLUMN IF NOT EXISTS substitution_forward boolean,
  ADD COLUMN IF NOT EXISTS substitution_reverse boolean,
  ADD COLUMN IF NOT EXISTS same_construction boolean;

CREATE OR REPLACE FUNCTION public.d10_synonym_log_ai_call_v2(p_call jsonb, p_rows jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE v_call uuid;
BEGIN
  INSERT INTO public.synonym_verifier_calls_v1 (reason, job_id, model, pairs, decided, ok, prompt_tokens,
    output_tokens, duration_ms, error, prompt_version)
  VALUES (p_call->>'reason', nullif(p_call->>'job_id', '')::uuid, p_call->>'model',
    coalesce((p_call->>'pairs')::integer, 0), coalesce((p_call->>'decided')::integer, 0),
    coalesce((p_call->>'ok')::boolean, false), (p_call->>'prompt_tokens')::integer,
    (p_call->>'output_tokens')::integer, (p_call->>'duration_ms')::integer, left(p_call->>'error', 500),
    p_call->>'prompt_version')
  RETURNING id INTO v_call;
  INSERT INTO public.synonym_verifier_log_v1 (call_id, pair_id, content_key, model, prompt_version, verifier_version,
    source_lemma, naob_meaning, target_lemma, target_definitions, matched_definition, matched_text, pattern,
    ai_decision, final_decision, guard, confidence, reason, example_nb, applied, error, substitution_forward, substitution_reverse, same_construction)
  SELECT v_call, (r->>'pair_id')::uuid, r->>'content_key', p_call->>'model', p_call->>'prompt_version',
    coalesce(r->>'verifier_version', 'ai:synonym_pair_' || (p_call->>'prompt_version') || ':' || (p_call->>'model')),
    r->'snapshot'->'source'->>'lemma', r->'snapshot'->'source'->>'definition_nb',
    r->'snapshot'->'target'->>'lemma', r->'snapshot'->'target'->'definitions_nb',
    (r->>'matched_definition')::integer, r->>'matched_text', r->>'pattern',
    r->>'ai_decision', r->>'final_decision', r->>'guard', (r->>'confidence')::numeric,
    left(r->>'reason', 500), left(r->>'example_nb', 300), (r->>'applied')::boolean, left(r->>'error', 500),
    (r->>'substitution_forward')::boolean, (r->>'substitution_reverse')::boolean, (r->>'same_construction')::boolean
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  WHERE EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.id = (r->>'pair_id')::uuid);
  RETURN v_call;
END
$fn$;

-- One row per verified pair, oriented relative to the card being opened.
-- Direction flags are NULL for old decisions, not fabricated from the final class.
CREATE OR REPLACE FUNCTION public.get_synonym_carousel_v3(p_lexeme_id uuid)
RETURNS TABLE(card_id uuid, lemma text, pos text, decision text, level text,
  target_entity_type text, target_entity_id uuid,
  my_sense text, my_sense_key text, my_sense_uk text, my_sense_en text,
  their_sense text, their_sense_uk text, their_sense_en text, reason text,
  my_sense_path text, my_sense_ord integer, pair_id uuid,
  can_replace_opened boolean, can_replace_target boolean, same_construction boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
WITH me AS (
  SELECT 'lexeme'::text t, p_lexeme_id i WHERE p_lexeme_id IS NOT NULL
  UNION SELECT 'expression', x.id FROM public.expression_catalog x WHERE x.lexeme_id = p_lexeme_id
), oriented AS (
  SELECT x.*, m.t = x.head_type AND m.i = x.head_id AS forward,
    p.verification_evidence e
  FROM public.d10_synonym_pair_sides_v1() x
  JOIN public.synonym_pair_v1 p ON p.id=x.pair_id AND p.published
  JOIN me m ON (m.t=x.head_type AND m.i=x.head_id) OR (m.t=x.target_type AND m.i=x.target_id)
  WHERE EXISTS (SELECT 1 FROM public.authoritative_semantic_relations r
    WHERE r.source_entity_type=m.t AND r.source_entity_id=m.i
      AND r.target_entity_type=CASE WHEN m.t=x.head_type AND m.i=x.head_id THEN x.target_type ELSE x.head_type END
      AND r.target_entity_id=CASE WHEN m.t=x.head_type AND m.i=x.head_id THEN x.target_id ELSE x.head_id END
      AND r.relation_type='synonym' AND r.status='verified' AND r.source='synonym-verifier')
), info AS (
  SELECT o.*,
    CASE WHEN forward THEN target_type ELSE head_type END tt,
    CASE WHEN forward THEN target_id ELSE head_id END ti,
    CASE WHEN forward THEN head_lemma ELSE target_lemma END ml,
    CASE WHEN forward THEN head_sense ELSE target_sense END ms,
    CASE WHEN forward THEN head_article ELSE target_article END ma,
    CASE WHEN forward THEN target_lemma ELSE head_lemma END tl,
    CASE WHEN forward THEN target_sense ELSE head_sense END ts,
    CASE WHEN forward THEN e->'substitution_forward' ELSE e->'substitution_reverse' END f,
    CASE WHEN forward THEN e->'substitution_reverse' ELSE e->'substitution_forward' END r
  FROM oriented o
)
SELECT DISTINCT ON (i.pair_id, card.cid, i.ms)
  card.cid, i.tl, coalesce(l.pos, CASE WHEN i.tt='expression' THEN 'expression' END),
  i.decision, CASE WHEN i.verifier_version LIKE 'rule:%' THEN 'dictionary' ELSE 'ai' END,
  i.tt, i.ti, i.ms,
  coalesce(i.ma::text, 'unknown') || ':' || public.d10_synonym_sense_key_v1(i.ml, i.ms),
  ml.uk, ml.en, i.ts, tl.uk, tl.en, i.reason, sp.sense_path, sp.def_ord, i.pair_id,
  CASE WHEN jsonb_typeof(i.f)='boolean' THEN i.f::text::boolean END,
  CASE WHEN jsonb_typeof(i.r)='boolean' THEN i.r::text::boolean END,
  CASE WHEN jsonb_typeof(i.e->'same_construction')='boolean' THEN (i.e->>'same_construction')::boolean END
FROM info i
CROSS JOIN LATERAL (SELECT CASE WHEN i.tt='lexeme' THEN i.ti
  ELSE (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id=i.ti) END cid) card
JOIN public.lexemes l ON l.id=card.cid
LEFT JOIN public.synonym_sense_label_v1 ml ON ml.sense_key=public.d10_synonym_sense_key_v1(i.ml,i.ms) AND ml.status='done'
LEFT JOIN public.synonym_sense_label_v1 tl ON tl.sense_key=public.d10_synonym_sense_key_v1(i.tl,i.ts) AND tl.status='done'
LEFT JOIN LATERAL public.d10_synonym_sense_path_v1(i.ma,i.ms) sp ON true
WHERE card.cid <> p_lexeme_id
ORDER BY i.pair_id,card.cid,i.ms;
$fn$;
REVOKE ALL ON FUNCTION public.get_synonym_carousel_v3(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v3(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.d10_synonym_log_ai_call_v2(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_log_ai_call_v2(jsonb,jsonb) TO service_role;

-- Only this contradictory *sense label* is invalidated. The ordinary card stays untouched.
-- Regeneration is bounded by the existing 3-attempt label queue.
UPDATE public.synonym_sense_label_v1 SET status='queued', uk=NULL, en=NULL,
  attempts=0, lease_token=NULL, lease_until=NULL, last_error='bilingual_sense_mismatch_review', updated_at=now()
WHERE lemma='god' AND sense_text='stor, romslig' AND uk='великий' AND en='spacious' AND status='done';
NOTIFY pgrst, 'reload schema';
COMMIT;

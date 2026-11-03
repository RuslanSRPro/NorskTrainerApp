-- D10_synonym_same_gloss_v1 (30.10.2026, agreed in chat: rule "one gloss item").
-- Words that stand in ONE NAOB gloss item of the same word are synonyms of each other in that sense:
--   slå ut: "sette ut av spill; gjøre kampudyktig; tvinge til å gi opp; beseire"
--   -> slå ut ⇄ sette ut av spill and slå ut ⇄ beseire are verified pairs
--   -> sette ut av spill ⇄ beseire (new, no AI call).
-- Only targets whose own pair with the head word is published (verified_synonym / contextual_synonym).
-- Decision: verified_synonym when both parent pairs are verified_synonym, else contextual_synonym.
-- Published as authoritative_semantic_relations (source 'synonym-same-gloss', status verified, both directions)
-- -> the existing trigger fills lexemes.synonyms -> badge and carousel.
-- Kept in step with the parent pairs by a new trigger on synonym_pair_v1 (runs after the publish trigger).
-- Not created when the verifier already linked the two (no duplicate); removed when no gloss supports it any more.
-- Nothing existing is changed.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
BEGIN
  IF to_regprocedure('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_publish_c_v1 is not installed; nothing changed';
  END IF;
  IF to_regprocedure('public.d10_synonym_publish_siblings_v1(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_same_gloss_v1 is already installed; nothing changed';
  END IF;
END
$pre$;

-- one gloss: make the sibling links match the published parent pairs
CREATE FUNCTION public.d10_synonym_publish_siblings_v1(p_gloss_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE
  v_key text := p_gloss_id::text;
  v_added integer := 0;
  v_removed integer := 0;
  r record;
BEGIN
  IF p_gloss_id IS NULL OR NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS d10_sib_want (st text, si uuid, tt text, ti uuid, tlemma text, decision text) ON COMMIT DROP;
  TRUNCATE d10_sib_want;

  -- published targets of this gloss (one row per target card)
  INSERT INTO d10_sib_want
  WITH t AS (
    SELECT p.target_entity_type tt, p.target_entity_id ti,
           bool_or(p.decision = 'verified_synonym') AS verified
    FROM public.synonym_pair_v1 p
    JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
    WHERE c.gloss_id = p_gloss_id
      AND p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')
    GROUP BY 1, 2
  )
  SELECT a.tt, a.ti, b.tt, b.ti, public.d10_synonym_entity_lemma_v1(b.tt, b.ti),
         CASE WHEN a.verified AND b.verified THEN 'verified_synonym' ELSE 'contextual_synonym' END
  FROM t a JOIN t b ON (a.tt, a.ti) <> (b.tt, b.ti)
  WHERE public.d10_synonym_entity_lemma_v1(a.tt, a.ti) IS NOT NULL
    AND public.d10_synonym_entity_lemma_v1(b.tt, b.ti) IS NOT NULL
    -- the verifier already links them: no second link
    AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations v
                    WHERE v.relation_type = 'synonym' AND v.source = 'synonym-verifier'
                      AND ((v.source_entity_type = a.tt AND v.source_entity_id = a.ti
                            AND v.target_entity_type = b.tt AND v.target_entity_id = b.ti)
                        OR (v.source_entity_type = b.tt AND v.source_entity_id = b.ti
                            AND v.target_entity_type = a.tt AND v.target_entity_id = a.ti)));

  -- this gloss no longer supports a link: drop the gloss from it; no gloss left -> delete
  FOR r IN SELECT x.id, x.verification_evidence FROM public.authoritative_semantic_relations x
           WHERE x.source = 'synonym-same-gloss' AND x.relation_type = 'synonym'
             AND x.verification_evidence->'gloss_ids' ? v_key
             AND NOT EXISTS (SELECT 1 FROM d10_sib_want w WHERE w.st = x.source_entity_type AND w.si = x.source_entity_id
                               AND w.tt = x.target_entity_type AND w.ti = x.target_entity_id)
  LOOP
    IF jsonb_array_length(r.verification_evidence->'gloss_ids') <= 1 THEN
      DELETE FROM public.authoritative_semantic_relations WHERE id = r.id;
    ELSE
      UPDATE public.authoritative_semantic_relations
      SET verification_evidence = jsonb_set(verification_evidence, '{gloss_ids}', (verification_evidence->'gloss_ids') - v_key),
          updated_at = now()
      WHERE id = r.id;
    END IF;
    v_removed := v_removed + 1;
  END LOOP;

  -- add / refresh
  INSERT INTO public.authoritative_semantic_relations AS x (source_entity_type, source_entity_id, relation_type, target_text,
    source, confidence, status, evidence, target_entity_type, target_entity_id, relation_class, recognition_level,
    verification_evidence, verified_at, verifier_version)
  SELECT w.st, w.si, 'synonym', w.tlemma, 'synonym-same-gloss',
    CASE WHEN w.decision = 'verified_synonym' THEN 'high' ELSE 'medium' END, 'verified',
    jsonb_build_object('published_by', 'd10_synonym_publish_siblings_v1'), w.tt, w.ti, w.decision, 'rule',
    jsonb_build_object('gloss_ids', jsonb_build_array(v_key), 'rule', 'same_gloss_item'), now(), 'rule:same_gloss_v1'
  FROM d10_sib_want w
  ON CONFLICT (source_entity_type, source_entity_id, relation_type, target_text, source) DO UPDATE SET
    status = 'verified', target_entity_type = EXCLUDED.target_entity_type, target_entity_id = EXCLUDED.target_entity_id,
    -- several glosses: verified when any of them says verified
    relation_class = CASE WHEN x.relation_class = 'verified_synonym' AND x.verification_evidence->'gloss_ids' <> jsonb_build_array(v_key)
                          THEN 'verified_synonym' ELSE EXCLUDED.relation_class END,
    confidence = CASE WHEN x.relation_class = 'verified_synonym' AND x.verification_evidence->'gloss_ids' <> jsonb_build_array(v_key)
                      THEN 'high' ELSE EXCLUDED.confidence END,
    verification_evidence = jsonb_set(x.verification_evidence, '{gloss_ids}',
      CASE WHEN x.verification_evidence->'gloss_ids' ? v_key THEN x.verification_evidence->'gloss_ids'
           ELSE coalesce(x.verification_evidence->'gloss_ids', '[]'::jsonb) || jsonb_build_array(v_key) END),
    verified_at = now(), updated_at = now()
  WHERE x.relation_class IS DISTINCT FROM EXCLUDED.relation_class OR NOT (x.verification_evidence->'gloss_ids' ? v_key)
     OR x.status <> 'verified';
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'gloss_id', p_gloss_id, 'links_written', v_added, 'links_removed', v_removed);
END
$fn$;

-- every parent decision: the siblings of its gloss follow
CREATE FUNCTION public.d10_synonym_siblings_trg_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_gloss uuid;
BEGIN
  IF public.d10_synonym_publication_on_v1() THEN
    SELECT c.gloss_id INTO v_gloss FROM public.synonym_candidate_queue c WHERE c.id = NEW.candidate_id;
    IF v_gloss IS NOT NULL THEN
      PERFORM public.d10_synonym_publish_siblings_v1(v_gloss);
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

-- name sorts after trg_d10_synonym_pair_publish_v1: runs after the parent link is written
CREATE TRIGGER trg_d10_synonym_pair_siblings_v1
AFTER INSERT OR UPDATE OF status, decision ON public.synonym_pair_v1
FOR EACH ROW
WHEN (NEW.status IN ('done', 'queued', 'superseded', 'processing'))
EXECUTE FUNCTION public.d10_synonym_siblings_trg_v1();

-- all glosses once (now, and after publication is switched on again)
CREATE FUNCTION public.d10_synonym_publish_siblings_all_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE r record; v jsonb; v_glosses integer := 0; v_written integer := 0; v_removed integer := 0;
BEGIN
  IF NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PUBLICATION_OFF');
  END IF;
  FOR r IN SELECT DISTINCT c.gloss_id FROM public.synonym_pair_v1 p
           JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
           WHERE c.gloss_id IS NOT NULL AND p.status = 'done'
  LOOP
    v := public.d10_synonym_publish_siblings_v1(r.gloss_id);
    v_glosses := v_glosses + 1;
    v_written := v_written + coalesce((v->>'links_written')::int, 0);
    v_removed := v_removed + coalesce((v->>'links_removed')::int, 0);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'glosses', v_glosses, 'links_written', v_written, 'links_removed', v_removed);
END
$fn$;

REVOKE ALL ON FUNCTION public.d10_synonym_publish_siblings_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_siblings_trg_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_publish_siblings_all_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_publish_siblings_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_publish_siblings_all_v1() TO service_role;

SELECT public.d10_synonym_publish_siblings_all_v1();

COMMIT;

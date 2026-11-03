-- D10_synonym_publish_c_v1 (29.10.2026, agreed in chat: stage C)
-- Publication of verified synonym pairs, so they appear in the app:
--   synonym_pair_v1 (decision verified_synonym / contextual_synonym)
--     -> authoritative_semantic_relations (source 'synonym-verifier', status
--        'verified', BOTH directions)
--     -> existing trigger -> lexemes.synonyms -> synonyms badge in the app.
-- Publication is OFF until switched on (synonym_verifier_config_v1.dry_run):
--   query 269 shows exactly what would be published; then
--     update public.synonym_verifier_config_v1 set dry_run = false;
--     select public.d10_synonym_publish_all_v1();
-- With publication ON, lexemes.synonyms shows only verified relations: the 540
-- old unverified relations (naob-synonym-resolver, status candidate) are hidden
-- from the app, NOT deleted. With it OFF the app shows what it shows today.
-- After the switch every new decision is published / withdrawn at once
-- (trigger on synonym_pair_v1). near_synonym / related / rejected / manual
-- review are never published.
-- Guard: md5 of sync_lexeme_synonym_column; stage B/v3 installed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $pre$
BEGIN
  IF (SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) FROM pg_proc p
      WHERE p.oid = to_regprocedure('public.sync_lexeme_synonym_column(uuid)'))
     IS DISTINCT FROM '7627f32e2f85649ebfda11f37661e46d' THEN
    RAISE EXCEPTION 'STOP: sync_lexeme_synonym_column is not the expected version; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'synonym_verifier_config_v1' AND column_name = 'model') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_verifier_v3 is not installed; nothing changed';
  END IF;
  IF to_regprocedure('public.d10_synonym_publish_all_v1()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_publish_c_v1 is already installed; nothing changed';
  END IF;
END
$pre$;

-- dry_run = false now means: publication on (stage C lifts the check of stage B)
ALTER TABLE public.synonym_verifier_config_v1 DROP CONSTRAINT IF EXISTS synonym_verifier_config_v1_dry_run_check;

CREATE OR REPLACE FUNCTION public.d10_synonym_publication_on_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
  SELECT coalesce((SELECT NOT dry_run FROM public.synonym_verifier_config_v1 WHERE singleton), false);
$fn$;

-- ---------------------------------------------------------------------------
-- 1. What the app shows: publication ON -> only verified relations
--    (the rest of the function as before; 'decision' added for the carousel)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lexeme_synonym_column(p_lexeme_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_synonyms jsonb;
  v_verified_only boolean := public.d10_synonym_publication_on_v1();
begin
  if p_lexeme_id is null then
    return;
  end if;

  -- Собираем связи, где ИСТОЧНИК — эта лексема (напрямую как lexeme, либо
  -- как expression, чей expression_catalog.lexeme_id указывает на неё).
  -- D10 29.10.2026 (stage C): с включённой публикацией — только проверенные
  -- связи (status verified); старые непроверенные скрыты, не удалены.
  select jsonb_agg(
    jsonb_build_object(
      'text', r.target_text,
      'resolved', (r.target_entity_id is not null),
      'target_entity_type', r.target_entity_type,
      'target_entity_id', r.target_entity_id,
      'confidence', r.confidence,
      'source', r.source,
      'decision', r.relation_class
    )
    order by (r.target_entity_id is not null) desc, r.confidence desc
  )
  into v_synonyms
  from public.authoritative_semantic_relations r
  where r.relation_type = 'synonym'
    and (not v_verified_only or r.status = 'verified')
    and (
      (r.source_entity_type = 'lexeme' and r.source_entity_id = p_lexeme_id)
      or (
        r.source_entity_type = 'expression'
        and r.source_entity_id in (
          select id from public.expression_catalog where lexeme_id = p_lexeme_id
        )
      )
    );

  update public.lexemes
  set synonyms = v_synonyms
  where id = p_lexeme_id
    and synonyms is distinct from v_synonyms;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. One link (two cards): published in both directions while at least one
--    pair between them is verified_synonym / contextual_synonym; else removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_entity_lemma_v1(p_type text, p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
  SELECT CASE WHEN p_type = 'expression' THEN (SELECT x.lemma FROM public.expression_catalog x WHERE x.id = p_id)
              ELSE (SELECT l.lemma FROM public.lexemes l WHERE l.id = p_id) END;
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_publish_link_v1(p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_best text;
  v_pairs jsonb;
  v_version text;
  v_a_lemma text := public.d10_synonym_entity_lemma_v1(p_a_type, p_a_id);
  v_b_lemma text := public.d10_synonym_entity_lemma_v1(p_b_type, p_b_id);
BEGIN
  IF NOT public.d10_synonym_publication_on_v1() THEN RETURN 'publication_off'; END IF;
  SELECT CASE WHEN bool_or(p.decision = 'verified_synonym') THEN 'verified_synonym' ELSE 'contextual_synonym' END,
         jsonb_agg(jsonb_build_object('pair_id', p.id, 'decision', p.decision, 'confidence', p.confidence,
           'verifier', p.verifier_version, 'reason', p.verification_evidence->>'reason') ORDER BY p.verified_at DESC),
         (array_agg(p.verifier_version ORDER BY p.verified_at DESC))[1]
    INTO v_best, v_pairs, v_version
  FROM public.synonym_pair_v1 p
  WHERE p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')
    AND ((p.source_entity_type = p_a_type AND p.source_entity_id = p_a_id AND p.target_entity_type = p_b_type AND p.target_entity_id = p_b_id)
      OR (p.source_entity_type = p_b_type AND p.source_entity_id = p_b_id AND p.target_entity_type = p_a_type AND p.target_entity_id = p_a_id));

  IF v_pairs IS NULL OR v_a_lemma IS NULL OR v_b_lemma IS NULL THEN
    DELETE FROM public.authoritative_semantic_relations r
    WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
      AND ((r.source_entity_type = p_a_type AND r.source_entity_id = p_a_id AND r.target_entity_type = p_b_type AND r.target_entity_id = p_b_id)
        OR (r.source_entity_type = p_b_type AND r.source_entity_id = p_b_id AND r.target_entity_type = p_a_type AND r.target_entity_id = p_a_id));
    UPDATE public.synonym_pair_v1 p SET published = false, updated_at = now()
    WHERE p.published AND ((p.source_entity_id = p_a_id AND p.target_entity_id = p_b_id) OR (p.source_entity_id = p_b_id AND p.target_entity_id = p_a_id));
    RETURN 'withdrawn';
  END IF;

  INSERT INTO public.authoritative_semantic_relations AS r (source_entity_type, source_entity_id, relation_type, target_text,
    source, confidence, status, evidence, target_entity_type, target_entity_id, relation_class, recognition_level,
    verification_evidence, verified_at, verifier_version)
  SELECT d.st, d.si, 'synonym', d.tt, 'synonym-verifier',
    CASE WHEN v_best = 'verified_synonym' THEN 'high' ELSE 'medium' END, 'verified',
    jsonb_build_object('published_by', 'd10_synonym_publish_link_v1'), d.tty, d.ti, v_best,
    CASE WHEN v_version LIKE 'rule:%' THEN 'rule' ELSE 'ai_verified' END,
    jsonb_build_object('pairs', v_pairs), now(), v_version
  FROM (VALUES (p_a_type, p_a_id, v_b_lemma, p_b_type, p_b_id), (p_b_type, p_b_id, v_a_lemma, p_a_type, p_a_id)) d(st, si, tt, tty, ti)
  ON CONFLICT (source_entity_type, source_entity_id, relation_type, target_text, source) DO UPDATE SET
    confidence = EXCLUDED.confidence, status = 'verified', target_entity_type = EXCLUDED.target_entity_type,
    target_entity_id = EXCLUDED.target_entity_id, relation_class = EXCLUDED.relation_class,
    recognition_level = EXCLUDED.recognition_level, verification_evidence = EXCLUDED.verification_evidence,
    verified_at = now(), verifier_version = EXCLUDED.verifier_version, updated_at = now();

  UPDATE public.synonym_pair_v1 p SET published = (p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')),
    updated_at = now()
  WHERE ((p.source_entity_id = p_a_id AND p.target_entity_id = p_b_id) OR (p.source_entity_id = p_b_id AND p.target_entity_id = p_a_id))
    AND p.published IS DISTINCT FROM (p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym'));
  RETURN 'published';
END
$fn$;

-- every new decision: publish / withdraw that link at once (publication ON only)
CREATE OR REPLACE FUNCTION public.d10_synonym_pair_publish_trg_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
BEGIN
  IF public.d10_synonym_publication_on_v1() THEN
    PERFORM public.d10_synonym_publish_link_v1(NEW.source_entity_type, NEW.source_entity_id,
      NEW.target_entity_type, NEW.target_entity_id);
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER trg_d10_synonym_pair_publish_v1
AFTER INSERT OR UPDATE OF status, decision ON public.synonym_pair_v1
FOR EACH ROW
WHEN (NEW.status IN ('done', 'queued', 'superseded', 'processing') )
EXECUTE FUNCTION public.d10_synonym_pair_publish_trg_v1();

-- ---------------------------------------------------------------------------
-- 3. The switch: publish all links and show only verified relations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_publish_all_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  r record;
  v_published integer := 0;
  v_withdrawn integer := 0;
  v_synced integer := 0;
  v_res text;
BEGIN
  IF NOT public.d10_synonym_publication_on_v1() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PUBLICATION_OFF',
      'hint', 'update public.synonym_verifier_config_v1 set dry_run = false;');
  END IF;
  FOR r IN SELECT DISTINCT p.source_entity_type st, p.source_entity_id si, p.target_entity_type tt, p.target_entity_id ti
           FROM public.synonym_pair_v1 p
           WHERE p.published OR (p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym'))
  LOOP
    v_res := public.d10_synonym_publish_link_v1(r.st, r.si, r.tt, r.ti);
    IF v_res = 'published' THEN v_published := v_published + 1; ELSIF v_res = 'withdrawn' THEN v_withdrawn := v_withdrawn + 1; END IF;
  END LOOP;
  -- every card that shows synonyms today is synced again (old unverified ones disappear)
  FOR r IN SELECT l.id FROM public.lexemes l WHERE l.synonyms IS NOT NULL
  LOOP
    PERFORM public.sync_lexeme_synonym_column(r.id);
    v_synced := v_synced + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'links_published', v_published, 'links_withdrawn', v_withdrawn,
    'cards_synced', v_synced);
END
$fn$;

-- back: publication OFF, verified relations stay in the table but the app shows
-- everything as before stage C
CREATE OR REPLACE FUNCTION public.d10_synonym_publication_off_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE r record; v_n integer := 0;
BEGIN
  UPDATE public.synonym_verifier_config_v1 SET dry_run = true, updated_at = now() WHERE singleton;
  FOR r IN SELECT DISTINCT x.lid FROM (
      SELECT CASE WHEN a.source_entity_type = 'lexeme' THEN a.source_entity_id
                  ELSE (SELECT e.lexeme_id FROM public.expression_catalog e WHERE e.id = a.source_entity_id) END AS lid
      FROM public.authoritative_semantic_relations a WHERE a.relation_type = 'synonym') x WHERE x.lid IS NOT NULL
  LOOP
    PERFORM public.sync_lexeme_synonym_column(r.lid);
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'cards_synced', v_n);
END
$fn$;

-- d10_synonym_publication_on_v1: default rights (the trigger of authoritative_semantic_relations calls it)
REVOKE ALL ON FUNCTION public.d10_synonym_entity_lemma_v1(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_publish_link_v1(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_publish_all_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_publication_off_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_pair_publish_trg_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_entity_lemma_v1(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_publish_link_v1(text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_publish_all_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_publication_off_v1() TO service_role;

COMMIT;

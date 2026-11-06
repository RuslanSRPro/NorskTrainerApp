-- 20261105100000_d10_synonym_link_class_v1.sql
-- D10_synonym_link_class_v1 (agreed 05.11.2026): the class of a published link between two cards is
-- verified_synonym (clean) only when EVERY published pair between them (both directions) is clean; one contextual
-- pair makes the link contextual_synonym. Before: one clean pair was enough (bool_or). This matches the carousel
-- rule (clean only when every check agrees). The badge and lexemes.synonyms follow the link class.
-- Only the class of the link changes; which pairs are published does not change.
-- Changed: public.d10_synonym_publish_link_v1 (one text edit, md5 checked before/after; security definer kept).
-- Then every link whose published pairs are mixed (clean + contextual) is republished once.
-- Guards: D10_synonym_v12_v1 installed; md5 differs -> STOP; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_linkclass_report;
CREATE TEMP TABLE d10_linkclass_report(part text, name text, info jsonb);
DO $mig$
DECLARE v_oid oid := to_regprocedure('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)');
  v_md5 text; v_def text; v_old text := 'CASE WHEN bool_or(p.decision = ''verified_synonym'') THEN ''verified_synonym''';
  v_new text := 'CASE WHEN bool_and(p.decision = ''verified_synonym'') THEN ''verified_synonym''';
  v_sec boolean; v_cfg text[]; v_sec2 boolean; v_cfg2 text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'synonym_verifier_config_v1' AND column_name = 'verifier_contract') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_v12_v1 is not installed';
  END IF;
  IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: d10_synonym_publish_link_v1 not found'; END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosecdef, proconfig INTO v_md5, v_sec, v_cfg FROM pg_proc WHERE oid = v_oid;
  IF strpos((SELECT prosrc FROM pg_proc WHERE oid = v_oid), 'bool_and(p.decision = ''verified_synonym'')') > 0 THEN
    RAISE EXCEPTION 'STOP: D10_synonym_link_class_v1 already installed';
  END IF;
  IF v_md5 <> '7a9719b3c5f9bb853af763ae70164b8f' THEN RAISE EXCEPTION 'STOP: d10_synonym_publish_link_v1 has md5 %, expected 7a9719b3c5f9bb853af763ae70164b8f', v_md5; END IF;
  v_def := replace(pg_get_functiondef(v_oid), E'\r', '');
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN RAISE EXCEPTION 'STOP: expected text not found once'; END IF;
  v_def := replace(v_def, v_old, '-- D10_synonym_link_class_v1: clean only when every published pair is clean' || E'\n  ' || v_new);
  EXECUTE v_def;
  SELECT md5(replace(prosrc, E'\r', '')), prosecdef, proconfig INTO v_md5, v_sec2, v_cfg2 FROM pg_proc WHERE oid = v_oid;
  IF v_sec2 IS DISTINCT FROM v_sec OR v_cfg2 IS DISTINCT FROM v_cfg THEN RAISE EXCEPTION 'STOP: security definer / config lost'; END IF;
  INSERT INTO d10_linkclass_report VALUES ('01_function', 'd10_synonym_publish_link_v1', jsonb_build_object('md5_before', '7a9719b3c5f9bb853af763ae70164b8f', 'md5_after', v_md5));
END
$mig$;

-- links with mixed published pairs (clean + contextual): republished once with the new rule
DO $r$
DECLARE r record; v_res text; n integer := 0;
BEGIN
  FOR r IN
    SELECT least(p.source_entity_id::text, p.target_entity_id::text) AS k1, greatest(p.source_entity_id::text, p.target_entity_id::text) AS k2,
      min(p.source_entity_type) AS t, min(p.snapshot->'source'->>'lemma') FILTER (WHERE p.source_entity_id::text = least(p.source_entity_id::text, p.target_entity_id::text)) AS l1,
      min(p.snapshot->'target'->>'lemma') FILTER (WHERE p.source_entity_id::text = least(p.source_entity_id::text, p.target_entity_id::text)) AS l2,
      min(CASE WHEN p.source_entity_id::text = least(p.source_entity_id::text, p.target_entity_id::text) THEN p.source_entity_type ELSE p.target_entity_type END) AS t1,
      min(CASE WHEN p.source_entity_id::text = least(p.source_entity_id::text, p.target_entity_id::text) THEN p.target_entity_type ELSE p.source_entity_type END) AS t2
    FROM public.synonym_pair_v1 p
    WHERE p.published
    GROUP BY 1, 2
    HAVING bool_or(p.decision = 'verified_synonym') AND bool_or(p.decision = 'contextual_synonym')
  LOOP
    v_res := public.d10_synonym_publish_link_v1(r.t1, r.k1::uuid, r.t2, r.k2::uuid);
    n := n + 1;
    INSERT INTO d10_linkclass_report SELECT '02_republished', coalesce(r.l1, '?') || ' <-> ' || coalesce(r.l2, '?'), jsonb_build_object('result', v_res,
      'link_class_now', (SELECT relation_class FROM public.authoritative_semantic_relations x WHERE x.source = 'synonym-verifier' AND x.relation_type = 'synonym'
        AND x.source_entity_id = r.k1::uuid AND x.target_entity_id = r.k2::uuid LIMIT 1));
  END LOOP;
  INSERT INTO d10_linkclass_report VALUES ('03_summary', 'mixed_links_republished', jsonb_build_object('n', n,
    'links_clean', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym' AND relation_class = 'verified_synonym'),
    'links_contextual', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym' AND relation_class = 'contextual_synonym'),
    'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published)));
END
$r$;
SELECT part, name, info FROM d10_linkclass_report ORDER BY 1, 2;

-- 20261105110000_d10_synonym_sibling_context_v1.sql
-- D10_synonym_sibling_context_v1 (05.11.2026): a SIBLING candidate (two synonyms of the same gloss item, e.g. flink and
-- dyktig listed under svaer) got the sense context of the HEAD word's gloss (svaer, article 58845, "flink, dyktig",
-- examples about svaer) instead of its own source sense. The verifier then judged the source word in the meaning of
-- another word (flink -> dyktig was answered about svaer).
-- Fix: for sibling candidates (source_sense_anchor 'sib:%') the sense context is built from the SOURCE card's own
-- article (evidence source_article_id) and its own sense text (naob_gloss = the sense of the source in the parent pair):
-- sense path, all definitions of that sense, examples of that sense. Head-word candidates: unchanged.
--  * new private.synonym_sibling_context_v1(article, sense_text);
--  * public.d10_synonym_prepare_candidate_v1: one text edit (md5 checked before/after; security definer kept).
-- Existing sibling pairs are NOT re-queued here (no AI spent): the report counts them; re-preparing them is a separate,
-- agreed step (README). Guards: D10_synonym_link_class_v1 installed; md5 differs -> STOP; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_sibctx_report;
CREATE TEMP TABLE d10_sibctx_report(part text, name text, info jsonb);
DO $g$
BEGIN
  IF strpos(coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)')), ''),
            'bool_and(p.decision = ''verified_synonym'')') = 0 THEN
    RAISE EXCEPTION 'STOP: D10_synonym_link_class_v1 is not installed';
  END IF;
  IF to_regprocedure('private.synonym_sibling_context_v1(bigint,text)') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_sibling_context_v1 already installed'; END IF;
  IF to_regprocedure('public.d10_synonym_target_paths_v1(jsonb)') IS NULL OR to_regprocedure('private.synonym_sense_examples_v1(bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'STOP: helper functions not found';
  END IF;
END
$g$;

-- the sense context of a source word in its OWN article: the definition line equal to p_sense, its sense path, all
-- definitions of that sense, the examples of that sense; '{}' when the article or the sense is not found
CREATE FUNCTION private.synonym_sibling_context_v1(p_article bigint, p_sense text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH a AS (SELECT k.payload FROM public.ordbokene_article_cache k
             WHERE p_article IS NOT NULL AND k.article_id = p_article AND lower(k.dictionary_code) = 'bm'
             ORDER BY k.updated_at DESC LIMIT 1),
  paths AS (SELECT x.sense_path, x.def_ord, x.txt FROM a CROSS JOIN LATERAL public.d10_synonym_target_paths_v1(a.payload) x),
  me AS (SELECT sense_path FROM paths WHERE lower(btrim(txt)) = lower(btrim(p_sense)) ORDER BY def_ord LIMIT 1)
  SELECT coalesce((SELECT jsonb_build_object('article_id', p_article, 'sense_path', coalesce(me.sense_path, ''),
      'focus_gloss', btrim(p_sense),
      'group_definitions', (SELECT coalesce(jsonb_agg(p.txt ORDER BY p.def_ord), '[]'::jsonb) FROM paths p WHERE p.sense_path IS NOT DISTINCT FROM me.sense_path),
      'examples_nb', private.synonym_sense_examples_v1(p_article, coalesce(me.sense_path, '')),
      'by', 'sibling_own_article')
    FROM me), '{}'::jsonb);
$f$;
REVOKE ALL ON FUNCTION private.synonym_sibling_context_v1(bigint, text) FROM PUBLIC;

DO $mig$
DECLARE v_oid oid := to_regprocedure('public.d10_synonym_prepare_candidate_v1(uuid,boolean)');
  v_md5 text; v_def text; v_sec boolean; v_cfg text[]; v_sec2 boolean; v_cfg2 text[];
  v_old text := '''sense_context'', public.d10_synonym_source_context_v1(c.bm_gloss_id))';
  v_new text := '''sense_context'',' || E'\n' ||
    '      -- D10_synonym_sibling_context_v1: a sibling candidate uses its OWN article and sense, not the head word''s gloss' || E'\n' ||
    '      CASE WHEN coalesce(c.source_sense_anchor, '''') LIKE ''sib:%''' || E'\n' ||
    '        THEN private.synonym_sibling_context_v1(CASE WHEN (c.verification_evidence->>''source_article_id'') ~ ''^[0-9]+$''' || E'\n' ||
    '               THEN (c.verification_evidence->>''source_article_id'')::bigint END, c.naob_gloss)' || E'\n' ||
    '        ELSE public.d10_synonym_source_context_v1(c.bm_gloss_id) END)';
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: d10_synonym_prepare_candidate_v1 not found'; END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosecdef, proconfig INTO v_md5, v_sec, v_cfg FROM pg_proc WHERE oid = v_oid;
  IF v_md5 <> '2db51f20b1aebbca70940d2c885d4151' THEN RAISE EXCEPTION 'STOP: d10_synonym_prepare_candidate_v1 has md5 %, expected 2db51f20b1aebbca70940d2c885d4151', v_md5; END IF;
  v_def := replace(pg_get_functiondef(v_oid), E'\r', '');
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN RAISE EXCEPTION 'STOP: expected text not found once'; END IF;
  EXECUTE replace(v_def, v_old, v_new);
  SELECT md5(replace(prosrc, E'\r', '')), prosecdef, proconfig INTO v_md5, v_sec2, v_cfg2 FROM pg_proc WHERE oid = v_oid;
  IF v_sec2 IS DISTINCT FROM v_sec OR v_cfg2 IS DISTINCT FROM v_cfg THEN RAISE EXCEPTION 'STOP: security definer / config lost'; END IF;
  INSERT INTO d10_sibctx_report VALUES ('01_function', 'd10_synonym_prepare_candidate_v1', jsonb_build_object('md5_before', '2db51f20b1aebbca70940d2c885d4151', 'md5_after', v_md5));
END
$mig$;

-- report: sibling candidates and their current pairs whose sense context comes from ANOTHER article than the source's
INSERT INTO d10_sibctx_report
SELECT '02_affected', 'sibling_pairs_with_foreign_context', jsonb_build_object(
  'candidates', count(DISTINCT c.id), 'pairs', count(*), 'published_pairs', count(*) FILTER (WHERE p.published),
  'examples', (array_agg(DISTINCT (p.snapshot->'source'->>'lemma') || ' -> ' || (p.snapshot->'target'->>'lemma')))[1:15])
FROM public.synonym_candidate_queue c
JOIN public.synonym_pair_v1 p ON p.candidate_id = c.id AND p.status NOT IN ('superseded')
WHERE coalesce(c.source_sense_anchor, '') LIKE 'sib:%' AND c.source_active
  AND (p.snapshot->'source'->'sense_context'->>'article_id') IS DISTINCT FROM (c.verification_evidence->>'source_article_id');
-- probe: the new context of the flink -> dyktig sibling candidate (if present), nothing written
INSERT INTO d10_sibctx_report
SELECT '03_probe', (SELECT lemma FROM public.lexemes WHERE id = c.source_entity_id) || ' -> ' || c.target_text,
  jsonb_build_object('candidate', c.id, 'old_context_article', (SELECT p.snapshot->'source'->'sense_context'->>'article_id' FROM public.synonym_pair_v1 p WHERE p.candidate_id = c.id ORDER BY p.updated_at DESC LIMIT 1),
    'new_context', private.synonym_sibling_context_v1(CASE WHEN (c.verification_evidence->>'source_article_id') ~ '^[0-9]+$' THEN (c.verification_evidence->>'source_article_id')::bigint END, c.naob_gloss))
FROM public.synonym_candidate_queue c
WHERE coalesce(c.source_sense_anchor, '') LIKE 'sib:%' AND c.source_active
ORDER BY (c.target_text = 'dyktig') DESC, c.updated_at DESC LIMIT 3;
SELECT part, name, info FROM d10_sibctx_report ORDER BY 1, 2;

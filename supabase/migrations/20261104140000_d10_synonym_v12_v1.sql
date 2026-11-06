-- 20261104140000_d10_synonym_v12_v1.sql
-- D10_synonym_v12_v1 (agreed 04.11.2026): the production verifier can run contract v12.
--  * v12 = relation check v11b (target senses grouped by article sense, labels not selectable) with the class decided
--    by the agreed feature rules rules_v12; translation fit sense_fit_v2b on ALL dictionary translations of the card
--    (every Lexin variant; AI only where Lexin has none) - no new translations are created;
--  * model gpt-6-luna, thinking level medium (OpenAI key OPENAI_API_KEY in Supabase secrets);
--  * publication (agreed): a v12 clean synonym OR a v12 contextual synonym is published, both directions replaceable
--    and BOTH translation fits = match; the link carries relation_class (verified_synonym / contextual_synonym).
--    v10 and rule decisions keep the old rule (clean only). One-way, near and rejected are never published.
-- INSTALLING CHANGES NOTHING: the config stays on v10 until the switch (one UPDATE, see README); back = one UPDATE.
-- After the switch, pairs of a text analysis are verified by v12 (v10 decisions are not copied or kept for v12);
-- the whole-base walk stays off.
-- Changed functions (text edits checked by md5 before/after; security definer and config kept):
--   d10_synonym_verifier_version_v1, d10_synonym_lease_pairs_v1, d10_synonym_record_decision_v1,
--   d10_synonym_fit_request_v1, d10_synonym_fit_lease_v1, d10_synonym_copy_decisions_v1, private.synonym_publishable_v1.
-- Config: verifier_contract ('v10' | 'v12', default v10), verifier_thinking; model check accepts gpt-... names.
-- Guards: D10_synonym_shadow_v3 installed, v12 not installed; any md5 difference -> STOP; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_v12_report;
CREATE TEMP TABLE d10_v12_report(part text, name text, info jsonb);
DO $g$
BEGIN
  IF to_regprocedure('public.d10_synonym_shadow_start_v1(integer,integer)') IS NULL
     OR strpos((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.d10_synonym_shadow_start_v1(integer,integer)')), 'shadow_run_in_progress') = 0 THEN
    RAISE EXCEPTION 'STOP: D10_synonym_shadow_v3 is not installed';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'synonym_verifier_config_v1' AND column_name = 'verifier_contract') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_v12_v1 already installed';
  END IF;
  IF to_regprocedure('private.synonym_target_sense_groups_v1(bigint,jsonb)') IS NULL OR to_regprocedure('private.synonym_card_all_translations_v1(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'STOP: eval v2 helper functions not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'synonym_verifier_config_v1_model_check') THEN
    RAISE EXCEPTION 'STOP: model check constraint not found (unexpected schema)';
  END IF;
END
$g$;

ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN verifier_contract text NOT NULL DEFAULT 'v10' CHECK (verifier_contract IN ('v10', 'v12')),
  ADD COLUMN verifier_thinking text CHECK (verifier_thinking IS NULL OR verifier_thinking IN ('minimal', 'none', 'low', 'medium', 'high'));
ALTER TABLE public.synonym_verifier_config_v1 DROP CONSTRAINT synonym_verifier_config_v1_model_check;
ALTER TABLE public.synonym_verifier_config_v1 ADD CONSTRAINT synonym_verifier_config_v1_model_check
  CHECK (model ~ '^(gemini-[a-z0-9.-]+|gpt-[0-9]+(\.[0-9]+)?(-[a-z0-9.-]+)?)$');

DO $mig$
DECLARE r record; e jsonb; v_oid oid; v_def text; v_md5 text; v_n integer; v_sec boolean; v_cfg text[]; v_sec2 boolean; v_cfg2 text[];
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ($r0$public.d10_synonym_verifier_version_v1()$r0$, $b0$8e16238f3c01f398b24661ac9fcd43dd$b0$, $a0$f2e3efa5e407aa222b17b18677a583ba$a0$, $e0$[[" SELECT 'ai:synonym_pair_v10:'||model FROM public.synonym_verifier_config_v1 WHERE singleton", " -- D10_synonym_v12_v1: contract v12 = relation check v11b + rules_v12 (model and thinking level in the version)\n SELECT CASE WHEN verifier_contract = 'v12' THEN 'ai:synonym_pair_v12:'||model||'@'||coalesce(verifier_thinking, 'default')\n   ELSE 'ai:synonym_pair_v10:'||model END FROM public.synonym_verifier_config_v1 WHERE singleton", 1]]$e0$::jsonb),
    ($r1$public.d10_synonym_lease_pairs_v1(integer)$r1$, $b1$25624df9d442a7a8bca759bca74e23f8$b1$, $a1$4d96ff9211c58599587ad4ee14aef2e0$a1$, $e1$[["d.verification_evidence->>'contract' = 'v10'", "d.verification_evidence->>'contract' IN ('v10', 'v12')", 3], ["RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts, p.candidate_id,", "RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts, p.candidate_id, p.target_article_key,", 1], ["'relation_key', u.relation_key,\n", "'relation_key', u.relation_key,\n    -- D10_synonym_v12_v1: v12 sees the target senses grouped by article sense (labels not selectable)\n    'target_groups', CASE WHEN v_cfg.verifier_contract = 'v12' AND u.target_article_key ~ '^[0-9]+$'\n      THEN private.synonym_target_sense_groups_v1(u.target_article_key::bigint, u.snapshot->'target'->'definitions_nb') END,\n", 1], ["'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1());", "'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1(),\n    'contract', v_cfg.verifier_contract, 'thinking', v_cfg.verifier_thinking);", 1]]$e1$::jsonb),
    ($r2$public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)$r2$, $b2$d8088e1ae06b859935c4f9fb33f543b4$b2$, $a2$c7b51b06f5d9f5e7be548e642db56773$a2$, $e2$[["  IF p_verifier_version LIKE 'ai:synonym_pair_v10:%' AND coalesce(p_evidence->>'contract', '') <> 'v10' THEN", "  -- D10_synonym_v12_v1: a v12 decision must come from the v12 verifier\n  IF p_verifier_version LIKE 'ai:synonym_pair_v12:%' AND coalesce(p_evidence->>'contract', '') <> 'v12' THEN\n    RETURN jsonb_build_object('ok', false, 'error', 'OLD_VERIFIER_FOR_V12', 'applied', false, 'stale', true);\n  END IF;\n  IF p_verifier_version LIKE 'ai:synonym_pair_v10:%' AND coalesce(p_evidence->>'contract', '') <> 'v10' THEN", 1], ["    IF p_decision = 'verified_synonym' AND p_verifier_version LIKE 'ai:synonym_pair_v10:%' THEN", "    -- D10_synonym_v12_v1: v12 requests the translation fit for clean AND contextual decisions, on ALL dictionary\n    -- translations of the card (every Lexin variant; AI only where Lexin has none) - no new translations\n    IF (p_decision = 'verified_synonym' AND p_verifier_version LIKE 'ai:synonym_pair_v10:%')\n       OR (p_decision IN ('verified_synonym', 'contextual_synonym') AND p_verifier_version LIKE 'ai:synonym_pair_v12:%') THEN", 1], ["jsonb_build_object('ref', 's', ", "jsonb_build_object('ref', 's', 'all_translations', p_verifier_version LIKE 'ai:synonym_pair_v12:%', ", 1], ["jsonb_build_object('ref', 't', ", "jsonb_build_object('ref', 't', 'all_translations', p_verifier_version LIKE 'ai:synonym_pair_v12:%', ", 1]]$e2$::jsonb),
    ($r3$public.d10_synonym_fit_request_v1(jsonb)$r3$, $b3$4f0528628a2dcccb606dfe0df81c78d3$b3$, $a3$b830a8a01048b088a3d81f6cb76a4696$a3$, $e3$[["    v_tr := private.synonym_card_translations_v1(v_type, v_id);", "    -- D10_synonym_v12_v1: all dictionary translations for v12 requests (the key holds them, so a new evaluation)\n    v_tr := CASE WHEN (r->>'all_translations') = 'true' THEN private.synonym_card_all_translations_v1(v_type, v_id)\n                 ELSE private.synonym_card_translations_v1(v_type, v_id) END;", 1]]$e3$::jsonb),
    ($r4$public.d10_synonym_fit_lease_v1(text[],integer)$r4$, $b4$9840b0d4cdbf5c26e1f85489352b8e14$b4$, $a4$b01da04eaccb850a24b7eec9cf3cae71$a4$, $e4$[["    'model', v_cfg.model);", "    'model', v_cfg.model, 'contract', v_cfg.verifier_contract, 'thinking', v_cfg.verifier_thinking);", 1]]$e4$::jsonb),
    ($r5$public.d10_synonym_copy_decisions_v1(text)$r5$, $b5$61a7eac1066b3b126f41ff1a42043327$b5$, $a5$4f9af35f4e08868771029cad0b019d34$a5$, $e5$[["OR d.verification_evidence->>'contract' = 'v10')", "OR d.verification_evidence->>'contract' IN ('v10', 'v12'))", 1]]$e5$::jsonb),
    ($r6$private.synonym_publishable_v1(public.synonym_pair_v1)$r6$, $b6$dfdb1136ecaee757d6c5f9a7cb068f3e$b6$, $a6$fb1b9d2b8e14f62a6bd4e6919764bfc3$a6$, $e6$[[" SELECT coalesce(p.status='done' AND p.decision='verified_synonym'\n AND (p.verifier_version LIKE 'rule:%' OR (\n", " -- D10_synonym_v12_v1 (04.11.2026, agreed): a v12 decision is published as a clean OR a contextual synonym (the link\n -- carries relation_class); both need replacement in both directions and BOTH translation fits = match. A clean\n -- one also needs the same construction and no restriction. v10 and rule decisions: unchanged (clean only).\n SELECT coalesce(p.status='done'\n AND (p.decision='verified_synonym' OR (p.decision='contextual_synonym' AND p.verifier_version LIKE 'ai:synonym_pair_v12:%'))\n AND (p.verifier_version LIKE 'rule:%'\n   OR (p.verifier_version LIKE 'ai:synonym_pair_v12:%'\n       AND p.verification_evidence->>'substitution_forward'='true'\n       AND p.verification_evidence->>'substitution_reverse'='true'\n       AND (p.decision='contextual_synonym' OR (p.verification_evidence->>'same_construction'='true'\n            AND p.verification_evidence->>'additional_restriction'='false')))\n   OR (p.verifier_version NOT LIKE 'ai:synonym_pair_v12:%' AND\n", 1]]$e6$::jsonb)
  ) t(reg, md5_before, md5_after, edits) LOOP
    v_oid := to_regprocedure(r.reg);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: % not found', r.reg; END IF;
    SELECT md5(replace(p.prosrc, E'\r', '')), p.prosecdef, p.proconfig INTO v_md5, v_sec, v_cfg FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> r.md5_before THEN RAISE EXCEPTION 'STOP: % has md5 %, expected %', r.reg, v_md5, r.md5_before; END IF;
    v_def := replace(pg_get_functiondef(v_oid), E'\r', '');
    FOR e IN SELECT * FROM jsonb_array_elements(r.edits) LOOP
      v_n := (length(v_def) - length(replace(v_def, e->>0, ''))) / length(e->>0);
      IF v_n <> (e->>2)::integer THEN RAISE EXCEPTION 'STOP: % - text found % times, expected %: %', r.reg, v_n, e->>2, left(e->>0, 80); END IF;
      v_def := replace(v_def, e->>0, e->>1);
    END LOOP;
    EXECUTE v_def;
    SELECT md5(replace(p.prosrc, E'\r', '')), p.prosecdef, p.proconfig INTO v_md5, v_sec2, v_cfg2 FROM pg_proc p WHERE p.oid = v_oid;
    IF r.md5_after <> 'COMPUTE' AND v_md5 <> r.md5_after THEN RAISE EXCEPTION 'STOP: % after replace has md5 %, expected %', r.reg, v_md5, r.md5_after; END IF;
    IF v_sec2 IS DISTINCT FROM v_sec OR v_cfg2 IS DISTINCT FROM v_cfg THEN RAISE EXCEPTION 'STOP: % lost security definer / config', r.reg; END IF;
    INSERT INTO d10_v12_report VALUES ('01_function', r.reg, jsonb_build_object('md5_before', r.md5_before, 'md5_after', v_md5));
  END LOOP;
END
$mig$;

-- probes (rolled back): v10 unchanged; switched to v12 the version, the lease answer, a v12 decision with its fit
-- request on all translations, and the publication of a contextual v12 decision
DO $p$
DECLARE v_v10 text; v_v12 text; v_lease jsonb; v_pair record; v_rec jsonb; v_fit record; v_pub boolean; v_pub_ctx boolean; v_old jsonb;
BEGIN
  v_v10 := public.d10_synonym_verifier_version_v1();
  BEGIN
    UPDATE public.synonym_verifier_config_v1 SET verifier_contract = 'v12', model = 'gpt-6-luna', verifier_thinking = 'medium' WHERE singleton;
    v_v12 := public.d10_synonym_verifier_version_v1();
    -- a decided pair is put back to processing to record a v12 decision on it
    SELECT p.id, p.snapshot_hash, p.decision INTO v_pair FROM public.synonym_pair_v1 p
    WHERE p.status = 'done' AND p.target_article_key ~ '^[0-9]+$' AND p.snapshot->'source'->'sense_context' IS NOT NULL
      AND private.synonym_card_ready_v1(p.source_entity_type, p.source_entity_id) AND private.synonym_card_ready_v1(p.target_entity_type, p.target_entity_id)
    ORDER BY p.verified_at DESC NULLS LAST LIMIT 1;
    IF v_pair.id IS NOT NULL THEN
      UPDATE public.synonym_pair_v1 SET status = 'processing', lease_token = '00000000-0000-0000-0000-000000000012', lease_until = now() + interval '1 minute' WHERE id = v_pair.id;
      v_old := public.d10_synonym_record_decision_v1(v_pair.id, '00000000-0000-0000-0000-000000000012', v_pair.snapshot_hash, 'contextual_synonym', 0.9,
        '{"contract":"v10"}'::jsonb, v_v12);
      v_rec := public.d10_synonym_record_decision_v1(v_pair.id, '00000000-0000-0000-0000-000000000012', v_pair.snapshot_hash, 'contextual_synonym', 0.9,
        jsonb_build_object('contract', 'v12', 'matched_text', (SELECT snapshot->'target'->'definitions_nb'->>0 FROM public.synonym_pair_v1 WHERE id = v_pair.id),
          'substitution_forward', true, 'substitution_reverse', true, 'same_construction', true, 'additional_restriction', true,
          'added_component', 'register', 'rule_class', 'contextual_synonym'), v_v12);
      SELECT f.status, f.fit, cardinality(f.tr_uk) AS n_uk, cardinality(f.tr_en) AS n_en INTO v_fit FROM private.synonym_sense_fit_v1 f
      WHERE f.fit_key = (SELECT verification_evidence->>'source_fit_key' FROM public.synonym_pair_v1 WHERE id = v_pair.id);
      -- pretend both fits matched: a contextual v12 decision is publishable
      UPDATE private.synonym_sense_fit_v1 SET status = 'done', fit = 'match',
        tr_uk = CASE WHEN cardinality(tr_uk) = 0 THEN ARRAY['x'] ELSE tr_uk END, tr_en = CASE WHEN cardinality(tr_en) = 0 THEN ARRAY['x'] ELSE tr_en END,
        chosen_uk = coalesce(tr_uk[1], 'x'), chosen_en = coalesce(tr_en[1], 'x') WHERE fit_key IN (
        SELECT verification_evidence->>'source_fit_key' FROM public.synonym_pair_v1 WHERE id = v_pair.id
        UNION SELECT verification_evidence->>'target_fit_key' FROM public.synonym_pair_v1 WHERE id = v_pair.id);
      SELECT private.synonym_publishable_v1(p) INTO v_pub_ctx FROM public.synonym_pair_v1 p WHERE p.id = v_pair.id;
      -- the same with a one-way answer is not publishable
      UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence || '{"substitution_reverse":false}'::jsonb WHERE id = v_pair.id;
      SELECT private.synonym_publishable_v1(p) INTO v_pub FROM public.synonym_pair_v1 p WHERE p.id = v_pair.id;
    END IF;
    v_lease := public.d10_synonym_lease_pairs_v1(1);
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_v12_report VALUES
    ('02_probe', 'version_now (v10, unchanged)', jsonb_build_object('version', v_v10, 'config_now', (SELECT jsonb_build_object('contract', verifier_contract, 'model', model) FROM public.synonym_verifier_config_v1 WHERE singleton))),
    ('02_probe', 'version_after_switch (rolled back)', jsonb_build_object('version', v_v12)),
    ('02_probe', 'v12 version with a v10 answer refused', coalesce(v_old, '{}'::jsonb)),
    ('02_probe', 'v12 contextual decision recorded', coalesce(v_rec, '{}'::jsonb) || jsonb_build_object('pair', v_pair.id)),
    ('02_probe', 'fit requested on all translations', jsonb_build_object('status', v_fit.status, 'tr_uk', v_fit.n_uk, 'tr_en', v_fit.n_en)),
    ('02_probe', 'contextual v12 with both fits = publishable', jsonb_build_object('publishable', v_pub_ctx)),
    ('02_probe', 'one-way v12 = not publishable', jsonb_build_object('publishable', v_pub)),
    ('02_probe', 'lease answer under v12', jsonb_build_object('contract', v_lease->'contract', 'thinking', v_lease->'thinking', 'reason', v_lease->'reason',
      'pairs', jsonb_array_length(coalesce(v_lease->'pairs', '[]'::jsonb)), 'has_target_groups', (v_lease->'pairs'->0) ? 'target_groups'));
END
$p$;
INSERT INTO d10_v12_report SELECT '03_config', 'now', jsonb_build_object('contract', verifier_contract, 'model', model, 'thinking', verifier_thinking,
  'version', public.d10_synonym_verifier_version_v1(), 'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published))
FROM public.synonym_verifier_config_v1 WHERE singleton;
SELECT part, name, info FROM d10_v12_report ORDER BY 1, 2;

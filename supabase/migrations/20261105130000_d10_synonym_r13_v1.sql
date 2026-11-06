-- 20261105130000_d10_synonym_r13_v1.sql
-- D10_synonym_r13_v1 (agreed 05.11.2026): stability of the clean / contextual boundary of the v12 check.
--  * rules r13 = prompt v11c + rules_v13 + a second answer:
--    - prompt v11c asks also register_kind (none | colloquial | formal | literary_or_archaic | regional | technical);
--    - rules_v13: a difference ONLY in how informal the word sounds (colloquial, nothing else added) keeps the pair
--      clean; formal, literary or archaic, regional and technical register always make it contextual;
--    - a pair the rules call clean is asked a second time; clean only if the second answer is clean too; second
--      answer contextual -> contextual; anything else -> manual review. Both answers are stored, so a pair with the
--      same content later reuses them without AI (same input -> same result).
--  * config: verifier_rules ('r12' | 'r13', default r12); r13 only with contract v12.
--  * version: r13 adds ':r13' (ai:synonym_pair_v12:<model>@<thinking>:r13); r12 keeps the version unchanged.
--  * record_decision: an r13 version accepts only an r13 answer and an r12 version only an r12 answer.
-- INSTALLING CHANGES NOTHING: the config stays on r12 until the switch (one UPDATE, see README); back = one UPDATE.
-- Published pairs are not recomputed; the whole-base walk stays off.
-- Changed functions (text edits checked by md5 before/after; security definer and config kept):
--   d10_synonym_verifier_version_v1, d10_synonym_lease_pairs_v1, d10_synonym_record_decision_v1.
-- Guards: D10_synonym_v12_v1, D10_synonym_sibling_context_v1 and D10_synonym_eval_cases_v3 installed; r13 not
-- installed; any md5 difference -> STOP; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_r13_report;
CREATE TEMP TABLE d10_r13_report(part text, name text, info jsonb);
DO $g$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'synonym_verifier_config_v1' AND column_name = 'verifier_contract') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_v12_v1 is not installed';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'synonym_verifier_config_v1' AND column_name = 'verifier_rules') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_r13_v1 already installed';
  END IF;
  IF to_regprocedure('private.synonym_sibling_context_v1(bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_sibling_context_v1 is not installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.synonym_eval_case_v1 WHERE case_id = 'U01') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_eval_cases_v3 is not installed';
  END IF;
END
$g$;

ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN verifier_rules text NOT NULL DEFAULT 'r12' CHECK (verifier_rules IN ('r12', 'r13')),
  ADD CONSTRAINT synonym_verifier_config_v1_rules_contract_check CHECK (verifier_rules = 'r12' OR verifier_contract = 'v12');

DO $mig$
DECLARE r record; e jsonb; v_oid oid; v_def text; v_md5 text; v_n integer; v_sec boolean; v_cfg text[]; v_sec2 boolean; v_cfg2 text[];
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ($r0$public.d10_synonym_verifier_version_v1()$r0$, $b0$f2e3efa5e407aa222b17b18677a583ba$b0$, $a0$e765b04ead8a927fd914822c29e15991$a0$, $e0$[[" SELECT CASE WHEN verifier_contract = 'v12' THEN 'ai:synonym_pair_v12:'||model||'@'||coalesce(verifier_thinking, 'default')\n", " -- D10_synonym_r13_v1: rules r13 (prompt v11c + rules_v13 + second answer) adds ':r13'; rules r12 keeps the version\n SELECT CASE WHEN verifier_contract = 'v12' THEN 'ai:synonym_pair_v12:'||model||'@'||coalesce(verifier_thinking, 'default')\n     ||CASE WHEN verifier_rules = 'r13' THEN ':r13' ELSE '' END\n", 1]]$e0$::jsonb),
    ($r1$public.d10_synonym_lease_pairs_v1(integer)$r1$, $b1$4d96ff9211c58599587ad4ee14aef2e0$b1$, $a1$d9c8ecb887fcb395d2bbdc0827ae5466$a1$, $e1$[["    'contract', v_cfg.verifier_contract, 'thinking', v_cfg.verifier_thinking);", "    'contract', v_cfg.verifier_contract, 'thinking', v_cfg.verifier_thinking,\n    -- D10_synonym_r13_v1: rules of the check (r12 | r13)\n    'rules', v_cfg.verifier_rules);", 1]]$e1$::jsonb),
    ($r2$public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)$r2$, $b2$c7b51b06f5d9f5e7be548e642db56773$b2$, $a2$a0ce223fcdd951ae8028be12a12ff242$a2$, $e2$[["  IF p_verifier_version LIKE 'ai:synonym_pair_v10:%' AND coalesce(p_evidence->>'contract', '') <> 'v10' THEN", "  -- D10_synonym_r13_v1: an r13 version needs an r13 answer, an r12 version an r12 answer (old edge function or old lease)\n  IF p_verifier_version LIKE 'ai:synonym_pair_v12:%' AND (p_verifier_version LIKE '%:r13') <> (coalesce(p_evidence->>'rules', '') = 'rules_v13') THEN\n    RETURN jsonb_build_object('ok', false, 'error', 'RULES_MISMATCH', 'applied', false, 'stale', true);\n  END IF;\n  IF p_verifier_version LIKE 'ai:synonym_pair_v10:%' AND coalesce(p_evidence->>'contract', '') <> 'v10' THEN", 1]]$e2$::jsonb)
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
    INSERT INTO d10_r13_report VALUES ('01_function', r.reg, jsonb_build_object('md5_before', r.md5_before, 'md5_after', v_md5));
  END LOOP;
END
$mig$;

-- probes (rolled back): r12 unchanged; switched to r13 the version, the lease answer, the rules check of
-- record_decision, a recorded r13 clean decision; r13 with contract v10 is refused
DO $p$
DECLARE v_now text; v_r13 text; v_lease jsonb; v_pair record; v_ok jsonb; v_bad1 jsonb; v_bad2 jsonb; v_v10 text := 'not refused';
  v_ev jsonb := '{"contract":"v12","rules":"rules_v13","substitution_forward":true,"substitution_reverse":true,"same_construction":true,"additional_restriction":false,"register_kind":"colloquial","first_class":"verified_synonym","vote_class":"verified_synonym"}';
BEGIN
  v_now := public.d10_synonym_verifier_version_v1();
  BEGIN
    UPDATE public.synonym_verifier_config_v1 SET verifier_contract = 'v12', verifier_rules = 'r13' WHERE singleton;
    v_r13 := public.d10_synonym_verifier_version_v1();
    SELECT p.id, p.snapshot_hash INTO v_pair FROM public.synonym_pair_v1 p
    WHERE p.status = 'done' AND p.target_article_key ~ '^[0-9]+$' AND p.snapshot->'source'->'sense_context' IS NOT NULL
    ORDER BY p.verified_at DESC NULLS LAST LIMIT 1;
    IF v_pair.id IS NOT NULL THEN
      UPDATE public.synonym_pair_v1 SET status = 'processing', lease_token = '00000000-0000-0000-0000-000000000013', lease_until = now() + interval '1 minute' WHERE id = v_pair.id;
      v_bad1 := public.d10_synonym_record_decision_v1(v_pair.id, '00000000-0000-0000-0000-000000000013', v_pair.snapshot_hash, 'verified_synonym', 0.9,
        v_ev || '{"rules":"rules_v12"}'::jsonb, v_r13);
      v_bad2 := public.d10_synonym_record_decision_v1(v_pair.id, '00000000-0000-0000-0000-000000000013', v_pair.snapshot_hash, 'verified_synonym', 0.9,
        v_ev, v_now);
      v_ok := public.d10_synonym_record_decision_v1(v_pair.id, '00000000-0000-0000-0000-000000000013', v_pair.snapshot_hash, 'verified_synonym', 0.9,
        v_ev || jsonb_build_object('matched_text', (SELECT snapshot->'target'->'definitions_nb'->>0 FROM public.synonym_pair_v1 WHERE id = v_pair.id)), v_r13);
    END IF;
    v_lease := public.d10_synonym_lease_pairs_v1(1);
    BEGIN
      UPDATE public.synonym_verifier_config_v1 SET verifier_contract = 'v10' WHERE singleton;
    EXCEPTION WHEN check_violation THEN v_v10 := 'refused';
    END;
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_r13_report VALUES
    ('02_probe', 'a version_now (unchanged)', jsonb_build_object('version', v_now)),
    ('02_probe', 'b version_after_switch_to_r13 (rolled back)', jsonb_build_object('version', v_r13)),
    ('02_probe', 'c r13 version with an r12 answer refused', coalesce(v_bad1, '{}'::jsonb)),
    ('02_probe', 'd r12 version with an r13 answer refused', coalesce(v_bad2, '{}'::jsonb)),
    ('02_probe', 'e r13 clean decision recorded', coalesce(v_ok, '{}'::jsonb) || jsonb_build_object('pair', v_pair.id)),
    ('02_probe', 'f lease answer under r13', jsonb_build_object('rules', v_lease->'rules', 'contract', v_lease->'contract', 'reason', v_lease->'reason')),
    ('02_probe', 'g r13 with contract v10', jsonb_build_object('result', v_v10));
END
$p$;
INSERT INTO d10_r13_report SELECT '03_config', 'now', jsonb_build_object('contract', verifier_contract, 'rules', verifier_rules, 'model', model,
  'thinking', verifier_thinking, 'version', public.d10_synonym_verifier_version_v1(),
  'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published))
FROM public.synonym_verifier_config_v1 WHERE singleton;
SELECT part, name, info FROM d10_r13_report ORDER BY 1, 2;

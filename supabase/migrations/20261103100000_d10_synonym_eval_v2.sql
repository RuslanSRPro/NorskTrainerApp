-- 20261103100000_d10_synonym_eval_v2.sql
-- D10_synonym_eval_v2 (agreed 03.11.2026 after review): test harness only. Production decisions, translations and
-- publication do NOT change (the verifier keeps v10 / sense_fit_v1).
--  * private.synonym_card_all_translations_v1: ALL dictionary translations of a card (every Lexin variant; an AI
--    translation only for a language without a dictionary one) for the eval translation check - nothing is created;
--  * private.synonym_target_sense_groups_v1: target definitions grouped by article sense, labels not selectable;
--  * per-stage expectations on private.synonym_eval_case_v1 (status proposed / confirmed / disputed) and 12 hold-out
--    cases that are not mentioned in the instruction;
--  * public.d10_synonym_eval_cases_v2 for the eval mode v11b.
-- Guards: D10_synonym_eval_v1 installed, v2 not installed; reinstall -> STOP. Only test objects are added.

DROP TABLE IF EXISTS pg_temp.d10_eval2_report;
CREATE TEMP TABLE d10_eval2_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regclass('private.synonym_eval_case_v1') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_eval_v1 is not installed'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'private' AND table_name = 'synonym_eval_case_v1' AND column_name = 'case_set') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_eval_v2 already installed';
  END IF;
  IF to_regprocedure('private.synonym_target_senses_v1(bigint,jsonb)') IS NULL THEN RAISE EXCEPTION 'STOP: private.synonym_target_senses_v1 not found'; END IF;
END
$mig$;

-- ALL dictionary translations of the card behind an entity (every Lexin variant, manual ones too); an AI
-- translation only for a language with no dictionary translation (the same rule as the card display). Nothing is
-- created or changed; used by the eval mode for the translation-fit check.
CREATE OR REPLACE FUNCTION private.synonym_card_all_translations_v1(p_type text, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH card AS (SELECT CASE WHEN p_type = 'expression' THEN (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id = p_id) ELSE p_id END AS id),
  rows AS (
    SELECT t.language_code AS lang, btrim(coalesce(nullif(btrim(t.canonical_translation), ''), t.translation)) AS tr, t.source,
      coalesce(t.sense_rank, 999) AS sr, coalesce(t.translation_rank, 999) AS trk, t.id
    FROM public.entity_translations t, card
    WHERE t.lexeme_id = card.id AND t.expression_id IS NULL
      AND t.language_code IN ('uk', 'en') AND t.translation_type IN ('primary', 'expression_primary')
      AND nullif(btrim(t.translation), '') IS NOT NULL
    UNION ALL
    SELECT t.language_code, btrim(coalesce(nullif(btrim(t.canonical_translation), ''), t.translation)), t.source,
      coalesce(t.sense_rank, 999), coalesce(t.translation_rank, 999), t.id
    FROM public.expression_catalog x JOIN card ON x.lexeme_id = card.id
    JOIN public.entity_translations t ON t.expression_id = x.id AND t.lexeme_id IS NULL
    WHERE t.language_code IN ('uk', 'en') AND t.translation_type IN ('primary', 'expression_primary')
      AND nullif(btrim(t.translation), '') IS NOT NULL
  ), kept AS (
    SELECT r.* FROM rows r
    WHERE r.source IS DISTINCT FROM 'ai_fallback'
       OR NOT EXISTS (SELECT 1 FROM rows o WHERE o.lang = r.lang AND o.source IS DISTINCT FROM 'ai_fallback')
  ), dedup AS (
    SELECT DISTINCT ON (lang, lower(tr)) lang, tr, (source = 'ai_fallback') AS ai, sr, trk, id FROM kept
    ORDER BY lang, lower(tr), (source = 'ai_fallback'), sr, trk, id
  )
  SELECT jsonb_build_object(
    'uk', coalesce((SELECT jsonb_agg(tr ORDER BY ai, sr, trk, id) FROM dedup WHERE lang = 'uk'), '[]'::jsonb),
    'en', coalesce((SELECT jsonb_agg(tr ORDER BY ai, sr, trk, id) FROM dedup WHERE lang = 'en'), '[]'::jsonb),
    'card', (SELECT id FROM card));
$f$;
REVOKE ALL ON FUNCTION private.synonym_card_all_translations_v1(text, uuid) FROM PUBLIC;
-- the target definitions grouped by sense (one entry per sense path of the Ordbokene article): the numbered
-- definitions of the sense, which of them can be chosen (labels like "brukt som", "jf.", "motsatt" cannot), and the
-- sense's examples. Definitions not found in the article form their own sense.
CREATE OR REPLACE FUNCTION private.synonym_target_sense_groups_v1(p_article bigint, p_defs jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH s AS (SELECT x FROM jsonb_array_elements(private.synonym_target_senses_v1(p_article, p_defs)) x),
  g AS (
    SELECT coalesce(x->>'path', 'n' || (x->>'n')) AS sense, min((x->>'n')::int) AS first_n,
      jsonb_agg(jsonb_build_object('n', (x->>'n')::int, 'text', x->>'text',
        'selectable', NOT ((x->>'text') ~* '^\s*(brukt\M|jf\.|jfr\.|motsatt\M|se\M|i uttrykk\M)')) ORDER BY (x->>'n')::int) AS definitions,
      (array_agg(x->'examples' ORDER BY (x->>'n')::int))[1] AS examples
    FROM s GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('sense', g.sense, 'definitions', g.definitions, 'examples', coalesce(g.examples, '[]'::jsonb))
    ORDER BY g.first_n), '[]'::jsonb) FROM g;
$f$;
REVOKE ALL ON FUNCTION private.synonym_target_sense_groups_v1(bigint, jsonb) FROM PUBLIC;
-- per-stage expectations; every expectation is 'proposed' until confirmed by a person (exp_status = 'confirmed')
ALTER TABLE private.synonym_eval_case_v1
  ADD COLUMN case_set text NOT NULL DEFAULT 'regression' CHECK (case_set IN ('regression', 'holdout')),
  ADD COLUMN exp_target_sense text,      -- expected chosen definition(s), '|' separated; '-1' = none matches; NULL = not checked
  ADD COLUMN exp_class text,             -- allowed final categories, '|' separated; 'not_verified' = anything but verified; NULL = not checked
  ADD COLUMN exp_fit_source text CHECK (exp_fit_source IN ('match', 'no_match')),
  ADD COLUMN exp_fit_target text CHECK (exp_fit_target IN ('match', 'no_match')),
  ADD COLUMN exp_publish boolean,
  ADD COLUMN exp_status text NOT NULL DEFAULT 'proposed' CHECK (exp_status IN ('proposed', 'confirmed', 'disputed'));

UPDATE private.synonym_eval_case_v1 c SET exp_target_sense = v.ts, exp_class = v.cl, exp_fit_source = v.fs, exp_fit_target = v.ft,
  exp_publish = v.pb, exp_status = v.st
FROM (VALUES
  ('E1', '-1|storbygd, tykk, kraftig, klumpete|sammensatt av store deler eller partikler', 'not_verified', NULL, NULL, false, 'proposed'),
  ('E2', 'snakke mye, la munnen g' || chr(229), 'one_way_synonym|contextual_synonym', NULL, NULL, false, 'proposed'),
  ('E3', 'tulle, t' || chr(248) || 'yse, vr' || chr(248) || 'vle|snakke usant', NULL, 'no_match', NULL, false, 'proposed'),
  ('C1', 'stor', 'verified_synonym', 'match', 'match', true, 'proposed'),
  ('C2', 'diger, dryg, sv' || chr(230) || 'r', 'verified_synonym', 'match', 'match', true, 'proposed'),
  ('C3', 'kreve', 'verified_synonym', 'match', 'match', true, 'proposed'),
  ('C4', 'god, brukbar, tjenlig', 'verified_synonym', 'match', 'match', true, 'proposed'),
  ('C5', '(underholdende) samtale', 'verified_synonym', 'match', 'match', true, 'proposed'),
  ('C6', 'dum, ubegavet person', 'verified_synonym|contextual_synonym', 'match', 'match', NULL, 'disputed'),
  ('C7', 'plukke eller sanke sammen', 'verified_synonym|contextual_synonym|one_way_synonym', NULL, 'match', NULL, 'disputed'),
  ('N1', 'ta noe som tilh' || chr(248) || 'rer en annen', NULL, 'no_match', 'match', false, 'proposed'),
  ('N2', NULL, 'not_verified', 'no_match', NULL, false, 'proposed'),
  ('N3', 'stjele noe av mindre verdi', 'one_way_synonym|contextual_synonym', NULL, NULL, false, 'proposed'),
  ('N4', 'sv' || chr(230) || 'rt god', 'contextual_synonym|one_way_synonym', NULL, NULL, false, 'proposed'),
  ('N5', NULL, 'not_verified', NULL, NULL, false, 'proposed')
) v(id, ts, cl, fs, ft, pb, st) WHERE c.case_id = v.id;

-- hold-out cases: not mentioned in the instruction; expectations are proposals to confirm
INSERT INTO private.synonym_eval_case_v1 (case_id, label, case_set, source_lemma, target_lemma, expected, note, exp_class, exp_publish, exp_status) VALUES
  ('H01', 'holdout', 'holdout', 'rask', 'kvikk', 'verified', 'rask "hurtig"', 'verified_synonym', true, 'proposed'),
  ('H02', 'holdout', 'holdout', 'tok', 'tulling', 'verified', NULL, 'verified_synonym', true, 'proposed'),
  ('H03', 'holdout', 'holdout', 'kreve', 'koste', 'not_verified', 'kreve "koste": requires (time, money) vs costs', 'contextual_synonym|one_way_synonym|near_synonym', false, 'proposed'),
  ('H04', 'holdout', 'holdout', 'god', 'velluktende', 'not_verified', 'god "velsmakende, velluktende" covers taste and smell', 'one_way_synonym|contextual_synonym|near_synonym', false, 'proposed'),
  ('H05', 'holdout', 'holdout', 'prate', 'passiare', 'not_verified', 'passiare = chat leisurely (manner)', 'one_way_synonym|contextual_synonym', false, 'proposed'),
  ('H06', 'holdout', 'holdout', 'ta', 'erobre', 'disputed', 'ta "erobre": ta byen / erobre byen', NULL, NULL, 'disputed'),
  ('H07', 'holdout', 'holdout', 'ta', 'fange', 'disputed', NULL, NULL, NULL, 'disputed'),
  ('H08', 'holdout', 'holdout', 'god', 'gagnlig', 'disputed', NULL, NULL, NULL, 'disputed'),
  ('H09', 'holdout', 'holdout', 'stor', 'omfattende', 'disputed', NULL, NULL, NULL, 'disputed'),
  ('H10', 'holdout', 'holdout', 'svaer', 'diger', 'disputed', 'diger = svaert stor? (intensity)', NULL, NULL, 'disputed'),
  ('H11', 'holdout', 'holdout', 'vanskelig', 'komplisert', 'disputed', NULL, NULL, NULL, 'disputed'),
  ('H12', 'holdout', 'holdout', 'enkel', 'grei', 'disputed', NULL, NULL, NULL, 'disputed');
UPDATE private.synonym_eval_case_v1 SET source_lemma = 'sv' || chr(230) || 'r', note = 'diger = sv' || chr(230) || 'rt stor? (intensity)' WHERE case_id = 'H10';

-- cases for the v11b test: grouped target senses, the source sense with its section neighbours marked as
-- "other senses", ALL dictionary translations of both cards (no new translations), per-stage expectations
CREATE OR REPLACE FUNCTION public.d10_synonym_eval_cases_v2()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  SELECT coalesce(jsonb_agg(jsonb_build_object('case_id', c.case_id, 'case_set', c.case_set, 'source_lemma', c.source_lemma,
    'target_lemma', c.target_lemma, 'found', p.id IS NOT NULL, 'pair_id', p.id, 'snapshot', p.snapshot,
    'expect', jsonb_build_object('target_sense', c.exp_target_sense, 'class', c.exp_class, 'fit_source', c.exp_fit_source,
      'fit_target', c.exp_fit_target, 'publish', c.exp_publish, 'status', c.exp_status),
    'target_groups', CASE WHEN p.target_article_key ~ '^[0-9]+$' THEN private.synonym_target_sense_groups_v1(p.target_article_key::bigint, p.snapshot->'target'->'definitions_nb') ELSE '[]'::jsonb END,
    'current', jsonb_build_object('decision', p.decision, 'published', p.published, 'matched_text', p.verification_evidence->>'matched_text'),
    'source_card', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('lemma', p.snapshot->'source'->>'lemma', 'pos', p.snapshot->'source'->>'part_of_speech',
      'sense', coalesce(nullif(btrim(p.snapshot->'source'->'sense_context'->>'focus_gloss'), ''), p.snapshot->'source'->>'definition_nb'),
      'tr', private.synonym_card_all_translations_v1(p.source_entity_type, p.source_entity_id) - 'card') END,
    'target_card', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('lemma', p.snapshot->'target'->>'lemma', 'pos', p.snapshot->'target'->>'part_of_speech',
      'tr', private.synonym_card_all_translations_v1(p.target_entity_type, p.target_entity_id) - 'card') END)
    ORDER BY c.case_id), '[]'::jsonb)
  FROM private.synonym_eval_case_v1 c
  LEFT JOIN LATERAL (SELECT q.* FROM public.synonym_pair_v1 q
    WHERE q.snapshot->'source'->>'lemma' = c.source_lemma AND q.snapshot->'target'->>'lemma' = c.target_lemma
      AND q.status IN ('done', 'queued', 'retry_wait', 'needs_manual_review') AND q.decision IS NOT NULL
    ORDER BY (q.status = 'done') DESC, q.verified_at DESC NULLS LAST LIMIT 1) p ON true;
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_eval_cases_v2() FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN GRANT EXECUTE ON FUNCTION public.d10_synonym_eval_cases_v2() TO service_role; END IF;
END $g$;

INSERT INTO d10_eval2_report SELECT '01_case', x->>'case_id' || ' ' || (x->>'source_lemma') || ' -> ' || (x->>'target_lemma'),
  jsonb_build_object('set', x->'case_set', 'found', x->'found', 'expect', x->'expect', 'target_senses', jsonb_array_length(coalesce(x->'target_groups', '[]'::jsonb)),
    'tr_source_all', jsonb_build_object('uk', jsonb_array_length(coalesce(x->'source_card'->'tr'->'uk', '[]'::jsonb)), 'en', jsonb_array_length(coalesce(x->'source_card'->'tr'->'en', '[]'::jsonb))),
    'tr_target_all', jsonb_build_object('uk', jsonb_array_length(coalesce(x->'target_card'->'tr'->'uk', '[]'::jsonb)), 'en', jsonb_array_length(coalesce(x->'target_card'->'tr'->'en', '[]'::jsonb))))
FROM jsonb_array_elements(public.d10_synonym_eval_cases_v2()) x;

SELECT part, name, info FROM d10_eval2_report ORDER BY 1, 2;

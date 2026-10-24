-- D10 24.10.2026 (agreed): a noun WITHOUT an Ordbøkene article of its part of
-- speech is divided by its NAOB articles with the same rule as Ordbøkene
-- homographs (R8 one card / R9 own card / review). brenne (noun):
--   brenne_2 "avsvidd skoggrunn" -> main card, brenne_3 "ved til brensel"
--   -> brenne II, brenne_4 "brennende følelse" -> brenne III.
-- A word with an Ordbøkene article of this part of speech is not touched.
--   1. private.d10_naob_homograph_cards_v1   card <-> NAOB article (slug)
--   2. private.d10_job_naob_split_v1          per job: word already divided
--   3. d10_naob_split_candidates_for_job_v1   nouns of a job to divide
--   4. d10_record_naob_homograph_v1           records a decision, creates
--                                             the second card (II, III...)
--   5. d10_naob_card_binding_v1               the article of a card (AI, forms)
--   6. d10_mark_naob_split_done_v1
--   7. d10_promote_gray_pos_clones_v1: an injected second card item is linked
--      to ITS card (homograph key), not to the main card. Point change.
-- Adds only; re-running is safe.

CREATE TABLE IF NOT EXISTS private.d10_naob_homograph_cards_v1 (
  main_lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[A-Za-z0-9%._-]+$'),
  decision text NOT NULL CHECK (decision IN ('main_article', 'r9_card', 'r8_same_forms', 'skipped')),
  hgno integer,
  card_lexeme_id uuid REFERENCES public.lexemes(id) ON DELETE SET NULL,
  definition text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_id uuid,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (main_lexeme_id, slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS d10_naob_homograph_cards_v1_card_idx
  ON private.d10_naob_homograph_cards_v1 (card_lexeme_id) WHERE card_lexeme_id IS NOT NULL;
ALTER TABLE private.d10_naob_homograph_cards_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_naob_homograph_cards_v1 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.d10_job_naob_split_v1 (
  job_id uuid NOT NULL,
  lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, lexeme_id)
);
ALTER TABLE private.d10_job_naob_split_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_job_naob_split_v1 FROM PUBLIC, anon, authenticated;

-- Nouns of the job (main cards) without Ordbøkene or compound forms, not yet
-- divided in this job.
CREATE OR REPLACE FUNCTION public.d10_naob_split_candidates_for_job_v1(p_job_id uuid, p_limit integer DEFAULT 3)
RETURNS TABLE(lexeme_id uuid, lemma text, pos text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT DISTINCT l.id, l.lemma, l.pos
  FROM public.lexeme_processing_items i
  JOIN public.lexemes l ON l.id = i.lexeme_id
  WHERE i.job_id = p_job_id AND i.match_type = 'token'
    AND i.current_stage = 'semantic_audit'
    AND l.pos = 'noun' AND coalesce(l.homograph_key, '') = ''
    AND l.dictionary_status IS DISTINCT FROM 'excluded'
    AND NOT EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM private.d10_job_naob_split_v1 s WHERE s.job_id = p_job_id AND s.lexeme_id = l.id)
  ORDER BY l.lemma, l.id
  LIMIT greatest(1, least(coalesce(p_limit, 3), 20));
$body$;

CREATE OR REPLACE FUNCTION public.d10_record_naob_homograph_v1(
  p_main_lexeme_id uuid, p_slug text, p_decision text, p_hgno integer,
  p_definition text, p_evidence jsonb, p_job_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_main public.lexemes%rowtype;
  v_row record;
  v_card uuid;
  v_key text;
  n integer;
BEGIN
  SELECT * INTO v_main FROM public.lexemes WHERE id = p_main_lexeme_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAOB_HOMOGRAPH_MAIN_NOT_FOUND'; END IF;
  IF coalesce(v_main.homograph_key, '') <> '' OR v_main.pos IS DISTINCT FROM 'noun' THEN
    RAISE EXCEPTION 'NAOB_HOMOGRAPH_MAIN_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = p_main_lexeme_id) THEN
    RAISE EXCEPTION 'NAOB_HOMOGRAPH_MAIN_HAS_ORDBOKENE_FORMS';
  END IF;
  IF p_decision NOT IN ('main_article', 'r9_card', 'r8_same_forms', 'skipped') THEN
    RAISE EXCEPTION 'NAOB_HOMOGRAPH_DECISION_INVALID';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9%._-]+$' THEN
    RAISE EXCEPTION 'NAOB_HOMOGRAPH_SLUG_INVALID';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d10_naob_homograph:' || p_main_lexeme_id::text, 0));

  -- the same article decided before: its card (idempotent)
  SELECT * INTO v_row FROM private.d10_naob_homograph_cards_v1 c
  WHERE c.main_lexeme_id = p_main_lexeme_id AND c.slug = p_slug;
  IF FOUND THEN
    RETURN v_row.card_lexeme_id;
  END IF;

  IF p_decision = 'main_article' THEN
    IF EXISTS (SELECT 1 FROM private.d10_naob_homograph_cards_v1 c
               WHERE c.main_lexeme_id = p_main_lexeme_id AND c.decision = 'main_article') THEN
      RAISE EXCEPTION 'NAOB_HOMOGRAPH_MAIN_ALREADY_BOUND';
    END IF;
    v_card := p_main_lexeme_id;
  ELSIF p_decision = 'r9_card' THEN
    IF to_regclass('public.lexemes_lemma_pos_unique') IS NOT NULL THEN
      RAISE EXCEPTION 'HOMOGRAPH_CARDS_NOT_ENABLED';
    END IF;
    -- next free Roman key of this lemma and part of speech (II, III, ...)
    FOR n IN 2..10 LOOP
      v_key := public.d10_roman_v1(n);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lexemes l
                            WHERE l.lemma = v_main.lemma AND l.pos = v_main.pos AND l.homograph_key = v_key);
      v_key := NULL;
    END LOOP;
    IF v_key IS NULL THEN RAISE EXCEPTION 'NAOB_HOMOGRAPH_NO_FREE_KEY'; END IF;
    INSERT INTO public.lexemes (lemma, pos, homograph_key, display_form, source,
      dictionary_status, is_learning_lexeme, status,
      verification_status, verification_tier, source_verified,
      verification_evidence, verification_version, last_verification_run)
    VALUES (v_main.lemma, v_main.pos, v_key, v_main.lemma, 'd10_naob_homograph_card',
      'active', true, 'New',
      v_main.verification_status, v_main.verification_tier, v_main.source_verified,
      v_main.verification_evidence, v_main.verification_version, 'd10-naob-homograph-card-v1')
    RETURNING id INTO v_card;
  END IF;

  INSERT INTO private.d10_naob_homograph_cards_v1 (
    main_lexeme_id, slug, decision, hgno, card_lexeme_id, definition, evidence, job_id)
  VALUES (p_main_lexeme_id, p_slug, p_decision, p_hgno, v_card,
    nullif(left(btrim(coalesce(p_definition, '')), 1000), ''), coalesce(p_evidence, '{}'::jsonb), p_job_id);

  RETURN v_card;
END
$body$;

CREATE OR REPLACE FUNCTION public.d10_naob_card_binding_v1(p_lexeme_id uuid)
RETURNS TABLE(slug text, definition text, main_lexeme_id uuid, decision text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT c.slug, c.definition, c.main_lexeme_id, c.decision
  FROM private.d10_naob_homograph_cards_v1 c
  WHERE c.card_lexeme_id = p_lexeme_id AND c.decision IN ('main_article', 'r9_card')
  LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION public.d10_mark_naob_split_done_v1(p_job_id uuid, p_lexeme_id uuid, p_result jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  INSERT INTO private.d10_job_naob_split_v1 (job_id, lexeme_id, result)
  VALUES (p_job_id, p_lexeme_id, coalesce(p_result, '{}'::jsonb))
  ON CONFLICT (job_id, lexeme_id) DO UPDATE SET result = excluded.result, done_at = now();
$body$;

REVOKE ALL ON FUNCTION public.d10_naob_split_candidates_for_job_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_record_naob_homograph_v1(uuid, text, text, integer, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_naob_card_binding_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_mark_naob_split_done_v1(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_naob_split_candidates_for_job_v1(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_record_naob_homograph_v1(uuid, text, text, integer, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_naob_card_binding_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_mark_naob_split_done_v1(uuid, uuid, jsonb) TO service_role;

-- 7. An injected second card item (result_summary.homograph_key = 'II') is
-- linked to the card with that key; any other item as before (main first).
do $patch$
declare
  v_def text := pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure);
  v_old text := $o$order by (coalesce(l.homograph_key, '') = '') desc, l.created_at nulls last, l.id$o$;
  v_new text := $n$order by (coalesce(l.homograph_key, '') = coalesce(v_item.result_summary->>'homograph_key', '')) desc,
             (coalesce(l.homograph_key, '') = '') desc, l.created_at nulls last, l.id$n$;
  v_count integer;
begin
  if position('d10_gray_existing_card_v2' in v_def) = 0 then
    raise exception 'd10_promote_gray_pos_clones_v1 is not the D10_r9_evidence version; nothing changed';
  end if;
  if position($m$coalesce(v_item.result_summary->>'homograph_key', '')$m$ in v_def) > 0 then
    raise notice 'grey link by homograph key already installed';
    return;
  end if;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 1 then
    raise exception 'anchor found % times in d10_promote_gray_pos_clones_v1 (expected 1); nothing changed', v_count;
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

do $$ begin raise notice 'd10 naob homographs v1 installed'; end $$;

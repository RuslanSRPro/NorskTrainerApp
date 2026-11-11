-- D10_problem_cards_cache_v1 (11.11.2026, after 437 ran into an upstream timeout):
-- The app's problem list (d10_problem_cards_v4 + d10_problem_cards_count_v3) recomputed canonical translations
-- of EVERY learning card on each call, twice per load, and the app reloads it on every screen open and after every
-- job: a heavy disk-IO load and an empty list in the app (the call timed out).
-- Now:
--  1. private.d10_problem_cards_cache_v1 holds the problem cards (same columns as before).
--  2. private.d10_problem_cards_chunk_v1(ids) = the old computation for a given set of cards only.
--  3. private.d10_problem_cards_refresh_step_v1() refreshes the cache in small steps: first the cards touched by
--     jobs since the last step (fresh problems appear within minutes), then the next page of all cards in id order
--     (a full cycle over the base, again and again). Cards outside learning are included now (agreed 10.11:
--     the list is a list of problem words, not of learning cards); excluded cards are not.
--  4. cron 'd10-problem-cards-refresh' every 2 minutes, 25 s statement limit, skipped if a step is still running.
--  5. d10_problem_cards_v4 / d10_problem_cards_count_v3 read the cache (same signature, same order) - fast.
-- The cache starts empty and fills step by step (recent cards first). Nothing else changes.

CREATE TABLE IF NOT EXISTS private.d10_problem_cards_cache_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  lemma text, pos text, display_form text, homograph_key text,
  missing_translation boolean NOT NULL DEFAULT false, missing_example boolean NOT NULL DEFAULT false,
  review_reason text, legacy boolean NOT NULL DEFAULT false,
  deferred_by_policy boolean NOT NULL DEFAULT false, deferred_facets text[],
  synonym_status text, synonym_checked_at timestamptz,
  refreshed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS d10_problem_cards_cache_order_v1 ON private.d10_problem_cards_cache_v1
  (missing_translation DESC, lemma, lexeme_id);
REVOKE ALL ON private.d10_problem_cards_cache_v1 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.d10_problem_cards_cursor_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_id uuid, last_run_at timestamptz, cycles integer NOT NULL DEFAULT 0, last_report jsonb);
INSERT INTO private.d10_problem_cards_cursor_v1 (singleton) VALUES (true) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.d10_problem_cards_cursor_v1 FROM PUBLIC, anon, authenticated;

-- 2. the old computation (private.d10_problem_cards_all_v4) restricted to the given cards
CREATE OR REPLACE FUNCTION private.d10_problem_cards_chunk_v1(p_ids uuid[])
RETURNS TABLE(lexeme_id uuid,lemma text,pos text,display_form text,homograph_key text,
 missing_translation boolean,missing_example boolean,review_reason text,legacy boolean,
 deferred_by_policy boolean,deferred_facets text[],synonym_status text,synonym_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
WITH learning AS MATERIALIZED (SELECT l.* FROM public.lexemes l
 WHERE l.id = ANY (p_ids) AND coalesce(l.dictionary_status, 'active') <> 'excluded'),
 translated AS MATERIALIZED (
 SELECT t.lexeme_id,bool_or(t.language_code='uk') uk,bool_or(t.language_code='en') en
 FROM public.get_canonical_lexeme_translations_v1((SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM learning)) t
 WHERE nullif(btrim(t.translation),'') IS NOT NULL GROUP BY t.lexeme_id),
 cards AS MATERIALIZED (
 SELECT l.*,NOT(coalesce(tr.uk,false) AND coalesce(tr.en,false)) missing_translation,
 NOT EXISTS(SELECT 1 FROM public.entity_examples e WHERE e.language_code='nb'
 AND e.example_text ~ '[[:alpha:]]' AND e.example_text !~* '^[[:space:]]*(https?://|<)'
 AND ((e.lexeme_id=l.id AND e.expression_id IS NULL) OR EXISTS(
 SELECT 1 FROM public.expression_catalog x WHERE x.id=e.expression_id AND x.lexeme_id=l.id))) missing_example
 FROM learning l LEFT JOIN translated tr ON tr.lexeme_id=l.id),
 base AS MATERIALIZED (
 SELECT c.id lexeme_id,c.lemma,c.pos,c.display_form,coalesce(c.homograph_key,'') homograph_key,
 c.missing_translation,c.missing_example,r.reason review_reason,coalesce(c.pos,'unknown')='unknown' legacy,
 d.lexeme_id IS NOT NULL deferred_by_policy,d.facets deferred_facets
 FROM cards c LEFT JOIN private.d10_ai_review_rejections_v1 r ON r.lexeme_id=c.id
 LEFT JOIN private.d10_deferred_enrichment_v1 d ON d.lexeme_id=c.id
 WHERE c.missing_translation OR c.missing_example OR d.lexeme_id IS NOT NULL),
 states AS MATERIALIZED (
  SELECT DISTINCT ON (card_id) card_id,state
  FROM (SELECT CASE WHEN s.entity_type='lexeme' THEN s.entity_id ELSE x.lexeme_id END card_id,
     public.d10_synonym_entity_status_v1(s.entity_type,s.entity_id) state
   FROM private.synonym_collection_state_v1 s
   LEFT JOIN public.expression_catalog x ON s.entity_type='expression' AND x.id=s.entity_id
   WHERE (s.entity_type='lexeme' AND s.entity_id = ANY (p_ids))
      OR (s.entity_type='expression' AND x.lexeme_id = ANY (p_ids))) q
  WHERE card_id IS NOT NULL ORDER BY card_id,CASE state->>'status' WHEN 'error' THEN 0 WHEN 'waiting' THEN 1 WHEN 'deferred' THEN 2 ELSE 3 END
 ), ids AS (
  SELECT b.lexeme_id id FROM base b UNION SELECT card_id FROM states WHERE state->>'status' IN ('error','waiting','deferred')
 )
 SELECT l.id,l.lemma,l.pos,l.display_form,coalesce(l.homograph_key,''),
  coalesce(b.missing_translation,false),coalesce(b.missing_example,false),b.review_reason,coalesce(b.legacy,false),
  coalesce(b.deferred_by_policy,false),b.deferred_facets,s.state->>'status',(s.state->>'checked_at')::timestamptz
 FROM ids JOIN public.lexemes l ON l.id=ids.id LEFT JOIN base b ON b.lexeme_id=l.id LEFT JOIN states s ON s.card_id=l.id
 WHERE coalesce(l.dictionary_status, 'active') <> 'excluded'
$f$;
REVOKE ALL ON FUNCTION private.d10_problem_cards_chunk_v1(uuid[]) FROM PUBLIC, anon, authenticated;

-- 3. one refresh step
CREATE OR REPLACE FUNCTION private.d10_problem_cards_refresh_step_v1(p_batch integer DEFAULT 300, p_recent integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE
  v_cur record; v_recent uuid[]; v_cycle uuid[]; v_ids uuid[]; v_n integer; v_wrap boolean; v_report jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('d10_problem_cards_refresh_v1', 1111)) THEN
    RETURN jsonb_build_object('skipped', 'previous step still running');
  END IF;
  SELECT * INTO v_cur FROM private.d10_problem_cards_cursor_v1 WHERE singleton FOR UPDATE;

  -- cards touched by jobs since the last step (fresh problems first)
  SELECT coalesce(array_agg(c), '{}') INTO v_recent FROM (
    SELECT DISTINCT coalesce(i.lexeme_id, e.lexeme_id) AS c
    FROM public.lexeme_processing_items i
    LEFT JOIN public.expression_catalog e ON e.id = i.expression_id
    WHERE i.updated_at > coalesce(v_cur.last_run_at, now() - interval '1 hour') - interval '1 minute'
      AND coalesce(i.lexeme_id, e.lexeme_id) IS NOT NULL
    LIMIT greatest(coalesce(p_recent, 100), 0)) q;

  -- next page of the whole base (id order, a new cycle after the last page)
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO v_cycle FROM (
    SELECT l.id FROM public.lexemes l
    WHERE (v_cur.last_id IS NULL OR l.id > v_cur.last_id)
    ORDER BY l.id LIMIT greatest(coalesce(p_batch, 300), 1)) q;
  v_wrap := cardinality(v_cycle) < greatest(coalesce(p_batch, 300), 1);

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(v_recent || v_cycle) x);
  DELETE FROM private.d10_problem_cards_cache_v1 WHERE lexeme_id = ANY (v_ids);
  INSERT INTO private.d10_problem_cards_cache_v1 (lexeme_id, lemma, pos, display_form, homograph_key,
    missing_translation, missing_example, review_reason, legacy, deferred_by_policy, deferred_facets,
    synonym_status, synonym_checked_at, refreshed_at)
  SELECT c.lexeme_id, c.lemma, c.pos, c.display_form, c.homograph_key, c.missing_translation, c.missing_example,
    c.review_reason, c.legacy, c.deferred_by_policy, c.deferred_facets, c.synonym_status, c.synonym_checked_at, now()
  FROM private.d10_problem_cards_chunk_v1(v_ids) c
  ON CONFLICT (lexeme_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  v_report := jsonb_build_object('recent', cardinality(v_recent), 'page', cardinality(v_cycle),
    'problems_written', v_n, 'cycle_finished', v_wrap, 'at', now());
  UPDATE private.d10_problem_cards_cursor_v1
  SET last_id = CASE WHEN v_wrap THEN NULL ELSE v_cycle[cardinality(v_cycle)] END,
      last_run_at = now(), cycles = cycles + CASE WHEN v_wrap THEN 1 ELSE 0 END, last_report = v_report
  WHERE singleton;
  RETURN v_report;
END
$f$;
REVOKE ALL ON FUNCTION private.d10_problem_cards_refresh_step_v1(integer, integer) FROM PUBLIC, anon, authenticated;

-- 4. cron
DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'd10-problem-cards-refresh';
  PERFORM cron.schedule('d10-problem-cards-refresh', '*/2 * * * *',
    $job$SET statement_timeout = '25s'; SELECT private.d10_problem_cards_refresh_step_v1(300, 100);$job$);
END
$cron$;

-- 5. the app's functions read the cache (same signature and order)
CREATE OR REPLACE FUNCTION public.d10_problem_cards_v4(p_limit integer DEFAULT 300, p_offset integer DEFAULT 0)
RETURNS TABLE(lexeme_id uuid,lemma text,pos text,display_form text,homograph_key text,
 missing_translation boolean,missing_example boolean,review_reason text,legacy boolean,
 deferred_by_policy boolean,deferred_facets text[],synonym_status text,synonym_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT c.lexeme_id, c.lemma, c.pos, c.display_form, c.homograph_key, c.missing_translation, c.missing_example,
        c.review_reason, c.legacy, c.deferred_by_policy, c.deferred_facets, c.synonym_status, c.synonym_checked_at
 FROM private.d10_problem_cards_cache_v1 c
 ORDER BY c.missing_translation DESC, (c.synonym_status = 'error') DESC NULLS LAST, c.lemma, c.lexeme_id
 LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000) OFFSET greatest(coalesce(p_offset, 0), 0)
$f$;
CREATE OR REPLACE FUNCTION public.d10_problem_cards_count_v3() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT count(*)::integer FROM private.d10_problem_cards_cache_v1
$f$;

-- first step now (recent cards + first page), as a check
SELECT private.d10_problem_cards_refresh_step_v1(300, 100) AS first_step;

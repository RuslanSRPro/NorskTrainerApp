-- D10 stage D (D1-2 + D2 part 1), plan D10_stage_d_plan_v3 / build spec v2:
-- choose the right card when two cards share lemma and POS (rule R9).
--
-- Until a second card exists (the old unique index lexemes_lemma_pos_unique
-- is still in place) nothing here changes behaviour: every candidate list has
-- at most one card per lemma + POS, and every tie-break below compares equal.
--
--  1. helpers
--     - public.d10_homograph_rank_v1(lexeme)   0 = main card (empty key), 1 = second card
--     - public.d10_lexeme_article_ids_v1(lexeme)  articles of a card: active
--       article bindings + articles of its active morphology snapshot
--     - public.d10_card_article_rank_v1(lexeme, evidence)  0 = the card owns
--       an article of the Ordbøkene evidence, 1 = the card has no article yet
--       (R12), 2 = the card has other articles
--  2. candidate order (main card first on a tie): resolve_surface_form_v2,
--     merge_surface_candidates
--  3. "first match" lookups prefer the main card: find_local_lexeme_candidate
--     (3 places), resolve_lexeme_for_surface_v1, resolve_adjective_lexeme_for_surface_v1
--  4. promotion: one card per item, chosen by the article of its Ordbøkene
--     evidence, then main card first (was: every card with the lemma + POS)
-- Every function is patched in place; each anchor must match exactly once,
-- otherwise the migration stops and changes nothing. Re-running is a no-op.

CREATE OR REPLACE FUNCTION public.d10_homograph_rank_v1(p_lexeme_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT CASE WHEN coalesce((SELECT l.homograph_key FROM public.lexemes l WHERE l.id = p_lexeme_id), '') = ''
              THEN 0 ELSE 1 END;
$body$;

CREATE OR REPLACE FUNCTION public.d10_lexeme_article_ids_v1(p_lexeme_id uuid)
RETURNS bigint[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT coalesce(array_agg(DISTINCT a ORDER BY a), '{}'::bigint[])
  FROM (
    SELECT b.article_id AS a
    FROM private.authoritative_morphology_article_bindings_v2 b
    WHERE b.lexeme_id = p_lexeme_id AND b.is_active AND b.dictionary_code = 'bm'
    UNION
    SELECT unnest(ms.source_article_ids)
    FROM private.authoritative_morphology_snapshots_v2 ms
    WHERE ms.lexeme_id = p_lexeme_id AND ms.is_active
  ) x;
$body$;

CREATE OR REPLACE FUNCTION public.d10_card_article_rank_v1(p_lexeme_id uuid, p_verification_evidence jsonb)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  WITH card AS (SELECT public.d10_lexeme_article_ids_v1(p_lexeme_id) AS ids),
  ev AS (
    SELECT coalesce(array_agg(x::bigint), '{}'::bigint[]) AS ids
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p_verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'article_ids') = 'array'
           THEN p_verification_evidence->'Ordbokene'->'evidence'->'raw_preview'->'article_ids'
           ELSE '[]'::jsonb END) x
    WHERE x ~ '^[1-9][0-9]*$'
  )
  SELECT CASE
    WHEN cardinality(card.ids) > 0 AND card.ids && ev.ids THEN 0
    WHEN cardinality(card.ids) = 0 THEN 1
    ELSE 2 END
  FROM card, ev;
$body$;

REVOKE ALL ON FUNCTION public.d10_homograph_rank_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.d10_lexeme_article_ids_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.d10_card_article_rank_v1(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_homograph_rank_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.d10_lexeme_article_ids_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.d10_card_article_rank_v1(uuid, jsonb) TO authenticated, service_role;

-- Patch helper: replace one regex match of a function definition, or stop.
CREATE OR REPLACE FUNCTION pg_temp.d10_patch_v1(p_def text, p_pattern text, p_replacement text, p_label text)
RETURNS text LANGUAGE plpgsql AS $body$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM regexp_matches(p_def, p_pattern, 'g');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'D10_STAGE_D_PREFLIGHT: anchor "%" found % times; nothing changed', p_label, v_count;
  END IF;
  RETURN regexp_replace(p_def, p_pattern, p_replacement);
END
$body$;

DO $patch$
DECLARE
  v text;
BEGIN
  -- 2a. resolve_surface_form_v2
  v := pg_get_functiondef('public.resolve_surface_form_v2(text,text,text,boolean)'::regprocedure);
  IF position('d10_homograph_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$order by\s+candidate\.base_priority desc,\s+candidate\.lemma,\s+candidate\.pos,\s+candidate\.lexeme_id;$p$,
      $r$order by
      candidate.base_priority desc,
      candidate.lemma,
      candidate.pos,
      public.d10_homograph_rank_v1(candidate.lexeme_id),
      candidate.lexeme_id;$r$, 'resolve_surface_form_v2 order');
    EXECUTE v;
  END IF;

  -- 2b. merge_surface_candidates
  v := pg_get_functiondef('public.merge_surface_candidates(text)'::regprocedure);
  IF position('d10_homograph_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$order by\s+g\.base_priority desc,\s+g\.lemma,\s+g\.pos,\s+g\.lexeme_id;$p$,
      $r$order by
    g.base_priority desc,
    g.lemma,
    g.pos,
    public.d10_homograph_rank_v1(g.lexeme_id),
    g.lexeme_id;$r$, 'merge_surface_candidates order');
    EXECUTE v;
  END IF;

  -- 3a. find_local_lexeme_candidate (3 places)
  v := pg_get_functiondef('public.find_local_lexeme_candidate(text)'::regprocedure);
  IF position('d10_homograph_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$where lower\(trim\(l\.lemma\)\) = n\.q\s+limit 1$p$,
      $r$where lower(trim(l.lemma)) = n.q
    order by public.d10_homograph_rank_v1(l.id), l.id
    limit 1$r$, 'find_local_lexeme_candidate lemma');
    v := pg_temp.d10_patch_v1(v,
      $p$where lower\(trim\(coalesce\(l\.display_form, ''\)\)\) = n\.q\s+limit 1$p$,
      $r$where lower(trim(coalesce(l.display_form, ''))) = n.q
    order by public.d10_homograph_rank_v1(l.id), l.id
    limit 1$r$, 'find_local_lexeme_candidate display_form');
    v := pg_temp.d10_patch_v1(v,
      $p$order by fv\.is_primary desc, fv\.confidence desc nulls last$p$,
      $r$order by fv.is_primary desc, fv.confidence desc nulls last, public.d10_homograph_rank_v1(l.id)$r$,
      'find_local_lexeme_candidate form variant');
    EXECUTE v;
  END IF;

  -- 3b. resolve_lexeme_for_surface_v1 (selected lemma)
  v := pg_get_functiondef('public.resolve_lexeme_for_surface_v1(text,text,text)'::regprocedure);
  IF position('d10_homograph_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$order by case when l\.verification_status='source_verified' then 0 else 1 end,l\.id limit 1$p$,
      $r$order by public.d10_homograph_rank_v1(l.id),case when l.verification_status='source_verified' then 0 else 1 end,l.id limit 1$r$,
      'resolve_lexeme_for_surface_v1 selected lemma');
    EXECUTE v;
  END IF;

  -- 3c. resolve_adjective_lexeme_for_surface_v1 (selected lemma)
  v := pg_get_functiondef('public.resolve_adjective_lexeme_for_surface_v1(text,text)'::regprocedure);
  IF position('d10_homograph_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$where l\.pos='adjective' and lower\(l\.lemma\)=lower\(p_selected_lemma\) limit 1$p$,
      $r$where l.pos='adjective' and lower(l.lemma)=lower(p_selected_lemma) order by public.d10_homograph_rank_v1(l.id), l.id limit 1$r$,
      'resolve_adjective_lexeme_for_surface_v1 selected lemma');
    EXECUTE v;
  END IF;

  -- 4. promotion: one card per item, by article, main card first
  v := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
  IF position('d10_card_article_rank_v1' IN v) = 0 THEN
    v := pg_temp.d10_patch_v1(v,
      $p$lexeme_matches as \(\s+select\s+ato\.item_id,$p$,
      $r$lexeme_matches as (
    -- D10 15.10.2026 (R9): one card per item - the card that owns the article
    -- of the item's Ordbøkene evidence, then the main card.
    select distinct on (ato.item_id)
      ato.item_id,$r$, 'promotion lexeme_matches head');
    v := pg_temp.d10_patch_v1(v,
      $p$and aml\.pos = coalesce\(nullif\(ato\.effective_pos, ''\), 'unknown'\)\s+\),\s+lexeme_update_source as$p$,
      $r$and aml.pos = coalesce(nullif(ato.effective_pos, ''), 'unknown')
    order by ato.item_id,
      public.d10_card_article_rank_v1(aml.id, ato.verification_evidence),
      public.d10_homograph_rank_v1(aml.id),
      aml.id
  ),

  lexeme_update_source as$r$, 'promotion lexeme_matches tail');
    EXECUTE v;
  END IF;

  RAISE NOTICE 'D10 stage D: card choice by homograph key and article installed';
END
$patch$;

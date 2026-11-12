-- D10_hete_naob_cache_refresh_v2 (11.11.2026, replaces v1, which stopped on a foreign key: some NAOB gloss rows of
-- hete are referenced by the synonym queue). Same purpose as v1: the stored NAOB data of "hete" is from an older
-- article numbering ("hete opp" stored under hete_3 = today "be called"). Removed (saved first): the cached pages,
-- the extraction log, the NAOB run records of the two hete verb cards, and every gloss row of hete_1..hete_4 that
-- the synonym queue does NOT reference. Referenced rows are kept and listed at the end (to decide on them).
-- The next analysis of "hete" fetches the pages and extracts the expressions again.
CREATE TABLE IF NOT EXISTS private.d10_naob_cache_refresh_backup_v1 (
  id bigserial PRIMARY KEY, table_name text NOT NULL, row_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_naob_cache_refresh_backup_v1 FROM PUBLIC;

INSERT INTO private.d10_naob_cache_refresh_backup_v1 (table_name, row_data)
SELECT 'naob_expression_glosses', to_jsonb(g) FROM public.naob_expression_glosses g
WHERE lower(g.naob_slug) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4')
  AND NOT EXISTS (SELECT 1 FROM public.synonym_candidate_queue q WHERE q.gloss_id = g.id);
INSERT INTO private.d10_naob_cache_refresh_backup_v1 (table_name, row_data)
SELECT 'naob_article_cache', to_jsonb(c) - 'html' FROM public.naob_article_cache c
WHERE lower(c.normalized_key) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4');
INSERT INTO private.d10_naob_cache_refresh_backup_v1 (table_name, row_data)
SELECT 'd10_family_naob_runs_v1', to_jsonb(n) FROM private.d10_family_naob_runs_v1 n
JOIN public.lexemes l ON l.id = n.root_lexeme_id WHERE l.lemma = 'hete' AND l.pos = 'verb';

DELETE FROM public.naob_expression_glosses g
WHERE lower(g.naob_slug) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4')
  AND NOT EXISTS (SELECT 1 FROM public.synonym_candidate_queue q WHERE q.gloss_id = g.id);
DELETE FROM public.naob_article_cache WHERE lower(normalized_key) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4');
DELETE FROM public.naob_extraction_log_v1 WHERE lower(slug) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4');
DELETE FROM private.d10_family_naob_runs_v1 n USING public.lexemes l
WHERE l.id = n.root_lexeme_id AND l.lemma = 'hete' AND l.pos = 'verb';

SELECT 'removed ' || table_name AS part, count(*)::text AS info FROM private.d10_naob_cache_refresh_backup_v1
WHERE created_at > now() - interval '5 minutes' GROUP BY table_name
UNION ALL
SELECT 'kept (synonym queue)', g.naob_slug || ': ' || coalesce(g.expression_lemma, '') || ' [' || g.gloss_type || '] '
       || left(coalesce(g.gloss_text, ''), 80)
FROM public.naob_expression_glosses g
WHERE lower(g.naob_slug) IN ('hete', 'hete_1', 'hete_2', 'hete_3', 'hete_4');

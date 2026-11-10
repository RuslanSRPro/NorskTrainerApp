-- D10_expression_definition_backfill_v1 (09.11.2026): own Ordbøkene definition for old expression rows.
-- 1114 old catalog rows (created by relation promotion, before the sub-article promotion) are bound to an
-- Ordbøkene root and have an Ordbøkene sub-article (ordbokene_expression_candidates) with a definition, but their
-- raw_sources do not carry it in the form the AI chain reads (expressionContext: source Ordbokene, source_type
-- sub_article, article_id = verification_evidence.Ordbokene.article_id, dictionary_code bm, definition_preview).
-- So the AI refuses them (AI_EXPRESSION_OWN_DEFINITION_REQUIRED): no translation / example translation
-- ("gripe ut av lufta": old translation, example without translation).
-- Fix: these keys are added to raw_sources (existing keys kept) from the candidate of the SAME article as the
-- expression's Ordbøkene evidence (else the first candidate). Rows that already have source Ordbokene/NAOB are not
-- touched. Backup of the old raw_sources: private.d10_expression_definition_backfill_v1. Rollback in optional/.
-- The translations are redone when the expression goes through a job again (e.g. its verb is analysed).

CREATE TABLE IF NOT EXISTS private.d10_expression_definition_backfill_v1 (
  expression_id uuid PRIMARY KEY,
  old_raw_sources jsonb,
  article_id bigint,
  saved_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_expression_definition_backfill_v1 FROM PUBLIC;

DO $mig$
DECLARE v_n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM private.d10_expression_definition_backfill_v1) THEN
    RAISE EXCEPTION 'STOP: D10_expression_definition_backfill_v1 is already installed';
  END IF;

  CREATE TEMP TABLE d10_def_pick ON COMMIT DROP AS
  SELECT DISTINCT ON (e.id) e.id, e.raw_sources AS old_raw, c.candidate_article_id::bigint AS article_id,
    c.definition_preview, coalesce(c.examples, '[]'::jsonb) AS examples
  FROM public.expression_catalog e
  JOIN public.ordbokene_expression_candidates c ON c.promoted_expression_id = e.id
   AND c.candidate_kind = 'expression' AND upper(c.candidate_dictionary_code) = 'BM'
   AND c.status IN ('promoted', 'duplicate') AND nullif(btrim(c.definition_preview), '') IS NOT NULL
  WHERE coalesce(e.raw_sources->>'source', '') NOT IN ('Ordbokene', 'NAOB')
    AND EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
                WHERE b.expression_id = e.id AND b.source_kind = 'ordbokene_parent_article')
  ORDER BY e.id,
    (c.candidate_article_id::text = coalesce(e.verification_evidence->'Ordbokene'->>'article_id',
       e.verification_evidence->'Ordbokene'->'evidence'->>'article_id', '')) DESC,
    c.candidate_article_id;

  INSERT INTO private.d10_expression_definition_backfill_v1 (expression_id, old_raw_sources, article_id)
  SELECT id, old_raw, article_id FROM d10_def_pick;

  UPDATE public.expression_catalog e
  SET raw_sources = coalesce(e.raw_sources, '{}'::jsonb) || jsonb_build_object(
        'source', 'Ordbokene', 'source_type', 'sub_article', 'article_id', p.article_id, 'dictionary_code', 'bm',
        'definition_preview', p.definition_preview, 'examples', p.examples,
        'definition_backfill', 'd10_expression_definition_backfill_v1'),
      updated_at = now()
  FROM d10_def_pick p WHERE e.id = p.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'rows updated: %', v_n;
END
$mig$;

SELECT 'd10_expression_definition_backfill_v1 installed' AS result,
  (SELECT count(*) FROM private.d10_expression_definition_backfill_v1) AS rows_backfilled,
  (SELECT count(*) FROM private.d10_expression_definition_backfill_v1 b JOIN public.expression_catalog e ON e.id = b.expression_id
   WHERE b.article_id::text = coalesce(e.verification_evidence->'Ordbokene'->>'article_id',
     e.verification_evidence->'Ordbokene'->'evidence'->>'article_id', '')) AS article_matches_evidence,
  (SELECT e.raw_sources->>'definition_preview' FROM public.expression_catalog e WHERE e.lemma = 'gripe ut av lufta') AS lufta_definition;

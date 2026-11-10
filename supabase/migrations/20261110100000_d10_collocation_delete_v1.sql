-- D10_collocation_delete_v1 (10.11.2026, agreed after preview 387): ordinary combinations are removed.
--   Selected exactly as in 387: category 'collocation', no dictionary confirmed the whole expression,
--   not from a dictionary (raw_sources.source not Ordbokene/NAOB) - minus 8 real expressions kept:
--   ha rett, gjøre rent, holde rent, gi beskjed, ta kontakt med, si det samme, stø kurs, legge om kursen.
--   Expected: 304 catalog rows, 303 cards (kaste ball has no card).
-- Deleted: the catalog rows, their expression cards and every row referencing them (one level, through
-- foreign keys), exactly like D10_expression_dedupe_v1. Everything is saved in
-- private.d10_collocation_delete_backup_v1 (rollback file in optional/). 360 families of their roots are recounted.
-- One DO block + final SELECT (SQL Editor). A repeated install stops; any guard failure changes nothing.

CREATE TABLE IF NOT EXISTS private.d10_collocation_delete_backup_v1 (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,          -- deleted_row | report
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_collocation_delete_backup_v1 FROM PUBLIC;

DO $mig$
DECLARE
  fk record;
  v_n integer;
  v_cat_ids uuid[];
  v_card_ids uuid[];
  v_roots uuid[];
  v_keep text[] := ARRAY['ha rett', 'gjøre rent', 'holde rent', 'gi beskjed', 'ta kontakt med',
                         'si det samme', 'stø kurs', 'legge om kursen'];
BEGIN
  IF EXISTS (SELECT 1 FROM private.d10_collocation_delete_backup_v1 WHERE kind = 'report') THEN
    RAISE EXCEPTION 'STOP: D10_collocation_delete_v1 is already installed';
  END IF;

  SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = ANY (v_keep) AND category = 'collocation';
  IF v_n <> 8 THEN RAISE EXCEPTION 'STOP: kept expressions found: % (expected 8)', v_n; END IF;

  SELECT coalesce(array_agg(e.id), '{}') INTO v_cat_ids
  FROM public.expression_catalog e
  WHERE e.category = 'collocation'
    AND coalesce(e.verification_evidence #>> '{Ordbokene,whole_unit_match}', 'false') <> 'true'
    AND coalesce(e.verification_evidence #>> '{NAOB,whole_unit_match}', 'false') <> 'true'
    AND coalesce(e.raw_sources ->> 'source', '') NOT IN ('Ordbokene', 'NAOB')
    AND NOT (e.lemma = ANY (v_keep));
  IF cardinality(v_cat_ids) <> 304 THEN
    RAISE EXCEPTION 'STOP: % expressions selected (expected 304 as in preview 387); nothing changed', cardinality(v_cat_ids);
  END IF;

  SELECT coalesce(array_agg(DISTINCT e.lexeme_id), '{}') INTO v_card_ids
  FROM public.expression_catalog e WHERE e.id = ANY (v_cat_ids) AND e.lexeme_id IS NOT NULL;
  IF EXISTS (SELECT 1 FROM public.lexemes l WHERE l.id = ANY (v_card_ids) AND l.pos IS DISTINCT FROM 'expression') THEN
    RAISE EXCEPTION 'STOP: a selected card is not an expression card';
  END IF;
  IF EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.lexeme_id = ANY (v_card_ids) AND NOT (e.id = ANY (v_cat_ids))) THEN
    RAISE EXCEPTION 'STOP: a selected card is also used by an expression that is kept';
  END IF;

  SELECT coalesce(array_agg(DISTINCT b.root_lexeme_id), '{}') INTO v_roots
  FROM private.lexeme360_expression_roots_v1 b
  WHERE b.expression_id = ANY (v_cat_ids) AND NOT (b.root_lexeme_id = ANY (v_card_ids));

  INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'report', 'selected', jsonb_build_object('lemma', e.lemma, 'expression_id', e.id, 'card', e.lexeme_id)
  FROM public.expression_catalog e WHERE e.id = ANY (v_cat_ids) ORDER BY e.lemma;

  -- delete referencing rows (one level), then catalog rows, then cards
  FOR fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col,
      CASE WHEN c.confrelid = 'public.expression_catalog'::regclass THEN 'catalog' ELSE 'card' END AS ref
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
      AND c.confrelid IN ('public.expression_catalog'::regclass, 'public.lexemes'::regclass)
      AND NOT (c.conrelid = 'public.expression_catalog'::regclass AND c.confrelid = 'public.lexemes'::regclass)
      AND c.conrelid <> c.confrelid
    ORDER BY 3, 1, 2
  LOOP
    EXECUTE format('INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
                    SELECT ''deleted_row'', %L, to_jsonb(t) FROM %s t WHERE t.%I = ANY ($1)', fk.tbl, fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'catalog' THEN v_cat_ids ELSE v_card_ids END;
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'catalog' THEN v_cat_ids ELSE v_card_ids END;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
      VALUES ('report', 'refs_deleted', jsonb_build_object('table', fk.tbl || '.' || fk.col, 'rows', v_n));
    END IF;
  END LOOP;

  INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.expression_catalog', to_jsonb(e) FROM public.expression_catalog e WHERE e.id = ANY (v_cat_ids);
  DELETE FROM public.expression_catalog WHERE id = ANY (v_cat_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 304 THEN RAISE EXCEPTION 'STOP: deleted % catalog rows, expected 304', v_n; END IF;

  INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.lexemes', to_jsonb(l) FROM public.lexemes l WHERE l.id = ANY (v_card_ids);
  DELETE FROM public.lexemes WHERE id = ANY (v_card_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO private.d10_collocation_delete_backup_v1 (kind, table_name, row_data)
  VALUES ('report', 'deleted', jsonb_build_object('catalog_rows', 304, 'cards', v_n, 'roots_recounted', cardinality(v_roots)));

  IF cardinality(v_roots) > 0 THEN
    PERFORM private.lexeme360_enqueue_v1(v_roots, 'collocation_delete_v1');
    PERFORM public.lexeme360_refresh_drain_v1(500);
  END IF;
END
$mig$;

SELECT table_name AS part, row_data AS info FROM private.d10_collocation_delete_backup_v1
WHERE kind = 'report' AND table_name <> 'selected' ORDER BY id;

-- D10_expression_dedupe_v1 (07.11.2026, agreed): duplicate expressions (query 362 + test gripe).
--   remove                -> keep
--   legge frem            -> legge fram                 (fram = Bokmål main form, more links)
--   se frem til           -> se fram til
--   sette i stand         -> [sette|gjøre] i stand      (dictionary notation covers both)
--   være nødt til         -> være nødt [til|for]
--   gripe ut av luften    -> gripe ut av lufta          (NAOB copy of the Ordbøkene expression)
-- For each pair:
--   * root bindings of the removed row move to the kept row (NAOB evidence is merged into an existing binding);
--     the kept row gets source_naob = true when the removed row came from NAOB;
--   * the card: if the kept row has no card, the card of the removed row is renamed to the kept lemma and
--     linked to it (translations, examples, progress stay - they point to the card id); otherwise the card
--     of the removed row is deleted;
--   * the removed catalog row, its card (if deleted) and every row referencing them (one level, through
--     foreign keys) are deleted (agreed: nobody learns yet).
-- Everything deleted or changed is saved in private.d10_expression_dedupe_backup_v1 (rollback file in optional/).
-- One DO block + final SELECT (SQL Editor). A repeated install stops; any guard failure changes nothing.

CREATE TABLE IF NOT EXISTS private.d10_expression_dedupe_backup_v1 (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,          -- deleted_row | card_rename | card_relink | binding_moved | report
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_expression_dedupe_backup_v1 FROM PUBLIC;

DO $mig$
DECLARE
  r record;
  fk record;
  v_rm uuid; v_rm_card uuid; v_rm_naob boolean;
  v_keep uuid; v_keep_card uuid; v_keep_lemma text;
  v_n integer;
  v_cat_ids uuid[] := '{}';
  v_card_ids uuid[] := '{}';
BEGIN
  IF EXISTS (SELECT 1 FROM private.d10_expression_dedupe_backup_v1 WHERE kind = 'report') THEN
    RAISE EXCEPTION 'STOP: D10_expression_dedupe_v1 is already installed';
  END IF;

  FOR r IN SELECT * FROM (VALUES
    ('legge frem', 'legge fram'),
    ('se frem til', 'se fram til'),
    ('sette i stand', '[sette|gjøre] i stand'),
    ('være nødt til', 'være nødt [til|for]'),
    ('gripe ut av luften', 'gripe ut av lufta')
  ) AS t(rm, keep) LOOP
    SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = r.rm;
    IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: catalog rows for "%": % (expected 1)', r.rm, v_n; END IF;
    SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = r.keep;
    IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: catalog rows for "%": % (expected 1)', r.keep, v_n; END IF;
    SELECT id, lexeme_id, coalesce(source_naob, false) INTO v_rm, v_rm_card, v_rm_naob
      FROM public.expression_catalog WHERE lemma = r.rm;
    SELECT id, lexeme_id, lemma INTO v_keep, v_keep_card, v_keep_lemma
      FROM public.expression_catalog WHERE lemma = r.keep;
    v_cat_ids := v_cat_ids || v_rm;

    -- bindings: move (or merge the NAOB evidence into the kept row's binding of the same root)
    INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
    SELECT 'binding_moved', 'private.lexeme360_expression_roots_v1', to_jsonb(b) || jsonb_build_object('moved_to', v_keep)
    FROM private.lexeme360_expression_roots_v1 b WHERE b.expression_id = v_rm;
    INSERT INTO private.lexeme360_expression_roots_v1 AS k
      (expression_id, root_lexeme_id, source_kind, dictionary_code, source_article_id, source_pos, evidence)
    SELECT v_keep, b.root_lexeme_id, b.source_kind, b.dictionary_code, b.source_article_id, b.source_pos, b.evidence
    FROM private.lexeme360_expression_roots_v1 b WHERE b.expression_id = v_rm
    ON CONFLICT (expression_id, root_lexeme_id) DO UPDATE
      SET evidence = k.evidence || (excluded.evidence - 'expression_id'), updated_at = clock_timestamp();
    IF v_rm_naob THEN
      UPDATE public.expression_catalog SET source_naob = true, updated_at = now()
      WHERE id = v_keep AND source_naob IS DISTINCT FROM true;
    END IF;

    -- card
    IF v_rm_card IS NOT NULL THEN
      IF (SELECT pos FROM public.lexemes WHERE id = v_rm_card) IS DISTINCT FROM 'expression' THEN
        RAISE EXCEPTION 'STOP: card of "%" is not an expression card', r.rm;
      END IF;
      IF v_keep_card IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.lexemes WHERE pos = 'expression' AND lemma = v_keep_lemma) THEN
          RAISE EXCEPTION 'STOP: an expression card "%" already exists', v_keep_lemma;
        END IF;
        INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
        SELECT 'card_rename', 'public.lexemes', jsonb_build_object('id', l.id, 'lemma', l.lemma,
          'display_form', l.display_form, 'new_lemma', v_keep_lemma, 'linked_to_catalog', v_keep, 'from_catalog', v_rm)
        FROM public.lexemes l WHERE l.id = v_rm_card;
        UPDATE public.lexemes SET lemma = v_keep_lemma, display_form = v_keep_lemma, updated_at = now() WHERE id = v_rm_card;
        UPDATE public.expression_catalog SET lexeme_id = NULL WHERE id = v_rm;
        UPDATE public.expression_catalog SET lexeme_id = v_rm_card, updated_at = now() WHERE id = v_keep;
      ELSE
        v_card_ids := v_card_ids || v_rm_card;
      END IF;
    END IF;
    INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
    VALUES ('report', 'pair', jsonb_build_object('removed', r.rm, 'kept', r.keep,
      'card', CASE WHEN v_rm_card IS NULL THEN 'none' WHEN v_keep_card IS NULL THEN 'moved_to_kept' ELSE 'deleted' END));
  END LOOP;

  -- delete referencing rows (one level), then catalog rows, then cards
  FOR fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
      AND c.confrelid IN ('public.expression_catalog'::regclass, 'public.lexemes'::regclass)
      AND NOT (c.conrelid = 'public.expression_catalog'::regclass AND c.confrelid = 'public.lexemes'::regclass)
      AND c.conrelid <> c.confrelid
    ORDER BY 3, 1, 2
  LOOP
    EXECUTE format('INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
                    SELECT ''deleted_row'', %L, to_jsonb(t) FROM %s t WHERE t.%I = ANY ($1)', fk.tbl, fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'expression_catalog' THEN v_cat_ids ELSE v_card_ids END;
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'expression_catalog' THEN v_cat_ids ELSE v_card_ids END;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
      VALUES ('report', 'refs_deleted', jsonb_build_object('table', fk.tbl || '.' || fk.col, 'rows', v_n));
    END IF;
  END LOOP;

  INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.expression_catalog', to_jsonb(e) FROM public.expression_catalog e WHERE e.id = ANY (v_cat_ids);
  DELETE FROM public.expression_catalog WHERE id = ANY (v_cat_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN RAISE EXCEPTION 'STOP: deleted % catalog rows, expected 5', v_n; END IF;

  IF cardinality(v_card_ids) > 0 THEN
    INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
    SELECT 'deleted_row', 'public.lexemes', to_jsonb(l) FROM public.lexemes l WHERE l.id = ANY (v_card_ids);
    DELETE FROM public.lexemes WHERE id = ANY (v_card_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    v_n := 0;
  END IF;
  INSERT INTO private.d10_expression_dedupe_backup_v1 (kind, table_name, row_data)
  VALUES ('report', 'deleted', jsonb_build_object('catalog_rows', 5, 'cards', v_n));

  -- recount the 360 families of the kept rows
  PERFORM private.lexeme360_enqueue_v1(ARRAY(
    SELECT DISTINCT b.root_lexeme_id FROM private.lexeme360_expression_roots_v1 b
    JOIN public.expression_catalog e ON e.id = b.expression_id
    WHERE e.lemma IN ('legge fram', 'se fram til', '[sette|gjøre] i stand', 'være nødt [til|for]', 'gripe ut av lufta')),
    'expression_dedupe_v1');
  PERFORM public.lexeme360_refresh_drain_v1(500);
END
$mig$;

SELECT table_name AS part, row_data AS info FROM private.d10_expression_dedupe_backup_v1
WHERE kind = 'report' ORDER BY id;

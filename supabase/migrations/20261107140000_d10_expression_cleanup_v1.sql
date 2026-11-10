-- D10_expression_cleanup_v1 (07.11.2026, agreed): cleanup of the expression catalog.
--   * renames: spelling (pa -> på, aa -> å, folge -> følge), trailing dots, teacher patterns -> Ordbøkene notation [a|b];
--     the expression card (lexemes, pos 'expression') of the same lemma is renamed too; translations, examples and
--     learning progress stay (they point to ids).
--   * merge: "surfe pa nettet" -> the existing catalog row "surfe på nettet" (the card is renamed and linked to it).
--   * deletes (agreed: nobody learns them, delete with all links): duplicate, two fragments, nine one-word rows
--     (words, not expressions) — the catalog row, its expression card and every row that references them (one level,
--     through foreign keys).
--   * display_form of five words with broken letters (d�r, f�ler, n�, p�, r�verhistorie) = lemma.
-- Every deleted row (catalog, card, referencing rows) and every rename is saved in private.d10_expression_cleanup_backup_v1.
-- Guards: each source must exist exactly once (catalog) and the card at most once; a repeated install stops.
-- Rollback: optional/rollback_d10_expression_cleanup_v1.sql.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('private.d10_expression_cleanup_backup_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_expression_cleanup_v1 is already installed';
  END IF;
END
$guard$;

CREATE TABLE private.d10_expression_cleanup_backup_v1 (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,            -- 'rename' | 'deleted_row' | 'display_form'
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.d10_expression_cleanup_backup_v1 FROM PUBLIC;

CREATE TEMP TABLE d10_cleanup_report (part text, name text, info jsonb) ON COMMIT DROP;

DO $mig$
DECLARE
  r record;
  fk record;
  v_cat uuid;
  v_card uuid;
  v_n integer;
  v_cat_ids uuid[] := '{}';
  v_card_ids uuid[] := '{}';
  v_target uuid;
BEGIN
  -- 1. renames (source must exist exactly once in the catalog; card at most once; target must be free)
  FOR r IN SELECT * FROM (VALUES
    ('bruke tid pa', 'bruke tid på'),
    ('dele pa sosiale medier', 'dele på sosiale medier'),
    ('folge med pa', 'følge med på'),
    ('se pa nyhetene', 'se på nyhetene'),
    ('haandtere forsinkelse', 'håndtere forsinkelse'),
    ('i nærheten av ....', 'i nærheten av'),
    ('til jul...', 'til jul'),
    ('ikke bare... men også', 'ikke bare … men også'),
    ('for dager- timer- måneder- år- siden', 'for [dager|timer|måneder|år] siden'),
    ('neste dag / uke / måned / år', 'neste [dag|uke|måned|år]'),
    ('forrige dag / uke / måned / år', 'forrige [dag|uke|måned|år]'),
    ('være / bli skilt', '[være|bli] skilt'),
    ('bli vant til / å være vant til', '[bli|være] vant til'),
    ('blant annet / andre', 'blant [annet|andre]'),
    ('i slutten av uka / måneden', 'i slutten av [uka|måneden]'),
    ('kaldt / varmt / fuktig i lufta', '[kaldt|varmt|fuktig] i lufta'),
    ('få (ha) barn med', '[få|ha] barn med')
  ) AS t(src, dst) LOOP
    SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = r.src;
    IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: catalog rows for "%": % (expected 1)', r.src, v_n; END IF;
    IF EXISTS (SELECT 1 FROM public.expression_catalog WHERE lemma = r.dst OR normalized_key = lower(r.dst)) THEN
      RAISE EXCEPTION 'STOP: target "%" already exists in the catalog', r.dst;
    END IF;
    IF EXISTS (SELECT 1 FROM public.lexemes WHERE lemma = r.dst AND pos = 'expression') THEN
      RAISE EXCEPTION 'STOP: target card "%" already exists', r.dst;
    END IF;
    SELECT count(*) INTO v_n FROM public.lexemes WHERE lemma = r.src AND pos = 'expression';
    IF v_n > 1 THEN RAISE EXCEPTION 'STOP: % expression cards for "%"', v_n, r.src; END IF;

    INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
    SELECT 'rename', 'expression_catalog', jsonb_build_object('id', e.id, 'lemma', e.lemma, 'normalized_key', e.normalized_key,
      'display_form', e.display_form, 'new_lemma', r.dst)
    FROM public.expression_catalog e WHERE e.lemma = r.src;
    INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
    SELECT 'rename', 'lexemes', jsonb_build_object('id', l.id, 'lemma', l.lemma, 'display_form', l.display_form, 'new_lemma', r.dst)
    FROM public.lexemes l WHERE l.lemma = r.src AND l.pos = 'expression';

    UPDATE public.expression_catalog
    SET lemma = r.dst, normalized_key = lower(r.dst), display_form = r.dst, updated_at = now()
    WHERE lemma = r.src;
    UPDATE public.lexemes SET lemma = r.dst, display_form = r.dst WHERE lemma = r.src AND pos = 'expression';
    INSERT INTO d10_cleanup_report VALUES ('1_rename', r.src || ' -> ' || r.dst, '{}'::jsonb);
  END LOOP;

  -- 2. merge "surfe pa nettet" into the existing catalog row "surfe på nettet"
  SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = 'surfe pa nettet';
  IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: catalog rows for "surfe pa nettet": %', v_n; END IF;
  SELECT id INTO STRICT v_target FROM public.expression_catalog WHERE lemma = 'surfe på nettet' OR normalized_key = 'surfe på nettet';
  SELECT id, lexeme_id INTO v_cat, v_card FROM public.expression_catalog WHERE lemma = 'surfe pa nettet';
  v_cat_ids := v_cat_ids || v_cat;                      -- the 'pa' catalog row is deleted below
  IF v_card IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.lexemes WHERE lemma = 'surfe på nettet' AND pos = 'expression') THEN
      RAISE EXCEPTION 'STOP: card "surfe på nettet" already exists';
    END IF;
    INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
    SELECT 'rename', 'lexemes', jsonb_build_object('id', l.id, 'lemma', l.lemma, 'display_form', l.display_form,
      'new_lemma', 'surfe på nettet', 'merged_into_catalog', v_target)
    FROM public.lexemes l WHERE l.id = v_card;
    UPDATE public.lexemes SET lemma = 'surfe på nettet', display_form = 'surfe på nettet' WHERE id = v_card;
    -- the card is kept: unlink it from the row that will be deleted, link it to the target row (if free)
    UPDATE public.expression_catalog SET lexeme_id = NULL WHERE id = v_cat;
    UPDATE public.expression_catalog SET lexeme_id = v_card, updated_at = now() WHERE id = v_target AND lexeme_id IS NULL;
  END IF;
  INSERT INTO d10_cleanup_report VALUES ('2_merge', 'surfe pa nettet -> surfe på nettet',
    jsonb_build_object('target_catalog', v_target, 'card', v_card));

  -- 3. rows to delete: catalog row + its expression card
  FOR r IN SELECT * FROM (VALUES
    ('ikke bare...men også'), ('er ikke det.. (du)'), ('komme nærmere- å nærme seg land'),
    ('derimot'), ('dessuten'), ('egentlig'), ('forstå'), ('ganske'), ('likevel'), ('trives'), ('overimorgen'), ('utlandet')
  ) AS t(src) LOOP
    SELECT count(*) INTO v_n FROM public.expression_catalog WHERE lemma = r.src;
    IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: catalog rows for "%": % (expected 1)', r.src, v_n; END IF;
    SELECT id, lexeme_id INTO v_cat, v_card FROM public.expression_catalog WHERE lemma = r.src;
    v_cat_ids := v_cat_ids || v_cat;
    IF v_card IS NOT NULL THEN
      IF (SELECT pos FROM public.lexemes WHERE id = v_card) IS DISTINCT FROM 'expression' THEN
        RAISE EXCEPTION 'STOP: card of "%" is not an expression card', r.src;
      END IF;
      v_card_ids := v_card_ids || v_card;
    END IF;
    -- an expression card of the same lemma not linked from the catalog
    v_card_ids := v_card_ids || coalesce((SELECT array_agg(l.id) FROM public.lexemes l
      WHERE l.lemma = r.src AND l.pos = 'expression' AND l.id <> ALL (v_card_ids)), '{}');
  END LOOP;

  -- 4. delete: for each table referencing the catalog / lexemes, back up and delete the referencing rows,
  --    then the catalog rows, then the cards. A further blocking reference stops the whole migration.
  FOR fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
      AND c.confrelid IN ('public.expression_catalog'::regclass, 'public.lexemes'::regclass)
      AND NOT (c.conrelid = 'public.expression_catalog'::regclass AND c.confrelid = 'public.lexemes'::regclass)
      AND c.conrelid <> c.confrelid      -- self references are not deleted here (a remaining one stops the migration)
    ORDER BY 3, 1, 2
  LOOP
    EXECUTE format('INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
                    SELECT ''deleted_row'', %L, to_jsonb(t) FROM %s t WHERE t.%I = ANY ($1)', fk.tbl, fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'expression_catalog' THEN v_cat_ids ELSE v_card_ids END;
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col)
      USING CASE WHEN fk.ref = 'expression_catalog' THEN v_cat_ids ELSE v_card_ids END;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN INSERT INTO d10_cleanup_report VALUES ('3_refs_deleted', fk.tbl || '.' || fk.col, jsonb_build_object('rows', v_n)); END IF;
  END LOOP;

  INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.expression_catalog', to_jsonb(e) FROM public.expression_catalog e WHERE e.id = ANY (v_cat_ids);
  DELETE FROM public.expression_catalog WHERE id = ANY (v_cat_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 13 THEN RAISE EXCEPTION 'STOP: deleted % catalog rows, expected 13', v_n; END IF;
  INSERT INTO d10_cleanup_report VALUES ('4_deleted', 'expression_catalog', jsonb_build_object('rows', v_n));

  INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.lexemes', to_jsonb(l) FROM public.lexemes l WHERE l.id = ANY (v_card_ids);
  DELETE FROM public.lexemes WHERE id = ANY (v_card_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO d10_cleanup_report VALUES ('4_deleted', 'lexemes (expression cards)', jsonb_build_object('rows', v_n));

  -- 5. broken display_form = lemma
  INSERT INTO private.d10_expression_cleanup_backup_v1 (kind, table_name, row_data)
  SELECT 'display_form', 'lexemes', jsonb_build_object('id', l.id, 'lemma', l.lemma, 'display_form', l.display_form)
  FROM public.lexemes l WHERE l.display_form ~ '[ÃÂ�]';
  UPDATE public.lexemes SET display_form = lemma WHERE display_form ~ '[ÃÂ�]';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO d10_cleanup_report VALUES ('5_display_form', 'fixed', jsonb_build_object('rows', v_n));
END
$mig$;

SELECT part, name, info FROM d10_cleanup_report ORDER BY 1, 2;
COMMIT;

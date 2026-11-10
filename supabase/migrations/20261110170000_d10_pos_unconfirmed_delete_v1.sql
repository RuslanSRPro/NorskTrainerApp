-- D10_pos_unconfirmed_delete_v1 (10.11.2026, agreed after 423 / 425): word cards whose part of speech no Bokmål
-- dictionary has are deleted (not even grey candidates): the Ordbøkene lookup for exactly that part of speech found
-- nothing and the cached Ordbøkene articles of the spelling are of another word class.
--   blank n., brenne n. (2 cards), få adj. (Nynorsk), gjenmæle v., grov n., kul adv. (no lookup at all), lage n.,
--   sende n., sette n., strekke n., strøm adj., svær n., ty n., velluktende n.   = 15 cards.
-- The cards with the confirmed part of speech (strøm n., sende v., få v. ...) are not touched.
-- Deleted: the cards and every row referencing them (one level, foreign keys), like the earlier deletes.
-- Everything is saved in private.d10_pos_unconfirmed_delete_backup_v1 (rollback in optional/).
-- One DO block + final SELECT. A repeated install stops; any guard failure changes nothing.
CREATE TABLE IF NOT EXISTS private.d10_pos_unconfirmed_delete_backup_v1 (
  id bigserial PRIMARY KEY, kind text NOT NULL, table_name text NOT NULL, row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_pos_unconfirmed_delete_backup_v1 FROM PUBLIC;

DO $mig$
DECLARE
  fk record; v_n integer; v_ids uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM private.d10_pos_unconfirmed_delete_backup_v1 WHERE kind = 'report') THEN
    RAISE EXCEPTION 'STOP: D10_pos_unconfirmed_delete_v1 is already installed';
  END IF;

  SELECT coalesce(array_agg(l.id), '{}') INTO v_ids FROM public.lexemes l
  WHERE (l.lemma, l.pos) IN (('blank','noun'), ('brenne','noun'), ('få','adjective'), ('gjenmæle','verb'), ('grov','noun'),
      ('kul','adverb'), ('lage','noun'), ('sende','noun'), ('sette','noun'), ('strekke','noun'), ('strøm','adjective'),
      ('svær','noun'), ('ty','noun'), ('velluktende','noun'))
    AND coalesce(l.verification_tier, '') NOT IN ('dictionary_entry', 'dictionary_match');
  IF cardinality(v_ids) <> 15 THEN
    RAISE EXCEPTION 'STOP: % cards selected (expected 15 as in 425); nothing changed', cardinality(v_ids);
  END IF;
  IF EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.lexeme_id = ANY (v_ids)) THEN
    RAISE EXCEPTION 'STOP: an expression is linked to one of these cards; nothing changed';
  END IF;

  INSERT INTO private.d10_pos_unconfirmed_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'report', 'selected', jsonb_build_object('lemma', l.lemma, 'pos', l.pos, 'id', l.id, 'tier', l.verification_tier)
  FROM public.lexemes l WHERE l.id = ANY (v_ids);

  FOR fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1 AND c.confrelid = 'public.lexemes'::regclass
      AND c.conrelid <> c.confrelid
    ORDER BY 1, 2
  LOOP
    EXECUTE format('INSERT INTO private.d10_pos_unconfirmed_delete_backup_v1 (kind, table_name, row_data)
                    SELECT ''deleted_row'', %L, to_jsonb(t) FROM %s t WHERE t.%I = ANY ($1)', fk.tbl, fk.tbl, fk.col) USING v_ids;
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) USING v_ids;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO private.d10_pos_unconfirmed_delete_backup_v1 (kind, table_name, row_data)
      VALUES ('report', 'refs_deleted', jsonb_build_object('table', fk.tbl || '.' || fk.col, 'rows', v_n));
    END IF;
  END LOOP;

  INSERT INTO private.d10_pos_unconfirmed_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.lexemes', to_jsonb(l) FROM public.lexemes l WHERE l.id = ANY (v_ids);
  DELETE FROM public.lexemes WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO private.d10_pos_unconfirmed_delete_backup_v1 (kind, table_name, row_data)
  VALUES ('report', 'deleted', jsonb_build_object('cards', v_n));
END
$mig$;

SELECT table_name AS part, row_data AS info FROM private.d10_pos_unconfirmed_delete_backup_v1
WHERE kind = 'report' ORDER BY id;

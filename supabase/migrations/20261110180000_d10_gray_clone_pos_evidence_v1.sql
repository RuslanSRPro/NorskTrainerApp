-- D10_gray_clone_pos_evidence_v1 (10.11.2026, agreed after 428 / 429):
-- 1. A part-of-speech clone (sende noun: Ordbøkene and NAOB know only the verb) no longer gets a NEW
--    grey card unless at least one dictionary confirms that part of speech for this word:
--    a source check of the item from Ordbokene, NAOB or Lexin with found = true and pos_match = 'match'.
--    Wiktionary does not count yet (decision later). No confirmation -> the item stays at admission_gate
--    (it is listed in the problem words as "part of speech not confirmed"), no card is created.
--    Unchanged: linking to an existing card, the "several Ordbøkene articles" path, the NAOB division
--    of a noun (brenne noun: NAOB heading "substantiv" = match, so its card is still created).
--    Patched in place (one anchor, must match exactly once, otherwise nothing changes). Re-run = no-op.
-- 2. The grey clone card sende noun (ff89ed2d), recreated by today's analysis, is deleted again with
--    every row referencing it; everything saved in private.d10_gray_clone_delete_backup_v1.

do $patch$
declare
  v_def text := pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure);
  v_old text := $o$if v_lexeme_id is null and not v_item.is_clone and not v_item.is_ambiguous then$o$;
  v_new text := $n$-- D10 10.11.2026 (agreed, d10_gray_clone_pos_evidence_v1): a NEW card for a part-of-speech
    -- clone only when a dictionary confirms the part of speech (Ordbokene / NAOB / Lexin pos_match).
    if v_lexeme_id is null and v_item.is_clone and not v_item.is_ambiguous and not exists (
      select 1 from public.lexeme_source_checks sc
      where sc.item_id = v_item.id and sc.status in ('done', 'partial') and sc.found is true
        and sc.source in ('Ordbokene', 'NAOB', 'Lexin')
        and sc.evidence->>'pos_match' = 'match'
    ) then
      update public.lexeme_processing_items i
      set result_summary = coalesce(i.result_summary, '{}'::jsonb) || jsonb_build_object(
            'gray_skip_reason', 'POS_NOT_CONFIRMED_BY_DICTIONARY',
            'gray_skip_version', 'd10_gray_clone_pos_evidence_v1'),
          updated_at = now()
      where i.id = v_item.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_lexeme_id is null and not v_item.is_clone and not v_item.is_ambiguous then$n$;
  v_count integer;
begin
  if position('d10_gray_clone_pos_evidence_v1' in v_def) > 0 then
    raise notice 'grey clone POS evidence rule already installed';
    return;
  end if;
  if position('d10_gray_existing_card_v2' in v_def) = 0 then
    raise exception 'd10_promote_gray_pos_clones_v1 is not the expected version; nothing changed';
  end if;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 1 then
    raise exception 'anchor found % times in d10_promote_gray_pos_clones_v1 (expected 1); nothing changed', v_count;
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

CREATE TABLE IF NOT EXISTS private.d10_gray_clone_delete_backup_v1 (
  id bigserial PRIMARY KEY, kind text NOT NULL, table_name text NOT NULL, row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_gray_clone_delete_backup_v1 FROM PUBLIC;

DO $del$
DECLARE
  fk record; v_n integer; v_ids uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM private.d10_gray_clone_delete_backup_v1 WHERE kind = 'report') THEN
    RAISE NOTICE 'sende noun already deleted by this migration';
    RETURN;
  END IF;
  SELECT coalesce(array_agg(l.id), '{}') INTO v_ids FROM public.lexemes l
  WHERE l.id = 'ff89ed2d-dc88-4555-9eff-8a31b8dce3a1' AND l.lemma = 'sende' AND l.pos = 'noun'
    AND coalesce(l.verification_tier, '') NOT IN ('dictionary_entry', 'dictionary_match');
  IF cardinality(v_ids) = 0 THEN
    RAISE NOTICE 'sende noun ff89ed2d not found (or confirmed); nothing deleted';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.expression_catalog e WHERE e.lexeme_id = ANY (v_ids)) THEN
    RAISE EXCEPTION 'STOP: an expression is linked to sende noun; nothing deleted';
  END IF;

  INSERT INTO private.d10_gray_clone_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'report', 'selected', jsonb_build_object('lemma', l.lemma, 'pos', l.pos, 'id', l.id, 'tier', l.verification_tier)
  FROM public.lexemes l WHERE l.id = ANY (v_ids);

  FOR fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1 AND c.confrelid = 'public.lexemes'::regclass
      AND c.conrelid <> c.confrelid
    ORDER BY 1, 2
  LOOP
    EXECUTE format('INSERT INTO private.d10_gray_clone_delete_backup_v1 (kind, table_name, row_data)
                    SELECT ''deleted_row'', %L, to_jsonb(t) FROM %s t WHERE t.%I = ANY ($1)', fk.tbl, fk.tbl, fk.col) USING v_ids;
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) USING v_ids;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO private.d10_gray_clone_delete_backup_v1 (kind, table_name, row_data)
      VALUES ('report', 'refs_deleted', jsonb_build_object('table', fk.tbl || '.' || fk.col, 'rows', v_n));
    END IF;
  END LOOP;

  INSERT INTO private.d10_gray_clone_delete_backup_v1 (kind, table_name, row_data)
  SELECT 'deleted_row', 'public.lexemes', to_jsonb(l) FROM public.lexemes l WHERE l.id = ANY (v_ids);
  DELETE FROM public.lexemes WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO private.d10_gray_clone_delete_backup_v1 (kind, table_name, row_data)
  VALUES ('report', 'deleted', jsonb_build_object('cards', v_n));
END
$del$;

SELECT 'rule' AS part,
       jsonb_build_object('installed', position('d10_gray_clone_pos_evidence_v1' in
         pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0) AS info
UNION ALL
SELECT table_name, row_data FROM private.d10_gray_clone_delete_backup_v1 WHERE kind = 'report';

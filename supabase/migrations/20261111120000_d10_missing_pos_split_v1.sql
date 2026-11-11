-- D10_missing_pos_split_v1 (11.11.2026, agreed after 443 / 445): a NEW word without a known part of speech
-- whose sources show several parts of speech (stemme: Lexin / Wiktionary noun + verb, Ordbøkene three
-- articles) stopped at admission_gate with unknown_pos_requires_review and was never processed.
-- Now expand_multi_pos_occurrences_for_job splits such an item: the item itself takes the first part of
-- speech and its source checks are queued again (now WITH that part of speech); every other part of speech
-- gets its own clone, exactly as for a word with a known part of speech. Each part of speech is then
-- verified on its own: a card still needs its own dictionary evidence (no AI part of speech, the grey
-- clone rule v2 is unchanged). Only noun / verb / adjective / determiner, as for the existing clones.
-- Patched in place (one anchor, must match exactly once, otherwise nothing changes). Re-run = no-op.
do $patch$
declare
  v_def text := pg_get_functiondef('public.expand_multi_pos_occurrences_for_job(uuid)'::regprocedure);
  v_old text := $o$    if nullif(v_item.existing_pos, '') is null then
      -- Ambiguous missing POS requires identity resolution; do not pick array[1].
      continue;
    elsif v_is_text_job$o$;
  v_new text := $n$    if nullif(v_item.existing_pos, '') is null then
      -- D10 11.11.2026 (agreed, d10_missing_pos_split_v1): several parts of speech in the evidence and
      -- none known -> the item takes the first one (its checks run again with it), the rest are cloned below.
      v_pos_array := array(select p from unnest(v_pos_array) p
                           where p in ('noun', 'verb', 'adjective', 'determiner'));
      if array_length(v_pos_array, 1) is null then
        continue;
      end if;
      update public.lexeme_processing_items
      set pos = v_pos_array[1],
          status = 'pending',
          current_stage = 'source_checks',
          attempt_count = 0,
          next_retry_at = null,
          last_error = null,
          result_summary = coalesce(result_summary, '{}'::jsonb) || jsonb_build_object(
            'pos_source', 'missing_pos_split',
            'pos_split_all', to_jsonb(v_pos_array),
            'pos_version', 'd10_missing_pos_split_v1'),
          updated_at = now()
      where id = v_item.item_id
        and nullif(pos, '') is null
        and lexeme_id is null
        and current_stage in ('source_checks', 'admission_gate');
      if not found then
        continue;
      end if;
      update public.lexeme_source_checks
      set status = 'pending', attempt_count = 0, evidence = '{}'::jsonb, urls = '[]'::jsonb,
          authoritative_relations = '[]'::jsonb, updated_at = now()
      where item_id = v_item.item_id;
      v_cloned := v_cloned + 1;
      v_item.existing_pos := v_pos_array[1];
      v_pos_array := v_pos_array[2:];
      if array_length(v_pos_array, 1) is null then
        continue;
      end if;
    end if;
    if false then
      null;
    elsif v_is_text_job$n$;
  v_count integer;
begin
  if position('d10_missing_pos_split_v1' in v_def) > 0 then
    raise notice 'missing POS split already installed';
    return;
  end if;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 1 then
    raise exception 'anchor found % times in expand_multi_pos_occurrences_for_job (expected 1); nothing changed', v_count;
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

SELECT position('d10_missing_pos_split_v1' in
  pg_get_functiondef('public.expand_multi_pos_occurrences_for_job(uuid)'::regprocedure)) > 0 AS installed;

-- D10 (agreed 25.10.2026): display_form of a NEW second card.
-- The two functions that create second cards stored display_form = lemma, so a
-- verb card lost "å" (brenne I -> "brenne", main card "å brenne").
-- Now: verb -> 'å ' || lemma, any other part of speech -> lemma (unchanged;
-- a noun's article is NOT copied from the main card: its gender can differ).
-- One text replacement in each function; everything else stays as it is.
-- Existing cards are fixed by scripts/d10/173 (data), not here.
-- Repeatable: an already patched function is left alone.

do $patch$
declare
  v_fn text;
  v_def text;
  v_old text;
  v_new text;
  v_count integer;
  v_src text;
begin
  foreach v_fn in array array[
    'public.d10_record_homograph_decision_v1(uuid,bigint,text,integer,uuid,jsonb)',
    'public.d10_record_naob_homograph_v1(uuid,text,text,integer,text,jsonb,uuid)'] loop
    v_src := case when v_fn like '%naob%' then 'd10_naob_homograph_card' else 'd10_homograph_card' end;
    v_def := pg_get_functiondef(v_fn::regprocedure);
    v_old := 'v_main.lemma, v_main.pos, v_key, v_main.lemma, ''' || v_src || '''';
    v_new := 'v_main.lemma, v_main.pos, v_key, '
          || 'CASE WHEN v_main.pos = ''verb'' THEN ''å '' || v_main.lemma ELSE v_main.lemma END, '''
          || v_src || '''';
    if position('CASE WHEN v_main.pos = ''verb'' THEN ''å '' || v_main.lemma' in v_def) > 0 then
      raise notice '% already patched', v_fn;
      continue;
    end if;
    v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_count <> 1 then
      raise exception 'anchor found % times in % (expected 1); nothing changed', v_count, v_fn;
    end if;
    execute replace(v_def, v_old, v_new);
    raise notice '% patched', v_fn;
  end loop;
end
$patch$;

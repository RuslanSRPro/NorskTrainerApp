-- D10 20.10.2026 (agreed): a second card hidden from learning (dictionary
-- status 'excluded', e.g. bære II) is no longer added to new jobs by the
-- homograph step ("second cards created in earlier jobs").
-- Point change of d10_existing_homograph_cards_for_job_v1: one condition.
-- Stops if the anchor is not found exactly once. Re-running is safe.

do $patch$
declare
  v_def text := pg_get_functiondef('public.d10_existing_homograph_cards_for_job_v1(uuid)'::regprocedure);
  v_anchor text := $a$JOIN public.lexemes c ON c.lemma = m.lemma AND c.pos = m.pos AND c.homograph_key <> ''$a$;
  v_count integer;
begin
  if position('d10_skip_excluded' in v_def) > 0 then
    raise notice 'd10_existing_homograph_cards_for_job_v1 already skips excluded cards';
    return;
  end if;
  v_count := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then
    raise exception 'anchor found % times in d10_existing_homograph_cards_for_job_v1 (expected 1); nothing changed', v_count;
  end if;
  execute replace(v_def, v_anchor,
    v_anchor || $r$
    AND c.dictionary_status IS DISTINCT FROM 'excluded'  -- d10_skip_excluded (20.10.2026)$r$);
end
$patch$;

do $$ begin raise notice 'd10 homograph skip excluded v1 installed'; end $$;

-- D10_gray_clone_pos_evidence_v2 (10.11.2026, after 432): addition to v1.
-- A source confirms the part of speech of a part-of-speech clone only with a REGISTERED entry
-- (registered_entry = true) of that part of speech. 432 showed NAOB "noun" for sende / slenge / fatt
-- only from the NAOB search list (naob_search_listing, registered_entry = false): no article was
-- confirmed, so it no longer counts. Lexin with a registered entry (fatt noun) still counts.
-- Patched in place (one anchor, must match exactly once, otherwise nothing changes). Re-run = no-op.

do $patch$
declare
  v_def text := pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure);
  v_old text := $o$and sc.evidence->>'pos_match' = 'match'$o$;
  v_new text := $n$and sc.evidence->>'pos_match' = 'match'
        -- d10_gray_clone_pos_evidence_v2: only a registered entry of this part of speech
        and coalesce(sc.registered_entry::text, '') = 'true'$n$;
  v_count integer;
begin
  if position('d10_gray_clone_pos_evidence_v2' in v_def) > 0 then
    raise notice 'grey clone POS evidence v2 already installed';
    return;
  end if;
  if position('d10_gray_clone_pos_evidence_v1' in v_def) = 0 then
    raise exception 'D10_gray_clone_pos_evidence_v1 is not installed; nothing changed';
  end if;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 1 then
    raise exception 'anchor found % times in d10_promote_gray_pos_clones_v1 (expected 1); nothing changed', v_count;
  end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;

SELECT position('d10_gray_clone_pos_evidence_v2' in
  pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0 AS v2_installed;

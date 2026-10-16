-- D10 16.10.2026 (agreed): a function-word rule without a part of speech
-- (ved -> function_word_preposition) no longer rejects the same word as a
-- noun / verb / adjective when Ordbøkene confirmed a Bokmål article of that
-- part of speech for this item ("Jeg brenner ved": ved = firewood, noun).
-- The preposition ved is still rejected. dictionary_admission_decision and
-- the rules table are unchanged.
--
-- 1. d10_admission_decision_v1(evidence, ...) = dictionary_admission_decision,
--    with that one exception.
-- 2. promote_verification_results_for_job(uuid, integer): the single call of
--    dictionary_admission_decision is replaced by the function above. Point
--    replacement; the migration stops if the live definition is not the one
--    of query 130 (md5 bdea5416...). Re-running is safe.

create or replace function public.d10_admission_decision_v1(
  p_evidence jsonb,
  p_lemma text,
  p_surface_form text default null,
  p_pos text default null,
  p_match_type text default 'token',
  p_verification_tier text default null)
returns jsonb
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_decision jsonb := public.dictionary_admission_decision(
    p_lemma, p_surface_form, p_pos, p_match_type, p_verification_tier);
  v_pos text := lower(btrim(coalesce(p_pos, '')));
  v_ord jsonb := p_evidence -> 'Ordbokene';
  v_rule_pos text;
begin
  if coalesce((v_decision ->> 'admit')::boolean, false)
     or v_decision ->> 'rule_type' is distinct from 'function_word'
     or v_pos not in ('noun', 'verb', 'adjective')
     or v_ord is null then
    return v_decision;
  end if;

  -- Only a rule written without a part of speech.
  select r.pos into v_rule_pos
  from public.dictionary_admission_rules r
  where r.id::text = v_decision ->> 'rule_id';
  if not found or v_rule_pos is not null then
    return v_decision;
  end if;

  -- Ordbøkene confirmed an own Bokmål article of this part of speech.
  if (v_ord ->> 'found') = 'true'
     and (v_ord ->> 'registered_entry') = 'true'
     and v_ord -> 'evidence' -> 'raw_preview' ->> 'dictionary_code' = 'bm'
     and lower(v_ord -> 'evidence' -> 'raw_preview' ->> 'pos') = v_pos
     and jsonb_typeof(v_ord -> 'evidence' -> 'raw_preview' -> 'article_ids') = 'array'
     and jsonb_array_length(v_ord -> 'evidence' -> 'raw_preview' -> 'article_ids') > 0 then
    return jsonb_build_object(
      'admit', true,
      'status', 'allowed',
      'reason', 'lexical_pos_ordbokene_article',
      'overridden_rule_id', v_decision ->> 'rule_id',
      'overridden_reason', v_decision ->> 'reason');
  end if;

  return v_decision;
end;
$$;

do $patch$
declare
  v_def text := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);
  -- line endings of the live definition may be CRLF
  v_pattern text := '(public\.dictionary_admission_decision\()(\r?\n)([ ]+)(rs\.normalized_lemma,)';
  v_count integer;
begin
  if position('public.d10_admission_decision_v1(' in v_def) > 0 then
    raise notice 'promote_verification_results_for_job already uses d10_admission_decision_v1';
    return;
  end if;
  if md5(v_def) <> 'bdea5416fa24823204abcb300b6a5745' then
    raise exception 'promote_verification_results_for_job differs from query 130 (md5 %); nothing changed', md5(v_def);
  end if;
  select count(*) into v_count from regexp_matches(v_def, v_pattern, 'g');
  if v_count <> 1 then
    raise exception 'admission call found % times (expected 1); nothing changed', v_count;
  end if;
  execute regexp_replace(v_def, v_pattern,
    'public.d10_admission_decision_v1(\2\3rs.verification_evidence,\2\3\4');
end
$patch$;

do $$ begin raise notice 'd10 function word pos v1 installed'; end $$;

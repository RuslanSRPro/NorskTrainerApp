-- DRAFT R140 (repo proof R133): single pronoun paradigm source for the TS operator.
-- APPLY ONLY AFTER EXPLICIT APPROVAL.
--
-- What it does: adds ONE read-only reader, public.pronoun_paradigm_pairs_v1(release_code),
-- over the existing release-bound table grammar_runtime_release_pronoun_paradigm_v1
-- (the same table the SQL conveyor already uses via pronoun_case_evidence_v2).
-- The Edge function canonical-graph-shadow-v1 will read its pairs from here instead of
-- its embedded copy.
--
-- What it does NOT do: no table changes, no row changes, no release status changes,
-- no activation, no change of any existing function. Execute only for service_role.
--
-- Gate (inside the transaction; any failure rolls everything back):
--   * v1.38 returns exactly the 9 source pairs of NRG 4.1.1 (candidate d99c8781);
--   * v1.37 returns 0 rows (its Edge path keeps the embedded fallback, behaviour unchanged);
--   * pronoun_paradigm_source_drift_v1() returns 0 rows;
--   * anon/authenticated cannot execute the new function.
-- Rollback after a successful apply: drop function public.pronoun_paradigm_pairs_v1(text);
-- Result: single column r140.

begin;

create or replace function public.pronoun_paradigm_pairs_v1(p_release_code text)
returns table(lemma text, nominative text, accusative text, source_candidate_id uuid)
language sql
stable
set search_path = pg_catalog, public
as $$
  select e.lemma, e.nominative, e.accusative, e.candidate_id
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_pronoun_paradigm_v1 e
    on e.release_id = rel.id and e.is_enabled
  where rel.code = p_release_code
  order by e.lemma;
$$;

comment on function public.pronoun_paradigm_pairs_v1(text) is
  'R133 single source: release-bound personal pronoun paradigm (NRG 4.1.1) for the TS candidate operator. Read-only.';

revoke all on function public.pronoun_paradigm_pairs_v1(text) from public, anon, authenticated;
grant execute on function public.pronoun_paradigm_pairs_v1(text) to service_role;

do $gate$
declare
  v_expected text := 'de>dem|den>den|dere>dere|det>det|du>deg|han>ham|hun>henne|jeg>meg|vi>oss';
  v_got text;
  v_sources int;
  v_v137 int;
  v_drift int;
begin
  select string_agg(nominative || '>' || accusative, '|' order by nominative),
         count(distinct source_candidate_id)
    into v_got, v_sources
  from public.pronoun_paradigm_pairs_v1('runtime-structural-v1.38');
  if v_got is distinct from v_expected then
    raise exception 'R140_ABORT: v1.38 pairs mismatch: %', coalesce(v_got, '<none>');
  end if;
  if v_sources <> 1 or not exists (select 1 from public.pronoun_paradigm_pairs_v1('runtime-structural-v1.38')
                                   where source_candidate_id = 'd99c8781-1212-45ed-a490-df7cfa105ede') then
    raise exception 'R140_ABORT: source candidate mismatch';
  end if;
  select count(*) into v_v137 from public.pronoun_paradigm_pairs_v1('runtime-structural-v1.37');
  if v_v137 <> 0 then
    raise exception 'R140_ABORT: v1.37 unexpectedly has % paradigm rows', v_v137;
  end if;
  select count(*) into v_drift from public.pronoun_paradigm_source_drift_v1();
  if v_drift <> 0 then
    raise exception 'R140_ABORT: source drift rows: %', v_drift;
  end if;
  if has_function_privilege('anon', 'public.pronoun_paradigm_pairs_v1(text)', 'execute')
     or has_function_privilege('authenticated', 'public.pronoun_paradigm_pairs_v1(text)', 'execute') then
    raise exception 'R140_ABORT: function executable by anon/authenticated';
  end if;
end
$gate$;

commit;

select jsonb_pretty(jsonb_build_object(
  'observed_at_utc', now(),
  'function', 'public.pronoun_paradigm_pairs_v1(text)',
  'v138_pairs', (select jsonb_agg(jsonb_build_array(nominative, accusative) order by nominative)
                 from public.pronoun_paradigm_pairs_v1('runtime-structural-v1.38')),
  'v137_rows', (select count(*) from public.pronoun_paradigm_pairs_v1('runtime-structural-v1.37')),
  'drift_rows', (select count(*) from public.pronoun_paradigm_source_drift_v1()),
  'anon_exec', has_function_privilege('anon', 'public.pronoun_paradigm_pairs_v1(text)', 'execute'),
  'auth_exec', has_function_privilege('authenticated', 'public.pronoun_paradigm_pairs_v1(text)', 'execute'),
  'service_exec', has_function_privilege('service_role', 'public.pronoun_paradigm_pairs_v1(text)', 'execute'),
  'gate', 'passed'
)) as r140;

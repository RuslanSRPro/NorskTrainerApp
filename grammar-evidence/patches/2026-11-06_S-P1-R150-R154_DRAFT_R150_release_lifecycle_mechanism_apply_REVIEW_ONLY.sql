-- ============================================================================
-- DRAFT_R150_release_lifecycle_mechanism_apply_REVIEW_ONLY.sql
-- Пакет 1, применение МЕХАНИЗМА (без смены статусов релизов). Применять в Production только после явного «да» владельца.
--
-- Что делает (одна транзакция):
--   1) resolve_construction_recognition_v1: guard статуса расширяется до ('build','golden','shadow','canary','active')
--      из текущего текста функции, ровно одно вхождение (R147; проверено в R148);
--   2) создаёт таблицы grammar_runtime_release_canary_users_v1 / _gates_v1 / _transitions_v1 (RLS, без доступа anon/authenticated);
--   3) создаёт функции runtime_release_rpc_path_check_v1, runtime_release_baseline_parity_v1 (только диагностика),
--      runtime_release_gate_report_v1, promote_runtime_release_v1, demote_runtime_release_v1, select_runtime_release_v1;
--      EXECUTE только у service_role (public/anon/authenticated — отозвано);
--   4) регистрирует gate для v1.38: run_pronoun_case_authority_golden_v1.
-- Чего НЕ делает: не меняет статус ни одного релиза, не добавляет canary-пользователей, не трогает Edge.
--   Селектор пока отдаёт резерв v1.37 — поведение приложения не меняется.
-- GATE внутри транзакции (иначе ошибка и полный откат):
--   путь RPC v140 для v1.37 и v1.38 ok; golden v1.38 по местоимениям ok (63/63); селектор = v1.37 (fallback);
--   статусы релизов не изменились; у anon/authenticated нет EXECUTE на новые функции; guard расширен.
-- Ожидаемый вывод: одна строка «R150 applied: ...» (и NOTICE R150_GATE_OK с деталями). При сбое — ошибка R150_GATE_FAILED, всё откатилось.
-- Ручной откат после успеха: drop 6 новых функций и 3 таблиц; вернуть guard ('build','golden','shadow') тем же способом.
-- Следующий шаг (отдельно): shadow-батч v1.38 → promote_runtime_release_to_shadow_v2 → bootstrap v1.37 active → v1.38 canary (владелец).
-- ============================================================================
begin;
set local statement_timeout = '15min';
create temp table r150_status_before on commit drop as select id, status from public.grammar_runtime_releases;

-- R147: widen the release-status guard of resolve_construction_recognition_v1 (only in-chain function rejecting canary/active)
do $p$
declare d text; old_g text := 'r.status in (''build'',''golden'',''shadow'')';
        new_g text := 'r.status in (''build'',''golden'',''shadow'',''canary'',''active'')'; n int;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'resolve_construction_recognition_v1';
  if d is null then raise exception 'R150_guard_patch: resolve_construction_recognition_v1 not found'; end if;
  if (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'resolve_construction_recognition_v1') <> 1 then
    raise exception 'R150_guard_patch: overloaded function, refusing';
  end if;
  n := (length(d) - length(replace(d, old_g, ''))) / length(old_g);
  if n <> 1 then raise exception 'R150_guard_patch: expected exactly 1 guard occurrence, found %', n; end if;
  execute replace(d, old_g, new_g);
end $p$;

create table public.grammar_runtime_release_canary_users_v1 (
  release_id uuid not null references public.grammar_runtime_releases(id),
  user_id    uuid not null,
  added_at   timestamptz not null default now(),
  note       text,
  primary key (release_id, user_id)
);
alter table public.grammar_runtime_release_canary_users_v1 enable row level security;
revoke all on public.grammar_runtime_release_canary_users_v1 from public, anon, authenticated;

create table public.grammar_runtime_release_gates_v1 (
  release_id    uuid not null references public.grammar_runtime_releases(id),
  gate_function text not null check (gate_function ~ '^run_[a-z0-9_]+_golden_v[0-9]+$'),
  required_for  text[] not null default array['canary','active'],
  added_at      timestamptz not null default now(),
  primary key (release_id, gate_function)
);
alter table public.grammar_runtime_release_gates_v1 enable row level security;
revoke all on public.grammar_runtime_release_gates_v1 from public, anon, authenticated;

create table public.grammar_runtime_release_transitions_v1 (
  id          bigint generated always as identity primary key,
  release_id  uuid not null references public.grammar_runtime_releases(id),
  from_status text not null,
  to_status   text not null,
  mode        text not null,
  gates       jsonb not null default '{}'::jsonb,
  reason      text,
  actor       text not null default current_user,
  created_at  timestamptz not null default now()
);
alter table public.grammar_runtime_release_transitions_v1 enable row level security;
revoke all on public.grammar_runtime_release_transitions_v1 from public, anon, authenticated;

-- RPC v140 path: 3 sentences, explicit release, legacy_index from 1; must not fail and must keep the token count.
-- Structural integrity only (no dictionary-dependent expectations).
create or replace function public.runtime_release_rpc_path_check_v1(p_release_code text)
returns jsonb language plpgsql volatile set search_path to 'public','pg_catalog' as $f$
declare s record; r jsonb; n_out int; ok boolean := true; res jsonb := '[]'::jsonb;
begin
  for s in select * from (values
    ('Jeg sover', '[{"legacy_index":1,"canonical_token_id":"g0","surface":"Jeg","normalized_surface":"jeg","kind":"word"},
                    {"legacy_index":2,"canonical_token_id":"g1","surface":"sover","normalized_surface":"sover","kind":"word"}]'::jsonb),
    ('Meg ser han', '[{"legacy_index":1,"canonical_token_id":"g0","surface":"Meg","normalized_surface":"meg","kind":"word"},
                      {"legacy_index":2,"canonical_token_id":"g1","surface":"ser","normalized_surface":"ser","kind":"word"},
                      {"legacy_index":3,"canonical_token_id":"g2","surface":"han","normalized_surface":"han","kind":"word"}]'::jsonb),
    ('I dag leser hun boka', '[{"legacy_index":1,"canonical_token_id":"g0","surface":"I","normalized_surface":"i","kind":"word"},
                               {"legacy_index":2,"canonical_token_id":"g1","surface":"dag","normalized_surface":"dag","kind":"word"},
                               {"legacy_index":3,"canonical_token_id":"g2","surface":"leser","normalized_surface":"leser","kind":"word"},
                               {"legacy_index":4,"canonical_token_id":"g3","surface":"hun","normalized_surface":"hun","kind":"word"},
                               {"legacy_index":5,"canonical_token_id":"g4","surface":"boka","normalized_surface":"boka","kind":"word"}]'::jsonb)
  ) v(txt, toks) loop
    begin
      r := public.run_canonical_legacy_compatibility_v140(s.toks, p_release_code);
      n_out := case when jsonb_typeof(r#>'{language_graph,tokens}') = 'array'
                    then jsonb_array_length(r#>'{language_graph,tokens}') else 0 end;
      if n_out <> jsonb_array_length(s.toks) then ok := false; end if;
      res := res || jsonb_build_array(jsonb_build_object('text', s.txt, 'tokens_in', jsonb_array_length(s.toks),
               'tokens_out', n_out,
               'subject_authority', r#>>'{language_graph,pronoun_subject_authority_v1,status}',
               'subject_token_index', r#>'{language_graph,pronoun_subject_authority_v1,subject_token_index}'));
    exception when others then
      ok := false;
      res := res || jsonb_build_array(jsonb_build_object('text', s.txt, 'error', left(sqlerrm, 200)));
    end;
  end loop;
  return jsonb_build_object('ok', ok, 'release_code', p_release_code, 'cases', res);
end $f$;

-- Diagnostic only (R144): v1.37 parity with the stored 2026-09-01 projections (batch 90e7c9c2). Not part of any gate.
create or replace function public.runtime_release_baseline_parity_v1()
returns jsonb language plpgsql volatile set search_path to 'public','pg_catalog' as $f$
declare c record; pp jsonb; cmp jsonb; parity int := 0; total int := 0; diff jsonb := '[]'::jsonb;
begin
  for c in select cmpr.case_code, cmpr.input_text, cmpr.shadow_projection sept1
             from public.grammar_shadow_v2_comparisons cmpr
            where cmpr.batch_id = '90e7c9c2-62ee-4ff1-8686-b89d4c3df72b' and cmpr.execution_status = 'completed'
            order by cmpr.case_code loop
    pp := public.project_structural_grammar_shadow_v2(coalesce(
            public.analyze_text_structural_shadow_v37(c.input_text, 'runtime-structural-v1.37')#>'{document_graph,sentences,0,analysis}', '{}'));
    cmp := public.compare_grammar_shadow_v2(c.sept1, pp);
    total := total + 1;
    if cmp->>'classification' = 'parity' then parity := parity + 1;
    else diff := diff || jsonb_build_array(jsonb_build_object('case', c.case_code, 'classification', cmp->>'classification'));
    end if;
  end loop;
  return jsonb_build_object('ok', total = 34 and parity = 34, 'parity', parity, 'total', total,
                            'reference_batch', '90e7c9c2', 'diff', diff);
end $f$;

-- All checks for one transition. Release gates: public run_*_golden_vN(release_code, ...) -> jsonb with "ok".
create or replace function public.runtime_release_gate_report_v1(p_release_code text, p_target text, p_mode text default 'normal')
returns jsonb language plpgsql volatile set search_path to 'public','pg_catalog' as $f$
declare rel record; g record; gr jsonb; gates jsonb := '[]'::jsonb; ok boolean := true; rpc jsonb; base jsonb;
begin
  select * into rel from public.grammar_runtime_releases where code = p_release_code;
  if not found then raise exception 'release_not_found: %', p_release_code; end if;
  for g in select gate_function from public.grammar_runtime_release_gates_v1
            where release_id = rel.id and p_target = any(required_for) order by gate_function loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = g.gate_function and p.pronargs >= 1
                      and p.proargtypes[0] = 'text'::regtype and p.prorettype = 'jsonb'::regtype) then
      ok := false;
      gates := gates || jsonb_build_array(jsonb_build_object('gate', g.gate_function, 'ok', false, 'error', 'gate_function_missing'));
      continue;
    end if;
    begin
      execute format('select public.%I($1)', g.gate_function) into gr using p_release_code;
      gates := gates || jsonb_build_array(jsonb_build_object('gate', g.gate_function,
                 'ok', coalesce((gr->>'ok')::boolean, false), 'passed', gr->'passed', 'total', gr->'total',
                 'detail', case when coalesce((gr->>'ok')::boolean, false) then null else left(gr::text, 600) end));
      if not coalesce((gr->>'ok')::boolean, false) then ok := false; end if;
    exception when others then
      ok := false;
      gates := gates || jsonb_build_array(jsonb_build_object('gate', g.gate_function, 'ok', false, 'error', left(sqlerrm, 300)));
    end;
  end loop;
  if p_mode <> 'baseline_bootstrap' and jsonb_array_length(gates) = 0 then
    ok := false;  -- a non-baseline release must declare at least one golden gate
    gates := gates || jsonb_build_array(jsonb_build_object('gate', 'declared_gates', 'ok', false, 'error', 'no_gates_registered'));
  end if;
  rpc := public.runtime_release_rpc_path_check_v1(p_release_code);
  ok := ok and coalesce((rpc->>'ok')::boolean, false);  -- baseline parity is diagnostic only (R144)
  return jsonb_build_object('ok', ok, 'release_code', p_release_code, 'target', p_target, 'mode', p_mode,
                            'release_gates', gates, 'rpc_path', rpc);  -- baseline parity: separate diagnostic, not a gate (R144)
end $f$;

create or replace function public.promote_runtime_release_v1(p_release_code text, p_target text,
                                                              p_mode text default 'normal', p_reason text default null)
returns jsonb language plpgsql volatile set search_path to 'public','pg_catalog' as $f$
declare rel record; prev record; rep jsonb; prev_code text;
begin
  select * into rel from public.grammar_runtime_releases where code = p_release_code for update;
  if not found then raise exception 'release_not_found: %', p_release_code; end if;
  if p_mode not in ('normal', 'baseline_bootstrap') then raise exception 'mode_invalid: %', p_mode; end if;
  if not (
       (p_mode = 'normal' and rel.status = 'shadow' and p_target = 'canary')
    or (p_mode = 'normal' and rel.status = 'canary' and p_target = 'active')
    or (p_mode = 'baseline_bootstrap' and rel.status = 'shadow' and p_target = 'active'
        and not exists (select 1 from public.grammar_runtime_releases where status in ('active', 'canary')))
  ) then
    raise exception 'transition_not_allowed: % % -> % (mode %)', p_release_code, rel.status, p_target, p_mode;
  end if;
  rep := public.runtime_release_gate_report_v1(p_release_code, p_target, p_mode);
  if not coalesce((rep->>'ok')::boolean, false) then
    raise exception 'gate_failed: %', left(rep::text, 1500);
  end if;
  if p_target = 'active' then
    select * into prev from public.grammar_runtime_releases where status = 'active' and id <> rel.id for update;
    if found then
      prev_code := prev.code;
      update public.grammar_runtime_releases
         set status = 'shadow',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('displaced_by_release', p_release_code,
                                                                              'displaced_at', now())
       where id = prev.id;
      insert into public.grammar_runtime_release_transitions_v1(release_id, from_status, to_status, mode, gates, reason)
      values (prev.id, 'active', 'shadow', p_mode, '{}'::jsonb, 'displaced by ' || p_release_code);
    end if;
    update public.grammar_runtime_releases
       set status = 'active', activated_at = now(),
           golden_passed_at = coalesce(golden_passed_at, now()),
           metadata = (coalesce(metadata, '{}'::jsonb) - 'displaced_by_release' - 'displaced_at')
                      || jsonb_build_object('previous_active_code', prev_code)
     where id = rel.id;
  else
    update public.grammar_runtime_releases
       set status = p_target, golden_passed_at = coalesce(golden_passed_at, now())
     where id = rel.id;
  end if;
  insert into public.grammar_runtime_release_transitions_v1(release_id, from_status, to_status, mode, gates, reason)
  values (rel.id, rel.status, p_target, p_mode, rep, p_reason);
  return jsonb_build_object('ok', true, 'release_code', p_release_code, 'from', rel.status, 'to', p_target,
                            'previous_active', prev_code, 'gates_ok', true);
end $f$;

create or replace function public.demote_runtime_release_v1(p_release_code text, p_reason text default null)
returns jsonb language plpgsql volatile set search_path to 'public','pg_catalog' as $f$
declare rel record; prev_code text; restored text;
begin
  select * into rel from public.grammar_runtime_releases where code = p_release_code for update;
  if not found then raise exception 'release_not_found: %', p_release_code; end if;
  if rel.status = 'canary' then
    update public.grammar_runtime_releases set status = 'shadow' where id = rel.id;
  elsif rel.status = 'active' then
    prev_code := rel.metadata->>'previous_active_code';
    update public.grammar_runtime_releases set status = 'shadow' where id = rel.id;
    if prev_code is not null then
      update public.grammar_runtime_releases
         set status = 'active', metadata = metadata - 'displaced_by_release' - 'displaced_at'
       where code = prev_code and status = 'shadow' and metadata->>'displaced_by_release' = p_release_code
      returning code into restored;
      if restored is not null then
        insert into public.grammar_runtime_release_transitions_v1(release_id, from_status, to_status, mode, reason)
        select id, 'shadow', 'active', 'rollback', 'restored after demote of ' || p_release_code
          from public.grammar_runtime_releases where code = restored;
      end if;
    end if;
  else
    raise exception 'demote_not_allowed: % is %', p_release_code, rel.status;
  end if;
  insert into public.grammar_runtime_release_transitions_v1(release_id, from_status, to_status, mode, reason)
  values (rel.id, rel.status, 'shadow', 'rollback', p_reason);
  return jsonb_build_object('ok', true, 'release_code', p_release_code, 'from', rel.status, 'to', 'shadow',
                            'restored_active', restored);
end $f$;

create or replace function public.select_runtime_release_v1(p_user_id uuid default null)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $f$
declare c text;
begin
  if p_user_id is not null then
    select r.code into c
      from public.grammar_runtime_release_canary_users_v1 u
      join public.grammar_runtime_releases r on r.id = u.release_id
     where u.user_id = p_user_id and r.status = 'canary'
     order by u.added_at desc limit 1;
    if c is not null then return jsonb_build_object('release_code', c, 'origin', 'canary'); end if;
  end if;
  select code into c from public.grammar_runtime_releases where status = 'active';
  if c is not null then return jsonb_build_object('release_code', c, 'origin', 'active'); end if;
  return jsonb_build_object('release_code', 'runtime-structural-v1.37', 'origin', 'fallback_no_active_release');
end $f$;


insert into public.grammar_runtime_release_gates_v1(release_id, gate_function)
select id, 'run_pronoun_case_authority_golden_v1' from public.grammar_runtime_releases where code = 'runtime-structural-v1.38';

revoke all on function public.runtime_release_rpc_path_check_v1(text) from public, anon, authenticated;
revoke all on function public.runtime_release_baseline_parity_v1() from public, anon, authenticated;
revoke all on function public.runtime_release_gate_report_v1(text, text, text) from public, anon, authenticated;
revoke all on function public.promote_runtime_release_v1(text, text, text, text) from public, anon, authenticated;
revoke all on function public.demote_runtime_release_v1(text, text) from public, anon, authenticated;
revoke all on function public.select_runtime_release_v1(uuid) from public, anon, authenticated;
grant execute on function public.runtime_release_rpc_path_check_v1(text) to service_role;
grant execute on function public.runtime_release_baseline_parity_v1() to service_role;
grant execute on function public.runtime_release_gate_report_v1(text, text, text) to service_role;
grant execute on function public.promote_runtime_release_v1(text, text, text, text) to service_role;
grant execute on function public.demote_runtime_release_v1(text, text) to service_role;
grant execute on function public.select_runtime_release_v1(uuid) to service_role;

do $g$
declare r jsonb := '{}'::jsonb; x jsonb; bad text[] := '{}';
begin
  x := public.runtime_release_rpc_path_check_v1('runtime-structural-v1.37'); r := r || jsonb_build_object('rpc_v137', x - 'cases');
  if not coalesce((x->>'ok')::boolean, false) then bad := bad || 'rpc_v137'; end if;
  x := public.runtime_release_rpc_path_check_v1('runtime-structural-v1.38'); r := r || jsonb_build_object('rpc_v138', x - 'cases');
  if not coalesce((x->>'ok')::boolean, false) then bad := bad || 'rpc_v138'; end if;
  x := public.run_pronoun_case_authority_golden_v1('runtime-structural-v1.38');
  r := r || jsonb_build_object('golden_v138', jsonb_build_object('ok', x->'ok', 'passed', x->'passed', 'total', x->'total'));
  if not coalesce((x->>'ok')::boolean, false) then bad := bad || 'golden_v138'; end if;
  x := public.select_runtime_release_v1(null); r := r || jsonb_build_object('selector', x);
  if x->>'release_code' <> 'runtime-structural-v1.37' or x->>'origin' <> 'fallback_no_active_release' then bad := bad || 'selector'; end if;
  if exists (select 1 from public.grammar_runtime_releases g join r150_status_before b using (id) where g.status <> b.status)
     or (select count(*) from public.grammar_runtime_releases) <> (select count(*) from r150_status_before) then
    bad := bad || 'release_status_changed';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname in ('runtime_release_rpc_path_check_v1','runtime_release_baseline_parity_v1','runtime_release_gate_report_v1',
                                  'promote_runtime_release_v1','demote_runtime_release_v1','select_runtime_release_v1')
                and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))) then
    bad := bad || 'acl_anon_or_authenticated_execute';
  end if;
  if not (select prosrc ~ 'canary'',''active''' from pg_proc where proname = 'resolve_construction_recognition_v1') then
    bad := bad || 'guard_not_patched';
  end if;
  if cardinality(bad) > 0 then
    raise exception 'R150_GATE_FAILED (rolled back): failed=% detail=%', bad, r::text;
  end if;
  raise notice 'R150_GATE_OK: %', r::text;
end $g$;

commit;
select 'R150 applied: mechanism installed, no release status changed' as r150_result;

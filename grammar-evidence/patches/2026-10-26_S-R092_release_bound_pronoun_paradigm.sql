-- ============================================================================
-- DRAFT R092 -- REVIEW ONLY. DO NOT APPLY WITHOUT SEPARATE EXPLICIT APPROVAL.
-- Not executed. Syntax/behaviour UNTESTED. Intended as a tracked repo migration
-- (name it with a real timestamp when committing, e.g. supabase/migrations/<ts>_release_bound_pronoun_paradigm_v1.sql).
--
-- Decision (Ruslan, 25 Oct): paradigm data is release-bound and part of the project.
-- This replaces the private-schema staging from R089 (that table/function stay until
-- v2 is verified; cleanup is listed at the end and is a SEPARATE step).
--
-- What this draft does NOT do: create a release, add rules, enable anything in v1.37,
-- issue grants, or touch the graph. Seeding is guarded and inserts ZERO rows unless the
-- target release row already exists.
-- ============================================================================

create table if not exists public.grammar_runtime_release_pronoun_paradigm_v1 (
  id            bigint generated always as identity primary key,
  release_id    uuid  not null references public.grammar_runtime_releases(id),
  candidate_id  uuid  not null references public.grammar_knowledge_candidates(id),
  lemma         text  not null,
  nominative    text  not null,
  accusative    text  not null,
  source_pair   text  not null,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint pronoun_paradigm_release_lower_chk
    check (lemma = lower(lemma) and nominative = lower(nominative) and accusative = lower(accusative)),
  constraint pronoun_paradigm_release_uniq unique (release_id, lemma)
);

alter table public.grammar_runtime_release_pronoun_paradigm_v1 enable row level security;
revoke all on public.grammar_runtime_release_pronoun_paradigm_v1 from public, anon, authenticated;
-- no policies: closed to anon/authenticated by design; service_role bypasses RLS.

-- Release-aware evidence (same contract style as dispatch_morphological_rules_v3: release code in).
create or replace function public.pronoun_case_evidence_v2(p_surface text, p_release_code text)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(x.ev order by x.ev->>'lemma', x.ev->>'case'), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'surface', lower(p_surface),
             'release_code', p_release_code,
             'lemma', e.lemma,
             'case', c.case_name,
             'strength', case when c.case_name = 'invariant' then 'none_invariant' else 'default_paradigm' end,
             'candidate_id', e.candidate_id,
             'source_pair', e.source_pair
           ) as ev
    from public.grammar_runtime_releases rel
    join public.grammar_runtime_release_pronoun_paradigm_v1 e on e.release_id = rel.id and e.is_enabled
    cross join lateral (
      select 'nominative'::text case_name, e.nominative form where e.nominative <> e.accusative
      union all
      select 'accusative', e.accusative where e.nominative <> e.accusative
      union all
      select 'invariant', e.nominative where e.nominative = e.accusative
    ) c
    where rel.code = p_release_code and c.form = lower(p_surface)
  ) x;
$$;

revoke all on function public.pronoun_case_evidence_v2(text, text) from public, anon, authenticated;
grant execute on function public.pronoun_case_evidence_v2(text, text) to service_role;

-- Source drift audit: rows whose pair no longer occurs in the candidate statement (expect 0 rows).
create or replace function public.pronoun_paradigm_source_drift_v1()
returns table(release_code text, lemma text, source_pair text, reason text)
language sql
stable
set search_path = pg_catalog, public
as $$
  select rel.code, e.lemma, e.source_pair,
         case when c.id is null then 'candidate_missing'
              when c.status <> 'source_verified' then 'candidate_not_source_verified'
              else 'pair_not_in_statement' end
  from public.grammar_runtime_release_pronoun_paradigm_v1 e
  join public.grammar_runtime_releases rel on rel.id = e.release_id
  left join public.grammar_knowledge_candidates c on c.id = e.candidate_id
  where c.id is null
     or c.status <> 'source_verified'
     or position(e.source_pair in c.statement) = 0;
$$;

revoke all on function public.pronoun_paradigm_source_drift_v1() from public, anon, authenticated;
grant execute on function public.pronoun_paradigm_source_drift_v1() to service_role;

-- Guarded seed: copies the 9 already source-guarded pairs (R089 staging) into a NON-ACTIVE target release.
-- Inserts 0 rows if the release does not exist yet. Never targets runtime-structural-v1.37.
-- Edit the code below only when the child release has been created by its own approved step.
insert into public.grammar_runtime_release_pronoun_paradigm_v1
  (release_id, candidate_id, lemma, nominative, accusative, source_pair)
select rel.id, s.candidate_id, s.lemma, s.nominative, s.accusative, s.source_pair
from public.grammar_runtime_releases rel
cross join grammar_pilot_private.pronoun_paradigm_entries_v1 s
where rel.code = 'runtime-structural-v1.38'
  and rel.code <> 'runtime-structural-v1.37'
on conflict (release_id, lemma) do nothing;

-- ----------------------------------------------------------------------------
-- Read-only checks after an approved apply (on a branch/copy first):
--   select * from public.pronoun_paradigm_source_drift_v1();                      -- expect 0 rows
--   select public.pronoun_case_evidence_v2('meg','runtime-structural-v1.38');     -- accusative of jeg, once seeded
--   select public.pronoun_case_evidence_v2('meg','runtime-structural-v1.37');     -- [] (not in v1.37)
-- Separate later cleanup (NOT part of this draft, only after v2 verified):
--   drop function grammar_pilot_private.pronoun_case_evidence_v1(text);
--   drop table    grammar_pilot_private.pronoun_paradigm_entries_v1;
-- Rollback of this draft:
--   drop function public.pronoun_paradigm_source_drift_v1();
--   drop function public.pronoun_case_evidence_v2(text,text);
--   drop table    public.grammar_runtime_release_pronoun_paradigm_v1;
-- Open items: (1) release v1.38 creation is its own step and decision; (2) grammar_runtime_releases
-- column names assumed: id, code (both used by dispatch_morphological_rules_v3) ; (3) whether a read
-- policy for authenticated is wanted later (currently closed).
-- ----------------------------------------------------------------------------

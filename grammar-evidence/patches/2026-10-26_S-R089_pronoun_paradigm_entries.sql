-- ============================================================================
-- DRAFT R089 -- REVIEW ONLY. DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE APPROVAL.
-- Not executed anywhere. Syntax and behaviour are UNTESTED.
--
-- Purpose: machine-readable personal-pronoun paradigm (Bokmal 4.1.1) with a
-- source guard. R088 showed candidate d99c8781-... has the pairs only in prose:
--   "jeg/meg, du/deg, han/ham, hun/henne, den/den, det/det, vi/oss, dere/dere, de/dem"
-- Every row below is inserted ONLY if its pair occurs literally in that candidate's
-- statement; a DO block then asserts all 9 pairs were found. No fact is invented.
--
-- Scope limits (by design):
--  * private schema, RLS on, no grants to anon/authenticated; read function: service_role only
--  * evidence function only, no rule, no release membership, no grant, no graph action
--  * case is DEFAULT evidence (4.1.2 says "Hovedregelen"); exceptions are NOT modelled here
--  * nouns are not touched; lexeme table is not touched ("ham" noun lexeme exists, see R087)
-- ============================================================================

create table if not exists grammar_pilot_private.pronoun_paradigm_entries_v1 (
  entry_id      bigint generated always as identity primary key,
  candidate_id  uuid  not null references public.grammar_knowledge_candidates(id),
  lemma         text  not null,
  nominative    text  not null,
  accusative    text  not null,
  source_pair   text  not null,
  created_at    timestamptz not null default now(),
  constraint pronoun_paradigm_entries_v1_lower_chk
    check (lemma = lower(lemma) and nominative = lower(nominative) and accusative = lower(accusative)),
  constraint pronoun_paradigm_entries_v1_uniq unique (candidate_id, lemma)
);

alter table grammar_pilot_private.pronoun_paradigm_entries_v1 enable row level security;
revoke all on grammar_pilot_private.pronoun_paradigm_entries_v1 from public, anon, authenticated;

with src as (
  select c.id, c.statement
  from public.grammar_knowledge_candidates c
  where c.id = 'd99c8781-1212-45ed-a490-df7cfa105ede'::uuid
    and c.status = 'source_verified'
),
pairs(lemma, nominative, accusative) as (
  values ('jeg','jeg','meg'), ('du','du','deg'), ('han','han','ham'),
         ('hun','hun','henne'), ('den','den','den'), ('det','det','det'),
         ('vi','vi','oss'), ('dere','dere','dere'), ('de','de','dem')
)
insert into grammar_pilot_private.pronoun_paradigm_entries_v1
  (candidate_id, lemma, nominative, accusative, source_pair)
select s.id, p.lemma, p.nominative, p.accusative, p.nominative || '/' || p.accusative
from src s
join pairs p on position(p.nominative || '/' || p.accusative in s.statement) > 0
on conflict (candidate_id, lemma) do nothing;

do $$
declare n int;
begin
  select count(*) into n
  from grammar_pilot_private.pronoun_paradigm_entries_v1
  where candidate_id = 'd99c8781-1212-45ed-a490-df7cfa105ede'::uuid;
  if n <> 9 then
    raise exception 'PRONOUN_PARADIGM_SOURCE_GUARD_FAILED: expected 9 source-backed pairs, got %', n;
  end if;
end $$;

-- Evidence function: surface -> default case evidence. No clause decision.
-- invariant forms (den, det, dere) carry NO case evidence (strength 'none_invariant').
create or replace function grammar_pilot_private.pronoun_case_evidence_v1(p_surface text)
returns jsonb
language sql
stable
set search_path = pg_catalog, grammar_pilot_private
as $$
  select coalesce(jsonb_agg(x.ev order by x.ev->>'lemma', x.ev->>'case'), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'surface', lower(p_surface),
             'lemma', e.lemma,
             'case', c.case_name,
             'strength', case when c.case_name = 'invariant' then 'none_invariant' else 'default_paradigm' end,
             'candidate_id', e.candidate_id,
             'source_pair', e.source_pair
           ) as ev
    from grammar_pilot_private.pronoun_paradigm_entries_v1 e
    cross join lateral (
      select 'nominative'::text case_name, e.nominative form where e.nominative <> e.accusative
      union all
      select 'accusative', e.accusative where e.nominative <> e.accusative
      union all
      select 'invariant', e.nominative where e.nominative = e.accusative
    ) c
    where c.form = lower(p_surface)
  ) x;
$$;

revoke all on function grammar_pilot_private.pronoun_case_evidence_v1(text) from public, anon, authenticated;
grant execute on function grammar_pilot_private.pronoun_case_evidence_v1(text) to service_role;
grant usage on schema grammar_pilot_private to service_role;  -- no-op if already granted

-- ----------------------------------------------------------------------------
-- Expected results (read-only check AFTER an approved apply on a copy/branch):
--   pronoun_case_evidence_v1('meg')   -> [{lemma:jeg, case:accusative, strength:default_paradigm}]
--   pronoun_case_evidence_v1('jeg')   -> [{lemma:jeg, case:nominative, ...}]
--   pronoun_case_evidence_v1('ham')   -> [{lemma:han, case:accusative, ...}]   (noun lexeme 'ham' ignored)
--   pronoun_case_evidence_v1('de')    -> [{lemma:de,  case:nominative, ...}]
--   pronoun_case_evidence_v1('dem')   -> [{lemma:de,  case:accusative, ...}]
--   pronoun_case_evidence_v1('den'|'det'|'dere') -> one row, case invariant, strength none_invariant
--   pronoun_case_evidence_v1('katten') -> []
-- Rollback (manual, review-only):
--   drop function grammar_pilot_private.pronoun_case_evidence_v1(text);
--   drop table grammar_pilot_private.pronoun_paradigm_entries_v1;
-- Open questions for review: (1) schema choice (private vs a release-scoped public table),
-- (2) whether service_role needs execute on the function through RPC or only inside SQL chain,
-- (3) exception guards (coordination, enn/som, preposition for/uten/unntatt, subject
--     predicative, detached, hun-as-object) belong in the consumer, not here.
-- ----------------------------------------------------------------------------

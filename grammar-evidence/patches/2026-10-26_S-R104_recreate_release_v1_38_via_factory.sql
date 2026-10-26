-- ============================================================================
-- DRAFT R104 -- REVIEW ONLY. DO NOT APPLY WITHOUT SEPARATE EXPLICIT APPROVAL.
-- Not executed against Production. Replaces the hand-made v1.38 from R095 by one made with the project's own
-- factory create_runtime_child_release_v4 (R102/R103: v1 copies metadata+members, v2 materialized facts,
-- v3 constraint facts, v4 multiword facts; child status = 'build', rules_active=false).
--
-- Sequence (single script; any exception aborts and rolls back EVERYTHING, so a failed run leaves v1.38 as it is):
--   1. guards: v1.37 shadow with 27 members; v1.38 exists exactly as R095 made it (shadow, 27 members, 9 paradigm rows,
--      not activated) and nothing references it (shadow runs/batches, other FKs)
--   2. delete v1.38 paradigm rows, then the release (members and fact tables cascade)
--   3. create v1.38 through the factory with the SAME engine_version as the parent
--   4. seed 9 paradigm rows from the R089 staging table
--   5. verify: member and fact counts equal the parent's, status 'build', not activated, 9 paradigm rows
-- Status afterwards is 'build' (factory default), NOT 'shadow'. The RPC accepts 'build'. Promotion to shadow is the
-- project's own gated procedure (promote_*_to_shadow with a golden batch) and is NOT part of this script.
-- Metadata: the factory copies the parent's metadata snapshot by design (parent_snapshot_plus_overrides); inherited golden
-- keys describe the PARENT, not this child.
-- ============================================================================

do $$
declare p record; c record; n_par int; n_ref int;
begin
  select * into p from public.grammar_runtime_releases where code = 'runtime-structural-v1.37';
  if p.id is null or p.status <> 'shadow' then raise exception 'R104_ABORT: parent v1.37 missing or not shadow'; end if;
  if (select count(*) from public.grammar_runtime_release_rules where release_id = p.id) <> 27 then
    raise exception 'R104_ABORT: parent member count is not 27'; end if;

  select * into c from public.grammar_runtime_releases where code = 'runtime-structural-v1.38';
  if c.id is null then raise exception 'R104_ABORT: v1.38 not found (nothing to replace)'; end if;
  if c.status <> 'shadow' or c.activated_at is not null then raise exception 'R104_ABORT: v1.38 is not an unactivated shadow release'; end if;
  if c.metadata->>'draft_ref' is distinct from 'R095' then raise exception 'R104_ABORT: v1.38 was not created by R095'; end if;
  select count(*) into n_par from public.grammar_runtime_release_pronoun_paradigm_v1 where release_id = c.id;
  if n_par <> 9 then raise exception 'R104_ABORT: v1.38 paradigm rows % (expected 9)', n_par; end if;

  select (select count(*) from public.grammar_shadow_analysis_runs where runtime_release_id = c.id)
       + (select count(*) from public.grammar_shadow_v2_batches   where runtime_release_id = c.id)
    into n_ref;
  if n_ref > 0 then raise exception 'R104_ABORT: % shadow runs/batches reference v1.38', n_ref; end if;
end $$;

delete from public.grammar_runtime_release_pronoun_paradigm_v1
 where release_id = (select id from public.grammar_runtime_releases where code = 'runtime-structural-v1.38');

delete from public.grammar_runtime_releases where code = 'runtime-structural-v1.38';

select public.create_runtime_child_release_v4(
  'runtime-structural-v1.37',
  'runtime-structural-v1.38',
  (select engine_version from public.grammar_runtime_releases where code = 'runtime-structural-v1.37'),
  'Release-bound pronoun paradigm (Bokmal 4.1.1) and soft case evidence scope',
  'Pronoun case soft evidence consumer and subject authority',
  jsonb_build_object('draft_ref', 'R104', 'pronoun_paradigm_release_bound', true)
);

insert into public.grammar_runtime_release_pronoun_paradigm_v1
  (release_id, candidate_id, lemma, nominative, accusative, source_pair)
select rel.id, s.candidate_id, s.lemma, s.nominative, s.accusative, s.source_pair
from public.grammar_runtime_releases rel
cross join grammar_pilot_private.pronoun_paradigm_entries_v1 s
where rel.code = 'runtime-structural-v1.38'
on conflict (release_id, lemma) do nothing;

do $$
declare p uuid; c uuid; st text; act timestamptz;
  t text; np bigint; nc bigint;
begin
  select id into p from public.grammar_runtime_releases where code = 'runtime-structural-v1.37';
  select id, status, activated_at into c, st, act from public.grammar_runtime_releases where code = 'runtime-structural-v1.38';
  if c is null then raise exception 'R104_VERIFY_FAILED: v1.38 not created'; end if;
  if st <> 'build' or act is not null then raise exception 'R104_VERIFY_FAILED: expected status build and not activated, got %', st; end if;

  foreach t in array array['grammar_runtime_release_rules','grammar_runtime_constraint_facts_v1','grammar_runtime_lexical_overlays_v1',
                           'grammar_runtime_multiword_facts_v1','grammar_runtime_release_dependency_facts_v1'] loop
    execute format('select count(*) from public.%I where release_id = $1', t) into np using p;
    execute format('select count(*) from public.%I where release_id = $1', t) into nc using c;
    if np <> nc then raise exception 'R104_VERIFY_FAILED: % parent % child %', t, np, nc; end if;
  end loop;

  if (select count(*) from public.grammar_runtime_release_pronoun_paradigm_v1 where release_id = c) <> 9 then
    raise exception 'R104_VERIFY_FAILED: paradigm rows are not 9'; end if;
end $$;

-- Read-only follow-up after apply: re-run R099 (compares clauses/dependencies/phrases for v1.37 vs v1.38 on 4 sentences;
-- expect *_same = true everywhere and evidence_status_v1_38 = evidence_attached for pronoun sentences).
-- Rollback if needed: delete paradigm rows of v1.38, delete release v1.38 (cascade), then re-run R095 only if its
-- limitations are acceptable. Do not change v1.37.

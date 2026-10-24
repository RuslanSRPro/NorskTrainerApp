-- One rule-first adjective pilot. This does not change grammar_rules or release grants.
create schema if not exists grammar_pilot;
revoke all on schema grammar_pilot from public, anon, authenticated;
grant usage on schema grammar_pilot to service_role;

create table grammar_pilot.adjective_degree_manifests_v1 (
  code text primary key,
  rule_code text not null,
  source_candidate_id uuid not null,
  lexeme_id uuid not null unique,
  lemma text not null,
  dictionary_code text not null,
  article_id bigint not null,
  snapshot_id uuid not null,
  exception_decision_id text not null,
  stress_evidence_id text not null,
  class_evidence_id text not null,
  state text not null check (state = 'shadow_only'),
  created_at timestamptz not null default now()
);
alter table grammar_pilot.adjective_degree_manifests_v1 enable row level security;
revoke all on grammar_pilot.adjective_degree_manifests_v1 from public, anon, authenticated;
grant select on grammar_pilot.adjective_degree_manifests_v1 to service_role;

insert into grammar_pilot.adjective_degree_manifests_v1
 (code,rule_code,source_candidate_id,lexeme_id,lemma,dictionary_code,article_id,snapshot_id,
  exception_decision_id,stress_evidence_id,class_evidence_id,state)
values
 ('shadow.adjective.degree.apen.en_deletion.v1',
  'nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative',
  '8cd6ed7e-c27d-4283-bcf1-58af141f387c',
  '81a6cba3-26d1-4bf1-9cb3-41997911dd50',
  'åpen','bm',1033,'965f0a1a-9f22-446a-b36c-f573c9a002d8',
  'r109-apen-suffix-rule-article-1033',
  'naob:pronunciation:81a6cba3-26d1-4bf1-9cb3-41997911dd50:https://naob.no/ordbok/%C3%A5pen',
  'ndla:adjective-degree:section-3:apen-class-member:2026-04-23',
  'shadow_only');

create function grammar_pilot.execute_adjective_degree_rule_first_v1(p_lexeme_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $function$
declare
  m grammar_pilot.adjective_degree_manifests_v1%rowtype;
  r record;
  n integer;
  source_form text;
  candidate text;
begin
  select * into m from grammar_pilot.adjective_degree_manifests_v1
  where lexeme_id = p_lexeme_id and state = 'shadow_only';
  if not found then
    return pg_catalog.jsonb_build_object('status','withheld','reason','manifest_not_admitted');
  end if;
  if m.stress_evidence_id = '' or m.class_evidence_id = '' or m.exception_decision_id = '' then
    return pg_catalog.jsonb_build_object('status','withheld','reason','class_evidence_missing');
  end if;
  select count(*) into n from public.lexeme_form_display_v2 v
  where v.lexeme_id = m.lexeme_id and v.snapshot_id = m.snapshot_id
    and v.dictionary_code = m.dictionary_code and v.article_id = m.article_id
    and v.lemma = m.lemma and v.pos = 'adjective'
    and v.form_key = 'positive_singular_indefinite_common';
  if n <> 1 then
    return pg_catalog.jsonb_build_object('status','withheld','reason','positive_source_not_unique');
  end if;
  select v.primary_values, v.evidence_ids, v.article_ids into r
  from public.lexeme_form_display_v2 v
  where v.lexeme_id = m.lexeme_id and v.snapshot_id = m.snapshot_id
    and v.dictionary_code = m.dictionary_code and v.article_id = m.article_id
    and v.lemma = m.lemma and v.pos = 'adjective'
    and v.form_key = 'positive_singular_indefinite_common';
  if pg_catalog.cardinality(r.primary_values) <> 1
     or r.primary_values[1] <> m.lemma
     or not (m.article_id = any(r.article_ids))
     or not ('ordbokene:official-form' = any(r.evidence_ids)) then
    return pg_catalog.jsonb_build_object('status','withheld','reason','positive_source_evidence_mismatch');
  end if;
  source_form := pg_catalog.lower(r.primary_values[1]);
  if pg_catalog.right(source_form, 2) <> 'en' then
    return pg_catalog.jsonb_build_object('status','withheld','reason','rule_ending_mismatch');
  end if;
  candidate := pg_catalog.left(source_form, pg_catalog.length(source_form) - 2) || 'n' || 'ere';
  return pg_catalog.jsonb_build_object(
    'status','candidate','candidate',candidate,'ruleCode',m.rule_code,
    'manifestCode',m.code,'sourceCandidateId',m.source_candidate_id,
    'lexemeId',m.lexeme_id,'positiveForm',source_form,
    'positiveSnapshotId',m.snapshot_id,'articleId',m.article_id,
    'exceptionDecisionId',m.exception_decision_id,
    'stressEvidenceId',m.stress_evidence_id,'classEvidenceId',m.class_evidence_id,
    'activationAuthority',false,'graphMutation',false);
end;
$function$;
revoke all on function grammar_pilot.execute_adjective_degree_rule_first_v1(uuid)
  from public, anon, authenticated;
grant execute on function grammar_pilot.execute_adjective_degree_rule_first_v1(uuid)
  to service_role;

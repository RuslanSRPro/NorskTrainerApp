create or replace function public.guard_verified_source_candidate_immutability_v1()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $$
begin
  if old.status in ('verified','source_verified') and (
    new.source_id is distinct from old.source_id or new.topic_id is distinct from old.topic_id or
    new.source_section is distinct from old.source_section or new.source_pdf_page_from is distinct from old.source_pdf_page_from or
    new.source_pdf_page_to is distinct from old.source_pdf_page_to or new.source_printed_page_from is distinct from old.source_printed_page_from or
    new.source_printed_page_to is distinct from old.source_printed_page_to or new.knowledge_type is distinct from old.knowledge_type or
    new.title is distinct from old.title or new.statement is distinct from old.statement or new.source_excerpt is distinct from old.source_excerpt or
    new.extracted_payload is distinct from old.extracted_payload or new.digital_model is distinct from old.digital_model or
    new.execution_contract is distinct from old.execution_contract
  ) then raise exception 'verified/source_verified grammar source is immutable; create a new source candidate/version instead of editing candidate %', old.id; end if;
  return new;
end;$$;
drop trigger if exists trg_guard_verified_source_candidate_immutability_v1 on public.grammar_knowledge_candidates;
create trigger trg_guard_verified_source_candidate_immutability_v1 before update on public.grammar_knowledge_candidates
for each row execute function public.guard_verified_source_candidate_immutability_v1();

create table if not exists public.grammar_source_graph_snapshots_v1(
 id uuid primary key default gen_random_uuid(),snapshot_code text not null unique,candidate_count integer not null,verified_count integer not null,
 semantic_hash text not null,created_at timestamptz not null default now(),notes text);
alter table public.grammar_source_graph_snapshots_v1 enable row level security;

create or replace function public.grammar_source_graph_semantic_hash_v1()
returns text language sql stable security invoker set search_path='public','pg_catalog' as $$
select encode(extensions.digest(convert_to(coalesce(string_agg(
 id::text||'|'||coalesce(source_id::text,'')||'|'||coalesce(topic_id::text,'')||'|'||coalesce(source_section,'')||'|'||coalesce(knowledge_type,'')||'|'||
 coalesce(title,'')||'|'||coalesce(statement,'')||'|'||coalesce(source_excerpt,'')||'|'||coalesce(extracted_payload::text,'')||'|'||coalesce(digital_model::text,'')||'|'||coalesce(execution_contract::text,''),E'\n' order by id::text),''),'UTF8'),'sha256'),'hex')
from public.grammar_knowledge_candidates;$$;

insert into public.grammar_source_graph_snapshots_v1(snapshot_code,candidate_count,verified_count,semantic_hash,notes)
select 'source-graph-4564-v1',count(*),count(*) filter(where status in ('verified','source_verified')),public.grammar_source_graph_semantic_hash_v1(),
'Immutable semantic baseline for the 4564-rule Source Graph before Universal Rule Activation Conveyor V1.'
from public.grammar_knowledge_candidates on conflict(snapshot_code) do nothing;

create table if not exists public.grammar_morph_form_registry_v1(
 pos text not null,form_key text not null,form_scope text not null default 'token' check(form_scope in ('token','construction')),
 canonical_features jsonb not null default '{}'::jsonb,source_tag_examples jsonb not null default '[]'::jsonb,
 provenance_policy text not null default 'lexeme_form_variants.source_verified',is_active boolean not null default true,notes text,
 primary key(pos,form_key));
alter table public.grammar_morph_form_registry_v1 enable row level security;

insert into public.grammar_morph_form_registry_v1(pos,form_key,form_scope,canonical_features,notes) values
('adjective','positive_common','token','{"Degree":"Pos","Gender":"Com","Number":"Sing","Definite":"Ind"}','Canonical normalization only; source form remains authoritative.'),
('adjective','positive_feminine','token','{"Degree":"Pos","Gender":"Fem","Number":"Sing","Definite":"Ind"}','Canonical normalization only.'),
('adjective','positive_neuter','token','{"Degree":"Pos","Gender":"Neut","Number":"Sing","Definite":"Ind"}','Canonical normalization only.'),
('adjective','positive_plural','token','{"Degree":"Pos","Number":"Plur"}','Canonical normalization only.'),
('adjective','positive_definite','token','{"Degree":"Pos","Definite":"Def"}','Canonical normalization only.'),
('adjective','comparative','token','{"Degree":"Cmp"}','Canonical normalization only.'),
('adjective','superlative','token','{"Degree":"Sup","Definite":"Ind"}','Canonical normalization only.'),
('adjective','superlative_definite','token','{"Degree":"Sup","Definite":"Def"}','Canonical normalization only.'),
('noun','singular_indefinite','token','{"Number":"Sing","Definite":"Ind"}','Gender is lexeme/source-level; not invented from form key.'),
('noun','singular_definite','token','{"Number":"Sing","Definite":"Def"}','Gender is lexeme/source-level; not invented from form key.'),
('noun','plural_indefinite','token','{"Number":"Plur","Definite":"Ind"}','Canonical normalization only.'),
('noun','plural_definite','token','{"Number":"Plur","Definite":"Def"}','Canonical normalization only.'),
('verb','infinitive','token','{"VerbForm":"Inf"}','Canonical normalization only.'),
('verb','infinitive_passive','token','{"VerbForm":"Inf","Voice":"Pass"}','Canonical normalization only.'),
('verb','present','token','{"VerbForm":"Fin","Tense":"Pres"}','Canonical normalization only.'),
('verb','present_passive','token','{"VerbForm":"Fin","Tense":"Pres","Voice":"Pass"}','Canonical normalization only.'),
('verb','past','token','{"VerbForm":"Fin","Tense":"Past"}','Canonical normalization only.'),
('verb','imperative','token','{"VerbForm":"Fin","Mood":"Imp"}','Canonical normalization only.'),
('verb','past_participle','token','{"VerbForm":"Part","Tense":"Past"}','Canonical normalization only.'),
('verb','present_participle','token','{"VerbForm":"Part","Tense":"Pres"}','Canonical normalization only.'),
('verb','adjectival_past_participle_common','token','{"VerbForm":"Part","Tense":"Past","Gender":"Com","Number":"Sing","Definite":"Ind"}','Adjectival participle form.'),
('verb','adjectival_past_participle_neuter','token','{"VerbForm":"Part","Tense":"Past","Gender":"Neut","Number":"Sing","Definite":"Ind"}','Adjectival participle form.'),
('verb','adjectival_past_participle_plural','token','{"VerbForm":"Part","Tense":"Past","Number":"Plur"}','Adjectival participle form.'),
('verb','adjectival_past_participle_definite','token','{"VerbForm":"Part","Tense":"Past","Definite":"Def"}','Adjectival participle form.'),
('verb','present_perfect','construction','{"TenseProfile":"PresentPerfect"}','Constructional lexical evidence, not a single-token inflection.'),
('verb','past_perfect','construction','{"TenseProfile":"PreteritePerfect"}','Constructional lexical evidence, not a single-token inflection.')
on conflict(pos,form_key) do update set form_scope=excluded.form_scope,canonical_features=excluded.canonical_features,notes=excluded.notes;

update public.grammar_morph_form_registry_v1 r set source_tag_examples=s.tags from (
 select l.pos,f.form_key,coalesce(jsonb_agg(distinct f.grammar->'tags') filter(where f.grammar ? 'tags'),'[]'::jsonb) tags
 from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id where f.verification_status='source_verified' group by l.pos,f.form_key
) s where s.pos=r.pos and s.form_key=r.form_key;

create or replace function public.resolve_lexeme_for_surface_v1(p_surface text,p_selected_lemma text default null,p_required_pos text default null)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare a jsonb; cnt int;
begin
 if p_selected_lemma is not null then select jsonb_build_object('lexeme_id',l.id,'lemma',l.lemma,'pos',l.pos,'resolution','selected_lemma') into a
 from public.lexemes l where lower(l.lemma)=lower(p_selected_lemma) and (p_required_pos is null or l.pos=p_required_pos)
 order by case when l.verification_status='source_verified' then 0 else 1 end,l.id limit 1; if a is not null then return a; end if; end if;
 select count(distinct f.lexeme_id) into cnt from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id
 where f.verification_status='source_verified' and lower(f.normalized_value)=lower(p_surface) and (p_required_pos is null or l.pos=p_required_pos);
 if cnt=1 then select jsonb_build_object('lexeme_id',l.id,'lemma',l.lemma,'pos',l.pos,'resolution','unique_source_verified_surface') into a
 from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id where f.verification_status='source_verified' and lower(f.normalized_value)=lower(p_surface)
 and (p_required_pos is null or l.pos=p_required_pos) order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last,f.value limit 1; return a; end if;
 return jsonb_build_object('lexeme_id',null,'lemma',null,'pos',p_required_pos,'resolution',case when cnt=0 then 'not_found' else 'ambiguous_surface' end,'candidate_count',cnt);
end;$$;

create or replace function public.morph_form_key_features_v2(p_pos text,p_form_key text)
returns jsonb language sql stable security invoker set search_path='public','pg_catalog' as $$
select canonical_features from public.grammar_morph_form_registry_v1 where pos=p_pos and form_key=p_form_key and is_active;$$;

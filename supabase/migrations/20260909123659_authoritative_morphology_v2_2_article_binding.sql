-- D10 / pending only: evidence-backed same-lemma/POS article binding.
-- Do not apply before the matching TypeScript and pgTAP gates pass.

create table private.authoritative_morphology_article_bindings_v2 (
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  dictionary_code text not null check (dictionary_code = 'bm'),
  article_id bigint not null check (article_id > 0),
  normalized_lemma text not null check (btrim(normalized_lemma) <> ''),
  pos text not null
    check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  evidence_ids text[] not null check (
    cardinality(evidence_ids) > 0
    and array_position(evidence_ids, '') is null
  ),
  provider_version text not null check (btrim(provider_version) <> ''),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authoritative_morphology_article_bindings_v2_pkey
    primary key (lexeme_id, dictionary_code, article_id, pos)
);

create index authoritative_morphology_article_bindings_v2_active_lexeme_idx
  on private.authoritative_morphology_article_bindings_v2 (lexeme_id, pos)
  where is_active;

alter table private.authoritative_morphology_article_bindings_v2
  enable row level security;
alter table private.authoritative_morphology_article_bindings_v2
  force row level security;

revoke all on table private.authoritative_morphology_article_bindings_v2
from public, anon, authenticated, service_role;

create or replace function private.validate_authoritative_article_binding_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_normalized_lexeme text;
  v_pos text;
begin
  select
    lower(btrim(regexp_replace(coalesce(lexeme.display_form, lexeme.lemma),
      '^(å|en|ei|et)[[:space:]]+', '', 'i'))),
    lexeme.pos
  into v_normalized_lexeme, v_pos
  from public.lexemes as lexeme
  where lexeme.id = new.lexeme_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  end if;
  if new.pos is distinct from v_pos then
    raise exception using errcode = '55000', message = 'ARTICLE_BINDING_POS_MISMATCH';
  end if;
  if lower(btrim(new.normalized_lemma)) is distinct from v_normalized_lexeme then
    raise exception using errcode = '55000', message = 'ARTICLE_BINDING_LEMMA_MISMATCH';
  end if;

  new.normalized_lemma := v_normalized_lexeme;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.validate_authoritative_article_binding_v2()
from public, anon, authenticated, service_role;

create trigger validate_authoritative_article_binding_v2
before insert or update on private.authoritative_morphology_article_bindings_v2
for each row execute function private.validate_authoritative_article_binding_v2();

create or replace function public.get_authoritative_morphology_article_bindings_v2(
  p_lexeme_ids uuid[]
)
returns table (
  lexeme_id uuid,
  dictionary_code text,
  article_id bigint,
  normalized_lemma text,
  pos text,
  evidence_ids text[],
  provider_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_lexeme_ids is null
     or cardinality(p_lexeme_ids) < 1
     or cardinality(p_lexeme_ids) > 25
     or exists (select 1 from unnest(p_lexeme_ids) as item(id) where id is null)
  then
    raise exception using errcode = '22023', message = 'LEXEME_IDS_MUST_CONTAIN_1_TO_25';
  end if;

  return query
  select
    binding.lexeme_id,
    binding.dictionary_code,
    binding.article_id,
    binding.normalized_lemma,
    binding.pos,
    binding.evidence_ids,
    binding.provider_version
  from private.authoritative_morphology_article_bindings_v2 as binding
  where binding.lexeme_id = any(p_lexeme_ids)
    and binding.is_active
  order by binding.lexeme_id, binding.article_id;
end;
$function$;

revoke all on function public.get_authoritative_morphology_article_bindings_v2(uuid[])
from public, anon, authenticated;
grant execute on function public.get_authoritative_morphology_article_bindings_v2(uuid[])
to service_role;

create or replace function private.enforce_authoritative_snapshot_article_binding_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_bound_article_ids bigint[];
begin
  select array_agg(binding.article_id order by binding.article_id)
  into v_bound_article_ids
  from private.authoritative_morphology_article_bindings_v2 as binding
  where binding.lexeme_id = new.lexeme_id
    and binding.dictionary_code = any(new.dictionaries)
    and binding.pos = new.requested_pos
    and binding.is_active;

  if v_bound_article_ids is not null
     and new.source_article_ids is distinct from v_bound_article_ids then
    raise exception using errcode = '55000', message = 'ARTICLE_BINDING_MISMATCH';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_authoritative_snapshot_article_binding_v2()
from public, anon, authenticated, service_role;

create trigger enforce_authoritative_snapshot_article_binding_v2
before insert or update of source_article_ids
on private.authoritative_morphology_snapshots_v2
for each row execute function
  private.enforce_authoritative_snapshot_article_binding_v2();

-- Existing learner lexeme: å være = the copular/existential verb in BM 69211.
-- The row trigger is the single authority for lemma/POS validation. ROW_COUNT
-- verifies this exact INSERT without relying on a later RLS-visible SELECT.
do $block$
declare
  v_inserted_count integer;
begin
  insert into private.authoritative_morphology_article_bindings_v2 (
    lexeme_id,
    dictionary_code,
    article_id,
    normalized_lemma,
    pos,
    evidence_ids,
    provider_version,
    evidence
  )
  select
    lexeme.id,
    'bm',
    69211,
    'være',
    'verb',
    array[
      'ordbokene:bm:69211',
      'manual:lexeme-semantic-binding:vaere-be'
    ]::text[],
    'authoritative-article-binding/v1',
    jsonb_build_object(
      'decision', 'copular_existential_vaere',
      'rejectedHomographArticleIds', jsonb_build_array(69212),
      'reason', 'same lemma and POS but divergent meaning and paradigm'
    )
  from public.lexemes as lexeme
  where lexeme.id = 'd3fdd671-8fd2-43bf-b399-dd140ce0e704'::uuid;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> 1 then
    raise exception using errcode = '55000', message = 'VAERE_ARTICLE_BINDING_NOT_CREATED';
  end if;
end;
$block$;

comment on table private.authoritative_morphology_article_bindings_v2 is
  'Evidence-backed learner lexeme to Ordbokene article bindings for same-lemma/POS homographs.';
comment on function public.get_authoritative_morphology_article_bindings_v2(uuid[]) is
  'Service-role-only bounded read of active D10 article bindings.';

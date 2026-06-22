create table if not exists public.ordbokene_expression_candidates (
  id uuid primary key default gen_random_uuid(),

  parent_article_id bigint not null,
  parent_dictionary_code text not null,
  parent_lemma text,

  candidate_article_id bigint not null,
  candidate_dictionary_code text not null,

  lemma text not null,
  normalized_key text not null,

  word_class text,
  article_type text,

  definition_preview text,
  examples jsonb not null default '[]'::jsonb,

  payload jsonb not null,

  status text not null default 'candidate',
  extraction_version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(parent_article_id, parent_dictionary_code, candidate_article_id, candidate_dictionary_code)
);

create index if not exists
idx_ordbokene_expression_candidates_parent
on public.ordbokene_expression_candidates(parent_article_id, parent_dictionary_code);

create index if not exists
idx_ordbokene_expression_candidates_candidate
on public.ordbokene_expression_candidates(candidate_article_id, candidate_dictionary_code);

create index if not exists
idx_ordbokene_expression_candidates_normalized_key
on public.ordbokene_expression_candidates(normalized_key);

create index if not exists
idx_ordbokene_expression_candidates_status
on public.ordbokene_expression_candidates(status);

create or replace function public.save_ordbokene_expression_candidate(
  p_parent_article_id bigint,
  p_parent_dictionary_code text,
  p_parent_lemma text,

  p_candidate_article_id bigint,
  p_candidate_dictionary_code text,

  p_lemma text,
  p_normalized_key text,

  p_word_class text,
  p_article_type text,

  p_definition_preview text,
  p_examples jsonb,
  p_payload jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.ordbokene_expression_candidates (
    parent_article_id,
    parent_dictionary_code,
    parent_lemma,

    candidate_article_id,
    candidate_dictionary_code,

    lemma,
    normalized_key,

    word_class,
    article_type,

    definition_preview,
    examples,
    payload,
    updated_at
  )
  values (
    p_parent_article_id,
    p_parent_dictionary_code,
    p_parent_lemma,

    p_candidate_article_id,
    p_candidate_dictionary_code,

    p_lemma,
    p_normalized_key,

    p_word_class,
    p_article_type,

    p_definition_preview,
    coalesce(p_examples, '[]'::jsonb),
    p_payload,
    now()
  )
  on conflict (
    parent_article_id,
    parent_dictionary_code,
    candidate_article_id,
    candidate_dictionary_code
  )
  do update set
    parent_lemma = excluded.parent_lemma,
    lemma = excluded.lemma,
    normalized_key = excluded.normalized_key,
    word_class = excluded.word_class,
    article_type = excluded.article_type,
    definition_preview = excluded.definition_preview,
    examples = excluded.examples,
    payload = excluded.payload,
    updated_at = now();
end;
$$;
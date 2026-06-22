create table if not exists public.ordbokene_article_cache (
  id uuid primary key default gen_random_uuid(),

  article_id bigint not null,
  dictionary_code text not null,

  lemma text,
  word_class text,

  payload jsonb not null,

  payload_version integer not null default 1,

  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(article_id, dictionary_code)
);

create index if not exists
idx_ordbokene_article_cache_article
on public.ordbokene_article_cache(article_id);

create index if not exists
idx_ordbokene_article_cache_dict
on public.ordbokene_article_cache(dictionary_code);

create index if not exists
idx_ordbokene_article_cache_lemma
on public.ordbokene_article_cache(lemma);

create index if not exists
idx_ordbokene_article_cache_word_class
on public.ordbokene_article_cache(word_class);
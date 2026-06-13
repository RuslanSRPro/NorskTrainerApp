create table if not exists public.lexeme_relations (
  id uuid primary key default gen_random_uuid(),

  source_lexeme_id uuid not null
    references public.lexemes(id)
    on delete cascade,

  target_lexeme_id uuid not null
    references public.lexemes(id)
    on delete cascade,

  relation_type text not null,

  confidence text,
  source text,

  evidence jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    source_lexeme_id,
    target_lexeme_id,
    relation_type
  )
);

create index if not exists
idx_lexeme_relations_source
on public.lexeme_relations(source_lexeme_id);

create index if not exists
idx_lexeme_relations_target
on public.lexeme_relations(target_lexeme_id);

create index if not exists
idx_lexeme_relations_type
on public.lexeme_relations(relation_type);
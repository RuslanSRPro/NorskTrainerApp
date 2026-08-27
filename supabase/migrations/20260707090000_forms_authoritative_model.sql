alter table public.lexeme_form_variants
add column if not exists form_key text,
add column if not exists form_label text,
add column if not exists grammar jsonb default '{}'::jsonb,
add column if not exists source text,
add column if not exists source_article_id text,
add column if not exists source_dictionary text,
add column if not exists run_id text,
add column if not exists method_version integer,
add column if not exists created_by text,
add column if not exists is_main boolean default true,
add column if not exists is_alternative boolean default false,
add column if not exists is_irregular boolean default false,
add column if not exists needs_review boolean default false,
add column if not exists verification_status text default 'candidate',
add column if not exists updated_at timestamptz default now();

create unique index if not exists lexeme_form_variants_unique_authoritative_form
on public.lexeme_form_variants (lexeme_id, form_key, normalized_value, source_dictionary);
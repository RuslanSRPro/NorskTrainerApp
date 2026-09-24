begin;

create extension if not exists pgtap with schema extensions;
set local search_path = pg_catalog, public, extensions, private;
select plan(10);

select has_column(
  'public',
  'lexemes',
  'lexeme360_root_lemma',
  'Lexeme360 root identity is materialized'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_ready_count',
  'ready family count is materialized'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_candidate_count',
  'candidate family count is materialized'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_display_relation_count',
  'display relation total is generated'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_available',
  'icon availability is generated'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_policy_version',
  'family policy version is stored'
);

select has_column(
  'public',
  'lexemes',
  'lexeme360_refreshed_at',
  'projection refresh time is stored'
);

select has_function(
  'private',
  'refresh_lexeme360_family_v1',
  array['text'],
  'internal one-root refresh function exists'
);

select ok(
  not exists (
    select 1
    from public.lexemes
    where lexeme360_ready_count < 0
       or lexeme360_candidate_count < 0
       or lexeme360_display_relation_count <>
          lexeme360_ready_count + lexeme360_candidate_count
       or lexeme360_available <>
          (lexeme360_display_relation_count > 0)
  ),
  'projection counters and availability are internally consistent'
);

select ok(
  coalesce((
    select bool_and(not lexeme360_available)
    from public.lexemes
    where private.normalize_lexeme360_root_v1(lemma) = 'klage'
  ), true)
  and coalesce((
    select bool_or(
      lexeme360_available
      and lexeme360_ready_count > 0
    )
    from public.lexemes
    where private.normalize_lexeme360_root_v1(lemma) = 'ta'
  ), false),
  'klage stays hidden while the ready ta family remains available'
);

select * from finish();

rollback;
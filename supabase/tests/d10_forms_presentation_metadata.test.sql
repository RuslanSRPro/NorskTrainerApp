begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(10);

select has_column(
  'public', 'lexeme_form_display_v2', 'accepted_articles',
  'display projection stores accepted noun articles'
);

select col_not_null(
  'public', 'lexeme_form_display_v2', 'accepted_articles',
  'accepted noun articles are never null'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'set_authoritative_noun_articles_v2' and not tgisinternal
  ),
  'publisher writes refresh materialized articles through one trigger'
);

select ok(
  not has_function_privilege('anon', 'private.authoritative_noun_articles_v2(uuid,text)', 'EXECUTE'),
  'anon cannot execute internal noun article projection'
);

select ok(
  not has_function_privilege('authenticated', 'private.authoritative_noun_articles_v2(uuid,text)', 'EXECUTE'),
  'authenticated cannot execute internal noun article projection'
);

select is(
  (
    select min(accepted_articles::text)
    from public.lexeme_form_display_v2
    where lexeme_id = 'ec9da2b9-22d4-4292-81e3-05b26f4aa852'::uuid
  ),
  '{en,ei}',
  'bok accepts masculine and feminine articles from one source article'
);

select is(
  (
    select count(distinct accepted_articles::text)::integer
    from public.lexeme_form_display_v2
    where lexeme_id = 'ec9da2b9-22d4-4292-81e3-05b26f4aa852'::uuid
  ),
  1,
  'all bok form rows carry the same article metadata'
);

select is(
  (
    select count(*)::integer
    from public.lexeme_form_display_v2
    where pos <> 'noun' and cardinality(accepted_articles) <> 0
  ),
  0,
  'non-nouns never receive noun articles'
);

select is(
  (
    select count(*)::integer
    from public.lexeme_form_display_v2
    where not accepted_articles <@ array['en', 'ei', 'et']::text[]
  ),
  0,
  'only supported Bokmal articles are stored'
);

select is(
  (
    select count(*)::integer
    from (
      select lexeme_id
      from public.lexeme_form_display_v2
      where pos = 'noun'
      group by lexeme_id
      having count(distinct accepted_articles::text) <> 1
    ) as inconsistent
  ),
  0,
  'noun article metadata is consistent per lexeme'
);

select * from finish();
rollback;

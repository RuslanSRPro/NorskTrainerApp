-- D10 pending pgTAP: evidence-backed same-lemma/POS article binding.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(14);

select has_table(
  'private',
  'authoritative_morphology_article_bindings_v2',
  'private article binding table exists'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_article_bindings_v2'::regclass),
  'article binding RLS is enabled and forced'
);
select ok(
  not has_table_privilege(
    'service_role',
    'private.authoritative_morphology_article_bindings_v2',
    'SELECT'
  ),
  'service role has no direct binding table access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.authoritative_morphology_article_bindings_v2',
    'SELECT'
  ),
  'authenticated has no binding table access'
);
select has_function(
  'public',
  'get_authoritative_morphology_article_bindings_v2',
  array['uuid[]'],
  'bounded binding reader exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_authoritative_morphology_article_bindings_v2(uuid[])',
    'EXECUTE'
  ),
  'service role can execute the binding reader'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_authoritative_morphology_article_bindings_v2(uuid[])',
    'EXECUTE'
  ),
  'authenticated cannot execute the binding reader'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname =
        'authoritative_morphology_article_bindings_v2_active_lexeme_idx'
  ),
  'active binding lookup is indexed'
);

select is(
  (
    select article_id
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'd3fdd671-8fd2-43bf-b399-dd140ce0e704'::uuid
      and dictionary_code = 'bm'
      and normalized_lemma = 'være'
      and pos = 'verb'
      and is_active
  ),
  69211::bigint,
  'existing å være lexeme binds explicitly to BM article 69211'
);
select is(
  (
    select article_id
    from public.get_authoritative_morphology_article_bindings_v2(
      array['d3fdd671-8fd2-43bf-b399-dd140ce0e704'::uuid]
    )
  ),
  69211::bigint,
  'service reader returns the accepted article'
);
select is(
  (
    select evidence_ids
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'd3fdd671-8fd2-43bf-b399-dd140ce0e704'::uuid
      and article_id = 69211
      and is_active
  ),
  array[
    'ordbokene:bm:69211',
    'manual:lexeme-semantic-binding:vaere-be'
  ]::text[],
  'binding retains explicit evidence identifiers'
);

select throws_ok(
  $$select * from public.get_authoritative_morphology_article_bindings_v2('{}'::uuid[])$$,
  '22023',
  'LEXEME_IDS_MUST_CONTAIN_1_TO_25',
  'binding reader rejects an empty request'
);
select throws_ok(
  $$select * from public.get_authoritative_morphology_article_bindings_v2(array_fill('00000000-0000-4000-8000-000000000001'::uuid, array[26]))$$,
  '22023',
  'LEXEME_IDS_MUST_CONTAIN_1_TO_25',
  'binding reader rejects more than 25 lexemes'
);
select throws_ok(
  format(
    'insert into private.authoritative_morphology_article_bindings_v2 '
    || '(lexeme_id,dictionary_code,article_id,normalized_lemma,pos,evidence_ids,provider_version,evidence) '
    || 'values (%L,%L,%s,%L,%L,%L::text[],%L,%L::jsonb)',
    'd3fdd671-8fd2-43bf-b399-dd140ce0e704',
    'bm',
    69212,
    'være',
    'noun',
    '{manual:test}',
    'authoritative-article-binding/v1',
    '{}'
  ),
  '55000',
  'ARTICLE_BINDING_POS_MISMATCH',
  'binding with the wrong POS fails closed'
);

select * from finish();
rollback;

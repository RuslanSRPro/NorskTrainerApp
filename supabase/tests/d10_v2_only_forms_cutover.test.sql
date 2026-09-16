begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(11);

select is(
  (select count(*) from public.lexeme_form_variants),
  0::bigint,
  'legacy lexeme form variants are empty'
);

select is(
  (select count(*) from public.verb_forms),
  0::bigint,
  'legacy verb forms are empty'
);

select is(
  (select count(*) from public.noun_forms),
  0::bigint,
  'legacy noun forms are empty'
);

select is(
  (select count(*) from public.adjective_forms),
  0::bigint,
  'legacy adjective forms are empty'
);

select case
  when to_regclass('public.word_forms') is null then
    ok(true, 'legacy generic word forms table is absent')
  else
    results_eq(
      'select count(*) from public.word_forms',
      'values (0::bigint)',
      'legacy generic word forms are empty'
    )
end;

select ok(
  not has_table_privilege(
    'service_role',
    'public.lexeme_form_variants',
    'INSERT'
  ),
  'service role cannot repopulate legacy variants'
);

select ok(
  not has_table_privilege(
    'service_role',
    'public.verb_forms',
    'INSERT'
  ),
  'service role cannot repopulate legacy verb forms'
);

select ok(
  not has_table_privilege(
    'service_role',
    'public.noun_forms',
    'INSERT'
  ),
  'service role cannot repopulate legacy noun forms'
);

select ok(
  not has_table_privilege(
    'service_role',
    'public.adjective_forms',
    'INSERT'
  ),
  'service role cannot repopulate legacy adjective forms'
);

select case
  when to_regclass('public.word_forms') is null then
    ok(true, 'legacy generic word forms table needs no write privilege')
  else
    ok(
      not has_table_privilege(
        'service_role',
        'public.word_forms',
        'INSERT'
      ),
      'service role cannot repopulate legacy generic word forms'
    )
end;

select has_function(
  'private',
  'reject_legacy_form_write_v2',
  array[]::text[],
  'legacy write rejection trigger function exists'
);

select * from finish();

rollback;

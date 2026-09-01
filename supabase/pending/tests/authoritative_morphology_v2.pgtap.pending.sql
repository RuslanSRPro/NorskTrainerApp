-- PENDING pgTAP for D10. Run only after the pending schema has been promoted
-- to a real migration in a disposable/local database.

begin;

select plan(19);

select has_table('public', 'authoritative_morphology_snapshots_v2');
select has_table('public', 'authoritative_morphology_paradigms_v2');
select has_table('public', 'authoritative_morphology_forms_v2');
select has_view('public', 'active_authoritative_morphology_forms_v2');
select has_function(
  'public',
  'finalize_authoritative_morphology_snapshot_v2',
  array['uuid']
);

select col_is_pk('public', 'authoritative_morphology_snapshots_v2', 'id');
select col_is_pk('public', 'authoritative_morphology_paradigms_v2', 'id');
select col_is_pk('public', 'authoritative_morphology_forms_v2', 'id');

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.authoritative_morphology_snapshots_v2'::regclass),
  'snapshot RLS is enabled'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.authoritative_morphology_paradigms_v2'::regclass),
  'paradigm RLS is enabled'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.authoritative_morphology_forms_v2'::regclass),
  'form RLS is enabled'
);

select ok(
  has_table_privilege('service_role', 'public.authoritative_morphology_forms_v2', 'SELECT'),
  'service_role can read authoritative forms'
);
select ok(
  not has_table_privilege('authenticated', 'public.authoritative_morphology_forms_v2', 'SELECT'),
  'authenticated cannot read staging forms'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_authoritative_morphology_snapshot_v2(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot finalize snapshots'
);

insert into public.authoritative_morphology_snapshots_v2 (
  id, lookup_query, normalized_query, requested_pos, dictionaries,
  scope_used, resolver_version, is_complete, expected_article_count,
  fetched_article_count, checked_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'gape', 'gape', 'verb', array['bm'], 'e',
  'authoritative-morphology/v2', true, 1, 1, now()
);

select throws_ok(
  $$select public.finalize_authoritative_morphology_snapshot_v2(
    '10000000-0000-4000-8000-000000000001'
  )$$,
  '55000',
  'SNAPSHOT_FORMS_INCOMPLETE',
  'snapshot without paradigms cannot become active'
);

insert into public.authoritative_morphology_paradigms_v2 (
  id, snapshot_id, dictionary_code, article_id, pos, paradigm_id,
  identity, lemma, source_url
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'bm', 19072, 'verb', '1', 'bm|19072|verb|1', 'gape',
  'https://ord.uib.no/bm/article/19072.json'
);

insert into public.authoritative_morphology_forms_v2 (
  paradigm_id, form_key, value, normalized_value, tags, source_ordinal
)
values
  ('20000000-0000-4000-8000-000000000001', 'infinitive', 'gape', 'gape', array['Inf'], 0),
  ('20000000-0000-4000-8000-000000000001', 'preterite', 'gapa', 'gapa', array['Past'], 1);

select lives_ok(
  $$select public.finalize_authoritative_morphology_snapshot_v2(
    '10000000-0000-4000-8000-000000000001'
  )$$,
  'complete snapshot can be finalized'
);

select is(
  (select state from public.authoritative_morphology_snapshots_v2
   where id = '10000000-0000-4000-8000-000000000001'),
  'ready',
  'finalized snapshot is ready'
);
select is(
  (select count(*)::integer from public.active_authoritative_morphology_forms_v2
   where identity = 'bm|19072|verb|1'),
  2,
  'active view exposes only source forms from the ready snapshot'
);
select is(
  (select count(*)::integer from public.active_authoritative_morphology_forms_v2
   where value like 'har %' or value like 'hadde %' or form_key = 'needs_review'),
  0,
  'active view contains no derived auxiliary or pseudo-forms'
);

select * from finish();
rollback;

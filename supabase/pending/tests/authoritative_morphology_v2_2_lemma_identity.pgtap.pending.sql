-- D10 V2.2 source-centric persistence regression (PENDING).
-- Run only after promoting and applying the matching V2.2 migration.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(58);

select has_table(
  'private',
  'authoritative_morphology_source_revisions_v2',
  'shared source revision table exists'
);
select has_table(
  'private',
  'authoritative_morphology_source_headwords_v2',
  'source headword table exists'
);
select has_table(
  'private',
  'authoritative_morphology_source_paradigms_v2',
  'source paradigm table exists'
);
select has_table(
  'private',
  'authoritative_morphology_source_forms_v2',
  'source form table exists'
);
select has_table(
  'private',
  'authoritative_morphology_snapshot_sources_v2',
  'snapshot-to-source binding table exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid =
          'private.authoritative_morphology_source_revisions_v2'::regclass
      and conname = 'am_source_revision_identity_v2_key'
      and contype = 'u'
      and pg_get_constraintdef(oid) =
        'UNIQUE (dictionary_code, article_id, payload_fingerprint, parser_version)'
  ),
  'source revisions deduplicate by article payload and parser version'
);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_source_revisions_v2'::regclass),
  'source revision RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_source_headwords_v2'::regclass),
  'source headword RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_source_paradigms_v2'::regclass),
  'source paradigm RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_source_forms_v2'::regclass),
  'source form RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid =
     'private.authoritative_morphology_snapshot_sources_v2'::regclass),
  'snapshot source RLS is enabled and forced'
);

select ok(
  not has_table_privilege(
    'service_role',
    'private.authoritative_morphology_source_revisions_v2',
    'SELECT'
  ),
  'service role has no direct source payload access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.authoritative_morphology_source_revisions_v2',
    'SELECT'
  ),
  'authenticated has no source payload access'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname =
        'authoritative_morphology_source_headwords_v2_revision_idx'
  ),
  'source headword foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname =
        'authoritative_morphology_source_paradigms_v2_headword_idx'
  ),
  'source paradigm foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname =
        'authoritative_morphology_source_forms_v2_paradigm_idx'
  ),
  'source form foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname =
        'authoritative_morphology_snapshot_sources_v2_revision_idx'
  ),
  'snapshot source reverse lookup is indexed'
);

select has_table(
  'public',
  'lexeme_headword_aliases_v2',
  'authenticated headword alias projection exists'
);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'public.lexeme_headword_aliases_v2'::regclass),
  'headword alias RLS is enabled and forced'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.lexeme_headword_aliases_v2',
    'SELECT'
  ),
  'authenticated can read headword aliases'
);
select ok(
  not has_table_privilege(
    'anon',
    'public.lexeme_headword_aliases_v2',
    'SELECT'
  ),
  'anon cannot read headword aliases'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.lexeme_headword_aliases_v2',
    'INSERT'
  ),
  'authenticated cannot insert headword aliases'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.lexeme_headword_aliases_v2',
    'UPDATE'
  ),
  'authenticated cannot update headword aliases'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.lexeme_headword_aliases_v2',
    'DELETE'
  ),
  'authenticated cannot delete headword aliases'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'lexeme_headword_aliases_v2_one_primary_idx'
  ),
  'one-primary alias invariant is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'lexeme_headword_aliases_v2_lookup_idx'
  ),
  'active alias lookup is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'lexeme_headword_aliases_v2_lexeme_idx'
  ),
  'alias lexeme foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'lexeme_headword_aliases_v2_source_revision_idx'
  ),
  'alias source revision foreign key is indexed'
);

insert into public.lexemes (id, lemma, display_form, pos)
values
  (
    'd1000000-0000-4000-8000-000000000002',
    'd10_melk_fixture',
    'd10_melk_fixture',
    'noun'
  ),
  -- This second row is intentionally retained only to prove that a source
  -- co-headword cannot become a second learner entity.
  (
    'd1000000-0000-4000-8000-000000000003',
    'd10_mjølk_fixture',
    'd10_mjølk_fixture',
    'noun'
  );

create temporary table d10_v22_paradigm_fixture (
  fixture_order integer primary key,
  lemma text not null,
  paradigm_id text not null,
  identity text not null,
  value text not null,
  tags jsonb not null
);

insert into d10_v22_paradigm_fixture (
  fixture_order, lemma, paradigm_id, identity, value, tags
) values
  (
    1,
    'd10_melk_fixture',
    '564',
    'bm|37729|d10_melk_fixture|noun|564',
    'melken',
    '["NOUN","Masc","Sing","Def"]'::jsonb
  ),
  (
    2,
    'd10_melk_fixture',
    '760',
    'bm|37729|d10_melk_fixture|noun|760',
    'melka',
    '["NOUN","Fem","Sing","Def"]'::jsonb
  ),
  (
    3,
    'd10_mjølk_fixture',
    '564',
    'bm|37729|d10_mj%C3%B8lk_fixture|noun|564',
    'mjølken',
    '["NOUN","Masc","Sing","Def"]'::jsonb
  ),
  (
    4,
    'd10_mjølk_fixture',
    '760',
    'bm|37729|d10_mj%C3%B8lk_fixture|noun|760',
    'mjølka',
    '["NOUN","Fem","Sing","Def"]'::jsonb
  );

create temporary table d10_v22_payloads as
select
  jsonb_build_object(
    'version', 'authoritative-morphology/v2.2-pgtap',
    'status', 'resolved',
    'requestedPos', 'noun',
    'lookup', jsonb_build_object(
      'query', 'd10_melk_fixture',
      'normalizedQuery', 'd10_melk_fixture',
      'requestedDictionaries', jsonb_build_array('bm'),
      'scopeUsed', 'e',
      'articleReferences', jsonb_build_array(
        jsonb_build_object('dictionaryCode', 'bm', 'articleId', '37729')
      ),
      'articles', jsonb_build_array(
        jsonb_build_object(
          'dictionaryCode', 'bm',
          'articleId', '37729',
          'sourceUrl', 'https://ord.uib.no/bm/article/37729.json',
          'payload', jsonb_build_object(
            'version', 'pgtap-fixture-v1',
            'lemmas', jsonb_build_array(
              jsonb_build_object('final_lexeme', 'd10_melk_fixture'),
              jsonb_build_object('final_lexeme', 'd10_mjølk_fixture')
            )
          )
        )
      ),
      'errors', '[]'::jsonb,
      'checkedAt', '2026-09-08T00:00:00.000Z'
    ),
    'paradigms', (
      select jsonb_agg(
        jsonb_build_object(
          'identity', fixture.identity,
          'source', 'Ordbokene',
          'dictionaryCode', 'bm',
          'articleId', '37729',
          'articleUrl', 'https://ord.uib.no/bm/article/37729.json',
          'articleVersion', 'pgtap-fixture-v1',
          'pos', 'noun',
          'paradigmId', fixture.paradigm_id,
          'lemma', fixture.lemma,
          'paradigmTags', jsonb_build_array('NOUN'),
          'inflectionGroup', null,
          'standardisation', null,
          'preference', null,
          'forms', jsonb_build_array(
            jsonb_build_object(
              'formKey', 'noun_singular_definite',
              'value', fixture.value,
              'normalizedValue', fixture.value,
              'tags', fixture.tags,
              'sourceOrdinal', 0
            )
          )
        )
        order by fixture.fixture_order
      )
      from d10_v22_paradigm_fixture as fixture
    )
  ) as resolution,
  jsonb_build_array(
    jsonb_build_object(
      'dictionaryCode', 'bm',
      'articleId', '37729',
      'pos', 'noun',
      'lemma', 'd10_melk_fixture',
      'formKey', 'noun_singular_definite',
      'primary', jsonb_build_array(
        jsonb_build_object('value', 'melken', 'normalizedValue', 'melken')
      ),
      'alternatives', jsonb_build_array(
        jsonb_build_object('value', 'melka', 'normalizedValue', 'melka'),
        jsonb_build_object('value', 'mjølken', 'normalizedValue', 'mjølken'),
        jsonb_build_object('value', 'mjølka', 'normalizedValue', 'mjølka')
      ),
      'regularityMarker', 'unknown',
      'evidenceIds', jsonb_build_array('ordbokene:bm:37729'),
      'policyVersion', 'bokmal-written-display/v2'
    )
  ) as display_groups;

create temporary table d10_v22_mjoelk_payloads as
select
  jsonb_set(
    jsonb_set(
      resolution,
      '{lookup,query}',
      '"d10_mjølk_fixture"'::jsonb
    ),
    '{lookup,normalizedQuery}',
    '"d10_mjølk_fixture"'::jsonb
  ) as resolution,
  jsonb_build_array(
    (display_groups -> 0) || jsonb_build_object(
      'lemma', 'd10_mjølk_fixture',
      'primary', jsonb_build_array(
        jsonb_build_object('value', 'mjølken', 'normalizedValue', 'mjølken')
      ),
      'alternatives', jsonb_build_array(
        jsonb_build_object('value', 'mjølka', 'normalizedValue', 'mjølka'),
        jsonb_build_object('value', 'melken', 'normalizedValue', 'melken'),
        jsonb_build_object('value', 'melka', 'normalizedValue', 'melka')
      )
    )
  ) as display_groups
from d10_v22_payloads;

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    resolution::text,
    display_groups::text,
    '{"matches":false,"fixture":"melk"}'::jsonb::text
  ),
  'melk projection publishes from the shared source revision'
)
from d10_v22_payloads;

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_revisions_v2
    where article_id = 37729
      and parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  1,
  'one source revision is stored after the first projection'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_headwords_v2 as headword
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  2,
  'the source revision contains two official headwords'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_paradigms_v2 as paradigm
    join private.authoritative_morphology_source_headwords_v2 as headword
      on headword.id = paradigm.source_headword_id
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  4,
  'the two headwords retain four gender paradigms'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_forms_v2 as source_form
    join private.authoritative_morphology_source_paradigms_v2 as paradigm
      on paradigm.id = source_form.source_paradigm_id
    join private.authoritative_morphology_source_headwords_v2 as headword
      on headword.id = paradigm.source_headword_id
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  4,
  'the shared catalog stores each fixture form once'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_snapshot_sources_v2 as binding
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = binding.snapshot_id
    where snapshot.lexeme_id =
      'd1000000-0000-4000-8000-000000000002'
  ),
  1,
  'the melk snapshot binds to one source revision'
);

select is(
  (select primary_values
   from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and form_key = 'noun_singular_definite'),
  array['melken']::text[],
  'melk uses the masculine written form as compact primary'
);

select is(
  (select alternative_values
   from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and form_key = 'noun_singular_definite'),
  array['melka', 'mjølken', 'mjølka']::text[],
  'melk retains gender and co-headword alternatives'
);

select is(
  (select count(*)::integer
   from public.lexeme_headword_aliases_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and is_active),
  2,
  'one canonical lexeme exposes both official headwords'
);

select is(
  (select count(*)::integer
   from public.lexeme_headword_aliases_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and is_active
     and is_primary),
  1,
  'the canonical lexeme has exactly one primary headword'
);

select is(
  (select lexeme_id
   from public.lexeme_headword_aliases_v2
   where dictionary_code = 'bm'
     and article_id = 37729
     and normalized_headword = 'd10_mjølk_fixture'
     and pos = 'noun'
     and is_active),
  'd1000000-0000-4000-8000-000000000002'::uuid,
  'mjølk resolves to the canonical melk learner lexeme'
);

select ok(
  (select is_primary
   from public.lexeme_headword_aliases_v2
   where dictionary_code = 'bm'
     and article_id = 37729
     and normalized_headword = 'd10_melk_fixture'
     and pos = 'noun'
     and is_active),
  'the exact lookup headword is the primary alias'
);

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    resolution::text,
    display_groups::text,
    '{"matches":false,"fixture":"melk-republish"}'::jsonb::text
  ),
  're-publishing the canonical lexeme reuses the same source revision'
)
from d10_v22_payloads;

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_revisions_v2
    where article_id = 37729
      and parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  1,
  'canonical re-publication does not duplicate the source revision'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_headwords_v2 as headword
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  2,
  'canonical re-publication does not duplicate source headwords'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_paradigms_v2 as paradigm
    join private.authoritative_morphology_source_headwords_v2 as headword
      on headword.id = paradigm.source_headword_id
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  4,
  'canonical re-publication does not duplicate source paradigms'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_forms_v2 as source_form
    join private.authoritative_morphology_source_paradigms_v2 as paradigm
      on paradigm.id = source_form.source_paradigm_id
    join private.authoritative_morphology_source_headwords_v2 as headword
      on headword.id = paradigm.source_headword_id
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = headword.source_revision_id
    where revision.article_id = 37729
      and revision.parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  4,
  'canonical re-publication does not duplicate source forms'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_snapshot_sources_v2 as binding
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = binding.snapshot_id
    where snapshot.lexeme_id =
      'd1000000-0000-4000-8000-000000000002'
  ),
  2,
  'both canonical snapshots bind to the shared revision'
);

select is(
  (select count(*)::integer
   from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and is_active),
  1,
  'canonical re-publication leaves exactly one active snapshot'
);

select is(
  (select count(*)::integer
   from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and form_key = 'noun_singular_definite'),
  1,
  'canonical re-publication replaces rather than duplicates display rows'
);

select is(
  (select count(*)::integer
   from public.lexeme_headword_aliases_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
     and is_active),
  2,
  'canonical re-publication preserves exactly two active aliases'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_paradigms_v2 as old_paradigm
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = old_paradigm.snapshot_id
    where snapshot.lexeme_id =
      'd1000000-0000-4000-8000-000000000002'
  ),
  0,
  'new publishes do not duplicate evidence in the old per-lexeme raw table'
);

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000003',
    resolution::text,
    display_groups::text,
    '{"matches":false,"fixture":"duplicate-learner"}'::jsonb::text
  ),
  '55000',
  'SOURCE_HEADWORD_ALREADY_BOUND',
  'a source co-headword cannot be bound to a second learner lexeme'
)
from d10_v22_mjoelk_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    resolution::text,
    (display_groups #- '{0,primary}')::text,
    '{}'::jsonb::text
  ),
  '55000',
  'INVALID_DISPLAY_GROUPS',
  'publisher rejects a display group with a missing primary array'
)
from d10_v22_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    (resolution #- '{paradigms,0,forms,0,tags}')::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'INVALID_SOURCE_FORMS',
  'publisher rejects a source form with missing tags'
)
from d10_v22_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    jsonb_set(
      resolution,
      '{paradigms,3,lemma}',
      '"d10_unsourced_fixture"'::jsonb
    )::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'COHEADWORD_LEMMA_NOT_IN_SOURCE_ARTICLE',
  'publisher rejects a headword absent from the fetched source article'
)
from d10_v22_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    jsonb_set(
      jsonb_set(
        resolution,
        '{paradigms,0,lemma}',
        '"d10_mjølk_fixture"'::jsonb
      ),
      '{paradigms,1,lemma}',
      '"d10_mjølk_fixture"'::jsonb
    )::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'LOOKUP_LEMMA_PARADIGM_REQUIRED',
  'publisher rejects a payload that omits the exact lookup headword'
)
from d10_v22_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    jsonb_set(
      resolution,
      '{lookup,articles,0,payload}',
      '{}'::jsonb
    )::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'INVALID_SOURCE_ARTICLE_PAYLOAD',
  'publisher rejects an article without its authoritative lemma payload'
)
from d10_v22_payloads;

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_revisions_v2
    where article_id = 37729
      and parser_version = 'authoritative-morphology/v2.2-pgtap'
  ),
  1,
  'failed publishes do not create source revisions'
);

select is(
  (select count(*)::integer
   from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000003'),
  0,
  'failed alias binding leaves no second-learner snapshot'
);

select * from finish();
rollback;

-- D10 V2.2 lemma-aware persistence regression (PENDING).
-- Run only after promoting and applying the matching V2.2 migration.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(13);

select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.authoritative_morphology_paradigms_v2'::regclass
      and conname = 'authoritative_morphology_para_snapshot_id_dictionary_code_a_key'
  ),
  'pre-V2.2 source identity constraint is removed'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.authoritative_morphology_paradigms_v2'::regclass
      and conname = 'authoritative_morphology_paradigms_v2_source_identity_key'
      and contype = 'u'
      and pg_get_constraintdef(oid) =
        'UNIQUE (snapshot_id, dictionary_code, article_id, lemma, pos, paradigm_id)'
  ),
  'source identity uniqueness includes the official lemma'
);

insert into public.lexemes (id, lemma, display_form, pos)
values (
  'd1000000-0000-4000-8000-000000000002',
  'melk',
  'melk',
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
  (1, 'melk',  '564', 'bm|37729|melk|noun|564',       'melken',  '["NOUN","Masc","Sing","Def"]'::jsonb),
  (2, 'melk',  '760', 'bm|37729|melk|noun|760',       'melka',   '["NOUN","Fem","Sing","Def"]'::jsonb),
  (3, 'mjølk', '564', 'bm|37729|mj%C3%B8lk|noun|564', 'mjølken', '["NOUN","Masc","Sing","Def"]'::jsonb),
  (4, 'mjølk', '760', 'bm|37729|mj%C3%B8lk|noun|760', 'mjølka',  '["NOUN","Fem","Sing","Def"]'::jsonb);

create temporary table d10_v22_payloads as
select
  jsonb_build_object(
    'version', 'authoritative-morphology/v2.2',
    'status', 'resolved',
    'requestedPos', 'noun',
    'lookup', jsonb_build_object(
      'query', 'melk',
      'normalizedQuery', 'melk',
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
            'lemmas', jsonb_build_array(
              jsonb_build_object('final_lexeme', 'melk'),
              jsonb_build_object('final_lexeme', 'mjølk')
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
          'articleVersion', null,
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
      'lemma', 'melk',
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

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    resolution::text,
    display_groups::text,
    '{"matches":false,"reason":"v2.2-coheadword-regression"}'::jsonb::text
  ),
  'publisher accepts reused paradigm IDs belonging to distinct official lemmas'
)
from d10_v22_payloads;

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_paradigms_v2 as paradigm
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = paradigm.snapshot_id
    where snapshot.lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and snapshot.is_active
  ),
  4,
  'all four melk/mjølk source paradigms are persisted'
);

select is(
  (
    select count(distinct paradigm.identity)::integer
    from private.authoritative_morphology_paradigms_v2 as paradigm
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = paradigm.snapshot_id
    where snapshot.lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and snapshot.is_active
  ),
  4,
  'all four canonical paradigm identities remain distinct'
);

select is(
  (
    select array_agg(distinct paradigm.lemma order by paradigm.lemma)
    from private.authoritative_morphology_paradigms_v2 as paradigm
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = paradigm.snapshot_id
    where snapshot.lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and snapshot.is_active
  ),
  array['melk', 'mjølk']::text[],
  'raw evidence retains both official co-headword lemmas'
);

select is(
  (
    select primary_values
    from public.lexeme_form_display_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and form_key = 'noun_singular_definite'
  ),
  array['melken']::text[],
  'exact lookup lemma supplies the compact primary form'
);

select is(
  (
    select alternative_values
    from public.lexeme_form_display_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and form_key = 'noun_singular_definite'
  ),
  array['melka', 'mjølken', 'mjølka']::text[],
  'official gender and co-headword forms remain ordered alternatives'
);

select is(
  (
    select source_article_ids
    from private.authoritative_morphology_snapshots_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and is_active
  ),
  array[37729]::bigint[],
  'co-headword projection retains its single source article identity'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_snapshots_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and is_active
  ),
  1,
  'exactly one co-headword snapshot is active'
);

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    jsonb_set(resolution, '{paradigms,3,lemma}', '"fløte"'::jsonb)::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'COHEADWORD_LEMMA_NOT_IN_SOURCE_ARTICLE',
  'publisher rejects a co-headword absent from the fetched source article'
)
from d10_v22_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000002',
    jsonb_set(
      jsonb_set(resolution, '{paradigms,0,lemma}', '"mjølk"'::jsonb),
      '{paradigms,1,lemma}', '"mjølk"'::jsonb
    )::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'LOOKUP_LEMMA_PARADIGM_REQUIRED',
  'publisher rejects a payload that omits the exact lookup lemma'
)
from d10_v22_payloads;

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_snapshots_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000002'
      and is_active
  ),
  1,
  'failed co-headword publishes leave the confirmed snapshot active'
);

select * from finish();
rollback;

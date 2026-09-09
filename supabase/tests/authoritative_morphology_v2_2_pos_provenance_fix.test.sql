-- D10 V2.2 regression: lookup homonyms from another POS must not be stored
-- or bound as provenance for the accepted lexeme snapshot.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(6);

insert into public.lexemes (id, lemma, display_form, pos)
values (
  'd1000000-0000-4000-8000-000000000004',
  'd10_pos_fixture',
  'd10_pos_fixture',
  'verb'
);

create temporary table d10_v22_pos_payload as
select
  jsonb_build_object(
    'version', 'authoritative-morphology/v2.2-pos-pgtap',
    'status', 'resolved',
    'requestedPos', 'verb',
    'lookup', jsonb_build_object(
      'query', 'd10_pos_fixture',
      'normalizedQuery', 'd10_pos_fixture',
      'requestedDictionaries', jsonb_build_array('bm'),
      'scopeUsed', 'e',
      'articleReferences', jsonb_build_array(
        jsonb_build_object(
          'dictionaryCode', 'bm',
          'articleId', '91001'
        ),
        jsonb_build_object(
          'dictionaryCode', 'bm',
          'articleId', '91002'
        )
      ),
      'articles', jsonb_build_array(
        -- This homonymous article represents another POS. It was fetched by
        -- exact lookup, but produced no accepted verb paradigm.
        jsonb_build_object(
          'dictionaryCode', 'bm',
          'articleId', '91001',
          'sourceUrl', 'https://ord.uib.no/bm/article/91001.json',
          'payload', jsonb_build_object(
            'version', 'pgtap-unrelated-noun-v1',
            'lemmas', jsonb_build_array(
              jsonb_build_object('final_lexeme', 'd10_pos_fixture')
            )
          )
        ),
        -- Only this article contributes a validated verb paradigm.
        jsonb_build_object(
          'dictionaryCode', 'bm',
          'articleId', '91002',
          'sourceUrl', 'https://ord.uib.no/bm/article/91002.json',
          'payload', jsonb_build_object(
            'version', 'pgtap-accepted-verb-v1',
            'lemmas', jsonb_build_array(
              jsonb_build_object('final_lexeme', 'd10_pos_fixture')
            )
          )
        )
      ),
      'errors', '[]'::jsonb,
      'checkedAt', '2026-09-08T00:00:00.000Z'
    ),
    'paradigms', jsonb_build_array(
      jsonb_build_object(
        'identity', 'bm|91002|d10_pos_fixture|verb|1',
        'source', 'Ordbokene',
        'dictionaryCode', 'bm',
        'articleId', '91002',
        'articleUrl', 'https://ord.uib.no/bm/article/91002.json',
        'articleVersion', 'pgtap-accepted-verb-v1',
        'pos', 'verb',
        'paradigmId', '1',
        'lemma', 'd10_pos_fixture',
        'paradigmTags', jsonb_build_array('VERB'),
        'inflectionGroup', 'VERB_regular',
        'standardisation', 'STANDARD',
        'preference', null,
        'forms', jsonb_build_array(
          jsonb_build_object(
            'formKey', 'infinitive',
            'value', 'd10_pos_fixture',
            'normalizedValue', 'd10_pos_fixture',
            'tags', jsonb_build_array('VERB', 'Inf'),
            'sourceOrdinal', 0
          )
        )
      )
    )
  ) as resolution,
  jsonb_build_array(
    jsonb_build_object(
      'dictionaryCode', 'bm',
      'articleId', '91002',
      'pos', 'verb',
      'lemma', 'd10_pos_fixture',
      'formKey', 'infinitive',
      'primary', jsonb_build_array(
        jsonb_build_object(
          'value', 'd10_pos_fixture',
          'normalizedValue', 'd10_pos_fixture'
        )
      ),
      'alternatives', '[]'::jsonb,
      'regularityMarker', 'regular',
      'evidenceIds', jsonb_build_array('ordbokene:bm:91002'),
      'policyVersion', 'bokmal-written-display/v2'
    )
  ) as display_groups;

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000004',
    resolution::text,
    display_groups::text,
    '{"fixture":"pos-provenance"}'::jsonb::text
  ),
  'publisher accepts a lookup containing a homonym from another POS'
)
from d10_v22_pos_payload;

select is(
  (
    select source_article_ids
    from private.authoritative_morphology_snapshots_v2
    where lexeme_id = 'd1000000-0000-4000-8000-000000000004'
      and is_active
  ),
  array[91002]::bigint[],
  'snapshot contains only the article contributing the accepted verb POS'
);

select is(
  (
    select array_agg(revision.article_id order by revision.article_id)
    from private.authoritative_morphology_snapshot_sources_v2 as binding
    join private.authoritative_morphology_snapshots_v2 as snapshot
      on snapshot.id = binding.snapshot_id
    join private.authoritative_morphology_source_revisions_v2 as revision
      on revision.id = binding.source_revision_id
    where snapshot.lexeme_id =
      'd1000000-0000-4000-8000-000000000004'
      and snapshot.is_active
  ),
  array[91002]::bigint[],
  'snapshot provenance binds only the POS-validated article'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_revisions_v2
    where article_id = 91001
      and parser_version = 'authoritative-morphology/v2.2-pos-pgtap'
  ),
  0,
  'unrelated-POS article is not stored in the source catalog'
);

select is(
  (
    select count(*)::integer
    from private.authoritative_morphology_source_revisions_v2
    where article_id = 91002
      and parser_version = 'authoritative-morphology/v2.2-pos-pgtap'
  ),
  1,
  'accepted-POS article is stored exactly once'
);

select is(
  (
    select array_agg(alias_record.article_id order by alias_record.article_id)
    from public.lexeme_headword_aliases_v2 as alias_record
    where alias_record.lexeme_id =
      'd1000000-0000-4000-8000-000000000004'
      and alias_record.pos = 'verb'
      and alias_record.is_active
  ),
  array[91002]::bigint[],
  'learner alias projection contains only the accepted verb article'
);

select * from finish();
rollback;

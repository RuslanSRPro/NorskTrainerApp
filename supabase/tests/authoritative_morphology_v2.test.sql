-- D10 authoritative morphology V2 pgTAP regression suite.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(54);

select has_schema('private');
select has_table('private', 'authoritative_morphology_snapshots_v2', 'private snapshot table exists');
select has_table('private', 'authoritative_morphology_paradigms_v2', 'private paradigm table exists');
select has_table('private', 'authoritative_morphology_forms_v2', 'private source-form table exists');
select has_table('private', 'authoritative_morphology_comparisons_v2', 'private comparison table exists');
select has_table('public', 'lexeme_form_display_v2', 'public canonical projection exists');
select has_function(
  'public',
  'publish_authoritative_morphology_snapshot_v2',
  array['uuid', 'jsonb', 'jsonb', 'jsonb']
);

select col_is_pk('public', 'lexeme_form_display_v2', array['lexeme_id', 'form_key']);
select col_type_is(
  'public', 'lexeme_form_display_v2', 'primary_values', 'text[]',
  'primary values are stored as an ordered text array'
);
select col_type_is(
  'public', 'lexeme_form_display_v2', 'alternative_values', 'text[]',
  'alternative values are stored separately as an ordered text array'
);
select col_type_is(
  'private', 'authoritative_morphology_snapshots_v2', 'source_article_ids', 'bigint[]',
  'snapshots retain the complete source article set'
);
select col_type_is(
  'private', 'authoritative_morphology_snapshots_v2', 'article_resolution', 'text',
  'snapshots record how source articles were resolved'
);
select col_type_is(
  'public', 'lexeme_form_display_v2', 'article_ids', 'bigint[]',
  'canonical rows retain every contributing article ID'
);
select col_not_null(
  'public', 'lexeme_form_display_v2', 'article_ids',
  'canonical article provenance is mandatory'
);
select ok(
  not (select attnotnull from pg_attribute
       where attrelid = 'public.lexeme_form_display_v2'::regclass
         and attname = 'article_id' and not attisdropped),
  'single article_id is nullable for equivalent multi-article projections'
);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'private.authoritative_morphology_snapshots_v2'::regclass),
  'snapshot RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'private.authoritative_morphology_paradigms_v2'::regclass),
  'paradigm RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'private.authoritative_morphology_forms_v2'::regclass),
  'source-form RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'private.authoritative_morphology_comparisons_v2'::regclass),
  'comparison RLS is enabled and forced'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'public.lexeme_form_display_v2'::regclass),
  'projection RLS is enabled and forced'
);

select ok(
  has_table_privilege('authenticated', 'public.lexeme_form_display_v2', 'SELECT'),
  'authenticated can read the canonical projection'
);
select ok(
  not has_table_privilege('anon', 'public.lexeme_form_display_v2', 'SELECT'),
  'anon cannot read the canonical projection'
);
select ok(
  not has_table_privilege('authenticated', 'public.lexeme_form_display_v2', 'INSERT'),
  'authenticated cannot write the canonical projection'
);
select ok(
  not has_table_privilege('service_role', 'private.authoritative_morphology_forms_v2', 'SELECT'),
  'private source rows have no direct service-role access'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'service_role can publish through the guarded RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot publish snapshots'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anon cannot publish snapshots'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'private'
    and indexname = 'authoritative_morphology_paradigms_v2_snapshot_id_idx'),
  'paradigm foreign key is indexed'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'private'
    and indexname = 'authoritative_morphology_forms_v2_paradigm_id_idx'),
  'form foreign key is indexed'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'private'
    and indexname = 'authoritative_morphology_comparisons_v2_lexeme_id_idx'),
  'comparison lexeme foreign key is indexed'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public'
    and indexname = 'lexeme_form_display_v2_snapshot_id_idx'),
  'projection snapshot foreign key is indexed'
);

insert into public.lexemes (id, lemma, display_form, pos)
values (
  'd1000000-0000-4000-8000-000000000001',
  'd10_håpe_fixture',
  'd10_håpe_fixture',
  'verb'
);

create temporary table d10_payloads as
select
  jsonb_build_object(
    'version', 'authoritative-morphology/v2',
    'status', 'resolved',
    'requestedPos', 'verb',
    'lookup', jsonb_build_object(
      'query', 'd10_håpe_fixture',
      'normalizedQuery', 'd10_håpe_fixture',
      'requestedDictionaries', jsonb_build_array('bm'),
      'scopeUsed', 'e',
      'articleReferences', jsonb_build_array(jsonb_build_object('dictionaryCode', 'bm', 'articleId', '25496')),
      'articles', jsonb_build_array(jsonb_build_object('dictionaryCode', 'bm', 'articleId', '25496')),
      'errors', '[]'::jsonb,
      'checkedAt', '2026-09-02T00:00:00.000Z'
    ),
    'paradigms', jsonb_build_array(jsonb_build_object(
      'identity', 'bm|25496|verb|fixture',
      'source', 'Ordbokene',
      'dictionaryCode', 'bm',
      'articleId', '25496',
      'articleUrl', 'https://ord.uib.no/bm/article/25496.json',
      'articleVersion', null,
      'pos', 'verb',
      'paradigmId', 'fixture',
      'lemma', 'd10_håpe_fixture',
      'paradigmTags', jsonb_build_array('VERB'),
      'inflectionGroup', 'VERB_regular',
      'standardisation', null,
      'preference', null,
      'forms', jsonb_build_array(
        jsonb_build_object('formKey', 'preterite', 'value', 'håpa', 'normalizedValue', 'håpa', 'tags', jsonb_build_array('Past'), 'sourceOrdinal', 0),
        jsonb_build_object('formKey', 'preterite', 'value', 'håpet', 'normalizedValue', 'håpet', 'tags', jsonb_build_array('Past'), 'sourceOrdinal', 1),
        jsonb_build_object('formKey', 'preterite', 'value', 'håpte', 'normalizedValue', 'håpte', 'tags', jsonb_build_array('Past'), 'sourceOrdinal', 2)
      )
    ))
  ) as resolution,
  jsonb_build_array(jsonb_build_object(
    'dictionaryCode', 'bm',
    'articleId', '25496',
    'pos', 'verb',
    'lemma', 'd10_håpe_fixture',
    'formKey', 'preterite',
    'primary', jsonb_build_array(
      jsonb_build_object('value', 'håpet', 'normalizedValue', 'håpet'),
      jsonb_build_object('value', 'håpte', 'normalizedValue', 'håpte')
    ),
    'alternatives', jsonb_build_array(
      jsonb_build_object('value', 'håpa', 'normalizedValue', 'håpa')
    ),
    'regularityMarker', 'unknown',
    'evidenceIds', jsonb_build_array(
      'ordbokene:official-form',
      'sprakradet:a-endelser-i-bokmal:2025-05-07',
      'product-policy:bm-written-verb-a-alternative-v1'
    ),
    'policyVersion', 'bokmal-written-display/v1'
  )) as display_groups;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    jsonb_set(resolution, '{lookup,requestedDictionaries}', '["nn"]'::jsonb)::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'BOKMAL_ONLY_REQUIRED',
  'publisher rejects Nynorsk payloads'
)
from d10_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    (display_groups || jsonb_build_array(jsonb_set(display_groups -> 0, '{articleId}', '99999'::jsonb)))::text,
    '{}'::jsonb::text
  ),
  '55000',
  'PARADIGM_ARTICLE_SET_MISMATCH',
  'publisher rejects display article identities absent from source paradigms'
)
from d10_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    jsonb_set(resolution, '{status}', '"partial"'::jsonb)::text,
    display_groups::text,
    '{}'::jsonb::text
  ),
  '55000',
  'SOURCE_RESULT_INCOMPLETE',
  'publisher rejects partial source results'
)
from d10_payloads;

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    display_groups::text,
    '{"matches":false,"v2Count":3,"legacyCount":1}'::jsonb::text
  ),
  'complete unambiguous Bokmål snapshot publishes'
)
from d10_payloads;

select is(
  (select primary_values from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and form_key = 'preterite'),
  array['håpet', 'håpte']::text[],
  'canonical projection preserves ordered written primary variants'
);
select is(
  (select alternative_values from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and form_key = 'preterite'),
  array['håpa']::text[],
  'canonical projection keeps official -a alternative separate'
);
select is(
  (select dictionary_code from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' limit 1),
  'bm',
  'application projection is Bokmål only'
);
select is(
  (select count(*)::integer from private.authoritative_morphology_forms_v2
   where value in ('håpa', 'håpet', 'håpte')),
  3,
  'all official source variants remain in private evidence'
);
select is(
  (select count(*)::integer from private.authoritative_morphology_forms_v2
   where value like 'har %' or value like 'hadde %' or form_key = 'needs_review'),
  0,
  'publisher creates no auxiliary or pseudo-forms'
);
select is(
  (select count(*)::integer from private.authoritative_morphology_comparisons_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001'),
  1,
  'one comparison is stored for the snapshot'
);
select is(
  (select count(*)::integer from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and is_active),
  1,
  'exactly one snapshot is active'
);

create temporary table d10_multi_payloads as
select
  jsonb_set(
    jsonb_set(
      jsonb_set(
        resolution,
        '{lookup,articleReferences}',
        (resolution #> '{lookup,articleReferences}') || jsonb_build_array(
          jsonb_build_object('dictionaryCode', 'bm', 'articleId', '99999')
        )
      ),
      '{lookup,articles}',
      (resolution #> '{lookup,articles}') || jsonb_build_array(
        jsonb_build_object('dictionaryCode', 'bm', 'articleId', '99999')
      )
    ),
    '{paradigms}',
    (resolution -> 'paradigms') || jsonb_build_array(
      (resolution -> 'paradigms' -> 0) || jsonb_build_object(
        'identity', 'bm|99999|verb|fixture',
        'articleId', '99999',
        'articleUrl', 'https://ord.uib.no/bm/article/99999.json'
      )
    )
  ) as resolution,
  display_groups || jsonb_build_array(
    (display_groups -> 0) || jsonb_build_object('articleId', '99999')
  ) as display_groups
from d10_payloads;

select lives_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    display_groups::text,
    '{"matches":true,"v2Count":3,"legacyCount":3}'::jsonb::text
  ),
  'equivalent same-POS articles publish as one canonical projection'
)
from d10_multi_payloads;

select is(
  (select source_article_ids from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and is_active),
  array[25496, 99999]::bigint[],
  'active snapshot retains both source article identities'
);
select is(
  (select article_resolution from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and is_active),
  'equivalent_source_articles',
  'active snapshot records equivalent source resolution'
);
select is(
  (select article_ids from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and form_key = 'preterite'),
  array[25496, 99999]::bigint[],
  'canonical row exposes complete source provenance'
);
select is(
  (select article_id from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and form_key = 'preterite'),
  null::bigint,
  'canonical row does not choose an arbitrary primary article'
);
select is(
  (select count(*)::integer from public.lexeme_form_display_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and form_key = 'preterite'),
  1,
  'equivalent articles produce one learner-facing form row'
);
select is(
  (select count(*)::integer
   from private.authoritative_morphology_paradigms_v2 as paradigm
   join private.authoritative_morphology_snapshots_v2 as snapshot
     on snapshot.id = paradigm.snapshot_id
   where snapshot.lexeme_id = 'd1000000-0000-4000-8000-000000000001'
     and snapshot.is_active),
  2,
  'private evidence retains both article-specific paradigms'
);

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    jsonb_set(
      jsonb_set(display_groups, '{1,primary,1,value}', '"håpte-x"'::jsonb),
      '{1,primary,1,normalizedValue}', '"håpte-x"'::jsonb
    )::text,
    '{}'::jsonb::text
  ),
  '55000',
  'SOURCE_ARTICLE_PROJECTIONS_DIVERGE',
  'publisher rejects divergent article projections'
)
from d10_multi_payloads;

select is(
  (select count(*)::integer from private.authoritative_morphology_snapshots_v2
   where lexeme_id = 'd1000000-0000-4000-8000-000000000001' and is_active),
  1,
  'failed divergent publish leaves exactly one active snapshot'
);

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(display_groups, '{0,primary,1,value}', '"håpte-x"'::jsonb),
          '{0,primary,1,normalizedValue}', '"håpte-x"'::jsonb
        ),
        '{1,primary,1,value}', '"håpte-x"'::jsonb
      ),
      '{1,primary,1,normalizedValue}', '"håpte-x"'::jsonb
    )::text,
    '{}'::jsonb::text
  ),
  '55000',
  'DISPLAY_FORM_NOT_IN_SOURCE',
  'publisher rejects equivalent but invented display forms'
)
from d10_multi_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    (display_groups || jsonb_build_array(display_groups -> 0))::text,
    '{}'::jsonb::text
  ),
  '55000',
  'DUPLICATE_DISPLAY_GROUP',
  'publisher rejects duplicate article and form groups'
)
from d10_multi_payloads;

select throws_ok(
  format(
    'select public.publish_authoritative_morphology_snapshot_v2(%L, %L::jsonb, %L::jsonb, %L::jsonb)',
    'd1000000-0000-4000-8000-000000000001',
    resolution::text,
    jsonb_set(
      display_groups,
      '{0,alternatives}',
      (display_groups #> '{0,alternatives}') || jsonb_build_array(display_groups #> '{0,primary,0}')
    )::text,
    '{}'::jsonb::text
  ),
  '55000',
  'DUPLICATE_OR_OVERLAPPING_DISPLAY_FORM',
  'publisher rejects primary and alternative tier overlap'
)
from d10_multi_payloads;

select * from finish();
rollback;

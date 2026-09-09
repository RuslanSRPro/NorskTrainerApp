-- D10 pending pgTAP: ordinary learner "bli" binds only to BM 6390.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(7);

select is(
  (
    select count(*)
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and dictionary_code = 'bm'
      and normalized_lemma = 'bli'
      and pos = 'verb'
      and is_active
  ),
  1::bigint,
  'ordinary learner bli has exactly one active BM verb binding'
);

select is(
  (
    select article_id
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and dictionary_code = 'bm'
      and normalized_lemma = 'bli'
      and pos = 'verb'
      and is_active
  ),
  6390::bigint,
  'ordinary learner bli binds explicitly to BM article 6390'
);

select is(
  (
    select article_id
    from public.get_authoritative_morphology_article_bindings_v2(
      array['e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid]
    )
  ),
  6390::bigint,
  'service binding reader returns BM article 6390 for bli'
);

select is(
  (
    select evidence_ids
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and article_id = 6390
      and is_active
  ),
  array[
    'ordbokene:bm:6390',
    'manual:lexeme-semantic-binding:bli-become-stay-passive'
  ]::text[],
  'bli binding retains explicit source and semantic evidence identifiers'
);

select is(
  (
    select evidence ->> 'decision'
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and article_id = 6390
      and is_active
  ),
  'ordinary_bli_become_stay_passive'::text,
  'bli binding records the semantic decision'
);

select is(
  (
    select evidence -> 'rejectedHomographArticleIds'
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and article_id = 6390
      and is_active
  ),
  jsonb_build_array(6460),
  'bli binding records BM 6460 as a rejected semantic homograph'
);

select is(
  (
    select count(*)
    from private.authoritative_morphology_article_bindings_v2
    where lexeme_id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
      and article_id = 6460
      and is_active
  ),
  0::bigint,
  'semantic homograph BM 6460 is not active for the ordinary bli lexeme'
);

select * from finish();
rollback;

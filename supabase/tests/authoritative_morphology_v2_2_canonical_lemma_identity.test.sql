-- D10 canonical lemma identity regression.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(4);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'display_form'
  ) = 0,
  'publisher never uses display_form as dictionary identity'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'lower(btrim(v_lexeme.lemma))'
  ) > 0,
  'publisher validates normalizedQuery against canonical lemma'
);

select ok(
  strpos(
    pg_get_functiondef(
      'private.validate_authoritative_article_binding_v2()'::regprocedure
    ),
    'display_form'
  ) = 0,
  'binding validator never uses display_form as dictionary identity'
);

select ok(
  strpos(
    pg_get_functiondef(
      'private.validate_authoritative_article_binding_v2()'::regprocedure
    ),
    'lower(btrim(lexeme.lemma))'
  ) > 0,
  'binding validator validates against canonical lemma'
);

select * from finish();

rollback;

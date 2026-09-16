-- D10 co-headword and primary-alias source identity regression.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(5);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'lower(btrim(source_lemma ->> ''lemma''))'
  ) > 0,
  'publisher accepts the complete source lemma'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'lower(btrim(source_lemma ->> ''final_lexeme''))'
  ) > 0,
  'publisher may also validate against final_lexeme'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'lexeme_id = excluded.lexeme_id'
  ) > 0,
  'primary alias ownership can move to its canonical lexeme'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'not public.lexeme_headword_aliases_v2.is_primary'
  ) > 0,
  'only a non-primary alias can be reclaimed'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'lower(btrim(v_lookup ->> ''normalizedQuery''))'
  ) > 0,
  'a conflicting canonical primary alias still fails closed'
);

select * from finish();

rollback;

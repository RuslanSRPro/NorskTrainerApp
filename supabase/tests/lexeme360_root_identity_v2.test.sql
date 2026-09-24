begin;

create extension if not exists pgtap with schema extensions;
set local search_path = pg_catalog, public, extensions, private;
select plan(12);

select has_table(
  'private',
  'lexeme360_expression_roots_v1',
  'Lexeme360 many-to-many root binding exists'
);

select col_is_pk(
  'private',
  'lexeme360_expression_roots_v1',
  array['expression_id', 'root_lexeme_id'],
  'binding identity is expression plus root lexeme'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'lexeme360_expression_roots_v1'
      and column_name in ('status', 'verification_status', 'ready')
  ),
  'binding table does not duplicate expression status'
);

select has_function(
  'private', 'refresh_lexeme360_root_v2', array['uuid'],
  'exact UUID root refresh exists'
);

select has_function(
  'public', 'get_lexeme360_ready_expressions_v2', array['uuid'],
  'ready RPC accepts a lexeme UUID'
);

select has_function(
  'public', 'get_lexeme360_candidate_expressions_v2', array['uuid'],
  'candidate RPC accepts a lexeme UUID'
);

select ok(
  not has_table_privilege('anon',
    'private.lexeme360_expression_roots_v1', 'select')
  and not has_table_privilege('authenticated',
    'private.lexeme360_expression_roots_v1', 'select'),
  'application roles cannot read private bindings'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.bind_lexeme360_expression_root_v2(uuid,bigint,text,text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.bind_lexeme360_expression_root_v2(uuid,bigint,text,text)',
    'execute'
  ),
  'application roles cannot write root bindings'
);

select ok(
  exists (
    select 1
    from private.lexeme360_expression_roots_v1 binding
    where binding.root_lexeme_id =
      'e07c93b8-0b08-4484-8801-e5fcbef92e2e'::uuid
  ),
  'få expressions bind to the exact verb root'
);

select is(
  (
    select count(*)::integer
    from private.lexeme360_expression_roots_v1 binding
    where binding.root_lexeme_id =
      '585a8319-8613-4994-872c-7d3cbf0da850'::uuid
      and exists (
        select 1
        from public.expression_catalog expression
        where expression.id = binding.expression_id
          and private.normalize_lexeme360_root_v1(expression.root_lemma) = 'få'
      )
  ),
  0,
  'få expressions do not leak to the adjective homonym'
);

select ok(
  coalesce((
    select lexeme360_available
      and lexeme360_candidate_count > 0
      and lexeme360_ready_count = 0
    from public.lexemes
    where id = 'e07c93b8-0b08-4484-8801-e5fcbef92e2e'::uuid
  ), false),
  'få verb exposes its non-learning expressions as grey candidates'
);

select ok(
  coalesce((
    select not lexeme360_available
    from public.lexemes
    where id = '585a8319-8613-4994-872c-7d3cbf0da850'::uuid
  ), false),
  'få adjective stays fail-closed without its own family'
);

select * from finish();
rollback;

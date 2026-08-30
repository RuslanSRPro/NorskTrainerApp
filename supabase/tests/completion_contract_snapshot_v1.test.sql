begin;

select plan(12);

select ok(
  to_regprocedure('public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)') is not null,
  'snapshot v1 function exists with the versioned signature'
);

select is(
  (
    select p.prorettype::regtype::text
    from pg_proc as p
    where p.oid = 'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  'jsonb',
  'snapshot v1 returns jsonb'
);

select is(
  (
    select p.provolatile::text
    from pg_proc as p
    where p.oid = 'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  's',
  'snapshot v1 is STABLE'
);

select ok(
  not (
    select p.prosecdef
    from pg_proc as p
    where p.oid = 'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  'snapshot v1 is SECURITY INVOKER'
);

select ok(
  (
    select 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
    from pg_proc as p
    where p.oid = 'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  'snapshot v1 pins an empty search_path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)',
    'EXECUTE'
  ),
  'anon cannot execute snapshot v1'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute snapshot v1'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)',
    'EXECUTE'
  ),
  'service_role can execute snapshot v1'
);

select ok(
  position(
    'insert into' in lower(pg_get_functiondef(
      'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
    ))
  ) = 0,
  'snapshot v1 contains no INSERT statement'
);

select ok(
  position(
    'update public.' in lower(pg_get_functiondef(
      'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
    ))
  ) = 0,
  'snapshot v1 contains no UPDATE statement'
);

select ok(
  position(
    'delete from' in lower(pg_get_functiondef(
      'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
    ))
  ) = 0,
  'snapshot v1 contains no DELETE statement'
);

select throws_ok(
  $$select public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000000000'::uuid,
    null,
    20,
    null
  )$$,
  'P0002',
  'JOB_NOT_FOUND',
  'unknown jobs fail closed'
);

select * from finish();
rollback;

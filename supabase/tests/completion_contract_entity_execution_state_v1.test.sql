begin;

select plan(8);

-- Fixed UUIDs and sentinel lemmas keep the fixture deterministic.
insert into public.lexemes (id, lemma, pos)
values
  ('00000000-0000-4000-8000-000000002101', '__cc_state_done__', 'adverb'),
  ('00000000-0000-4000-8000-000000002102', '__cc_state_pending__', 'adverb'),
  ('00000000-0000-4000-8000-000000002103', '__cc_state_partial_job__', 'adverb'),
  ('00000000-0000-4000-8000-000000002104', '__cc_state_clean__', 'adverb');

insert into public.lexeme_processing_jobs (id, input_type, input_text, status)
values
  ('00000000-0000-4000-8000-000000001101', 'manual', '__cc_mixed_items__', 'pending'),
  ('00000000-0000-4000-8000-000000001102', 'manual', '__cc_partial_job__', 'pending'),
  ('00000000-0000-4000-8000-000000001103', 'manual', '__cc_clean_job__', 'pending');

insert into public.lexeme_processing_items (
  id,
  job_id,
  lexeme_id,
  raw_input,
  normalized_input,
  normalized_lemma,
  pos,
  status
)
values
  (
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000002101',
    '__cc_state_done__',
    '__cc_state_done__',
    '__cc_state_done__',
    'adverb',
    'done'
  ),
  (
    '00000000-0000-4000-8000-000000003102',
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000002102',
    '__cc_state_pending__',
    '__cc_state_pending__',
    '__cc_state_pending__',
    'adverb',
    'pending'
  ),
  (
    '00000000-0000-4000-8000-000000003103',
    '00000000-0000-4000-8000-000000001102',
    '00000000-0000-4000-8000-000000002103',
    '__cc_state_partial_job__',
    '__cc_state_partial_job__',
    '__cc_state_partial_job__',
    'adverb',
    'done'
  ),
  (
    '00000000-0000-4000-8000-000000003104',
    '00000000-0000-4000-8000-000000001103',
    '00000000-0000-4000-8000-000000002104',
    '__cc_state_clean__',
    '__cc_state_clean__',
    '__cc_state_clean__',
    'adverb',
    'done'
  );

insert into public.pipeline_supervisor_state (job_id, stage)
values
  ('00000000-0000-4000-8000-000000001101', 'done'),
  ('00000000-0000-4000-8000-000000001102', 'done'),
  ('00000000-0000-4000-8000-000000001103', 'done')
on conflict (job_id) do update set stage = excluded.stage;

-- Item triggers recalculate job counters/status. Set the intended terminal fixture
-- states only after all items exist.
update public.lexeme_processing_jobs
set status = case id
  when '00000000-0000-4000-8000-000000001102'::uuid then 'partial'
  else 'completed'
end,
finished_at = now()
where id in (
  '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001102',
  '00000000-0000-4000-8000-000000001103'
);

select like(
  pg_get_functiondef(
    'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  '%state_item.status is distinct from ''done''%',
  'snapshot v1 contains the fail-closed item-state predicate'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001101',
    null,
    20,
    null
  ) ->> 'execution_state',
  'needs_manual_review',
  'a terminal completed job with a pending item is not complete'
);

select is(
  (
    select entity ->> 'execution_state'
    from jsonb_array_elements(
      public.get_completion_evidence_snapshot_v1(
        '00000000-0000-4000-8000-000000001101',
        null,
        20,
        null
      ) -> 'page' -> 'entities'
    ) as entity
    where entity ->> 'entity_id' = '00000000-0000-4000-8000-000000002101'
  ),
  'completed',
  'a done entity in an otherwise inconsistent completed job remains completed'
);

select is(
  (
    select entity ->> 'execution_state'
    from jsonb_array_elements(
      public.get_completion_evidence_snapshot_v1(
        '00000000-0000-4000-8000-000000001101',
        null,
        20,
        null
      ) -> 'page' -> 'entities'
    ) as entity
    where entity ->> 'entity_id' = '00000000-0000-4000-8000-000000002102'
  ),
  'needs_manual_review',
  'an entity backed by a pending item fails closed'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001102',
    null,
    20,
    null
  ) ->> 'execution_state',
  'needs_manual_review',
  'a partial terminal job requires manual review even when its item is done'
);

select is(
  (
    select entity ->> 'execution_state'
    from jsonb_array_elements(
      public.get_completion_evidence_snapshot_v1(
        '00000000-0000-4000-8000-000000001102',
        null,
        20,
        null
      ) -> 'page' -> 'entities'
    ) as entity
    where entity ->> 'entity_id' = '00000000-0000-4000-8000-000000002103'
  ),
  'needs_manual_review',
  'entities in a partial terminal job inherit the review state'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001103',
    null,
    20,
    null
  ) ->> 'execution_state',
  'completed',
  'a completed job with only done items remains completed'
);

select is(
  (
    select entity ->> 'execution_state'
    from jsonb_array_elements(
      public.get_completion_evidence_snapshot_v1(
        '00000000-0000-4000-8000-000000001103',
        null,
        20,
        null
      ) -> 'page' -> 'entities'
    ) as entity
    where entity ->> 'entity_id' = '00000000-0000-4000-8000-000000002104'
  ),
  'completed',
  'a done entity in a clean completed job remains completed'
);

select * from finish();
rollback;

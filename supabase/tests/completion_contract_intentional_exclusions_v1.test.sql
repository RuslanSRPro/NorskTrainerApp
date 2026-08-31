begin;

select plan(14);

insert into public.lexeme_processing_jobs (id, input_type, input_text, status)
values
  ('00000000-0000-4000-8000-000000001201', 'manual', '__cc_function_word__', 'pending'),
  ('00000000-0000-4000-8000-000000001202', 'manual', '__cc_admission_review__', 'pending'),
  ('00000000-0000-4000-8000-000000001203', 'manual', '__cc_spoofed_exclusion__', 'pending'),
  ('00000000-0000-4000-8000-000000001204', 'manual', '__cc_missing_evidence__', 'pending');

insert into public.lexeme_processing_items (
  id,
  job_id,
  raw_input,
  normalized_input,
  normalized_lemma,
  pos,
  status,
  current_stage,
  result_summary
)
values
  (
    '00000000-0000-4000-8000-000000003201',
    '00000000-0000-4000-8000-000000001201',
    'Jeg',
    'jeg',
    'jeg',
    'pronoun',
    'done',
    'admission_gate',
    jsonb_build_object(
      'promotion_status', 'not_promoted',
      'admission_status', 'rejected',
      'admission_reason', 'function_word_pronoun',
      'admission_decision', jsonb_build_object(
        'admit', false,
        'status', 'rejected',
        'reason', 'function_word_pronoun',
        'rule_type', 'function_word'
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000003202',
    '00000000-0000-4000-8000-000000001202',
    '__cc_unknown__',
    '__cc_unknown__',
    '__cc_unknown__',
    'unknown',
    'done',
    'admission_gate',
    jsonb_build_object(
      'promotion_status', 'not_promoted',
      'admission_status', 'review',
      'admission_reason', 'unknown_pos_requires_review',
      'admission_decision', jsonb_build_object(
        'admit', false,
        'status', 'review',
        'reason', 'unknown_pos_requires_review'
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000003203',
    '00000000-0000-4000-8000-000000001203',
    '__cc_spoofed__',
    '__cc_spoofed__',
    '__cc_spoofed__',
    'unknown',
    'done',
    'admission_gate',
    jsonb_build_object(
      'promotion_status', 'not_promoted',
      'admission_status', 'rejected',
      'admission_reason', 'function_word_fake',
      'admission_decision', jsonb_build_object(
        'admit', false,
        'status', 'rejected',
        'reason', 'function_word_fake',
        'rule_type', 'custom_rule'
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000003204',
    '00000000-0000-4000-8000-000000001204',
    '__cc_missing_evidence__',
    '__cc_missing_evidence__',
    '__cc_missing_evidence__',
    'unknown',
    'done',
    'admission_gate',
    null
  );

insert into public.pipeline_supervisor_state (job_id, stage)
values
  ('00000000-0000-4000-8000-000000001201', 'done'),
  ('00000000-0000-4000-8000-000000001202', 'done'),
  ('00000000-0000-4000-8000-000000001203', 'done'),
  ('00000000-0000-4000-8000-000000001204', 'done')
on conflict (job_id) do update set stage = excluded.stage;

update public.lexeme_processing_jobs
set status = 'completed', finished_at = now()
where id in (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000001202',
  '00000000-0000-4000-8000-000000001203',
  '00000000-0000-4000-8000-000000001204'
);

select like(
  pg_get_functiondef(
    'public.get_completion_evidence_snapshot_v1(uuid,text,integer,text)'::regprocedure
  ),
  '%rule_type%function_word%',
  'snapshot requires an explicit function_word admission rule'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'counts' ->> 'total_items',
  '1',
  'excluded items remain part of the total source-item count'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'counts' ->> 'excluded_items',
  '1',
  'a proven function word is counted as intentionally excluded'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'counts' ->> 'unresolved_items',
  '0',
  'a proven function word is not unresolved'
);

select is(
  jsonb_array_length(public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'excluded_items'),
  1,
  'the excluded item is exposed for auditability'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'excluded_items' -> 0 ->> 'admission_reason',
  'function_word_pronoun',
  'the exclusion retains its admission reason'
);

select is(
  jsonb_array_length(public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) -> 'unresolved_items'),
  0,
  'the function-word fixture has no unresolved items'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001202', null, 20, null
  ) -> 'counts' ->> 'unresolved_items',
  '1',
  'an admission review item remains unresolved'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001202', null, 20, null
  ) -> 'counts' ->> 'excluded_items',
  '0',
  'an admission review item is not excluded'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001203', null, 20, null
  ) -> 'counts' ->> 'unresolved_items',
  '1',
  'a lookalike reason without function_word rule_type fails closed'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001203', null, 20, null
  ) -> 'counts' ->> 'excluded_items',
  '0',
  'a spoofed function-word exclusion is rejected'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001204', null, 20, null
  ) -> 'counts' ->> 'unresolved_items',
  '1',
  'missing admission evidence fails closed as unresolved'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001204', null, 20, null
  ) -> 'counts' ->> 'excluded_items',
  '0',
  'missing admission evidence is never treated as excluded'
);

select is(
  public.get_completion_evidence_snapshot_v1(
    '00000000-0000-4000-8000-000000001201', null, 20, null
  ) ->> 'execution_state',
  'completed',
  'a done intentional exclusion does not corrupt execution state'
);

select * from finish();
rollback;

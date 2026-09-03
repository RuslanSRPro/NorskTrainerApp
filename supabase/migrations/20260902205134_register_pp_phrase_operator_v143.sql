-- v1.43 - register versioned PP phrase operator capability.
--
-- Scope:
--   * preserve phrase_operator_contract_v1() unchanged;
--   * extend the immutable v1 operator set through phrase_operator_contract_v2();
--   * add a v2 validator that targets the v2 contract;
--   * register the PP phrase template;
--   * do NOT compile PP Runtime IR here;
--   * do NOT activate grammar rules;
--   * do NOT change the production parser.

create or replace function public.phrase_operator_contract_v2()
returns jsonb
language sql
stable
set search_path to 'public', 'pg_catalog'
as $function$
select jsonb_build_object(
  'version',
  'phrase-operator-contract-v2',

  'operators',
  (public.phrase_operator_contract_v1()->'operators')
  ||
  jsonb_build_array(
    jsonb_build_object(
      'build_strategy',
      'head_plus_adjacent_right_dependent',

      'phrase_types',
      jsonb_build_array('PP'),

      'required_actions',
      jsonb_build_array(
        'create_phrase',
        'set_head'
      ),

      'required_pattern_fields',
      jsonb_build_array(
        'phrase_type',
        'head_ref',
        'allowed_right_dependents'
      )
    )
  ),

  'extension_policy',
  public.phrase_operator_contract_v1()->>'extension_policy'
);
$function$;


create or replace function public.validate_phrase_rule_operator_v2(
  p_rule_id uuid
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  r record;
  v_op jsonb;
  v_actions jsonb;
  v_unknown jsonb;
  v_registered boolean := false;
  v_fields_ok boolean := true;
  v_field text;
begin
  select
    id,
    code,
    pattern_type,
    pattern,
    actions
  into r
  from public.grammar_rules
  where id = p_rule_id;

  if r.id is null then
    return jsonb_build_object(
      'status',
      'not_found',
      'rule_id',
      p_rule_id
    );
  end if;

  if r.pattern_type <> 'phrase_pattern' then
    return jsonb_build_object(
      'status',
      'wrong_pattern_type',
      'rule_id',
      p_rule_id,
      'pattern_type',
      r.pattern_type
    );
  end if;

  select value
  into v_op
  from jsonb_array_elements(
    public.phrase_operator_contract_v2()->'operators'
  )
  where value->>'build_strategy' =
        r.pattern->>'build_strategy'
  limit 1;

  v_registered := v_op is not null;

  select coalesce(
    jsonb_agg(
      distinct a->>'action'
      order by a->>'action'
    ),
    '[]'::jsonb
  )
  into v_actions
  from jsonb_array_elements(
    coalesce(r.actions, '[]'::jsonb)
  ) a;

  select coalesce(
    jsonb_agg(x),
    '[]'::jsonb
  )
  into v_unknown
  from jsonb_array_elements_text(v_actions) x
  where x not in (
    'create_phrase',
    'set_head'
  );

  if v_registered then
    for v_field in
      select value
      from jsonb_array_elements_text(
        v_op->'required_pattern_fields'
      )
    loop
      if not (r.pattern ? v_field) then
        v_fields_ok := false;
      end if;
    end loop;
  else
    v_fields_ok := false;
  end if;

  return jsonb_build_object(
    'version',
    'phrase-operator-validation-v2',

    'rule_id',
    r.id,

    'rule_code',
    r.code,

    'build_strategy',
    r.pattern->>'build_strategy',

    'phrase_type',
    r.pattern->>'phrase_type',

    'registered_operator',
    v_registered,

    'declared_actions',
    v_actions,

    'unsupported_actions',
    v_unknown,

    'required_fields_present',
    v_fields_ok,

    'valid',
    v_registered
      and v_fields_ok
      and jsonb_array_length(v_unknown) = 0
  );
end;
$function$;


insert into public.grammar_operator_templates_v1 (
  template_code,
  execution_role,
  pattern_type,
  rule_type,
  builder_contract,
  required_source_paths,
  approval_status,
  notes
)
values (
  'phrase.prepositional_phrase_rule.v1',
  'prepositional_phrase_rule',
  'phrase_pattern',
  'construction',
  'phrase-pattern-manifest-builder-v1',
  '[]'::jsonb,
  'approved',
  'Registered for phrase-operator-contract-v2. Operator capability only; PP Runtime IR compilation and activation remain separate.'
)
on conflict (template_code) do nothing;


-- Migration invariants / drift guards.
do $block$
declare
  v_v1_count integer;
  v_v2_count integer;
  v_pp jsonb;
  v_template record;
begin

  -- Existing v1 contract must remain closed and unchanged by this migration.
  if exists (
    select 1
    from jsonb_array_elements(
      public.phrase_operator_contract_v1()->'operators'
    ) op
    where op->>'build_strategy' =
          'head_plus_adjacent_right_dependent'
  ) then
    raise exception
      'v1.43 invariant failed: PP operator leaked into phrase_operator_contract_v1';
  end if;


  v_v1_count :=
    jsonb_array_length(
      public.phrase_operator_contract_v1()->'operators'
    );

  v_v2_count :=
    jsonb_array_length(
      public.phrase_operator_contract_v2()->'operators'
    );

  if v_v2_count <> v_v1_count + 1 then
    raise exception
      'v1.43 invariant failed: v2 operator count %, expected %',
      v_v2_count,
      v_v1_count + 1;
  end if;


  select value
  into v_pp
  from jsonb_array_elements(
    public.phrase_operator_contract_v2()->'operators'
  )
  where value->>'build_strategy' =
        'head_plus_adjacent_right_dependent'
  limit 1;

  if v_pp is null then
    raise exception
      'v1.43 invariant failed: PP operator missing from v2';
  end if;

  if v_pp->'phrase_types' <> '["PP"]'::jsonb then
    raise exception
      'v1.43 invariant failed: unexpected PP phrase_types: %',
      v_pp->'phrase_types';
  end if;

  if v_pp->'required_actions'
     <> '["create_phrase","set_head"]'::jsonb
  then
    raise exception
      'v1.43 invariant failed: unexpected PP required_actions: %',
      v_pp->'required_actions';
  end if;

  if v_pp->'required_pattern_fields'
     <> '["phrase_type","head_ref","allowed_right_dependents"]'::jsonb
  then
    raise exception
      'v1.43 invariant failed: unexpected PP required_pattern_fields: %',
      v_pp->'required_pattern_fields';
  end if;


  select
    template_code,
    execution_role,
    pattern_type,
    rule_type,
    builder_contract,
    required_source_paths,
    approval_status
  into v_template
  from public.grammar_operator_templates_v1
  where template_code =
        'phrase.prepositional_phrase_rule.v1';

  if v_template.template_code is null then
    raise exception
      'v1.43 invariant failed: PP operator template missing';
  end if;

  if v_template.execution_role <> 'prepositional_phrase_rule'
     or v_template.pattern_type <> 'phrase_pattern'
     or v_template.rule_type <> 'construction'
     or v_template.builder_contract <> 'phrase-pattern-manifest-builder-v1'
     or v_template.required_source_paths <> '[]'::jsonb
     or v_template.approval_status <> 'approved'
  then
    raise exception
      'v1.43 invariant failed: PP operator template contract mismatch';
  end if;

end;
$block$;


comment on function public.phrase_operator_contract_v2()
is
'Phrase operator contract v2. Extends immutable v1 with the v1.43 PP adjacent-right-dependent build strategy. Registration does not activate grammar rules.';


comment on function public.validate_phrase_rule_operator_v2(uuid)
is
'Validates phrase_pattern grammar rules against phrase_operator_contract_v2. Compilation and validation do not imply runtime activation.';
-- v1.44 — Canonical VP phrase operators
--
-- Historical contracts remain immutable:
--   phrase_operator_contract_v1
--   phrase_operator_contract_v2
--   validate_canonical_phrase_pattern_v1
--   validate_grammar_rule_pattern_v3
--
-- v3 adds canonical VP operators without rewriting historical behavior.

create or replace function public.phrase_operator_contract_v3()
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $function$
select jsonb_build_object(
  'version',
  'phrase-operator-contract-v3',

  'operators',
  (public.phrase_operator_contract_v2()->'operators')
  ||
  jsonb_build_array(

    -- Canonical finite VP head.
    --
    -- This is deliberately separate from the historical
    -- finite_head_plus_following_nonfinite operator.
    jsonb_build_object(
      'build_strategy',
      'head_only',

      'phrase_types',
      jsonb_build_array('VP'),

      'required_actions',
      jsonb_build_array(
        'create_phrase',
        'set_head'
      ),

      'required_pattern_fields',
      jsonb_build_array(
        'phrase_type',
        'head_ref'
      )
    ),

    -- Generic cross-candidate phrase expansion.
    --
    -- The operator contains NO Norwegian grammar.
    -- Feature requirements are supplied by Runtime IR bindings.
    jsonb_build_object(
      'build_strategy',
      'head_plus_following_candidate',

      'phrase_types',
      jsonb_build_array('VP'),

      'required_actions',
      jsonb_build_array(
        'create_phrase',
        'set_head'
      ),

      'required_pattern_fields',
      jsonb_build_array(
        'phrase_type',
        'head_ref',
        'dependent_ref',
        'max_gap'
      )
    )
  ),

  'extension_policy',
  public.phrase_operator_contract_v2()->>'extension_policy'
);
$function$;


create or replace function public.validate_canonical_phrase_pattern_v2(
  p_pattern jsonb
)
returns boolean
language plpgsql
stable
set search_path = public, pg_catalog
as $function$
declare
  v_strategy text;
  v_phrase_type text;
  v_operator jsonb;
  v_operator_count integer;
  v_field text;
  v_value jsonb;
begin
  ----------------------------------------------------------------------
  -- 1. Common canonical Runtime IR shape.
  ----------------------------------------------------------------------

  if p_pattern is null
     or jsonb_typeof(p_pattern) <> 'object'
  then
    return false;
  end if;

  if p_pattern->>'runtime_ir_version' <> '1.0'
     or nullif(trim(p_pattern->>'manifest_code'), '') is null
     or jsonb_typeof(p_pattern->'bindings') <> 'object'
     or jsonb_typeof(p_pattern->'condition') <> 'object'
  then
    return false;
  end if;

  v_strategy := nullif(trim(p_pattern->>'build_strategy'), '');
  v_phrase_type := nullif(trim(p_pattern->>'phrase_type'), '');

  if v_strategy is null
     or v_phrase_type is null
  then
    return false;
  end if;


  ----------------------------------------------------------------------
  -- 2. Resolve operator exclusively from versioned contract v3.
  ----------------------------------------------------------------------

  select count(*)
  into v_operator_count
  from jsonb_array_elements(
    public.phrase_operator_contract_v3()->'operators'
  ) op
  where op->>'build_strategy' = v_strategy
    and jsonb_typeof(op->'phrase_types') = 'array'
    and exists (
      select 1
      from jsonb_array_elements_text(op->'phrase_types') pt
      where pt = v_phrase_type
    );

  if v_operator_count <> 1 then
    return false;
  end if;


  select op
  into v_operator
  from jsonb_array_elements(
    public.phrase_operator_contract_v3()->'operators'
  ) op
  where op->>'build_strategy' = v_strategy
    and jsonb_typeof(op->'phrase_types') = 'array'
    and exists (
      select 1
      from jsonb_array_elements_text(op->'phrase_types') pt
      where pt = v_phrase_type
    )
  limit 1;


  if v_operator is null
     or jsonb_typeof(v_operator->'required_pattern_fields') <> 'array'
  then
    return false;
  end if;


  ----------------------------------------------------------------------
  -- 3. Generic required-field validation.
  ----------------------------------------------------------------------

  for v_field in
    select jsonb_array_elements_text(
      v_operator->'required_pattern_fields'
    )
  loop

    if not (p_pattern ? v_field) then
      return false;
    end if;

    v_value := p_pattern->v_field;

    if v_value is null
       or v_value = 'null'::jsonb
    then
      return false;
    end if;

    if jsonb_typeof(v_value) = 'string'
       and nullif(trim(p_pattern->>v_field), '') is null
    then
      return false;
    end if;

    if jsonb_typeof(v_value) = 'array'
       and jsonb_array_length(v_value) = 0
    then
      return false;
    end if;

    if jsonb_typeof(v_value) = 'object'
       and v_value = '{}'::jsonb
    then
      return false;
    end if;

  end loop;


  return true;
end;
$function$;


create or replace function public.validate_grammar_rule_pattern_v4(
  p_pattern_type text,
  p_pattern jsonb
)
returns boolean
language plpgsql
stable
set search_path = public, pg_catalog
as $function$
begin

  if p_pattern_type = 'phrase_pattern' then
    return public.validate_canonical_phrase_pattern_v2(
      p_pattern
    );
  end if;

  -- Preserve all existing non-phrase validation semantics.
  return public.validate_grammar_rule_pattern_v3(
    p_pattern_type,
    p_pattern
  );

end;
$function$;


alter table public.grammar_rules
  drop constraint grammar_rules_valid_pattern_check;

alter table public.grammar_rules
  add constraint grammar_rules_valid_pattern_check
  check (
    public.validate_grammar_rule_pattern_v4(
      pattern_type,
      pattern
    )
  );

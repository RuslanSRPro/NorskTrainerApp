-- v1.43 Canonical Phrase Pattern Validation
--
-- Purpose:
--   * keep historical validators unchanged;
--   * validate new canonical phrase_pattern rules from phrase_operator_contract_v2;
--   * remove duplicated hardcoded phrase-strategy lists from the new path;
--   * preserve all existing non-phrase validation through v2;
--   * allow PP head_plus_adjacent_right_dependent only because it is
--     explicitly registered in phrase_operator_contract_v2.
--
-- This migration does NOT activate any grammar rule and does NOT modify
-- the production parser.

create or replace function public.validate_canonical_phrase_pattern_v1(
  p_pattern jsonb
)
returns boolean
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
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
  -- 2. Resolve the strategy exclusively from phrase_operator_contract_v2.
  --
  -- No hardcoded strategy list is maintained here.
  ----------------------------------------------------------------------

  select count(*)
  into v_operator_count
  from jsonb_array_elements(
    public.phrase_operator_contract_v2()->'operators'
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
    public.phrase_operator_contract_v2()->'operators'
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
  --
  -- The operator contract owns WHICH fields are required.
  -- This validator only checks that those fields are materially present.
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


comment on function public.validate_canonical_phrase_pattern_v1(jsonb)
is
'Canonical Language Graph phrase-pattern validator v1. Strategy and phrase compatibility are owned by phrase_operator_contract_v2; historical phrase validators remain unchanged.';


-- ---------------------------------------------------------------------
-- Grammar-rule validation v3.
--
-- Only phrase_pattern takes the new canonical path.
-- Every other rule type keeps the exact existing v2 behavior.
-- ---------------------------------------------------------------------

create or replace function public.validate_grammar_rule_pattern_v3(
  p_pattern_type text,
  p_pattern jsonb
)
returns boolean
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
begin

  if p_pattern_type = 'phrase_pattern' then
    return public.validate_canonical_phrase_pattern_v1(
      p_pattern
    );
  end if;

  return public.validate_grammar_rule_pattern_v2(
    p_pattern_type,
    p_pattern
  );

end;
$function$;


comment on function public.validate_grammar_rule_pattern_v3(text,jsonb)
is
'Grammar rule pattern validation v3. Canonical phrase_pattern rules use phrase_operator_contract_v2; all other pattern types delegate unchanged to validate_grammar_rule_pattern_v2.';


-- ---------------------------------------------------------------------
-- Migration invariants.
-- ---------------------------------------------------------------------

do $validation$
declare
  v_pp_pattern jsonb;

  v_invalid_existing_phrase_rules integer;
  v_non_phrase_semantic_drift integer;
begin

  ----------------------------------------------------------------------
  -- 1. PP operator capability must already be registered.
  ----------------------------------------------------------------------

  if not exists (
    select 1
    from jsonb_array_elements(
      public.phrase_operator_contract_v2()->'operators'
    ) op
    where op->>'build_strategy' =
          'head_plus_adjacent_right_dependent'
      and op->'phrase_types' = '["PP"]'::jsonb
      and op->'required_actions' =
          '["create_phrase","set_head"]'::jsonb
      and op->'required_pattern_fields' =
          '["phrase_type","head_ref","allowed_right_dependents"]'::jsonb
  ) then
    raise exception
      'v1.43 canonical validation: PP operator v2 contract missing or drifted';
  end if;


  ----------------------------------------------------------------------
  -- 2. Synthetic PP pattern corresponding to Wave A.
  ----------------------------------------------------------------------

  v_pp_pattern :=
    jsonb_build_object(
      'bindings',
        jsonb_build_object(
          'head',
          jsonb_build_object(
            'scope', 'sentence',
            'where',
              jsonb_build_object(
                'op', 'eq',
                'left',
                  jsonb_build_object(
                    'ref', 'head.pos'
                  ),
                'right', 'preposition'
              ),
            'entity', 'candidate',
            'cardinality', 'one_or_more'
          )
        ),

      'head_ref', 'head',

      'condition',
        jsonb_build_object(
          'op', 'exists',
          'left',
            jsonb_build_object(
              'ref', 'head.id'
            )
        ),

      'phrase_type', 'PP',

      'manifest_code',
        'ir.structural.prepositional_phrase.preposition_head_pp_complement',

      'build_strategy',
        'head_plus_adjacent_right_dependent',

      'runtime_ir_version', '1.0',

      'allowed_right_dependents',
        jsonb_build_array('PP')
    );


  if public.validate_canonical_phrase_pattern_v1(
       v_pp_pattern
     ) is distinct from true
  then
    raise exception
      'v1.43 canonical validation: PP pattern rejected by canonical validator';
  end if;


  if public.validate_grammar_rule_pattern_v3(
       'phrase_pattern',
       v_pp_pattern
     ) is distinct from true
  then
    raise exception
      'v1.43 canonical validation: PP pattern rejected by grammar validator v3';
  end if;


  ----------------------------------------------------------------------
  -- 3. Historical path must remain unchanged.
  --
  -- Before this migration PP is intentionally rejected by v2.
  ----------------------------------------------------------------------

  if public.validate_grammar_rule_pattern_v2(
       'phrase_pattern',
       v_pp_pattern
     ) is distinct from false
  then
    raise exception
      'v1.43 canonical validation: historical validator v2 unexpectedly changed';
  end if;


  ----------------------------------------------------------------------
  -- 4. Every currently stored phrase_pattern must remain valid.
  --
  -- This protects AP / NP / VP backward compatibility.
  ----------------------------------------------------------------------

  select count(*)
  into v_invalid_existing_phrase_rules
  from public.grammar_rules r
  where r.pattern_type = 'phrase_pattern'
    and public.validate_canonical_phrase_pattern_v1(
          r.pattern
        ) is distinct from true;

  if v_invalid_existing_phrase_rules <> 0 then
    raise exception
      'v1.43 canonical validation: % existing phrase_pattern rules fail canonical validation',
      v_invalid_existing_phrase_rules;
  end if;


  ----------------------------------------------------------------------
  -- 5. Non-phrase semantics must be identical to validator v2.
  ----------------------------------------------------------------------

  select count(*)
  into v_non_phrase_semantic_drift
  from public.grammar_rules r
  where r.pattern_type <> 'phrase_pattern'
    and public.validate_grammar_rule_pattern_v3(
          r.pattern_type,
          r.pattern
        )
        is distinct from
        public.validate_grammar_rule_pattern_v2(
          r.pattern_type,
          r.pattern
        );

  if v_non_phrase_semantic_drift <> 0 then
    raise exception
      'v1.43 canonical validation: non-phrase validator semantics drifted for % stored rules',
      v_non_phrase_semantic_drift;
  end if;

end;
$validation$;


-- ---------------------------------------------------------------------
-- Move grammar_rules CHECK from historical validator v2 to v3.
--
-- Existing rows are validated before this transaction can succeed.
-- ---------------------------------------------------------------------

alter table public.grammar_rules
  drop constraint if exists grammar_rules_valid_pattern_check;


alter table public.grammar_rules
  add constraint grammar_rules_valid_pattern_check
  check (
    public.validate_grammar_rule_pattern_v3(
      pattern_type,
      pattern
    )
  )
  not valid;


alter table public.grammar_rules
  validate constraint grammar_rules_valid_pattern_check;


comment on constraint grammar_rules_valid_pattern_check
on public.grammar_rules
is
'v1.43+: phrase_pattern uses canonical operator-contract validation; all other pattern types preserve grammar validator v2 semantics.';


-- ---------------------------------------------------------------------
-- Final guards after CHECK replacement.
-- ---------------------------------------------------------------------

do $final$
declare
  v_constraint_definition text;
begin

  select pg_get_constraintdef(c.oid, true)
  into v_constraint_definition
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'grammar_rules'
    and c.conname = 'grammar_rules_valid_pattern_check';

  if v_constraint_definition is null
     or v_constraint_definition not ilike
          '%validate_grammar_rule_pattern_v3%'
  then
    raise exception
      'v1.43 canonical validation: grammar_rules CHECK was not switched to v3';
  end if;

end;
$final$;
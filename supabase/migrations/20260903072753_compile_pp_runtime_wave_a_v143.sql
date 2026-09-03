-- v1.43 PP Runtime IR Wave A
--
-- Scope:
--   * compile one source-backed PP manifest;
--   * compile one inactive phrase_pattern grammar rule;
--   * preserve direct-vs-manifest source provenance;
--   * validate against phrase_operator_contract_v2;
--   * keep v1 operator validation incompatible with the new strategy;
--   * do NOT activate the rule;
--   * do NOT add runtime triggers;
--   * do NOT change the shadow snapshot allowlist;
--   * do NOT compile PP premodifier/order-core rules yet;
--   * do NOT change the production parser.
--
-- Compile hash:
-- Reproduces the current Runtime compiler contract:
-- SHA-256 over JSONB {
--   code,
--   pattern_type,
--   rule_type,
--   pattern,
--   actions,
--   result,
--   triggers
-- }.

do $migration$
declare
  v_head public.grammar_knowledge_candidates%rowtype;
  v_pp_complement public.grammar_knowledge_candidates%rowtype;
  v_normal_position public.grammar_knowledge_candidates%rowtype;

  v_manifest public.grammar_runtime_manifests%rowtype;
  v_rule public.grammar_rules%rowtype;

  v_manifest_code constant text :=
    'ir.structural.prepositional_phrase.preposition_head_pp_complement';

  v_rule_code constant text :=
    'nrg_rt_v1.structural.prepositional_phrase.preposition_head_pp_complement';

  v_compiler_version constant text :=
    'grammar-runtime-compiler-pp-v143-wave-a';

  v_compile_hash text;

  v_validated_by constant text :=
    'structural_wave_v143_pp_a';

  v_validation_notes constant text :=
    'PP Wave A validates PREP-headed PP plus adjacent right PP candidate generation. '
    'premodifier.allowed, premodifier.adjective_comparative_superlative, and '
    'structure.order_core remain deferred until source-backed left-dependent '
    'filtering is available. Compiled does not mean activated.';

  v_bindings jsonb;
  v_condition jsonb;
  v_actions jsonb;
  v_language_scope jsonb;
  v_dependencies jsonb;
  v_generation jsonb;
  v_explanation jsonb;
  v_compiler jsonb;
  v_ir_spec jsonb;
  v_pattern jsonb;
  v_result jsonb;
  v_description jsonb;

  v_manifest_source_count integer;
  v_rule_source_count integer;
  v_deferred_ready_count integer;

  v_validation_v1 jsonb;
  v_validation_v2 jsonb;
begin

  ----------------------------------------------------------------------
  -- 1. Resolve stable Chapter 6 sources by candidate_code.
  --    No generated UUID is hardcoded.
  ----------------------------------------------------------------------

  begin
    select c.*
    into strict v_head
    from public.grammar_knowledge_candidates c
    where c.extracted_payload->>'candidate_code' =
          'preposition.phrase.head';
  exception
    when no_data_found then
      raise exception
        'PP Wave A: source candidate preposition.phrase.head not found';
    when too_many_rows then
      raise exception
        'PP Wave A: source candidate preposition.phrase.head is not unique';
  end;


  begin
    select c.*
    into strict v_pp_complement
    from public.grammar_knowledge_candidates c
    where c.extracted_payload->>'candidate_code' =
          'prepositional_phrase.complement.pp_allowed';
  exception
    when no_data_found then
      raise exception
        'PP Wave A: source candidate complement.pp_allowed not found';
    when too_many_rows then
      raise exception
        'PP Wave A: source candidate complement.pp_allowed is not unique';
  end;


  begin
    select c.*
    into strict v_normal_position
    from public.grammar_knowledge_candidates c
    where c.extracted_payload->>'candidate_code' =
          'prepositional_phrase.complement.normal_position';
  exception
    when no_data_found then
      raise exception
        'PP Wave A: source candidate complement.normal_position not found';
    when too_many_rows then
      raise exception
        'PP Wave A: source candidate complement.normal_position is not unique';
  end;


  ----------------------------------------------------------------------
  -- 2. Source audit guards.
  ----------------------------------------------------------------------

  if v_head.status <> 'source_verified'
     or v_head.extraction_confidence is distinct from 1.0000::numeric
     or v_head.requires_human_verification is distinct from false
     or v_head.extracted_payload #>> '{details,source_reaudit}'
          <> 'chapter6_full_v2'
     or v_head.extracted_payload #>> '{details,constraint_strength}'
          <> 'categorical'
  then
    raise exception
      'PP Wave A: preposition.phrase.head source contract drifted';
  end if;


  if v_pp_complement.status <> 'source_verified'
     or v_pp_complement.extraction_confidence is distinct from 1.0000::numeric
     or v_pp_complement.requires_human_verification is distinct from false
     or v_pp_complement.extracted_payload #>> '{details,source_reaudit}'
          <> 'chapter6_full_v2'
     or v_pp_complement.extracted_payload #>> '{details,constraint_strength}'
          <> 'categorical'
  then
    raise exception
      'PP Wave A: complement.pp_allowed source contract drifted';
  end if;


  if v_normal_position.status <> 'source_verified'
     or v_normal_position.extraction_confidence is distinct from 1.0000::numeric
     or v_normal_position.requires_human_verification is distinct from false
     or v_normal_position.extracted_payload #>> '{details,source_reaudit}'
          <> 'chapter6_full_v2'
     or v_normal_position.extracted_payload #>> '{details,constraint_strength}'
          <> 'default'
  then
    raise exception
      'PP Wave A: complement.normal_position source contract drifted';
  end if;


  -- The three deferred PP sources must also still be source-ready.
  select count(*)
  into v_deferred_ready_count
  from public.grammar_knowledge_candidates c
  where c.extracted_payload->>'candidate_code' in (
      'prepositional_phrase.premodifier.allowed',
      'prepositional_phrase.premodifier.adjective_comparative_superlative',
      'prepositional_phrase.structure.order_core'
    )
    and c.status = 'source_verified'
    and c.extraction_confidence = 1.0000::numeric
    and c.requires_human_verification = false
    and c.extracted_payload #>> '{details,source_reaudit}' =
        'chapter6_full_v2'
    and (
      (
        c.extracted_payload->>'candidate_code' =
          'prepositional_phrase.structure.order_core'
        and c.extracted_payload #>> '{details,constraint_strength}' =
          'default'
      )
      or
      (
        c.extracted_payload->>'candidate_code' in (
          'prepositional_phrase.premodifier.allowed',
          'prepositional_phrase.premodifier.adjective_comparative_superlative'
        )
        and c.extracted_payload #>> '{details,constraint_strength}' =
          'categorical'
      )
    );

  if v_deferred_ready_count <> 3 then
    raise exception
      'PP Wave A: expected 3 deferred source-ready PP candidates, found %',
      v_deferred_ready_count;
  end if;


  ----------------------------------------------------------------------
  -- 3. Operator capability must already exist in v2 only.
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
      'PP Wave A: required v2 PP phrase operator is missing';
  end if;


  if exists (
    select 1
    from jsonb_array_elements(
      public.phrase_operator_contract_v1()->'operators'
    ) op
    where op->>'build_strategy' =
          'head_plus_adjacent_right_dependent'
  ) then
    raise exception
      'PP Wave A: PP operator unexpectedly exists in immutable v1 contract';
  end if;


  if not exists (
    select 1
    from public.grammar_operator_templates_v1 t
    where t.template_code =
          'phrase.prepositional_phrase_rule.v1'
      and t.pattern_type = 'phrase_pattern'
      and t.execution_role = 'prepositional_phrase_rule'
      and t.approval_status = 'approved'
  ) then
    raise exception
      'PP Wave A: approved PP operator template is missing';
  end if;


  ----------------------------------------------------------------------
  -- 4. Canonical Runtime IR payload.
  ----------------------------------------------------------------------

  v_bindings :=
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
    );


  v_condition :=
    jsonb_build_object(
      'op', 'exists',
      'left',
        jsonb_build_object(
          'ref', 'head.id'
        )
    );


  v_actions :=
    jsonb_build_array(
      jsonb_build_object(
        'value',
          jsonb_build_object(
            'phrase_type', 'PP'
          ),
        'action', 'create_phrase',
        'target', 'head',
        'reason_code', 'nrg_preposition_phrase_head'
      ),
      jsonb_build_object(
        'value',
          jsonb_build_object(
            'phrase_type', 'PP'
          ),
        'action', 'set_head',
        'target', 'head',
        'reason_code', 'nrg_preposition_head_required'
      )
    );


  v_language_scope :=
    jsonb_build_object(
      'registers',
        jsonb_build_array(
          'neutral',
          'formal',
          'informal'
        ),
      'written_standards',
        jsonb_build_array(
          'nb',
          'nn'
        )
    );


  -- No invented lexical/morphological dependency is introduced here.
  v_dependencies := '{}'::jsonb;


  v_generation :=
    jsonb_build_object(
      'enabled', false,
      'strategy', 'none',
      'output_constraints', '[]'::jsonb
    );


  -- Explanation text is taken from the verified source rows themselves.
  v_explanation :=
    jsonb_build_object(
      'focus',
        jsonb_build_array(
          'prepositional_phrase',
          'head',
          'pp_complement'
        ),
      'teacher_role', 'phrase_structure',
      'why_it_applies_template', v_head.source_excerpt,
      'pp_complement_support', v_pp_complement.source_excerpt,
      'ordering_note', v_normal_position.source_excerpt
    );


  v_compiler :=
    jsonb_build_object(
      'strategy', 'single_rule',
      'target_rule_types',
        jsonb_build_array(
          'phrase_pattern'
        )
    );


  v_ir_spec :=
    jsonb_build_object(
      'code', v_manifest_code,

      'source',
        jsonb_build_object(
          'source_section', v_head.source_section,
          'primary_candidate_code',
            'preposition.phrase.head',
          'supporting_candidate_codes',
            jsonb_build_array(
              'prepositional_phrase.complement.pp_allowed',
              'prepositional_phrase.complement.normal_position'
            )
        ),

      'actions', v_actions,

      'runtime',
        jsonb_build_object(
          'phase', 'phrase_build',
          'family', 'prepositional_phrase',
          'capabilities',
            jsonb_build_array(
              'recognize',
              'build',
              'relate',
              'explain'
            ),
          'execution_mode', 'deterministic',
          'diagnostic_policy', 'none',

          -- Combined executable rule is default because right adjacency
          -- comes from complement.normal_position, which is a default.
          'constraint_strength', 'default',

          'minimum_resolution_confidence', 0.8
        ),

      'bindings', v_bindings,
      'compiler', v_compiler,
      'condition', v_condition,
      'generation', v_generation,
      'ir_version', '1.0',
      'explanation', v_explanation,
      'dependencies', v_dependencies,
      'language_scope', v_language_scope
    );


  ----------------------------------------------------------------------
  -- 5. Insert validated Runtime IR manifest.
  ----------------------------------------------------------------------

  if not exists (
    select 1
    from public.grammar_runtime_manifests m
    where m.code = v_manifest_code
  ) then

    insert into public.grammar_runtime_manifests (
      code,
      primary_candidate_id,
      topic_id,
      ir_version,
      runtime_family,
      execution_phase,
      execution_mode,
      capabilities,
      constraint_strength,
      diagnostic_policy,
      language_scope,
      dependencies,
      bindings,
      condition,
      actions,
      generation,
      explanation,
      compiler,
      ir_spec,
      authoring_status,
      validation_notes,
      validated_at,
      validated_by
    )
    values (
      v_manifest_code,
      v_head.id,
      v_head.topic_id,
      '1.0',
      'prepositional_phrase',
      'phrase_build',
      'deterministic',
      array[
        'recognize',
        'build',
        'relate',
        'explain'
      ]::text[],
      'default',
      'none',
      v_language_scope,
      v_dependencies,
      v_bindings,
      v_condition,
      v_actions,
      v_generation,
      v_explanation,
      v_compiler,
      v_ir_spec,
      'validated',
      v_validation_notes,
      now(),
      v_validated_by
    );

  end if;


  select m.*
  into strict v_manifest
  from public.grammar_runtime_manifests m
  where m.code = v_manifest_code;


  ----------------------------------------------------------------------
  -- 6. Manifest drift guards.
  ----------------------------------------------------------------------

  if v_manifest.primary_candidate_id is distinct from v_head.id
     or v_manifest.topic_id is distinct from v_head.topic_id
     or v_manifest.ir_version <> '1.0'
     or v_manifest.runtime_family <> 'prepositional_phrase'
     or v_manifest.execution_phase <> 'phrase_build'
     or v_manifest.execution_mode <> 'deterministic'
     or v_manifest.constraint_strength <> 'default'
     or v_manifest.diagnostic_policy <> 'none'
     or v_manifest.authoring_status <> 'validated'
     or v_manifest.bindings is distinct from v_bindings
     or v_manifest.condition is distinct from v_condition
     or v_manifest.actions is distinct from v_actions
     or v_manifest.dependencies is distinct from v_dependencies
     or v_manifest.language_scope is distinct from v_language_scope
     or v_manifest.generation is distinct from v_generation
     or v_manifest.compiler is distinct from v_compiler
  then
    raise exception
      'PP Wave A: Runtime IR manifest contract mismatch';
  end if;


  if v_manifest.capabilities is distinct from
       array[
         'recognize',
         'build',
         'relate',
         'explain'
       ]::text[]
  then
    raise exception
      'PP Wave A: manifest capabilities drifted';
  end if;


  if v_manifest.ir_spec->>'code' <> v_manifest_code
     or v_manifest.ir_spec->>'ir_version' <> '1.0'
     or v_manifest.ir_spec #>> '{runtime,family}'
          <> 'prepositional_phrase'
     or v_manifest.ir_spec #>> '{runtime,phase}'
          <> 'phrase_build'
     or v_manifest.ir_spec #>> '{runtime,constraint_strength}'
          <> 'default'
  then
    raise exception
      'PP Wave A: ir_spec identity/runtime contract mismatch';
  end if;


  ----------------------------------------------------------------------
  -- 7. Manifest source provenance.
  ----------------------------------------------------------------------

  if not exists (
    select 1
    from public.grammar_runtime_manifest_sources s
    where s.manifest_id = v_manifest.id
      and s.candidate_id = v_head.id
      and s.source_role = 'primary'
  ) then
    insert into public.grammar_runtime_manifest_sources (
      manifest_id,
      candidate_id,
      source_role,
      notes
    )
    values (
      v_manifest.id,
      v_head.id,
      'primary',
      'PP Wave A primary Chapter 6 source.'
    );
  end if;


  if not exists (
    select 1
    from public.grammar_runtime_manifest_sources s
    where s.manifest_id = v_manifest.id
      and s.candidate_id = v_pp_complement.id
      and s.source_role = 'supporting'
  ) then
    insert into public.grammar_runtime_manifest_sources (
      manifest_id,
      candidate_id,
      source_role,
      notes
    )
    values (
      v_manifest.id,
      v_pp_complement.id,
      'supporting',
      'PP Wave A supporting nested-PP permission source.'
    );
  end if;


  if not exists (
    select 1
    from public.grammar_runtime_manifest_sources s
    where s.manifest_id = v_manifest.id
      and s.candidate_id = v_normal_position.id
      and s.source_role = 'supporting'
  ) then
    insert into public.grammar_runtime_manifest_sources (
      manifest_id,
      candidate_id,
      source_role,
      notes
    )
    values (
      v_manifest.id,
      v_normal_position.id,
      'supporting',
      'PP Wave A supporting default right-position source.'
    );
  end if;


  select count(*)
  into v_manifest_source_count
  from public.grammar_runtime_manifest_sources s
  where s.manifest_id = v_manifest.id;

  if v_manifest_source_count <> 3 then
    raise exception
      'PP Wave A: expected exactly 3 manifest sources, found %',
      v_manifest_source_count;
  end if;


  if not exists (
       select 1
       from public.grammar_runtime_manifest_sources s
       where s.manifest_id = v_manifest.id
         and s.candidate_id = v_head.id
         and s.source_role = 'primary'
     )
     or not exists (
       select 1
       from public.grammar_runtime_manifest_sources s
       where s.manifest_id = v_manifest.id
         and s.candidate_id = v_pp_complement.id
         and s.source_role = 'supporting'
     )
     or not exists (
       select 1
       from public.grammar_runtime_manifest_sources s
       where s.manifest_id = v_manifest.id
         and s.candidate_id = v_normal_position.id
         and s.source_role = 'supporting'
     )
  then
    raise exception
      'PP Wave A: manifest source ownership mismatch';
  end if;


  -- Deferred sources must NOT be claimed by this executable manifest.
  if exists (
    select 1
    from public.grammar_runtime_manifest_sources s
    join public.grammar_knowledge_candidates c
      on c.id = s.candidate_id
    where s.manifest_id = v_manifest.id
      and c.extracted_payload->>'candidate_code' in (
        'prepositional_phrase.premodifier.allowed',
        'prepositional_phrase.premodifier.adjective_comparative_superlative',
        'prepositional_phrase.structure.order_core'
      )
  ) then
    raise exception
      'PP Wave A: deferred PP source leaked into executable manifest';
  end if;


  ----------------------------------------------------------------------
  -- 8. Compiled inactive grammar rule.
  ----------------------------------------------------------------------

  v_pattern :=
    jsonb_build_object(
      'bindings', v_bindings,
      'head_ref', 'head',
      'condition', v_condition,
      'phrase_type', 'PP',
      'manifest_code', v_manifest_code,
      'build_strategy',
        'head_plus_adjacent_right_dependent',
      'runtime_ir_version', '1.0',
      'allowed_right_dependents',
        jsonb_build_array('PP')
    );


  if public.validate_grammar_rule_pattern_v3(
       'phrase_pattern',
       v_pattern
     ) is distinct from true
  then
    raise exception
      'PP Wave A: canonical grammar pattern validation v3 failed';
  end if;


  v_result :=
    jsonb_build_object(
      'capabilities',
        jsonb_build_array(
          'recognize',
          'build',
          'relate',
          'explain'
        ),
      'manifest_code', v_manifest_code,
      'runtime_family', 'prepositional_phrase',
      'structural_wave', 'v1.43_pp_wave_a',
      'constraint_strength', 'default'
    );


  v_compile_hash :=
    encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'code', v_rule_code,
            'pattern_type', 'phrase_pattern',
            'rule_type', 'construction',
            'pattern', v_pattern,
            'actions', v_actions,
            'result', v_result,
            'triggers', '[]'::jsonb
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );


  if v_compile_hash is null
     or length(v_compile_hash) <> 64
  then
    raise exception
      'PP Wave A: failed to produce canonical SHA-256 compile hash';
  end if;


  v_description :=
    jsonb_build_object(
      'shadow', true,
      'compiler', v_compiler_version,
      'compiled_from_manifest', v_manifest_code,
      'compile_hash_basis',
        'sha256 jsonb: code+pattern_type+rule_type+pattern+actions+result+triggers'
    );


  if not exists (
    select 1
    from public.grammar_rules r
    where r.code = v_rule_code
  ) then

    insert into public.grammar_rules (
      code,
      category,
      subcategory,
      name_no,
      description,
      pattern,
      result,
      actions,
      explanations,
      priority,
      base_confidence,
      scope,
      rule_type,
      is_active,
      version,
      pattern_type,
      parser_actions,
      learning_explanation,
      diagnostics,
      examples,
      topic_id,
      runtime_manifest_id,
      compiler_version,
      compile_hash
    )
    values (
      v_rule_code,
      'prepositional_phrase',
      v_manifest_code,
      'Preposisjonsfrase med preposisjon som kjerne',
      v_description,
      v_pattern,
      v_result,
      v_actions,
      v_explanation,
      100,
      1.0,
      'phrase',
      'construction',

      -- Critical: compiled does not mean activated.
      false,

      1,
      'phrase_pattern',
      v_actions,
      v_explanation,
      jsonb_build_object(
        'policy', 'none'
      ),
      '[]'::jsonb,
      v_head.topic_id,
      v_manifest.id,
      v_compiler_version,
      v_compile_hash
    );

  end if;


  select r.*
  into strict v_rule
  from public.grammar_rules r
  where r.code = v_rule_code;


  ----------------------------------------------------------------------
  -- 9. Compiled rule drift guards.
  ----------------------------------------------------------------------

  if v_rule.runtime_manifest_id is distinct from v_manifest.id
     or v_rule.category <> 'prepositional_phrase'
     or v_rule.subcategory <> v_manifest_code
     or v_rule.scope <> 'phrase'
     or v_rule.rule_type <> 'construction'
     or v_rule.pattern_type <> 'phrase_pattern'
     or v_rule.version <> 1
     or v_rule.is_active is distinct from false
     or v_rule.compiler_version <> v_compiler_version
     or v_rule.compile_hash <> v_compile_hash
     or v_rule.pattern is distinct from v_pattern
     or v_rule.actions is distinct from v_actions
     or v_rule.parser_actions is distinct from v_actions
  then
    raise exception
      'PP Wave A: compiled grammar rule contract mismatch';
  end if;


  if v_rule.pattern->>'build_strategy'
       <> 'head_plus_adjacent_right_dependent'
     or v_rule.pattern->>'phrase_type' <> 'PP'
     or v_rule.pattern->'allowed_right_dependents'
          <> '["PP"]'::jsonb
     or v_rule.pattern ? 'allowed_left_dependents'
  then
    raise exception
      'PP Wave A: compiled PP pattern strategy mismatch';
  end if;


  ----------------------------------------------------------------------
  -- 10. Direct rule-source provenance.
  --
  -- Match existing AP/NP convention:
  -- direct rule source = primary head source only;
  -- structural support remains at manifest level.
  ----------------------------------------------------------------------

  if not exists (
    select 1
    from public.grammar_rule_sources s
    where s.grammar_rule_id = v_rule.id
      and s.source_id = v_head.source_id
      and s.source_section = v_head.source_section
      and s.source_pdf_page_from is not distinct from
          v_head.source_pdf_page_from
  ) then

    insert into public.grammar_rule_sources (
      grammar_rule_id,
      source_id,
      candidate_id,
      source_section,
      source_pdf_page_from,
      source_pdf_page_to,
      source_printed_page_from,
      source_printed_page_to,
      source_excerpt,
      verification_status,
      is_primary_source,
      verified_at,
      verified_by,
      notes
    )
    values (
      v_rule.id,
      v_head.source_id,
      v_head.id,
      v_head.source_section,
      v_head.source_pdf_page_from,
      v_head.source_pdf_page_to,
      v_head.source_printed_page_from,
      v_head.source_printed_page_to,
      v_head.source_excerpt,
      'source_verified',
      true,
      now(),
      v_validated_by,
      'PP Wave A direct primary source. Rule remains inactive.'
    );

  end if;


  select count(*)
  into v_rule_source_count
  from public.grammar_rule_sources s
  where s.grammar_rule_id = v_rule.id;

  if v_rule_source_count <> 1 then
    raise exception
      'PP Wave A: expected exactly 1 direct rule source, found %',
      v_rule_source_count;
  end if;


  if not exists (
    select 1
    from public.grammar_rule_sources s
    where s.grammar_rule_id = v_rule.id
      and s.candidate_id = v_head.id
      and s.source_id = v_head.source_id
      and s.source_section = v_head.source_section
      and s.verification_status = 'source_verified'
      and s.is_primary_source = true
  ) then
    raise exception
      'PP Wave A: direct primary rule source mismatch';
  end if;


  ----------------------------------------------------------------------
  -- 11. Operator validation.
  ----------------------------------------------------------------------

  v_validation_v2 :=
    public.validate_phrase_rule_operator_v2(v_rule.id);

  if coalesce(
       (v_validation_v2->>'valid')::boolean,
       false
     ) is distinct from true
  then
    raise exception
      'PP Wave A: v2 phrase operator validation failed: %',
      v_validation_v2;
  end if;


  if v_validation_v2->>'build_strategy'
       <> 'head_plus_adjacent_right_dependent'
     or v_validation_v2->>'phrase_type' <> 'PP'
     or coalesce(
          (v_validation_v2->>'registered_operator')::boolean,
          false
        ) is distinct from true
  then
    raise exception
      'PP Wave A: unexpected v2 validation result: %',
      v_validation_v2;
  end if;


  -- v1 must remain unable to validate this new build strategy.
  v_validation_v1 :=
    public.validate_phrase_rule_operator_v1(v_rule.id);

  if coalesce(
       (v_validation_v1->>'valid')::boolean,
       false
     ) = true
  then
    raise exception
      'PP Wave A: immutable v1 validator unexpectedly accepts PP strategy: %',
      v_validation_v1;
  end if;


  ----------------------------------------------------------------------
  -- 12. Final activation guard.
  ----------------------------------------------------------------------

  if exists (
    select 1
    from public.grammar_rules r
    where r.id = v_rule.id
      and r.is_active = true
  ) then
    raise exception
      'PP Wave A: compiled PP rule must remain inactive';
  end if;


  raise notice
    'PP Wave A compiled successfully: manifest=%, rule=%, is_active=false',
    v_manifest_code,
    v_rule_code;

end;
$migration$;
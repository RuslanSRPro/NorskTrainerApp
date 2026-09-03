// Norsk Trainer — Canonical Predicate Projection Adapter V1 (v1.44)
//
// Read-only interpretation of the frozen predicate snapshot.
//
// This adapter:
// - does NOT mutate Grammar Knowledge;
// - does NOT mutate manifests or grammar_rules;
// - does NOT activate the historical rule;
// - does NOT carry clause scope into v1.44;
// - derives the input phrase type, target binding and role from frozen data;
// - blocks instead of guessing when source/manifest/rule disagree.

export const CANONICAL_PREDICATE_PROJECTION_ADAPTER_V1 =
  'canonical_predicate_projection_adapter_v1';

export const CANONICAL_PREDICATE_PROJECTION_ADAPTER_VERSION_V1 =
  '1';

type Json = Record<string, unknown>;

export type CanonicalPredicateProjectionV1 = {
  projectionId: string;
  projectionCode: string;

  role: string;

  inputBindingRef: string;
  inputPhraseType: string;

  requireHead: boolean;

  graphOperation: string;

  runtimeFamily?: string;
  executionPhase?: string;
  constraintStrength?: string;

  sourceCandidateId: string;
  sourceCandidateCode: string;
  sourceSection?: string;

  manifestId: string;
  manifestCode: string;

  historicalRuleId: string;
  historicalRuleCode: string;

  sourcePredicateForm?: string;

  frozenGrammarReadOnly: true;
  historicalRuleInterpretationOnly: true;
};

export type CanonicalPredicateProjectionAdapterResultV1 = {
  adapter:
    typeof CANONICAL_PREDICATE_PROJECTION_ADAPTER_V1;

  adapterVersion:
    typeof CANONICAL_PREDICATE_PROJECTION_ADAPTER_VERSION_V1;

  status: 'ready' | 'blocked';

  projection?: CanonicalPredicateProjectionV1;

  blockingReasons: string[];

  governance: {
    frozenGrammarReadOnly: true;
    manifestReadOnly: true;
    historicalRuleReadOnly: true;
    historicalRuleActivated: false;
    clauseScopeConsumed: false;
    grammarRuleMaterialized: false;
  };
};

function asRecord(
  value: unknown,
): Json {
  return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ? value as Json
    : {};
}

function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const v = value.trim();

  return v || undefined;
}

function unique<T>(
  values: readonly T[],
): T[] {
  return [...new Set(values)];
}

function roleAction(
  value: unknown,
): {
  target: string;
  role: string;
} | undefined {
  const action =
    asRecord(value);

  if (
    stringValue(action.action) !==
      'set_role'
  ) {
    return undefined;
  }

  const target =
    stringValue(action.target);

  const role =
    stringValue(
      asRecord(action.value).role,
    );

  if (!target || !role) {
    return undefined;
  }

  return {
    target,
    role,
  };
}

export function buildCanonicalPredicateProjectionFromSnapshotV1(
  snapshot: unknown,
): CanonicalPredicateProjectionAdapterResultV1 {
  const adapter =
    CANONICAL_PREDICATE_PROJECTION_ADAPTER_V1;

  const adapterVersion =
    CANONICAL_PREDICATE_PROJECTION_ADAPTER_VERSION_V1;

  const root =
    asRecord(snapshot);

  const source =
    asRecord(root.source);

  const manifest =
    asRecord(
      root.manifest_projection ??
        root.manifestProjection,
    );

  const rule =
    asRecord(
      root.rule_projection ??
        root.ruleProjection,
    );

  const blockingReasons:
    string[] = [];

  // ------------------------------------------------------------------
  // Global snapshot safety
  // ------------------------------------------------------------------

  if (root.read_only !== true) {
    blockingReasons.push(
      'snapshot:not_read_only',
    );
  }

  if (root.write_performed !== false) {
    blockingReasons.push(
      'snapshot:write_performed_not_false',
    );
  }

  if (
    root.frozen_grammar_immutable !== true
  ) {
    blockingReasons.push(
      'snapshot:frozen_grammar_not_immutable',
    );
  }

  if (
    root.historical_rule_interpretation_only !== true
  ) {
    blockingReasons.push(
      'snapshot:historical_rule_not_interpretation_only',
    );
  }

  // ------------------------------------------------------------------
  // Frozen source
  // ------------------------------------------------------------------

  const sourceCandidateId =
    stringValue(
      source.candidate_id ??
        source.candidateId,
    );

  const sourceCandidateCode =
    stringValue(
      source.candidate_code ??
        source.candidateCode,
    );

  const sourceSection =
    stringValue(
      source.source_section ??
        source.sourceSection,
    );

  if (
    !sourceCandidateId ||
    !sourceCandidateCode
  ) {
    blockingReasons.push(
      'source:identity_missing',
    );
  }

  if (
    stringValue(source.status) !==
      'source_verified'
  ) {
    blockingReasons.push(
      'source:not_source_verified',
    );
  }

  if (
    source.requires_human_verification === true ||
    source.requiresHumanVerification === true
  ) {
    blockingReasons.push(
      'source:human_verification_required',
    );
  }

  const sourceContract =
    asRecord(
      source.execution_contract ??
        source.executionContract,
    );

  if (
    stringValue(
      asRecord(sourceContract.audit)
        .disposition,
    ) !==
      'KEEP_GRAMMAR_RUNTIME'
  ) {
    blockingReasons.push(
      'source:not_keep_grammar_runtime',
    );
  }

  if (
    stringValue(
      asRecord(sourceContract.execution)
        .role,
    ) !==
      'predicate_structure'
  ) {
    blockingReasons.push(
      'source:not_predicate_structure',
    );
  }

  const sourceDetails =
    asRecord(
      asRecord(
        source.extracted_payload ??
          source.extractedPayload,
      ).details,
    );

  const sourcePredicateForm =
    stringValue(
      sourceDetails.predicate_form ??
        sourceDetails.predicateForm,
    );

  if (!sourcePredicateForm) {
    blockingReasons.push(
      'source:predicate_form_missing',
    );
  }

  if (
    sourceDetails
      .predicate_is_syntactic_unit !== true &&
    sourceDetails
      .predicateIsSyntacticUnit !== true
  ) {
    blockingReasons.push(
      'source:predicate_syntactic_unit_not_proven',
    );
  }

  // ------------------------------------------------------------------
  // Manifest
  // ------------------------------------------------------------------

  const manifestId =
    stringValue(
      manifest.manifest_id ??
        manifest.manifestId,
    );

  const manifestCode =
    stringValue(
      manifest.manifest_code ??
        manifest.manifestCode,
    );

  if (!manifestId || !manifestCode) {
    blockingReasons.push(
      'manifest:identity_missing',
    );
  }

  if (
    stringValue(
      manifest.authoring_status ??
        manifest.authoringStatus,
    ) !==
      'validated'
  ) {
    blockingReasons.push(
      'manifest:not_validated',
    );
  }

  if (
    sourceCandidateCode &&
    stringValue(
      manifest.primary_candidate_code ??
        manifest.primaryCandidateCode,
    ) !==
      sourceCandidateCode
  ) {
    blockingReasons.push(
      'manifest:primary_source_mismatch',
    );
  }

  const manifestActions =
    Array.isArray(manifest.actions)
      ? manifest.actions
          .map(roleAction)
          .filter(
            (
              item,
            ): item is {
              target: string;
              role: string;
            } => Boolean(item),
          )
      : [];

  if (manifestActions.length !== 1) {
    blockingReasons.push(
      'manifest:set_role_action_not_unique',
    );
  }

  const manifestAction =
    manifestActions.length === 1
      ? manifestActions[0]
      : undefined;

  // ------------------------------------------------------------------
  // Historical inactive rule — interpretation only
  // ------------------------------------------------------------------

  const ruleId =
    stringValue(
      rule.rule_id ??
        rule.ruleId,
    );

  const ruleCode =
    stringValue(
      rule.rule_code ??
        rule.ruleCode,
    );

  if (!ruleId || !ruleCode) {
    blockingReasons.push(
      'rule:identity_missing',
    );
  }

  if (
    stringValue(
      rule.pattern_type ??
        rule.patternType,
    ) !==
      'graph_pattern'
  ) {
    blockingReasons.push(
      'rule:not_graph_pattern',
    );
  }

  if (rule.is_active !== false) {
    blockingReasons.push(
      'rule:historical_rule_not_inactive',
    );
  }

  const ruleManifestId =
    stringValue(
      rule.runtime_manifest_id ??
        rule.runtimeManifestId,
    );

  if (
    manifestId &&
    ruleManifestId !== manifestId
  ) {
    blockingReasons.push(
      'rule:manifest_identity_mismatch',
    );
  }

  const pattern =
    asRecord(rule.pattern);

  const graphOperation =
    stringValue(
      pattern.graph_operation ??
        pattern.graphOperation,
    );

  if (graphOperation !== 'assign_role') {
    blockingReasons.push(
      'rule:graph_operation_not_assign_role',
    );
  }

  const role =
    stringValue(pattern.role);

  const targetRef =
    stringValue(
      pattern.target_ref ??
        pattern.targetRef,
    );

  if (!role) {
    blockingReasons.push(
      'rule:role_missing',
    );
  }

  if (!targetRef) {
    blockingReasons.push(
      'rule:target_ref_missing',
    );
  }

  const bindings =
    asRecord(pattern.bindings);

  const targetBinding =
    targetRef
      ? asRecord(bindings[targetRef])
      : {};

  if (
    stringValue(
      targetBinding.entity,
    ) !==
      'phrase'
  ) {
    blockingReasons.push(
      'rule:target_binding_not_phrase',
    );
  }

  const where =
    asRecord(targetBinding.where);

  if (
    stringValue(where.op) !==
      'eq'
  ) {
    blockingReasons.push(
      'rule:phrase_type_binding_not_eq',
    );
  }

  const leftRef =
    stringValue(
      asRecord(where.left).ref,
    );

  if (
    targetRef &&
    leftRef !== `${targetRef}.type`
  ) {
    blockingReasons.push(
      'rule:phrase_type_left_ref_mismatch',
    );
  }

  const inputPhraseType =
    stringValue(where.right);

  if (!inputPhraseType) {
    blockingReasons.push(
      'rule:input_phrase_type_missing',
    );
  }

  const condition =
    asRecord(pattern.condition);

  const conditionRef =
    stringValue(
      asRecord(condition.left).ref,
    );

  const requireHead =
    stringValue(condition.op) ===
      'exists' &&
    Boolean(targetRef) &&
    conditionRef ===
      `${targetRef}.head`;

  if (!requireHead) {
    blockingReasons.push(
      'rule:canonical_head_requirement_missing',
    );
  }

  const ruleActions =
    Array.isArray(rule.actions)
      ? rule.actions
          .map(roleAction)
          .filter(
            (
              item,
            ): item is {
              target: string;
              role: string;
            } => Boolean(item),
          )
      : [];

  if (ruleActions.length !== 1) {
    blockingReasons.push(
      'rule:set_role_action_not_unique',
    );
  }

  const ruleAction =
    ruleActions.length === 1
      ? ruleActions[0]
      : undefined;

  // ------------------------------------------------------------------
  // Cross-artifact semantic agreement
  // ------------------------------------------------------------------

  if (
    manifestAction &&
    ruleAction
  ) {
    if (
      manifestAction.target !==
        ruleAction.target
    ) {
      blockingReasons.push(
        'projection:manifest_rule_target_disagreement',
      );
    }

    if (
      manifestAction.role !==
        ruleAction.role
    ) {
      blockingReasons.push(
        'projection:manifest_rule_role_disagreement',
      );
    }
  }

  if (
    manifestAction &&
    targetRef &&
    manifestAction.target !== targetRef
  ) {
    blockingReasons.push(
      'projection:manifest_pattern_target_disagreement',
    );
  }

  if (
    manifestAction &&
    role &&
    manifestAction.role !== role
  ) {
    blockingReasons.push(
      'projection:manifest_pattern_role_disagreement',
    );
  }

  // ------------------------------------------------------------------
  // Fail closed
  // ------------------------------------------------------------------

  if (
    blockingReasons.length > 0 ||
    !sourceCandidateId ||
    !sourceCandidateCode ||
    !manifestId ||
    !manifestCode ||
    !ruleId ||
    !ruleCode ||
    !graphOperation ||
    !role ||
    !targetRef ||
    !inputPhraseType
  ) {
    return {
      adapter,
      adapterVersion,

      status:
        'blocked',

      blockingReasons:
        unique(blockingReasons).sort(),

      governance: {
        frozenGrammarReadOnly:
          true,

        manifestReadOnly:
          true,

        historicalRuleReadOnly:
          true,

        historicalRuleActivated:
          false,

        clauseScopeConsumed:
          false,

        grammarRuleMaterialized:
          false,
      },
    };
  }

  const projection:
    CanonicalPredicateProjectionV1 = {

    projectionId:
      `projection:${ruleId}`,

    projectionCode:
      `projection:${ruleCode}`,

    role,

    inputBindingRef:
      targetRef,

    inputPhraseType,

    requireHead:
      true,

    graphOperation,

    runtimeFamily:
      stringValue(
        manifest.runtime_family ??
          manifest.runtimeFamily,
      ),

    executionPhase:
      stringValue(
        manifest.execution_phase ??
          manifest.executionPhase,
      ),

    constraintStrength:
      stringValue(
        manifest.constraint_strength ??
          manifest.constraintStrength,
      ),

    sourceCandidateId,
    sourceCandidateCode,
    sourceSection,

    manifestId,
    manifestCode,

    historicalRuleId:
      ruleId,

    historicalRuleCode:
      ruleCode,

    sourcePredicateForm,

    frozenGrammarReadOnly:
      true,

    historicalRuleInterpretationOnly:
      true,
  };

  return {
    adapter,
    adapterVersion,

    status:
      'ready',

    projection,

    blockingReasons:
      [],

    governance: {
      frozenGrammarReadOnly:
        true,

      manifestReadOnly:
        true,

      historicalRuleReadOnly:
        true,

      historicalRuleActivated:
        false,

      clauseScopeConsumed:
        false,

      grammarRuleMaterialized:
        false,
    },
  };
}
import {
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
  type CanonicalRuntimeTokenPosEqConditionComparisonEvidenceStateV2,
  type CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
} from "./canonical-runtime-token-pos-eq-condition-truth-semantic-capability-v2.ts";

import {
  type CanonicalRuntimeTokenPosConditionTruthCompositionResultV2,
  deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2,
} from "./canonical-runtime-token-pos-condition-truth-composition-v2.ts";

import type {
  CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

/**
 * v1.46 fail-closed robustness extension.
 *
 * This wrapper does NOT change the closed V2 truth semantics.
 * It validates the C2 comparison-state vocabulary before delegating
 * to the immutable V2 composition contract.
 *
 * No compound WHERE semantics are executed here.
 */
export const CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3 =
  "canonical-runtime-token-pos-condition-truth-composition-v3" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3 =
  "3" as const;

export type CanonicalRuntimeTokenPosConditionTruthCompositionResultV3 = {
  producer: typeof CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3;

  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3;

  status:
    | "ready"
    | "blocked";

  evidence:
    CanonicalRuntimeTokenPosConditionTruthCompositionResultV2["evidence"];

  sourceV2Result:
    | CanonicalRuntimeTokenPosConditionTruthCompositionResultV2
    | null;

  blockingReasons: string[];

  governance: {
    exactD2b0ComparisonStateDomainConsumed: true;

    comparisonStateMembershipValidatedBeforeV2Delegation: true;

    missingComparisonStateBlocksFailClosed: true;

    unknownComparisonStateBlocksFailClosed: true;

    validComparisonStateDelegatesToImmutableV2: true;

    v2TruthSemanticsReimplemented: false;

    v2ContractMutated: false;

    compoundWhereTruthResolved: false;

    compoundBooleanCompositionExecuted: false;

    manifestConditionTruthResolved: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    learnerErrorClassified: false;

    graphMutationPerformed: false;

    frozenGrammarReadOnly: true;
  };
};

const GOVERNANCE = {
  exactD2b0ComparisonStateDomainConsumed: true,

  comparisonStateMembershipValidatedBeforeV2Delegation: true,

  missingComparisonStateBlocksFailClosed: true,

  unknownComparisonStateBlocksFailClosed: true,

  validComparisonStateDelegatesToImmutableV2: true,

  v2TruthSemanticsReimplemented: false,

  v2ContractMutated: false,

  compoundWhereTruthResolved: false,

  compoundBooleanCompositionExecuted: false,

  manifestConditionTruthResolved: false,

  cardinalitySemanticsResolved: false,

  cardinalityEnforcementPerformed: false,

  learnerErrorClassified: false,

  graphMutationPerformed: false,

  frozenGrammarReadOnly: true,
} as const;

function comparisonStateFromReadyD2a(
  result: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
): unknown {
  if (
    result.status !==
      "ready" ||
    !result.evidence
  ) {
    return undefined;
  }

  const evidence = result.evidence as unknown as {
    c2ComparisonEvidence?: {
      comparisonState?: unknown;
    };
  };

  return evidence
    .c2ComparisonEvidence
    ?.comparisonState;
}

function isExactD2b0ComparisonState(
  value: unknown,
): value is CanonicalRuntimeTokenPosEqConditionComparisonEvidenceStateV2 {
  if (
    typeof value !==
      "string"
  ) {
    return false;
  }

  return (
    CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2
      .comparisonEvidenceStateDomain as readonly string[]
  ).includes(
    value,
  );
}

function blockedResult(
  reason: string,
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV3 {
  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,

    status: "blocked",

    evidence: undefined,
    sourceV2Result: null,

    blockingReasons: [
      reason,
    ],

    governance: GOVERNANCE,
  };
}

function delegatedResult(
  source: CanonicalRuntimeTokenPosConditionTruthCompositionResultV2,
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV3 {
  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,

    status: source.status,

    evidence: source.evidence,

    sourceV2Result: source,

    blockingReasons: [
      ...source.blockingReasons,
    ],

    governance: GOVERNANCE,
  };
}

export function deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
  d2aResult:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  truthSemanticCapability:
    CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV3 {
  if (
    d2aResult.status ===
      "ready" &&
    d2aResult.evidence
  ) {
    const comparisonState = comparisonStateFromReadyD2a(
      d2aResult,
    );

    if (
      comparisonState ===
        undefined ||
      comparisonState ===
        null
    ) {
      return blockedResult(
        "c2_comparison_state:missing",
      );
    }

    if (
      !isExactD2b0ComparisonState(
        comparisonState,
      )
    ) {
      return blockedResult(
        "c2_comparison_state:not_in_exact_d2b0_domain",
      );
    }
  }

  const sourceV2Result =
    deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      d2aResult,
      truthSemanticCapability,
    );

  return delegatedResult(
    sourceV2Result,
  );
}

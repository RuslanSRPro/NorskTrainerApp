// Norsk Trainer — Runtime Token POS Leaf-Root Candidate Disposition V1
//
// v1.46 A3.3.5b-L
//
// Exact composition:
//
//   A3.3.0 exact Runtime WHERE shape authority
//       +
//   A3.3.4a exact normalized token.pos equality site authority
//       +
//   A3.3.4c exact domain-bound per-occurrence normalized comparison
//       ->
//   candidate disposition ONLY when the WHOLE WHERE root is leaf_operator.
//
// This is intentionally NOT generic compound-WHERE execution.
//
// Critical rule:
//
//   root = leaf_operator
//       -> leaf boolean truth is whole-WHERE truth for that occurrence.
//
//   root = compound_array_group
//       -> BLOCKED FOR THIS CAPABILITY.
//          No flattening.
//          No all/any interpretation.
//          No independent-child filtering.
//
// Disposition policy:
//
//   explicit_resolved_match
//       -> satisfied
//
//   explicit_resolved_non_match
//       -> rejected
//
//   open_match_possible
//   open_no_surviving_match
//   explicit_resolved_mixed
//       -> uncertain
//
//   no_fact
//       -> unavailable
//
//   blocked
//       -> blocked
//
// Rejection is authorized ONLY by exact resolved boolean false.
//
// This layer does NOT:
// - mutate canonical graph status;
// - discard occurrences;
// - execute compound WHERE;
// - interpret all / any / not;
// - enforce Runtime cardinality;
// - choose an occurrence winner;
// - perform final Runtime occurrence binding;
// - classify learner error;
// - create clause/dependency structure.

import {
  CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
} from "./canonical-runtime-binding-where-shape-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_DOMAIN_BOUND_NORMALIZED_COMPARISON_V1,
  type CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonResultV1,
  type CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonV1,
  type CanonicalRuntimeTokenPosNormalizedComparisonStateV1,
  type CanonicalRuntimeTokenPosOccurrenceNormalizedComparisonV1,
} from "./canonical-runtime-token-pos-domain-bound-normalized-comparison-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1 =
  "canonical_runtime_token_pos_leaf_root_candidate_disposition_v1";

export type CanonicalRuntimeLeafRootCandidateDispositionV1 =
  | "satisfied"
  | "rejected"
  | "uncertain"
  | "unavailable"
  | "blocked";

export type CanonicalRuntimeTokenPosLeafRootOccurrenceDispositionV1 = {
  id: string;

  status: "proven";

  comparisonId: string;

  occurrenceComparisonId: string;

  expectedSiteAuthorityId: string;

  whereShapeAuthorityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  sentenceIndex: number;

  tokenNodeId: string;

  sentenceTokenIndex: number;

  comparisonState: CanonicalRuntimeTokenPosNormalizedComparisonStateV1;

  booleanTruth: boolean | null;

  booleanTruthResolved: boolean;

  disposition: CanonicalRuntimeLeafRootCandidateDispositionV1;

  satisfactionProven: boolean;

  rejectionAuthorized: boolean;

  governance: {
    exactLeafRootRequired: true;

    exactA330WhereShapeAuthorityRequired: true;

    exactA334aExpectedSiteAuthorityRequired: true;

    exactA334cOccurrenceComparisonRequired: true;

    compoundSemanticsResolved: false;

    compoundCompositionPerformed: false;

    compoundGroupFlattened: false;

    graphStatusMutated: false;

    occurrenceDiscarded: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    learnerErrorClassified: false;
  };
};

export type CanonicalRuntimeTokenPosLeafRootComparisonDispositionV1 = {
  id: string;

  status: "candidate";

  comparisonId: string;

  expectedSiteAuthorityId: string;

  whereShapeAuthorityId: string;

  rootShape: "leaf_operator";

  rootPath: string;

  structuralOperatorLabel: string;

  occurrenceDispositions:
    CanonicalRuntimeTokenPosLeafRootOccurrenceDispositionV1[];

  occurrenceCount: number;
};

export type CanonicalRuntimeTokenPosLeafRootCandidateDispositionResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1;

  producerVersion: "1";

  status:
    | "ready"
    | "blocked";

  graphDocumentId: string | null;

  comparisons: CanonicalRuntimeTokenPosLeafRootComparisonDispositionV1[];

  consideredComparisonCount: number;

  exactLeafRootComparisonCount: number;

  dispositionCount: number;

  blockedNonLeafRootComparisonIds: string[];

  blockedCompoundRootComparisonIds: string[];

  blockingReasons: string[];

  governance: {
    exactIdentityOnly: true;

    leafRootOnly: true;

    rejectionRequiresProvenFalse: true;

    unknownNeverCollapsedToFalse: true;

    compoundSemanticsResolved: false;

    compoundCompositionPerformed: false;

    compoundGroupFlattened: false;

    whereFilteringPerformed: false;

    graphMutationPerformed: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    learnerErrorClassified: false;
  };
};

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value) =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  ].sort();
}

function blockedResult(
  reasons: readonly string[],
  graphDocumentId: string | null = null,
  consideredComparisonCount = 0,
  blockedNonLeafRootComparisonIds: readonly string[] = [],
  blockedCompoundRootComparisonIds: readonly string[] = [],
): CanonicalRuntimeTokenPosLeafRootCandidateDispositionResultV1 {
  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1,

    producerVersion: "1",

    status: "blocked",

    graphDocumentId,

    comparisons: [],

    consideredComparisonCount,

    exactLeafRootComparisonCount: 0,

    dispositionCount: 0,

    blockedNonLeafRootComparisonIds: uniqueSorted(
      blockedNonLeafRootComparisonIds,
    ),

    blockedCompoundRootComparisonIds: uniqueSorted(
      blockedCompoundRootComparisonIds,
    ),

    blockingReasons: uniqueSorted(
      reasons,
    ),

    governance: {
      exactIdentityOnly: true,

      leafRootOnly: true,

      rejectionRequiresProvenFalse: true,

      unknownNeverCollapsedToFalse: true,

      compoundSemanticsResolved: false,

      compoundCompositionPerformed: false,

      compoundGroupFlattened: false,

      whereFilteringPerformed: false,

      graphMutationPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      learnerErrorClassified: false,
    },
  };
}

function occurrenceTruthContractSafe(
  occurrence: CanonicalRuntimeTokenPosOccurrenceNormalizedComparisonV1,
): boolean {
  switch (
    occurrence.comparisonState
  ) {
    case "explicit_resolved_match":
      return (
        occurrence.booleanTruthResolved ===
          true &&
        occurrence.booleanTruth ===
          true
      );

    case "explicit_resolved_non_match":
      return (
        occurrence.booleanTruthResolved ===
          true &&
        occurrence.booleanTruth ===
          false
      );

    case "no_fact":
    case "blocked":
    case "open_match_possible":
    case "open_no_surviving_match":
    case "explicit_resolved_mixed":
      return (
        occurrence.booleanTruthResolved ===
          false &&
        occurrence.booleanTruth ===
          null
      );
  }
}

function dispositionFor(
  occurrence: CanonicalRuntimeTokenPosOccurrenceNormalizedComparisonV1,
): CanonicalRuntimeLeafRootCandidateDispositionV1 {
  switch (
    occurrence.comparisonState
  ) {
    case "explicit_resolved_match":
      return "satisfied";

    case "explicit_resolved_non_match":
      return "rejected";

    case "open_match_possible":
    case "open_no_surviving_match":
    case "explicit_resolved_mixed":
      return "uncertain";

    case "no_fact":
      return "unavailable";

    case "blocked":
      return "blocked";
  }
}

function sameExpectedProjection(
  expected: CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
  comparison: CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonV1,
): boolean {
  return (
    comparison.expectedSiteAuthorityId ===
      expected.id &&
    comparison.semanticAuthorityId ===
      expected.semanticAuthorityId &&
    comparison.stringOperandCompatibilityId ===
      expected.stringOperandCompatibilityId &&
    comparison.whereReferenceRootAuthorityId ===
      expected.whereReferenceRootAuthorityId &&
    comparison.whereShapeAuthorityId ===
      expected.whereShapeAuthorityId &&
    comparison.ownerBindingDefinitionAuthorityId ===
      expected.ownerBindingDefinitionAuthorityId &&
    comparison.referencedBindingDefinitionAuthorityId ===
      expected.referencedBindingDefinitionAuthorityId &&
    comparison.manifestId ===
      expected.manifestId &&
    comparison.manifestCode ===
      expected.manifestCode &&
    comparison.ownerBindingName ===
      expected.ownerBindingName &&
    comparison.referencedBindingName ===
      expected.referencedBindingName &&
    comparison.referenceSiteKey ===
      expected.referenceSiteKey &&
    comparison.referencePath ===
      expected.referencePath &&
    comparison.expectedNormalizedPosLabel ===
      expected.normalizedPosLabelInput
  );
}

export function deriveCanonicalRuntimeTokenPosLeafRootCandidateDispositionsV1(
  whereShapeResult: CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
  expectedResult: CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  comparisonResult:
    CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonResultV1,
): CanonicalRuntimeTokenPosLeafRootCandidateDispositionResultV1 {
  const blockingReasons: string[] = [];

  if (
    whereShapeResult.producer !==
      CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1 ||
    whereShapeResult.producerVersion !==
      "1" ||
    whereShapeResult.status !==
      "ready"
  ) {
    blockingReasons.push(
      "where_shape_result_not_exact_ready_a330",
    );
  }

  if (
    expectedResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1 ||
    expectedResult.producerVersion !==
      "1" ||
    expectedResult.status !==
      "ready"
  ) {
    blockingReasons.push(
      "expected_result_not_exact_ready_a334a",
    );
  }

  if (
    comparisonResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_DOMAIN_BOUND_NORMALIZED_COMPARISON_V1 ||
    comparisonResult.producerVersion !==
      "1" ||
    comparisonResult.status !==
      "ready"
  ) {
    blockingReasons.push(
      "comparison_result_not_exact_ready_a334c",
    );
  }

  if (
    comparisonResult.graphDocumentId ===
      null
  ) {
    blockingReasons.push(
      "comparison_result_missing_graph_document_id",
    );
  }

  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
      comparisonResult.graphDocumentId,
      comparisonResult.comparisons.length,
    );
  }

  const graphDocumentId = comparisonResult.graphDocumentId as string;

  const shapeById = new Map(
    whereShapeResult.authorities.map(
      (authority) =>
        [
          authority.id,
          authority,
        ] as const,
    ),
  );

  if (
    shapeById.size !==
      whereShapeResult.authorities.length
  ) {
    blockingReasons.push(
      "duplicate_where_shape_authority_id",
    );
  }

  const expectedById = new Map(
    expectedResult.authorities.map(
      (authority) =>
        [
          authority.id,
          authority,
        ] as const,
    ),
  );

  if (
    expectedById.size !==
      expectedResult.authorities.length
  ) {
    blockingReasons.push(
      "duplicate_expected_site_authority_id",
    );
  }

  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
      graphDocumentId,
      comparisonResult.comparisons.length,
    );
  }

  const outputComparisons:
    CanonicalRuntimeTokenPosLeafRootComparisonDispositionV1[] = [];

  const blockedNonLeafRootComparisonIds: string[] = [];

  const blockedCompoundRootComparisonIds: string[] = [];

  for (
    const comparison of [...comparisonResult.comparisons].sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    )
  ) {
    const expected = expectedById.get(
      comparison.expectedSiteAuthorityId,
    );

    if (
      !expected
    ) {
      blockingReasons.push(
        `${comparison.id}:missing_exact_expected_site_authority`,
      );

      continue;
    }

    if (
      !sameExpectedProjection(
        expected,
        comparison,
      )
    ) {
      blockingReasons.push(
        `${comparison.id}:expected_projection_identity_mismatch`,
      );

      continue;
    }

    const whereShape = shapeById.get(
      comparison.whereShapeAuthorityId,
    );

    if (
      !whereShape
    ) {
      blockingReasons.push(
        `${comparison.id}:missing_exact_where_shape_authority`,
      );

      continue;
    }

    if (
      whereShape.bindingDefinitionAuthorityId !==
        expected.ownerBindingDefinitionAuthorityId ||
      whereShape.manifestId !==
        expected.manifestId ||
      whereShape.bindingName !==
        expected.ownerBindingName
    ) {
      blockingReasons.push(
        `${comparison.id}:where_shape_owner_identity_mismatch`,
      );

      continue;
    }

    if (
      whereShape.root.shape !==
        "leaf_operator"
    ) {
      blockedNonLeafRootComparisonIds.push(
        comparison.id,
      );

      if (
        whereShape.root.shape ===
          "compound_array_group"
      ) {
        blockedCompoundRootComparisonIds.push(
          comparison.id,
        );
      }

      continue;
    }

    if (
      whereShape.root.path !==
        "$"
    ) {
      blockingReasons.push(
        `${comparison.id}:leaf_shape_is_not_where_root`,
      );

      continue;
    }

    const occurrenceDispositions:
      CanonicalRuntimeTokenPosLeafRootOccurrenceDispositionV1[] = [];

    for (
      const occurrence of [...comparison.occurrenceComparisons].sort(
        (a, b) =>
          a.sentenceTokenIndex -
            b.sentenceTokenIndex ||
          a.tokenNodeId.localeCompare(
            b.tokenNodeId,
          ),
      )
    ) {
      if (
        !occurrenceTruthContractSafe(
          occurrence,
        )
      ) {
        blockingReasons.push(
          `${comparison.id}:${occurrence.comparisonId}:unsafe_a334c_boolean_contract`,
        );

        continue;
      }

      const disposition = dispositionFor(
        occurrence,
      );

      occurrenceDispositions.push({
        id: [
          "runtime-token-pos-leaf-root-candidate-disposition-v1",
          occurrence.comparisonId,
        ].join(":"),

        status: "proven",

        comparisonId: comparison.id,

        occurrenceComparisonId: occurrence.comparisonId,

        expectedSiteAuthorityId: comparison.expectedSiteAuthorityId,

        whereShapeAuthorityId: comparison.whereShapeAuthorityId,

        graphDocumentId: occurrence.graphDocumentId,

        sentenceNodeId: occurrence.sentenceNodeId,

        sentenceIndex: occurrence.sentenceIndex,

        tokenNodeId: occurrence.tokenNodeId,

        sentenceTokenIndex: occurrence.sentenceTokenIndex,

        comparisonState: occurrence.comparisonState,

        booleanTruth: occurrence.booleanTruth,

        booleanTruthResolved: occurrence.booleanTruthResolved,

        disposition,

        satisfactionProven: disposition ===
          "satisfied",

        rejectionAuthorized: disposition ===
            "rejected" &&
          occurrence.booleanTruthResolved ===
            true &&
          occurrence.booleanTruth ===
            false,

        governance: {
          exactLeafRootRequired: true,

          exactA330WhereShapeAuthorityRequired: true,

          exactA334aExpectedSiteAuthorityRequired: true,

          exactA334cOccurrenceComparisonRequired: true,

          compoundSemanticsResolved: false,

          compoundCompositionPerformed: false,

          compoundGroupFlattened: false,

          graphStatusMutated: false,

          occurrenceDiscarded: false,

          cardinalitySemanticsResolved: false,

          cardinalityEnforcementPerformed: false,

          occurrenceWinnerSelected: false,

          finalRuntimeOccurrenceBindingPerformed: false,

          learnerErrorClassified: false,
        },
      });
    }

    outputComparisons.push({
      id: [
        "runtime-token-pos-leaf-root-comparison-disposition-v1",
        comparison.id,
      ].join(":"),

      status: "candidate",

      comparisonId: comparison.id,

      expectedSiteAuthorityId: comparison.expectedSiteAuthorityId,

      whereShapeAuthorityId: comparison.whereShapeAuthorityId,

      rootShape: "leaf_operator",

      rootPath: whereShape.root.path,

      structuralOperatorLabel: whereShape.root.operatorLabel,

      occurrenceDispositions,

      occurrenceCount: occurrenceDispositions.length,
    });
  }

  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
      graphDocumentId,
      comparisonResult.comparisons.length,
      blockedNonLeafRootComparisonIds,
      blockedCompoundRootComparisonIds,
    );
  }

  const dispositionCount = outputComparisons.reduce(
    (
      total,
      comparison,
    ) =>
      total +
      comparison.occurrenceCount,
    0,
  );

  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1,

    producerVersion: "1",

    status: "ready",

    graphDocumentId,

    comparisons: outputComparisons,

    consideredComparisonCount: comparisonResult.comparisons.length,

    exactLeafRootComparisonCount: outputComparisons.length,

    dispositionCount,

    blockedNonLeafRootComparisonIds: uniqueSorted(
      blockedNonLeafRootComparisonIds,
    ),

    blockedCompoundRootComparisonIds: uniqueSorted(
      blockedCompoundRootComparisonIds,
    ),

    blockingReasons: [],

    governance: {
      exactIdentityOnly: true,

      leafRootOnly: true,

      rejectionRequiresProvenFalse: true,

      unknownNeverCollapsedToFalse: true,

      compoundSemanticsResolved: false,

      compoundCompositionPerformed: false,

      compoundGroupFlattened: false,

      whereFilteringPerformed: false,

      graphMutationPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      learnerErrorClassified: false,
    },
  };
}

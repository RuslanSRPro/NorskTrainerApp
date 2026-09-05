import {
  CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
} from "./canonical-runtime-binding-where-shape-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_DOMAIN_BOUND_NORMALIZED_COMPARISON_V1,
  type CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonResultV1,
  type CanonicalRuntimeTokenPosNormalizedComparisonStateV1,
} from "./canonical-runtime-token-pos-domain-bound-normalized-comparison-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1,
  deriveCanonicalRuntimeTokenPosLeafRootCandidateDispositionsV1,
} from "./canonical-runtime-token-pos-leaf-root-candidate-disposition-v1.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type RootKind =
  | "leaf_operator"
  | "compound_array_group";

function expectedTruth(
  state: CanonicalRuntimeTokenPosNormalizedComparisonStateV1,
): {
  booleanTruth: boolean | null;
  booleanTruthResolved: boolean;
} {
  switch (state) {
    case "explicit_resolved_match":
      return {
        booleanTruth: true,

        booleanTruthResolved: true,
      };

    case "explicit_resolved_non_match":
      return {
        booleanTruth: false,

        booleanTruthResolved: true,
      };

    default:
      return {
        booleanTruth: null,

        booleanTruthResolved: false,
      };
  }
}

function fixture(
  state: CanonicalRuntimeTokenPosNormalizedComparisonStateV1,
  options: {
    rootKind?: RootKind;

    corruptManifestCode?: boolean;

    corruptBooleanTruth?: boolean;
  } = {},
) {
  const rootKind = options.rootKind ??
    "leaf_operator";

  const truth = expectedTruth(
    state,
  );

  const whereShapeResult = {
    producer: CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,

    producerVersion: "1",

    status: "ready",

    authorities: [
      {
        id: "shape:subject",

        status: "candidate",

        bindingDefinitionAuthorityId: "binding:subject",

        manifestId: "manifest:1",

        manifestCode: "manifest-code:1",

        bindingName: "subject",

        root: rootKind ===
            "leaf_operator"
          ? {
            shape: "leaf_operator",

            path: "$",

            operatorLabel: "eq",

            leftReferenceExpression: "token.pos",

            leftOperand: {
              ref: "token.pos",
            },

            hasRightOperand: true,

            rightOperand: "NOUN",

            rawSnapshot: {
              eq: [
                "token.pos",
                "NOUN",
              ],
            },
          }
          : {
            shape: "compound_array_group",

            path: "$",

            compoundKey: "all",

            children: [],

            rawSnapshot: {
              all: [],
            },
          },

        unclassifiedPaths: [],

        governance: {},
      },
    ],

    blockingReasons: [],
  } as unknown as CanonicalRuntimeBindingWhereShapeAuthorityResultV1;

  const expectedResult = {
    producer: CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

    producerVersion: "1",

    status: "ready",

    authorities: [
      {
        id: "expected:site:1",

        status: "candidate",

        semanticAuthorityId:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

        stringOperandCompatibilityId: "string-op:1",

        whereReferenceRootAuthorityId: "reference-root:1",

        whereShapeAuthorityId: "shape:subject",

        ownerBindingDefinitionAuthorityId: "binding:subject",

        referencedBindingDefinitionAuthorityId: "binding:token",

        manifestId: "manifest:1",

        manifestCode: "manifest-code:1",

        ownerBindingName: "subject",

        referencedBindingName: "token",

        referenceSiteKey: "site:token.pos:1",

        referencePath: "$",

        referenceExpression: "token.pos",

        runtimeSuffix: ".pos",

        canonicalNodeType: "token",

        canonicalPropertyDomain: "canonical_token_occurrence",

        canonicalPropertyKind: "pos_hypothesis_set",

        rawPosLabelInput: "NOUN",

        normalizedPosLabelInput: "noun",

        normalizationContract: {
          trimWhitespace: true,

          unicodeNormalization: "NFC",

          localeCaseTransform: "toLocaleLowerCase",

          locale: "nb-NO",

          equalityAfterNormalization: "exact_string_equality",
        },

        governance: {},
      },
    ],

    consideredTokenPosStringOperandCount: 1,

    unsupportedOperatorSiteIds: [],

    blockingReasons: [],
  } as unknown as CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1;

  const comparisonResult = {
    producer: CANONICAL_RUNTIME_TOKEN_POS_DOMAIN_BOUND_NORMALIZED_COMPARISON_V1,

    producerVersion: "1",

    status: "ready",

    graphDocumentId: "graph:1",

    comparisons: [
      {
        id: "comparison:1",

        status: "candidate",

        expectedSiteAuthorityId: "expected:site:1",

        semanticAuthorityId:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

        stringOperandCompatibilityId: "string-op:1",

        whereReferenceRootAuthorityId: "reference-root:1",

        whereShapeAuthorityId: "shape:subject",

        ownerBindingDefinitionAuthorityId: "binding:subject",

        referencedBindingDefinitionAuthorityId: "binding:token",

        manifestId: "manifest:1",

        manifestCode: options.corruptManifestCode
          ? "manifest-code:CORRUPT"
          : "manifest-code:1",

        ownerBindingName: "subject",

        referencedBindingName: "token",

        referenceSiteKey: "site:token.pos:1",

        referencePath: "$",

        domainCandidateId: "domain:1",

        bindingDefinitionAuthorityId: "binding:token",

        graphVersion: "1",

        graphDocumentId: "graph:1",

        sentenceNodeId: "sentence:1",

        sentenceIndex: 0,

        expectedNormalizedPosLabel: "noun",

        occurrenceComparisons: [
          {
            comparisonId: "occurrence-comparison:1",

            status: "proven",

            graphDocumentId: "graph:1",

            sentenceNodeId: "sentence:1",

            sentenceIndex: 0,

            tokenNodeId: "token:1",

            tokenGraphStatus: "candidate",

            containmentEdgeId: "edge:contains:1",

            sentenceTokenIndex: 0,

            graphBoundProjectionId: "projection:1",

            sourceReadId: "source-read:1",

            normalizedProjectionId: "normalized-projection:1",

            readState: "explicit_resolved",

            alternativeSetId: "alt:1",

            alternativeSetStatus: "resolved",

            resolvedMemberIds: ["pos:1"],

            rawResolvedPosLabels: ["NOUN"],

            normalizedResolvedPosLabels: ["noun"],

            expectedNormalizedPosLabel: "noun",

            memberComparisons: [],

            matchingSurvivingMemberIds: [],

            matchingResolvedMemberIds: [],

            comparisonState: state,

            booleanTruth: options.corruptBooleanTruth
              ? (
                truth.booleanTruth ===
                    true
                  ? false
                  : true
              )
              : truth.booleanTruth,

            booleanTruthResolved: truth.booleanTruthResolved,
          },
        ],

        occurrenceCount: 1,

        governance: {},
      },
    ],

    consideredExpectedSiteCount: 1,

    consideredDomainCandidateCount: 1,

    unmappedExpectedSiteIds: [],

    blockingReasons: [],
  } as unknown as CanonicalRuntimeTokenPosDomainBoundNormalizedComparisonResultV1;

  return {
    whereShapeResult,
    expectedResult,
    comparisonResult,
  };
}

function evaluate(
  state: CanonicalRuntimeTokenPosNormalizedComparisonStateV1,
  options: Parameters<
    typeof fixture
  >[1] = {},
) {
  const {
    whereShapeResult,
    expectedResult,
    comparisonResult,
  } = fixture(
    state,
    options,
  );

  return deriveCanonicalRuntimeTokenPosLeafRootCandidateDispositionsV1(
    whereShapeResult,
    expectedResult,
    comparisonResult,
  );
}

Deno.test(
  "v1.46 A3.3.5b-L: exact resolved match becomes satisfied",
  () => {
    const result = evaluate(
      "explicit_resolved_match",
    );

    const occurrence = result.comparisons[0]
      ?.occurrenceDispositions[0];

    assert(
      result.producer ===
          CANONICAL_RUNTIME_TOKEN_POS_LEAF_ROOT_CANDIDATE_DISPOSITION_V1 &&
        result.status ===
          "ready" &&
        occurrence?.disposition ===
          "satisfied" &&
        occurrence.satisfactionProven ===
          true &&
        occurrence.rejectionAuthorized ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: exact resolved non-match is the only rejectable false case",
  () => {
    const result = evaluate(
      "explicit_resolved_non_match",
    );

    const occurrence = result.comparisons[0]
      ?.occurrenceDispositions[0];

    assert(
      result.status ===
          "ready" &&
        occurrence?.disposition ===
          "rejected" &&
        occurrence.booleanTruth ===
          false &&
        occurrence.booleanTruthResolved ===
          true &&
        occurrence.rejectionAuthorized ===
          true &&
        occurrence.governance.occurrenceDiscarded ===
          false &&
        occurrence.governance.graphStatusMutated ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: open match possibility remains uncertain",
  () => {
    const result = evaluate(
      "open_match_possible",
    );

    assert(
      result.comparisons[0]
        ?.occurrenceDispositions[0]
        ?.disposition ===
        "uncertain",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: open no-surviving-match remains uncertain rather than rejected",
  () => {
    const result = evaluate(
      "open_no_surviving_match",
    );

    const occurrence = result.comparisons[0]
      ?.occurrenceDispositions[0];

    assert(
      occurrence?.disposition ===
          "uncertain" &&
        occurrence.rejectionAuthorized ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: explicit mixed resolution remains uncertain",
  () => {
    const result = evaluate(
      "explicit_resolved_mixed",
    );

    assert(
      result.comparisons[0]
        ?.occurrenceDispositions[0]
        ?.disposition ===
        "uncertain",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: no fact becomes unavailable and is not false",
  () => {
    const result = evaluate(
      "no_fact",
    );

    const occurrence = result.comparisons[0]
      ?.occurrenceDispositions[0];

    assert(
      occurrence?.disposition ===
          "unavailable" &&
        occurrence.booleanTruth ===
          null &&
        occurrence.rejectionAuthorized ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: blocked comparison remains blocked and is not rejected",
  () => {
    const result = evaluate(
      "blocked",
    );

    const occurrence = result.comparisons[0]
      ?.occurrenceDispositions[0];

    assert(
      occurrence?.disposition ===
          "blocked" &&
        occurrence.booleanTruth ===
          null &&
        occurrence.rejectionAuthorized ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: compound root is blocked for this capability and never flattened",
  () => {
    const result = evaluate(
      "explicit_resolved_non_match",
      {
        rootKind: "compound_array_group",
      },
    );

    assert(
      result.status ===
          "ready" &&
        result.comparisons.length ===
          0 &&
        result.dispositionCount ===
          0 &&
        result.blockedNonLeafRootComparisonIds.length ===
          1 &&
        result.blockedCompoundRootComparisonIds.length ===
          1 &&
        result.governance.compoundSemanticsResolved ===
          false &&
        result.governance.compoundCompositionPerformed ===
          false &&
        result.governance.compoundGroupFlattened ===
          false,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: exact A3.3.4a to A3.3.4c identity mismatch blocks the layer",
  () => {
    const result = evaluate(
      "explicit_resolved_match",
      {
        corruptManifestCode: true,
      },
    );

    assert(
      result.status ===
          "blocked" &&
        result.comparisons.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "expected_projection_identity_mismatch",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "v1.46 A3.3.5b-L: inconsistent A3.3.4c boolean contract fails closed",
  () => {
    const result = evaluate(
      "explicit_resolved_non_match",
      {
        corruptBooleanTruth: true,
      },
    );

    assert(
      result.status ===
          "blocked" &&
        result.comparisons.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unsafe_a334c_boolean_contract",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

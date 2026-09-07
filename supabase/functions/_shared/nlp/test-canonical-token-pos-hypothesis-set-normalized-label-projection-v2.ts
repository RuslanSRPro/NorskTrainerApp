import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,
  type CanonicalTokenPosHypothesisSetReadResultV1,
} from "./canonical-token-pos-hypothesis-set-read-v1.ts";

import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2,
  normalizeCanonicalTokenPosActualLabelV2,
  projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2,
} from "./canonical-token-pos-hypothesis-set-normalized-label-projection-v2.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const READ_GOVERNANCE = {
  readsExistingCanonicalStateOnly: true,

  alternativeSetStatusIsAuthoritative: true,

  resolvedMembersMustBeExplicit: true,

  singletonAutoResolved: false,

  survivingCandidateAutoResolved: false,

  positiveConstraintEvidenceReevaluated: false,

  constraintPropagationInvoked: false,

  graphFactAmbiguousStatusPromotedToSetAmbiguity: false,

  memberGraphStatusesPreserved: true,

  propertyValueIsScalar: false,

  propertyValueIsHypothesisSet: true,

  runtimePosSuffixConsumed: false,

  runtimeBindingConsumed: false,

  rightOperandRead: false,

  operatorSemanticsResolved: false,

  whereEqExecuted: false,

  occurrenceEnumerationPerformed: false,

  runtimeScopeExecutionPerformed: false,

  cardinalityEnforcementPerformed: false,

  occurrenceBindingPerformed: false,

  canonicalDependencyEdgeGenerated: false,

  realizesSlotGenerated: false,

  graphMutationPerformed: false,
} as const;

type MemberFixture = {
  id: string;

  label: string;

  graphStatus:
    | "candidate"
    | "resolved"
    | "rejected"
    | "blocked"
    | "ambiguous";

  explicitlyResolved?: boolean;
};

function readFixture(
  options: {
    readId?: string;

    tokenNodeId?: string;

    readState?:
      | "no_pos_fact"
      | "open_hypothesis_set"
      | "explicit_resolved"
      | "blocked_hypothesis_set";

    alternativeSetId?: string | null;

    alternativeSetStatus?:
      | "open"
      | "resolved"
      | "blocked"
      | null;

    members?: MemberFixture[];

    resolvedMemberIds?: string[];

    resolvedPosLabels?: string[];
  } = {},
): CanonicalTokenPosHypothesisSetReadResultV1 {
  const readState = options.readState ??
    "open_hypothesis_set";

  const members = options.members ??
    [
      {
        id: "pos:0",
        label: "noun",
        graphStatus: "candidate" as const,
      },
      {
        id: "pos:1",
        label: "adjective",
        graphStatus: "candidate" as const,
      },
    ];

  const alternativeSetId = options.alternativeSetId !==
      undefined
    ? options.alternativeSetId
    : readState ===
        "no_pos_fact"
    ? null
    : "alt:pos:token:0";

  const alternativeSetStatus = options.alternativeSetStatus !==
      undefined
    ? options.alternativeSetStatus
    : readState ===
        "no_pos_fact"
    ? null
    : readState ===
        "explicit_resolved"
    ? "resolved"
    : readState ===
        "blocked_hypothesis_set"
    ? "blocked"
    : "open";

  return {
    producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,

    producerVersion: "1",

    status: "ready",

    read: {
      readId: options.readId ??
        "canonical-token-pos-read:token:0",

      status: "candidate",

      tokenNodeId: options.tokenNodeId ??
        "token:0",

      readState,

      alternativeSetId,

      alternativeSetStatus,

      members: members.map(
        (member) => ({
          posReadingNodeId: member.id,

          posLabel: member.label,

          graphStatus: member.graphStatus,

          explicitlyResolved: member.explicitlyResolved ??
            false,
        }),
      ),

      resolvedMemberIds: [
        ...(options.resolvedMemberIds ??
          []),
      ],

      resolvedPosLabels: [
        ...(options.resolvedPosLabels ??
          []),
      ],

      governance: {
        ...READ_GOVERNANCE,
      },
    },

    blockingReasons: [],
  } as unknown as CanonicalTokenPosHypothesisSetReadResultV1;
}

Deno.test(
  "P2.1 actual label normalizer executes trim NFC and nb-NO lowercase only",
  () => {
    assert(
      normalizeCanonicalTokenPosActualLabelV2(
        "  VeRb  ",
      ) ===
        "verb",
      "trim/lowercase normalization failed",
    );

    assert(
      normalizeCanonicalTokenPosActualLabelV2(
        "A\u030A",
      ) ===
        "\u00E5",
      "NFC normalization failed",
    );

    assert(
      normalizeCanonicalTokenPosActualLabelV2(
        "   ",
      ) ===
        undefined,
      "blank label was accepted",
    );

    assert(
      normalizeCanonicalTokenPosActualLabelV2(
        42,
      ) ===
        undefined,
      "non-string label was accepted",
    );
  },
);

Deno.test(
  "P2.2 no_pos_fact remains no_pos_fact with empty normalized projection",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        readState: "no_pos_fact",

        members: [],

        alternativeSetId: null,

        alternativeSetStatus: null,
      }),
    );

    const projection = result.projection;

    assert(
      result.status ===
          "ready" &&
        projection?.readState ===
          "no_pos_fact" &&
        projection.members.length ===
          0 &&
        projection.alternativeSetId ===
          null &&
        projection.alternativeSetStatus ===
          null &&
        projection.resolvedMemberIds.length ===
          0 &&
        projection.normalizedResolvedPosLabels.length ===
          0,
      "no_pos_fact semantics changed",
    );
  },
);

Deno.test(
  "P2.3 open multiple hypotheses preserve every member identity status and raw label",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        members: [
          {
            id: "pos:n",
            label: " Noun ",
            graphStatus: "candidate",
          },
          {
            id: "pos:a",
            label: "ADJECTIVE",
            graphStatus: "ambiguous",
          },
        ],
      }),
    );

    const projection = result.projection;

    assert(
      result.status ===
          "ready" &&
        projection?.readState ===
          "open_hypothesis_set" &&
        projection.members.length ===
          2 &&
        projection.members[0]
            .posReadingNodeId ===
          "pos:n" &&
        projection.members[0]
            .rawPosLabel ===
          " Noun " &&
        projection.members[0]
            .normalizedPosLabel ===
          "noun" &&
        projection.members[0]
            .graphStatus ===
          "candidate" &&
        projection.members[1]
            .posReadingNodeId ===
          "pos:a" &&
        projection.members[1]
            .normalizedPosLabel ===
          "adjective" &&
        projection.members[1]
            .graphStatus ===
          "ambiguous",
      "open member preservation failed",
    );
  },
);

Deno.test(
  "P2.4 singleton open hypothesis remains open and never becomes resolved",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        members: [
          {
            id: "pos:only",
            label: "VERB",
            graphStatus: "candidate",
          },
        ],
      }),
    );

    const projection = result.projection;

    assert(
      projection?.readState ===
          "open_hypothesis_set" &&
        projection.members.length ===
          1 &&
        projection.resolvedMemberIds.length ===
          0 &&
        projection.governance
            .posWinnerSelected ===
          false &&
        projection.governance
            .alternativeSetResolutionPerformed ===
          false,
      "singleton hypothesis was promoted",
    );
  },
);

Deno.test(
  "P2.5 explicit resolved state identities and resolved label order are preserved",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        readState: "explicit_resolved",

        alternativeSetStatus: "resolved",

        members: [
          {
            id: "pos:n",
            label: " NOUN ",
            graphStatus: "resolved",
            explicitlyResolved: true,
          },
          {
            id: "pos:a",
            label: "adjective",
            graphStatus: "rejected",
          },
        ],

        resolvedMemberIds: [
          "pos:n",
        ],

        resolvedPosLabels: [
          " NOUN ",
        ],
      }),
    );

    const projection = result.projection;

    assert(
      projection?.readState ===
          "explicit_resolved" &&
        projection.alternativeSetStatus ===
          "resolved" &&
        JSON.stringify(
            projection.resolvedMemberIds,
          ) ===
          JSON.stringify([
            "pos:n",
          ]) &&
        JSON.stringify(
            projection.rawResolvedPosLabels,
          ) ===
          JSON.stringify([
            " NOUN ",
          ]) &&
        JSON.stringify(
            projection.normalizedResolvedPosLabels,
          ) ===
          JSON.stringify([
            "noun",
          ]) &&
        projection.members[0]
            .explicitlyResolved ===
          true,
      "explicit resolution was reconstructed or reordered",
    );
  },
);

Deno.test(
  "P2.6 blocked hypothesis-set state remains blocked without comparison",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        readState: "blocked_hypothesis_set",

        alternativeSetStatus: "blocked",

        members: [
          {
            id: "pos:r",
            label: "noun",
            graphStatus: "rejected",
          },
          {
            id: "pos:b",
            label: "verb",
            graphStatus: "blocked",
          },
        ],
      }),
    );

    const projection = result.projection;

    assert(
      result.status ===
          "ready" &&
        projection?.readState ===
          "blocked_hypothesis_set" &&
        projection.alternativeSetStatus ===
          "blocked" &&
        projection.members.length ===
          2 &&
        projection.governance
            .comparisonPerformed ===
          false &&
        projection.governance
            .comparisonTruthResolved ===
          false,
      "blocked read state was changed",
    );
  },
);

Deno.test(
  "P2.7 ambiguous graph member status is preserved as member status only",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        members: [
          {
            id: "pos:amb",
            label: "PREPOSITION",
            graphStatus: "ambiguous",
          },
        ],
      }),
    );

    const projection = result.projection;

    assert(
      projection?.readState ===
          "open_hypothesis_set" &&
        projection.members[0]
            .graphStatus ===
          "ambiguous" &&
        projection.governance
            .hypothesisSetStatePreserved ===
          true,
      "member ambiguity changed hypothesis-set semantics",
    );
  },
);

Deno.test(
  "P2.8 normalization collision preserves distinct canonical POS facts",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        members: [
          {
            id: "pos:decomposed",
            label: "A\u030A",
            graphStatus: "candidate",
          },
          {
            id: "pos:composed",
            label: "\u00C5",
            graphStatus: "ambiguous",
          },
        ],
      }),
    );

    const projection = result.projection;

    assert(
      projection?.members.length ===
          2 &&
        projection.members[0]
            .posReadingNodeId ===
          "pos:decomposed" &&
        projection.members[1]
            .posReadingNodeId ===
          "pos:composed" &&
        projection.members[0]
            .normalizedPosLabel ===
          "\u00E5" &&
        projection.members[1]
            .normalizedPosLabel ===
          "\u00E5" &&
        projection.governance
            .membersDeduplicated ===
          false &&
        projection.governance
            .normalizationCollisionMultiplicityPreserved ===
          true,
      "normalization collision collapsed canonical facts",
    );
  },
);

Deno.test(
  "P2.9 resolved normalization collision preserves multiplicity identity and order",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        readState: "explicit_resolved",

        alternativeSetStatus: "resolved",

        members: [
          {
            id: "pos:0",
            label: " A\u030A ",
            graphStatus: "resolved",
            explicitlyResolved: true,
          },
          {
            id: "pos:1",
            label: "\u00C5",
            graphStatus: "resolved",
            explicitlyResolved: true,
          },
        ],

        resolvedMemberIds: [
          "pos:0",
          "pos:1",
        ],

        resolvedPosLabels: [
          " A\u030A ",
          "\u00C5",
        ],
      }),
    );

    const projection = result.projection;

    assert(
      JSON.stringify(
            projection?.resolvedMemberIds,
          ) ===
          JSON.stringify([
            "pos:0",
            "pos:1",
          ]) &&
        JSON.stringify(
            projection
              ?.normalizedResolvedPosLabels,
          ) ===
          JSON.stringify([
            "\u00E5",
            "\u00E5",
          ]) &&
        projection?.normalizedResolvedPosLabels
            .length ===
          2,
      "resolved collision multiplicity/order was lost",
    );
  },
);

Deno.test(
  "P2.10 blank canonical POS member label blocks whole projection fail closed",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        members: [
          {
            id: "pos:blank",
            label: "   ",
            graphStatus: "candidate",
          },
        ],
      }),
    );

    assert(
      result.status ===
          "blocked" &&
        result.projection ===
          undefined &&
        JSON.stringify(
            result.blockingReasons,
          ) ===
          JSON.stringify([
            "member:pos:blank:actual_pos_label_normalization_failed",
          ]),
      "blank member label was silently dropped or accepted",
    );
  },
);

Deno.test(
  "P2.11 invalid resolved label blocks rather than dropping resolved evidence",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture({
        readState: "explicit_resolved",

        alternativeSetStatus: "resolved",

        members: [
          {
            id: "pos:0",
            label: "noun",
            graphStatus: "resolved",
            explicitlyResolved: true,
          },
        ],

        resolvedMemberIds: [
          "pos:0",
        ],

        resolvedPosLabels: [
          "   ",
        ],
      }),
    );

    assert(
      result.status ===
          "blocked" &&
        result.projection ===
          undefined &&
        JSON.stringify(
            result.blockingReasons,
          ) ===
          JSON.stringify([
            "resolved_pos_label:0:actual_pos_label_normalization_failed",
          ]),
      "invalid resolved label was silently discarded",
    );
  },
);

Deno.test(
  "P2.12 semantic capability must be the exact closed capability object",
  () => {
    const stale = {
      ...CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
    } as unknown as CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1;

    assert(
      stale !==
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
      "fixture failed to create distinct capability object",
    );

    assert(
      normalizeCanonicalTokenPosActualLabelV2(
        "noun",
        stale,
      ) ===
        undefined,
      "normalizer accepted non-exact capability object",
    );

    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture(),
      stale,
    );

    assert(
      result.status ===
          "blocked" &&
        JSON.stringify(
            result.blockingReasons,
          ) ===
          JSON.stringify([
            "semantic_capability:not_exact_normalized_label_eq_capability",
          ]),
      "projection accepted non-exact capability object",
    );
  },
);

Deno.test(
  "P2.13 non-exact R producer result blocks before normalization",
  () => {
    const exact = readFixture();

    const stale = {
      ...exact,

      producer: "stale_read_producer",
    } as unknown as CanonicalTokenPosHypothesisSetReadResultV1;

    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      stale,
    );

    assert(
      result.status ===
          "blocked" &&
        result.projection ===
          undefined &&
        JSON.stringify(
            result.blockingReasons,
          ) ===
          JSON.stringify([
            "source_read:not_exact_ready_canonical_pos_hypothesis_set_read",
          ]),
      "non-exact R result was consumed",
    );
  },
);

Deno.test(
  "P2.14 projection preserves exact semantic capability identity and actual normalization contract",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture(),
    );

    const projection = result.projection;

    const semantic =
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1;

    assert(
      projection?.semanticCapabilityId ===
          CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 &&
        projection.semanticCapabilityVersion ===
          "1" &&
        projection.semanticDomain ===
          semantic.semanticDomain &&
        projection.canonicalPropertyDomain ===
          semantic.canonicalPropertyDomain &&
        projection.canonicalPropertyKind ===
          semantic.canonicalPropertyKind &&
        projection.actualNormalizationContract ===
          semantic.actualLabelNormalization,
      "semantic capability identity/contract was reconstructed",
    );
  },
);

Deno.test(
  "P2.15 governance proves actual-side normalization only with no Runtime comparison truth binding cardinality or mutation",
  () => {
    const result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      readFixture(),
    );

    const g = result.projection
      ?.governance;

    assert(
      g !==
          undefined &&
        g.exactReadResultRequired ===
          true &&
        g.exactSemanticCapabilityRequired ===
          true &&
        g.semanticCapabilityContractValidatedBeforeExecution ===
          true &&
        g.canonicalPosHypothesisReadConsumed ===
          true &&
        g.actualPosLabelReadPerformed ===
          true &&
        g.actualLabelNormalizationPerformed ===
          true &&
        g.normalizedLabelsAdded ===
          true &&
        g.historicalRuntimeEqAuthorityImported ===
          false &&
        g.runtimeProducerConsumed ===
          false &&
        g.manifestConsumed ===
          false &&
        g.runtimeWhereConsumed ===
          false &&
        g.runtimeBindingConsumed ===
          false &&
        g.runtimeExpectedLabelConsumed ===
          false &&
        g.posVocabularyValidated ===
          false &&
        g.membersDeduplicated ===
          false &&
        g.posWinnerSelected ===
          false &&
        g.alternativeSetResolutionPerformed ===
          false &&
        g.comparisonPerformed ===
          false &&
        g.comparisonTruthResolved ===
          false &&
        g.runtimeConditionTruthResolved ===
          false &&
        g.sentenceDomainConsumed ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.candidateOnly ===
          true &&
        g.frozenGrammarReadOnly ===
          true,
      "P2 crossed actual-normalization authority ceiling",
    );
  },
);

Deno.test(
  "P2.16 projection is deterministic and preserves unknown POS spelling without vocabulary validation",
  () => {
    const input = readFixture({
      members: [
        {
          id: "pos:x",
          label: "  Totally_New_POS  ",
          graphStatus: "candidate",
        },
      ],
    });

    const a = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      input,
    );

    const b = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
      input,
    );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      "P2 output is not deterministic",
    );

    assert(
      a.projection?.members[0]
            .normalizedPosLabel ===
          "totally_new_pos" &&
        a.projection.governance
            .posVocabularyValidated ===
          false,
      "P2 inferred POS vocabulary authority",
    );
  },
);

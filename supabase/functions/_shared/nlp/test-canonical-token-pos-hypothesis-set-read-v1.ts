import {
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type GraphStatus,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import type {
  CanonicalPosFactOwnershipAuthorityResultV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

import {
  readCanonicalTokenPosHypothesisSetV1,
} from "./canonical-token-pos-hypothesis-set-read-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function baseGraph() {
  const graph = createCanonicalLanguageGraphV1(
    buildCanonicalSurfaceDocumentV1(
      "x",
    ),
  );

  const token = graph.nodes.find(
    (node) =>
      node.type ===
        "token",
  );

  assert(
    token !==
      undefined,
    "surface token missing",
  );

  return {
    graph,
    token,
  };
}

function fixture(
  options: {
    labels?: string[];
    statuses?: GraphStatus[];
    alternativeStatus?:
      | "open"
      | "resolved"
      | "blocked";
    resolvedIndices?: number[];
  } = {},
) {
  const base = baseGraph();

  const labels = options.labels ??
    [
      "noun",
      "adjective",
    ];

  const statuses = options.statuses ??
    labels.map(
      () => "candidate" as const,
    );

  const alternativeStatus = options.alternativeStatus ??
    "open";

  const resolvedIndices = options.resolvedIndices ??
    [];

  assert(
    labels.length ===
      statuses.length,
    "fixture labels/status length mismatch",
  );

  const nodes: LanguageGraphNodeV1[] = [];

  const edges: LanguageGraphEdgeV1[] = [];

  labels.forEach(
    (
      label,
      index,
    ) => {
      const id = `pos:${index}`;

      nodes.push({
        id,

        type: "lexical_reading",

        subtype: "pos_candidate",

        status: statuses[index],

        span: {
          ...base.token.span,
        },

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [],

        provenanceIds: [],
      });

      edges.push({
        id: `edge:pos:${index}`,

        relation: "pos_of",

        sourceId: id,

        targetId: base.token.id,

        status: statuses[index],

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [],

        provenanceIds: [],
      });
    },
  );

  const memberIds = nodes.map(
    (node) => node.id,
  );

  const resolvedMemberIds = resolvedIndices.map(
    (index) => memberIds[index],
  );

  const graph: CanonicalLanguageGraphV1 = {
    ...base.graph,

    nodes: [
      ...base.graph.nodes,
      ...nodes,
    ],

    edges: [
      ...base.graph.edges,
      ...edges,
    ],

    alternativeSets: labels.length ===
        0
      ? []
      : [
        {
          id: `alt:pos:${base.token.id}`,

          memberIds,

          resolvedMemberIds,

          status: alternativeStatus,

          reason: "fixture",
        },
      ],
  };

  const ownership: CanonicalPosFactOwnershipAuthorityResultV1 = {
    producer: "canonical_pos_fact_ownership_authority_v1",

    producerVersion: "1",

    status: "ready",

    authorities: labels.map(
      (
        label,
        index,
      ) => ({
        authorityId: `canonical-pos-fact:pos:${index}`,

        status: "proven" as const,

        model: "POS-A" as const,

        posReadingNodeId: `pos:${index}`,

        posLabel: label,

        posReadingGraphStatus: statuses[index],

        tokenNodeId: base.token.id,

        posOfEdgeId: `edge:pos:${index}`,

        posOfEdgeGraphStatus: statuses[index],

        contributingLexicalReadingIds: [
          `lex:${index}`,
        ],

        lexicalSupportEdgeIds: [
          `support:${index}`,
        ],

        lexicalSupportGraphStatuses: [
          "candidate" as const,
        ],

        alternativeSetId: `alt:pos:${base.token.id}`,

        alternativeSetStatus: alternativeStatus,

        alternativeMemberIds: [
          ...memberIds,
        ],

        resolvedMemberIds: [
          ...resolvedMemberIds,
        ],

        governance: {
          exactCanonicalPosRepresentation: true as const,

          posModel: "POS-A" as const,

          posFactNodeType: "lexical_reading" as const,

          posFactSubtype: "pos_candidate" as const,

          posLabelOwnedByNodeFeature: true as const,

          exactOccurrenceOwnershipUsesPosOfEdge: true as const,

          posOfDirection: "pos_candidate_to_token" as const,

          lexicalSupportDirection:
            "lexical_candidate_to_pos_candidate" as const,

          sourcePosIsEvidenceNotAuthority: true as const,

          alternativeDomainIsTokenLocal: true as const,

          multiplePosCandidatesMayCoexist: true as const,

          underlyingGraphStatusPreserved: true as const,

          candidateDoesNotMeanResolved: true as const,

          resolvedAlternativeWinnerNotInferred: true as const,

          compatibilitySubtypePosPromoted: false as const,

          runtimePosSuffixMapped: false as const,

          whereOperatorSemanticsResolved: false as const,

          whereEqExecuted: false as const,

          referenceValueResolved: false as const,

          rawSurfaceSpellingRead: false as const,

          firstCandidateWins: false as const,

          occurrenceEnumerationPerformed: false as const,

          runtimeScopeExecutionPerformed: false as const,

          cardinalityEnforcementPerformed: false as const,

          occurrenceBindingPerformed: false as const,

          dependencyDirectionResolved: false as const,

          canonicalDependencyEdgeGenerated: false as const,

          grammaticalFunctionResolved: false as const,

          complementArgumentAttachmentResolved: false as const,

          realizesSlotGenerated: false as const,

          graphMutationPerformed: false as const,

          frozenGrammarReadOnly: true as const,
        },
      }),
    ),

    blockingReasons: [],
  };

  const capability = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownership,
  );

  assert(
    capability.status ===
      "ready",
    "POS capability fixture failed",
  );

  return {
    graph,
    tokenId: base.token.id,
    ownership,
    capability,
  };
}

Deno.test(
  "v1.46 A3.3.2d: exact token with no POS facts reads no_pos_fact",
  () => {
    const f = fixture({
      labels: [],

      statuses: [],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
          "ready" &&
        result.read
            ?.readState ===
          "no_pos_fact" &&
        result.read.members.length ===
          0,
      `result=${JSON.stringify(result)}`,
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: multiple candidate POS facts preserve open hypothesis set",
  () => {
    const f = fixture();

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
          "ready" &&
        result.read
            ?.readState ===
          "open_hypothesis_set" &&
        result.read.members.length ===
          2 &&
        result.read.resolvedMemberIds.length ===
          0,
      "open POS alternatives collapsed",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: singleton open POS candidate remains open and is not auto-resolved",
  () => {
    const f = fixture({
      labels: [
        "noun",
      ],

      statuses: [
        "candidate",
      ],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.read
            ?.readState ===
          "open_hypothesis_set" &&
        result.read.members.length ===
          1 &&
        result.read.governance
            .singletonAutoResolved ===
          false,
      "singleton POS was auto-resolved",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: explicit canonical resolution is read only from resolved set and explicit member ids",
  () => {
    const f = fixture({
      statuses: [
        "resolved",
        "rejected",
      ],

      alternativeStatus: "resolved",

      resolvedIndices: [
        0,
      ],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
          "ready" &&
        result.read
            ?.readState ===
          "explicit_resolved" &&
        JSON.stringify(
            result.read.resolvedPosLabels,
          ) ===
          JSON.stringify([
            "noun",
          ]),
      "explicit resolved POS was not read exactly",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: explicitly blocked POS set is distinguishable from no fact",
  () => {
    const f = fixture({
      statuses: [
        "rejected",
        "blocked",
      ],

      alternativeStatus: "blocked",
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
          "ready" &&
        result.read
            ?.readState ===
          "blocked_hypothesis_set" &&
        result.read.members.length ===
          2,
      "blocked set collapsed into absence",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: graph fact ambiguous status remains member status and does not become set ambiguity",
  () => {
    const f = fixture({
      statuses: [
        "ambiguous",
        "candidate",
      ],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
          "ready" &&
        result.read
            ?.readState ===
          "open_hypothesis_set" &&
        result.read.members.some(
          (member) =>
            member.graphStatus ===
              "ambiguous",
        ) &&
        result.read.governance
            .graphFactAmbiguousStatusPromotedToSetAmbiguity ===
          false,
      "fact ambiguity was promoted into invented set semantics",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: stale graph status versus POS ownership snapshot blocks read",
  () => {
    const f = fixture();

    f.graph.nodes = f.graph.nodes.map(
      (node) =>
        node.id ===
            "pos:0"
          ? {
            ...node,

            status: "rejected",
          }
          : node,
    );

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
        "blocked",
      "stale ownership snapshot was consumed",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: resolved set without explicit resolved member blocks rather than inventing winner",
  () => {
    const f = fixture({
      labels: [
        "noun",
      ],

      statuses: [
        "candidate",
      ],

      alternativeStatus: "resolved",

      resolvedIndices: [],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
        "blocked",
      "resolved set without explicit member was accepted",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d.1: open set containing graph-resolved member is inconsistent",
  () => {
    const f = fixture({
      labels: [
        "noun",
      ],

      statuses: [
        "resolved",
      ],

      alternativeStatus: "open",

      resolvedIndices: [],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
        "blocked",
      "open set containing graph-resolved POS fact was accepted",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d.1: explicit resolvedMemberIds must equal graph-resolved member set",
  () => {
    const f = fixture({
      labels: [
        "noun",
        "adjective",
      ],

      statuses: [
        "resolved",
        "resolved",
      ],

      alternativeStatus: "resolved",

      resolvedIndices: [
        0,
      ],
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
        "blocked",
      "hidden graph-resolved member outside resolvedMemberIds was accepted",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: blocked set containing a surviving candidate is inconsistent and blocks read",
  () => {
    const f = fixture({
      statuses: [
        "candidate",
        "rejected",
      ],

      alternativeStatus: "blocked",
    });

    const result = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    assert(
      result.status ===
        "blocked",
      "blocked set with surviving fact was accepted",
    );
  },
);

Deno.test(
  "v1.46 A3.3.2d: deterministic read performs no resolution evidence reevaluation Runtime where scope cardinality or dependency execution",
  () => {
    const f = fixture({
      statuses: [
        "candidate",
        "ambiguous",
      ],
    });

    const x = readCanonicalTokenPosHypothesisSetV1(
      f.graph,
      f.tokenId,
      f.ownership,
      f.capability,
    );

    const y = readCanonicalTokenPosHypothesisSetV1(
      {
        ...f.graph,

        nodes: [
          ...f.graph.nodes,
        ].reverse(),

        edges: [
          ...f.graph.edges,
        ].reverse(),

        alternativeSets: [
          ...f.graph.alternativeSets,
        ].reverse(),
      },
      f.tokenId,
      {
        ...f.ownership,

        authorities: [
          ...f.ownership.authorities,
        ].reverse(),
      },
      f.capability,
    );

    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      "A3.3.2d read is not deterministic",
    );

    const g = x.read
      ?.governance;

    assert(
      g !==
          undefined &&
        g.readsExistingCanonicalStateOnly ===
          true &&
        g.alternativeSetStatusIsAuthoritative ===
          true &&
        g.singletonAutoResolved ===
          false &&
        g.survivingCandidateAutoResolved ===
          false &&
        g.positiveConstraintEvidenceReevaluated ===
          false &&
        g.constraintPropagationInvoked ===
          false &&
        g.graphFactAmbiguousStatusPromotedToSetAmbiguity ===
          false &&
        g.propertyValueIsScalar ===
          false &&
        g.propertyValueIsHypothesisSet ===
          true &&
        g.runtimePosSuffixConsumed ===
          false &&
        g.runtimeBindingConsumed ===
          false &&
        g.rightOperandRead ===
          false &&
        g.operatorSemanticsResolved ===
          false &&
        g.whereEqExecuted ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.runtimeScopeExecutionPerformed ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.canonicalDependencyEdgeGenerated ===
          false &&
        g.realizesSlotGenerated ===
          false &&
        g.graphMutationPerformed ===
          false,
      "A3.3.2d crossed read-only boundary",
    );
  },
);

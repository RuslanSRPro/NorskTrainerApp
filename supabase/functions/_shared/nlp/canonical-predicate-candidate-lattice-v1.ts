// Norsk Trainer — Canonical Predicate Candidate Lattice V1 (v1.44)
//
// Structural predicate identity only.
//
// Input:
//   canonical phrase candidates + canonical head_of evidence
//   + read-only predicate projection.
//
// Output:
//   candidate predicate nodes.
//
// Non-goals:
//   clause construction
//   subject detection
//   valency
//   arguments
//   participant roles
//   TAM
//   auxiliary/copular/lexical sense
//   production activation

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalPredicateProjectionV1,
} from './canonical-predicate-projection-adapter-v1.ts';

export const CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1 =
  'canonical_predicate_candidate_lattice_v1';

export const CANONICAL_PREDICATE_CANDIDATE_LATTICE_VERSION_V1 =
  '1';

type Json = Record<string, unknown>;

export type CanonicalPredicateCandidateSummaryV1 = {
  producer:
    typeof CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1;

  producerVersion:
    typeof CANONICAL_PREDICATE_CANDIDATE_LATTICE_VERSION_V1;

  predicateNodes: number;
  realizationEdges: number;
  alternativeSets: number;

  resolvedFacts: number;
  rejectedFacts: number;
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

function numberValue(
  value: unknown,
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll('%', '_');
}

function unique<T>(
  values: readonly T[],
): T[] {
  return [...new Set(values)];
}

function usableStatus(
  node:
    | LanguageGraphNodeV1
    | LanguageGraphEdgeV1,
): boolean {
  return node.status !== 'rejected' &&
    node.status !== 'blocked';
}

function phraseHeadEdges(
  graph: CanonicalLanguageGraphV1,
  phrase: LanguageGraphNodeV1,
): LanguageGraphEdgeV1[] {
  const explicitHeadTokenId =
    stringValue(
      phrase.features.headTokenId,
    );

  return graph.edges
    .filter(
      (edge) =>
        edge.relation ===
          'head_of' &&
        edge.targetId ===
          phrase.id &&
        usableStatus(edge),
    )
    .filter((edge) => {
      const source =
        graph.nodes.find(
          (node) =>
            node.id ===
              edge.sourceId,
        );

      if (
        !source ||
        !usableStatus(source)
      ) {
        return false;
      }

      if (
        explicitHeadTokenId &&
        edge.sourceId !==
          explicitHeadTokenId
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      a.id.localeCompare(b.id)
    );
}

function projectionProvenance(
  projection:
    CanonicalPredicateProjectionV1,
): LanguageGraphProvenanceV1[] {
  const runtimeId =
    `prov:${CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1}` +
    `:runtime_projection:${idPart(projection.projectionCode)}`;

  const sourceId =
    `prov:${CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1}` +
    `:source_rule:${idPart(projection.sourceCandidateCode)}`;

  return [
    {
      id:
        runtimeId,

      sourceType:
        'runtime_fact',

      sourceId:
        projection.projectionCode,

      payload: {
        manifestId:
          projection.manifestId,

        manifestCode:
          projection.manifestCode,

        historicalRuleId:
          projection.historicalRuleId,

        historicalRuleCode:
          projection.historicalRuleCode,

        historicalRuleInterpretationOnly:
          true,

        frozenGrammarReadOnly:
          true,

        clauseScopeConsumed:
          false,
      },
    },

    {
      id:
        sourceId,

      sourceType:
        'source_rule',

      sourceId:
        projection.sourceCandidateCode,

      payload: {
        candidateId:
          projection.sourceCandidateId,

        sourceSection:
          projection.sourceSection ?? null,

        frozenGrammarReadOnly:
          true,
      },
    },
  ];
}

function predicateAlternativeSets(
  nodes:
    readonly LanguageGraphNodeV1[],
): LanguageGraphAlternativeSetV1[] {
  const groups =
    new Map<string, string[]>();

  for (const node of nodes) {
    if (
      node.type !==
        'predicate'
    ) {
      continue;
    }

    const sentenceIndex =
      numberValue(
        node.features.sentenceIndex,
      );

    const role =
      stringValue(
        node.features.role,
      );

    const anchorHeadId =
      stringValue(
        node.features.anchorHeadId,
      );

    if (
      sentenceIndex === undefined ||
      !role ||
      !anchorHeadId
    ) {
      continue;
    }

    // Predicates sharing one canonical head are structural alternatives.
    // Different heads coexist; clause-level competition is deferred.
    const key =
      `${sentenceIndex}|${role}|${anchorHeadId}`;

    const members =
      groups.get(key) ?? [];

    members.push(node.id);

    groups.set(
      key,
      members,
    );
  }

  return [...groups.entries()]
    .sort(([a], [b]) =>
      a.localeCompare(b)
    )
    .map(([key, memberIds]) => ({
      id:
        `alt:predicate:${idPart(key)}`,

      memberIds:
        unique(memberIds).sort(),

      resolvedMemberIds:
        [],

      status:
        'open' as const,

      reason:
        'canonical_predicate_candidates_wait_for_evidence',
    }));
}

export function buildCanonicalPredicateCandidateLatticePatchV1(
  graph: CanonicalLanguageGraphV1,
  projections:
    readonly CanonicalPredicateProjectionV1[],
): GraphPatchV1 {
  const producer =
    CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1;

  const producerVersion =
    CANONICAL_PREDICATE_CANDIDATE_LATTICE_VERSION_V1;

  const nodes =
    new Map<string, LanguageGraphNodeV1>();

  const edges =
    new Map<string, LanguageGraphEdgeV1>();

  const evidence =
    new Map<string, LanguageGraphEvidenceV1>();

  const provenance =
    new Map<string, LanguageGraphProvenanceV1>();

  const executableProjections =
    [...projections]
      .filter(
        (projection) =>
          Boolean(
            projection.projectionCode &&
            projection.role &&
            projection.inputPhraseType &&
            projection.inputBindingRef &&
            projection.graphOperation ===
              'assign_role' &&
            projection.requireHead ===
              true &&
            projection.sourceCandidateCode,
          ),
      )
      .sort((a, b) =>
        a.projectionCode.localeCompare(
          b.projectionCode,
        )
      );

  const phrases =
    graph.nodes
      .filter(
        (node) =>
          node.type ===
            'phrase' &&
          usableStatus(node),
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  for (
    const projection of
      executableProjections
  ) {
    const newProvenance =
      projectionProvenance(
        projection,
      );

    for (
      const item of
        newProvenance
    ) {
      provenance.set(
        item.id,
        item,
      );
    }

    for (const phrase of phrases) {
      const phraseType =
        stringValue(
          phrase.subtype,
        ) ??
        stringValue(
          phrase.features.phraseType,
        );

      if (
        phraseType !==
          projection.inputPhraseType
      ) {
        continue;
      }

      const featurePhraseType =
        stringValue(
          phrase.features.phraseType,
        );

      if (
        featurePhraseType &&
        featurePhraseType !==
          phraseType
      ) {
        continue;
      }

      const sentenceIndex =
        numberValue(
          phrase.features.sentenceIndex,
        );

      if (
        sentenceIndex === undefined
      ) {
        continue;
      }

      const headEdges =
        phraseHeadEdges(
          graph,
          phrase,
        );

      if (
        projection.requireHead &&
        headEdges.length === 0
      ) {
        continue;
      }

      const explicitHeadTokenId =
        stringValue(
          phrase.features.headTokenId,
        );

      const anchorHeadId =
        explicitHeadTokenId ??
        (
          headEdges.length === 1
            ? headEdges[0].sourceId
            : undefined
        );

      if (!anchorHeadId) {
        // Do not collapse ambiguous head ownership into one predicate fact.
        continue;
      }

      const candidateId = [
        'predicatecand',
        idPart(projection.role),
        idPart(phrase.id),
        idPart(projection.projectionCode),
      ].join(':');

      const evidenceId =
        `evidence:${producer}:${candidateId}`;

      const provenanceIds =
        unique([
          ...phrase.provenanceIds,

          ...headEdges.flatMap(
            (edge) =>
              edge.provenanceIds,
          ),

          ...newProvenance.map(
            (item) =>
              item.id,
          ),
        ]);

      const node:
        LanguageGraphNodeV1 = {
        id:
          candidateId,

        type:
          'predicate',

        subtype:
          projection.role,

        status:
          'candidate',

        span:
          phrase.span
            ? { ...phrase.span }
            : undefined,

        features: {
          role:
            projection.role,

          sentenceIndex,

          realizationType:
            projection.inputPhraseType,

          realizedByPhraseId:
            phrase.id,

          anchorHeadId,

          supportingHeadEdgeIds:
            headEdges.map(
              (edge) =>
                edge.id,
            ),

          projectionId:
            projection.projectionId,

          projectionCode:
            projection.projectionCode,

          graphOperation:
            projection.graphOperation,

          runtimeFamily:
            projection.runtimeFamily ?? null,

          executionPhase:
            projection.executionPhase ?? null,

          constraintStrength:
            projection.constraintStrength ?? null,

          sourceCandidateCodes: [
            projection.sourceCandidateCode,
          ],

          sourceSections:
            projection.sourceSection
              ? [projection.sourceSection]
              : [],

          manifestCode:
            projection.manifestCode,

          historicalRuleCode:
            projection.historicalRuleCode,

          sourcePredicateForm:
            projection.sourcePredicateForm ?? null,

          candidateGeneration:
            'frozen_predicate_projection',

          frozenGrammarReadOnly:
            true,

          historicalRuleInterpretationOnly:
            true,

          clauseScopeConsumed:
            false,

          resolutionPolicy:
            'candidate_only',
        },

        producer,

        evidenceIds: [
          evidenceId,
        ],

        provenanceIds,
      };

      const realizationEdge:
        LanguageGraphEdgeV1 = {
        id:
          `edge:predicate_realized_by:${idPart(candidateId)}:${idPart(phrase.id)}`,

        relation:
          'predicate_realized_by',

        sourceId:
          candidateId,

        targetId:
          phrase.id,

        status:
          'candidate',

        features: {
          role:
            projection.role,

          realizationType:
            projection.inputPhraseType,

          sourceCandidateCodes: [
            projection.sourceCandidateCode,
          ],
        },

        producer,

        evidenceIds: [
          evidenceId,
        ],

        provenanceIds,
      };

      const evidenceItem:
        LanguageGraphEvidenceV1 = {
        id:
          evidenceId,

        kind:
          'source_rule',

        status:
          'supports',

        targetIds: [
          node.id,
          realizationEdge.id,
        ],

        payload: {
          projectionId:
            projection.projectionId,

          projectionCode:
            projection.projectionCode,

          role:
            projection.role,

          inputBindingRef:
            projection.inputBindingRef,

          inputPhraseType:
            projection.inputPhraseType,

          realizedByPhraseId:
            phrase.id,

          anchorHeadId,

          supportingHeadEdgeIds:
            headEdges.map(
              (edge) =>
                edge.id,
            ),

          sourceCandidateCode:
            projection.sourceCandidateCode,

          sourceSection:
            projection.sourceSection ?? null,

          manifestCode:
            projection.manifestCode,

          historicalRuleCode:
            projection.historicalRuleCode,

          frozenGrammarReadOnly:
            true,

          historicalRuleInterpretationOnly:
            true,

          clauseScopeConsumed:
            false,

          resolutionPolicy:
            'candidate_only',
        },

        producer,

        provenanceIds,
      };

      nodes.set(
        node.id,
        node,
      );

      edges.set(
        realizationEdge.id,
        realizationEdge,
      );

      evidence.set(
        evidenceItem.id,
        evidenceItem,
      );
    }
  }

  const nodeList =
    [...nodes.values()]
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  return {
    producer,
    producerVersion,

    nodes:
      nodeList,

    edges:
      [...edges.values()]
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),

    evidence:
      [...evidence.values()]
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),

    provenance:
      [...provenance.values()]
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),

    alternativeSets:
      predicateAlternativeSets(
        nodeList,
      ),
  };
}

export function summarizeCanonicalPredicateCandidateLatticePatchV1(
  patch: GraphPatchV1,
): CanonicalPredicateCandidateSummaryV1 {
  const predicateNodes =
    (patch.nodes ?? [])
      .filter(
        (node) =>
          node.type ===
            'predicate',
      );

  const realizationEdges =
    (patch.edges ?? [])
      .filter(
        (edge) =>
          edge.relation ===
            'predicate_realized_by',
      );

  const allFacts = [
    ...(patch.nodes ?? []),
    ...(patch.edges ?? []),
  ];

  return {
    producer:
      CANONICAL_PREDICATE_CANDIDATE_LATTICE_PRODUCER_V1,

    producerVersion:
      CANONICAL_PREDICATE_CANDIDATE_LATTICE_VERSION_V1,

    predicateNodes:
      predicateNodes.length,

    realizationEdges:
      realizationEdges.length,

    alternativeSets:
      (patch.alternativeSets ?? [])
        .length,

    resolvedFacts:
      allFacts.filter(
        (fact) =>
          fact.status ===
            'resolved',
      ).length,

    rejectedFacts:
      allFacts.filter(
        (fact) =>
          fact.status ===
            'rejected',
      ).length,
  };
}
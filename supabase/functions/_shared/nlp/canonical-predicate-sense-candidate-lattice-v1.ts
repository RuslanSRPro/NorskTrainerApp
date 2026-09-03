// Norsk Trainer — Canonical Predicate Sense Candidate Lattice V1
//
// v1.44 Wave B A1
//
// Generic mechanics only.
//
// This producer DOES NOT know:
//   - Norwegian auxiliary lemmas;
//   - copula lemmas;
//   - modal lemmas;
//   - lexical_main heuristics;
//   - valency;
//   - predicative complements;
//   - TAM;
//   - clause structure.
//
// It receives already source-backed contextual evidence facts and turns
// them into candidate predicate-sense alternatives.
//
// One structural predicate occurrence remains ONE predicate node.
// Functional senses are represented as semantic_unit candidates:
//
//   semantic_unit(predicate_sense)
//       └── sense_of → predicate
//
// Candidate != resolved.
// A singleton sense alternative is never auto-resolved.

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1 =
  'canonical_predicate_sense_candidate_lattice_v1';

export const CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_VERSION_V1 =
  '1';

export type CanonicalPredicateSenseEvidenceKindV1 =
  | 'lexical_class'
  | 'construction'
  | 'source_pattern'
  | 'constraint'
  | string;

export type CanonicalPredicateSenseEvidenceFactV1 = {
  // Stable identity of this evidence assertion.
  id: string;

  // Exact structural predicate occurrence this evidence concerns.
  predicateId: string;

  // Exact canonical predicate head occurrence.
  //
  // This prevents lemma/class evidence for one token from leaking into
  // another predicate occurrence.
  headTokenId: string;

  // Opaque sense label supplied by a read-only adapter.
  //
  // The generic producer does not enumerate or interpret sense labels.
  sense: string;

  evidenceKind: CanonicalPredicateSenseEvidenceKindV1;

  // Evidence facts themselves may still be uncertain.
  status:
    | 'candidate'
    | 'resolved'
    | 'ambiguous'
    | 'blocked'
    | 'rejected';

  // Build/control-plane source provenance.
  sourceCandidateCodes?: string[];
  sourceSections?: string[];

  // Lexicon / lexical-class / construction identities that supplied
  // contextual evidence.
  sourceIds?: string[];

  evidenceIds?: string[];
  provenanceIds?: string[];

  payload?: Record<string, unknown>;
};

export type CanonicalPredicateSenseCandidateSummaryV1 = {
  producer:
    typeof CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1;

  producerVersion:
    typeof CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_VERSION_V1;

  senseNodes: number;
  senseEdges: number;
  alternativeSets: number;

  predicatesWithSenseCandidates: number;

  resolvedFacts: number;
  rejectedFacts: number;
};

type SenseAccumulator = {
  predicate:
    LanguageGraphNodeV1;

  sense:
    string;

  headTokenId:
    string;

  facts:
    CanonicalPredicateSenseEvidenceFactV1[];
};

function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
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
  status: string,
): boolean {
  return status !== 'rejected' &&
    status !== 'blocked';
}

function predicateHeadTokenId(
  predicate: LanguageGraphNodeV1,
): string | undefined {
  return stringValue(
    predicate.features.anchorHeadId,
  );
}

function graphNodeById(
  graph: CanonicalLanguageGraphV1,
  id: string,
): LanguageGraphNodeV1 | undefined {
  return graph.nodes.find(
    (node) =>
      node.id === id,
  );
}

function exactPredicate(
  graph: CanonicalLanguageGraphV1,
  fact: CanonicalPredicateSenseEvidenceFactV1,
): LanguageGraphNodeV1 | undefined {
  const predicate =
    graphNodeById(
      graph,
      fact.predicateId,
    );

  if (
    !predicate ||
    predicate.type !== 'predicate' ||
    !usableStatus(predicate.status)
  ) {
    return undefined;
  }

  const canonicalHeadId =
    predicateHeadTokenId(
      predicate,
    );

  if (
    !canonicalHeadId ||
    canonicalHeadId !==
      fact.headTokenId
  ) {
    return undefined;
  }

  const head =
    graphNodeById(
      graph,
      canonicalHeadId,
    );

  if (
    !head ||
    head.type !== 'token' ||
    !usableStatus(head.status)
  ) {
    return undefined;
  }

  return predicate;
}

function semanticProvenance(
  facts:
    readonly CanonicalPredicateSenseEvidenceFactV1[],
): LanguageGraphProvenanceV1[] {
  const out =
    new Map<
      string,
      LanguageGraphProvenanceV1
    >();

  for (const fact of facts) {
    for (
      const sourceCode of
        unique(
          fact.sourceCandidateCodes ?? [],
        ).sort()
    ) {
      const id =
        `prov:${CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1}` +
        `:source_rule:${idPart(sourceCode)}`;

      out.set(
        id,
        {
          id,

          sourceType:
            'source_rule',

          sourceId:
            sourceCode,

          payload: {
            sourceSections:
              unique(
                fact.sourceSections ?? [],
              ).sort(),

            frozenGrammarReadOnly:
              true,
          },
        },
      );
    }

    for (
      const sourceId of
        unique(
          fact.sourceIds ?? [],
        ).sort()
    ) {
      const id =
        `prov:${CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1}` +
        `:evidence_source:${idPart(sourceId)}`;

      out.set(
        id,
        {
          id,

          sourceType:
            fact.evidenceKind ===
                'lexical_class'
              ? 'lexicon'
              : 'runtime_fact',

          sourceId,

          payload: {
            evidenceKind:
              fact.evidenceKind,

            candidateOnly:
              true,
          },
        },
      );
    }
  }

  return [...out.values()]
    .sort((a, b) =>
      a.id.localeCompare(b.id)
    );
}

function senseAlternativeSets(
  nodes:
    readonly LanguageGraphNodeV1[],
): LanguageGraphAlternativeSetV1[] {
  const byPredicate =
    new Map<string, string[]>();

  for (const node of nodes) {
    if (
      node.type !== 'semantic_unit' ||
      node.subtype !== 'predicate_sense'
    ) {
      continue;
    }

    const predicateId =
      stringValue(
        node.features.predicateId,
      );

    if (!predicateId) {
      continue;
    }

    const members =
      byPredicate.get(
        predicateId,
      ) ?? [];

    members.push(
      node.id,
    );

    byPredicate.set(
      predicateId,
      members,
    );
  }

  return [...byPredicate.entries()]
    .sort(([a], [b]) =>
      a.localeCompare(b)
    )
    .map(
      ([predicateId, memberIds]) => ({
        id:
          `alt:predicate_sense:${idPart(predicateId)}`,

        memberIds:
          unique(
            memberIds,
          ).sort(),

        resolvedMemberIds:
          [],

        status:
          'open' as const,

        reason:
          'predicate_sense_candidates_wait_for_contextual_evidence',
      }),
    );
}

export function buildCanonicalPredicateSenseCandidateLatticePatchV1(
  graph: CanonicalLanguageGraphV1,
  evidenceFacts:
    readonly CanonicalPredicateSenseEvidenceFactV1[],
): GraphPatchV1 {
  const producer =
    CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1;

  const producerVersion =
    CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_VERSION_V1;

  // ------------------------------------------------------------------
  // 1. Validate occurrence anchoring and group support by
  //    predicate + sense.
  // ------------------------------------------------------------------

  const groups =
    new Map<
      string,
      SenseAccumulator
    >();

  for (
    const fact of
      [...evidenceFacts]
        .sort((a, b) =>
          a.id.localeCompare(
            b.id,
          )
        )
  ) {
    const sense =
      stringValue(
        fact.sense,
      );

    const headTokenId =
      stringValue(
        fact.headTokenId,
      );

    if (
      !sense ||
      !headTokenId ||
      !stringValue(fact.id) ||
      !usableStatus(fact.status)
    ) {
      continue;
    }

    const predicate =
      exactPredicate(
        graph,
        fact,
      );

    if (!predicate) {
      continue;
    }

    const key =
      `${predicate.id}|${sense}`;

    const existing =
      groups.get(key);

    if (existing) {
      existing.facts.push(
        fact,
      );

      continue;
    }

    groups.set(
      key,
      {
        predicate,
        sense,
        headTokenId,
        facts: [
          fact,
        ],
      },
    );
  }

  // ------------------------------------------------------------------
  // 2. Emit exactly one semantic candidate per
  //    predicate occurrence + sense.
  // ------------------------------------------------------------------

  const nodes:
    LanguageGraphNodeV1[] = [];

  const edges:
    LanguageGraphEdgeV1[] = [];

  const evidence:
    LanguageGraphEvidenceV1[] = [];

  const provenance =
    new Map<
      string,
      LanguageGraphProvenanceV1
    >();

  for (
    const [, group] of
      [...groups.entries()]
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
  ) {
    const predicate =
      group.predicate;

    const headNode =
      graphNodeById(
        graph,
        group.headTokenId,
      );

    if (
      !headNode ||
      headNode.type !== 'token'
    ) {
      continue;
    }

    const candidateId = [
      'semanticcand',
      'predicate_sense',
      idPart(predicate.id),
      idPart(group.sense),
    ].join(':');

    const senseEdgeId =
      `edge:sense_of:${idPart(candidateId)}:${idPart(predicate.id)}`;

    const generatedProvenance =
      semanticProvenance(
        group.facts,
      );

    for (
      const item of
        generatedProvenance
    ) {
      provenance.set(
        item.id,
        item,
      );
    }

    const factProvenanceIds =
      unique(
        group.facts.flatMap(
          (fact) =>
            fact.provenanceIds ?? [],
        ),
      );

    const provenanceIds =
      unique([
        ...predicate.provenanceIds,

        ...factProvenanceIds,

        ...generatedProvenance.map(
          (item) =>
            item.id,
        ),
      ]).sort();

    const supportEvidenceIds:
      string[] = [];

    for (
      const fact of
        [...group.facts]
          .sort((a, b) =>
            a.id.localeCompare(
              b.id,
            )
          )
    ) {
      const evidenceId =
        `evidence:${producer}:${idPart(fact.id)}:${idPart(candidateId)}`;

      supportEvidenceIds.push(
        evidenceId,
      );

      const sourceCandidateCodes =
        unique(
          fact.sourceCandidateCodes ?? [],
        ).sort();

      const sourceSections =
        unique(
          fact.sourceSections ?? [],
        ).sort();

      const sourceIds =
        unique(
          fact.sourceIds ?? [],
        ).sort();

      evidence.push({
        id:
          evidenceId,

        kind:
          fact.evidenceKind ===
              'lexical_class'
            ? 'lexical'
            : fact.evidenceKind ===
                'construction'
            ? 'structural'
            : 'source_rule',

        status:
          'supports',

        targetIds: [
          candidateId,
          senseEdgeId,
        ],

        payload: {
          evidenceFactId:
            fact.id,

          evidenceKind:
            fact.evidenceKind,

          predicateId:
            predicate.id,

          headTokenId:
            group.headTokenId,

          sense:
            group.sense,

          evidenceStatus:
            fact.status,

          sourceCandidateCodes,

          sourceSections,

          sourceIds,

          candidateOnly:
            true,

          ...(fact.payload ?? {}),
        },

        producer,

        provenanceIds:
          unique([
            ...provenanceIds,
            ...(fact.provenanceIds ?? []),
          ]).sort(),
      });
    }

    const node:
      LanguageGraphNodeV1 = {
      id:
        candidateId,

      type:
        'semantic_unit',

      subtype:
        'predicate_sense',

      status:
        'candidate',

      // Functional sense belongs to the exact verb occurrence.
      span:
        headNode.span
          ? { ...headNode.span }
          : undefined,

      features: {
        semanticUnitType:
          'predicate_sense',

        predicateId:
          predicate.id,

        headTokenId:
          group.headTokenId,

        sense:
          group.sense,

        supportFactIds:
          group.facts
            .map(
              (fact) =>
                fact.id,
            )
            .sort(),

        evidenceKinds:
          unique(
            group.facts.map(
              (fact) =>
                fact.evidenceKind,
            ),
          ).sort(),

        sourceCandidateCodes:
          unique(
            group.facts.flatMap(
              (fact) =>
                fact.sourceCandidateCodes ?? [],
            ),
          ).sort(),

        sourceIds:
          unique(
            group.facts.flatMap(
              (fact) =>
                fact.sourceIds ?? [],
            ),
          ).sort(),

        candidateGeneration:
          'contextual_predicate_sense_evidence',

        resolutionPolicy:
          'candidate_only',

        absenceOfOtherSenseEvidenceIsNotRejection:
          true,

        frozenGrammarReadOnly:
          true,
      },

      producer,

      evidenceIds:
        [...supportEvidenceIds]
          .sort(),

      provenanceIds,
    };

    const edge:
      LanguageGraphEdgeV1 = {
      id:
        senseEdgeId,

      relation:
        'sense_of',

      sourceId:
        candidateId,

      targetId:
        predicate.id,

      status:
        'candidate',

      features: {
        sense:
          group.sense,

        headTokenId:
          group.headTokenId,

        candidateOnly:
          true,
      },

      producer,

      evidenceIds:
        [...supportEvidenceIds]
          .sort(),

      provenanceIds,
    };

    nodes.push(
      node,
    );

    edges.push(
      edge,
    );
  }

  nodes.sort(
    (a, b) =>
      a.id.localeCompare(b.id),
  );

  edges.sort(
    (a, b) =>
      a.id.localeCompare(b.id),
  );

  evidence.sort(
    (a, b) =>
      a.id.localeCompare(b.id),
  );

  return {
    producer,
    producerVersion,

    nodes,

    edges,

    evidence,

    provenance:
      [...provenance.values()]
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),

    alternativeSets:
      senseAlternativeSets(
        nodes,
      ),
  };
}

export function summarizeCanonicalPredicateSenseCandidateLatticePatchV1(
  patch: GraphPatchV1,
): CanonicalPredicateSenseCandidateSummaryV1 {
  const senseNodes =
    (patch.nodes ?? [])
      .filter(
        (node) =>
          node.type ===
            'semantic_unit' &&
          node.subtype ===
            'predicate_sense',
      );

  const senseEdges =
    (patch.edges ?? [])
      .filter(
        (edge) =>
          edge.relation ===
            'sense_of',
      );

  const allFacts = [
    ...(patch.nodes ?? []),
    ...(patch.edges ?? []),
  ];

  const predicates =
    new Set(
      senseNodes
        .map(
          (node) =>
            stringValue(
              node.features.predicateId,
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    );

  return {
    producer:
      CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_PRODUCER_V1,

    producerVersion:
      CANONICAL_PREDICATE_SENSE_CANDIDATE_LATTICE_VERSION_V1,

    senseNodes:
      senseNodes.length,

    senseEdges:
      senseEdges.length,

    alternativeSets:
      (patch.alternativeSets ?? [])
        .length,

    predicatesWithSenseCandidates:
      predicates.size,

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
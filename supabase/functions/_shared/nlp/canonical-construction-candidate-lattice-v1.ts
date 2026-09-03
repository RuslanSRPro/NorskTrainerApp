// Norsk Trainer — Canonical Construction Candidate Lattice V1 (v1.44)
//
// Generic candidate generation for construction-shaped source knowledge.
//
// IMPORTANT:
// - imported/source-verified grammar is read-only input;
// - this producer defines no Norwegian grammar;
// - it does not mutate Grammar KB, Runtime Rules, morphology, POS or phrases;
// - it does not resolve construction candidates;
// - ordering, attachment and semantic interpretation remain downstream concerns.

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  GraphSpanV1,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1 =
  'canonical_construction_candidate_lattice_v1';

export const CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_VERSION_V1 = '1';

type Json = Record<string, unknown>;

export type CanonicalConstructionBindingV1 = {
  scope?: string;
  entity?: string;
  cardinality?: string;

  // Optional execution-level POS guard.
  //
  // This is supplied by a projection adapter from canonical registry data.
  // It is not a Norwegian-language rule.
  required_pos?: string;

  where?: unknown;
  [key: string]: unknown;
};

// This is an execution projection over frozen grammar knowledge.
// It is NOT a new grammar rule and is NOT persisted back into Grammar KB.
export type CanonicalConstructionProjectionV1 = {
  projectionId: string;
  projectionCode: string;

  constructionType: string;
  executionRole?: string;

  bindings: Record<string, CanonicalConstructionBindingV1>;

  // Named member slots consumed by the generic operator.
  memberRefs: string[];

  // Used only to group structural alternatives.
  anchorRef?: string;

  constraintStrength?: string;

  // Must point back to frozen source knowledge.
  sourceCandidateCodes: string[];
  sourceSections?: string[];

  // Optional immutable snapshot identity supplied by a DB adapter.
  sourceSnapshotId?: string;
};

export type CanonicalConstructionCandidateOptionsV1 = {
  // Operational safety bounds only. They are not linguistic rules.
  maxCandidatesPerSentence?: number;
  maxAssignmentsPerProjection?: number;

  // Generic construction slots normally represent separate members.
  // A projection may explicitly opt into shared-token roles if required.
  allowSharedMemberToken?: boolean;
};

export type CanonicalConstructionCandidateSummaryV1 = {
  producer: typeof CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1;
  producerVersion:
    typeof CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_VERSION_V1;

  constructionNodes: number;
  constructionTypes: Record<string, number>;

  candidateEdges: number;
  memberEdges: number;
  alternativeSets: number;
  singletonAlternativeSets: number;

  resolvedFacts: number;
  rejectedFacts: number;
};

type TokenInfo = {
  id: string;
  sentenceIndex: number;
  sentenceTokenIndex: number;
  documentTokenIndex: number;
  startUtf16?: number;
  endUtf16?: number;
};

type MorphFeatureConstraint = {
  key: string;
  value: string;
};

type BindingSpec =
  | {
      ref: string;
      kind: 'pos';
      pos: string;
    }
  | {
      ref: string;
      kind: 'morph_features';
      features: MorphFeatureConstraint[];
      requiredPos?: string;
    };

type BoundCandidate = {
  ref: string;
  node: LanguageGraphNodeV1;
  tokenId: string;
};

type Assignment = Map<string, BoundCandidate>;

type ConstructionBuild = {
  node: LanguageGraphNodeV1;
  edges: LanguageGraphEdgeV1[];
  evidence: LanguageGraphEvidenceV1;
  provenance: LanguageGraphProvenanceV1[];
};

const DEFAULT_MAX_CANDIDATES_PER_SENTENCE = 512;
const DEFAULT_MAX_ASSIGNMENTS_PER_PROJECTION = 2048;

function asRecord(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Json
    : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function normalizedLabel(value: unknown): string | undefined {
  const v = stringValue(value);
  return v?.normalize('NFC').toLocaleLowerCase('nb-NO');
}

function idPart(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '_');
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function tokenMap(
  graph: CanonicalLanguageGraphV1,
): Map<string, TokenInfo> {
  const out = new Map<string, TokenInfo>();

  for (const node of graph.nodes) {
    if (node.type !== 'token') continue;

    const sentenceIndex = numberValue(node.features.sentenceIndex);
    const sentenceTokenIndex =
      numberValue(node.features.sentenceTokenIndex);
    const documentTokenIndex =
      numberValue(node.features.documentTokenIndex);

    if (
      sentenceIndex === undefined ||
      sentenceTokenIndex === undefined ||
      documentTokenIndex === undefined
    ) {
      continue;
    }

    out.set(node.id, {
      id: node.id,
      sentenceIndex,
      sentenceTokenIndex,
      documentTokenIndex,
      startUtf16: node.span?.startUtf16,
      endUtf16: node.span?.endUtf16,
    });
  }

  return out;
}

function tokenIdFromNode(
  node: LanguageGraphNodeV1,
): string | undefined {
  const tokenIds = node.span?.tokenIds ?? [];

  if (tokenIds.length === 1) {
    return tokenIds[0];
  }

  if (
    node.span?.startTokenId &&
    node.span.startTokenId === node.span.endTokenId
  ) {
    return node.span.startTokenId;
  }

  return undefined;
}

function featureAssignment(
  value: unknown,
): MorphFeatureConstraint | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;

  const separator = raw.indexOf('=');

  if (
    separator <= 0 ||
    separator >= raw.length - 1
  ) {
    return undefined;
  }

  const key = raw.slice(0, separator).trim();
  const featureValue = raw.slice(separator + 1).trim();

  if (!key || !featureValue) return undefined;

  return {
    key,
    value: featureValue,
  };
}

function morphFeatureConstraint(
  expression: unknown,
  bindingRef: string,
): MorphFeatureConstraint | undefined {
  const item = asRecord(expression);

  if (normalizedLabel(item.op) !== 'has_feature') {
    return undefined;
  }

  const left = asRecord(item.left);

  if (
    stringValue(left.ref) !== `${bindingRef}.morph`
  ) {
    return undefined;
  }

  return featureAssignment(item.right);
}

function bindingSpec(
  projection: CanonicalConstructionProjectionV1,
  bindingRef: string,
): BindingSpec | undefined {
  const binding = projection.bindings[bindingRef];
  if (!binding) return undefined;

  const where = asRecord(binding.where);
  const requiredPos =
    normalizedLabel(binding.required_pos);

  // Existing Runtime IR Boolean convention:
  //
  // where:
  //   all:
  //     - has_feature(...)
  //     - has_feature(...)
  const all = Array.isArray(where.all)
    ? where.all
    : undefined;

  if (all) {
    if (all.length === 0) return undefined;

    const features = all.map((expression) =>
      morphFeatureConstraint(expression, bindingRef)
    );

    if (features.some((feature) => !feature)) {
      return undefined;
    }

    return {
      ref: bindingRef,
      kind: 'morph_features',
      features: features as MorphFeatureConstraint[],
      requiredPos,
    };
  }

  const op = normalizedLabel(where.op);
  const left = asRecord(where.left);
  const ref = stringValue(left.ref);

  if (!ref) return undefined;

  if (
    op === 'eq' &&
    ref === `${bindingRef}.pos`
  ) {
    const pos = normalizedLabel(where.right);
    if (!pos) return undefined;

    return {
      ref: bindingRef,
      kind: 'pos',
      pos,
    };
  }

  if (
    op === 'has_feature' &&
    ref === `${bindingRef}.morph`
  ) {
    const feature = featureAssignment(where.right);
    if (!feature) return undefined;

    return {
      ref: bindingRef,
      kind: 'morph_features',
      features: [feature],
      requiredPos,
    };
  }

  return undefined;
}

function bindingCandidates(
  graph: CanonicalLanguageGraphV1,
  tokens: Map<string, TokenInfo>,
  spec: BindingSpec,
): BoundCandidate[] {
  const out: BoundCandidate[] = [];

  for (const node of graph.nodes) {
    if (
      node.status === 'rejected' ||
      node.status === 'blocked'
    ) {
      continue;
    }

    const tokenId = tokenIdFromNode(node);
    if (!tokenId || !tokens.has(tokenId)) continue;

    if (spec.kind === 'pos') {
      if (node.type !== 'lexical_reading') continue;

      if (
        node.subtype !== 'pos_candidate' &&
        node.subtype !== 'pos'
      ) {
        continue;
      }

      if (
        normalizedLabel(node.features.pos) !== spec.pos
      ) {
        continue;
      }

      out.push({
        ref: spec.ref,
        node,
        tokenId,
      });

      continue;
    }

    if (node.type !== 'morph_reading') continue;

    if (spec.requiredPos) {
      const actualPos =
        normalizedLabel(node.features.pos) ??
        normalizedLabel(node.subtype);

      if (actualPos !== spec.requiredPos) {
        continue;
      }
    }

    const canonicalFeatures =
      asRecord(node.features.canonicalFeatures);

    const matchesAll = spec.features.every((feature) => {
      const actual = canonicalFeatures[feature.key];

      return actual !== undefined &&
        String(actual) === feature.value;
    });

    if (!matchesAll) continue;

    out.push({
      ref: spec.ref,
      node,
      tokenId,
    });
  }

  return out.sort((a, b) =>
    a.node.id.localeCompare(b.node.id)
  );
}

function graphSpanForMemberTokens(
  tokenIds: readonly string[],
  tokens: Map<string, TokenInfo>,
): GraphSpanV1 | undefined {
  const uniqueIds = unique(tokenIds);

  const infos = uniqueIds
    .map((id) => tokens.get(id))
    .filter((item): item is TokenInfo => Boolean(item))
    .sort(
      (a, b) =>
        a.sentenceTokenIndex - b.sentenceTokenIndex ||
        a.id.localeCompare(b.id),
    );

  if (
    infos.length === 0 ||
    infos.length !== uniqueIds.length
  ) {
    return undefined;
  }

  const sentenceIndex = infos[0].sentenceIndex;

  if (
    infos.some(
      (token) => token.sentenceIndex !== sentenceIndex,
    )
  ) {
    return undefined;
  }

  return {
    startTokenId: infos[0].id,
    endTokenId: infos[infos.length - 1].id,

    // Only actual construction members are stored here.
    // Surface material between them is not silently claimed.
    tokenIds: infos.map((token) => token.id),

    startUtf16: infos[0].startUtf16,
    endUtf16: infos[infos.length - 1].endUtf16,
  };
}

function projectionProvenance(
  projection: CanonicalConstructionProjectionV1,
): LanguageGraphProvenanceV1[] {
  const runtimeId =
    `prov:${CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1}` +
    `:runtime_projection:${idPart(projection.projectionCode)}`;

  const out: LanguageGraphProvenanceV1[] = [{
    id: runtimeId,
    sourceType: 'runtime_fact',
    sourceId: projection.projectionCode,
    payload: {
      projectionId: projection.projectionId,
      executionRole: projection.executionRole ?? null,
      constructionType: projection.constructionType,
      sourceSnapshotId: projection.sourceSnapshotId ?? null,

      // Explicit architectural invariant.
      frozenGrammarReadOnly: true,
    },
  }];

  const sourceCodes =
    unique(projection.sourceCandidateCodes).sort();

  for (const code of sourceCodes) {
    out.push({
      id:
        `prov:${CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1}` +
        `:source_rule:${idPart(code)}`,

      sourceType: 'source_rule',
      sourceId: code,

      payload: {
        sourceSections: [
          ...(projection.sourceSections ?? []),
        ],
        frozenGrammarReadOnly: true,
      },
    });
  }

  return out;
}

function buildConstructionCandidate(
  projection: CanonicalConstructionProjectionV1,
  assignment: Assignment,
  tokens: Map<string, TokenInfo>,
): ConstructionBuild | undefined {
  const type = stringValue(projection.constructionType);

  if (!type) return undefined;

  const members = projection.memberRefs.map((ref) => {
    const candidate = assignment.get(ref);

    return candidate
      ? {
          ref,
          candidate,
        }
      : undefined;
  });

  if (members.some((member) => !member)) {
    return undefined;
  }

  const concreteMembers = members.filter(
    (member): member is {
      ref: string;
      candidate: BoundCandidate;
    } => Boolean(member),
  );

  const memberTokenIds = concreteMembers.map(
    (member) => member.candidate.tokenId,
  );

  const span = graphSpanForMemberTokens(
    memberTokenIds,
    tokens,
  );

  if (!span) return undefined;

  const firstToken = tokens.get(
    span.startTokenId ?? '',
  );

  if (!firstToken) return undefined;

  const memberNodeIds: Record<string, string> = {};
  const memberTokensByRef: Record<string, string> = {};

  for (const member of concreteMembers) {
    memberNodeIds[member.ref] =
      member.candidate.node.id;

    memberTokensByRef[member.ref] =
      member.candidate.tokenId;
  }

  const anchorRef =
    projection.anchorRef &&
      assignment.has(projection.anchorRef)
      ? projection.anchorRef
      : undefined;

  const anchorNodeId = anchorRef
    ? assignment.get(anchorRef)?.node.id
    : undefined;

  const anchorTokenId = anchorRef
    ? assignment.get(anchorRef)?.tokenId
    : undefined;

  const assignmentIdentity = projection.memberRefs
    .map((ref) =>
      `${idPart(ref)}=${idPart(memberNodeIds[ref])}`
    )
    .join('+');

  const candidateId = [
    'constructioncand',
    idPart(type),
    idPart(projection.projectionCode),
    assignmentIdentity,
  ].join(':');

  const newProvenance =
    projectionProvenance(projection);

  const provenanceIds = unique([
    ...concreteMembers.flatMap(
      (member) =>
        member.candidate.node.provenanceIds,
    ),
    ...newProvenance.map(
      (provenance) => provenance.id,
    ),
  ]);

  const evidenceId =
    `evidence:${CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1}` +
    `:${candidateId}`;

  const node: LanguageGraphNodeV1 = {
    id: candidateId,
    type: 'construction',
    subtype: type,
    status: 'candidate',
    span,

    features: {
      constructionType: type,
      sentenceIndex: firstToken.sentenceIndex,

      projectionId: projection.projectionId,
      projectionCode: projection.projectionCode,
      executionRole: projection.executionRole ?? null,

      memberRefs: [...projection.memberRefs],
      memberNodeIds,
      memberTokenIds: memberTokensByRef,

      anchorRef: anchorRef ?? null,
      anchorNodeId: anchorNodeId ?? null,
      anchorTokenId: anchorTokenId ?? null,

      constraintStrength:
        projection.constraintStrength ?? null,

      sourceCandidateCodes: [
        ...projection.sourceCandidateCodes,
      ],

      sourceSections: [
        ...(projection.sourceSections ?? []),
      ],

      sourceSnapshotId:
        projection.sourceSnapshotId ?? null,

      candidateGeneration:
        'frozen_grammar_runtime_projection',

      frozenGrammarReadOnly: true,
      resolutionPolicy: 'candidate_only',
    },

    producer:
      CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1,

    evidenceIds: [evidenceId],
    provenanceIds,
  };

  const edges: LanguageGraphEdgeV1[] =
    concreteMembers.map((member) => ({
      id: [
        'edge',
        'construction_member_of',
        idPart(member.ref),
        idPart(member.candidate.node.id),
        idPart(candidateId),
      ].join(':'),

      relation: 'construction_member_of',

      // Preserve the exact candidate reading that satisfied
      // this construction slot.
      sourceId: member.candidate.node.id,
      targetId: candidateId,

      status: 'candidate',

      features: {
        roleRef: member.ref,
        memberTokenId:
          member.candidate.tokenId,
      },

      producer:
        CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1,

      evidenceIds: [evidenceId],
      provenanceIds,
    }));

  const evidence: LanguageGraphEvidenceV1 = {
    id: evidenceId,
    kind: 'source_rule',
    status: 'supports',

    targetIds: [
      node.id,
      ...edges.map((edge) => edge.id),
    ],

    payload: {
      projectionId: projection.projectionId,
      projectionCode: projection.projectionCode,
      constructionType: type,

      memberRefs: [...projection.memberRefs],
      memberNodeIds,
      memberTokenIds: memberTokensByRef,

      constraintStrength:
        projection.constraintStrength ?? null,

      sourceCandidateCodes: [
        ...projection.sourceCandidateCodes,
      ],

      sourceSections: [
        ...(projection.sourceSections ?? []),
      ],

      sourceSnapshotId:
        projection.sourceSnapshotId ?? null,

      frozenGrammarReadOnly: true,
      resolutionPolicy: 'candidate_only',
    },

    producer:
      CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1,

    provenanceIds,
  };

  return {
    node,
    edges,
    evidence,
    provenance: newProvenance,
  };
}

function enumerateAssignments(
  memberRefs: readonly string[],
  candidatesByRef: Map<string, BoundCandidate[]>,
  tokens: Map<string, TokenInfo>,
  allowSharedMemberToken: boolean,
  maxAssignments: number,
): Assignment[] {
  const out: Assignment[] = [];

  const walk = (
    index: number,
    assignment: Assignment,
    sentenceIndex: number | undefined,
  ) => {
    if (out.length >= maxAssignments) return;

    if (index >= memberRefs.length) {
      out.push(new Map(assignment));
      return;
    }

    const ref = memberRefs[index];

    for (const candidate of candidatesByRef.get(ref) ?? []) {
      if (out.length >= maxAssignments) break;

      const token = tokens.get(candidate.tokenId);
      if (!token) continue;

      if (
        sentenceIndex !== undefined &&
        token.sentenceIndex !== sentenceIndex
      ) {
        continue;
      }

      // The same graph interpretation cannot fill two construction slots.
      if (
        [...assignment.values()].some(
          (existing) =>
            existing.node.id === candidate.node.id,
        )
      ) {
        continue;
      }

      if (
        !allowSharedMemberToken &&
        [...assignment.values()].some(
          (existing) =>
            existing.tokenId === candidate.tokenId,
        )
      ) {
        continue;
      }

      assignment.set(ref, candidate);

      walk(
        index + 1,
        assignment,
        sentenceIndex ?? token.sentenceIndex,
      );

      assignment.delete(ref);
    }
  };

  walk(
    0,
    new Map<string, BoundCandidate>(),
    undefined,
  );

  return out;
}

function alternativeSetsForConstructions(
  nodes: readonly LanguageGraphNodeV1[],
): LanguageGraphAlternativeSetV1[] {
  const groups = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.type !== 'construction') continue;

    const constructionType =
      stringValue(node.subtype);

    const sentenceIndex =
      numberValue(node.features.sentenceIndex);

    if (
      !constructionType ||
      sentenceIndex === undefined
    ) {
      continue;
    }

    const anchorNodeId =
      stringValue(node.features.anchorNodeId);

    // With an explicit anchor, structural alternatives sharing
    // that anchor remain in one open alternative set.
    //
    // Without one, the candidate receives its own open set.
    const key = anchorNodeId
      ? `${sentenceIndex}|${constructionType}|${anchorNodeId}`
      : `${sentenceIndex}|${constructionType}|${node.id}`;

    const members = groups.get(key) ?? [];
    members.push(node.id);
    groups.set(key, members);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, memberIds]) => ({
      id: `alt:construction:${idPart(key)}`,
      memberIds: unique(memberIds).sort(),
      resolvedMemberIds: [],
      status: 'open' as const,
      reason:
        'canonical_construction_candidates_wait_for_evidence',
    }));
}

export function buildCanonicalConstructionCandidateLatticePatchV1(
  graph: CanonicalLanguageGraphV1,
  projections:
    readonly CanonicalConstructionProjectionV1[],
  options: CanonicalConstructionCandidateOptionsV1 = {},
): GraphPatchV1 {
  const producer =
    CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1;

  const producerVersion =
    CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_VERSION_V1;

  const tokens = tokenMap(graph);

  const maxPerSentence = Math.max(
    1,
    Math.floor(
      options.maxCandidatesPerSentence ??
        DEFAULT_MAX_CANDIDATES_PER_SENTENCE,
    ),
  );

  const maxAssignments = Math.max(
    1,
    Math.floor(
      options.maxAssignmentsPerProjection ??
        DEFAULT_MAX_ASSIGNMENTS_PER_PROJECTION,
    ),
  );

  const allowSharedMemberToken =
    options.allowSharedMemberToken ?? false;

  const nodes =
    new Map<string, LanguageGraphNodeV1>();

  const edges =
    new Map<string, LanguageGraphEdgeV1>();

  const evidence =
    new Map<string, LanguageGraphEvidenceV1>();

  const provenance =
    new Map<string, LanguageGraphProvenanceV1>();

  const candidateCountBySentence =
    new Map<number, number>();

  const executableProjections = [...projections]
    .filter((projection) =>
      Boolean(
        stringValue(projection.projectionCode) &&
        stringValue(projection.constructionType) &&
        projection.memberRefs.length > 0 &&
        projection.sourceCandidateCodes.length > 0
      )
    )
    .sort((a, b) =>
      a.projectionCode.localeCompare(
        b.projectionCode,
      )
    );

  for (const projection of executableProjections) {
    const memberRefs =
      unique(projection.memberRefs);

    if (
      memberRefs.length !==
        projection.memberRefs.length
    ) {
      continue;
    }

    const candidatesByRef =
      new Map<string, BoundCandidate[]>();

    let executable = true;

    for (const ref of memberRefs) {
      const spec = bindingSpec(projection, ref);

      if (!spec) {
        executable = false;
        break;
      }

      const candidates =
        bindingCandidates(graph, tokens, spec);

      if (candidates.length === 0) {
        executable = false;
        break;
      }

      candidatesByRef.set(ref, candidates);
    }

    if (!executable) continue;

    const assignments = enumerateAssignments(
      memberRefs,
      candidatesByRef,
      tokens,
      allowSharedMemberToken,
      maxAssignments,
    );

    for (const assignment of assignments) {
      const build = buildConstructionCandidate(
        projection,
        assignment,
        tokens,
      );

      if (!build) continue;

      const sentenceIndex =
        numberValue(
          build.node.features.sentenceIndex,
        );

      if (sentenceIndex === undefined) continue;

      const current =
        candidateCountBySentence.get(
          sentenceIndex,
        ) ?? 0;

      if (current >= maxPerSentence) {
        continue;
      }

      if (nodes.has(build.node.id)) continue;

      nodes.set(build.node.id, build.node);

      candidateCountBySentence.set(
        sentenceIndex,
        current + 1,
      );

      for (const edge of build.edges) {
        edges.set(edge.id, edge);
      }

      evidence.set(
        build.evidence.id,
        build.evidence,
      );

      for (const item of build.provenance) {
        provenance.set(item.id, item);
      }
    }
  }

  const nodeList = [...nodes.values()]
    .sort((a, b) => a.id.localeCompare(b.id));

  const edgeList = [...edges.values()]
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    producer,
    producerVersion,
    nodes: nodeList,
    edges: edgeList,

    evidence: [...evidence.values()]
      .sort((a, b) => a.id.localeCompare(b.id)),

    provenance: [...provenance.values()]
      .sort((a, b) => a.id.localeCompare(b.id)),

    alternativeSets:
      alternativeSetsForConstructions(nodeList),
  };
}

export function summarizeCanonicalConstructionCandidateLatticePatchV1(
  patch: GraphPatchV1,
): CanonicalConstructionCandidateSummaryV1 {
  const constructionNodes =
    (patch.nodes ?? []).filter(
      (node) => node.type === 'construction',
    );

  const constructionTypes: Record<string, number> = {};

  for (const node of constructionNodes) {
    const type = node.subtype ?? '<unknown>';

    constructionTypes[type] =
      (constructionTypes[type] ?? 0) + 1;
  }

  const edges = patch.edges ?? [];
  const allFacts = [
    ...(patch.nodes ?? []),
    ...edges,
  ];

  return {
    producer:
      CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_PRODUCER_V1,

    producerVersion:
      CANONICAL_CONSTRUCTION_CANDIDATE_LATTICE_VERSION_V1,

    constructionNodes:
      constructionNodes.length,

    constructionTypes,

    candidateEdges:
      edges.filter(
        (edge) => edge.status === 'candidate',
      ).length,

    memberEdges:
      edges.filter(
        (edge) =>
          edge.relation ===
            'construction_member_of',
      ).length,

    alternativeSets:
      (patch.alternativeSets ?? []).length,

    singletonAlternativeSets:
      (patch.alternativeSets ?? [])
        .filter(
          (set) => set.memberIds.length === 1,
        ).length,

    resolvedFacts:
      allFacts.filter(
        (fact) => fact.status === 'resolved',
      ).length,

    rejectedFacts:
      allFacts.filter(
        (fact) => fact.status === 'rejected',
      ).length,
  };
}
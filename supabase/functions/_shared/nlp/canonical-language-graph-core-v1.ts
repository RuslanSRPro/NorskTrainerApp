// Norsk Trainer — Canonical Language Graph Core V1
// One graph, multiple producers. No Norwegian grammar rules are defined here.

import type { CanonicalSurfaceDocumentV1, SurfaceTokenV1, SurfaceSentenceV1 } from './canonical-surface-boundary-v1.ts';

export type GraphStatus = 'candidate' | 'resolved' | 'rejected' | 'blocked' | 'ambiguous';
export type GraphNodeType =
  | 'document' | 'sentence' | 'token'
  | 'lexical_reading' | 'morph_reading'
  | 'span' | 'phrase' | 'mwe'
  | 'predicate' | 'clause' | 'construction'
  | 'semantic_unit' | 'rule_evidence';

export type GraphSpanV1 = {
  startTokenId?: string;
  endTokenId?: string;
  tokenIds?: string[];
  startUtf16?: number;
  endUtf16?: number;
};

export type LanguageGraphNodeV1 = {
  id: string;
  type: GraphNodeType;
  subtype?: string;
  status: GraphStatus;
  span?: GraphSpanV1;
  features: Record<string, unknown>;
  producer: string;
  evidenceIds: string[];
  provenanceIds: string[];
  supersedesIds?: string[];
};

export type LanguageGraphEdgeV1 = {
  id: string;
  relation: string;
  sourceId: string;
  targetId: string;
  status: GraphStatus;
  features: Record<string, unknown>;
  producer: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type LanguageGraphEvidenceV1 = {
  id: string;
  kind: 'surface' | 'lexical' | 'morphological' | 'structural' | 'constraint' | 'source_rule' | 'external';
  status: 'supports' | 'opposes' | 'neutral';
  targetIds: string[];
  payload: Record<string, unknown>;
  producer: string;
  provenanceIds: string[];
};

export type LanguageGraphProvenanceV1 = {
  id: string;
  sourceType: 'surface' | 'lexicon' | 'source_rule' | 'runtime_fact' | 'external_corpus' | 'system';
  sourceId?: string;
  payload?: Record<string, unknown>;
};

export type LanguageGraphAlternativeSetV1 = {
  id: string;
  memberIds: string[];
  resolvedMemberIds: string[];
  status: 'open' | 'resolved' | 'blocked';
  reason?: string;
};

export type LanguageGraphConstraintTraceV1 = {
  id: string;
  constraintCode: string;
  inputIds: string[];
  outcome: 'support' | 'reject' | 'block' | 'resolve' | 'no_change';
  affectedIds: string[];
  evidenceIds: string[];
  iteration: number;
  producer: string;
};

export type CanonicalLanguageGraphV1 = {
  version: 'canonical-language-graph-v1';
  documentId: string;
  surfaceVersion: 'canonical-surface-boundary-v1';
  nodes: LanguageGraphNodeV1[];
  edges: LanguageGraphEdgeV1[];
  evidence: LanguageGraphEvidenceV1[];
  provenance: LanguageGraphProvenanceV1[];
  alternativeSets: LanguageGraphAlternativeSetV1[];
  constraintTrace: LanguageGraphConstraintTraceV1[];
  producerState: Record<string, { version: string; status: 'not_run' | 'ran' | 'blocked'; factsAdded: number; factsRejected: number }>;
  invariants: {
    oneCanonicalGraph: true;
    stableSurfaceTokenIds: true;
    appendEvidenceDoNotReparseText: true;
    candidatesMayCoexist: true;
    resolvedFactsRequireEvidence: true;
    learnerErrorSeparateFromParserUncertainty: true;
  };
};

function sentenceSpan(s: SurfaceSentenceV1): GraphSpanV1 {
  return {
    startTokenId: s.startTokenId,
    endTokenId: s.endTokenId,
    tokenIds: [...s.tokenIds],
    startUtf16: s.startUtf16,
    endUtf16: s.endUtf16,
  };
}
function tokenSpan(t: SurfaceTokenV1): GraphSpanV1 {
  return {
    startTokenId: t.id,
    endTokenId: t.id,
    tokenIds: [t.id],
    startUtf16: t.startUtf16,
    endUtf16: t.endUtf16,
  };
}

export function createCanonicalLanguageGraphV1(surface: CanonicalSurfaceDocumentV1): CanonicalLanguageGraphV1 {
  const documentId = `document:0:0:${surface.textLengthUtf16}`;
  const provenance: LanguageGraphProvenanceV1[] = [
    { id: 'prov:surface:canonical-v1', sourceType: 'surface', payload: { surfaceVersion: surface.version } },
  ];
  const nodes: LanguageGraphNodeV1[] = [
    {
      id: documentId,
      type: 'document',
      status: 'resolved',
      span: { startUtf16: 0, endUtf16: surface.textLengthUtf16 },
      features: { textLengthUtf16: surface.textLengthUtf16 },
      producer: 'canonical_surface_adapter_v1',
      evidenceIds: [],
      provenanceIds: ['prov:surface:canonical-v1'],
    },
  ];
  const edges: LanguageGraphEdgeV1[] = [];

  for (const s of surface.sentences) {
    nodes.push({
      id: s.id,
      type: 'sentence',
      status: 'resolved',
      span: sentenceSpan(s),
      features: { sentenceIndex: s.index, boundaryCandidateId: s.boundaryCandidateId },
      producer: 'canonical_surface_adapter_v1',
      evidenceIds: [],
      provenanceIds: ['prov:surface:canonical-v1'],
    });
    edges.push({
      id: `edge:contains:${documentId}:${s.id}`,
      relation: 'contains',
      sourceId: documentId,
      targetId: s.id,
      status: 'resolved',
      features: {},
      producer: 'canonical_surface_adapter_v1',
      evidenceIds: [],
      provenanceIds: ['prov:surface:canonical-v1'],
    });
  }

  for (const t of surface.tokens) {
    nodes.push({
      id: t.id,
      type: 'token',
      subtype: t.kind,
      status: 'resolved',
      span: tokenSpan(t),
      features: {
        documentTokenIndex: t.documentTokenIndex,
        sentenceIndex: t.sentenceIndex,
        sentenceTokenIndex: t.sentenceTokenIndex,
        surface: t.surface,
        normalizedSurface: t.normalizedSurface,
        kind: t.kind,
      },
      producer: 'canonical_surface_adapter_v1',
      evidenceIds: [],
      provenanceIds: ['prov:surface:canonical-v1'],
    });
    if (t.sentenceIndex !== null) {
      const s = surface.sentences[t.sentenceIndex];
      if (s) edges.push({
        id: `edge:contains:${s.id}:${t.id}`,
        relation: 'contains',
        sourceId: s.id,
        targetId: t.id,
        status: 'resolved',
        features: { sentenceTokenIndex: t.sentenceTokenIndex },
        producer: 'canonical_surface_adapter_v1',
        evidenceIds: [],
        provenanceIds: ['prov:surface:canonical-v1'],
      });
    }
  }

  return {
    version: 'canonical-language-graph-v1',
    documentId,
    surfaceVersion: surface.version,
    nodes,
    edges,
    evidence: [],
    provenance,
    alternativeSets: [],
    constraintTrace: [],
    producerState: {
      canonical_surface_adapter_v1: { version: '1', status: 'ran', factsAdded: nodes.length + edges.length, factsRejected: 0 },
      morphology: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      pos: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      phrase: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      mwe: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      predicate: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      clause: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
      attachment: { version: 'unbound', status: 'not_run', factsAdded: 0, factsRejected: 0 },
    },
    invariants: {
      oneCanonicalGraph: true,
      stableSurfaceTokenIds: true,
      appendEvidenceDoNotReparseText: true,
      candidatesMayCoexist: true,
      resolvedFactsRequireEvidence: true,
      learnerErrorSeparateFromParserUncertainty: true,
    },
  };
}

export type GraphPatchV1 = {
  producer: string;
  producerVersion: string;
  nodes?: LanguageGraphNodeV1[];
  edges?: LanguageGraphEdgeV1[];
  evidence?: LanguageGraphEvidenceV1[];
  provenance?: LanguageGraphProvenanceV1[];
  alternativeSets?: LanguageGraphAlternativeSetV1[];
  constraintTrace?: LanguageGraphConstraintTraceV1[];
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

// Producers do not replace the graph. They submit patches. A later conflict
// resolver may reject/supersede candidates, but raw source evidence is kept.
export function applyGraphPatchV1(graph: CanonicalLanguageGraphV1, patch: GraphPatchV1): CanonicalLanguageGraphV1 {
  const before = graph.nodes.length + graph.edges.length;
  const next: CanonicalLanguageGraphV1 = {
    ...graph,
    nodes: uniqueById([...graph.nodes, ...(patch.nodes ?? [])]),
    edges: uniqueById([...graph.edges, ...(patch.edges ?? [])]),
    evidence: uniqueById([...graph.evidence, ...(patch.evidence ?? [])]),
    provenance: uniqueById([...graph.provenance, ...(patch.provenance ?? [])]),
    alternativeSets: uniqueById([...graph.alternativeSets, ...(patch.alternativeSets ?? [])]),
    constraintTrace: uniqueById([...graph.constraintTrace, ...(patch.constraintTrace ?? [])]),
    producerState: { ...graph.producerState },
  };
  const after = next.nodes.length + next.edges.length;
  next.producerState[patch.producer] = {
    version: patch.producerVersion,
    status: 'ran',
    factsAdded: Math.max(0, after - before),
    factsRejected: (patch.nodes ?? []).filter(x => x.status === 'rejected').length + (patch.edges ?? []).filter(x => x.status === 'rejected').length,
  };
  return next;
}

export function assertCanonicalLanguageGraphV1(graph: CanonicalLanguageGraphV1): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  for (const n of graph.nodes) {
    if (nodeIds.has(n.id)) errors.push(`duplicate_node_id:${n.id}`);
    nodeIds.add(n.id);
    if (n.status === 'resolved' && n.type !== 'document' && n.type !== 'sentence' && n.type !== 'token' && n.evidenceIds.length === 0) {
      errors.push(`resolved_without_evidence:${n.id}`);
    }
  }
  const edgeIds = new Set<string>();
  for (const e of graph.edges) {
    if (edgeIds.has(e.id)) errors.push(`duplicate_edge_id:${e.id}`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.sourceId)) errors.push(`missing_edge_source:${e.id}:${e.sourceId}`);
    if (!nodeIds.has(e.targetId)) errors.push(`missing_edge_target:${e.id}:${e.targetId}`);
  }
  for (const a of graph.alternativeSets) {
    for (const id of a.memberIds) if (!nodeIds.has(id) && !edgeIds.has(id)) errors.push(`alternative_missing_member:${a.id}:${id}`);
    if (a.status === 'resolved' && a.resolvedMemberIds.length === 0) errors.push(`resolved_alternative_without_winner:${a.id}`);
  }
  return errors;
}

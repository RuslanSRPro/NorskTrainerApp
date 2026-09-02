// Norsk Trainer — Canonical Constraint Propagation V1 (v1.42)
//
// Generic bounded propagation over Canonical Language Graph V1.
// This module contains no Norwegian-language rules and does not interpret the
// source Grammar KB directly. A caller/evaluator must ground source-backed
// constraints to canonical graph IDs. The engine only applies safe graph-state
// transitions, preserves ambiguity, records evidence/provenance/trace, and
// stops at a bounded fixpoint.

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  GraphStatus,
  LanguageGraphAlternativeSetV1,
  LanguageGraphConstraintTraceV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER =
  'canonical_constraint_propagation_v1';
export const CANONICAL_CONSTRAINT_PROPAGATION_V1_VERSION = '1';

export type CanonicalConstraintStrengthV1 =
  | 'hard'
  | 'categorical'
  | 'strong'
  | 'supporting'
  | 'preference';

export type CanonicalConstraintEvaluationOutcomeV1 =
  | 'support'
  | 'reject'
  | 'block'
  | 'no_change';

export type CanonicalConstraintEvaluationV1 = {
  id?: string;
  constraintCode: string;
  strength: CanonicalConstraintStrengthV1;
  outcome: CanonicalConstraintEvaluationOutcomeV1;
  inputIds: string[];
  affectedIds: string[];
  requiredCapabilities?: string[];
  payload?: Record<string, unknown>;
  provenance: LanguageGraphProvenanceV1[];
};

export type CanonicalConstraintEvaluatorContextV1 = {
  graph: CanonicalLanguageGraphV1;
  iteration: number;
  availableCapabilities: ReadonlySet<string>;
};

export type CanonicalConstraintEvaluatorV1 = (
  context: CanonicalConstraintEvaluatorContextV1,
) => readonly CanonicalConstraintEvaluationV1[];

export type CanonicalConstraintPropagationOptionsV1 = {
  maxIterations?: number;
  availableCapabilities?: readonly string[];
  minimumResolutionStrength?: CanonicalConstraintStrengthV1;
};

export type CanonicalConstraintPropagationSummaryV1 = {
  iterations: number;
  converged: boolean;
  maxIterationsReached: boolean;
  evaluationsApplied: number;
  support: number;
  reject: number;
  block: number;
  resolve: number;
  noChange: number;
  resolvedAlternativeSets: number;
  blockedAlternativeSets: number;
};

export type CanonicalConstraintPropagationResultV1 = {
  patch: GraphPatchV1;
  summary: CanonicalConstraintPropagationSummaryV1;
};

type WorkingState = {
  graph: CanonicalLanguageGraphV1;
  nodes: Map<string, LanguageGraphNodeV1>;
  edges: Map<string, LanguageGraphEdgeV1>;
  alternativeSets: Map<string, LanguageGraphAlternativeSetV1>;
  evidence: Map<string, LanguageGraphEvidenceV1>;
  provenance: Map<string, LanguageGraphProvenanceV1>;
  changedNodes: Map<string, LanguageGraphNodeV1>;
  changedEdges: Map<string, LanguageGraphEdgeV1>;
  changedAlternativeSets: Map<string, LanguageGraphAlternativeSetV1>;
  newEvidence: Map<string, LanguageGraphEvidenceV1>;
  newProvenance: Map<string, LanguageGraphProvenanceV1>;
  newTrace: Map<string, LanguageGraphConstraintTraceV1>;
};

const STRENGTH_RANK: Record<CanonicalConstraintStrengthV1, number> = {
  hard: 0,
  categorical: 1,
  strong: 2,
  supporting: 3,
  preference: 4,
};

const OUTCOME_ORDER: Record<CanonicalConstraintEvaluationOutcomeV1, number> = {
  reject: 0,
  block: 1,
  support: 2,
  no_change: 3,
};

function idPart(value: unknown): string {
  return encodeURIComponent(String(value ?? '').normalize('NFC'));
}

function stableStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((x) => String(x)))].sort();
}

function evaluationKey(evaluation: CanonicalConstraintEvaluationV1): string {
  if (evaluation.id) return `id:${evaluation.id}`;
  return [
    evaluation.constraintCode,
    evaluation.strength,
    evaluation.outcome,
    stableStrings(evaluation.inputIds).join(','),
    stableStrings(evaluation.affectedIds).join(','),
    stableStrings(evaluation.requiredCapabilities ?? []).join(','),
  ].join('|');
}

function evidenceId(
  evaluation: CanonicalConstraintEvaluationV1,
  effectiveOutcome: LanguageGraphConstraintTraceV1['outcome'],
  discriminator = '',
): string {
  return [
    'evidence',
    CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
    idPart(evaluation.constraintCode),
    idPart(effectiveOutcome),
    idPart(evaluationKey(evaluation)),
    idPart(discriminator),
  ].join(':');
}

function traceId(
  evaluation: CanonicalConstraintEvaluationV1,
  effectiveOutcome: LanguageGraphConstraintTraceV1['outcome'],
  iteration: number,
): string {
  return [
    'trace',
    CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
    idPart(evaluation.constraintCode),
    idPart(effectiveOutcome),
    iteration,
    idPart(evaluationKey(evaluation)),
  ].join(':');
}

function derivedTraceId(
  outcome: 'resolve' | 'block',
  alternativeSetId: string,
  iteration: number,
): string {
  return [
    'trace',
    CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
    'derived',
    outcome,
    idPart(alternativeSetId),
    iteration,
  ].join(':');
}

function isSourceBacked(provenance: readonly LanguageGraphProvenanceV1[]): boolean {
  return provenance.some((p) =>
    p.sourceType === 'source_rule' || p.sourceType === 'runtime_fact'
  );
}

function destructiveStrengthAllowed(strength: CanonicalConstraintStrengthV1): boolean {
  return strength === 'hard' || strength === 'categorical';
}

function evidenceStatusForOutcome(
  outcome: LanguageGraphConstraintTraceV1['outcome'],
): LanguageGraphEvidenceV1['status'] {
  if (outcome === 'support' || outcome === 'resolve') return 'supports';
  if (outcome === 'reject' || outcome === 'block') return 'opposes';
  return 'neutral';
}

function cloneWorkingGraph(state: WorkingState): CanonicalLanguageGraphV1 {
  return {
    ...state.graph,
    nodes: [...state.nodes.values()],
    edges: [...state.edges.values()],
    evidence: [...state.evidence.values()],
    provenance: [...state.provenance.values()],
    alternativeSets: [...state.alternativeSets.values()],
    constraintTrace: [
      ...state.graph.constraintTrace,
      ...state.newTrace.values(),
    ],
  };
}

function createWorkingState(graph: CanonicalLanguageGraphV1): WorkingState {
  return {
    graph,
    nodes: new Map(graph.nodes.map((x) => [x.id, { ...x, evidenceIds: [...x.evidenceIds] }])),
    edges: new Map(graph.edges.map((x) => [x.id, { ...x, evidenceIds: [...x.evidenceIds] }])),
    alternativeSets: new Map(
      graph.alternativeSets.map((x) => [
        x.id,
        {
          ...x,
          memberIds: [...x.memberIds],
          resolvedMemberIds: [...x.resolvedMemberIds],
        },
      ]),
    ),
    evidence: new Map(graph.evidence.map((x) => [x.id, x])),
    provenance: new Map(graph.provenance.map((x) => [x.id, x])),
    changedNodes: new Map(),
    changedEdges: new Map(),
    changedAlternativeSets: new Map(),
    newEvidence: new Map(),
    newProvenance: new Map(),
    newTrace: new Map(),
  };
}

function factStatus(state: WorkingState, id: string): GraphStatus | undefined {
  return state.nodes.get(id)?.status ?? state.edges.get(id)?.status;
}

function factEvidenceIds(state: WorkingState, id: string): string[] {
  return state.nodes.get(id)?.evidenceIds ?? state.edges.get(id)?.evidenceIds ?? [];
}

function attachEvidenceToFact(
  state: WorkingState,
  id: string,
  eid: string,
): boolean {
  const node = state.nodes.get(id);
  if (node) {
    if (node.evidenceIds.includes(eid)) return false;
    const next = { ...node, evidenceIds: [...node.evidenceIds, eid] };
    state.nodes.set(id, next);
    state.changedNodes.set(id, next);
    return true;
  }

  const edge = state.edges.get(id);
  if (edge) {
    if (edge.evidenceIds.includes(eid)) return false;
    const next = { ...edge, evidenceIds: [...edge.evidenceIds, eid] };
    state.edges.set(id, next);
    state.changedEdges.set(id, next);
    return true;
  }

  return false;
}

function setFactStatus(
  state: WorkingState,
  id: string,
  status: GraphStatus,
  eid: string,
): boolean {
  const node = state.nodes.get(id);
  if (node) {
    if (node.status === 'resolved' && status !== 'resolved') return false;
    const evidenceIds = node.evidenceIds.includes(eid)
      ? node.evidenceIds
      : [...node.evidenceIds, eid];
    if (node.status === status && evidenceIds.length === node.evidenceIds.length) {
      return false;
    }
    const next = { ...node, status, evidenceIds };
    state.nodes.set(id, next);
    state.changedNodes.set(id, next);
    return true;
  }

  const edge = state.edges.get(id);
  if (edge) {
    if (edge.status === 'resolved' && status !== 'resolved') return false;
    const evidenceIds = edge.evidenceIds.includes(eid)
      ? edge.evidenceIds
      : [...edge.evidenceIds, eid];
    if (edge.status === status && evidenceIds.length === edge.evidenceIds.length) {
      return false;
    }
    const next = { ...edge, status, evidenceIds };
    state.edges.set(id, next);
    state.changedEdges.set(id, next);
    return true;
  }

  return false;
}

function addProvenance(
  state: WorkingState,
  provenance: readonly LanguageGraphProvenanceV1[],
): void {
  for (const item of provenance) {
    if (!state.provenance.has(item.id)) {
      state.provenance.set(item.id, item);
      state.newProvenance.set(item.id, item);
    }
  }
}

function addEvaluationEvidence(
  state: WorkingState,
  evaluation: CanonicalConstraintEvaluationV1,
  effectiveOutcome: LanguageGraphConstraintTraceV1['outcome'],
  reason: string | null,
): string {
  const eid = evidenceId(evaluation, effectiveOutcome, reason ?? 'applied');
  if (!state.evidence.has(eid)) {
    const targetIds = evaluation.affectedIds.filter((id) =>
      state.nodes.has(id) || state.edges.has(id)
    );
    const item: LanguageGraphEvidenceV1 = {
      id: eid,
      kind: 'constraint',
      status: evidenceStatusForOutcome(effectiveOutcome),
      targetIds,
      payload: {
        constraintCode: evaluation.constraintCode,
        requestedOutcome: evaluation.outcome,
        effectiveOutcome,
        strength: evaluation.strength,
        reason,
        requiredCapabilities: stableStrings(evaluation.requiredCapabilities ?? []),
        parserUncertainty: effectiveOutcome === 'no_change',
        learnerError: false,
        ...(evaluation.payload ?? {}),
      },
      producer: CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
      provenanceIds: evaluation.provenance.map((x) => x.id),
    };
    state.evidence.set(eid, item);
    state.newEvidence.set(eid, item);
  }
  return eid;
}

function addEvaluationTrace(
  state: WorkingState,
  evaluation: CanonicalConstraintEvaluationV1,
  effectiveOutcome: LanguageGraphConstraintTraceV1['outcome'],
  evidenceIds: string[],
  iteration: number,
): void {
  const id = traceId(evaluation, effectiveOutcome, iteration);
  if (state.newTrace.has(id) || state.graph.constraintTrace.some((x) => x.id === id)) {
    return;
  }
  state.newTrace.set(id, {
    id,
    constraintCode: evaluation.constraintCode,
    inputIds: stableStrings(evaluation.inputIds),
    outcome: effectiveOutcome,
    affectedIds: stableStrings(evaluation.affectedIds),
    evidenceIds: stableStrings(evidenceIds),
    iteration,
    producer: CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
  });
}

function missingCapabilities(
  evaluation: CanonicalConstraintEvaluationV1,
  available: ReadonlySet<string>,
): string[] {
  return stableStrings(evaluation.requiredCapabilities ?? []).filter((x) => !available.has(x));
}

function normalizedEvaluationOutcome(
  evaluation: CanonicalConstraintEvaluationV1,
  state: WorkingState,
  availableCapabilities: ReadonlySet<string>,
): { outcome: LanguageGraphConstraintTraceV1['outcome']; reason: string | null } {
  const missing = missingCapabilities(evaluation, availableCapabilities);
  if (missing.length) {
    return { outcome: 'no_change', reason: `missing_capability:${missing.join(',')}` };
  }

  const missingAffected = evaluation.affectedIds.filter((id) =>
    !state.nodes.has(id) && !state.edges.has(id)
  );
  if (missingAffected.length) {
    return { outcome: 'no_change', reason: `unknown_affected_id:${stableStrings(missingAffected).join(',')}` };
  }

  if (
    (evaluation.outcome === 'reject' || evaluation.outcome === 'block') &&
    !isSourceBacked(evaluation.provenance)
  ) {
    return {
      outcome: 'no_change',
      reason: 'destructive_outcome_requires_source_backed_provenance',
    };
  }

  if (
    (evaluation.outcome === 'reject' || evaluation.outcome === 'block') &&
    !destructiveStrengthAllowed(evaluation.strength)
  ) {
    return {
      outcome: 'no_change',
      reason: `insufficient_strength_for_${evaluation.outcome}`,
    };
  }

  if (
    (evaluation.outcome === 'reject' || evaluation.outcome === 'block') &&
    evaluation.affectedIds.some((id) => factStatus(state, id) === 'resolved')
  ) {
    return {
      outcome: 'no_change',
      reason: 'resolved_fact_requires_fresh_rebuild',
    };
  }

  return { outcome: evaluation.outcome, reason: null };
}

function applyEvaluation(
  state: WorkingState,
  evaluation: CanonicalConstraintEvaluationV1,
  availableCapabilities: ReadonlySet<string>,
  iteration: number,
): { changed: boolean; effectiveOutcome: LanguageGraphConstraintTraceV1['outcome'] } {
  addProvenance(state, evaluation.provenance);

  const normalized = normalizedEvaluationOutcome(
    evaluation,
    state,
    availableCapabilities,
  );
  const eid = addEvaluationEvidence(
    state,
    evaluation,
    normalized.outcome,
    normalized.reason,
  );

  let changed = false;
  if (normalized.outcome === 'support') {
    for (const id of evaluation.affectedIds) {
      changed = attachEvidenceToFact(state, id, eid) || changed;
    }
  } else if (normalized.outcome === 'reject') {
    for (const id of evaluation.affectedIds) {
      changed = setFactStatus(state, id, 'rejected', eid) || changed;
    }
  } else if (normalized.outcome === 'block') {
    for (const id of evaluation.affectedIds) {
      changed = setFactStatus(state, id, 'blocked', eid) || changed;
    }
  }

  addEvaluationTrace(state, evaluation, normalized.outcome, [eid], iteration);
  return { changed, effectiveOutcome: normalized.outcome };
}

function allEvidence(state: WorkingState): Iterable<LanguageGraphEvidenceV1> {
  return state.evidence.values();
}

function hasSufficientPositiveConstraintEvidence(
  state: WorkingState,
  factId: string,
  minimumStrength: CanonicalConstraintStrengthV1,
): boolean {
  const threshold = STRENGTH_RANK[minimumStrength];
  for (const item of allEvidence(state)) {
    if (item.kind !== 'constraint' || item.status !== 'supports') continue;
    if (!item.targetIds.includes(factId)) continue;
    const strength = String(item.payload?.strength ?? '') as CanonicalConstraintStrengthV1;
    if (strength in STRENGTH_RANK && STRENGTH_RANK[strength] <= threshold) {
      return true;
    }
  }
  return false;
}

function constraintEvidenceIdsForFact(
  state: WorkingState,
  factId: string,
): string[] {
  return [...allEvidence(state)]
    .filter((x) => x.kind === 'constraint' && x.targetIds.includes(factId))
    .map((x) => x.id);
}

function deriveAlternativeSetTransitions(
  state: WorkingState,
  iteration: number,
  minimumResolutionStrength: CanonicalConstraintStrengthV1,
): { changed: boolean; resolved: number; blocked: number } {
  let changed = false;
  let resolved = 0;
  let blocked = 0;

  for (const current of state.alternativeSets.values()) {
    if (current.status === 'resolved') continue;

    const survivors = current.memberIds.filter((id) => {
      const status = factStatus(state, id);
      return status !== 'rejected' && status !== 'blocked' && status !== undefined;
    });

    if (survivors.length === 0 && current.memberIds.length > 0) {
      const next: LanguageGraphAlternativeSetV1 = {
        ...current,
        status: 'blocked',
        resolvedMemberIds: [],
        reason: 'no_surviving_candidate_after_constraints',
      };
      state.alternativeSets.set(current.id, next);
      state.changedAlternativeSets.set(current.id, next);
      const eidList = stableStrings(
        current.memberIds.flatMap((id) => constraintEvidenceIdsForFact(state, id)),
      );
      const id = derivedTraceId('block', current.id, iteration);
      if (!state.newTrace.has(id)) {
        state.newTrace.set(id, {
          id,
          constraintCode: `propagation:block:${current.id}`,
          inputIds: stableStrings(current.memberIds),
          outcome: 'block',
          affectedIds: stableStrings(current.memberIds),
          evidenceIds: eidList,
          iteration,
          producer: CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
        });
      }
      changed = true;
      blocked += 1;
      continue;
    }

    if (survivors.length !== 1) {
      if (current.status === 'blocked') {
        const reopened: LanguageGraphAlternativeSetV1 = {
          ...current,
          status: 'open',
          resolvedMemberIds: [],
          reason: 'awaiting_constraint_propagation',
        };
        state.alternativeSets.set(current.id, reopened);
        state.changedAlternativeSets.set(current.id, reopened);
        changed = true;
      }
      continue;
    }

    const winnerId = survivors[0];
    if (!hasSufficientPositiveConstraintEvidence(
      state,
      winnerId,
      minimumResolutionStrength,
    )) {
      continue;
    }

    const winnerEvidenceIds = stableStrings(constraintEvidenceIdsForFact(state, winnerId));
    const supportEvidenceId = winnerEvidenceIds[0];
    if (!supportEvidenceId) continue;

    changed = setFactStatus(state, winnerId, 'resolved', supportEvidenceId) || changed;

    const next: LanguageGraphAlternativeSetV1 = {
      ...current,
      status: 'resolved',
      resolvedMemberIds: [winnerId],
      reason: 'resolved_by_bounded_constraint_propagation',
    };
    state.alternativeSets.set(current.id, next);
    state.changedAlternativeSets.set(current.id, next);

    const id = derivedTraceId('resolve', current.id, iteration);
    if (!state.newTrace.has(id)) {
      state.newTrace.set(id, {
        id,
        constraintCode: `propagation:resolve:${current.id}`,
        inputIds: stableStrings(current.memberIds),
        outcome: 'resolve',
        affectedIds: [winnerId],
        evidenceIds: winnerEvidenceIds,
        iteration,
        producer: CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
      });
    }

    changed = true;
    resolved += 1;
  }

  return { changed, resolved, blocked };
}

function sortEvaluations(
  evaluations: readonly CanonicalConstraintEvaluationV1[],
): CanonicalConstraintEvaluationV1[] {
  return [...evaluations].sort((a, b) =>
    STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] ||
    OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome] ||
    a.constraintCode.localeCompare(b.constraintCode)
  );
}

export function buildCanonicalConstraintPropagationPatchV1(
  graph: CanonicalLanguageGraphV1,
  evaluator: CanonicalConstraintEvaluatorV1,
  options: CanonicalConstraintPropagationOptionsV1 = {},
): CanonicalConstraintPropagationResultV1 {
  const maxIterations = Math.max(1, Math.min(64, options.maxIterations ?? 8));
  const availableCapabilities = new Set(options.availableCapabilities ?? []);
  const minimumResolutionStrength = options.minimumResolutionStrength ?? 'strong';
  const state = createWorkingState(graph);
  const seenEvaluations = new Set<string>();

  let iterations = 0;
  let converged = false;
  let evaluationsApplied = 0;
  let resolvedAlternativeSets = 0;
  let blockedAlternativeSets = 0;
  const outcomeCounts = {
    support: 0,
    reject: 0,
    block: 0,
    resolve: 0,
    no_change: 0,
  };

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterations = iteration + 1;
    const context: CanonicalConstraintEvaluatorContextV1 = {
      graph: cloneWorkingGraph(state),
      iteration,
      availableCapabilities,
    };
    const evaluations = sortEvaluations(evaluator(context) ?? []);
    let changedThisIteration = false;
    let newEvaluationThisIteration = false;

    for (const evaluation of evaluations) {
      const key = evaluationKey(evaluation);
      if (seenEvaluations.has(key)) continue;
      seenEvaluations.add(key);
      newEvaluationThisIteration = true;
      evaluationsApplied += 1;

      const result = applyEvaluation(
        state,
        evaluation,
        availableCapabilities,
        iteration,
      );
      changedThisIteration = result.changed || changedThisIteration;
      outcomeCounts[result.effectiveOutcome] += 1;
    }

    const derived = deriveAlternativeSetTransitions(
      state,
      iteration,
      minimumResolutionStrength,
    );
    changedThisIteration = derived.changed || changedThisIteration;
    resolvedAlternativeSets += derived.resolved;
    blockedAlternativeSets += derived.blocked;
    outcomeCounts.resolve += derived.resolved;

    if (!newEvaluationThisIteration && !changedThisIteration) {
      converged = true;
      break;
    }
  }

  const patch: GraphPatchV1 = {
    producer: CANONICAL_CONSTRAINT_PROPAGATION_V1_PRODUCER,
    producerVersion: CANONICAL_CONSTRAINT_PROPAGATION_V1_VERSION,
    nodes: [...state.changedNodes.values()],
    edges: [...state.changedEdges.values()],
    evidence: [...state.newEvidence.values()],
    provenance: [...state.newProvenance.values()],
    alternativeSets: [...state.changedAlternativeSets.values()],
    constraintTrace: [...state.newTrace.values()],
  };

  return {
    patch,
    summary: {
      iterations,
      converged,
      maxIterationsReached: !converged && iterations >= maxIterations,
      evaluationsApplied,
      support: outcomeCounts.support,
      reject: outcomeCounts.reject,
      block: outcomeCounts.block,
      resolve: outcomeCounts.resolve,
      noChange: outcomeCounts.no_change,
      resolvedAlternativeSets,
      blockedAlternativeSets,
    },
  };
}

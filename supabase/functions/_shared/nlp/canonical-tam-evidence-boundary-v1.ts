// Norsk Trainer — Canonical TAM Evidence Boundary V1
//
// v1.48 A1
//
// Generic evidence-boundary mechanics only.
//
// This boundary DOES NOT know:
//   - Norwegian tense labels;
//   - aspect labels;
//   - mood labels;
//   - auxiliary lemmas;
//   - tense/aspect composition;
//   - present-perfect rules;
//   - resolution rules.
//
// It accepts already source-backed TAM evidence only when that evidence
// is anchored to one exact structural predicate occurrence and its exact
// canonical head-token occurrence.
//
// Dimension and value are opaque.
// Accepted evidence remains candidate-only.
// The language graph is read-only.

import type {
  CanonicalLanguageGraphV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_TAM_EVIDENCE_BOUNDARY_PRODUCER_V1 =
  'canonical_tam_evidence_boundary_v1';

export const CANONICAL_TAM_EVIDENCE_BOUNDARY_VERSION_V1 =
  '1';

export type CanonicalTamEvidenceStatusV1 =
  | 'candidate'
  | 'resolved'
  | 'ambiguous'
  | 'blocked'
  | 'rejected';

export type CanonicalTamEvidenceFactV1 = {
  id: string;

  // Exact structural predicate occurrence.
  predicateId: string;

  // Exact canonical predicate-head token occurrence.
  headTokenId: string;

  // Opaque semantic axis and opaque source-backed value.
  // This boundary does not enumerate or interpret either.
  dimension: string;
  value: string;

  status: CanonicalTamEvidenceStatusV1;

  sourceCandidateCodes?: string[];
  sourceSections?: string[];
  sourceIds?: string[];
  evidenceIds?: string[];
  provenanceIds?: string[];

  payload?: Record<string, unknown>;
};

export type CanonicalTamCandidateEvidenceV1 = {
  id: string;
  predicateId: string;
  headTokenId: string;
  dimension: string;
  value: string;

  // A1 never resolves TAM.
  status: 'candidate';

  sourceStatus:
    | 'candidate'
    | 'resolved'
    | 'ambiguous';

  sourceCandidateCodes: string[];
  sourceSections: string[];
  sourceIds: string[];
  evidenceIds: string[];
  provenanceIds: string[];

  payload?: Record<string, unknown>;
};

export type CanonicalTamEvidenceRejectionReasonV1 =
  | 'invalid_identity'
  | 'invalid_dimension'
  | 'invalid_value'
  | 'unusable_source_status'
  | 'missing_source_provenance'
  | 'predicate_not_usable'
  | 'head_occurrence_mismatch'
  | 'head_token_not_usable';

export type CanonicalTamRejectedEvidenceV1 = {
  id: string;
  reason: CanonicalTamEvidenceRejectionReasonV1;
};

export type CanonicalTamEvidenceBoundaryResultV1 = {
  producer:
    typeof CANONICAL_TAM_EVIDENCE_BOUNDARY_PRODUCER_V1;

  producerVersion:
    typeof CANONICAL_TAM_EVIDENCE_BOUNDARY_VERSION_V1;

  candidates: CanonicalTamCandidateEvidenceV1[];
  rejected: CanonicalTamRejectedEvidenceV1[];
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

function uniqueStrings(
  values: readonly string[] | undefined,
): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function usableStatus(
  status: string,
): boolean {
  return status !== 'blocked' &&
    status !== 'rejected';
}

function graphNodeById(
  graph: CanonicalLanguageGraphV1,
  id: string,
): LanguageGraphNodeV1 | undefined {
  return graph.nodes.find(
    (node) => node.id === id,
  );
}

function hasSourceProvenance(
  fact: CanonicalTamEvidenceFactV1,
): boolean {
  return [
    fact.sourceCandidateCodes,
    fact.sourceIds,
    fact.evidenceIds,
    fact.provenanceIds,
  ].some(
    (values) =>
      (values ?? []).some(
        (value) => Boolean(stringValue(value)),
      ),
  );
}

export function collectCanonicalTamEvidenceBoundaryV1(
  graph: CanonicalLanguageGraphV1,
  evidenceFacts:
    readonly CanonicalTamEvidenceFactV1[],
): CanonicalTamEvidenceBoundaryResultV1 {
  const candidates:
    CanonicalTamCandidateEvidenceV1[] = [];

  const rejected:
    CanonicalTamRejectedEvidenceV1[] = [];

  for (
    const fact of [...evidenceFacts]
      .sort((a, b) => a.id.localeCompare(b.id))
  ) {
    const id = stringValue(fact.id);
    const predicateId =
      stringValue(fact.predicateId);
    const headTokenId =
      stringValue(fact.headTokenId);
    const dimension =
      stringValue(fact.dimension);
    const value =
      stringValue(fact.value);

    if (
      !id ||
      !predicateId ||
      !headTokenId
    ) {
      rejected.push({
        id: id ?? fact.id,
        reason: 'invalid_identity',
      });
      continue;
    }

    if (!dimension) {
      rejected.push({
        id,
        reason: 'invalid_dimension',
      });
      continue;
    }

    if (!value) {
      rejected.push({
        id,
        reason: 'invalid_value',
      });
      continue;
    }

    if (
      fact.status === 'blocked' ||
      fact.status === 'rejected'
    ) {
      rejected.push({
        id,
        reason: 'unusable_source_status',
      });
      continue;
    }

    if (!hasSourceProvenance(fact)) {
      rejected.push({
        id,
        reason: 'missing_source_provenance',
      });
      continue;
    }

    const predicate =
      graphNodeById(
        graph,
        predicateId,
      );

    if (
      !predicate ||
      predicate.type !== 'predicate' ||
      !usableStatus(predicate.status)
    ) {
      rejected.push({
        id,
        reason: 'predicate_not_usable',
      });
      continue;
    }

    const canonicalHeadId =
      stringValue(
        predicate.features.anchorHeadId,
      );

    if (
      !canonicalHeadId ||
      canonicalHeadId !== headTokenId
    ) {
      rejected.push({
        id,
        reason: 'head_occurrence_mismatch',
      });
      continue;
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
      rejected.push({
        id,
        reason: 'head_token_not_usable',
      });
      continue;
    }

    candidates.push({
      id,
      predicateId,
      headTokenId,
      dimension,
      value,

      // Candidate-only is deliberate even when the source fact itself
      // is resolved. Source certainty is not TAM resolution authority.
      status: 'candidate',
      sourceStatus: fact.status,

      sourceCandidateCodes:
        uniqueStrings(
          fact.sourceCandidateCodes,
        ),

      sourceSections:
        uniqueStrings(
          fact.sourceSections,
        ),

      sourceIds:
        uniqueStrings(
          fact.sourceIds,
        ),

      evidenceIds:
        uniqueStrings(
          fact.evidenceIds,
        ),

      provenanceIds:
        uniqueStrings(
          fact.provenanceIds,
        ),

      payload:
        fact.payload
          ? { ...fact.payload }
          : undefined,
    });
  }

  return {
    producer:
      CANONICAL_TAM_EVIDENCE_BOUNDARY_PRODUCER_V1,

    producerVersion:
      CANONICAL_TAM_EVIDENCE_BOUNDARY_VERSION_V1,

    candidates,
    rejected,
  };
}

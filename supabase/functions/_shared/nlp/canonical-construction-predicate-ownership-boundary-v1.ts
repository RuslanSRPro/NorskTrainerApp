export const CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_PRODUCER =
  "canonical_construction_predicate_ownership_boundary_v1" as const;

export const CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_VERSION =
  "1" as const;

export type CanonicalConstructionPredicateOwnershipConstructionV1 = {
  constructionId: string;
  projectionId: string;
  anchorTokenId: string;
  memberTokenIds: string[];
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalConstructionPredicateOwnershipPredicateV1 = {
  predicateId: string;
  anchorHeadId: string;
  status: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalConstructionPredicateOwnershipCandidateV1 = {
  id: string;
  producer:
    typeof CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_PRODUCER;
  version:
    typeof CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_VERSION;
  status: "candidate";

  constructionId: string;
  projectionId: string;
  predicateId: string;

  constructionAnchorTokenId: string;
  predicateAnchorHeadId: string;
  sharedMemberTokenId: string;

  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalConstructionPredicateOwnershipRejectionReasonV1 =
  | "invalid_construction_occurrence"
  | "construction_missing_provenance"
  | "predicate_not_found"
  | "ambiguous_predicate"
  | "predicate_not_eligible"
  | "predicate_missing_provenance";

export type CanonicalConstructionPredicateOwnershipRejectionV1 = {
  constructionId: string;
  reason: CanonicalConstructionPredicateOwnershipRejectionReasonV1;
};

export type CanonicalConstructionPredicateOwnershipResultV1 = {
  candidates: CanonicalConstructionPredicateOwnershipCandidateV1[];
  rejections: CanonicalConstructionPredicateOwnershipRejectionV1[];
};

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

function hasProvenance(values: readonly string[]): boolean {
  return unique(values).length > 0;
}

function validConstruction(
  construction: CanonicalConstructionPredicateOwnershipConstructionV1,
): boolean {
  if (
    !nonEmpty(construction.constructionId) ||
    !nonEmpty(construction.projectionId) ||
    !nonEmpty(construction.anchorTokenId)
  ) {
    return false;
  }

  const members = unique(construction.memberTokenIds);

  return (
    members.length > 0 &&
    members.includes(construction.anchorTokenId)
  );
}

function predicateEligible(
  predicate: CanonicalConstructionPredicateOwnershipPredicateV1,
): boolean {
  return (
    nonEmpty(predicate.predicateId) &&
    nonEmpty(predicate.anchorHeadId) &&
    predicate.status !== "blocked" &&
    predicate.status !== "rejected"
  );
}

export function bindCanonicalConstructionPredicateOwnershipV1(
  constructions:
    readonly CanonicalConstructionPredicateOwnershipConstructionV1[],
  predicates:
    readonly CanonicalConstructionPredicateOwnershipPredicateV1[],
): CanonicalConstructionPredicateOwnershipResultV1 {
  const candidates: CanonicalConstructionPredicateOwnershipCandidateV1[] = [];
  const rejections: CanonicalConstructionPredicateOwnershipRejectionV1[] = [];

  for (const construction of constructions) {
    if (!validConstruction(construction)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "invalid_construction_occurrence",
      });
      continue;
    }

    if (!hasProvenance(construction.provenanceIds)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "construction_missing_provenance",
      });
      continue;
    }

    // Exact occurrence ownership:
    // the predicate head must be the canonical anchor of this exact
    // construction occurrence. memberTokenIds validates construction
    // integrity, but membership alone does not establish ownership.
    const localPredicates = predicates.filter((predicate) =>
      predicate.anchorHeadId === construction.anchorTokenId
    );

    if (localPredicates.length === 0) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "predicate_not_found",
      });
      continue;
    }

    if (localPredicates.length !== 1) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "ambiguous_predicate",
      });
      continue;
    }

    const predicate = localPredicates[0];

    if (!predicateEligible(predicate)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "predicate_not_eligible",
      });
      continue;
    }

    if (!hasProvenance(predicate.provenanceIds)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "predicate_missing_provenance",
      });
      continue;
    }

    candidates.push({
      id:
        `construction-predicate-owner:${construction.constructionId}:` +
        `${construction.projectionId}:${predicate.predicateId}`,
      producer:
        CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_PRODUCER,
      version:
        CANONICAL_CONSTRUCTION_PREDICATE_OWNERSHIP_BOUNDARY_V1_VERSION,
      status: "candidate",

      constructionId: construction.constructionId,
      projectionId: construction.projectionId,
      predicateId: predicate.predicateId,

      constructionAnchorTokenId: construction.anchorTokenId,
      predicateAnchorHeadId: predicate.anchorHeadId,
      sharedMemberTokenId: predicate.anchorHeadId,

      evidenceIds: unique([
        ...construction.evidenceIds,
        ...predicate.evidenceIds,
      ]),
      provenanceIds: unique([
        ...construction.provenanceIds,
        ...predicate.provenanceIds,
      ]),
    });
  }

  return { candidates, rejections };
}


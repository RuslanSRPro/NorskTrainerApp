export const CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_PRODUCER =
  "canonical_auxiliary_participle_binding_v1" as const;

export const CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_VERSION =
  "1" as const;

export type CanonicalAuxiliaryParticipleConstructionV1 = {
  constructionId: string;
  projectionId: string;
  anchorTokenId: string;
  memberTokenIds: string[];
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalAuxiliaryParticipleDependencyV1 = {
  dependencyId: string;
  relation: string;
  sourceTokenId: string;
  targetTokenId: string;
  status: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalAuxiliaryParticipleMorphReadingV1 = {
  morphReadingId: string;
  tokenId: string;
  status: string;
  canonicalFeatures: Record<string, string>;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalAuxiliaryParticipleBindingCandidateV1 = {
  id: string;
  producer: typeof CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_PRODUCER;
  version: typeof CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_VERSION;
  status: "candidate";
  constructionId: string;
  projectionId: string;
  auxiliaryTokenId: string;
  participleTokenId: string;
  dependencyId: string;
  morphReadingId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalAuxiliaryParticipleBindingRejectionReasonV1 =
  | "invalid_construction"
  | "dependency_not_found"
  | "ambiguous_dependency"
  | "dependency_not_resolved"
  | "dependency_missing_provenance"
  | "dependency_endpoint_not_member"
  | "participle_morph_not_found"
  | "ambiguous_participle_morph"
  | "participle_morph_not_eligible"
  | "participle_morph_missing_provenance";

export type CanonicalAuxiliaryParticipleBindingRejectionV1 = {
  constructionId: string;
  reason: CanonicalAuxiliaryParticipleBindingRejectionReasonV1;
};

export type CanonicalAuxiliaryParticipleBindingResultV1 = {
  candidates: CanonicalAuxiliaryParticipleBindingCandidateV1[];
  rejections: CanonicalAuxiliaryParticipleBindingRejectionV1[];
};

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

function hasEvidence(values: readonly string[]): boolean {
  return unique(values).length > 0;
}

function constructionValid(
  x: CanonicalAuxiliaryParticipleConstructionV1,
): boolean {
  if (
    !nonEmpty(x.constructionId) ||
    !nonEmpty(x.projectionId) ||
    !nonEmpty(x.anchorTokenId)
  ) {
    return false;
  }

  const members = unique(x.memberTokenIds);

  return (
    members.length >= 2 &&
    members.includes(x.anchorTokenId) &&
    hasEvidence(x.provenanceIds)
  );
}

function morphEligible(
  x: CanonicalAuxiliaryParticipleMorphReadingV1,
): boolean {
  return (
    x.status !== "blocked" &&
    x.status !== "rejected" &&
    x.canonicalFeatures?.VerbForm === "Part"
  );
}

export function bindCanonicalAuxiliaryParticipleV1(
  constructions: readonly CanonicalAuxiliaryParticipleConstructionV1[],
  dependencies: readonly CanonicalAuxiliaryParticipleDependencyV1[],
  morphReadings: readonly CanonicalAuxiliaryParticipleMorphReadingV1[],
): CanonicalAuxiliaryParticipleBindingResultV1 {
  const candidates: CanonicalAuxiliaryParticipleBindingCandidateV1[] = [];
  const rejections: CanonicalAuxiliaryParticipleBindingRejectionV1[] = [];

  for (const construction of constructions) {
    if (!constructionValid(construction)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "invalid_construction",
      });
      continue;
    }

    const members = new Set(unique(construction.memberTokenIds));

    const matchingDependencies = dependencies.filter((dependency) =>
      dependency.relation === "auxiliary_governs" &&
      (
        members.has(dependency.sourceTokenId) ||
        members.has(dependency.targetTokenId)
      )
    );

    if (matchingDependencies.length === 0) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "dependency_not_found",
      });
      continue;
    }

    if (matchingDependencies.length !== 1) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "ambiguous_dependency",
      });
      continue;
    }

    const dependency = matchingDependencies[0];

    if (dependency.status !== "resolved") {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "dependency_not_resolved",
      });
      continue;
    }

    if (!hasEvidence(dependency.provenanceIds)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "dependency_missing_provenance",
      });
      continue;
    }

    if (
      !members.has(dependency.sourceTokenId) ||
      !members.has(dependency.targetTokenId)
    ) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "dependency_endpoint_not_member",
      });
      continue;
    }

    const participleReadings = morphReadings.filter((reading) =>
      reading.tokenId === dependency.targetTokenId &&
      morphEligible(reading)
    );

    if (participleReadings.length === 0) {
      const sameToken = morphReadings.filter((reading) =>
        reading.tokenId === dependency.targetTokenId
      );

      rejections.push({
        constructionId: construction.constructionId,
        reason: sameToken.length > 0
          ? "participle_morph_not_eligible"
          : "participle_morph_not_found",
      });
      continue;
    }

    if (participleReadings.length !== 1) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "ambiguous_participle_morph",
      });
      continue;
    }

    const participle = participleReadings[0];

    if (!hasEvidence(participle.provenanceIds)) {
      rejections.push({
        constructionId: construction.constructionId,
        reason: "participle_morph_missing_provenance",
      });
      continue;
    }

    const evidenceIds = unique([
      ...construction.evidenceIds,
      ...dependency.evidenceIds,
      ...participle.evidenceIds,
    ]);

    const provenanceIds = unique([
      ...construction.provenanceIds,
      ...dependency.provenanceIds,
      ...participle.provenanceIds,
    ]);

    candidates.push({
      id:
        `aux-part:${construction.constructionId}:${dependency.dependencyId}:${participle.morphReadingId}`,
      producer: CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_PRODUCER,
      version: CANONICAL_AUXILIARY_PARTICIPLE_BINDING_V1_VERSION,
      status: "candidate",
      constructionId: construction.constructionId,
      projectionId: construction.projectionId,
      auxiliaryTokenId: dependency.sourceTokenId,
      participleTokenId: dependency.targetTokenId,
      dependencyId: dependency.dependencyId,
      morphReadingId: participle.morphReadingId,
      evidenceIds,
      provenanceIds,
    });
  }

  return { candidates, rejections };
}



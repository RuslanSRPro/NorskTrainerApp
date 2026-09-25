export const CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_PRODUCER =
  "canonical_generic_tense_construction_operator_v1" as const;

export const CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_VERSION =
  "1" as const;

export type CanonicalGenericTenseConstructionBindingV1 = {
  bindingId: string;
  status: string;
  constructionId: string;
  projectionId: string;
  auxiliaryTokenId: string;
  participleTokenId: string;
  dependencyId: string;
  morphReadingId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalGenericTensePredicateOwnershipV1 = {
  ownershipId: string;
  status: string;
  constructionId: string;
  projectionId: string;
  predicateId: string;
  constructionAnchorTokenId: string;
  predicateAnchorHeadId: string;
  sharedMemberTokenId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalGenericFiniteTenseFactV1 = {
  factId: string;
  status: string;
  predicateId: string;
  headTokenId: string;
  sourceKind: string;
  sourceKey: string;
  sourceValue: string;
  sourceId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalGenericTenseConstructionCandidateV1 = {
  id: string;
  producer: typeof CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_PRODUCER;
  version: typeof CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_VERSION;
  status: "candidate";

  constructionId: string;
  projectionId: string;
  predicateId: string;

  auxiliaryTokenId: string;
  participleTokenId: string;

  structuralBindingId: string;
  predicateOwnershipId: string;
  finiteTenseFactId: string;

  sourceKind: string;
  sourceKey: "FiniteTense";
  sourceValue: "Pres" | "Past";
  sourceId: string;

  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalGenericTenseConstructionRejectionReasonV1 =
  | "invalid_structural_binding"
  | "structural_binding_not_candidate"
  | "structural_binding_missing_provenance"
  | "predicate_ownership_not_found"
  | "ambiguous_predicate_ownership"
  | "predicate_ownership_not_candidate"
  | "predicate_ownership_identity_mismatch"
  | "predicate_ownership_missing_provenance"
  | "finite_tense_not_found"
  | "ambiguous_finite_tense"
  | "finite_tense_not_candidate"
  | "finite_tense_wrong_source"
  | "finite_tense_wrong_selector"
  | "finite_tense_unsupported_value"
  | "finite_tense_missing_provenance";

export type CanonicalGenericTenseConstructionRejectionV1 = {
  bindingId: string;
  reason: CanonicalGenericTenseConstructionRejectionReasonV1;
};

export type CanonicalGenericTenseConstructionResultV1 = {
  candidates: CanonicalGenericTenseConstructionCandidateV1[];
  rejections: CanonicalGenericTenseConstructionRejectionV1[];
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

function validStructuralBinding(
  binding: CanonicalGenericTenseConstructionBindingV1,
): boolean {
  return (
    nonEmpty(binding.bindingId) &&
    nonEmpty(binding.constructionId) &&
    nonEmpty(binding.projectionId) &&
    nonEmpty(binding.auxiliaryTokenId) &&
    nonEmpty(binding.participleTokenId) &&
    nonEmpty(binding.dependencyId) &&
    nonEmpty(binding.morphReadingId) &&
    binding.auxiliaryTokenId !== binding.participleTokenId
  );
}

function finiteTenseValue(
  value: string,
): "Pres" | "Past" | null {
  if (value === "Pres") return "Pres";
  if (value === "Past") return "Past";
  return null;
}

export function applyCanonicalGenericTenseConstructionOperatorV1(
  bindings: readonly CanonicalGenericTenseConstructionBindingV1[],
  ownerships: readonly CanonicalGenericTensePredicateOwnershipV1[],
  finiteTenseFacts: readonly CanonicalGenericFiniteTenseFactV1[],
): CanonicalGenericTenseConstructionResultV1 {
  const candidates: CanonicalGenericTenseConstructionCandidateV1[] = [];
  const rejections: CanonicalGenericTenseConstructionRejectionV1[] = [];

  for (const binding of bindings) {
    if (!validStructuralBinding(binding)) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "invalid_structural_binding",
      });
      continue;
    }

    if (binding.status !== "candidate") {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "structural_binding_not_candidate",
      });
      continue;
    }

    if (!hasProvenance(binding.provenanceIds)) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "structural_binding_missing_provenance",
      });
      continue;
    }

    // Ownership ambiguity is occurrence-local. Only ownership records
    // compatible with the exact structural construction AND auxiliary
    // anchor may participate. Same construction/projection with another
    // anchor is not an alternative owner of this structural binding.
    const localOwnerships = ownerships.filter((ownership) =>
      ownership.constructionId === binding.constructionId &&
      ownership.projectionId === binding.projectionId &&
      ownership.constructionAnchorTokenId === binding.auxiliaryTokenId &&
      ownership.predicateAnchorHeadId === binding.auxiliaryTokenId &&
      ownership.sharedMemberTokenId === binding.auxiliaryTokenId
    );

    if (localOwnerships.length === 0) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "predicate_ownership_not_found",
      });
      continue;
    }

    if (localOwnerships.length !== 1) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "ambiguous_predicate_ownership",
      });
      continue;
    }

    const ownership = localOwnerships[0];

    if (ownership.status !== "candidate") {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "predicate_ownership_not_candidate",
      });
      continue;
    }

    if (
      !nonEmpty(ownership.ownershipId) ||
      !nonEmpty(ownership.predicateId)
    ) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "predicate_ownership_identity_mismatch",
      });
      continue;
    }

    if (!hasProvenance(ownership.provenanceIds)) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "predicate_ownership_missing_provenance",
      });
      continue;
    }

    // Finite-tense fact must match BOTH exact predicate occurrence and
    // exact auxiliary token occurrence proven above.
    const occurrenceFacts = finiteTenseFacts.filter((fact) =>
      fact.predicateId === ownership.predicateId &&
      fact.headTokenId === binding.auxiliaryTokenId
    );

    if (occurrenceFacts.length === 0) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_not_found",
      });
      continue;
    }

    if (occurrenceFacts.length !== 1) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "ambiguous_finite_tense",
      });
      continue;
    }

    const fact = occurrenceFacts[0];

    if (fact.status !== "candidate") {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_not_candidate",
      });
      continue;
    }

    if (fact.sourceKind !== "grammar_morph_form_registry_v1") {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_wrong_source",
      });
      continue;
    }

    if (fact.sourceKey !== "FiniteTense") {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_wrong_selector",
      });
      continue;
    }

    const sourceValue = finiteTenseValue(fact.sourceValue);

    if (sourceValue === null) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_unsupported_value",
      });
      continue;
    }

    if (
      !nonEmpty(fact.factId) ||
      !nonEmpty(fact.sourceId) ||
      !hasProvenance(fact.provenanceIds)
    ) {
      rejections.push({
        bindingId: binding.bindingId,
        reason: "finite_tense_missing_provenance",
      });
      continue;
    }

    candidates.push({
      id:
        `generic-tense-construction:${binding.bindingId}:` +
        `${ownership.ownershipId}:${fact.factId}`,
      producer: CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_PRODUCER,
      version: CANONICAL_GENERIC_TENSE_CONSTRUCTION_OPERATOR_V1_VERSION,
      status: "candidate",

      constructionId: binding.constructionId,
      projectionId: binding.projectionId,
      predicateId: ownership.predicateId,

      auxiliaryTokenId: binding.auxiliaryTokenId,
      participleTokenId: binding.participleTokenId,

      structuralBindingId: binding.bindingId,
      predicateOwnershipId: ownership.ownershipId,
      finiteTenseFactId: fact.factId,

      sourceKind: fact.sourceKind,
      sourceKey: "FiniteTense",
      sourceValue,
      sourceId: fact.sourceId,

      evidenceIds: unique([
        ...binding.evidenceIds,
        ...ownership.evidenceIds,
        ...fact.evidenceIds,
      ]),
      provenanceIds: unique([
        ...binding.provenanceIds,
        ...ownership.provenanceIds,
        ...fact.provenanceIds,
      ]),
    });
  }

  return { candidates, rejections };
}


// Norsk Trainer — Canonical Runtime Manifest Binding Scope Compatibility V1
//
// v1.46 A4.5a1
//
// Family-neutral Runtime manifest binding scope-label compatibility.
//
//   exact A4.3a1 manifest-local binding-definition authority
//       +
//   explicit canonical scope-boundary authority
//       +
//   exact opaque-label equality
//       ->
//   candidate scope-label compatibility
//
// IMPORTANT:
//
// Compatibility is NOT scope execution.
//
// It does NOT prove:
// - occurrence membership in a sentence / clause / phrase;
// - phrase -> sentence containment;
// - current sentence selection;
// - occurrence-domain narrowing;
// - Runtime binding;
// - WHERE;
// - cardinality;
// - set_role semantics;
// - grammatical subject;
// - subject_of;
// - graph mutation.
//
// Runtime scope vocabulary is not hardcoded.
// Matching is exact and opaque.
// No case folding.
// No normalization.

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1 =
  "canonical_runtime_manifest_binding_scope_compatibility_v1";

export type CanonicalRuntimeManifestScopeBoundaryAuthorityV1 = {
  authorityId: string;

  status: "proven";

  boundaryLabel: string;

  source: string;
};

export type CanonicalRuntimeManifestBindingScopeCompatibilityV1 = {
  id: string;

  status: "candidate";

  bindingDefinitionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  bindingName: string;

  runtimeScopeLabel: string;

  canonicalBoundaryLabel: string;

  canonicalBoundaryAuthorityId: string;

  canonicalBoundaryAuthoritySource: string;

  governance: {
    exactA43a1ResultRequired: true;

    exactManifestBindingDefinitionAuthorityRequired: true;

    exactCanonicalBoundaryAuthorityRequired: true;

    exactOpaqueLabelMatch: true;

    runtimeScopeVocabularyHardcoded: false;

    runtimeScopeLabelNormalized: false;

    caseFoldingPerformed: false;

    canonicalBoundaryInferredFromName: false;

    canonicalBoundaryAuthorityIdentityPreserved: true;

    canonicalBoundaryAuthoritySourcePreservedOpaque: true;

    scopeSemanticsResolved: false;

    containmentResolved: false;

    sentenceIdentityResolved: false;

    phraseContainmentResolved: false;

    clauseContainmentResolved: false;

    selfSemanticsResolved: false;

    occurrenceDomainResolved: false;

    occurrenceEnumerationPerformed: false;

    occurrenceBindingPerformed: false;

    whereSemanticsResolved: false;

    cardinalitySemanticsResolved: false;

    actionFamilySemanticsResolved: false;

    roleSemanticsResolved: false;

    grammaticalFunctionResolved: false;

    subjectOfRelationInferred: false;

    winnerSelected: false;

    graphMutationPerformed: false;

    compatibilityOnly: true;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestBindingScopeCompatibilityResultV1 = {
  producer: typeof CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1;

  producerVersion: "1";

  status:
    | "ready"
    | "blocked";

  candidates: CanonicalRuntimeManifestBindingScopeCompatibilityV1[];

  unmappedBindingDefinitionAuthorityIds: string[];

  blockingReasons: string[];
};

function stringPresent(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function safeBindingAuthority(
  authority: CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "candidate" &&
    stringPresent(
      authority.id,
    ) &&
    stringPresent(
      authority.manifestId,
    ) &&
    stringPresent(
      authority.manifestCode,
    ) &&
    stringPresent(
      authority.bindingName,
    ) &&
    g.exactValidatedManifestRequired ===
      true &&
    g.exactManifestIdentityRequired ===
      true &&
    g.manifestLocalBindingsOnly ===
      true &&
    g.actionAuthorityRequired ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.runtimeFamilyLabelPreservedOpaque ===
      true &&
    g.executionPhaseLabelPreservedOpaque ===
      true &&
    g.runtimeFamilySemanticsResolved ===
      false &&
    g.executionPhaseSemanticsResolved ===
      false &&
    g.bindingNamePreservedOpaque ===
      true &&
    g.bindingDefinitionPreservedOpaque ===
      true &&
    g.entityLabelPreservedOpaque ===
      true &&
    g.scopeLabelPreservedOpaque ===
      true &&
    g.cardinalityLabelPreservedOpaque ===
      true &&
    g.whereClausePreservedOpaque ===
      true &&
    g.entitySemanticsResolved ===
      false &&
    g.scopeSemanticsResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.referenceSemanticsResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.productionActivationAssumed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeBoundaryAuthority(
  authority: CanonicalRuntimeManifestScopeBoundaryAuthorityV1,
): boolean {
  return (
    authority.status ===
      "proven" &&
    stringPresent(
      authority.authorityId,
    ) &&
    stringPresent(
      authority.boundaryLabel,
    ) &&
    stringPresent(
      authority.source,
    )
  );
}

function candidateId(
  bindingAuthorityId: string,
  boundaryAuthorityId: string,
): string {
  return [
    CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,
    encodeURIComponent(
      bindingAuthorityId,
    ),
    encodeURIComponent(
      boundaryAuthorityId,
    ),
  ].join(":");
}

function governance(): CanonicalRuntimeManifestBindingScopeCompatibilityV1[
  "governance"
] {
  return {
    exactA43a1ResultRequired: true,

    exactManifestBindingDefinitionAuthorityRequired: true,

    exactCanonicalBoundaryAuthorityRequired: true,

    exactOpaqueLabelMatch: true,

    runtimeScopeVocabularyHardcoded: false,

    runtimeScopeLabelNormalized: false,

    caseFoldingPerformed: false,

    canonicalBoundaryInferredFromName: false,

    canonicalBoundaryAuthorityIdentityPreserved: true,

    canonicalBoundaryAuthoritySourcePreservedOpaque: true,

    scopeSemanticsResolved: false,

    containmentResolved: false,

    sentenceIdentityResolved: false,

    phraseContainmentResolved: false,

    clauseContainmentResolved: false,

    selfSemanticsResolved: false,

    occurrenceDomainResolved: false,

    occurrenceEnumerationPerformed: false,

    occurrenceBindingPerformed: false,

    whereSemanticsResolved: false,

    cardinalitySemanticsResolved: false,

    actionFamilySemanticsResolved: false,

    roleSemanticsResolved: false,

    grammaticalFunctionResolved: false,

    subjectOfRelationInferred: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    compatibilityOnly: true,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
  bindingResult: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  boundaryAuthorities:
    readonly CanonicalRuntimeManifestScopeBoundaryAuthorityV1[],
): CanonicalRuntimeManifestBindingScopeCompatibilityResultV1 {
  const blockingReasons: string[] = [];

  const candidates: CanonicalRuntimeManifestBindingScopeCompatibilityV1[] = [];

  const unmappedBindingDefinitionAuthorityIds: string[] = [];

  if (
    bindingResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 ||
    bindingResult.producerVersion !==
      "1" ||
    bindingResult.status !==
      "ready" ||
    bindingResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "binding_result:unsafe_exact_a43a1_result",
    );
  }

  const seenBindingIds = new Set<string>();

  for (
    const authority of bindingResult.authorities
  ) {
    if (
      seenBindingIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate`,
      );

      continue;
    }

    seenBindingIds.add(
      authority.id,
    );

    if (
      !safeBindingAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:unsafe_contract`,
      );
    }
  }

  const seenBoundaryIds = new Set<string>();

  const boundaryByLabel = new Map<
    string,
    CanonicalRuntimeManifestScopeBoundaryAuthorityV1
  >();

  for (
    const authority of boundaryAuthorities
  ) {
    if (
      !safeBoundaryAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `boundary_authority:${
          String(
            authority?.authorityId,
          )
        }:unsafe_contract`,
      );

      continue;
    }

    if (
      seenBoundaryIds.has(
        authority.authorityId,
      )
    ) {
      blockingReasons.push(
        `boundary_authority:${authority.authorityId}:duplicate_id`,
      );

      continue;
    }

    seenBoundaryIds.add(
      authority.authorityId,
    );

    if (
      boundaryByLabel.has(
        authority.boundaryLabel,
      )
    ) {
      blockingReasons.push(
        `boundary_label:${authority.boundaryLabel}:duplicate_authority`,
      );

      continue;
    }

    boundaryByLabel.set(
      authority.boundaryLabel,
      authority,
    );
  }

  if (
    blockingReasons.length >
      0
  ) {
    return {
      producer: CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,

      producerVersion: "1",

      status: "blocked",

      candidates: [],

      unmappedBindingDefinitionAuthorityIds: [],

      blockingReasons,
    };
  }

  for (
    const bindingAuthority of bindingResult.authorities
  ) {
    const scopeLabel = bindingAuthority.scopeLabel;

    if (
      !stringPresent(
        scopeLabel,
      )
    ) {
      unmappedBindingDefinitionAuthorityIds.push(
        bindingAuthority.id,
      );

      continue;
    }

    const boundaryAuthority = boundaryByLabel.get(
      scopeLabel,
    );

    if (
      !boundaryAuthority
    ) {
      unmappedBindingDefinitionAuthorityIds.push(
        bindingAuthority.id,
      );

      continue;
    }

    candidates.push({
      id: candidateId(
        bindingAuthority.id,
        boundaryAuthority.authorityId,
      ),

      status: "candidate",

      bindingDefinitionAuthorityId: bindingAuthority.id,

      manifestId: bindingAuthority.manifestId,

      manifestCode: bindingAuthority.manifestCode,

      bindingName: bindingAuthority.bindingName,

      runtimeScopeLabel: scopeLabel,

      canonicalBoundaryLabel: boundaryAuthority.boundaryLabel,

      canonicalBoundaryAuthorityId: boundaryAuthority.authorityId,

      canonicalBoundaryAuthoritySource: boundaryAuthority.source,

      governance: governance(),
    });
  }

  candidates.sort(
    (
      a,
      b,
    ) =>
      a.id.localeCompare(
        b.id,
      ),
  );

  unmappedBindingDefinitionAuthorityIds.sort();

  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,

    producerVersion: "1",

    status: "ready",

    candidates,

    unmappedBindingDefinitionAuthorityIds,

    blockingReasons: [],
  };
}

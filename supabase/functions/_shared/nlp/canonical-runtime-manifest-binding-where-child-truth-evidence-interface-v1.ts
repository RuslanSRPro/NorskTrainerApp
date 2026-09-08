import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestCompoundTruthDispositionV1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

// v1.46 A4.6a1c
//
// Generic Child-Truth Evidence Interface.
//
// This is a neutral Runtime-language interface specification between:
//
//   A4.6a1a structural WHERE nodes
//   A4.6a1b three-valued truth semantics
//   future leaf-truth adapters
//   future recursive compound-truth composition
//
// It does NOT consume D2b1/token.pos or any other leaf-specific authority.
// It does NOT construct truth evidence from arbitrary caller values.
//
// A later source-specific adapter must prove the source truth and bind it
// to an exact structural node path before producing this evidence.
//
// blocked is deliberately OUTSIDE the truth disposition domain.
// A blocked source cannot be converted to unresolved.
//
// This layer performs no tree traversal, no truth recomputation,
// no compound composition and no boolean execution.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_V1 =
  "canonical_runtime_manifest_binding_where_child_truth_evidence_interface_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1 =
  "runtime_where_child_truth_evidence_interface_a4_6a1c_v1" as const;

export type CanonicalRuntimeManifestWhereChildTruthSourceKindV1 =
  | "leaf_condition_truth"
  | "compound_condition_truth";

export type CanonicalRuntimeManifestWhereChildTruthEvidenceV1 = {
  childTruthEvidenceId: string;

  nodePath: string;

  sourceKind: CanonicalRuntimeManifestWhereChildTruthSourceKindV1;

  truthDisposition: CanonicalRuntimeManifestCompoundTruthDispositionV1;

  sourceProducer: string;

  sourceProducerVersion: string;

  sourceEvidenceId: string;

  sourceEvidenceObject: unknown;

  provenance: {
    exactStructuralNodePathClaimed: true;

    truthDispositionSuppliedBySourceAuthority: true;

    sourceProducerIdentityPreserved: true;

    sourceEvidenceIdentityPreserved: true;

    sourceEvidenceObjectPreservedWithoutReconstruction: true;

    truthRecomputedByInterface: false;

    booleanTruthInferredByInterface: false;
  };
};

export type CanonicalRuntimeManifestWhereChildTruthEvidenceReadyEnvelopeV1 = {
  status: "ready";

  evidence: CanonicalRuntimeManifestWhereChildTruthEvidenceV1;

  blockingReasons: readonly [];
};

export type CanonicalRuntimeManifestWhereChildTruthEvidenceBlockedEnvelopeV1 = {
  status: "blocked";

  evidence?: never;

  blockingReasons: readonly string[];
};

export type CanonicalRuntimeManifestWhereChildTruthEvidenceEnvelopeV1 =
  | CanonicalRuntimeManifestWhereChildTruthEvidenceReadyEnvelopeV1
  | CanonicalRuntimeManifestWhereChildTruthEvidenceBlockedEnvelopeV1;

export type CanonicalRuntimeManifestWhereChildTruthEvidenceInterfaceCapabilityV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1;

    status: "proven";

    authorityKind: "runtime_language_specification";

    specificationRole: "child_truth_evidence_interface";

    decisionStatus: "normative";

    specificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    structuralSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

    truthSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

    sourceKindDomain:
      readonly CanonicalRuntimeManifestWhereChildTruthSourceKindV1[];

    truthDispositionDomain:
      readonly CanonicalRuntimeManifestCompoundTruthDispositionV1[];

    envelopeStatusDomain: readonly [
      "ready",
      "blocked",
    ];

    contract: {
      nodePathRequired: true;

      nodePathIsStructuralOccurrenceIdentity: true;

      sourceProducerRequired: true;

      sourceProducerVersionRequired: true;

      sourceEvidenceIdRequired: true;

      sourceEvidenceObjectRequired: true;

      exactOneTruthDispositionPerReadyEvidence: true;

      readyEnvelopeCarriesEvidence: true;

      blockedEnvelopeCarriesTruthEvidence: false;

      blockedOutsideTruthDispositionDomain: true;

      blockedMayCollapseToUnresolved: false;

      unresolvedIsBooleanFalse: false;

      unresolvedIsBooleanTrue: false;

      sourceSpecificTruthMustBeProvenBeforeAdaptation: true;

      structuralPathBindingMustBeProvenBySourceAdapter: true;

      interfaceMayFabricateTruthEvidence: false;

      interfaceMayInferStructuralPath: false;
    };

    governance: {
      exactA46a1aStructuralSpecificationReferenced: true;

      exactA46a1bTruthSpecificationReferenced: true;

      runtimeLanguageSpecificationAuthoredHere: true;

      leafSpecificAuthorityImported: false;

      tokenPosAuthorityImported: false;

      d2b1AuthorityConsumed: false;

      sourceSpecificAdapterExecuted: false;

      childTruthEvidenceConstructed: false;

      sourceTruthRecomputed: false;

      structuralPathInferred: false;

      treeConsumed: false;

      treeTraversalPerformed: false;

      compoundTruthComposed: false;

      booleanExecutionPerformed: false;

      shortCircuitExecuted: false;

      manifestConditionTruthResolved: false;

      runtimeSentenceContextSelected: false;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      finalRuntimeOccurrenceBindingPerformed: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1:
  CanonicalRuntimeManifestWhereChildTruthEvidenceInterfaceCapabilityV1 = {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,

    status: "proven",

    authorityKind: "runtime_language_specification",

    specificationRole: "child_truth_evidence_interface",

    decisionStatus: "normative",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    truthSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    sourceKindDomain: [
      "leaf_condition_truth",
      "compound_condition_truth",
    ],

    truthDispositionDomain: [
      "resolved_true",
      "resolved_false",
      "unresolved",
    ],

    envelopeStatusDomain: [
      "ready",
      "blocked",
    ],

    contract: {
      nodePathRequired: true,

      nodePathIsStructuralOccurrenceIdentity: true,

      sourceProducerRequired: true,

      sourceProducerVersionRequired: true,

      sourceEvidenceIdRequired: true,

      sourceEvidenceObjectRequired: true,

      exactOneTruthDispositionPerReadyEvidence: true,

      readyEnvelopeCarriesEvidence: true,

      blockedEnvelopeCarriesTruthEvidence: false,

      blockedOutsideTruthDispositionDomain: true,

      blockedMayCollapseToUnresolved: false,

      unresolvedIsBooleanFalse: false,

      unresolvedIsBooleanTrue: false,

      sourceSpecificTruthMustBeProvenBeforeAdaptation: true,

      structuralPathBindingMustBeProvenBySourceAdapter: true,

      interfaceMayFabricateTruthEvidence: false,

      interfaceMayInferStructuralPath: false,
    },

    governance: {
      exactA46a1aStructuralSpecificationReferenced: true,

      exactA46a1bTruthSpecificationReferenced: true,

      runtimeLanguageSpecificationAuthoredHere: true,

      leafSpecificAuthorityImported: false,

      tokenPosAuthorityImported: false,

      d2b1AuthorityConsumed: false,

      sourceSpecificAdapterExecuted: false,

      childTruthEvidenceConstructed: false,

      sourceTruthRecomputed: false,

      structuralPathInferred: false,

      treeConsumed: false,

      treeTraversalPerformed: false,

      compoundTruthComposed: false,

      booleanExecutionPerformed: false,

      shortCircuitExecuted: false,

      manifestConditionTruthResolved: false,

      runtimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },
  };

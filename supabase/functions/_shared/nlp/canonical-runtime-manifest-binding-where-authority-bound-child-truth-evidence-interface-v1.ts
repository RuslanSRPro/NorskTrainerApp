import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

// v1.46 A4.6a1c2
//
// Generic authority-bound child-truth evidence interface.
//
// A4.6a1c proves truth at a structural nodePath.
// A4.6a1c2 adds the A4.6a1a structural authority identity required to make
// that nodePath safe across multiple independent WHERE authorities.
//
// Composite structural occurrence identity:
//
//   structuralAuthorityId + nodePath
//
// This interface is deliberately source-neutral and specification-only.
//
// It does NOT:
// - import or execute token.pos/D2b1/A4.6a1c1;
// - infer a structural authority;
// - infer a node path;
// - accept a caller-supplied authority/node pairing as proof;
// - reconstruct child-truth evidence;
// - duplicate or recompute truth;
// - traverse a WHERE tree;
// - compose compound truth.
//
// A source-specific adapter must prove the authority/node pair before
// constructing READY A4.6a1c2 evidence.
//
// BLOCKED source evidence receives no invented authority/path identity.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1 =
  "canonical_runtime_manifest_binding_where_authority_bound_child_truth_evidence_interface_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1 =
  "runtime_where_authority_bound_child_truth_evidence_interface_a4_6a1c2_v1" as const;

export type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1 = {
  authorityBoundChildTruthEvidenceId: string;

  structuralAuthorityId: string;

  nodePath: string;

  childTruthEvidence: CanonicalRuntimeManifestWhereChildTruthEvidenceV1;

  provenance: {
    exactStructuralAuthorityIdentityClaimed: true;

    exactStructuralNodePathClaimed: true;

    structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true;

    childTruthEvidenceObjectPreservedWithoutReconstruction: true;

    childTruthNodePathMatchesBoundNodePath: true;

    authorityNodePairProvenBySourceAdapter: true;

    structuralAuthorityInferredByInterface: false;

    nodePathInferredByInterface: false;

    callerSuppliedAuthorityNodePairAcceptedAsProof: false;

    truthDispositionDuplicatedAtBindingLayer: false;

    truthRecomputedByInterface: false;
  };
};

export type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1 =
  {
    status: "ready";

    evidence: CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1 =
  {
    status: "blocked";

    evidence?: never;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceEnvelopeV1 =
  | CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1
  | CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1;

export type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceInterfaceCapabilityV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1;

    status: "proven";

    authorityKind: "runtime_language_specification";

    specificationRole: "authority_bound_child_truth_evidence_interface";

    decisionStatus: "normative";

    specificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    structuralSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

    childTruthEvidenceInterfaceSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    envelopeStatusDomain: readonly [
      "ready",
      "blocked",
    ];

    contract: {
      structuralAuthorityIdRequired: true;

      structuralAuthorityIdIsA46a1aAuthorityIdentity: true;

      nodePathRequired: true;

      nodePathIsAuthorityScopedStructuralOccurrenceIdentity: true;

      structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true;

      childTruthEvidenceRequiredForReadyEnvelope: true;

      childTruthEvidenceObjectPreservedWithoutReconstruction: true;

      childTruthNodePathMustEqualBoundNodePath: true;

      sourceAdapterMustProveAuthorityNodePair: true;

      readyEnvelopeCarriesAuthorityBoundEvidence: true;

      blockedEnvelopeCarriesAuthorityBoundEvidence: false;

      blockedEnvelopeReceivesStructuralAuthorityIdentity: false;

      blockedEnvelopeReceivesNodePathIdentity: false;

      blockedOutsideAuthorityBoundEvidenceDomain: true;

      interfaceMayInferStructuralAuthority: false;

      interfaceMayInferNodePath: false;

      interfaceMayBindCallerSuppliedAuthorityNodePairAsProof: false;

      truthDispositionDuplicatedAtBindingLayer: false;

      interfaceMayRecomputeTruth: false;
    };

    governance: {
      exactA46a1aStructuralSpecificationReferenced: true;

      exactA46a1cChildTruthEvidenceSpecificationReferenced: true;

      runtimeLanguageSpecificationAuthoredHere: true;

      leafSpecificAuthorityImported: false;

      tokenPosAuthorityImported: false;

      d2b1AuthorityConsumed: false;

      a46a1c1AuthorityConsumed: false;

      sourceSpecificAdapterExecuted: false;

      authorityBoundChildTruthEvidenceConstructed: false;

      structuralAuthorityResolved: false;

      structuralNodeResolved: false;

      sourceTruthRecomputed: false;

      childTruthEvidenceReconstructed: false;

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

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1:
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceInterfaceCapabilityV1 =
    {
      producer:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,

      status: "proven",

      authorityKind: "runtime_language_specification",

      specificationRole: "authority_bound_child_truth_evidence_interface",

      decisionStatus: "normative",

      specificationId:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

      structuralSpecificationId:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

      childTruthEvidenceInterfaceSpecificationId:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

      envelopeStatusDomain: [
        "ready",
        "blocked",
      ],

      contract: {
        structuralAuthorityIdRequired: true,

        structuralAuthorityIdIsA46a1aAuthorityIdentity: true,

        nodePathRequired: true,

        nodePathIsAuthorityScopedStructuralOccurrenceIdentity: true,

        structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true,

        childTruthEvidenceRequiredForReadyEnvelope: true,

        childTruthEvidenceObjectPreservedWithoutReconstruction: true,

        childTruthNodePathMustEqualBoundNodePath: true,

        sourceAdapterMustProveAuthorityNodePair: true,

        readyEnvelopeCarriesAuthorityBoundEvidence: true,

        blockedEnvelopeCarriesAuthorityBoundEvidence: false,

        blockedEnvelopeReceivesStructuralAuthorityIdentity: false,

        blockedEnvelopeReceivesNodePathIdentity: false,

        blockedOutsideAuthorityBoundEvidenceDomain: true,

        interfaceMayInferStructuralAuthority: false,

        interfaceMayInferNodePath: false,

        interfaceMayBindCallerSuppliedAuthorityNodePairAsProof: false,

        truthDispositionDuplicatedAtBindingLayer: false,

        interfaceMayRecomputeTruth: false,
      },

      governance: {
        exactA46a1aStructuralSpecificationReferenced: true,

        exactA46a1cChildTruthEvidenceSpecificationReferenced: true,

        runtimeLanguageSpecificationAuthoredHere: true,

        leafSpecificAuthorityImported: false,

        tokenPosAuthorityImported: false,

        d2b1AuthorityConsumed: false,

        a46a1c1AuthorityConsumed: false,

        sourceSpecificAdapterExecuted: false,

        authorityBoundChildTruthEvidenceConstructed: false,

        structuralAuthorityResolved: false,

        structuralNodeResolved: false,

        sourceTruthRecomputed: false,

        childTruthEvidenceReconstructed: false,

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

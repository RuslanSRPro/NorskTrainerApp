/**
 * v1.46 A4.6a1e
 *
 * Generic Context-Bound Child-Truth Evidence Interface.
 *
 * Purpose:
 * - bind an exact A4.6a1c2 authority-bound child-truth evidence object
 *   to one exact canonical snapshot sentence occurrence context;
 * - preserve structural occurrence identity independently from
 *   Runtime sentence-context identity;
 * - provide a source-neutral contract for future source adapters.
 *
 * This file is SPECIFICATION / INTERFACE ONLY.
 *
 * It does NOT:
 * - inspect token.pos or any other linguistic fact family;
 * - inspect D2/C2 lineage;
 * - derive a context from caller data;
 * - select the current Runtime sentence context;
 * - compose compound truth;
 * - recompute or duplicate truth;
 * - select a token occurrence winner;
 * - enforce cardinality;
 * - mutate the graph;
 * - classify learner error.
 */

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1 =
  "canonical_runtime_manifest_binding_where_context_bound_child_truth_evidence_interface_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1 =
  "runtime_where_context_bound_child_truth_evidence_interface_a4_6a1e_v1" as const;

export type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1 = {
  contextBoundChildTruthEvidenceId: string;

  structuralAuthorityId: string;

  nodePath: string;

  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  authorityBoundChildTruthEvidence:
    CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1;

  provenance: {
    exactAuthorityBoundChildTruthEvidenceRequired: true;

    authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction: true;

    structuralAuthorityIdMatchesWrappedEvidence: true;

    nodePathMatchesWrappedEvidence: true;

    canonicalSnapshotSentenceOccurrenceIdentityRequired: true;

    snapshotIdentityRequired: true;

    snapshotSentenceOccurrenceIdentityRequired: true;

    snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
      true;

    graphDocumentIdPreservedAsContextConsistencyMetadata: true;

    sentenceNodeIdPreservedAsContextConsistencyMetadata: true;

    sentenceIndexUsedAsContextIdentity: false;

    tokenNodeIdUsedAsSentenceContextIdentity: false;

    snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false;

    authorityContextPairProvenBySourceAdapter: true;

    contextInferredByInterface: false;

    callerSuppliedContextAcceptedAsProof: false;

    truthDispositionDuplicatedAtContextBindingLayer: false;

    truthRecomputedByInterface: false;
  };
};

export type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceReadyEnvelopeV1 =
  {
    status: "ready";

    evidence: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceBlockedEnvelopeV1 =
  {
    status: "blocked";

    evidence?: never;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceEnvelopeV1 =
  | CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceReadyEnvelopeV1
  | CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceBlockedEnvelopeV1;

export type CanonicalRuntimeManifestBindingWhereContextBoundChildTruthEvidenceInterfaceResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1;

    status: "specification_ready";

    specificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    authorityBoundChildTruthEvidenceInterfaceSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    authorityKind: "runtime_language_specification";

    decisionStatus: "normative";

    contextIdentityKind: "canonical_snapshot_sentence_occurrence_v1";

    contextIdentityComponents: readonly [
      "snapshotIdentityId",
      "snapshotSentenceOccurrenceIdentityId",
    ];

    structuralOccurrenceIdentityComponents: readonly [
      "structuralAuthorityId",
      "nodePath",
    ];

    interfaceContract: {
      readyAndBlockedEnvelopesRemainDistinct: true;

      readyEvidenceRequiresExactA46a1c2Evidence: true;

      exactA46a1c2EvidenceObjectMustBePreserved: true;

      structuralAuthorityIdMustEqualWrappedEvidenceStructuralAuthorityId: true;

      nodePathMustEqualWrappedEvidenceNodePath: true;

      exactCanonicalSnapshotSentenceOccurrenceContextRequired: true;

      contextCompositeIdentityIsSnapshotPlusSentenceOccurrence: true;

      sentenceIndexIsContextIdentity: false;

      tokenOccurrenceIdentityIsSentenceContextIdentity: false;

      graphDocumentIdIsConsistencyMetadata: true;

      sentenceNodeIdIsConsistencyMetadata: true;

      contextMustBeProvenBySourceAdapter: true;

      interfaceMayInferContext: false;

      callerSuppliedContextMayProveBinding: false;

      blockedEnvelopeCarriesNoContextBoundEvidence: true;

      truthDispositionDuplicatedAtContextBindingLayer: false;

      truthRecomputedByInterface: false;

      tokenPosSpecificAuthorityConsumed: false;

      d2AuthorityConsumed: false;

      c2AuthorityConsumed: false;

      runtimeSentenceContextSelected: false;

      compoundTruthComposed: false;

      manifestConditionTruthResolved: false;

      occurrenceWinnerSelected: false;

      finalRuntimeOccurrenceBindingPerformed: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1:
  CanonicalRuntimeManifestBindingWhereContextBoundChildTruthEvidenceInterfaceResultV1 =
    {
      producer:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,

      status: "specification_ready",

      specificationId:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

      authorityBoundChildTruthEvidenceInterfaceSpecificationId:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

      authorityKind: "runtime_language_specification",

      decisionStatus: "normative",

      contextIdentityKind: "canonical_snapshot_sentence_occurrence_v1",

      contextIdentityComponents: [
        "snapshotIdentityId",
        "snapshotSentenceOccurrenceIdentityId",
      ],

      structuralOccurrenceIdentityComponents: [
        "structuralAuthorityId",
        "nodePath",
      ],

      interfaceContract: {
        readyAndBlockedEnvelopesRemainDistinct: true,

        readyEvidenceRequiresExactA46a1c2Evidence: true,

        exactA46a1c2EvidenceObjectMustBePreserved: true,

        structuralAuthorityIdMustEqualWrappedEvidenceStructuralAuthorityId:
          true,

        nodePathMustEqualWrappedEvidenceNodePath: true,

        exactCanonicalSnapshotSentenceOccurrenceContextRequired: true,

        contextCompositeIdentityIsSnapshotPlusSentenceOccurrence: true,

        sentenceIndexIsContextIdentity: false,

        tokenOccurrenceIdentityIsSentenceContextIdentity: false,

        graphDocumentIdIsConsistencyMetadata: true,

        sentenceNodeIdIsConsistencyMetadata: true,

        contextMustBeProvenBySourceAdapter: true,

        interfaceMayInferContext: false,

        callerSuppliedContextMayProveBinding: false,

        blockedEnvelopeCarriesNoContextBoundEvidence: true,

        truthDispositionDuplicatedAtContextBindingLayer: false,

        truthRecomputedByInterface: false,

        tokenPosSpecificAuthorityConsumed: false,

        d2AuthorityConsumed: false,

        c2AuthorityConsumed: false,

        runtimeSentenceContextSelected: false,

        compoundTruthComposed: false,

        manifestConditionTruthResolved: false,

        occurrenceWinnerSelected: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        frozenGrammarReadOnly: true,
      },
    };

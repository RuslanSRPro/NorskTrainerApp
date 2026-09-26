import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts";

import type {
  CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_V1 =
  "canonical_runtime_token_pos_current_snapshot_bound_where_terminal_governed_result_envelope_v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_VERSION_V1 =
  "v1" as const;

type OwnerDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1;

type RootCandidate = OwnerDomain["sourceRootCandidate"];

type RootTruthDisposition =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1[
    "rootTruthDisposition"
  ];

type FinalDecisionDisposition =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1[
    "decisionDisposition"
  ];

type PostOwnerDomainEvidence =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1 =
  {
    envelopeId: string;

    status: "terminal_governed_result_envelope";

    structuralAuthorityId: string;
    ownerBindingDefinitionAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;

    rootTruthDisposition: RootTruthDisposition;
    finalDecisionDisposition: FinalDecisionDisposition;

    sourceRootCandidate: RootCandidate;

    sourceFinalWhereDecision:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

    sourcePostOwnerBoundConditionEvidence: PostOwnerDomainEvidence;

    sourceOperatorShapeAuthority:
      CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;

    operatorShape:
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1;

    governance: {
      rootTruthPreservedWithoutRecomputation: true;
      finalDecisionPreservedWithoutRecomputation: true;

      postOwnerCardinalityOutcomePreserved: true;
      postOwnerBindingOutcomePreserved: true;

      exactStructuralAuthorityIdentityRequired: true;
      exactOperatorShapeAuthorityRequired: true;
      operatorIdentityInferred: false;

      snapshotIdentityPreserved: true;
      sentenceOccurrenceIdentityPreserved: true;
      ownerOccurrenceIdentityPreserved: true;

      genericEligibilityDerived: false;
      executableStateDerived: false;
      schedulableStateDerived: false;

      runtimeActionExecuted: false;
      schedulerInvoked: false;
      graphMutationPerformed: false;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeBlockedResultV1 =
  {
    status: "blocked";

    blockingReasons: string[];

    governance: {
      semanticFallbackUsed: false;
      truthRecomputed: false;
      operatorIdentityInferred: false;
      runtimeActionExecuted: false;
      schedulerInvoked: false;
      graphMutationPerformed: false;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeResultV1 =
  | {
      status: "ready";

      envelope:
        CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1;

      blockingReasons: [];
    }
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeBlockedResultV1;

function blocked(
  ...blockingReasons: string[]
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeBlockedResultV1 {
  return {
    status: "blocked",
    blockingReasons,
    governance: {
      semanticFallbackUsed: false,
      truthRecomputed: false,
      operatorIdentityInferred: false,
      runtimeActionExecuted: false,
      schedulerInvoked: false,
      graphMutationPerformed: false,
    },
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1(
  input: {
    finalWhereDecision:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

    postOwnerBoundConditionEvidence:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1;
  },
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeResultV1 {
  const {
    finalWhereDecision,
    postOwnerBoundConditionEvidence,
  } = input;

  const rootCandidate = finalWhereDecision.sourceRootCandidate;

  const operatorShapeAuthority =
    postOwnerBoundConditionEvidence
      .sourceFinalWhereDecision
      .sourceOwnerBindingOccurrenceDomain
      .sourceStructuralAuthority;

  if (
    finalWhereDecision.structuralAuthorityId !==
      rootCandidate.structuralAuthorityId
  ) {
    return blocked("final_where_root_structural_authority_mismatch");
  }

  if (
    operatorShapeAuthority.id !==
      finalWhereDecision.structuralAuthorityId
  ) {
    return blocked("operator_shape_structural_authority_mismatch");
  }

  if (
    postOwnerBoundConditionEvidence.sourceFinalWhereDecision.decisionId !==
      finalWhereDecision.decisionId
  ) {
    return blocked("post_owner_final_where_decision_mismatch");
  }

  if (
    postOwnerBoundConditionEvidence.sourceFinalWhereDecision
        .snapshotIdentityId !== finalWhereDecision.snapshotIdentityId
  ) {
    return blocked("post_owner_snapshot_identity_mismatch");
  }

  if (
    postOwnerBoundConditionEvidence.sourceFinalWhereDecision
        .snapshotSentenceOccurrenceIdentityId !==
      finalWhereDecision.snapshotSentenceOccurrenceIdentityId
  ) {
    return blocked("post_owner_sentence_occurrence_identity_mismatch");
  }

  const envelopeId = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_V1,
    finalWhereDecision.decisionId,
    finalWhereDecision.structuralAuthorityId,
  ].join(":");

  return {
    status: "ready",

    envelope: {
      envelopeId,

      status: "terminal_governed_result_envelope",

      structuralAuthorityId:
        finalWhereDecision.structuralAuthorityId,

      ownerBindingDefinitionAuthorityId:
        finalWhereDecision.ownerBindingDefinitionAuthorityId,

      snapshotIdentityId:
        finalWhereDecision.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        finalWhereDecision.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId:
        finalWhereDecision.graphDocumentId,

      sentenceNodeId:
        finalWhereDecision.sentenceNodeId,

      rootTruthDisposition:
        finalWhereDecision.rootTruthDisposition,

      finalDecisionDisposition:
        finalWhereDecision.decisionDisposition,

      sourceRootCandidate:
        rootCandidate,

      sourceFinalWhereDecision:
        finalWhereDecision,

      sourcePostOwnerBoundConditionEvidence:
        postOwnerBoundConditionEvidence,

      sourceOperatorShapeAuthority:
        operatorShapeAuthority,

      operatorShape:
        operatorShapeAuthority.root,

      governance: {
        rootTruthPreservedWithoutRecomputation: true,
        finalDecisionPreservedWithoutRecomputation: true,

        postOwnerCardinalityOutcomePreserved: true,
        postOwnerBindingOutcomePreserved: true,

        exactStructuralAuthorityIdentityRequired: true,
        exactOperatorShapeAuthorityRequired: true,
        operatorIdentityInferred: false,

        snapshotIdentityPreserved: true,
        sentenceOccurrenceIdentityPreserved: true,
        ownerOccurrenceIdentityPreserved: true,

        genericEligibilityDerived: false,
        executableStateDerived: false,
        schedulableStateDerived: false,

        runtimeActionExecuted: false,
        schedulerInvoked: false,
        graphMutationPerformed: false,
      },
    },

    blockingReasons: [],
  };
}

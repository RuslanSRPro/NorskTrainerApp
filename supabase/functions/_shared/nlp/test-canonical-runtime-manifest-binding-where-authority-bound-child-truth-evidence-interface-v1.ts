import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

const CAP =
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

const SOURCE_EVIDENCE_OBJECT = {
  source: "fixture",
};

const CHILD_TRUTH: CanonicalRuntimeManifestWhereChildTruthEvidenceV1 = {
  childTruthEvidenceId: "child-truth:fixture:1",

  nodePath: "$.any[1]",

  sourceKind: "leaf_condition_truth",

  truthDisposition: "resolved_true",

  sourceProducer: "fixture_leaf_truth_adapter",

  sourceProducerVersion: "1",

  sourceEvidenceId: "fixture:source-evidence:1",

  sourceEvidenceObject: SOURCE_EVIDENCE_OBJECT,

  provenance: {
    exactStructuralNodePathClaimed: true,

    truthDispositionSuppliedBySourceAuthority: true,

    sourceProducerIdentityPreserved: true,

    sourceEvidenceIdentityPreserved: true,

    sourceEvidenceObjectPreservedWithoutReconstruction: true,

    truthRecomputedByInterface: false,

    booleanTruthInferredByInterface: false,
  },
};

const READY:
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1 =
    {
      status: "ready",

      evidence: {
        authorityBoundChildTruthEvidenceId:
          "authority-bound-child-truth:fixture:1",

        structuralAuthorityId: "a4-6a1a:authority:fixture",

        nodePath: "$.any[1]",

        childTruthEvidence: CHILD_TRUTH,

        provenance: {
          exactStructuralAuthorityIdentityClaimed: true,

          exactStructuralNodePathClaimed: true,

          structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true,

          childTruthEvidenceObjectPreservedWithoutReconstruction: true,

          childTruthNodePathMatchesBoundNodePath: true,

          authorityNodePairProvenBySourceAdapter: true,

          structuralAuthorityInferredByInterface: false,

          nodePathInferredByInterface: false,

          callerSuppliedAuthorityNodePairAcceptedAsProof: false,

          truthDispositionDuplicatedAtBindingLayer: false,

          truthRecomputedByInterface: false,
        },
      },

      blockingReasons: [],
    };

const BLOCKED:
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1 =
    {
      status: "blocked",

      blockingReasons: [
        "fixture_source_not_ready",
      ],
    };

Deno.test(
  "A4.6a1c2.1 exact identity version provenance and normative interface role",
  () => {
    assert(
      CAP.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1 &&
        CAP.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1 &&
        CAP.status ===
          "proven" &&
        CAP.authorityKind ===
          "runtime_language_specification" &&
        CAP.specificationRole ===
          "authority_bound_child_truth_evidence_interface" &&
        CAP.decisionStatus ===
          "normative" &&
        CAP.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c2.2 interface links exact A4.6a1a structural and A4.6a1c child-truth specifications",
  () => {
    assert(
      CAP.structuralSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 &&
        CAP.childTruthEvidenceInterfaceSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1 &&
        CAP.governance
            .exactA46a1aStructuralSpecificationReferenced ===
          true &&
        CAP.governance
            .exactA46a1cChildTruthEvidenceSpecificationReferenced ===
          true,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c2.3 envelope domain keeps ready and blocked separate",
  () => {
    assert(
      CAP.envelopeStatusDomain.length ===
          2 &&
        CAP.envelopeStatusDomain[0] ===
          "ready" &&
        CAP.envelopeStatusDomain[1] ===
          "blocked" &&
        READY.status ===
          "ready" &&
        BLOCKED.status ===
          "blocked",
      JSON.stringify(CAP.envelopeStatusDomain),
    );
  },
);

Deno.test(
  "A4.6a1c2.4 ready evidence requires exact A4.6a1a structural authority identity",
  () => {
    assert(
      CAP.contract
            .structuralAuthorityIdRequired ===
          true &&
        CAP.contract
            .structuralAuthorityIdIsA46a1aAuthorityIdentity ===
          true &&
        READY.evidence
            .structuralAuthorityId ===
          "a4-6a1a:authority:fixture" &&
        READY.evidence
            .provenance
            .exactStructuralAuthorityIdentityClaimed ===
          true,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.5 node path is authority-scoped structural occurrence identity",
  () => {
    assert(
      CAP.contract.nodePathRequired ===
          true &&
        CAP.contract
            .nodePathIsAuthorityScopedStructuralOccurrenceIdentity ===
          true &&
        READY.evidence.nodePath ===
          "$.any[1]" &&
        READY.evidence
            .provenance
            .exactStructuralNodePathClaimed ===
          true,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.6 structural authority plus node path form the composite occurrence identity",
  () => {
    assert(
      CAP.contract
            .structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity ===
          true &&
        READY.evidence
            .provenance
            .structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity ===
          true &&
        READY.evidence
            .structuralAuthorityId.length >
          0 &&
        READY.evidence.nodePath.length >
          0,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.7 exact A4.6a1c child-truth evidence object is preserved without reconstruction",
  () => {
    assert(
      CAP.contract
            .childTruthEvidenceRequiredForReadyEnvelope ===
          true &&
        CAP.contract
            .childTruthEvidenceObjectPreservedWithoutReconstruction ===
          true &&
        READY.evidence
            .childTruthEvidence ===
          CHILD_TRUTH &&
        READY.evidence
            .childTruthEvidence
            .sourceEvidenceObject ===
          SOURCE_EVIDENCE_OBJECT &&
        READY.evidence
            .provenance
            .childTruthEvidenceObjectPreservedWithoutReconstruction ===
          true,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.8 bound node path must equal preserved child-truth node path",
  () => {
    assert(
      CAP.contract
            .childTruthNodePathMustEqualBoundNodePath ===
          true &&
        READY.evidence.nodePath ===
          READY.evidence
            .childTruthEvidence
            .nodePath &&
        READY.evidence
            .provenance
            .childTruthNodePathMatchesBoundNodePath ===
          true,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.9 authority node pair must be proven upstream by a source adapter",
  () => {
    assert(
      CAP.contract
            .sourceAdapterMustProveAuthorityNodePair ===
          true &&
        READY.evidence
            .provenance
            .authorityNodePairProvenBySourceAdapter ===
          true &&
        CAP.governance
            .sourceSpecificAdapterExecuted ===
          false,
      JSON.stringify({
        contract: CAP.contract,

        governance: CAP.governance,
      }),
    );
  },
);

Deno.test(
  "A4.6a1c2.10 interface cannot infer or accept caller authority node pairing as proof",
  () => {
    assert(
      CAP.contract
            .interfaceMayInferStructuralAuthority ===
          false &&
        CAP.contract
            .interfaceMayInferNodePath ===
          false &&
        CAP.contract
            .interfaceMayBindCallerSuppliedAuthorityNodePairAsProof ===
          false &&
        READY.evidence
            .provenance
            .structuralAuthorityInferredByInterface ===
          false &&
        READY.evidence
            .provenance
            .nodePathInferredByInterface ===
          false &&
        READY.evidence
            .provenance
            .callerSuppliedAuthorityNodePairAcceptedAsProof ===
          false,
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.11 binding layer does not duplicate or recompute truth disposition",
  () => {
    assert(
      CAP.contract
            .truthDispositionDuplicatedAtBindingLayer ===
          false &&
        CAP.contract
            .interfaceMayRecomputeTruth ===
          false &&
        READY.evidence
            .provenance
            .truthDispositionDuplicatedAtBindingLayer ===
          false &&
        READY.evidence
            .provenance
            .truthRecomputedByInterface ===
          false &&
        READY.evidence
            .childTruthEvidence
            .truthDisposition ===
          "resolved_true",
      JSON.stringify(READY),
    );
  },
);

Deno.test(
  "A4.6a1c2.12 blocked envelope receives no invented authority or path evidence",
  () => {
    assert(
      BLOCKED.status ===
          "blocked" &&
        !("evidence" in BLOCKED) &&
        CAP.contract
            .blockedEnvelopeCarriesAuthorityBoundEvidence ===
          false &&
        CAP.contract
            .blockedEnvelopeReceivesStructuralAuthorityIdentity ===
          false &&
        CAP.contract
            .blockedEnvelopeReceivesNodePathIdentity ===
          false &&
        CAP.contract
            .blockedOutsideAuthorityBoundEvidenceDomain ===
          true,
      JSON.stringify(BLOCKED),
    );
  },
);

Deno.test(
  "A4.6a1c2.13 interface is source-neutral and consumes no token-pos D2b1 or A4.6a1c1 authority",
  () => {
    const g = CAP.governance;

    assert(
      g.leafSpecificAuthorityImported ===
          false &&
        g.tokenPosAuthorityImported ===
          false &&
        g.d2b1AuthorityConsumed ===
          false &&
        g.a46a1c1AuthorityConsumed ===
          false &&
        g.sourceSpecificAdapterExecuted ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1c2.14 interface constructs no authority-bound evidence by itself",
  () => {
    const g = CAP.governance;

    assert(
      g.authorityBoundChildTruthEvidenceConstructed ===
          false &&
        g.structuralAuthorityResolved ===
          false &&
        g.structuralNodeResolved ===
          false &&
        g.sourceTruthRecomputed ===
          false &&
        g.childTruthEvidenceReconstructed ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1c2.15 authority ceiling excludes tree traversal compound composition and boolean execution",
  () => {
    const g = CAP.governance;

    assert(
      g.treeConsumed ===
          false &&
        g.treeTraversalPerformed ===
          false &&
        g.compoundTruthComposed ===
          false &&
        g.booleanExecutionPerformed ===
          false &&
        g.shortCircuitExecuted ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1c2.16 authority ceiling excludes manifest context occurrence cardinality mutation and learner error",
  () => {
    const g = CAP.governance;

    assert(
      g.manifestConditionTruthResolved ===
          false &&
        g.runtimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(g),
    );
  },
);

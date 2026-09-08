import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
    as CAP,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceEnvelopeV1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

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

const READY_TRUE: CanonicalRuntimeManifestWhereChildTruthEvidenceEnvelopeV1 = {
  status: "ready",

  evidence: {
    childTruthEvidenceId: "fixture:child-truth:true",

    nodePath: "$.all[0]",

    sourceKind: "leaf_condition_truth",

    truthDisposition: "resolved_true",

    sourceProducer: "fixture_leaf_truth_producer",

    sourceProducerVersion: "1",

    sourceEvidenceId: "fixture:leaf:true",

    sourceEvidenceObject: {
      fixture: "leaf:true",
    },

    provenance: {
      exactStructuralNodePathClaimed: true,

      truthDispositionSuppliedBySourceAuthority: true,

      sourceProducerIdentityPreserved: true,

      sourceEvidenceIdentityPreserved: true,

      sourceEvidenceObjectPreservedWithoutReconstruction: true,

      truthRecomputedByInterface: false,

      booleanTruthInferredByInterface: false,
    },
  },

  blockingReasons: [],
};

const READY_UNRESOLVED:
  CanonicalRuntimeManifestWhereChildTruthEvidenceEnvelopeV1 = {
    status: "ready",

    evidence: {
      childTruthEvidenceId: "fixture:child-truth:unresolved",

      nodePath: "$.all[1]",

      sourceKind: "compound_condition_truth",

      truthDisposition: "unresolved",

      sourceProducer: "fixture_compound_truth_producer",

      sourceProducerVersion: "1",

      sourceEvidenceId: "fixture:compound:unresolved",

      sourceEvidenceObject: {
        fixture: "compound:unresolved",
      },

      provenance: {
        exactStructuralNodePathClaimed: true,

        truthDispositionSuppliedBySourceAuthority: true,

        sourceProducerIdentityPreserved: true,

        sourceEvidenceIdentityPreserved: true,

        sourceEvidenceObjectPreservedWithoutReconstruction: true,

        truthRecomputedByInterface: false,

        booleanTruthInferredByInterface: false,
      },
    },

    blockingReasons: [],
  };

const BLOCKED: CanonicalRuntimeManifestWhereChildTruthEvidenceEnvelopeV1 = {
  status: "blocked",

  blockingReasons: [
    "fixture:source_not_ready",
  ],
};

Deno.test(
  "A4.6a1c.1 exact identity version and normative interface-spec provenance",
  () => {
    assert(
      CAP.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_V1 &&
        CAP.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1 &&
        CAP.status ===
          "proven" &&
        CAP.authorityKind ===
          "runtime_language_specification" &&
        CAP.specificationRole ===
          "child_truth_evidence_interface" &&
        CAP.decisionStatus ===
          "normative" &&
        CAP.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c.2 interface links exact structural and truth specifications",
  () => {
    assert(
      CAP.structuralSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 &&
        CAP.truthSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c.3 source kind domain is exactly leaf truth or compound truth",
  () => {
    assert(
      JSON.stringify(
        CAP.sourceKindDomain,
      ) ===
        JSON.stringify([
          "leaf_condition_truth",
          "compound_condition_truth",
        ]),
      JSON.stringify(CAP.sourceKindDomain),
    );
  },
);

Deno.test(
  "A4.6a1c.4 truth disposition domain exactly matches A4.6a1b three-valued domain",
  () => {
    assert(
      JSON.stringify(
        CAP.truthDispositionDomain,
      ) ===
        JSON.stringify([
          "resolved_true",
          "resolved_false",
          "unresolved",
        ]),
      JSON.stringify(CAP.truthDispositionDomain),
    );
  },
);

Deno.test(
  "A4.6a1c.5 envelope status keeps ready and blocked separate from truth",
  () => {
    assert(
      JSON.stringify(
            CAP.envelopeStatusDomain,
          ) ===
          JSON.stringify([
            "ready",
            "blocked",
          ]) &&
        CAP.contract.blockedOutsideTruthDispositionDomain ===
          true &&
        CAP.contract.blockedMayCollapseToUnresolved ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c.6 ready leaf evidence carries exact node path disposition and source provenance",
  () => {
    assert(
      READY_TRUE.status ===
          "ready" &&
        READY_TRUE.evidence.nodePath ===
          "$.all[0]" &&
        READY_TRUE.evidence.sourceKind ===
          "leaf_condition_truth" &&
        READY_TRUE.evidence.truthDisposition ===
          "resolved_true" &&
        READY_TRUE.evidence.sourceEvidenceId ===
          "fixture:leaf:true" &&
        READY_TRUE.blockingReasons.length ===
          0,
      JSON.stringify(READY_TRUE),
    );
  },
);

Deno.test(
  "A4.6a1c.7 future compound child uses the same evidence interface",
  () => {
    assert(
      READY_UNRESOLVED.status ===
          "ready" &&
        READY_UNRESOLVED.evidence.sourceKind ===
          "compound_condition_truth" &&
        READY_UNRESOLVED.evidence.truthDisposition ===
          "unresolved" &&
        READY_UNRESOLVED.evidence.nodePath ===
          "$.all[1]",
      JSON.stringify(READY_UNRESOLVED),
    );
  },
);

Deno.test(
  "A4.6a1c.8 blocked envelope carries no truth evidence and is not unresolved",
  () => {
    assert(
      BLOCKED.status ===
          "blocked" &&
        !("evidence" in BLOCKED) &&
        BLOCKED.blockingReasons.length ===
          1 &&
        CAP.contract.blockedEnvelopeCarriesTruthEvidence ===
          false &&
        CAP.contract.blockedMayCollapseToUnresolved ===
          false,
      JSON.stringify(BLOCKED),
    );
  },
);

Deno.test(
  "A4.6a1c.9 unresolved is neither boolean false nor boolean true",
  () => {
    assert(
      CAP.contract.unresolvedIsBooleanFalse ===
          false &&
        CAP.contract.unresolvedIsBooleanTrue ===
          false,
      JSON.stringify(CAP.contract),
    );
  },
);

Deno.test(
  "A4.6a1c.10 structural node path must be supplied and proven by a source adapter",
  () => {
    assert(
      CAP.contract.nodePathRequired ===
          true &&
        CAP.contract.nodePathIsStructuralOccurrenceIdentity ===
          true &&
        CAP.contract.structuralPathBindingMustBeProvenBySourceAdapter ===
          true &&
        CAP.contract.interfaceMayInferStructuralPath ===
          false,
      JSON.stringify(CAP.contract),
    );
  },
);

Deno.test(
  "A4.6a1c.11 interface cannot fabricate or recompute source truth",
  () => {
    assert(
      CAP.contract.sourceSpecificTruthMustBeProvenBeforeAdaptation ===
          true &&
        CAP.contract.interfaceMayFabricateTruthEvidence ===
          false &&
        READY_TRUE.evidence.provenance
            .truthDispositionSuppliedBySourceAuthority ===
          true &&
        READY_TRUE.evidence.provenance
            .truthRecomputedByInterface ===
          false &&
        READY_TRUE.evidence.provenance
            .booleanTruthInferredByInterface ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1c.12 source evidence identity and object are preserved without reconstruction",
  () => {
    const evidence: CanonicalRuntimeManifestWhereChildTruthEvidenceV1 =
      READY_TRUE.evidence;

    assert(
      evidence.provenance
            .sourceProducerIdentityPreserved ===
          true &&
        evidence.provenance
            .sourceEvidenceIdentityPreserved ===
          true &&
        evidence.provenance
            .sourceEvidenceObjectPreservedWithoutReconstruction ===
          true &&
        CAP.contract.sourceProducerRequired ===
          true &&
        CAP.contract.sourceEvidenceIdRequired ===
          true &&
        CAP.contract.sourceEvidenceObjectRequired ===
          true,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "A4.6a1c.13 interface is deliberately leaf-implementation neutral",
  () => {
    const g = CAP.governance;

    assert(
      g.leafSpecificAuthorityImported ===
          false &&
        g.tokenPosAuthorityImported ===
          false &&
        g.d2b1AuthorityConsumed ===
          false &&
        g.sourceSpecificAdapterExecuted ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1c.14 interface produces no evidence by itself",
  () => {
    const g = CAP.governance;

    assert(
      g.childTruthEvidenceConstructed ===
          false &&
        g.sourceTruthRecomputed ===
          false &&
        g.structuralPathInferred ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1c.15 authority ceiling excludes tree execution composition and short circuit",
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
  "A4.6a1c.16 authority ceiling excludes manifest context occurrence cardinality mutation and learner error",
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

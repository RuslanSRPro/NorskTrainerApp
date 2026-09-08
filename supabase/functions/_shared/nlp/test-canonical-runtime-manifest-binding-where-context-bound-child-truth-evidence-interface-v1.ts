import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceBlockedEnvelopeV1,
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceReadyEnvelopeV1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

const authorityBound:
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1 = {
    authorityBoundChildTruthEvidenceId: "ab-child-1",

    structuralAuthorityId: "shape-authority-1",

    nodePath: "$.all[0]",

    childTruthEvidence: {
      childTruthEvidenceId: "child-1",

      nodePath: "$.all[0]",

      sourceKind: "leaf_condition_truth",

      truthDisposition: "unresolved",

      sourceProducer: "fixture-source",

      sourceProducerVersion: "1",

      sourceEvidenceId: "fixture-evidence-1",

      sourceEvidenceObject: {
        fixture: true,
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
  };

const ready:
  CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceReadyEnvelopeV1 = {
    status: "ready",

    evidence: {
      contextBoundChildTruthEvidenceId: "context-child-1",

      structuralAuthorityId: authorityBound.structuralAuthorityId,

      nodePath: authorityBound.nodePath,

      snapshotIdentityId: "snapshot-1",

      snapshotSentenceOccurrenceIdentityId: "snapshot-sentence-1",

      graphDocumentId: "document-1",

      sentenceNodeId: "sentence-node-1",

      authorityBoundChildTruthEvidence: authorityBound,

      provenance: {
        exactAuthorityBoundChildTruthEvidenceRequired: true,

        authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction:
          true,

        structuralAuthorityIdMatchesWrappedEvidence: true,

        nodePathMatchesWrappedEvidence: true,

        canonicalSnapshotSentenceOccurrenceIdentityRequired: true,

        snapshotIdentityRequired: true,

        snapshotSentenceOccurrenceIdentityRequired: true,

        snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
          true,

        graphDocumentIdPreservedAsContextConsistencyMetadata: true,

        sentenceNodeIdPreservedAsContextConsistencyMetadata: true,

        sentenceIndexUsedAsContextIdentity: false,

        tokenNodeIdUsedAsSentenceContextIdentity: false,

        snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false,

        authorityContextPairProvenBySourceAdapter: true,

        contextInferredByInterface: false,

        callerSuppliedContextAcceptedAsProof: false,

        truthDispositionDuplicatedAtContextBindingLayer: false,

        truthRecomputedByInterface: false,
      },
    },

    blockingReasons: [],
  };

const blocked:
  CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceBlockedEnvelopeV1 =
    {
      status: "blocked",

      blockingReasons: [
        "fixture:blocked",
      ],
    };

Deno.test("A4.6a1e.1 exact interface identity version and normative role", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.producer ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_V1,
    "producer mismatch",
  );

  assert(
    spec.producerVersion ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_VERSION_V1,
    "version mismatch",
  );

  assert(
    spec.specificationId ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
    "specification mismatch",
  );

  assert(
    spec.authorityKind ===
        "runtime_language_specification" &&
      spec.decisionStatus ===
        "normative",
    "interface must be normative Runtime language specification",
  );
});

Deno.test("A4.6a1e.2 interface links exact A4.6a1c2 specification only", () => {
  assert(
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
      .authorityBoundChildTruthEvidenceInterfaceSpecificationId ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
    "A4.6a1c2 specification identity mismatch",
  );
});

Deno.test("A4.6a1e.3 ready and blocked envelopes remain distinct", () => {
  assert(
    ready.status ===
        "ready" &&
      ready.blockingReasons.length ===
        0,
    "ready envelope invalid",
  );

  assert(
    blocked.status ===
        "blocked" &&
      blocked.blockingReasons.length ===
        1 &&
      !("evidence" in blocked),
    "blocked envelope must carry no evidence",
  );
});

Deno.test("A4.6a1e.4 structural occurrence identity remains authority plus node path", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.structuralOccurrenceIdentityComponents.length ===
        2 &&
      spec.structuralOccurrenceIdentityComponents[0] ===
        "structuralAuthorityId" &&
      spec.structuralOccurrenceIdentityComponents[1] ===
        "nodePath",
    "structural identity changed",
  );

  assert(
    ready.evidence.structuralAuthorityId ===
        authorityBound.structuralAuthorityId &&
      ready.evidence.nodePath ===
        authorityBound.nodePath,
    "wrapped structural identity mismatch",
  );
});

Deno.test("A4.6a1e.5 context identity is snapshot plus snapshot sentence occurrence", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.contextIdentityKind ===
      "canonical_snapshot_sentence_occurrence_v1",
    "context kind mismatch",
  );

  assert(
    spec.contextIdentityComponents.length ===
        2 &&
      spec.contextIdentityComponents[0] ===
        "snapshotIdentityId" &&
      spec.contextIdentityComponents[1] ===
        "snapshotSentenceOccurrenceIdentityId",
    "context key mismatch",
  );
});

Deno.test("A4.6a1e.6 exact A4.6a1c2 evidence object is preserved by reference", () => {
  assert(
    ready.evidence.authorityBoundChildTruthEvidence ===
      authorityBound,
    "authority-bound evidence object reconstructed",
  );

  assert(
    ready.evidence.provenance
      .authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction ===
      true,
    "preservation provenance missing",
  );
});

Deno.test("A4.6a1e.7 wrapped structural authority and node path must remain exact", () => {
  const p = ready.evidence.provenance;

  assert(
    p.structuralAuthorityIdMatchesWrappedEvidence ===
        true &&
      p.nodePathMatchesWrappedEvidence ===
        true,
    "structural join requirements missing",
  );
});

Deno.test("A4.6a1e.8 sentenceIndex is never Runtime sentence-context identity", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.sentenceIndexIsContextIdentity ===
        false &&
      ready.evidence.provenance.sentenceIndexUsedAsContextIdentity ===
        false,
    "sentenceIndex leaked into occurrence identity",
  );
});

Deno.test("A4.6a1e.9 token occurrence identity is narrower than sentence context", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.tokenOccurrenceIdentityIsSentenceContextIdentity ===
        false &&
      ready.evidence.provenance.tokenNodeIdUsedAsSentenceContextIdentity ===
        false &&
      ready.evidence.provenance
          .snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity ===
        false,
    "token occurrence incorrectly became sentence context",
  );
});

Deno.test("A4.6a1e.10 graph document and sentence node remain consistency metadata", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.graphDocumentIdIsConsistencyMetadata ===
        true &&
      spec.interfaceContract.sentenceNodeIdIsConsistencyMetadata ===
        true,
    "context consistency metadata contract missing",
  );
});

Deno.test("A4.6a1e.11 source adapter must prove context and caller context is not proof", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.contextMustBeProvenBySourceAdapter ===
        true &&
      spec.interfaceContract.interfaceMayInferContext ===
        false &&
      spec.interfaceContract.callerSuppliedContextMayProveBinding ===
        false,
    "context authority boundary violated",
  );

  assert(
    ready.evidence.provenance.authorityContextPairProvenBySourceAdapter ===
        true &&
      ready.evidence.provenance.contextInferredByInterface ===
        false &&
      ready.evidence.provenance.callerSuppliedContextAcceptedAsProof ===
        false,
    "ready provenance boundary violated",
  );
});

Deno.test("A4.6a1e.12 context binding never duplicates or recomputes truth", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.truthDispositionDuplicatedAtContextBindingLayer ===
        false &&
      spec.interfaceContract.truthRecomputedByInterface ===
        false &&
      ready.evidence.provenance
          .truthDispositionDuplicatedAtContextBindingLayer ===
        false &&
      ready.evidence.provenance.truthRecomputedByInterface ===
        false,
    "truth authority leaked into context interface",
  );
});

Deno.test("A4.6a1e.13 interface remains source-neutral and consumes no token.pos D2 or C2 authority", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.tokenPosSpecificAuthorityConsumed ===
        false &&
      spec.interfaceContract.d2AuthorityConsumed ===
        false &&
      spec.interfaceContract.c2AuthorityConsumed ===
        false,
    "source-specific authority leaked into generic interface",
  );
});

Deno.test("A4.6a1e.14 interface performs no Runtime context selection or compound composition", () => {
  const spec =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1;

  assert(
    spec.interfaceContract.runtimeSentenceContextSelected ===
        false &&
      spec.interfaceContract.compoundTruthComposed ===
        false &&
      spec.interfaceContract.manifestConditionTruthResolved ===
        false,
    "execution semantics leaked into interface",
  );
});

Deno.test("A4.6a1e.15 interface performs no winner cardinality mutation or learner-error semantics", () => {
  const c =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
      .interfaceContract;

  assert(
    c.occurrenceWinnerSelected ===
        false &&
      c.finalRuntimeOccurrenceBindingPerformed ===
        false &&
      c.cardinalitySemanticsResolved ===
        false &&
      c.cardinalityEnforcementPerformed ===
        false &&
      c.graphMutationPerformed ===
        false &&
      c.learnerErrorClassified ===
        false &&
      c.frozenGrammarReadOnly ===
        true,
    "authority ceiling violated",
  );
});

Deno.test("A4.6a1e.16 production is specification-only with no executable function", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts",
      import.meta.url,
    ),
  );

  assert(
    !/export\s+(?:async\s+)?function\s+/.test(
      source,
    ),
    "generic interface must not execute context binding",
  );

  const imports = [
    ...source.matchAll(
      /from\s+["']([^"']+)["']/g,
    ),
  ].map(
    (match) => match[1],
  );

  assert(
    imports.length ===
        1 &&
      imports[0] ===
        "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts",
    "production import ceiling must be exact A4.6a1c2 only",
  );

  assert(
    !source.includes(
      "canonical-runtime-token-pos",
    ) &&
      !source.includes(
        "canonical-token-pos",
      ),
    "token.pos/D2/C2 dependency leaked into interface",
  );
});

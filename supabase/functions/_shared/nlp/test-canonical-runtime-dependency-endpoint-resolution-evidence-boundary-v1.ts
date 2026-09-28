import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1,
  CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
  CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

function endpoint(
  actionId: string,
  endpointRole: "source" | "target",
  bindingName: string,
): CanonicalRuntimeDependencyActionBindingEndpointReferenceV1 {
  return {
    dependencyActionAuthorityId: actionId,
    endpointRole,
    bindingName,
  };
}

type AssociationView =
  CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1[
    "sourceDependencyActionBindingAssociation"
  ];

function association(
  references:
    readonly CanonicalRuntimeDependencyActionBindingEndpointReferenceV1[],
): AssociationView {
  return {
    id: "association:1",
    manifestId: "manifest:1",
    manifestCode: "fixture",

    associationState: "resolved_exact_action_binding_provenance",

    associatedDependencyEndpointReferences: references,

    selectedDependencyActionAuthorityId: null,
    dependencyEndpointRole: null,
  };
}

function readiness(
  references:
    readonly CanonicalRuntimeDependencyActionBindingEndpointReferenceV1[],
  state: CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1["state"] =
    "coherent_execution_readiness_evidence",
): CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1 {
  return {
    id: "readiness:1",
    state,
    manifestId: "manifest:1",
    manifestCode: "fixture",
    snapshotIdentityId: "snapshot:1",
    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:1",
    sourceDependencyActionBindingAssociation: association(references),
  };
}

function finalBinding(
  bindingName: string,
  authorityId: string,
): CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1 {
  return {
    finalRuntimeBindingDomainId: `final-binding-domain:${bindingName}`,

    manifestId: "manifest:1",
    manifestCode: "fixture",

    referencedBindingName: bindingName,
    bindingDefinitionAuthorityId: authorityId,

    snapshotIdentityId: "snapshot:1",
    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:1",

    bindingState: "bound",
    finalRuntimeBindingResolved: true,

    finalRuntimeBindingValue: {
      finalRuntimeBindingValueId: `final-binding-value:${bindingName}`,

      status: "proven_snapshot_bound_final_runtime_binding_value",

      valueKind: "ordered_snapshot_token_occurrence_collection",

      sourceBindingValueId: `binding-value:${bindingName}`,

      manifestId: "manifest:1",
      manifestCode: "fixture",

      referencedBindingName: bindingName,

      bindingDefinitionAuthorityId: authorityId,
      expectedSiteAuthorityId: "site:1",

      snapshotIdentityId: "snapshot:1",
      snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:1",

      graphDocumentId: "document:1",
      sentenceNodeId: "sentence:1",
      sentenceIndex: 0,

      cardinalityLabel: "one",

      members: [],

      memberCount: 0,
      isEmptyCollection: true,
    },
  };
}

Deno.test(
  "resolves source and target independently from preserved authored endpoint tuples",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const target = endpoint(
      "dependency-action:0",
      "target",
      "targetRef",
    );

    const sourceBinding = finalBinding(
      "sourceRef",
      "binding:source",
    );

    const targetBinding = finalBinding(
      "targetRef",
      "binding:target",
    );

    const sourceReadiness = readiness([source, target]);

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            sourceReadiness,
          ],
          finalRuntimeBindings: [
            targetBinding,
            sourceBinding,
          ],
        },
      );

    assertEquals(result.status, "ready");
    assertEquals(result.blockingReasons, []);
    assertEquals(result.evidence.length, 2);

    const sourceEvidence = result.evidence.find(
      (item) => item.authoredEndpointRole === "source",
    );

    const targetEvidence = result.evidence.find(
      (item) => item.authoredEndpointRole === "target",
    );

    if (
      sourceEvidence === undefined ||
      targetEvidence === undefined
    ) {
      throw new Error(
        "expected both endpoint evidence records",
      );
    }

    assertEquals(
      sourceEvidence.state,
      "resolved_exact_endpoint_binding_evidence",
    );

    assertEquals(
      targetEvidence.state,
      "resolved_exact_endpoint_binding_evidence",
    );

    assertEquals(
      sourceEvidence.referencedBindingName,
      "sourceRef",
    );

    assertEquals(
      targetEvidence.referencedBindingName,
      "targetRef",
    );

    assertStrictEquals(
      sourceEvidence.sourceEndpointReference,
      source,
    );

    assertStrictEquals(
      targetEvidence.sourceEndpointReference,
      target,
    );

    assertStrictEquals(
      sourceEvidence.sourceExecutionReadinessEvidence,
      sourceReadiness,
    );

    assertStrictEquals(
      sourceEvidence.sourceFinalRuntimeBindingDomain,
      sourceBinding,
    );

    assertStrictEquals(
      targetEvidence.sourceFinalRuntimeBindingDomain,
      targetBinding,
    );

    assertStrictEquals(
      sourceEvidence.sourceFinalRuntimeBindingValue,
      sourceBinding.finalRuntimeBindingValue,
    );

    assertEquals(
      sourceEvidence.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      sourceEvidence.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      sourceEvidence.governance.actionSelected,
      false,
    );

    assertEquals(
      sourceEvidence.governance.executionAdmissionDerived,
      false,
    );

    assertEquals(
      sourceEvidence.governance.activationPermissionDerived,
      false,
    );

    assertEquals(
      sourceEvidence.governance.runtimeActionExecuted,
      false,
    );

    assertEquals(
      sourceEvidence.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      sourceEvidence.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "fails closed when exact final runtime binding is missing",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness([source]),
          ],
          finalRuntimeBindings: [],
        },
      );

    assertEquals(result.evidence.length, 1);

    assertEquals(
      result.evidence[0].state,
      "unresolved_endpoint_binding_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      ["exact_final_runtime_binding_missing"],
    );

    assertStrictEquals(
      result.evidence[0].sourceFinalRuntimeBindingDomain,
      null,
    );
  },
);

Deno.test(
  "fails closed on duplicate coherent final runtime binding domains",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const first = finalBinding(
      "sourceRef",
      "binding:source",
    );

    const second = {
      ...finalBinding(
        "sourceRef",
        "binding:source",
      ),
      finalRuntimeBindingDomainId: "final-binding-domain:duplicate",
    };

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness([source]),
          ],
          finalRuntimeBindings: [
            first,
            second,
          ],
        },
      );

    assertEquals(
      result.evidence[0].state,
      "unresolved_endpoint_binding_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      ["exact_final_runtime_binding_ambiguous"],
    );
  },
);

Deno.test(
  "fails closed when matching final runtime binding is not bound",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const unbound = {
      ...finalBinding(
        "sourceRef",
        "binding:source",
      ),
      bindingState: "not_bound_unresolved" as const,
      finalRuntimeBindingResolved: false,
      finalRuntimeBindingValue: null,
    };

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness([source]),
          ],
          finalRuntimeBindings: [
            unbound,
          ],
        },
      );

    assertEquals(
      result.evidence[0].state,
      "unresolved_endpoint_binding_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      ["exact_final_runtime_binding_not_bound"],
    );
  },
);

Deno.test(
  "requires exact current snapshot and sentence occurrence identity",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const foreign = {
      ...finalBinding(
        "sourceRef",
        "binding:source",
      ),
      snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:foreign",
    };

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness([source]),
          ],
          finalRuntimeBindings: [
            foreign,
          ],
        },
      );

    assertEquals(
      result.evidence[0].state,
      "unresolved_endpoint_binding_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      ["exact_final_runtime_binding_missing"],
    );
  },
);

Deno.test(
  "does not promote multiple actions to a selected winner",
  () => {
    const action0Source = endpoint(
      "dependency-action:0",
      "source",
      "sharedRef",
    );

    const action1Target = endpoint(
      "dependency-action:1",
      "target",
      "sharedRef",
    );

    const sourceReadiness = readiness([
      action1Target,
      action0Source,
    ]);

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            sourceReadiness,
          ],
          finalRuntimeBindings: [
            finalBinding(
              "sharedRef",
              "binding:shared",
            ),
          ],
        },
      );

    assertEquals(result.evidence.length, 2);

    assertEquals(
      result.evidence.map(
        (item) => item.dependencyActionAuthorityId,
      ),
      [
        "dependency-action:0",
        "dependency-action:1",
      ],
    );

    for (const item of result.evidence) {
      assertEquals(
        item.state,
        "resolved_exact_endpoint_binding_evidence",
      );

      assertEquals(
        item.governance.actionSelected,
        false,
      );

      assertEquals(
        item.governance.singletonActionPromotedToWinner,
        false,
      );

      assertEquals(
        item.governance.endpointDirectionResolved,
        false,
      );

      assertEquals(
        item.governance.executionAdmissionDerived,
        false,
      );
    }
  },
);

Deno.test(
  "unresolved readiness evidence cannot become resolved endpoint evidence",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness(
              [source],
              "unresolved_execution_readiness_evidence",
            ),
          ],
          finalRuntimeBindings: [
            finalBinding(
              "sourceRef",
              "binding:source",
            ),
          ],
        },
      );

    assertEquals(
      result.evidence[0].state,
      "unresolved_endpoint_binding_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      [
        "execution_readiness_evidence_not_coherent",
      ],
    );
  },
);

Deno.test(
  "boundary contains no truth field and cannot convert upstream false truth",
  () => {
    const source = endpoint(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const result =
      deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [
            readiness([source]),
          ],
          finalRuntimeBindings: [
            finalBinding(
              "sourceRef",
              "binding:source",
            ),
          ],
        },
      );

    const evidence = result.evidence[0];

    assertEquals(
      "rootTruthDisposition" in evidence,
      false,
    );

    assertEquals(
      "finalDecisionDisposition" in evidence,
      false,
    );

    assertEquals(
      "executionReady" in evidence,
      false,
    );

    assertEquals(
      evidence.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      evidence.governance.executionAdmissionDerived,
      false,
    );

    assertEquals(
      evidence.governance.activationPermissionDerived,
      false,
    );
  },
);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.3 post-transition reevaluation composition preserves canonical stage ownership", async () => {
  const url = new URL(
    "./canonical-runtime-post-transition-reevaluation-composition-boundary-v1.ts",
    import.meta.url,
  );
  const source = await Deno.readTextFile(url);

  const required = [
    "deriveCanonicalGraphSnapshotIdentityAuthorityV1",
    "deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1",
    "deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1",
    "bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1",
    "deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2",
    "compareCanonicalTokenPosNormalizedLabelEvidenceV2",
    "deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2",
    "deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1",
    "deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1",
    "deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1",
    "deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1",
    "deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1",
  ];

  let previous = -1;
  for (const name of required) {
    const call = source.indexOf(name + "(", previous + 1);
    assert(call >= 0, "missing canonical call: " + name);
    previous = call;
  }

  for (
    const forbidden of [
      "as any",
      "as unknown as",
      "deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1",
      "applyGraphPatch",
      "analyze-text",
    ]
  ) {
    assert(
      !source.includes(forbidden),
      "forbidden A3.3 ownership crossing: " + forbidden,
    );
  }

  for (
    const marker of [
      "s0SnapshotBoundEvidenceReused: false",
      "newLinguisticSemanticsCreated: false",
      "graphMutationPerformed: false",
      "runtimeActionExecuted: false",
      "schedulerInvoked: false",
      "activationPermissionResolved: false",
      "executionAdmissionResolved: false",
    ]
  ) {
    assert(source.includes(marker), "missing governance marker: " + marker);
  }
});

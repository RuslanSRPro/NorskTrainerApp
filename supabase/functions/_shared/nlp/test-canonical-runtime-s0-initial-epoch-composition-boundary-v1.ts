function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6G S0 initial epoch composer preserves canonical ownership and scheduler handoff shape", async () => {
  const url = new URL(
    "./canonical-runtime-s0-initial-epoch-composition-boundary-v1.ts",
    import.meta.url,
  );
  const source = await Deno.readTextFile(url);

  const required = [
    "deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1",
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
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1",
    "deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1",
    "deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1",
    "deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1",
  ];
  let previous = -1;
  for (const name of required) {
    const call = source.indexOf(name + "(", previous + 1);
    assert(call >= 0, "missing/out-of-order canonical call: " + name);
    previous = call;
  }

  for (
    const requiredShape of [
      "graph: resultingGraph",
      "currentContextResult: resultingCurrentContext",
      "snapshotIdentityAuthority: snapshotAuthority",
      "actionCandidateBridges",
      "endpointResolutionEvidenceResult",
      "d4PreconditionEvidenceResult",
      'state: "resolved_s0_initial_epoch_composition"',
    ]
  ) {
    assert(
      source.includes(requiredShape),
      "missing scheduler handoff shape: " + requiredShape,
    );
  }

  for (
    const forbidden of [
      "deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1",
      "epochTransitionResult",
      "deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1",
      "deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1",
      "runCanonicalRuntimeBoundedDependencyGraphSchedulerV1",
      "deriveCanonicalRuntimeDependencyActionActivationAuthorityResolutionV1",
      "readCanonicalRuntimeDependencyActionActivationSourceRowsV1",
      "readCanonicalRuntimeDependencyActionActivationDbRowsV1",
      "analyze-text",
      "as any",
      "as unknown as",
    ]
  ) {
    assert(
      !source.includes(forbidden),
      "forbidden ownership crossing: " + forbidden,
    );
  }

  for (
    const marker of [
      "s0CurrentContextDerivedCanonically: true",
      "priorSnapshotBoundEvidenceReused: false",
      "pseudoTransitionCreated: false",
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

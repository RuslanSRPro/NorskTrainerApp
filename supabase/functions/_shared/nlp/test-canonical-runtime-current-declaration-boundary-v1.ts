function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6J CURRENT declaration boundary preserves caller selection and canonical identity ownership", async () => {
  const url = new URL(
    "./canonical-runtime-current-declaration-boundary-v1.ts",
    import.meta.url,
  );
  const source = await Deno.readTextFile(url);

  for (
    const required of [
      "selectedSentenceNodeId: string",
      "executionInvocationId: string",
      "deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(",
      "authority.sentenceNodeId === selectedSentenceNodeId",
      "matches.length !== 1",
      "declaredCurrentSnapshotIdentityId:",
      "declaredCurrentSnapshotSentenceOccurrenceIdentityId:",
      "selectedOccurrenceAuthority.snapshotSentenceOccurrenceIdentityId",
      "sentenceIndexAcceptedAsSelector: false",
      "candidateCardinalityUsedAsSelector: false",
      "currentContextAuthorityDerivedHere: false",
      "linguisticSemanticsCreated: false",
      "graphMutationPerformed: false",
      "activationResolved: false",
      "schedulerInvoked: false",
    ]
  ) {
    assert(source.includes(required), "missing contract marker: " + required);
  }

  for (
    const forbidden of [
      "sentenceIndex:",
      ".sentenceIndex ===",
      ".sentenceIndex ==",
      "authorities.length === 1",
      "authorities.length == 1",
      "deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1",
      "runCanonicalRuntimeBoundedDependencyGraphSchedulerV1",
      "deriveCanonicalRuntimeDependencyActionActivationAuthorityResolutionV1",
      "analyze-text",
      "as any",
      "as unknown as",
    ]
  ) {
    assert(
      !source.includes(forbidden),
      "forbidden inference/ownership: " + forbidden,
    );
  }
});

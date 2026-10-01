const source = Deno.readTextFileSync(
  new URL("../../canonical-graph-shadow-v1/index.ts", import.meta.url),
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.7H graph shadow wires source-backed dependency S0 observability only", () => {
  for (
    const token of [
      "readCanonicalDependencyRuntimeManifestAuthorityRowsV1",
      "deriveCanonicalGraphSnapshotIdentityAuthorityV1",
      "deriveCanonicalRuntimeCurrentDeclarationBoundaryV1",
      "deriveCanonicalRuntimeDependencyS0SeedsV1",
      "deriveCanonicalRuntimeMultiSiteS0InitialEpochAggregationBoundaryV1",
      "dependency_s0_shadow",
      "surface.sentences[i].id",
      "token.canonicalTokenId",
    ]
  ) {
    assert(source.includes(token), `missing A3.7H handoff token: ${token}`);
  }

  assert(
    source.includes("schedulerInvoked: false") &&
      source.includes("activationResolved: false") &&
      source.includes("graphMutationPerformed: false"),
    "A3.7H shadow observability flags must remain false",
  );

  assert(
    !source.includes("runCanonicalRuntimeBoundedDependencyGraphSchedulerV1(") &&
      !source.includes("resolveCanonicalRuntimeDependencyActionActivation"),
    "A3.7H must not invoke scheduler or activation resolution",
  );
});

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
    source.includes("runCanonicalRuntimeBoundedDependencyGraphSchedulerV1") &&
      source.includes("readCanonicalRuntimeDependencyActionActivationFromDbV1"),
    "A3.8E must wire canonical activation DB reader and bounded scheduler",
  );
  assert(
    /grammar_activation\s*:\s*false/.test(source),
    "production grammar activation flag must remain false during shadow handoff",
  );

  assert(
    source.includes("schedulerInvoked") &&
      source.includes("activationResolved") &&
      source.includes("graphMutationPerformed"),
    "shadow observability must preserve scheduler, activation, and graph-mutation state",
  );
});

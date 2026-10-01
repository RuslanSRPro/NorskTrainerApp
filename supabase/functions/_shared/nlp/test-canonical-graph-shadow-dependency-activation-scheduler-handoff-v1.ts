function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.8E graph-shadow wires canonical activation source into bounded scheduler", () => {
  const source = Deno.readTextFileSync(
    new URL("../../canonical-graph-shadow-v1/index.ts", import.meta.url),
  );

  for (
    const token of [
      "readCanonicalRuntimeDependencyActionActivationFromDbV1",
      "runCanonicalRuntimeBoundedDependencyGraphSchedulerV1",
      "aggregate.status !== 'ready'",
      "aggregate.initialEpoch.d4PreconditionEvidenceResult.evidence",
      "activationScopes = new Map",
      "activationSource.sourceResolution.mappedAuthorities",
      "activationSourceBlocked",
      "activationAuthorities,",
      "initialEpoch: aggregate.initialEpoch",
      "tokenNodeIds: dependencyTokenNodeIds",
      "expectedResult: seed.expectedResult",
      "expectedAuthority: seed.expectedAuthority",
      "compatibilityResult: seed.compatibilityResult",
      "scopeResult: seed.scopeResult",
      "manifestRows: seed.manifestRows",
      "setRoleAuthorities: seed.setRoleAuthorities",
      "schedulerRuns: dependencySchedulerRuns",
      "productionGraphReplacedByScheduler: false",
      "grammar_activation:false",
    ]
  ) {
    assert(source.includes(token), `missing A3.8E token: ${token}`);
  }

  assert(
    !source.includes("graph = schedulerResult.resultingGraph"),
    "shadow scheduler must not replace production response graph",
  );
  assert(
    !source.includes("activationAuthorities.push({"),
    "activation authority must not be fabricated in graph-shadow",
  );
  assert(
    !source.includes("decision: 'granted'"),
    "graph-shadow must not invent activation grants",
  );
});

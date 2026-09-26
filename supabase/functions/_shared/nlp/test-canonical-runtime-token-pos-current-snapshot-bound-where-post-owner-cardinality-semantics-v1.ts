import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-semantics-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts";

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
  CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

function survivorResult(
  survivingOccurrenceCount = 2,
  cardinality = "one",
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1 {
  const ownerBindingDefinitionAuthorityId =
    "runtime-manifest-binding-definition-v1:manifest-id-1:manifest-code-1:owner";

  const bindingDefinition = {
    entity: "token",
    scope: "sentence",
    cardinality,
  };

  const sourceBindingDefinitionAuthority = {
    id: ownerBindingDefinitionAuthorityId,
    status: "ready",
    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",
    bindingName: "owner",
    bindingDefinition,
  };

  const sourceWhereShapeAuthority = {
    id: "structural-1",
    bindingDefinitionAuthorityId: ownerBindingDefinitionAuthorityId,
    sourceBindingDefinitionAuthority,
  };

  const sourceStructuralAuthority = {
    id: "structural-1",
    bindingDefinitionAuthorityId: ownerBindingDefinitionAuthorityId,
    sourceWhereShapeAuthority,
  };

  const ownerDomain = {
    ownerBindingOccurrenceDomainId: "owner-domain-1",
    status: "proven_owner_binding_occurrence_domain",
    structuralAuthorityId: "structural-1",
    ownerBindingDefinitionAuthorityId,
    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",
    ownerBindingName: "owner",
    snapshotIdentityId: "snapshot-1",
    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence-1",
    graphDocumentId: "graph-1",
    sentenceNodeId: "sentence-1",
    occurrenceCount: 2,
    occurrences: [],
    sourceStructuralAuthority,
  };

  return {
    producer:
      "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1",
    producerVersion: "1.0.0",
    specificationId: "late-v1.40:post-where-owner-survivor-set-v1",
    status: "ready",
    sourceFinalWhereResult: {} as unknown,
    survivorDomains: [
      {
        survivorDomainId: "survivor-domain-1",
        status: "proven_post_where_owner_survivor_domain",
        structuralAuthorityId: "structural-1",
        ownerBindingDefinitionAuthorityId,
        snapshotIdentityId: "snapshot-1",
        snapshotSentenceOccurrenceIdentityId: "sentence-occurrence-1",
        graphDocumentId: "graph-1",
        sentenceNodeId: "sentence-1",
        sourceOccurrenceCount: 2,
        survivingOccurrenceCount,
        rejectedOccurrenceCount: 2 - survivingOccurrenceCount,
        uncertainSurvivorCount: 0,
        occurrenceDecisions: [],
        survivingOccurrences: [],
        sourceFinalWhereDecision: {
          sourceOwnerBindingOccurrenceDomain: ownerDomain,
        } as unknown,
        governance: {} as unknown,
      },
    ],
    domainCount: 1,
    blockingReasons: [],
    governance: {} as unknown,
  } as CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1;
}

function dependencyAuthority(): CanonicalDependencyRuntimeActionAuthorityV1 {
  return {
    id: "dependency-authority-1",
    status: "candidate",
    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",
    runtimeFamily: "token_pos",
    executionPhase: "runtime",
    constraintStrength: null,
    actionIndex: 0,
    relation: "opaque",
    actionTarget: "opaque",
    actionValue: null,
    reasonCode: null,
    sourceCandidateCodes: [],
    governance: {
      validatedManifestRequired: true,
      createDependencyActionRequired: true,
      relationPreservedOpaque: true,
      actionTargetPreservedOpaque: true,
      actionValuePreservedOpaque: true,
      executionPhasePreservedOpaque: true,
      runtimeFamilyPreservedOpaque: true,
      endpointDirectionResolved: false,
      endpointBindingPerformed: false,
      dependencySemanticsResolved: false,
      canonicalEdgeGenerated: false,
      alternativeSetGenerated: false,
      productionActivationAssumed: false,
      manifestMutationPerformed: false,
      candidateOnly: true,
      frozenGrammarReadOnly: true,
    },
  };
}

function manifestRow(
  cardinality: string,
): CanonicalDependencyRuntimeManifestAuthorityRowV1 {
  return {
    id: "manifest-id-1",
    code: "manifest-code-1",
    authoring_status: "validated",
    runtime_family: "token_pos",
    execution_phase: "runtime",
    ir_spec: {
      bindings: {
        owner: {
          entity: "token",
          scope: "sentence",
          cardinality,
        },
      },
    },
  } as CanonicalDependencyRuntimeManifestAuthorityRowV1;
}

Deno.test("OWNER cardinality semantics one resolves 1..1 from exact OWNER binding authority", () => {
  const source = survivorResult();

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      source,
      [dependencyAuthority()],
      [manifestRow("one")],
    );

  assertEquals(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assertEquals(result.domainCardinalitySemanticsCount, 1);

  const domain = result.domainCardinalitySemantics[0]!;

  assertEquals(
    domain.ownerBindingDefinitionAuthorityId,
    "runtime-manifest-binding-definition-v1:manifest-id-1:manifest-code-1:owner",
  );
  assertEquals(domain.cardinalityLabel, "one");
  assertEquals(domain.minimum, 1);
  assertEquals(domain.maximum, 1);
  assert(domain.sourceSurvivorDomain === source.survivorDomains[0]);
  assertEquals(
    domain.governance.survivorCountUsedAsCardinalitySemanticAuthority,
    false,
  );
});

Deno.test("OWNER cardinality semantics one_or_more resolves 1..unbounded", () => {
  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      survivorResult(2, "one_or_more"),
      [dependencyAuthority()],
      [manifestRow("one_or_more")],
    );

  assertEquals(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assertEquals(result.domainCardinalitySemantics[0]!.minimum, 1);
  assertEquals(
    result.domainCardinalitySemantics[0]!.maximum,
    "unbounded",
  );
});

Deno.test("OWNER cardinality semantics zero_or_more resolves 0..unbounded", () => {
  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      survivorResult(0, "zero_or_more"),
      [dependencyAuthority()],
      [manifestRow("zero_or_more")],
    );

  assertEquals(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assertEquals(result.domainCardinalitySemantics[0]!.minimum, 0);
  assertEquals(
    result.domainCardinalitySemantics[0]!.maximum,
    "unbounded",
  );
  assertEquals(
    result.domainCardinalitySemantics[0]!.survivingOccurrenceCount,
    0,
  );
});

Deno.test("survivor count cannot change OWNER cardinality semantics", () => {
  for (const count of [0, 1, 2]) {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
        survivorResult(count),
        [dependencyAuthority()],
        [manifestRow("one")],
      );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      continue;
    }

    assertEquals(result.domainCardinalitySemantics[0]!.minimum, 1);
    assertEquals(result.domainCardinalitySemantics[0]!.maximum, 1);
    assertEquals(
      result.domainCardinalitySemantics[0]!.survivingOccurrenceCount,
      count,
    );
  }
});

Deno.test("unsupported OWNER cardinality label blocks instead of defaulting", () => {
  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      survivorResult(2, "optional"),
      [dependencyAuthority()],
      [manifestRow("optional")],
    );

  assertEquals(result.status, "blocked");
  assert(
    result.blockingReasons.some(
      (reason) => reason.includes("unsupported_cardinality_label"),
    ),
  );
});

Deno.test("missing exact OWNER binding authority blocks", () => {
  const source = survivorResult();

  const changed = {
    ...source,
    survivorDomains: source.status === "ready"
      ? source.survivorDomains.map((domain) => ({
        ...domain,
        ownerBindingDefinitionAuthorityId:
          "runtime-manifest-binding-definition-v1:manifest-id-1:manifest-code-1:missing",
      }))
      : [],
  } as CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1;

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      changed,
      [dependencyAuthority()],
      [manifestRow("one")],
    );

  assertEquals(result.status, "blocked");
  assert(
    result.blockingReasons.some(
      (reason) => reason.includes("not_exact_unique_match"),
    ),
  );
});

Deno.test("production source forbids referenced binding substitution and downstream authority", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-semantics-v1.ts",
      import.meta.url,
    ),
  );

  assert(source.includes("ownerBindingDefinitionAuthorityId"));
  assert(
    source.includes(
      "cardinalityLabelConsumedFromExactOwnerBindingDefinitionAuthority: true",
    ),
  );
  assert(
    source.includes(
      "survivorCountUsedAsCardinalitySemanticAuthority: false",
    ),
  );
  assert(
    source.includes(
      "referencedBindingDefinitionAuthorityUsedAsOwnerAuthority: false",
    ),
  );

  for (
    const forbidden of [
      "referencedBindingDefinitionAuthorityId",
      "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1",
      "cardinalityEnforcementPerformed: true",
      "occurrenceWinnerSelected: true",
      "finalRuntimeOccurrenceBindingPerformed: true",
      "learnerErrorClassified: true",
      "graphMutationPerformed: true",
    ]
  ) {
    assert(
      !source.includes(forbidden),
      `forbidden production marker: ${forbidden}`,
    );
  }
});

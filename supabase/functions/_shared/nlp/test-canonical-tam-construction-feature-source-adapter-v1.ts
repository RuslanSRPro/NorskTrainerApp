import {
  adaptCanonicalTamConstructionFeaturesToSourceFactsV1,
} from "./canonical-tam-construction-feature-source-adapter-v1.ts";

import type {
  CanonicalTamConstructionTenseRegistryBridgeCandidateV1,
} from "./canonical-tam-construction-tense-registry-bridge-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function bridgeCandidate():
  CanonicalTamConstructionTenseRegistryBridgeCandidateV1 {
  return {
    id: "bridge:1",
    producer: "canonical_tam_construction_tense_registry_bridge_v1",
    version: "1",
    status: "candidate",

    constructionId: "construction:1",
    projectionId: "projection:1",

    predicateId: "predicate:1",

    registryAnchorTokenId: "token:registry-anchor",
    auxiliaryTokenId: "token:predicate-head",
    participleTokenId: "token:participle",

    registryFormKey: "opaque-form-key",

    canonicalFeatures: {
      ArbitraryFeature: "ArbitraryValue",
      AnotherFeature: "AnotherValue",
    },

    registrySourceId: "registry:source:1",

    evidenceIds: ["ev:registry", "ev:tense"],
    provenanceIds: ["prov:registry", "prov:tense"],
  };
}

Deno.test("A8.14.2 extracts exact requested string feature into A2 source fact", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.sourceFacts.length === 1, "source fact missing");

  const fact = result.sourceFacts[0];

  assert(fact.predicateId === "predicate:1", "predicateId lost");
  assert(fact.sourceKey === "ArbitraryFeature", "sourceKey changed");
  assert(fact.sourceValue === "ArbitraryValue", "sourceValue changed");
});

Deno.test("A8.14.2 uses proven auxiliary predicate head, not registry anchor", () => {
  const candidate = bridgeCandidate();

  assert(
    candidate.registryAnchorTokenId !== candidate.auxiliaryTokenId,
    "fixture must keep identities distinct",
  );

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [candidate],
    [{
      bridgeCandidateId: candidate.id,
      sourceKey: "ArbitraryFeature",
    }],
  );

  const fact = result.sourceFacts[0];

  assert(fact !== undefined, "source fact missing");

  assert(
    fact.headTokenId === "token:predicate-head",
    "headTokenId must be proven predicate head",
  );

  assert(
    fact.headTokenId !== candidate.registryAnchorTokenId,
    "registry anchor must not become predicate head by assumption",
  );
});

Deno.test("A8.14.2 preserves registry source identity", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  const fact = result.sourceFacts[0];
  assert(fact !== undefined, "source fact missing");

  assert(
    fact.sourceId === "registry:source:1",
    "registry source identity lost",
  );
});

Deno.test("A8.14.2 identifies itself as structural source producer", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  const fact = result.sourceFacts[0];
  assert(fact !== undefined, "source fact missing");

  assert(
    fact.sourceKind ===
      "canonical_tam_construction_feature_source_adapter_v1",
    "wrong sourceKind",
  );
});

Deno.test("A8.14.2 preserves evidence and provenance", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  const fact = result.sourceFacts[0];
  assert(fact !== undefined, "source fact missing");

  assert(
    Array.isArray(fact.evidenceIds),
    "adapter must emit evidenceIds",
  );

  assert(
    fact.evidenceIds.includes("ev:registry"),
    "registry evidence lost",
  );

  assert(
    fact.evidenceIds.includes("ev:tense"),
    "tense evidence lost",
  );

  assert(
    Array.isArray(fact.provenanceIds),
    "adapter must emit provenanceIds",
  );

  assert(
    fact.provenanceIds.includes("prov:registry"),
    "registry provenance lost",
  );

  assert(
    fact.provenanceIds.includes("prov:tense"),
    "tense provenance lost",
  );
});

Deno.test("A8.14.2 exact feature key is required", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "arbitraryfeature",
    }],
  );

  assert(result.sourceFacts.length === 0, "must not fuzzy-match feature");
  assert(
    result.rejections[0]?.reason === "feature_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 missing feature fails closed", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "MissingFeature",
    }],
  );

  assert(result.sourceFacts.length === 0, "must not fabricate feature");
  assert(
    result.rejections[0]?.reason === "feature_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 empty request sourceKey fails closed", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "",
    }],
  );

  assert(result.sourceFacts.length === 0, "invalid request must fail");
  assert(
    result.rejections[0]?.reason === "invalid_request",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 unknown bridge candidate fails closed", () => {
  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate()],
    [{
      bridgeCandidateId: "bridge:missing",
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(result.sourceFacts.length === 0, "must not fabricate candidate");
  assert(
    result.rejections[0]?.reason === "bridge_candidate_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 duplicate bridge candidate id fails closed", () => {
  const first = bridgeCandidate();
  const second = bridgeCandidate();

  second.constructionId = "construction:other";

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [first, second],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(result.sourceFacts.length === 0, "must not choose a winner");
  assert(
    result.rejections[0]?.reason === "ambiguous_bridge_candidate",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 unrelated bridge candidate does not create ambiguity", () => {
  const unrelated = bridgeCandidate();

  unrelated.id = "bridge:other";
  unrelated.constructionId = "construction:other";

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [bridgeCandidate(), unrelated],
    [{
      bridgeCandidateId: "bridge:1",
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.sourceFacts.length === 1, "exact candidate missing");
});

Deno.test("A8.14.2 missing provenance fails closed", () => {
  const candidate = bridgeCandidate();
  candidate.provenanceIds = [];

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [candidate],
    [{
      bridgeCandidateId: candidate.id,
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(result.sourceFacts.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.14.2 preserves exact opaque feature value", () => {
  const candidate = bridgeCandidate();

  candidate.canonicalFeatures = {
    OpaqueKey: "CompletelyOpaqueValue",
  };

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [candidate],
    [{
      bridgeCandidateId: candidate.id,
      sourceKey: "OpaqueKey",
    }],
  );

  const fact = result.sourceFacts[0];
  assert(fact !== undefined, "source fact missing");

  assert(fact.sourceKey === "OpaqueKey", "key interpreted");
  assert(fact.sourceValue === "CompletelyOpaqueValue", "value interpreted");
});

Deno.test("A8.14.2 supports independent exact extraction of multiple features", () => {
  const candidate = bridgeCandidate();

  const result = adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [candidate],
    [
      {
        bridgeCandidateId: candidate.id,
        sourceKey: "ArbitraryFeature",
      },
      {
        bridgeCandidateId: candidate.id,
        sourceKey: "AnotherFeature",
      },
    ],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.sourceFacts.length === 2, "expected two exact source facts");

  assert(
    result.sourceFacts[0]?.sourceValue === "ArbitraryValue",
    "first feature wrong",
  );

  assert(
    result.sourceFacts[1]?.sourceValue === "AnotherValue",
    "second feature wrong",
  );
});

Deno.test("A8.14.2 does not mutate bridge candidate features", () => {
  const candidate = bridgeCandidate();

  const before = JSON.stringify(candidate.canonicalFeatures);

  adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
    [candidate],
    [{
      bridgeCandidateId: candidate.id,
      sourceKey: "ArbitraryFeature",
    }],
  );

  assert(
    JSON.stringify(candidate.canonicalFeatures) === before,
    "bridge candidate features mutated",
  );
});


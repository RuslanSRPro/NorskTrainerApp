import {
  bridgeCanonicalTamConstructionTenseRegistryV1,
} from "./canonical-tam-construction-tense-registry-bridge-v1.ts";

import type {
  CanonicalTamConstructionRegistryBindingV1,
} from "./canonical-tam-construction-registry-binding-v1.ts";

import type {
  CanonicalGenericTenseConstructionCandidateV1,
} from "./canonical-generic-tense-construction-operator-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function registryBinding(): CanonicalTamConstructionRegistryBindingV1 {
  return {
    id: "registry-binding:1",
    producer: "canonical_tam_construction_registry_binding_v1",
    version: "1",
    status: "candidate",

    constructionId: "construction:1",
    projectionId: "projection:1",

    anchorTokenId: "token:registry-anchor",
    memberTokenIds: [
      "token:registry-anchor",
      "token:participle",
    ],

    registryFormKey: "opaque-registry-form-key",

    canonicalFeatures: {
      OpaqueFeature: "OpaqueValue",
    },

    registrySourceId: "registry:source:1",

    evidenceIds: ["ev:registry"],
    provenanceIds: ["prov:registry"],
  };
}

function tenseCandidate(): CanonicalGenericTenseConstructionCandidateV1 {
  return {
    id: "generic-tense:1",
    producer: "canonical_generic_tense_construction_operator_v1",
    version: "1",
    status: "candidate",

    constructionId: "construction:1",
    projectionId: "projection:1",

    predicateId: "predicate:1",

    auxiliaryTokenId: "token:auxiliary",
    participleTokenId: "token:participle",

    structuralBindingId: "structural-binding:1",
    predicateOwnershipId: "predicate-ownership:1",
    finiteTenseFactId: "finite-tense-source:1",

    sourceKind: "grammar_morph_form_registry_v1",
    sourceKey: "FiniteTense",
    sourceValue: "Pres",
    sourceId: "finite-tense-source:1",

    evidenceIds: ["ev:tense"],
    provenanceIds: ["prov:tense"],
  };
}

Deno.test("A8.13.3 exact construction occurrence joins registry binding and tense candidate", () => {
  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [registryBinding()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "candidate missing");

  const candidate = result.candidates[0];

  assert(candidate.status === "candidate", "must remain candidate");
  assert(
    candidate.constructionId === "construction:1",
    "constructionId lost",
  );
  assert(
    candidate.projectionId === "projection:1",
    "projectionId lost",
  );
  assert(candidate.predicateId === "predicate:1", "predicateId lost");
});

Deno.test("A8.13.3 constructionId mismatch does not bind", () => {
  const binding = registryBinding();
  binding.constructionId = "construction:other";

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "registry_binding_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.13.3 projectionId mismatch does not bind", () => {
  const binding = registryBinding();
  binding.projectionId = "projection:other";

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "registry_binding_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.13.3 duplicate exact registry bindings fail closed", () => {
  const first = registryBinding();
  const second = registryBinding();
  second.id = "registry-binding:2";

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [first, second],
  );

  assert(result.candidates.length === 0, "must not choose a winner");
  assert(
    result.rejections[0]?.reason === "ambiguous_registry_binding",
    "wrong rejection",
  );
});

Deno.test("A8.13.3 unrelated registry binding does not create ambiguity", () => {
  const unrelated = registryBinding();
  unrelated.id = "registry-binding:other";
  unrelated.constructionId = "construction:other";

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [registryBinding(), unrelated],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "exact binding missing");
});

Deno.test("A8.13.3 does not require registry anchor to equal auxiliary token", () => {
  const binding = registryBinding();
  const tense = tenseCandidate();

  assert(
    binding.anchorTokenId !== tense.auxiliaryTokenId,
    "fixture must prove unequal identities",
  );

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tense],
    [binding],
  );

  assert(result.rejections.length === 0, "anchor inequality must not reject");
  assert(result.candidates.length === 1, "candidate missing");

  const candidate = result.candidates[0];

  assert(
    candidate.registryAnchorTokenId === "token:registry-anchor",
    "registry anchor lost",
  );

  assert(
    candidate.auxiliaryTokenId === "token:auxiliary",
    "auxiliary identity lost",
  );
});

Deno.test("A8.13.3 preserves participle and predicate identity", () => {
  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [registryBinding()],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.participleTokenId === "token:participle",
    "participle identity lost",
  );

  assert(
    candidate.predicateId === "predicate:1",
    "predicate identity lost",
  );
});

Deno.test("A8.13.3 canonicalFeatures remain opaque transport", () => {
  const binding = registryBinding();

  binding.canonicalFeatures = {
    ArbitraryRegistryFeature: "ArbitraryRegistryValue",
  };

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.canonicalFeatures.ArbitraryRegistryFeature ===
      "ArbitraryRegistryValue",
    "canonicalFeatures were not transported exactly",
  );
});

Deno.test("A8.13.3 copies canonicalFeatures instead of sharing mutable object", () => {
  const binding = registryBinding();

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  candidate.canonicalFeatures.ConsumerLocal = "local";

  assert(
    binding.canonicalFeatures.ConsumerLocal === undefined,
    "upstream registry features were mutated",
  );
});

Deno.test("A8.13.3 preserves evidence from both upstream boundaries", () => {
  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [registryBinding()],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.evidenceIds.includes("ev:registry"),
    "registry evidence lost",
  );

  assert(
    candidate.evidenceIds.includes("ev:tense"),
    "tense evidence lost",
  );
});

Deno.test("A8.13.3 preserves provenance from both upstream boundaries", () => {
  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [registryBinding()],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.provenanceIds.includes("prov:registry"),
    "registry provenance lost",
  );

  assert(
    candidate.provenanceIds.includes("prov:tense"),
    "tense provenance lost",
  );
});

Deno.test("A8.13.3 registry provenance is mandatory", () => {
  const binding = registryBinding();
  binding.provenanceIds = [];

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.13.3 tense provenance is mandatory", () => {
  const tense = tenseCandidate();
  tense.provenanceIds = [];

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tense],
    [registryBinding()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.13.3 registryFormKey remains opaque", () => {
  const binding = registryBinding();
  binding.registryFormKey = "completely-opaque-form-key";

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.registryFormKey === "completely-opaque-form-key",
    "registryFormKey was interpreted",
  );
});

Deno.test("A8.13.3 output feature mutation does not mutate registry input", () => {
  const binding = registryBinding();

  const result = bridgeCanonicalTamConstructionTenseRegistryV1(
    [tenseCandidate()],
    [binding],
  );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  const before = { ...binding.canonicalFeatures };

  candidate.canonicalFeatures.LocalOnly = "x";

  assert(
    JSON.stringify(binding.canonicalFeatures) === JSON.stringify(before),
    "registry input mutated",
  );
});




import {
  bindCanonicalAuxiliaryParticipleV1,
  type CanonicalAuxiliaryParticipleConstructionV1,
  type CanonicalAuxiliaryParticipleDependencyV1,
  type CanonicalAuxiliaryParticipleMorphReadingV1,
} from "./canonical-auxiliary-participle-binding-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function construction(
  patch: Partial<CanonicalAuxiliaryParticipleConstructionV1> = {},
): CanonicalAuxiliaryParticipleConstructionV1 {
  return {
    constructionId: "construction:1",
    projectionId: "projection:1",
    anchorTokenId: "tok:aux",
    memberTokenIds: ["tok:aux", "tok:part"],
    evidenceIds: ["ev:construction"],
    provenanceIds: ["prov:construction"],
    ...patch,
  };
}

function dependency(
  patch: Partial<CanonicalAuxiliaryParticipleDependencyV1> = {},
): CanonicalAuxiliaryParticipleDependencyV1 {
  return {
    dependencyId: "dep:1",
    relation: "auxiliary_governs",
    sourceTokenId: "tok:aux",
    targetTokenId: "tok:part",
    status: "resolved",
    evidenceIds: ["ev:dependency"],
    provenanceIds: ["prov:dependency"],
    ...patch,
  };
}

function morph(
  patch: Partial<CanonicalAuxiliaryParticipleMorphReadingV1> = {},
): CanonicalAuxiliaryParticipleMorphReadingV1 {
  return {
    morphReadingId: "morph:part",
    tokenId: "tok:part",
    status: "candidate",
    canonicalFeatures: {
      VerbForm: "Part",
      Tense: "Past",
    },
    evidenceIds: ["ev:morph"],
    provenanceIds: ["prov:morph"],
    ...patch,
  };
}

Deno.test("A8.10 exact generic auxiliary + participle binding", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "candidate missing");

  const candidate = result.candidates[0];

  assert(candidate.status === "candidate", "must remain candidate");
  assert(candidate.auxiliaryTokenId === "tok:aux", "wrong auxiliary token");
  assert(candidate.participleTokenId === "tok:part", "wrong participle token");
  assert(candidate.dependencyId === "dep:1", "dependency identity lost");
  assert(candidate.morphReadingId === "morph:part", "morph identity lost");

  assert(
    candidate.provenanceIds.includes("prov:construction") &&
      candidate.provenanceIds.includes("prov:dependency") &&
      candidate.provenanceIds.includes("prov:morph"),
    "provenance not preserved",
  );
});

Deno.test("A8.10 wrong dependency relation fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency({ relation: "object" })],
    [morph()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "dependency_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.10 dependency endpoints must be construction members", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency({ targetTokenId: "tok:outside" })],
    [morph({ tokenId: "tok:outside" })],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "dependency_endpoint_not_member",
    "wrong rejection",
  );
});

Deno.test("A8.10 unrelated auxiliary dependency does not create ambiguity", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [
      dependency(),
      dependency({
        dependencyId: "dep:other",
        sourceTokenId: "tok:other-aux",
        targetTokenId: "tok:other-part",
      }),
    ],
    [morph()],
  );

  assert(result.rejections.length === 0, "unrelated dependency must be ignored");
  assert(result.candidates.length === 1, "exact local binding must survive");
  assert(
    result.candidates[0]?.dependencyId === "dep:1",
    "wrong dependency selected",
  );
});

Deno.test("A8.10 unresolved dependency fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency({ status: "candidate" })],
    [morph()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "dependency_not_resolved",
    "wrong rejection",
  );
});

Deno.test("A8.10 dependency provenance is mandatory", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency({ provenanceIds: [] })],
    [morph()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "dependency_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.10 complement must explicitly be participial", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph({ canonicalFeatures: { VerbForm: "Inf" } })],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "participle_morph_not_eligible",
    "wrong rejection",
  );
});

Deno.test("A8.10 blocked participle morphology fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph({ status: "blocked" })],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "participle_morph_not_eligible",
    "wrong rejection",
  );
});

Deno.test("A8.10 rejected participle morphology fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph({ status: "rejected" })],
  );

  assert(result.candidates.length === 0, "must not bind");
});

Deno.test("A8.10 participle morphology provenance is mandatory", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph({ provenanceIds: [] })],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "participle_morph_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.10 ambiguous dependency fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [
      dependency({ dependencyId: "dep:1" }),
      dependency({ dependencyId: "dep:2" }),
    ],
    [morph()],
  );

  assert(result.candidates.length === 0, "must not choose dependency");
  assert(
    result.rejections[0]?.reason === "ambiguous_dependency",
    "wrong rejection",
  );
});

Deno.test("A8.10 ambiguous participle reading fails closed", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [
      morph({ morphReadingId: "morph:1" }),
      morph({ morphReadingId: "morph:2" }),
    ],
  );

  assert(result.candidates.length === 0, "must not choose morph reading");
  assert(
    result.rejections[0]?.reason === "ambiguous_participle_morph",
    "wrong rejection",
  );
});

Deno.test("A8.10 exact token occurrence is required", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph({ tokenId: "tok:other" })],
  );

  assert(result.candidates.length === 0, "must not bind by morphology alone");
  assert(
    result.rejections[0]?.reason === "participle_morph_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.10 construction provenance is mandatory", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction({ provenanceIds: [] })],
    [dependency()],
    [morph()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "invalid_construction",
    "wrong rejection",
  );
});

Deno.test("A8.10 does not require tense semantics", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [
      morph({
        canonicalFeatures: {
          VerbForm: "Part",
        },
      }),
    ],
  );

  assert(result.candidates.length === 1, "participle structure should bind");
});

Deno.test("A8.10 preserves evidence from all inputs", () => {
  const result = bindCanonicalAuxiliaryParticipleV1(
    [construction()],
    [dependency()],
    [morph()],
  );

  const evidence = result.candidates[0]?.evidenceIds ?? [];

  assert(evidence.includes("ev:construction"), "construction evidence lost");
  assert(evidence.includes("ev:dependency"), "dependency evidence lost");
  assert(evidence.includes("ev:morph"), "morph evidence lost");
});



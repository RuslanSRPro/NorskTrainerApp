import {
  applyCanonicalGenericTenseConstructionOperatorV1,
  type CanonicalGenericFiniteTenseFactV1,
  type CanonicalGenericTenseConstructionBindingV1,
  type CanonicalGenericTensePredicateOwnershipV1,
} from "./canonical-generic-tense-construction-operator-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function binding(
  patch: Partial<CanonicalGenericTenseConstructionBindingV1> = {},
): CanonicalGenericTenseConstructionBindingV1 {
  return {
    bindingId: "binding:1",
    status: "candidate",
    constructionId: "construction:1",
    projectionId: "projection:1",
    auxiliaryTokenId: "tok:aux",
    participleTokenId: "tok:part",
    dependencyId: "dep:1",
    morphReadingId: "morph:part",
    evidenceIds: ["ev:binding"],
    provenanceIds: ["prov:binding"],
    ...patch,
  };
}

function ownership(
  patch: Partial<CanonicalGenericTensePredicateOwnershipV1> = {},
): CanonicalGenericTensePredicateOwnershipV1 {
  return {
    ownershipId: "ownership:1",
    status: "candidate",
    constructionId: "construction:1",
    projectionId: "projection:1",
    predicateId: "predicate:1",
    constructionAnchorTokenId: "tok:aux",
    predicateAnchorHeadId: "tok:aux",
    sharedMemberTokenId: "tok:aux",
    evidenceIds: ["ev:ownership"],
    provenanceIds: ["prov:ownership"],
    ...patch,
  };
}

function tenseFact(
  patch: Partial<CanonicalGenericFiniteTenseFactV1> = {},
): CanonicalGenericFiniteTenseFactV1 {
  return {
    factId: "fact:tense:1",
    status: "candidate",
    predicateId: "predicate:1",
    headTokenId: "tok:aux",
    sourceKind: "grammar_morph_form_registry_v1",
    sourceKey: "FiniteTense",
    sourceValue: "Pres",
    sourceId: "morph:aux",
    evidenceIds: ["ev:tense"],
    provenanceIds: ["prov:tense"],
    ...patch,
  };
}

Deno.test("A8.11.2 joins structural binding, ownership, and finite tense exactly", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "candidate missing");

  const candidate = result.candidates[0];

  assert(candidate.status === "candidate", "must remain candidate");
  assert(candidate.constructionId === "construction:1", "construction lost");
  assert(candidate.projectionId === "projection:1", "projection lost");
  assert(candidate.predicateId === "predicate:1", "predicate lost");
  assert(candidate.auxiliaryTokenId === "tok:aux", "auxiliary lost");
  assert(candidate.participleTokenId === "tok:part", "participle lost");
  assert(candidate.sourceValue === "Pres", "source value lost");
});

Deno.test("A8.11.2 transports Past without perfect reinterpretation", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ sourceValue: "Past" })],
  );

  assert(result.candidates.length === 1, "candidate missing");
  assert(result.candidates[0]?.sourceValue === "Past", "Past not preserved");
});

Deno.test("A8.11.2 ownership must match exact construction occurrence", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ constructionId: "construction:other" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 ownership must match exact projection occurrence", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ projectionId: "projection:other" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 unrelated ownership does not create ambiguity", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [
      ownership(),
      ownership({
        ownershipId: "ownership:other",
        constructionId: "construction:other",
        projectionId: "projection:other",
        predicateId: "predicate:other",
      }),
    ],
    [tenseFact()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "local ownership missing");
  assert(
    result.candidates[0]?.predicateOwnershipId === "ownership:1",
    "wrong ownership selected",
  );
});

Deno.test("A8.11.2 same construction ownership with another anchor does not create ambiguity", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [
      ownership(),
      ownership({
        ownershipId: "ownership:wrong-anchor",
        predicateId: "predicate:wrong-anchor",
        constructionAnchorTokenId: "tok:other",
        predicateAnchorHeadId: "tok:other",
        sharedMemberTokenId: "tok:other",
      }),
    ],
    [tenseFact()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "exact ownership must survive");
  assert(
    result.candidates[0]?.predicateOwnershipId === "ownership:1",
    "incompatible anchor ownership must be ignored",
  );
});

Deno.test("A8.11.2 duplicate local ownership fails closed", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [
      ownership({ ownershipId: "ownership:1" }),
      ownership({ ownershipId: "ownership:2" }),
    ],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must not choose ownership");
  assert(
    result.rejections[0]?.reason === "ambiguous_predicate_ownership",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 ownership must remain candidate", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ status: "resolved" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_candidate",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 ownership anchor must equal structural auxiliary", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ constructionAnchorTokenId: "tok:other" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 predicate anchor must equal structural auxiliary", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ predicateAnchorHeadId: "tok:other" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 ownership shared token must equal structural auxiliary", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ sharedMemberTokenId: "tok:other" })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 ownership provenance is mandatory", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership({ provenanceIds: [] })],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_ownership_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 finite tense must match exact predicate ownership", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ predicateId: "predicate:other" })],
  );

  assert(result.candidates.length === 0, "must not conflate predicates");
  assert(
    result.rejections[0]?.reason === "finite_tense_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 finite tense must match exact auxiliary token", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ headTokenId: "tok:other" })],
  );

  assert(result.candidates.length === 0, "must not conflate tokens");
  assert(
    result.rejections[0]?.reason === "finite_tense_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 same token on another predicate does not create ambiguity", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [
      tenseFact(),
      tenseFact({
        factId: "fact:other-predicate",
        predicateId: "predicate:other",
      }),
    ],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "exact predicate fact missing");
  assert(
    result.candidates[0]?.finiteTenseFactId === "fact:tense:1",
    "wrong tense fact selected",
  );
});

Deno.test("A8.11.2 unrelated token and predicate fact is ignored", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [
      tenseFact(),
      tenseFact({
        factId: "fact:unrelated",
        predicateId: "predicate:other",
        headTokenId: "tok:other",
      }),
    ],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "candidate missing");
});

Deno.test("A8.11.2 duplicate exact finite tense facts fail closed", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [
      tenseFact({ factId: "fact:1" }),
      tenseFact({ factId: "fact:2" }),
    ],
  );

  assert(result.candidates.length === 0, "must not choose tense fact");
  assert(
    result.rejections[0]?.reason === "ambiguous_finite_tense",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 structural binding must remain candidate", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding({ status: "resolved" })],
    [ownership()],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "structural_binding_not_candidate",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 structural provenance is mandatory", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding({ provenanceIds: [] })],
    [ownership()],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "structural_binding_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 finite tense must remain candidate", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ status: "resolved" })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "finite_tense_not_candidate",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 requires registry-backed finite tense source", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ sourceKind: "other_source" })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "finite_tense_wrong_source",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 requires explicit FiniteTense selector", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ sourceKey: "Tense" })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "finite_tense_wrong_selector",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 unsupported finite tense value fails closed", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ sourceValue: "Future" })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "finite_tense_unsupported_value",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 finite tense provenance is mandatory", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact({ provenanceIds: [] })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "finite_tense_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.11.2 preserves evidence and provenance from all three authorities", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [binding()],
    [ownership()],
    [tenseFact()],
  );

  const candidate = result.candidates[0];

  assert(candidate !== undefined, "candidate missing");

  for (const evidence of ["ev:binding", "ev:ownership", "ev:tense"]) {
    assert(candidate.evidenceIds.includes(evidence), `lost ${evidence}`);
  }

  for (const provenance of ["prov:binding", "prov:ownership", "prov:tense"]) {
    assert(
      candidate.provenanceIds.includes(provenance),
      `lost ${provenance}`,
    );
  }
});

Deno.test("A8.11.2 invalid structural identity fails closed", () => {
  const result = applyCanonicalGenericTenseConstructionOperatorV1(
    [
      binding({
        auxiliaryTokenId: "tok:same",
        participleTokenId: "tok:same",
      }),
    ],
    [ownership()],
    [tenseFact()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "invalid_structural_binding",
    "wrong rejection",
  );
});


import {
  bindCanonicalConstructionPredicateOwnershipV1,
  type CanonicalConstructionPredicateOwnershipConstructionV1,
  type CanonicalConstructionPredicateOwnershipPredicateV1,
} from "./canonical-construction-predicate-ownership-boundary-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function construction(
  patch: Partial<CanonicalConstructionPredicateOwnershipConstructionV1> = {},
): CanonicalConstructionPredicateOwnershipConstructionV1 {
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

function predicate(
  patch: Partial<CanonicalConstructionPredicateOwnershipPredicateV1> = {},
): CanonicalConstructionPredicateOwnershipPredicateV1 {
  return {
    predicateId: "predicate:1",
    anchorHeadId: "tok:aux",
    status: "candidate",
    evidenceIds: ["ev:predicate"],
    provenanceIds: ["prov:predicate"],
    ...patch,
  };
}

Deno.test("A8.11.4 binds predicate by exact construction anchor token identity", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate()],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "candidate missing");

  const candidate = result.candidates[0];

  assert(candidate.status === "candidate", "must remain candidate");
  assert(candidate.constructionId === "construction:1", "construction lost");
  assert(candidate.projectionId === "projection:1", "projection lost");
  assert(candidate.predicateId === "predicate:1", "predicate lost");
  assert(candidate.sharedMemberTokenId === "tok:aux", "member identity lost");
});

Deno.test("A8.11.4 predicate outside construction occurrence is ignored", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate({ anchorHeadId: "tok:outside" })],
  );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "predicate_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 unrelated predicate does not create ambiguity", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [
      predicate(),
      predicate({
        predicateId: "predicate:other",
        anchorHeadId: "tok:outside",
      }),
    ],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "local predicate must survive");
  assert(
    result.candidates[0]?.predicateId === "predicate:1",
    "wrong predicate selected",
  );
});

Deno.test("A8.11.4 non-anchor construction member does not own predicate", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [
      predicate({
        predicateId: "predicate:aux",
        anchorHeadId: "tok:aux",
      }),
      predicate({
        predicateId: "predicate:part",
        anchorHeadId: "tok:part",
      }),
    ],
  );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "anchor owner must survive");
  assert(
    result.candidates[0]?.predicateId === "predicate:aux",
    "non-anchor member must not own predicate",
  );
  assert(
    result.candidates[0]?.sharedMemberTokenId === "tok:aux",
    "ownership must preserve exact construction anchor",
  );
});

Deno.test("A8.11.4 duplicate predicate ownership fails closed", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [
      predicate({ predicateId: "predicate:1" }),
      predicate({ predicateId: "predicate:2" }),
    ],
  );

  assert(result.candidates.length === 0, "must not choose predicate");
  assert(
    result.rejections[0]?.reason === "ambiguous_predicate",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 blocked predicate fails closed", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate({ status: "blocked" })],
  );

  assert(result.candidates.length === 0, "blocked predicate must not bind");
  assert(
    result.rejections[0]?.reason === "predicate_not_eligible",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 rejected predicate fails closed", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate({ status: "rejected" })],
  );

  assert(result.candidates.length === 0, "rejected predicate must not bind");
  assert(
    result.rejections[0]?.reason === "predicate_not_eligible",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 construction provenance is mandatory", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction({ provenanceIds: [] })],
    [predicate()],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "construction_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 predicate provenance is mandatory", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate({ provenanceIds: [] })],
  );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "predicate_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 construction anchor must be an exact member", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [
      construction({
        anchorTokenId: "tok:not-member",
      }),
    ],
    [predicate()],
  );

  assert(result.candidates.length === 0, "invalid construction must fail");
  assert(
    result.rejections[0]?.reason === "invalid_construction_occurrence",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 empty construction members fail closed", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [
      construction({
        memberTokenIds: [],
      }),
    ],
    [predicate()],
  );

  assert(result.candidates.length === 0, "invalid construction must fail");
  assert(
    result.rejections[0]?.reason === "invalid_construction_occurrence",
    "wrong rejection",
  );
});

Deno.test("A8.11.4 preserves evidence and provenance from both occurrences", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate()],
  );

  const candidate = result.candidates[0];

  assert(candidate !== undefined, "candidate missing");
  assert(
    candidate.evidenceIds.includes("ev:construction"),
    "construction evidence lost",
  );
  assert(
    candidate.evidenceIds.includes("ev:predicate"),
    "predicate evidence lost",
  );
  assert(
    candidate.provenanceIds.includes("prov:construction"),
    "construction provenance lost",
  );
  assert(
    candidate.provenanceIds.includes("prov:predicate"),
    "predicate provenance lost",
  );
});

Deno.test("A8.11.4 output does not resolve ownership authority", () => {
  const result = bindCanonicalConstructionPredicateOwnershipV1(
    [construction()],
    [predicate({ status: "resolved" })],
  );

  assert(result.candidates.length === 1, "eligible predicate should bind");
  assert(
    result.candidates[0]?.status === "candidate",
    "ownership output must remain candidate",
  );
});



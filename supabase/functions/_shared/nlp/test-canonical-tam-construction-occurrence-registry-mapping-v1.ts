import {
  bindCanonicalTamConstructionOccurrenceRegistryMappingV1,
  toCanonicalTamConstructionRegistryBindingRuleV1,
  type CanonicalTamConstructionOccurrenceSelectorEnvelopeV1,
} from "./canonical-tam-construction-occurrence-registry-mapping-v1.ts";

import {
  CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_PRODUCER,
  CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_VERSION,
  type CanonicalTamConstructionRegistryMappingCandidateV1,
  type CanonicalTamConstructionSourceSelectorV1,
} from "./canonical-tam-construction-registry-mapping-authority-v1.ts";

import type {
  CanonicalTamConstructionRegistryBindingRuleV1,
} from "./canonical-tam-construction-registry-binding-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function selector(
  patch: Partial<CanonicalTamConstructionSourceSelectorV1> = {},
): CanonicalTamConstructionSourceSelectorV1 {
  return {
    selectorKind: "frozen_grammar_source_candidate_code",
    selectorValue: "verb.tense.forms.present_perfect",
    sourceId: "verb.tense.forms.present_perfect",
    provenanceIds: ["prov:selector"],
    ...patch,
  };
}

function envelope(
  patch: Partial<CanonicalTamConstructionOccurrenceSelectorEnvelopeV1> = {},
): CanonicalTamConstructionOccurrenceSelectorEnvelopeV1 {
  return {
    constructionId: "construction:1",
    projectionId: "projection:1",
    selector: selector(),
    ...patch,
  };
}

function mapping(
  patch: Partial<CanonicalTamConstructionRegistryMappingCandidateV1> = {},
): CanonicalTamConstructionRegistryMappingCandidateV1 {
  return {
    id: "mapping-candidate:1",
    producer:
      CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_PRODUCER,
    version:
      CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_VERSION,
    status: "candidate",
    selectorKind: "frozen_grammar_source_candidate_code",
    selectorValue: "verb.tense.forms.present_perfect",
    registryFormKey: "opaque-registry-form-key",
    sourceId: "verb.tense.forms.present_perfect",
    authoritySourceId: "authority:1",
    evidenceIds: ["ev:mapping"],
    provenanceIds: ["prov:mapping"],
    ...patch,
  };
}

Deno.test("A8.12.4 uses real A8.5 candidate contract and preserves occurrence identity", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping()],
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
  assert(
    candidate.mappingCandidateId === "mapping-candidate:1",
    "real A8.5 id not preserved",
  );
});

Deno.test("A8.12.4 requires exact selectorKind", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping({ selectorKind: "other-kind" })],
    );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "mapping_candidate_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 requires exact selectorValue", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping({ selectorValue: "other-value" })],
    );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "mapping_candidate_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 requires exact sourceId", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping({ sourceId: "other-source" })],
    );

  assert(result.candidates.length === 0, "must not bind");
  assert(
    result.rejections[0]?.reason === "mapping_candidate_not_found",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 unrelated mappings do not create ambiguity", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [
        mapping(),
        mapping({
          id: "mapping-candidate:other",
          selectorValue: "other-value",
          registryFormKey: "other-form-key",
        }),
      ],
    );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 1, "exact candidate missing");
  assert(
    result.candidates[0]?.mappingCandidateId === "mapping-candidate:1",
    "wrong mapping selected",
  );
});

Deno.test("A8.12.4 duplicate exact mapping candidates fail closed", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [
        mapping(),
        mapping({
          id: "mapping-candidate:2",
          registryFormKey: "another-form-key",
        }),
      ],
    );

  assert(result.candidates.length === 0, "must not choose a winner");
  assert(
    result.rejections[0]?.reason === "ambiguous_mapping_candidate",
    "wrong rejection",
  );
});


Deno.test("A8.12.4 invalid occurrence envelope fails closed", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope({ constructionId: "" })],
      [mapping()],
    );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "invalid_occurrence_envelope",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 selector provenance is mandatory", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [
        envelope({
          selector: selector({ provenanceIds: [] }),
        }),
      ],
      [mapping()],
    );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason === "selector_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 mapping provenance is mandatory", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping({ provenanceIds: [] })],
    );

  assert(result.candidates.length === 0, "must fail closed");
  assert(
    result.rejections[0]?.reason ===
      "mapping_candidate_missing_provenance",
    "wrong rejection",
  );
});

Deno.test("A8.12.4 preserves selector and mapping evidence/provenance", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping()],
    );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.evidenceIds.includes("ev:mapping"),
    "mapping evidence lost",
  );
  assert(
    !candidate.evidenceIds.includes("ev:selector"),
    "fabricated selector evidence must not appear",
  );
  assert(
    candidate.provenanceIds.includes("prov:selector"),
    "selector provenance lost",
  );
  assert(
    candidate.provenanceIds.includes("prov:mapping"),
    "mapping provenance lost",
  );
});

Deno.test("A8.12.4 same selector preserves distinct construction occurrences", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [
        envelope({
          constructionId: "construction:1",
          projectionId: "projection:1",
        }),
        envelope({
          constructionId: "construction:2",
          projectionId: "projection:2",
        }),
      ],
      [mapping()],
    );

  assert(result.rejections.length === 0, "unexpected rejection");
  assert(result.candidates.length === 2, "both occurrences must survive");

  assert(
    result.candidates.some((candidate) =>
      candidate.constructionId === "construction:1" &&
      candidate.projectionId === "projection:1"
    ),
    "first occurrence lost",
  );

  assert(
    result.candidates.some((candidate) =>
      candidate.constructionId === "construction:2" &&
      candidate.projectionId === "projection:2"
    ),
    "second occurrence lost",
  );
});

Deno.test("A8.12.4 registryFormKey remains opaque transport", () => {
  const opaque = "anything-the-authority-proved";

  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping({ registryFormKey: opaque })],
    );

  assert(result.candidates.length === 1, "candidate missing");
  assert(
    result.candidates[0]?.registryFormKey === opaque,
    "registryFormKey was interpreted",
  );
});

Deno.test("A8.12.4 preserves source and authority identities separately", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [
        mapping({
          sourceId: "verb.tense.forms.present_perfect",
          authoritySourceId: "authority:explicit-mapping",
        }),
      ],
    );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  assert(
    candidate.sourceId === "verb.tense.forms.present_perfect",
    "sourceId lost",
  );
  assert(
    candidate.authoritySourceId === "authority:explicit-mapping",
    "authoritySourceId lost",
  );
});

Deno.test("A8.12.4 mechanically converts candidate to real A8.2 binding rule", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping()],
    );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  const rule: CanonicalTamConstructionRegistryBindingRuleV1 =
    toCanonicalTamConstructionRegistryBindingRuleV1(candidate);

  assert(
    rule.constructionId === candidate.constructionId,
    "constructionId changed",
  );
  assert(
    rule.projectionId === candidate.projectionId,
    "projectionId changed",
  );
  assert(
    rule.registryFormKey === candidate.registryFormKey,
    "registryFormKey changed",
  );
  assert(
    rule.provenanceIds.includes("prov:selector"),
    "selector provenance missing from A8.2 rule",
  );
  assert(
    rule.provenanceIds.includes("prov:mapping"),
    "mapping provenance missing from A8.2 rule",
  );
});

Deno.test("A8.12.4 A8.2 rule conversion does not mutate candidate provenance", () => {
  const result =
    bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
      [envelope()],
      [mapping()],
    );

  const candidate = result.candidates[0];
  assert(candidate !== undefined, "candidate missing");

  const before = [...candidate.provenanceIds];

  const rule =
    toCanonicalTamConstructionRegistryBindingRuleV1(candidate);

  rule.provenanceIds.push("prov:consumer-local");

  assert(
    candidate.provenanceIds.length === before.length,
    "candidate provenance mutated",
  );
  assert(
    candidate.provenanceIds.every((value, index) =>
      value === before[index]
    ),
    "candidate provenance changed",
  );
});


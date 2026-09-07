import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const capability =
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1;

Deno.test("A4.6b3b0b0.1 capability identity version and proven status are exact", () => {
  assert(
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 ===
      "canonical_token_pos_normalized_label_eq_semantic_capability_v1",
    "unexpected capability id",
  );
  assert(
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 ===
      "1",
    "unexpected version",
  );
  assert(capability.status === "proven", JSON.stringify(capability));
});

Deno.test("A4.6b3b0b0.2 semantic domain is token POS normalized-label equality only", () => {
  assert(
    capability.semanticDomain ===
      "canonical_token_pos_normalized_label_equality",
    JSON.stringify(capability),
  );
  assert(
    capability.canonicalPropertyDomain === "canonical_token_occurrence",
    JSON.stringify(capability),
  );
  assert(
    capability.canonicalPropertyKind === "pos_hypothesis_set",
    JSON.stringify(capability),
  );
  assert(
    capability.canonicalOperatorLabel === "eq",
    JSON.stringify(capability),
  );
});

Deno.test("A4.6b3b0b0.3 normalization contract is string trim nonempty NFC nb-NO lowercase", () => {
  const n = CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1;
  assert(n.inputType === "string", JSON.stringify(n));
  assert(n.trimWhitespace === true, JSON.stringify(n));
  assert(n.emptyAfterTrimUnsupported === true, JSON.stringify(n));
  assert(n.unicodeNormalization === "NFC", JSON.stringify(n));
  assert(n.localeCaseTransform === "toLocaleLowerCase", JSON.stringify(n));
  assert(n.locale === "nb-NO", JSON.stringify(n));
  assert(
    n.equalityAfterNormalization === "exact_string_equality",
    JSON.stringify(n),
  );
});

Deno.test("A4.6b3b0b0.4 expected and actual labels share the exact same normalization contract", () => {
  assert(
    capability.expectedLabelNormalization ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
    "expected normalization is detached",
  );
  assert(
    capability.actualLabelNormalization ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
    "actual normalization is detached",
  );
  assert(
    capability.expectedLabelNormalization ===
      capability.actualLabelNormalization,
    "expected and actual contracts diverged",
  );
});

Deno.test("A4.6b3b0b0.5 equality semantics are normalized actual exact-string-equals normalized expected", () => {
  const e = capability.equalitySemantics;
  assert(e.leftValue === "normalized_actual_pos_label", JSON.stringify(e));
  assert(e.relation === "exact_string_equality", JSON.stringify(e));
  assert(e.rightValue === "normalized_expected_pos_label", JSON.stringify(e));
});

Deno.test("A4.6b3b0b0.6 source eq must already be proven and operator spelling is not interpreted here", () => {
  const s = capability.sourceRequirement;
  assert(s.exactRawSourceEqMustAlreadyBeProven === true, JSON.stringify(s));
  assert(s.sourceOperatorParsingPerformed === false, JSON.stringify(s));
  assert(s.operatorAliasNormalizationAuthorized === false, JSON.stringify(s));
});

Deno.test("A4.6b3b0b0.7 capability is family-neutral producer-independent and manifest-independent", () => {
  const g = capability.governance;
  assert(g.familyNeutral === true, JSON.stringify(g));
  assert(g.runtimeProducerIndependent === true, JSON.stringify(g));
  assert(g.manifestIndependent === true, JSON.stringify(g));
  assert(g.exactSourceEqRequired === true, JSON.stringify(g));
  assert(g.frozenGrammarReadOnly === true, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.8 capability specifies both label normalization sides and equality semantics", () => {
  const g = capability.governance;
  assert(g.expectedLabelNormalizationSpecified === true, JSON.stringify(g));
  assert(g.actualLabelNormalizationSpecified === true, JSON.stringify(g));
  assert(
    g.normalizedLabelEqualitySemanticsSpecified === true,
    JSON.stringify(g),
  );
});

Deno.test("A4.6b3b0b0.9 generic Runtime and generic JSON equality authority are excluded", () => {
  const g = capability.governance;
  assert(g.genericRuntimeEqAuthorityExcluded === true, JSON.stringify(g));
  assert(g.genericJsonEqualityAuthorityExcluded === true, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.10 capability owns no operator alias or POS vocabulary authority", () => {
  const g = capability.governance;
  assert(g.operatorAliasNormalizationAuthorized === false, JSON.stringify(g));
  assert(g.sourceOperatorParsingPerformed === false, JSON.stringify(g));
  assert(g.posVocabularyValidated === false, JSON.stringify(g));
  assert(g.operandKnownCanonicalPosLabel === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.11 capability performs no canonical POS read selection or operand read", () => {
  const g = capability.governance;
  assert(g.canonicalPosHypothesisRead === false, JSON.stringify(g));
  assert(g.canonicalPosHypothesisSelected === false, JSON.stringify(g));
  assert(g.expectedOperandReadPerformed === false, JSON.stringify(g));
  assert(g.actualPosLabelReadPerformed === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.12 semantic specification does not execute comparison or resolve truth", () => {
  const g = capability.governance;
  assert(g.comparisonExecuted === false, JSON.stringify(g));
  assert(g.comparisonTruthResolved === false, JSON.stringify(g));
  assert(g.runtimeConditionTruthResolved === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.13 semantic capability owns no sentence occurrence or cardinality execution", () => {
  const g = capability.governance;
  assert(g.sentenceDomainConsumed === false, JSON.stringify(g));
  assert(g.occurrenceEnumerationPerformed === false, JSON.stringify(g));
  assert(g.occurrenceFilteringPerformed === false, JSON.stringify(g));
  assert(g.occurrenceBindingPerformed === false, JSON.stringify(g));
  assert(g.cardinalityEnforcementPerformed === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.14 semantic capability never mutates graph or classifies learner error", () => {
  const g = capability.governance;
  assert(g.graphMutationPerformed === false, JSON.stringify(g));
  assert(g.learnerErrorClassified === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b0.15 capability result preserves exact exported capability identity", () => {
  assert(
    capability.capabilityId ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
    JSON.stringify(capability),
  );
  assert(
    capability.version ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
    JSON.stringify(capability),
  );
});

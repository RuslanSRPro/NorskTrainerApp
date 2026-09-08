import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1
    as CAP,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

Deno.test(
  "A4.6a1b.1 exact identity version normative Runtime-language provenance and structural-spec link",
  () => {
    assert(
      CAP.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1 &&
        CAP.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1 &&
        CAP.status ===
          "proven" &&
        CAP.authorityKind ===
          "runtime_language_specification" &&
        CAP.decisionStatus ===
          "normative" &&
        CAP.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1 &&
        CAP.structuralSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.2 compound operator vocabulary is exact and closed",
  () => {
    assert(
      JSON.stringify(
        CAP.operatorVocabulary,
      ) ===
        JSON.stringify([
          "all",
          "any",
          "not",
        ]),
      JSON.stringify(CAP.operatorVocabulary),
    );
  },
);

Deno.test(
  "A4.6a1b.3 truth disposition domain is exactly resolved_true resolved_false unresolved",
  () => {
    assert(
      JSON.stringify(
            CAP.truthDispositionDomain,
          ) ===
          JSON.stringify([
            "resolved_true",
            "resolved_false",
            "unresolved",
          ]) &&
        CAP.blockedOutsideTruthDomain ===
          true &&
        CAP.unsupportedOutsideTruthDomain ===
          true,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.4 all any resolved_false semantically dominates to resolved_false",
  () => {
    assert(
      CAP.allSemantics
            .resultByVectorClass
            .anyResolvedFalse ===
          "resolved_false" &&
        CAP.allSemantics.resolvedFalseRule ===
          "any_child_resolved_false",
      JSON.stringify(CAP.allSemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.5 all all resolved_true semantically resolves true",
  () => {
    assert(
      CAP.allSemantics
            .resultByVectorClass
            .allResolvedTrue ===
          "resolved_true" &&
        CAP.allSemantics.resolvedTrueRule ===
          "all_children_resolved_true",
      JSON.stringify(CAP.allSemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.6 all otherwise remains unresolved rather than false",
  () => {
    assert(
      CAP.allSemantics
            .resultByVectorClass
            .otherwise ===
          "unresolved" &&
        CAP.unresolvedSemantics
            .allWithUnresolvedAndNoFalseRemainsUnresolved ===
          true &&
        CAP.unresolvedSemantics
            .unresolvedMayCollapseToFalse ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.7 any any resolved_true semantically dominates to resolved_true",
  () => {
    assert(
      CAP.anySemantics
            .resultByVectorClass
            .anyResolvedTrue ===
          "resolved_true" &&
        CAP.anySemantics.resolvedTrueRule ===
          "any_child_resolved_true",
      JSON.stringify(CAP.anySemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.8 any all resolved_false semantically resolves false",
  () => {
    assert(
      CAP.anySemantics
            .resultByVectorClass
            .allResolvedFalse ===
          "resolved_false" &&
        CAP.anySemantics.resolvedFalseRule ===
          "all_children_resolved_false",
      JSON.stringify(CAP.anySemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.9 any otherwise remains unresolved rather than true",
  () => {
    assert(
      CAP.anySemantics
            .resultByVectorClass
            .otherwise ===
          "unresolved" &&
        CAP.unresolvedSemantics
            .anyWithUnresolvedAndNoTrueRemainsUnresolved ===
          true &&
        CAP.unresolvedSemantics
            .unresolvedMayCollapseToTrue ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.10 not resolved_true maps to resolved_false",
  () => {
    assert(
      CAP.notSemantics
        .resultByChildDisposition
        .resolved_true ===
        "resolved_false",
      JSON.stringify(CAP.notSemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.11 not resolved_false maps to resolved_true",
  () => {
    assert(
      CAP.notSemantics
        .resultByChildDisposition
        .resolved_false ===
        "resolved_true",
      JSON.stringify(CAP.notSemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.12 not unresolved preserves unresolved",
  () => {
    assert(
      CAP.notSemantics
            .resultByChildDisposition
            .unresolved ===
          "unresolved" &&
        CAP.unresolvedSemantics
            .unresolvedPreservedByNot ===
          true,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.13 structural arity and encoding requirements match A4.6a1a without executing them",
  () => {
    assert(
      CAP.allSemantics.requiredEncoding ===
          "array" &&
        CAP.allSemantics.minimumStructuralArity ===
          2 &&
        CAP.anySemantics.requiredEncoding ===
          "array" &&
        CAP.anySemantics.minimumStructuralArity ===
          2 &&
        CAP.notSemantics.requiredEncoding ===
          "unary_object" &&
        CAP.notSemantics.exactStructuralArity ===
          1,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.14 unsupported empty singleton and unknown forms receive no boolean identities",
  () => {
    assert(
      CAP.unsupportedSemantics
            .unsupportedShapeIsFalse ===
          false &&
        CAP.unsupportedSemantics
            .unsupportedShapeIsTrue ===
          false &&
        CAP.unsupportedSemantics
            .emptyGroupTruthSpecified ===
          false &&
        CAP.unsupportedSemantics
            .singletonGroupTruthSpecified ===
          false &&
        CAP.unsupportedSemantics
            .unknownOperatorTruthSpecified ===
          false,
      JSON.stringify(CAP.unsupportedSemantics),
    );
  },
);

Deno.test(
  "A4.6a1b.15 all and any truth semantics are child-order independent",
  () => {
    assert(
      CAP.allSemantics
            .childOrderAffectsTruthResult ===
          false &&
        CAP.anySemantics
            .childOrderAffectsTruthResult ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "A4.6a1b.16 capability is authored Runtime IR semantics not NRG or source_verified grammar evidence",
  () => {
    const g = CAP.governance;

    assert(
      g.runtimeLanguageSpecificationAuthoredHere ===
          true &&
        g.grammarSourceEvidenceConsumed ===
          false &&
        g.nrgSourceVerifiedEvidenceClaimed ===
          false &&
        g.sourceVerifiedGrammarEvidenceClaimed ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1b.17 capability is specification-only and consumes no tree leaf or execution evidence",
  () => {
    const g = CAP.governance;

    assert(
      g.runtimeManifestExecutionEvidenceConsumed ===
          false &&
        g.a46a1aResultConsumed ===
          false &&
        g.whereTreeConsumed ===
          false &&
        g.treeTraversalPerformed ===
          false &&
        g.childTruthEvidenceConsumed ===
          false &&
        g.leafTruthEvidenceConsumed ===
          false &&
        g.booleanExecutionPerformed ===
          false &&
        g.compoundTruthComposed ===
          false &&
        g.shortCircuitExecuted ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1b.18 authority ceiling excludes manifest truth context binding cardinality mutation and learner error",
  () => {
    const g = CAP.governance;

    assert(
      g.manifestConditionTruthResolved ===
          false &&
        g.runtimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(g),
    );
  },
);

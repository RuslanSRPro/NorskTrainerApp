import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestCompoundOperatorKeyV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

// v1.46 A4.6a1b
//
// Compound Truth Semantic Capability.
//
// This is a normative Runtime-language specification.
// It is NOT Norwegian grammar evidence and does NOT claim NRG/source_verified
// provenance.
//
// It specifies three-valued truth semantics for structurally supported
// A4.6a1a compound operators:
//
//   all:
//     any resolved_false -> resolved_false
//     all resolved_true  -> resolved_true
//     otherwise          -> unresolved
//
//   any:
//     any resolved_true  -> resolved_true
//     all resolved_false -> resolved_false
//     otherwise          -> unresolved
//
//   not:
//     resolved_true  -> resolved_false
//     resolved_false -> resolved_true
//     unresolved     -> unresolved
//
// blocked/unsupported states are outside the truth domain.
//
// This capability does NOT consume a WHERE tree, child evidence,
// Runtime occurrences, or leaf truth. It performs no recursive composition
// and executes no boolean condition.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1 =
  "canonical_runtime_manifest_binding_where_compound_truth_semantic_capability_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1 =
  "runtime_where_compound_truth_a4_6a1b_v1" as const;

export type CanonicalRuntimeManifestCompoundTruthDispositionV1 =
  | "resolved_true"
  | "resolved_false"
  | "unresolved";

export type CanonicalRuntimeManifestCompoundTruthSemanticCapabilityV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1;

  status: "proven";

  authorityKind: "runtime_language_specification";

  decisionStatus: "normative";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

  structuralSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

  operatorVocabulary: readonly CanonicalRuntimeManifestCompoundOperatorKeyV1[];

  truthDispositionDomain:
    readonly CanonicalRuntimeManifestCompoundTruthDispositionV1[];

  blockedOutsideTruthDomain: true;

  unsupportedOutsideTruthDomain: true;

  allSemantics: {
    requiredEncoding: "array";

    minimumStructuralArity: 2;

    resolvedFalseRule: "any_child_resolved_false";

    resolvedTrueRule: "all_children_resolved_true";

    unresolvedRule:
      "no_child_resolved_false_and_not_all_children_resolved_true";

    resultByVectorClass: {
      anyResolvedFalse: "resolved_false";

      allResolvedTrue: "resolved_true";

      otherwise: "unresolved";
    };

    childOrderAffectsTruthResult: false;
  };

  anySemantics: {
    requiredEncoding: "array";

    minimumStructuralArity: 2;

    resolvedTrueRule: "any_child_resolved_true";

    resolvedFalseRule: "all_children_resolved_false";

    unresolvedRule:
      "no_child_resolved_true_and_not_all_children_resolved_false";

    resultByVectorClass: {
      anyResolvedTrue: "resolved_true";

      allResolvedFalse: "resolved_false";

      otherwise: "unresolved";
    };

    childOrderAffectsTruthResult: false;
  };

  notSemantics: {
    requiredEncoding: "unary_object";

    exactStructuralArity: 1;

    resultByChildDisposition: {
      resolved_true: "resolved_false";

      resolved_false: "resolved_true";

      unresolved: "unresolved";
    };
  };

  unresolvedSemantics: {
    unresolvedMayCollapseToFalse: false;

    unresolvedMayCollapseToTrue: false;

    unresolvedPreservedByNot: true;

    allWithUnresolvedAndNoFalseRemainsUnresolved: true;

    anyWithUnresolvedAndNoTrueRemainsUnresolved: true;
  };

  unsupportedSemantics: {
    unsupportedShapeIsFalse: false;

    unsupportedShapeIsTrue: false;

    emptyGroupTruthSpecified: false;

    singletonGroupTruthSpecified: false;

    unknownOperatorTruthSpecified: false;
  };

  governance: {
    exactA46a1aStructuralSpecificationReferenced: true;

    runtimeLanguageSpecificationAuthoredHere: true;

    grammarSourceEvidenceConsumed: false;

    nrgSourceVerifiedEvidenceClaimed: false;

    sourceVerifiedGrammarEvidenceClaimed: false;

    runtimeManifestExecutionEvidenceConsumed: false;

    a46a1aResultConsumed: false;

    whereTreeConsumed: false;

    treeTraversalPerformed: false;

    childTruthEvidenceConsumed: false;

    leafTruthEvidenceConsumed: false;

    booleanExecutionPerformed: false;

    compoundTruthComposed: false;

    shortCircuitExecuted: false;

    manifestConditionTruthResolved: false;

    runtimeSentenceContextSelected: false;

    occurrenceFilteringPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1:
  CanonicalRuntimeManifestCompoundTruthSemanticCapabilityV1 = {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1,

    status: "proven",

    authorityKind: "runtime_language_specification",

    decisionStatus: "normative",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    operatorVocabulary: [
      "all",
      "any",
      "not",
    ],

    truthDispositionDomain: [
      "resolved_true",
      "resolved_false",
      "unresolved",
    ],

    blockedOutsideTruthDomain: true,

    unsupportedOutsideTruthDomain: true,

    allSemantics: {
      requiredEncoding: "array",

      minimumStructuralArity: 2,

      resolvedFalseRule: "any_child_resolved_false",

      resolvedTrueRule: "all_children_resolved_true",

      unresolvedRule:
        "no_child_resolved_false_and_not_all_children_resolved_true",

      resultByVectorClass: {
        anyResolvedFalse: "resolved_false",

        allResolvedTrue: "resolved_true",

        otherwise: "unresolved",
      },

      childOrderAffectsTruthResult: false,
    },

    anySemantics: {
      requiredEncoding: "array",

      minimumStructuralArity: 2,

      resolvedTrueRule: "any_child_resolved_true",

      resolvedFalseRule: "all_children_resolved_false",

      unresolvedRule:
        "no_child_resolved_true_and_not_all_children_resolved_false",

      resultByVectorClass: {
        anyResolvedTrue: "resolved_true",

        allResolvedFalse: "resolved_false",

        otherwise: "unresolved",
      },

      childOrderAffectsTruthResult: false,
    },

    notSemantics: {
      requiredEncoding: "unary_object",

      exactStructuralArity: 1,

      resultByChildDisposition: {
        resolved_true: "resolved_false",

        resolved_false: "resolved_true",

        unresolved: "unresolved",
      },
    },

    unresolvedSemantics: {
      unresolvedMayCollapseToFalse: false,

      unresolvedMayCollapseToTrue: false,

      unresolvedPreservedByNot: true,

      allWithUnresolvedAndNoFalseRemainsUnresolved: true,

      anyWithUnresolvedAndNoTrueRemainsUnresolved: true,
    },

    unsupportedSemantics: {
      unsupportedShapeIsFalse: false,

      unsupportedShapeIsTrue: false,

      emptyGroupTruthSpecified: false,

      singletonGroupTruthSpecified: false,

      unknownOperatorTruthSpecified: false,
    },

    governance: {
      exactA46a1aStructuralSpecificationReferenced: true,

      runtimeLanguageSpecificationAuthoredHere: true,

      grammarSourceEvidenceConsumed: false,

      nrgSourceVerifiedEvidenceClaimed: false,

      sourceVerifiedGrammarEvidenceClaimed: false,

      runtimeManifestExecutionEvidenceConsumed: false,

      a46a1aResultConsumed: false,

      whereTreeConsumed: false,

      treeTraversalPerformed: false,

      childTruthEvidenceConsumed: false,

      leafTruthEvidenceConsumed: false,

      booleanExecutionPerformed: false,

      compoundTruthComposed: false,

      shortCircuitExecuted: false,

      manifestConditionTruthResolved: false,

      runtimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },
  };

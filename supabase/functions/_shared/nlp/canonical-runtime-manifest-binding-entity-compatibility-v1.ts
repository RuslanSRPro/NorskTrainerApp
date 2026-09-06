/**
 * Norsk Trainer
 *
 * V1.46 A4.3a2
 *
 * FAMILY-NEUTRAL RUNTIME MANIFEST BINDING ENTITY COMPATIBILITY
 *
 * Composition:
 *
 *   exact A4.3a1 manifest-local binding-definition authority
 *       +
 *   explicit canonical graph node-type authority
 *       ->
 *   exact opaque entity-label / canonical-node-TYPE
 *   compatibility candidate
 *
 * Matching is exact.
 *
 * No Runtime entity vocabulary is hardcoded.
 * No case folding.
 * No normalization.
 * No inference from binding names.
 *
 * Unknown Runtime entity labels remain explicitly unmapped.
 *
 * This layer intentionally does NOT:
 *
 * - resolve entity semantics;
 * - enumerate graph occurrences;
 * - bind an occurrence;
 * - execute scope;
 * - execute WHERE;
 * - enforce cardinality;
 * - interpret action families;
 * - resolve set_role semantics;
 * - infer grammatical functions;
 * - infer subject_of;
 * - mutate the graph;
 * - select a winner;
 * - classify learner error.
 *
 * Compatibility candidate != resolved occurrence.
 */

import type {
  LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1 =
  "canonical_runtime_manifest_binding_entity_compatibility_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestGraphNodeTypeAuthorityV1 = {
  authorityId: string;

  status: "proven";

  nodeType: LanguageGraphNodeV1["type"];

  source: "canonical_language_graph_core_v1";
};

export type CanonicalRuntimeManifestBindingEntityCompatibilityV1 = {
  id: string;

  status: "candidate";

  bindingDefinitionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  bindingName: string;

  runtimeEntityLabel: string;

  canonicalNodeType: LanguageGraphNodeV1["type"];

  canonicalNodeTypeAuthorityId: string;

  governance: {
    exactA43a1ResultRequired: true;

    exactManifestBindingDefinitionAuthorityRequired: true;

    exactCanonicalNodeTypeAuthorityRequired: true;

    exactOpaqueLabelMatch: true;

    runtimeEntityVocabularyHardcoded: false;

    runtimeEntityLabelNormalized: false;

    caseFoldingPerformed: false;

    canonicalNodeTypeInferredFromBindingName: false;

    canonicalNodeTypeAuthorityIdentityPreserved: true;

    entitySemanticsResolved: false;

    occurrenceDomainResolved: false;

    occurrenceEnumerationPerformed: false;

    occurrenceBindingPerformed: false;

    scopeSemanticsResolved: false;

    whereSemanticsResolved: false;

    cardinalitySemanticsResolved: false;

    actionFamilySemanticsResolved: false;

    roleSemanticsResolved: false;

    grammaticalFunctionResolved: false;

    subjectOfRelationInferred: false;

    winnerSelected: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    compatibilityOnly: true;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestBindingEntityCompatibilityResultV1 = {
  producer: typeof CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  candidates: CanonicalRuntimeManifestBindingEntityCompatibilityV1[];

  unmappedBindingDefinitionAuthorityIds: string[];

  blockingReasons: string[];
};

function stringValue(
  value: unknown,
): string | null {
  if (
    typeof value !==
      "string" ||
    value.trim().length ===
      0
  ) {
    return null;
  }

  // Preserve exact source spelling.
  return value;
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function safeA43a1Result(
  result: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
): boolean {
  return (
    result.producer ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0
  );
}

function safeBindingAuthority(
  authority: CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "candidate" &&
    Boolean(
      stringValue(
        authority.id,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestCode,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.bindingName,
      ),
    ) &&
    g.exactValidatedManifestRequired ===
      true &&
    g.exactManifestIdentityRequired ===
      true &&
    g.manifestLocalBindingsOnly ===
      true &&
    g.actionAuthorityRequired ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.runtimeFamilyLabelPreservedOpaque ===
      true &&
    g.executionPhaseLabelPreservedOpaque ===
      true &&
    g.runtimeFamilySemanticsResolved ===
      false &&
    g.executionPhaseSemanticsResolved ===
      false &&
    g.bindingNamePreservedOpaque ===
      true &&
    g.bindingDefinitionPreservedOpaque ===
      true &&
    g.entityLabelPreservedOpaque ===
      true &&
    g.scopeLabelPreservedOpaque ===
      true &&
    g.cardinalityLabelPreservedOpaque ===
      true &&
    g.whereClausePreservedOpaque ===
      true &&
    g.entitySemanticsResolved ===
      false &&
    g.scopeSemanticsResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.referenceSemanticsResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.productionActivationAssumed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeCanonicalNodeTypeAuthority(
  authority: CanonicalRuntimeManifestGraphNodeTypeAuthorityV1,
): boolean {
  return (
    Boolean(
      stringValue(
        authority.authorityId,
      ),
    ) &&
    authority.status ===
      "proven" &&
    Boolean(
      stringValue(
        authority.nodeType,
      ),
    ) &&
    authority.source ===
      "canonical_language_graph_core_v1"
  );
}

function governance(): CanonicalRuntimeManifestBindingEntityCompatibilityV1[
  "governance"
] {
  return {
    exactA43a1ResultRequired: true,

    exactManifestBindingDefinitionAuthorityRequired: true,

    exactCanonicalNodeTypeAuthorityRequired: true,

    exactOpaqueLabelMatch: true,

    runtimeEntityVocabularyHardcoded: false,

    runtimeEntityLabelNormalized: false,

    caseFoldingPerformed: false,

    canonicalNodeTypeInferredFromBindingName: false,

    canonicalNodeTypeAuthorityIdentityPreserved: true,

    entitySemanticsResolved: false,

    occurrenceDomainResolved: false,

    occurrenceEnumerationPerformed: false,

    occurrenceBindingPerformed: false,

    scopeSemanticsResolved: false,

    whereSemanticsResolved: false,

    cardinalitySemanticsResolved: false,

    actionFamilySemanticsResolved: false,

    roleSemanticsResolved: false,

    grammaticalFunctionResolved: false,

    subjectOfRelationInferred: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    compatibilityOnly: true,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
  bindingResult: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  canonicalNodeTypeAuthorities:
    readonly CanonicalRuntimeManifestGraphNodeTypeAuthorityV1[],
): CanonicalRuntimeManifestBindingEntityCompatibilityResultV1 {
  const blockingReasons: string[] = [];

  const candidates: CanonicalRuntimeManifestBindingEntityCompatibilityV1[] = [];

  const unmapped: string[] = [];

  if (
    !safeA43a1Result(
      bindingResult,
    )
  ) {
    return {
      producer: CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unmappedBindingDefinitionAuthorityIds: [],

      blockingReasons: [
        "unsafe_a4_3a1_result",
      ],
    };
  }

  const seenBindingAuthorityIds = new Set<string>();

  for (
    const authority of bindingResult.authorities
  ) {
    if (
      seenBindingAuthorityIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate_id`,
      );

      continue;
    }

    seenBindingAuthorityIds.add(
      authority.id,
    );

    if (
      !safeBindingAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:unsafe_contract`,
      );
    }
  }

  const seenCanonicalAuthorityIds = new Set<string>();

  const nodeTypeByLabel = new Map<
    string,
    CanonicalRuntimeManifestGraphNodeTypeAuthorityV1
  >();

  for (
    const authority of canonicalNodeTypeAuthorities
  ) {
    const authorityId = stringValue(
      authority.authorityId,
    );

    const nodeType = stringValue(
      authority.nodeType,
    );

    if (
      !authorityId ||
      !nodeType ||
      !safeCanonicalNodeTypeAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `canonical_node_type_authority:${
          authorityId ?? "unknown"
        }:unsafe_contract`,
      );

      continue;
    }

    if (
      seenCanonicalAuthorityIds.has(
        authorityId,
      )
    ) {
      blockingReasons.push(
        `canonical_node_type_authority:${authorityId}:duplicate_id`,
      );

      continue;
    }

    seenCanonicalAuthorityIds.add(
      authorityId,
    );

    if (
      nodeTypeByLabel.has(
        nodeType,
      )
    ) {
      blockingReasons.push(
        `canonical_node_type:${nodeType}:duplicate_authority`,
      );

      continue;
    }

    nodeTypeByLabel.set(
      nodeType,
      authority,
    );
  }

  const reasons = uniqueSorted(
    blockingReasons,
  );

  if (
    reasons.length >
      0
  ) {
    return {
      producer: CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unmappedBindingDefinitionAuthorityIds: [],

      blockingReasons: reasons,
    };
  }

  for (
    const bindingAuthority of bindingResult.authorities
  ) {
    const entityLabel = stringValue(
      bindingAuthority.entityLabel,
    );

    if (!entityLabel) {
      unmapped.push(
        bindingAuthority.id,
      );

      continue;
    }

    const canonicalAuthority = nodeTypeByLabel.get(
      entityLabel,
    );

    if (!canonicalAuthority) {
      unmapped.push(
        bindingAuthority.id,
      );

      continue;
    }

    candidates.push({
      id: [
        "runtime-manifest-binding-entity-compatibility-v1",
        idPart(
          bindingAuthority.id,
        ),
        idPart(
          canonicalAuthority.nodeType,
        ),
      ].join(":"),

      status: "candidate",

      bindingDefinitionAuthorityId: bindingAuthority.id,

      manifestId: bindingAuthority.manifestId,

      manifestCode: bindingAuthority.manifestCode,

      bindingName: bindingAuthority.bindingName,

      runtimeEntityLabel: entityLabel,

      canonicalNodeType: canonicalAuthority.nodeType,

      canonicalNodeTypeAuthorityId: canonicalAuthority.authorityId,

      governance: governance(),
    });
  }

  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

    status: "ready",

    candidates: candidates.sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    unmappedBindingDefinitionAuthorityIds: uniqueSorted(
      unmapped,
    ),

    blockingReasons: [],
  };
}

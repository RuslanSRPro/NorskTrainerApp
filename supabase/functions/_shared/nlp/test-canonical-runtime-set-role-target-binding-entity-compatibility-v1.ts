import {
  CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,
  CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1,
  type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1,
} from "./canonical-runtime-set-role-target-reference-root-authority-v1.ts";

import {
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  type CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeManifestGraphNodeTypeAuthorityV1,
  deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";

import {
  deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1,
} from "./canonical-runtime-set-role-target-binding-entity-compatibility-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function bindingDefinition(
  entity: string = "phrase",
): Record<string, unknown> {
  return {
    entity,

    scope: "sentence",

    cardinality: "one",
  };
}

function manifest(
  entity: string = "phrase",
): Record<string, unknown> {
  return {
    id: "manifest-a",

    code: "ir.structural.clause.subject_finite_predicate",

    authoring_status: "validated",

    runtime_family: "structural",

    execution_phase: "clause",

    ir_spec: {
      bindings: {
        subject: bindingDefinition(
          entity,
        ),
      },
    },
  };
}

function neutralBindingResult(
  entity: string = "phrase",
): CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 {
  const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1([
    manifest(
      entity,
    ),
  ]);

  assert(
    result.status ===
      "ready",
    result.blockingReasons.join(","),
  );

  return result;
}

function nodeTypeAuthority(
  nodeType: CanonicalRuntimeManifestGraphNodeTypeAuthorityV1[
    "nodeType"
  ],
): CanonicalRuntimeManifestGraphNodeTypeAuthorityV1 {
  return {
    authorityId: `canonical-node-type:${nodeType}`,

    status: "proven",

    nodeType,

    source: "canonical_language_graph_core_v1",
  };
}

function entityCompatibilityResult(
  bindings: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  includePhrase: boolean = true,
): CanonicalRuntimeManifestBindingEntityCompatibilityResultV1 {
  const authorities: CanonicalRuntimeManifestGraphNodeTypeAuthorityV1[] =
    includePhrase
      ? [
        nodeTypeAuthority(
          "phrase",
        ),
      ]
      : [
        nodeTypeAuthority(
          "token",
        ),
      ];

  const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
    bindings,
    authorities,
  );

  assert(
    result.status ===
      "ready",
    result.blockingReasons.join(","),
  );

  return result;
}

function rootAuthority(
  options: {
    rooted?: boolean;
    rootMatch?:
      | "exact_binding"
      | "binding_prefix_with_opaque_suffix"
      | "unrooted";
    expression?: string;
    opaqueSuffix?: string | null;
    definition?: Record<string, unknown>;
  } = {},
): CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1 {
  const rooted = options.rooted ??
    true;

  const rootMatch = options.rootMatch ??
    (
      rooted ? "exact_binding" : "unrooted"
    );

  return {
    id: "a4.2-root:subject",

    status: "candidate",

    setRoleActionAuthorityId: "a4.1:set-role:subject",

    manifestId: "manifest-a",

    manifestCode: "ir.structural.clause.subject_finite_predicate",

    actionIndex: 1,

    actionTargetLabel: options.expression ??
      (
        rootMatch ===
            "binding_prefix_with_opaque_suffix"
          ? "subject.head"
          : "subject"
      ),

    rootMatch,

    rooted,

    rootBindingName: rooted ? "subject" : null,

    // Intentionally producer-specific and DIFFERENT from A4.3a1 id.
    rootBindingDefinitionAuthorityId: rooted
      ? "historical-a3.0-binding:subject"
      : null,

    rootBindingDefinition: rooted
      ? (
        options.definition ??
          bindingDefinition()
      )
      : null,

    opaqueSuffix: rootMatch ===
        "binding_prefix_with_opaque_suffix"
      ? (
        options.opaqueSuffix ??
          "head"
      )
      : null,

    sourceCandidateCodes: [],

    governance: {
      setRoleActionAuthorityRequired: true,

      exactValidatedManifestRequired: true,

      exactActionSnapshotRequired: true,

      exactBindingDefinitionSetRequired: true,

      manifestLocalBindingRootsOnly: true,

      longestExactBindingPrefixWins: true,

      lexicalDelimiterOnly: true,

      referenceExpressionPreserved: true,

      opaqueSuffixPreserved: true,

      targetReferenceRootResolved: true,

      referenceExpressionGrammarResolved: false,

      dottedPathSemanticsResolved: false,

      suffixSemanticsResolved: false,

      bindingSemanticsResolved: false,

      roleSemanticsResolved: false,

      subjectRoleSemanticsResolved: false,

      targetOccurrenceBound: false,

      whereExecuted: false,

      scopeExecuted: false,

      cardinalityEnforced: false,

      subjectOfRelationInferred: false,

      graphMutationPerformed: false,

      winnerSelected: false,

      learnerErrorClassified: false,

      candidateOnly: true,

      frozenGrammarReadOnly: true,
    },
  };
}

function rootResult(
  authority: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1 =
    rootAuthority(),
): CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1 {
  return {
    authority: CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,

    authorityVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,

    status: "ready",

    authorities: [
      authority,
    ],

    rootedAuthorityIds: authority.rooted
      ? [
        authority.id,
      ]
      : [],

    unrootedAuthorityIds: authority.rooted ? [] : [
      authority.id,
    ],

    blockingReasons: [],
  };
}

Deno.test(
  "A4.3a3.1 rooted set_role target bridges producer-specific binding ids through exact manifest binding identity and snapshot",
  () => {
    const bindings = neutralBindingResult();

    const compatibilities = entityCompatibilityResult(
      bindings,
    );

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(),
        bindings,
        compatibilities,
      );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1,
      result.blockingReasons.join(","),
    );

    const candidate = result.candidates[0];

    assert(
      candidate.a42RootBindingDefinitionAuthorityId ===
        "historical-a3.0-binding:subject",
      "A4.2 producer-specific id was lost",
    );

    assert(
      candidate.manifestBindingDefinitionAuthorityId !==
        candidate.a42RootBindingDefinitionAuthorityId,
      "producer-specific binding ids were incorrectly equated",
    );

    assert(
      candidate.runtimeEntityLabel ===
          "phrase" &&
        candidate.canonicalNodeType ===
          "phrase",
      "target node-type compatibility missing",
    );
  },
);

Deno.test(
  "A4.3a3.2 dotted target suffix is preserved opaque without traversal",
  () => {
    const bindings = neutralBindingResult();

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(
          rootAuthority({
            rootMatch: "binding_prefix_with_opaque_suffix",

            expression: "subject.head",

            opaqueSuffix: "head",
          }),
        ),
        bindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1 &&
        result.candidates[0]
            .opaqueSuffix ===
          "head",
      "opaque dotted suffix not preserved",
    );

    assert(
      result.candidates[0]
        .governance
        .dottedReferenceTraversalPerformed ===
        false,
      "dotted suffix was traversed",
    );
  },
);

Deno.test(
  "A4.3a3.3 unrooted set_role target remains explicit unrooted without invented compatibility",
  () => {
    const bindings = neutralBindingResult();

    const root = rootAuthority({
      rooted: false,

      rootMatch: "unrooted",

      expression: "external.subject",
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(
          root,
        ),
        bindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result.unrootedTargetAuthorityIds.length ===
          1 &&
        result.unrootedTargetAuthorityIds[0] ===
          root.id,
      "unrooted target was semanticized",
    );
  },
);

Deno.test(
  "A4.3a3.4 rooted target remains explicitly unmapped when A4.3a2 has no compatible canonical node type",
  () => {
    const bindings = neutralBindingResult(
      "future_runtime_entity",
    );

    const compatibilities = entityCompatibilityResult(
      bindings,
      false,
    );

    assert(
      compatibilities.candidates.length ===
        0,
      "fixture unexpectedly mapped unknown entity",
    );

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(
          rootAuthority({
            definition: bindingDefinition(
              "future_runtime_entity",
            ),
          }),
        ),
        bindings,
        compatibilities,
      );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result
            .unmappedRootedTargetAuthorityIds
            .length ===
          1,
      "unmapped rooted target was guessed",
    );
  },
);

Deno.test(
  "A4.3a3.5 cross-producer binding snapshot mismatch fails closed",
  () => {
    const bindings = neutralBindingResult();

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(
          rootAuthority({
            definition: {
              entity: "phrase",

              scope: "different-scope",

              cardinality: "one",
            },
          }),
        ),
        bindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "cross_producer_binding_snapshot_mismatch",
            ),
        ),
      "stale cross-producer binding snapshot accepted",
    );
  },
);

Deno.test(
  "A4.3a3.6 duplicate A4.3a1 manifest-binding identity fails closed",
  () => {
    const bindings = neutralBindingResult();

    const duplicated = {
      ...bindings,

      authorities: [
        bindings.authorities[0],
        {
          ...bindings.authorities[0],

          id: "duplicate-neutral-binding-id",
        },
      ],
    };

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(),
        duplicated,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "duplicate manifest-binding identity accepted",
    );
  },
);

Deno.test(
  "A4.3a3.7 semanticized A4.2 root is rejected as stale upstream contract",
  () => {
    const bindings = neutralBindingResult();

    const root = rootAuthority();

    const staleRoot = {
      ...root,

      governance: {
        ...root.governance,

        roleSemanticsResolved: true,
      },
    } as unknown as CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(
          staleRoot,
        ),
        bindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "semanticized A4.2 root consumed",
    );
  },
);

Deno.test(
  "A4.3a3.8 occurrence-bound A4.3a1 binding is rejected as stale upstream contract",
  () => {
    const bindings = neutralBindingResult();

    const staleBinding = {
      ...bindings.authorities[0],

      governance: {
        ...bindings.authorities[0]
          .governance,

        occurrenceBindingPerformed: true,
      },
    };

    const staleBindings = {
      ...bindings,

      authorities: [
        staleBinding,
      ],
    } as unknown as CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(),
        staleBindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "occurrence-bound A4.3a1 input consumed",
    );
  },
);

Deno.test(
  "A4.3a3.9 semanticized A4.3a2 compatibility is rejected as stale upstream contract",
  () => {
    const bindings = neutralBindingResult();

    const compatibilities = entityCompatibilityResult(
      bindings,
    );

    const staleCandidate = {
      ...compatibilities.candidates[0],

      governance: {
        ...compatibilities.candidates[0]
          .governance,

        roleSemanticsResolved: true,
      },
    };

    const stale = {
      ...compatibilities,

      candidates: [
        staleCandidate,
      ],
    } as unknown as CanonicalRuntimeManifestBindingEntityCompatibilityResultV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(),
        bindings,
        stale,
      );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "semanticized A4.3a2 input consumed",
    );
  },
);

Deno.test(
  "A4.3a3.10 deterministic composition performs no role occurrence sentence scope WHERE cardinality or graph execution",
  () => {
    const bindings = neutralBindingResult();

    const result =
      deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
        rootResult(),
        bindings,
        entityCompatibilityResult(
          bindings,
        ),
      );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1,
      result.blockingReasons.join(","),
    );

    const g = result.candidates[0]
      .governance;

    assert(
      g.exactA42ResultRequired ===
          true &&
        g.exactA43a1ResultRequired ===
          true &&
        g.exactA43a2ResultRequired ===
          true &&
        g.rootedTargetRequired ===
          true &&
        g.exactManifestIdentityRequired ===
          true &&
        g.exactBindingNameIdentityRequired ===
          true &&
        g.exactBindingDefinitionSnapshotRequired ===
          true &&
        g.producerSpecificBindingAuthorityIdsRemainDistinct ===
          true &&
        g.crossProducerBindingIdentityResolved ===
          true &&
        g.exactEntityCompatibilityIdentityRequired ===
          true &&
        g.a30BindingDefinitionReread ===
          false &&
        g.runtimeManifestReread ===
          false &&
        g.runtimeEntityLabelConsumedNotReconstructed ===
          true &&
        g.canonicalNodeTypeConsumedNotInferred ===
          true &&
        g.targetCanonicalNodeTypeCompatibilityResolved ===
          true &&
        g.bindingDefinitionSemanticsResolved ===
          false &&
        g.opaqueSuffixPreservedWithoutTraversal ===
          true &&
        g.dottedReferenceTraversalPerformed ===
          false &&
        g.roleSemanticsResolved ===
          false &&
        g.subjectRoleSemanticsResolved ===
          false &&
        g.grammaticalFunctionResolved ===
          false &&
        g.subjectOfRelationInferred ===
          false &&
        g.occurrenceDomainResolved ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.sentenceMembershipResolved ===
          false &&
        g.scopeSemanticsResolved ===
          false &&
        g.scopeExecuted ===
          false &&
        g.whereSemanticsResolved ===
          false &&
        g.whereExecuted ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforced ===
          false &&
        g.winnerSelected ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.compatibilityOnly ===
          true &&
        g.candidateOnly ===
          true &&
        g.frozenGrammarReadOnly ===
          true,
      "A4.3a3 crossed compatibility boundary",
    );
  },
);

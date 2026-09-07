import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-leaf-right-operand-site-authority-v1.ts";
import {
  type CanonicalRuntimeManifestGraphNodeTypeAuthorityV1,
  deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";
import type {
  CanonicalPosFactOwnershipAuthorityResultV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";
import {
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";
import {
  deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pipeline(
  referenceExpression: string,
  hasRightOperand = true,
  rightOperand: unknown = "NOUN",
  extraBindings: Record<string, Record<string, unknown>> = {},
) {
  const where = {
    op: "eq",
    left: { ref: referenceExpression },
    ...(hasRightOperand ? { right: rightOperand } : {}),
  };

  const bindings = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
    [
      {
        id: "manifest:a",
        code: "ir.a",
        authoring_status: "validated",
        runtime_family: "clause",
        execution_phase: "clause_build",
        ir_spec: {
          bindings: {
            subject: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
              where,
            },
            predicate: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
            },
            ...extraBindings,
          },
        },
      },
    ],
  );

  const shapes = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
    bindings,
  );
  const references =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      shapes,
    );
  const roots =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      references,
      bindings,
    );
  const sites =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      shapes,
      roots,
    );

  return { bindings, shapes, references, roots, sites };
}

function canonicalAuthority(
  nodeType: CanonicalRuntimeManifestGraphNodeTypeAuthorityV1["nodeType"],
  authorityId?: string,
): CanonicalRuntimeManifestGraphNodeTypeAuthorityV1 {
  return {
    authorityId: authorityId ?? `canonical-node-type:${nodeType}`,
    status: "proven",
    nodeType,
    source: "canonical_language_graph_core_v1",
  };
}

function ownershipResult(
  count = 1,
): CanonicalPosFactOwnershipAuthorityResultV1 {
  return {
    producer: "canonical_pos_fact_ownership_authority_v1",

    producerVersion: "1",

    status: "ready",

    authorities: Array.from(
      {
        length: count,
      },
      (
        _,
        index,
      ) => ({
        authorityId: `canonical-pos-fact:pos:${index}`,

        status: "proven" as const,

        model: "POS-A" as const,

        posReadingNodeId: `pos:${index}`,

        posLabel: index ===
            0
          ? "noun"
          : "adjective",

        posReadingGraphStatus: "candidate" as const,

        tokenNodeId: "token:1",

        posOfEdgeId: `edge:pos:${index}`,

        posOfEdgeGraphStatus: "candidate" as const,

        contributingLexicalReadingIds: [
          `lex:${index}`,
        ],

        lexicalSupportEdgeIds: [
          `edge:support:${index}`,
        ],

        lexicalSupportGraphStatuses: [
          "candidate" as const,
        ],

        alternativeSetId: "alt:pos:token:1",

        alternativeSetStatus: "open" as const,

        alternativeMemberIds: Array.from(
          {
            length: count,
          },
          (
            __,
            memberIndex,
          ) => `pos:${memberIndex}`,
        ),

        resolvedMemberIds: [],

        governance: {
          exactCanonicalPosRepresentation: true as const,

          posModel: "POS-A" as const,

          posFactNodeType: "lexical_reading" as const,

          posFactSubtype: "pos_candidate" as const,

          posLabelOwnedByNodeFeature: true as const,

          exactOccurrenceOwnershipUsesPosOfEdge: true as const,

          posOfDirection: "pos_candidate_to_token" as const,

          lexicalSupportDirection:
            "lexical_candidate_to_pos_candidate" as const,

          sourcePosIsEvidenceNotAuthority: true as const,

          alternativeDomainIsTokenLocal: true as const,

          multiplePosCandidatesMayCoexist: true as const,

          underlyingGraphStatusPreserved: true as const,

          candidateDoesNotMeanResolved: true as const,

          resolvedAlternativeWinnerNotInferred: true as const,

          compatibilitySubtypePosPromoted: false as const,

          runtimePosSuffixMapped: false as const,

          whereOperatorSemanticsResolved: false as const,

          whereEqExecuted: false as const,

          referenceValueResolved: false as const,

          rawSurfaceSpellingRead: false as const,

          firstCandidateWins: false as const,

          occurrenceEnumerationPerformed: false as const,

          runtimeScopeExecutionPerformed: false as const,

          cardinalityEnforcementPerformed: false as const,

          occurrenceBindingPerformed: false as const,

          dependencyDirectionResolved: false as const,

          canonicalDependencyEdgeGenerated: false as const,

          grammaticalFunctionResolved: false as const,

          complementArgumentAttachmentResolved: false as const,

          realizesSlotGenerated: false as const,

          graphMutationPerformed: false as const,

          frozenGrammarReadOnly: true as const,
        },
      }),
    ),

    blockingReasons: [],
  };
}

type BuildOptions = {
  referencedName?: string;
  referencedEntity?: "token" | "phrase" | "clause";
  referenceExpression?: string;
  rightOperand?: unknown;
  canonicalTypes?: Array<"token" | "phrase" | "clause">;
};

function build(options: BuildOptions = {}) {
  const referencedName = options.referencedName ?? "tokenRef";
  const referencedEntity = options.referencedEntity ?? "token";
  const referenceExpression = options.referenceExpression ??
    `${referencedName}.pos`;

  const s = pipeline(
    referenceExpression,
    true,
    options.rightOperand ?? "NOUN",
    {
      [referencedName]: {
        entity: referencedEntity,
        scope: "sentence",
        cardinality: "one",
      },
    },
  );

  const canonicalTypes = options.canonicalTypes ??
    ["phrase", "token", "clause"];

  const entities = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
    s.bindings,
    canonicalTypes.map((nodeType) => canonicalAuthority(nodeType)),
  );

  const capability = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownershipResult(),
  );

  return { ...s, entities, capability };
}

function derive(x: ReturnType<typeof build>) {
  return deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
    x.sites,
    x.entities,
    x.capability,
  );
}

function tokenEntity(x: ReturnType<typeof build>) {
  const candidate = x.entities.candidates.find((y) =>
    y.bindingName === "tokenRef"
  );
  assert(candidate !== undefined, JSON.stringify(x.entities));
  return candidate;
}

Deno.test("A4.6b2.1 exact referenced token + .pos + proven property capability composes", () => {
  const x = build();
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 1 &&
      r.consideredPosReferenceSiteCount === 1 &&
      r.compatibleTokenEntitySiteCount === 1 &&
      r.unmappedPosReferenceSiteKeys.length === 0 &&
      r.ignoredNonPosSuffixSiteKeys.length === 0,
    JSON.stringify(r),
  );
  const a = r.candidates[0]!;
  assert(
    a.ownerBindingName === "subject" &&
      a.referencedBindingName === "tokenRef" &&
      a.runtimeSuffix === ".pos" &&
      a.canonicalNodeType === "token" &&
      a.canonicalPropertyDomain === "canonical_token_occurrence" &&
      a.canonicalPropertyKind === "pos_hypothesis_set" &&
      a.canonicalFactNodeType === "lexical_reading" &&
      a.canonicalFactNodeSubtype === "pos_candidate" &&
      a.canonicalFactLabelFeature === "pos",
    JSON.stringify(a),
  );
});

Deno.test("A4.6b2.2 right operand snapshot is preserved and detached", () => {
  const x = build({ rightOperand: { labels: ["NOUN"] } });
  const r = derive(x);
  const output = r.candidates[0]!.rightOperandSnapshot as { labels: string[] };
  const upstream = x.sites.authorities[0]!.rightOperandSnapshot as {
    labels: string[];
  };
  upstream.labels.push("VERB");
  assert(
    output.labels.length === 1 && output.labels[0] === "NOUN",
    JSON.stringify(output),
  );
});

Deno.test("A4.6b2.3 owner and referenced binding identities stay separate and entity join uses referenced binding", () => {
  const x = build();
  const r = derive(x);
  const a = r.candidates[0]!;
  assert(
    a.ownerBindingName === "subject" &&
      a.referencedBindingName === "tokenRef" &&
      a.ownerBindingDefinitionAuthorityId !==
        a.referencedBindingDefinitionAuthorityId,
    JSON.stringify(a),
  );
});

Deno.test("A4.6b2.4 suffix other than .pos remains outside capability", () => {
  const x = build({ referenceExpression: "tokenRef.morph" });
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 0 &&
      r.consideredPosReferenceSiteCount === 0 &&
      r.ignoredNonPosSuffixSiteKeys.length === 1 &&
      r.blockingReasons.length === 0,
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.5 referenced phrase + .pos does not inherit token POS", () => {
  const x = build({
    referencedName: "phraseRef",
    referencedEntity: "phrase",
    canonicalTypes: ["phrase", "token"],
  });
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 0 &&
      r.consideredPosReferenceSiteCount === 1 &&
      r.unmappedPosReferenceSiteKeys.length === 1,
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.6 referenced clause + .pos does not invent clause POS", () => {
  const x = build({
    referencedName: "clauseRef",
    referencedEntity: "clause",
    canonicalTypes: ["phrase", "token", "clause"],
  });
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 0 &&
      r.consideredPosReferenceSiteCount === 1 &&
      r.unmappedPosReferenceSiteKeys.length === 1,
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.7 missing entity compatibility for referenced binding is non-blocking unmapped", () => {
  const x = build({ canonicalTypes: ["clause"] });
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 0 &&
      r.unmappedPosReferenceSiteKeys.length === 1 &&
      r.blockingReasons.length === 0,
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.8 entity compatibility for owner binding only cannot satisfy referenced binding", () => {
  const x = build({ canonicalTypes: ["phrase"] });
  assert(
    x.entities.candidates.some((y) => y.bindingName === "subject") &&
      !x.entities.candidates.some((y) => y.bindingName === "tokenRef"),
    JSON.stringify(x.entities),
  );
  const r = derive(x);
  assert(
    r.status === "ready" &&
      r.candidates.length === 0 &&
      r.unmappedPosReferenceSiteKeys.length === 1,
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.9 stale A4.6a2b individual authority governance blocks", () => {
  const x = build();
  const a = x.sites.authorities[0]!;
  const staleSites = {
    ...x.sites,
    authorities: [{
      ...a,
      governance: { ...a.governance, candidateOnly: false },
    }],
  } as unknown as typeof x.sites;
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      staleSites,
      x.entities,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("unsafe_contract")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.10 stale entity individual authority governance blocks", () => {
  const x = build();
  const a = tokenEntity(x);
  const stale = {
    ...a,
    governance: {
      ...a.governance,
      occurrenceBindingPerformed: true,
    },
  };
  const staleEntities = {
    ...x.entities,
    candidates: x.entities.candidates.map((y) => y.id === a.id ? stale : y),
  } as unknown as typeof x.entities;
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      staleEntities,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("unsafe_contract")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.11 duplicate A4.6a2b authority id blocks", () => {
  const x = build();
  const a = x.sites.authorities[0]!;
  const duplicateSites = {
    ...x.sites,
    authorities: [a, { ...a }],
    rootedReferenceSiteCount: 2,
    explicitRightOperandSiteCount: 2,
    composedSiteCount: 2,
  };
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      duplicateSites,
      x.entities,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("duplicate_id")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.12 duplicate entity authority id blocks", () => {
  const x = build();
  const a = tokenEntity(x);
  const duplicateEntities = {
    ...x.entities,
    candidates: [...x.entities.candidates, { ...a }],
  };
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      duplicateEntities,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("duplicate_id")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.13 duplicate exact referenced-binding entity identity blocks even with different id", () => {
  const x = build();
  const a = tokenEntity(x);

  const duplicateIdentity = {
    ...x.entities,
    candidates: [...x.entities.candidates, {
      ...a,
      id: `${a.id}:copy`,
    }],
  };
  const duplicate =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      duplicateIdentity,
      x.capability,
    );
  assert(
    duplicate.status === "blocked" &&
      duplicate.blockingReasons.some((reason) =>
        reason.includes("duplicate_referenced_binding_identity")
      ),
    JSON.stringify(duplicate),
  );

  const changedManifestCandidate = {
    ...a,
    manifestCode: "ir.changed",
  };
  const changedManifestEntities = {
    ...x.entities,
    candidates: x.entities.candidates.map((y) =>
      y.id === a.id ? changedManifestCandidate : y
    ),
  } as unknown as typeof x.entities;
  const changedManifest =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      changedManifestEntities,
      x.capability,
    );
  assert(
    changedManifest.status === "blocked" &&
      changedManifest.blockingReasons.some((reason) =>
        reason.includes("referenced_entity_identity_mismatch")
      ),
    JSON.stringify(changedManifest),
  );

  const changedAuthorityCandidate = {
    ...a,
    bindingDefinitionAuthorityId: "binding:changed",
  };
  const changedAuthorityEntities = {
    ...x.entities,
    candidates: x.entities.candidates.map((y) =>
      y.id === a.id ? changedAuthorityCandidate : y
    ),
  } as unknown as typeof x.entities;
  const changedAuthority =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      changedAuthorityEntities,
      x.capability,
    );
  assert(
    changedAuthority.status === "blocked" &&
      changedAuthority.blockingReasons.some((reason) =>
        reason.includes("referenced_entity_authority_id_mismatch")
      ),
    JSON.stringify(changedAuthority),
  );
});

Deno.test("A4.6b2.14 non-exact A4.6a2b result fails closed", () => {
  const x = build();
  const stale = {
    ...x.sites,
    producer: "wrong-site-producer",
  } as unknown as typeof x.sites;
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      stale,
      x.entities,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.includes("a4_6a2b_result:not_exact_ready"),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.15 non-exact entity compatibility result fails closed", () => {
  const x = build();
  const stale = {
    ...x.entities,
    producer: "wrong-entity-producer",
  } as unknown as typeof x.entities;
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      stale,
      x.capability,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.includes("entity_result:not_exact_ready"),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.16 blocked or missing POS property capability fails closed", () => {
  const x = build();
  const blockedCapability = {
    ...x.capability,
    status: "blocked",
    capability: undefined,
    blockingReasons: ["fixture:block"],
  } as unknown as typeof x.capability;
  const blocked =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      x.entities,
      blockedCapability,
    );
  assert(
    blocked.status === "blocked" &&
      blocked.blockingReasons.includes(
        "token_pos_capability_result:not_exact_ready",
      ),
    JSON.stringify(blocked),
  );

  const missing = {
    ...x.capability,
    capability: undefined,
  } as unknown as typeof x.capability;
  const missingResult =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      x.entities,
      missing,
    );
  assert(missingResult.status === "blocked", JSON.stringify(missingResult));
});

Deno.test("A4.6b2.17 stale POS property capability governance fails closed", () => {
  const x = build();
  assert(x.capability.capability !== undefined, JSON.stringify(x.capability));
  const stale = {
    ...x.capability,
    capability: {
      ...x.capability.capability,
      governance: {
        ...x.capability.capability.governance,
        runtimePosSuffixMapped: true,
      },
    },
  } as unknown as typeof x.capability;
  const r =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      x.sites,
      x.entities,
      stale,
    );
  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("unsafe_contract")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6b2.18 unexpected POS property domain kind or fact contract fails closed", () => {
  const x = build();
  const capability = x.capability.capability;
  assert(capability !== undefined, JSON.stringify(x.capability));

  const variants = [
    { ...capability, propertyDomain: "wrong-domain" },
    { ...capability, propertyKind: "wrong-kind" },
    { ...capability, factNodeSubtype: "wrong-subtype" },
  ];

  for (const variant of variants) {
    const stale = {
      ...x.capability,
      capability: variant,
    } as unknown as typeof x.capability;
    const r =
      deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
        x.sites,
        x.entities,
        stale,
      );
    assert(r.status === "blocked", JSON.stringify(r));
  }
});

Deno.test("A4.6b2.19 governance proves compatibility only with no occurrence fact read comparison or graph execution", () => {
  const x = build();
  const r = derive(x);
  const g = r.candidates[0]!.governance;
  assert(
    g.exactA46a2bResultRequired === true &&
      g.exactA46a2bAuthorityRequired === true &&
      g.exactEntityCompatibilityResultRequired === true &&
      g.exactEntityCompatibilityAuthorityRequired === true &&
      g.exactTokenPosPropertyCapabilityResultRequired === true &&
      g.exactTokenPosPropertyCapabilityRequired === true &&
      g.referencedBindingIdentityMatchRequired === true &&
      g.ownerBindingExcludedFromEntityJoin === true &&
      g.exactOpaqueSuffixMatch === true &&
      g.exactCanonicalTokenCompatibilityRequired === true &&
      g.rootedBindingIdentityPreserved === true &&
      g.entityCompatibilityConsumedNotReconstructed === true &&
      g.tokenPosCapabilityConsumedNotReconstructed === true &&
      g.compatibilityOnly === true &&
      g.candidateOnly === true &&
      g.rightOperandSnapshotPreserved === true &&
      g.rightOperandSnapshotDetached === true &&
      g.propertyValueIsScalar === false &&
      g.propertyValueIsHypothesisSet === true &&
      g.posHypothesisSelected === false &&
      g.rightOperandRead === false &&
      g.rightOperandCompared === false &&
      g.operatorSemanticsResolved === false &&
      g.whereEqExecuted === false &&
      g.referenceValueResolved === false &&
      g.dottedReferenceTraversalPerformed === false &&
      g.canonicalFactOwnershipResolved === false &&
      g.occurrenceEnumerationPerformed === false &&
      g.occurrenceBindingPerformed === false &&
      g.runtimeScopeExecutionPerformed === false &&
      g.sentenceMembershipResolved === false &&
      g.clauseContainmentResolved === false &&
      g.cardinalityEnforcementPerformed === false &&
      g.canonicalDependencyEdgeGenerated === false &&
      g.grammaticalFunctionResolved === false &&
      g.complementArgumentAttachmentResolved === false &&
      g.realizesSlotGenerated === false &&
      g.graphMutationPerformed === false &&
      g.learnerErrorClassified === false &&
      g.frozenGrammarReadOnly === true,
    JSON.stringify(g),
  );
});

import {
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  type CanonicalRuntimeManifestGraphNodeTypeAuthorityV1,
  deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";

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

function manifest(
  entity: unknown,
  options: {
    id?: string;
    code?: string;
    bindingName?: string;
  } = {},
): Record<string, unknown> {
  const bindingName = options.bindingName ??
    "subject";

  return {
    id: options.id ??
      "manifest-a",

    code: options.code ??
      "ir.structural.clause.subject_finite_predicate",

    authoring_status: "validated",

    runtime_family: "structural",

    execution_phase: "clause",

    ir_spec: {
      bindings: {
        [bindingName]: {
          entity,

          scope: "sentence",

          cardinality: "one",
        },
      },
    },
  };
}

function bindingResult(
  entity: unknown,
  options: {
    id?: string;
    code?: string;
    bindingName?: string;
  } = {},
): CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 {
  const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1([
    manifest(
      entity,
      options,
    ),
  ]);

  assert(
    result.status ===
      "ready",
    `A4.3a1 fixture blocked: ${result.blockingReasons.join(",")}`,
  );

  return result;
}

function canonicalAuthority(
  nodeType: CanonicalRuntimeManifestGraphNodeTypeAuthorityV1[
    "nodeType"
  ],
  authorityId?: string,
): CanonicalRuntimeManifestGraphNodeTypeAuthorityV1 {
  return {
    authorityId: authorityId ??
      `canonical-node-type:${nodeType}`,

    status: "proven",

    nodeType,

    source: "canonical_language_graph_core_v1",
  };
}

Deno.test(
  "A4.3a2.1 exact opaque Runtime entity label yields canonical node-type compatibility candidate",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "phrase",
      ),
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1,
      "exact compatibility missing",
    );

    const candidate = result.candidates[0];

    assert(
      candidate.runtimeEntityLabel ===
          "phrase" &&
        candidate.canonicalNodeType ===
          "phrase",
      "exact opaque labels changed",
    );
  },
);

Deno.test(
  "A4.3a2.2 canonical node-type vocabulary remains external and independent",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "token",
      ),
      [
        canonicalAuthority(
          "phrase",
        ),

        canonicalAuthority(
          "token",
        ),

        canonicalAuthority(
          "clause",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1 &&
        result.candidates[0]
            .canonicalNodeType ===
          "token",
      "exact external node-type vocabulary match failed",
    );
  },
);

Deno.test(
  "A4.3a2.3 unknown Runtime entity remains explicitly unmapped without guessing",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "future-runtime-entity",
      ),
      [
        canonicalAuthority(
          "phrase",
        ),

        canonicalAuthority(
          "predicate",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result
            .unmappedBindingDefinitionAuthorityIds
            .length ===
          1,
      "unknown Runtime entity was guessed",
    );
  },
);

Deno.test(
  "A4.3a2.4 absent Runtime entity label remains unmapped",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        null,
      ),
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result
            .unmappedBindingDefinitionAuthorityIds
            .length ===
          1,
      "missing entity label was invented",
    );
  },
);

Deno.test(
  "A4.3a2.5 exact matching performs no case folding or normalization",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "Phrase",
      ),
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result
            .unmappedBindingDefinitionAuthorityIds
            .length ===
          1,
      "case-folded entity match occurred",
    );
  },
);

Deno.test(
  "A4.3a2.6 duplicate canonical authority for same node type blocks boundary",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "phrase",
      ),
      [
        canonicalAuthority(
          "phrase",
          "authority-a",
        ),

        canonicalAuthority(
          "phrase",
          "authority-b",
        ),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "duplicate canonical node-type authority accepted",
    );
  },
);

Deno.test(
  "A4.3a2.7 malformed canonical node-type authority blocks boundary",
  () => {
    const malformed = {
      authorityId: "",

      status: "proven",

      nodeType: "phrase",

      source: "canonical_language_graph_core_v1",
    } as unknown as CanonicalRuntimeManifestGraphNodeTypeAuthorityV1;

    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "phrase",
      ),
      [
        malformed,
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "malformed canonical authority accepted",
    );
  },
);

Deno.test(
  "A4.3a2.8 duplicate A4.3a1 binding authority identity blocks boundary",
  () => {
    const upstream = bindingResult(
      "phrase",
    );

    const duplicated = {
      ...upstream,

      authorities: [
        upstream.authorities[0],
        upstream.authorities[0],
      ],
    };

    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      duplicated,
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "duplicate A4.3a1 binding authority accepted",
    );
  },
);

Deno.test(
  "A4.3a2.9 semanticized or occurrence-bound A4.3a1 input is rejected as stale upstream contract",
  () => {
    const upstream = bindingResult(
      "phrase",
    );

    const staleAuthority = {
      ...upstream.authorities[0],

      governance: {
        ...upstream.authorities[0]
          .governance,

        occurrenceBindingPerformed: true,
      },
    };

    const stale = {
      ...upstream,

      authorities: [
        staleAuthority,
      ],
    } as unknown as CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1;

    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      stale,
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      "occurrence-bound A4.3a1 input was consumed",
    );
  },
);

Deno.test(
  "A4.3a2.10 deterministic compatibility performs no role occurrence scope WHERE cardinality or graph execution",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult(
        "phrase",
      ),
      [
        canonicalAuthority(
          "phrase",
        ),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1,
      "compatibility candidate missing",
    );

    const g = result.candidates[0]
      .governance;

    assert(
      g.exactA43a1ResultRequired ===
          true &&
        g.exactManifestBindingDefinitionAuthorityRequired ===
          true &&
        g.exactCanonicalNodeTypeAuthorityRequired ===
          true &&
        g.exactOpaqueLabelMatch ===
          true &&
        g.runtimeEntityVocabularyHardcoded ===
          false &&
        g.runtimeEntityLabelNormalized ===
          false &&
        g.caseFoldingPerformed ===
          false &&
        g.canonicalNodeTypeInferredFromBindingName ===
          false &&
        g.canonicalNodeTypeAuthorityIdentityPreserved ===
          true &&
        g.entitySemanticsResolved ===
          false &&
        g.occurrenceDomainResolved ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.scopeSemanticsResolved ===
          false &&
        g.whereSemanticsResolved ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.actionFamilySemanticsResolved ===
          false &&
        g.roleSemanticsResolved ===
          false &&
        g.grammaticalFunctionResolved ===
          false &&
        g.subjectOfRelationInferred ===
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
      "A4.3a2 crossed compatibility boundary",
    );
  },
);

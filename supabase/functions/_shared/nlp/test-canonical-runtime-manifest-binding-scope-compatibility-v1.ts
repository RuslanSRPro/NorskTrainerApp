import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  type CanonicalRuntimeManifestScopeBoundaryAuthorityV1,
  deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1,
} from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";

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

function bindingResult(
  options: {
    scope?: string | null;
    bindingName?: string;
  } = {},
): CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 {
  const bindingName = options.bindingName ??
    "subject";

  const definition: Record<string, unknown> = {
    entity: "phrase",

    cardinality: "one",
  };

  if (
    options.scope !==
      null
  ) {
    definition.scope = options.scope ??
      "sentence";
  }

  return deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1([
    {
      id: "manifest:clause:1",

      code: "ir.structural.clause.subject_finite_predicate",

      authoring_status: "validated",

      runtime_family: "clause_pattern",

      execution_phase: "structural",

      ir_spec: {
        bindings: {
          [bindingName]: definition,
        },
      },
    },
  ]);
}

function boundary(
  options: {
    authorityId?: string;
    boundaryLabel?: string;
    source?: string;
    status?: "proven";
  } = {},
): CanonicalRuntimeManifestScopeBoundaryAuthorityV1 {
  return {
    authorityId: options.authorityId ??
      "boundary:sentence",

    status: options.status ??
      "proven",

    boundaryLabel: options.boundaryLabel ??
      "sentence",

    source: options.source ??
      "canonical_sentence_scope_boundary_capability_v1",
  };
}

Deno.test(
  "A4.5a1.1 exact opaque Runtime scope label yields canonical boundary compatibility candidate",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult(),
      [
        boundary(),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1 &&
        result.candidates[0]
            ?.runtimeScopeLabel ===
          "sentence" &&
        result.candidates[0]
            ?.canonicalBoundaryLabel ===
          "sentence" &&
        result.candidates[0]
            ?.bindingName ===
          "subject",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.2 canonical boundary vocabulary remains external and independent",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult({
        scope: "phrase",
      }),
      [
        boundary(),
        boundary({
          authorityId: "boundary:phrase",

          boundaryLabel: "phrase",

          source: "future_explicit_phrase_boundary_authority",
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          1 &&
        result.candidates[0]
            ?.canonicalBoundaryLabel ===
          "phrase" &&
        result.candidates[0]
            ?.canonicalBoundaryAuthorityId ===
          "boundary:phrase",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.3 unknown Runtime scope remains explicitly unmapped without guessing",
  () => {
    const source = bindingResult({
      scope: "future_runtime_scope",
    });

    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      source,
      [
        boundary(),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result.unmappedBindingDefinitionAuthorityIds.length ===
          1 &&
        result
            .unmappedBindingDefinitionAuthorityIds[0] ===
          source.authorities[0]
            ?.id,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.4 absent Runtime scope label remains unmapped",
  () => {
    const source = bindingResult({
      scope: null,
    });

    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      source,
      [
        boundary(),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result.unmappedBindingDefinitionAuthorityIds.length ===
          1,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.5 exact matching performs no case folding or normalization",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult({
        scope: "Sentence",
      }),
      [
        boundary({
          boundaryLabel: "sentence",
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.candidates.length ===
          0 &&
        result.unmappedBindingDefinitionAuthorityIds.length ===
          1,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.6 duplicate canonical authority for same boundary label blocks boundary",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult(),
      [
        boundary({
          authorityId: "boundary:sentence:a",
        }),

        boundary({
          authorityId: "boundary:sentence:b",
        }),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "duplicate_authority",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.7 malformed canonical boundary authority blocks boundary",
  () => {
    const malformed = {
      ...boundary(),

      source: "",
    };

    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult(),
      [
        malformed,
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.8 duplicate A4.3a1 binding authority identity blocks boundary",
  () => {
    const source = bindingResult();

    assert(
      source.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 &&
        source.authorities.length ===
          1,
      "invalid A4.3a1 fixture",
    );

    const duplicate = {
      ...source,

      authorities: [
        source.authorities[0]!,
        {
          ...source.authorities[0]!,
        },
      ],
    };

    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      duplicate,
      [
        boundary(),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              ":duplicate",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.9 semanticized or occurrence-bound A4.3a1 input is rejected as stale upstream contract",
  () => {
    const source = bindingResult();

    const original = source.authorities[0]!;

    const staleAuthority = {
      ...original,

      governance: {
        ...original.governance,

        scopeSemanticsResolved: true,

        occurrenceBindingPerformed: true,
      },
    };

    const staleResult = {
      ...source,

      authorities: [
        staleAuthority,
      ],
    } as unknown as CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1;

    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      staleResult,
      [
        boundary(),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.candidates.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unsafe_contract",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a1.10 deterministic compatibility performs no occurrence containment sentence scope WHERE cardinality role or graph execution",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult(),
      [
        boundary(),
      ],
    );

    const candidate = result.candidates[0];

    assert(
      result.status ===
          "ready" &&
        candidate !==
          undefined &&
        candidate.status ===
          "candidate",
      JSON.stringify(
        result,
      ),
    );

    const g = candidate.governance;

    assert(
      g.exactA43a1ResultRequired ===
          true &&
        g.exactManifestBindingDefinitionAuthorityRequired ===
          true &&
        g.exactCanonicalBoundaryAuthorityRequired ===
          true &&
        g.exactOpaqueLabelMatch ===
          true &&
        g.runtimeScopeVocabularyHardcoded ===
          false &&
        g.runtimeScopeLabelNormalized ===
          false &&
        g.caseFoldingPerformed ===
          false &&
        g.canonicalBoundaryInferredFromName ===
          false &&
        g.canonicalBoundaryAuthorityIdentityPreserved ===
          true &&
        g.canonicalBoundaryAuthoritySourcePreservedOpaque ===
          true &&
        g.scopeSemanticsResolved ===
          false &&
        g.containmentResolved ===
          false &&
        g.sentenceIdentityResolved ===
          false &&
        g.phraseContainmentResolved ===
          false &&
        g.clauseContainmentResolved ===
          false &&
        g.selfSemanticsResolved ===
          false &&
        g.occurrenceDomainResolved ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
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
        g.compatibilityOnly ===
          true &&
        g.candidateOnly ===
          true &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(
        g,
      ),
    );
  },
);

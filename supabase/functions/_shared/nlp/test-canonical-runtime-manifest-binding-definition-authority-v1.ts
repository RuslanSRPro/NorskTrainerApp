import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

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
  options: {
    id?: string;
    code?: string;
    validated?: boolean;
    runtimeFamily?: string;
    executionPhase?: string;
    bindings?: unknown;
    includeBindings?: boolean;
    includeActions?: boolean;
  } = {},
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: options.id ??
      "manifest-a",

    code: options.code ??
      "ir.structural.clause.subject_finite_predicate",

    authoring_status: options.validated ===
        false
      ? "draft"
      : "validated",

    runtime_family: options.runtimeFamily ??
      "structural",

    execution_phase: options.executionPhase ??
      "clause",
  };

  if (
    options.includeActions !==
      false
  ) {
    row.actions = [{
      action: "opaque-action",

      target: "subject",
    }];
  }

  if (
    options.includeBindings !==
      false
  ) {
    row.ir_spec = {
      bindings: options.bindings ??
        {
          subject: {
            entity: "phrase",

            scope: "sentence",

            cardinality: "one",

            where: {
              all: [{
                left: "subject.type",

                op: "eq",

                right: "NP",
              }],
            },
          },

          predicate: {
            entity: "phrase",

            scope: "sentence",

            cardinality: "one",
          },
        },
    };
  } else {
    row.ir_spec = {};
  }

  return row;
}

Deno.test(
  "A4.3a1.1 validated manifest projects exact manifest-local binding definitions",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest(),
      ],
    );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    assert(
      result.authorities.length ===
        2,
      `authorities=${result.authorities.length}`,
    );

    const subject = result.authorities.find(
      (authority) =>
        authority.bindingName ===
          "subject",
    );

    assert(
      subject,
      "subject binding missing",
    );

    assert(
      subject.entityLabel ===
          "phrase" &&
        subject.scopeLabel ===
          "sentence" &&
        subject.cardinalityLabel ===
          "one",
      "opaque binding labels changed",
    );
  },
);

Deno.test(
  "A4.3a1.2 where structure and labels remain opaque",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest(),
      ],
    );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const subject = result.authorities.find(
      (authority) =>
        authority.bindingName ===
          "subject",
    );

    assert(
      subject,
      "subject authority missing",
    );

    assert(
      JSON.stringify(
        subject.whereClause,
      ) ===
        JSON.stringify({
          all: [{
            left: "subject.type",

            op: "eq",

            right: "NP",
          }],
        }),
      "where clause was interpreted or changed",
    );

    assert(
      subject.governance
        .whereSemanticsResolved ===
        false,
      "where semantics were resolved",
    );
  },
);

Deno.test(
  "A4.3a1.3 unvalidated manifest never becomes authority",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest({
          validated: false,
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          0 &&
        result
            .ignoredUnvalidatedManifestCodes
            .length ===
          1,
      "draft manifest became authority",
    );
  },
);

Deno.test(
  "A4.3a1.4 validated manifest without bindings is surfaced without invention",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest({
          includeBindings: false,
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          0 &&
        result.manifestsWithoutBindings
            .length ===
          1,
      "bindings were invented",
    );
  },
);

Deno.test(
  "A4.3a1.5 malformed binding definition blocks whole authority boundary",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest({
          bindings: {
            subject: "not-an-object",
          },
        }),
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.authorities.length ===
          0,
      "malformed binding definition accepted",
    );
  },
);

Deno.test(
  "A4.3a1.6 duplicate exact manifest identity fails closed",
  () => {
    const row = manifest();

    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        row,
        {
          ...row,
        },
      ],
    );

    assert(
      result.status ===
          "blocked" &&
        result.authorities.length ===
          0,
      "duplicate exact manifest identity accepted",
    );
  },
);

Deno.test(
  "A4.3a1.7 multiple validated manifests remain independent and deterministic",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest({
          id: "manifest-b",

          code: "manifest.b",

          bindings: {
            beta: {
              entity: "token",
            },
          },
        }),

        manifest({
          id: "manifest-a",

          code: "manifest.a",

          bindings: {
            alpha: {
              entity: "phrase",
            },
          },
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          2,
      "multiple manifest projection failed",
    );

    assert(
      result.authorities[0].id <
        result.authorities[1].id,
      "authority ordering is not deterministic",
    );
  },
);

Deno.test(
  "A4.3a1.8 returned binding and manifest snapshots are detached from input mutation",
  () => {
    const row = manifest({
      bindings: {
        subject: {
          entity: "phrase",
        },
      },
    });

    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        row,
      ],
    );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const irSpec = row.ir_spec as Record<
      string,
      unknown
    >;

    const bindings = irSpec.bindings as Record<
      string,
      unknown
    >;

    const sourceSubject = bindings.subject as Record<
      string,
      unknown
    >;

    sourceSubject.entity = "mutated-after-derive";

    assert(
      result.authorities[0]
        .bindingDefinition
        .entity ===
        "phrase",
      "binding snapshot aliases mutable input",
    );

    const rawIr = result.authorities[0]
      .rawManifestSnapshot
      .ir_spec as Record<
        string,
        unknown
      >;

    const rawBindings = rawIr.bindings as Record<
      string,
      unknown
    >;

    const rawSubject = rawBindings.subject as Record<
      string,
      unknown
    >;

    assert(
      rawSubject.entity ===
        "phrase",
      "manifest snapshot aliases mutable input",
    );
  },
);

Deno.test(
  "A4.3a1.9 authority is independent of Runtime action family",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest({
          includeActions: false,

          runtimeFamily: "future-family",

          executionPhase: "future-phase",

          bindings: {
            x: {
              entity: "phrase",
            },
          },
        }),
      ],
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1,
      "action-family-neutral manifest was rejected",
    );

    const authority = result.authorities[0];

    assert(
      authority.runtimeFamilyLabel ===
          "future-family" &&
        authority.executionPhaseLabel ===
          "future-phase" &&
        authority.governance
            .actionAuthorityRequired ===
          false &&
        authority.governance
            .actionFamilySemanticsResolved ===
          false,
      "family labels became action semantics",
    );
  },
);

Deno.test(
  "A4.3a1.10 deterministic authority performs no Runtime or graph execution",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      [
        manifest(),
      ],
    );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    for (
      const authority of result.authorities
    ) {
      const g = authority.governance;

      assert(
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
            true,
        "A4.3a1 crossed authority boundary",
      );
    }
  },
);

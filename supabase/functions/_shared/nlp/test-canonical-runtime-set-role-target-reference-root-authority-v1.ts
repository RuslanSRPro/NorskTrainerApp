import {
  deriveCanonicalRuntimeSetRoleActionAuthoritiesV1,
} from "./canonical-runtime-set-role-action-authority-v1.ts";
import {
  deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1,
} from "./canonical-runtime-set-role-target-reference-root-authority-v1.ts";

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type BindingSpec = {
  entity?: string;
  scope?: string;
  cardinality?: string;
  where?: unknown;
};

function manifest(
  options: {
    id?: string;
    code?: string;
    target?: string;
    role?: string;
    bindings?: Record<string, BindingSpec>;
    validated?: boolean;
  } = {},
): Record<string, unknown> {
  const id = options.id ??
    "manifest-a";

  const code = options.code ??
    "ir.structural.clause.subject_finite_predicate";

  const target = options.target ??
    "subject";

  const role = options.role ??
    "subject";

  const bindings = options.bindings ??
    {
      subject: {
        entity: "phrase",
        scope: "sentence",
        cardinality: "one",
      },

      predicate: {
        entity: "phrase",
        scope: "sentence",
        cardinality: "one",
      },
    };

  const actions = [{
    action: "set_role",

    target,

    role,

    reason: "nrg_subject_definition",
  }];

  return {
    id,
    code,

    authoring_status: options.validated ===
        false
      ? "draft"
      : "validated",

    actions,

    ir_spec: {
      source: {
        primary_candidate_code: "grammar.subject.core",

        supporting_candidate_codes: [
          "grammar.subject.support",
        ],
      },

      bindings,

      actions,
    },
  };
}

function setRoleResult(
  row: Record<string, unknown>,
) {
  const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
    row,
  ]);

  assert(
    result.status === "ready",
    `A4.1 fixture blocked: ${result.blockingReasons.join(",")}`,
  );

  return result;
}
function bindingAuthority(
  options: {
    id?: string;
    manifestId?: string;
    manifestCode?: string;
    bindingName: string;
    definition: BindingSpec;
  },
): CanonicalRuntimeBindingDefinitionAuthorityV1 {
  return {
    id: options.id ??
      `binding:${options.bindingName}`,

    status: "candidate",

    manifestId: options.manifestId ??
      "manifest-a",

    manifestCode: options.manifestCode ??
      "ir.structural.clause.subject_finite_predicate",

    bindingName: options.bindingName,

    bindingDefinition: options.definition,

    governance: {
      exactValidatedManifestRequired: true,

      bindingNamePreservedOpaque: true,

      bindingDefinitionPreservedOpaque: true,

      entitySemanticsResolved: false,

      scopeSemanticsResolved: false,

      cardinalitySemanticsResolved: false,

      whereSemanticsResolved: false,

      occurrenceEnumerationPerformed: false,
    },
  } as unknown as CanonicalRuntimeBindingDefinitionAuthorityV1;
}

function bindingAuthorities(
  bindings: Record<string, BindingSpec>,
): CanonicalRuntimeBindingDefinitionAuthorityV1[] {
  return Object
    .entries(
      bindings,
    )
    .map(
      ([name, definition]) =>
        bindingAuthority({
          bindingName: name,

          definition,
        }),
    );
}

Deno.test(
  "A4.2.1 exact set_role target roots to exact manifest-local binding",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",

        scope: "sentence",

        cardinality: "one",
      },

      predicate: {
        entity: "phrase",

        scope: "sentence",

        cardinality: "one",
      },
    };

    const row = manifest({
      target: "subject",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    assert(
      result.authorities.length ===
        1,
      `authorities=${result.authorities.length}`,
    );

    const authority = result.authorities[0];

    assert(
      authority.rootMatch ===
        "exact_binding",
      `match=${authority.rootMatch}`,
    );

    assert(
      authority.rootBindingName ===
        "subject",
      `root=${authority.rootBindingName}`,
    );

    assert(
      authority.opaqueSuffix ===
        null,
      "exact binding invented suffix",
    );

    assert(
      authority.rooted ===
        true,
      "exact binding not rooted",
    );
  },
);

Deno.test(
  "A4.2.2 dotted target preserves suffix without traversing it",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },

      predicate: {
        entity: "phrase",
      },
    };

    const row = manifest({
      target: "subject.head",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const authority = result.authorities[0];

    assert(
      authority.rootMatch ===
        "binding_prefix_with_opaque_suffix",
      `match=${authority.rootMatch}`,
    );

    assert(
      authority.rootBindingName ===
        "subject",
      `root=${authority.rootBindingName}`,
    );

    assert(
      authority.opaqueSuffix ===
        "head",
      `suffix=${authority.opaqueSuffix}`,
    );

    assert(
      authority.governance
        .dottedPathSemanticsResolved ===
        false,
      "opaque suffix became traversal semantics",
    );
  },
);

Deno.test(
  "A4.2.3 longest manifest-local binding prefix wins",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },

      "subject.head": {
        entity: "token",
      },

      predicate: {
        entity: "phrase",
      },
    };

    const row = manifest({
      target: "subject.head.morph",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const authority = result.authorities[0];

    assert(
      authority.rootBindingName ===
        "subject.head",
      `root=${authority.rootBindingName}`,
    );

    assert(
      authority.opaqueSuffix ===
        "morph",
      `suffix=${authority.opaqueSuffix}`,
    );
  },
);

Deno.test(
  "A4.2.4 unrooted target remains explicit unrooted candidate",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },

      predicate: {
        entity: "phrase",
      },
    };

    const row = manifest({
      target: "external.subject",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const authority = result.authorities[0];

    assert(
      authority.rootMatch ===
          "unrooted" &&
        authority.rootBindingName ===
          null &&
        authority.opaqueSuffix ===
          null &&
        authority.rooted ===
          false,
      "unrooted target was guessed/completed",
    );

    assert(
      result.unrootedAuthorityIds.length ===
        1,
      "unrooted authority not surfaced",
    );
  },
);

Deno.test(
  "A4.2.5 exact manifest identity is mandatory",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },
    };

    const row = manifest({
      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [],
      );

    assert(
      result.status ===
        "blocked",
      "missing exact manifest was accepted",
    );

    assert(
      result.authorities.length ===
        0,
      "authority survived missing manifest",
    );
  },
);

Deno.test(
  "A4.2.6 stale exact action snapshot fails closed",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },

      predicate: {
        entity: "phrase",
      },
    };

    const original = manifest({
      target: "subject",

      bindings,
    });

    const staleRow = manifest({
      target: "predicate",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          original,
        ),
        bindingAuthorities(
          bindings,
        ),
        [staleRow],
      );

    assert(
      result.status ===
        "blocked",
      "stale action snapshot was accepted",
    );
  },
);

Deno.test(
  "A4.2.7 stale binding-definition snapshot fails closed",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },

      predicate: {
        entity: "phrase",
      },
    };

    const row = manifest({
      bindings,
    });

    const staleBindingAuthorities = [
      bindingAuthority({
        bindingName: "subject",

        definition: {
          entity: "token",
        },
      }),

      bindingAuthority({
        bindingName: "predicate",

        definition: bindings.predicate,
      }),
    ];

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        staleBindingAuthorities,
        [row],
      );

    assert(
      result.status ===
        "blocked",
      "stale binding snapshot was accepted",
    );
  },
);

Deno.test(
  "A4.2.8 duplicate A4.1 authority identity fails closed",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },
    };

    const row = manifest({
      bindings,
    });

    const a4_1 = setRoleResult(
      row,
    );

    const duplicatedA4_1 = {
      ...a4_1,

      authorities: [
        a4_1.authorities[0],
        a4_1.authorities[0],
      ],
    };

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        duplicatedA4_1,
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "blocked",
      "duplicate A4.1 authority accepted",
    );
  },
);
Deno.test(
  "A4.2.9 duplicate binding-name authority fails closed",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",
      },
    };

    const row = manifest({
      bindings,
    });

    const first = bindingAuthority({
      id: "binding:one",

      bindingName: "subject",

      definition: bindings.subject,
    });

    const second = bindingAuthority({
      id: "binding:two",

      bindingName: "subject",

      definition: bindings.subject,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        [
          first,
          second,
        ],
        [row],
      );

    assert(
      result.status ===
        "blocked",
      "duplicate binding name was accepted",
    );
  },
);

Deno.test(
  "A4.2.10 reference rooting performs no semantic or graph execution",
  () => {
    const bindings = {
      subject: {
        entity: "phrase",

        scope: "sentence",

        cardinality: "one",
      },

      predicate: {
        entity: "phrase",

        scope: "sentence",

        cardinality: "one",
      },
    };

    const row = manifest({
      target: "subject",

      bindings,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
        setRoleResult(
          row,
        ),
        bindingAuthorities(
          bindings,
        ),
        [row],
      );

    assert(
      result.status ===
        "ready",
      result.blockingReasons.join(","),
    );

    const g = result.authorities[0]
      .governance;

    assert(
      g.setRoleActionAuthorityRequired ===
          true &&
        g.exactValidatedManifestRequired ===
          true &&
        g.exactActionSnapshotRequired ===
          true &&
        g.exactBindingDefinitionSetRequired ===
          true &&
        g.manifestLocalBindingRootsOnly ===
          true &&
        g.longestExactBindingPrefixWins ===
          true &&
        g.lexicalDelimiterOnly ===
          true &&
        g.referenceExpressionPreserved ===
          true &&
        g.opaqueSuffixPreserved ===
          true &&
        g.targetReferenceRootResolved ===
          true &&
        g.referenceExpressionGrammarResolved ===
          false &&
        g.dottedPathSemanticsResolved ===
          false &&
        g.suffixSemanticsResolved ===
          false &&
        g.bindingSemanticsResolved ===
          false &&
        g.roleSemanticsResolved ===
          false &&
        g.subjectRoleSemanticsResolved ===
          false &&
        g.targetOccurrenceBound ===
          false &&
        g.whereExecuted ===
          false &&
        g.scopeExecuted ===
          false &&
        g.cardinalityEnforced ===
          false &&
        g.subjectOfRelationInferred ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.winnerSelected ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.candidateOnly ===
          true &&
        g.frozenGrammarReadOnly ===
          true,
      "A4.2 crossed reference-root boundary",
    );

    assert(
      result.rootedAuthorityIds.length ===
          1 &&
        result.unrootedAuthorityIds.length ===
          0,
      "root classification summary changed",
    );
  },
);

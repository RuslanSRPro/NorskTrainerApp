import {
  resolveCanonicalRuntimeDependencyActionActivationAuthorityV1,
  type CanonicalRuntimeDependencyActionActivationAuthorityV1,
} from "./canonical-runtime-dependency-action-activation-authority-resolution-v1.ts";

import type {
  CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type Precondition =
  Pick<
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
    | "manifestId"
    | "dependencyActionAuthorityId"
  >;

function precondition(
  manifestId = "manifest-1",
  dependencyActionAuthorityId = "dependency-action-1",
): Precondition {
  return {
    manifestId,
    dependencyActionAuthorityId,
  };
}

function authority(
  overrides: Partial<
    CanonicalRuntimeDependencyActionActivationAuthorityV1
  > = {},
): CanonicalRuntimeDependencyActionActivationAuthorityV1 {
  return {
    authorityId:
      "activation-authority-1",
    version:
      "v1",
    manifestId:
      "manifest-1",
    dependencyActionAuthorityId:
      "dependency-action-1",
    decision:
      "granted",
    provenance: {
      source:
        "test-authored-source",
    },
    supersedesAuthorityId:
      null,
    ...overrides,
  };
}

Deno.test(
  "D6.3 exact authored grant resolves granted without deriving execution admission",
  () => {
    const source =
      precondition();

    const authored =
      authority();

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        source,
        [authored],
      );

    assert(
      result.state ===
        "resolved_granted",
      "expected resolved_granted",
    );

    assert(
      result.sourceAuthority ===
        authored,
      "must preserve exact authority object",
    );

    assert(
      result.sourcePreconditionEvidence ===
        source,
      "must preserve exact precondition object",
    );

    assert(
      result.governance.executionAdmissionDerived ===
        false,
      "grant must not derive execution admission",
    );

    assert(
      result.governance.runtimeActionExecuted ===
        false,
      "grant must not execute action",
    );

    assert(
      result.governance.graphMutationPerformed ===
        false,
      "grant must not mutate graph",
    );
  },
);

Deno.test(
  "D6.3 explicit authored denial remains denial",
  () => {
    const authored =
      authority({
        decision:
          "denied",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [authored],
      );

    assert(
      result.state ===
        "resolved_denied",
      "expected resolved_denied",
    );

    assert(
      result.sourceAuthority ===
        authored,
      "must preserve denial authority",
    );
  },
);

Deno.test(
  "D6.3 absence fails closed and is not converted to denial",
  () => {
    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [],
      );

    assert(
      result.state ===
        "unresolved_absent",
      "expected unresolved_absent",
    );

    assert(
      result.sourceAuthority ===
        null,
      "absence must have no source authority",
    );
  },
);

Deno.test(
  "D6.3 unrelated authority does not satisfy exact scope",
  () => {
    const unrelated =
      authority({
        manifestId:
          "other-manifest",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [unrelated],
      );

    assert(
      result.state ===
        "unresolved_absent",
      "foreign scope must remain absent",
    );

    assert(
      result.applicableAuthorities.length ===
        0,
      "foreign authority must be excluded",
    );
  },
);

Deno.test(
  "D6.3 multiple unsuperseded exact authorities fail closed as ambiguous",
  () => {
    const first =
      authority({
        authorityId:
          "activation-authority-1",
        version:
          "v1",
        decision:
          "granted",
      });

    const second =
      authority({
        authorityId:
          "activation-authority-2",
        version:
          "v2",
        decision:
          "denied",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [
          first,
          second,
        ],
      );

    assert(
      result.state ===
        "unresolved_ambiguous",
      "multiple heads must be ambiguous",
    );

    assert(
      result.sourceAuthority ===
        null,
      "ambiguous result must not choose authority",
    );
  },
);

Deno.test(
  "D6.3 explicit supersession resolves the unique head without version ordering",
  () => {
    const first =
      authority({
        authorityId:
          "activation-authority-1",
        version:
          "version-z",
        decision:
          "granted",
      });

    const second =
      authority({
        authorityId:
          "activation-authority-2",
        version:
          "version-a",
        decision:
          "denied",
        supersedesAuthorityId:
          "activation-authority-1",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [
          first,
          second,
        ],
      );

    assert(
      result.state ===
        "resolved_denied",
      "explicit superseding authority must resolve",
    );

    assert(
      result.sourceAuthority ===
        second,
      "must resolve explicit supersession head",
    );

    assert(
      result.governance.implicitLatestVersionSelectionAllowed ===
        false,
      "version ordering must not select authority",
    );
  },
);

Deno.test(
  "D6.3 invalid supersession fails closed",
  () => {
    const invalid =
      authority({
        supersedesAuthorityId:
          "missing-authority",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [invalid],
      );

    assert(
      result.state ===
        "unresolved_invalid",
      "invalid supersession must fail closed",
    );

    assert(
      result.sourceAuthority ===
        null,
      "invalid authority must not be selected",
    );
  },
);

Deno.test(
  "D6.3 duplicate authority identity fails closed",
  () => {
    const first =
      authority();

    const duplicate =
      authority({
        version:
          "v2",
        decision:
          "denied",
      });

    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(),
        [
          first,
          duplicate,
        ],
      );

    assert(
      result.state ===
        "unresolved_invalid",
      "duplicate authority id must fail closed",
    );
  },
);

Deno.test(
  "D6.3 invalid runtime scope identity fails closed",
  () => {
    const result =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        precondition(
          "",
          "dependency-action-1",
        ),
        [],
      );

    assert(
      result.state ===
        "unresolved_invalid",
      "invalid scope identity must fail closed",
    );
  },
);
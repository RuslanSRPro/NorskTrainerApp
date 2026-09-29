import {
  type CanonicalRuntimeDependencyActionActivationSourceRowV1,
  readCanonicalRuntimeDependencyActionActivationSourceRowsV1,
} from "./canonical-runtime-dependency-action-activation-source-reader-v1.ts";

function assert(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const scope = {
  manifestId: "manifest:1",
  dependencyActionAuthorityId: "dependency-action:1",
};

function row(
  overrides: Partial<
    CanonicalRuntimeDependencyActionActivationSourceRowV1
  > = {},
): CanonicalRuntimeDependencyActionActivationSourceRowV1 {
  return {
    authority_id: "authority:1",
    manifest_id: scope.manifestId,
    dependency_action_authority_id: scope.dependencyActionAuthorityId,
    version: "authored-version:1",
    decision: "granted",
    provenance: {
      source: "focused-test",
    },
    supersedes_authority_id: null,
    ...overrides,
  };
}

// Zero rows -> D6 absence.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [],
  );

  assert(
    result.status === "resolved_source_rows",
    "zero rows are a valid source read",
  );

  assert(
    result.activationResolution.state ===
      "unresolved_absent",
    "zero rows must remain D6 absence",
  );
}

// Exact granted row.
{
  const source = row();

  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [source],
  );

  assert(
    result.activationResolution.state ===
      "resolved_granted",
    "explicit grant must resolve granted",
  );

  assert(
    result.mappedAuthorities[0].version ===
      source.version,
    "authored version must be preserved",
  );

  assert(
    result.mappedAuthorities[0].provenance ===
      source.provenance,
    "provenance object must be preserved exactly",
  );
}

// Exact denied row.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [
      row({
        decision: "denied",
      }),
    ],
  );

  assert(
    result.activationResolution.state ===
      "resolved_denied",
    "explicit denial must resolve denied",
  );
}

// Valid explicit supersession.
{
  const first = row({
    authority_id: "authority:1",
    decision: "denied",
    version: "authored-version:1",
  });

  const second = row({
    authority_id: "authority:2",
    decision: "granted",
    version: "authored-version:2",
    supersedes_authority_id: "authority:1",
  });

  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [first, second],
  );

  assert(
    result.activationResolution.state ===
      "resolved_granted",
    "D6 must resolve explicit supersession",
  );

  assert(
    result.activationResolution.sourceAuthority
      ?.authorityId === "authority:2",
    "D6 must own head resolution",
  );
}

// Multiple unsuperseded heads -> ambiguous.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [
      row({
        authority_id: "authority:1",
      }),
      row({
        authority_id: "authority:2",
      }),
    ],
  );

  assert(
    result.activationResolution.state ===
      "unresolved_ambiguous",
    "reader must not select a winner",
  );
}

// Foreign scope rows are not promoted into this scope.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [
      row({
        authority_id: "foreign:1",
        manifest_id: "manifest:foreign",
      }),
    ],
  );

  assert(
    result.mappedAuthorities.length === 0,
    "foreign manifest authority must be excluded",
  );

  assert(
    result.activationResolution.state ===
      "unresolved_absent",
    "foreign authority must not grant permission",
  );
}

// Malformed authored version fails closed before D6.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [
      row({
        version: "",
      }),
    ],
  );

  assert(
    result.status ===
      "unresolved_source_rows",
    "malformed version must fail source mapping",
  );

  assert(
    result.blockingReasons.includes(
      "activation_source_row_invalid",
    ),
    "malformed row must expose source blocking reason",
  );

  assert(
    result.activationResolution.state !==
      "resolved_granted",
    "malformed row must never grant",
  );
}

// Malformed decision fails closed.
{
  const result = readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
    scope,
    [
      row({
        decision: "ready",
      }),
    ],
  );

  assert(
    result.status ===
      "unresolved_source_rows",
    "non-authored activation vocabulary must fail",
  );

  assert(
    result.activationResolution.state !==
      "resolved_granted",
    "readiness must never become permission",
  );
}

console.log(
  "A2_3_ACTIVATION_SOURCE_READER_FOCUSED_TEST=PASS",
);

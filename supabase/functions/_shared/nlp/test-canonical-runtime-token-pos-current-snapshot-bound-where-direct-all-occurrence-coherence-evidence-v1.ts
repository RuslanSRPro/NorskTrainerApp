import {
  decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1.ts";

function assert(
  condition: boolean,
  message: string,
): void {
  if (
    !condition
  ) {
    throw new Error(
      message,
    );
  }
}

function leaf(
  manifestLeafPath: string,
  expectedSiteAuthorityId: string,
  referencedBindingDefinitionAuthorityId: string,
  filteringDomainId: string,
  occurrences: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1 {
  return {
    manifestLeafPath,
    expectedSiteAuthorityId,
    referencedBindingDefinitionAuthorityId,
    filteringDomainId,
    survivingSnapshotTokenOccurrenceIdentityIds:
      occurrences,
  };
}

Deno.test(
  "direct ALL same referenced binding preserves nonempty shared occurrence set without selecting winner",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
              "occ-2",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-x",
            "filter-b",
            [
              "occ-2",
              "occ-3",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "ready",
      "expected ready coherence evidence",
    );

    if (
      result.status !==
      "ready"
    ) {
      return;
    }

    assert(
      result.evidence.groupCount ===
        1,
      "expected one same-binding coherence group",
    );

    assert(
      result.evidence.coherenceFailureCount ===
        0,
      "expected no coherence failure",
    );

    const group =
      result.evidence.groups[0];

    assert(
      group.sharedSnapshotTokenOccurrenceIdentityIds.length ===
        1 &&
        group.sharedSnapshotTokenOccurrenceIdentityIds[0] ===
          "occ-2",
      "expected exact shared occurrence evidence",
    );

    assert(
      result.evidence.governance.occurrenceWinnerSelected ===
        false,
      "must not select occurrence winner",
    );
  },
);

Deno.test(
  "B-2 direct ALL same referenced binding with disjoint survivor sets produces coherence failure evidence, not boolean false",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-x",
            "filter-b",
            [
              "occ-2",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "ready",
      "expected ready evidence for structurally valid incoherence",
    );

    if (
      result.status !==
      "ready"
    ) {
      return;
    }

    assert(
      result.evidence.coherenceFailureCount ===
        1,
      "expected one coherence failure",
    );

    const group =
      result.evidence.groups[0];

    assert(
      group.coherenceState ===
        "incoherent_no_shared_occurrence",
      "expected incoherent state",
    );

    assert(
      group.sharedSnapshotTokenOccurrenceIdentityIds.length ===
        0,
      "expected empty shared occurrence intersection",
    );

    assert(
      result.evidence.governance.emptyIntersectionClassifiedAsBooleanFalse ===
        false,
      "empty intersection must not fabricate boolean false",
    );

    assert(
      result.evidence.governance.booleanTruthExecuted ===
        false,
      "coherence layer must not execute boolean truth",
    );
  },
);

Deno.test(
  "different referenced bindings remain independent and are never forced to share token occurrence identity",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-y",
            "filter-b",
            [
              "occ-2",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "ready",
      "expected ready evidence",
    );

    if (
      result.status !==
      "ready"
    ) {
      return;
    }

    assert(
      result.evidence.groupCount ===
        0,
      "different bindings must not form a coherence group",
    );

    assert(
      result.evidence.coherenceFailureCount ===
        0,
      "different bindings must not fail occurrence coherence",
    );

    assert(
      result.evidence.governance.differentReferencedBindingsComparedForOccurrenceEquality ===
        false,
      "different bindings must never be compared for occurrence equality",
    );
  },
);

Deno.test(
  "three direct leaves sharing one referenced binding require one occurrence surviving all leaves",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
          "$.where.all[2]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
              "occ-2",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-x",
            "filter-b",
            [
              "occ-2",
              "occ-3",
            ],
          ),
          leaf(
            "$.where.all[2]",
            "expected-c",
            "binding-x",
            "filter-c",
            [
              "occ-2",
              "occ-4",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "ready",
      "expected ready evidence",
    );

    if (
      result.status !==
      "ready"
    ) {
      return;
    }

    assert(
      result.evidence.groups[0]
          .sharedSnapshotTokenOccurrenceIdentityIds.length ===
        1 &&
        result.evidence.groups[0]
            .sharedSnapshotTokenOccurrenceIdentityIds[0] ===
          "occ-2",
      "expected occurrence surviving every same-binding direct leaf",
    );
  },
);

Deno.test(
  "multiple filtering domains for one direct leaf fail closed",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a-1",
            [
              "occ-1",
            ],
          ),
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a-2",
            [
              "occ-2",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-x",
            "filter-b",
            [
              "occ-1",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "blocked",
      "ambiguous leaf-to-filtering-domain join must block",
    );

    if (
      result.status !==
      "blocked"
    ) {
      return;
    }

    assert(
      result.blockingReasons.includes(
        "direct_all_leaf:$.where.all[0]:not_exactly_one_filtering_domain",
      ),
      "expected exact ambiguous-domain blocking reason",
    );
  },
);

Deno.test(
  "missing filtering domain for one direct leaf fails closed",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "blocked",
      "missing leaf evidence must block",
    );
  },
);

Deno.test(
  "evidence outside direct ALL children fails closed instead of silently generalizing nested scope",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[1]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
            ],
          ),
          leaf(
            "$.where.all[1]",
            "expected-b",
            "binding-x",
            "filter-b",
            [
              "occ-1",
            ],
          ),
          leaf(
            "$.where.all[1].any[0]",
            "expected-c",
            "binding-x",
            "filter-c",
            [
              "occ-1",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "blocked",
      "out-of-scope nested evidence must block",
    );
  },
);

Deno.test(
  "duplicate direct leaf path fails closed",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
        "$.where.all",
        [
          "$.where.all[0]",
          "$.where.all[0]",
        ],
        [
          leaf(
            "$.where.all[0]",
            "expected-a",
            "binding-x",
            "filter-a",
            [
              "occ-1",
            ],
          ),
        ],
      );

    assert(
      result.status ===
        "blocked",
      "duplicate direct leaf path must block",
    );
  },
);

Deno.test(
  "public coherence derivation reexecutes canonical upstream authorities and does not accept supplied wrappers",
  async () => {
    const source =
      await Deno.readTextFile(
        new URL(
          "./canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1.ts",
          import.meta.url,
        ),
      );

    assert(
      source.includes(
        "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1(",
      ),
      "must independently reexecute occurrence filtering",
    );

    assert(
      source.includes(
        "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(",
      ),
      "must independently reexecute structural bridge",
    );

    assert(
      source.includes(
        "deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(",
      ),
      "must independently rederive manifest WHERE shape",
    );

    assert(
      source.includes(
        "deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(",
      ),
      "must independently derive compound operator shape",
    );

    assert(
      source.includes(
        "suppliedOccurrenceFilteringAcceptedAsProof:`n          false",
      ) ||
        source.includes(
          "suppliedOccurrenceFilteringAcceptedAsProof: false",
        ),
      "supplied filtering must not be accepted as proof",
    );

    assert(
      source.includes(
        "suppliedLeafStructuralBridgeAcceptedAsProof:`n          false",
      ) ||
        source.includes(
          "suppliedLeafStructuralBridgeAcceptedAsProof: false",
        ),
      "supplied bridge must not be accepted as proof",
    );

    assert(
      source.includes(
        "suppliedCompoundOperatorShapeAcceptedAsProof:`n          false",
      ) ||
        source.includes(
          "suppliedCompoundOperatorShapeAcceptedAsProof: false",
        ),
      "supplied compound shape must not be accepted as proof",
    );
  },
);

Deno.test(
  "public coherence derivation remains pre-cardinality and does not execute truth or choose occurrence winner",
  async () => {
    const source =
      await Deno.readTextFile(
        new URL(
          "./canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1.ts",
          import.meta.url,
        ),
      );

    assert(
      !source.includes(
        "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1(",
      ),
      "coherence derivation must remain before cardinality semantics",
    );

    assert(
      source.includes(
        "occurrenceWinnerSelected:`n          false",
      ) ||
        source.includes(
          "occurrenceWinnerSelected: false",
        ),
      "must not select occurrence winner",
    );

    assert(
      source.includes(
        "emptyIntersectionClassifiedAsBooleanFalse:`n          false",
      ) ||
        source.includes(
          "emptyIntersectionClassifiedAsBooleanFalse: false",
        ),
      "must not classify empty intersection as boolean false",
    );

    assert(
      source.includes(
        "booleanTruthExecuted:`n          false",
      ) ||
        source.includes(
          "booleanTruthExecuted: false",
        ),
      "must not execute boolean truth",
    );
  },
);

Deno.test(
  "public coherence derivation limits contract to direct leaf children of ALL and rejects nested scope",
  async () => {
    const source =
      await Deno.readTextFile(
        new URL(
          "./canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1.ts",
          import.meta.url,
        ),
      );

    assert(
      /node\.operatorKey\s*(?:===|!==)\s*"all"/s.test(
        source,
      ),
      "public derivation must scope occurrence coherence to ALL",
    );

    assert(
      /child\.shape\s*!==\s*"leaf_operator"/s.test(
        source,
      ),
      "non-leaf direct children must be detected",
    );

    assert(
      source.includes(
        "nested_or_non_leaf_child_outside_contract",
      ),
      "nested compound scope must fail closed",
    );
  },
);
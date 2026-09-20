import {
  decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-authority-bound-leaf-truth-evidence-v1.ts";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(message);
  }
}

const domain = {
  boundConditionDomainEvidenceId: "domain-1",
  expectedSiteAuthorityId: "site-1",
  bindingDefinitionAuthorityId: "binding-authority-1",
  manifestId: "manifest-1",
  manifestCode: "manifest-code-1",
  referencedBindingName: "binding-1",
  snapshotIdentityId: "snapshot-1",
  snapshotSentenceOccurrenceIdentityId: "sentence-occurrence-1",
};

function makeBoundMember(
  id: string,
  booleanTruth: boolean,
) {
  return {
    boundConditionMemberEvidenceId: id,
    booleanTruthResolved: true,
    booleanTruth,
  };
}

function makeFilteredFalse(
  id: string,
  tokenOccurrenceId: string,
) {
  return {
    filteredFalseConditionEvidenceId: id,
    expectedSiteAuthorityId:
      domain.expectedSiteAuthorityId,
    bindingDefinitionAuthorityId:
      domain.bindingDefinitionAuthorityId,
    manifestId:
      domain.manifestId,
    manifestCode:
      domain.manifestCode,
    referencedBindingName:
      domain.referencedBindingName,
    snapshotIdentityId:
      domain.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      domain.snapshotSentenceOccurrenceIdentityId,
    snapshotTokenOccurrenceIdentityId:
      tokenOccurrenceId,
  };
}

Deno.test(
  "leaf decision preserves singleton TRUE",
  () => {
    const member =
      makeBoundMember("bound-true-1", true);

    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-true",
          memberCount: 1,
          members: [member],
        },
        domain,
        [],
      );

    assert(result.status === "resolved", "TRUE must resolve");

    if (result.status !== "resolved") {
      return;
    }

    assert(
      result.truthDisposition === "resolved_true",
      "TRUE disposition changed",
    );

    assert(
      result.member === member,
      "exact bound member identity was not preserved",
    );

    assert(
      result.filteredFalseEvidence === null,
      "TRUE path consumed filtered FALSE",
    );
  },
);

Deno.test(
  "leaf decision preserves singleton bound FALSE",
  () => {
    const member =
      makeBoundMember("bound-false-1", false);

    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-bound-false",
          memberCount: 1,
          members: [member],
        },
        domain,
        [],
      );

    assert(result.status === "resolved", "bound FALSE must resolve");

    if (result.status !== "resolved") {
      return;
    }

    assert(
      result.truthDisposition === "resolved_false",
      "bound FALSE disposition changed",
    );

    assert(
      result.member === member,
      "exact bound FALSE member identity was not preserved",
    );
  },
);

Deno.test(
  "leaf decision resolves FALSE from exactly one joined filtered FALSE evidence",
  () => {
    const evidence =
      makeFilteredFalse(
        "filtered-false-1",
        "token-filtered-false-1",
      );

    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-filtered-false",
          memberCount: 0,
          members: [],
        },
        domain,
        [evidence],
      );

    assert(result.status === "resolved", "filtered FALSE must resolve");

    if (result.status !== "resolved") {
      return;
    }

    assert(
      result.truthDisposition === "resolved_false",
      "filtered FALSE did not become resolved_false",
    );

    assert(
      result.member === null,
      "filtered FALSE fabricated a bound member",
    );

    assert(
      result.filteredFalseEvidence === evidence,
      "exact filtered FALSE evidence identity was not preserved",
    );
  },
);

Deno.test(
  "leaf decision never infers FALSE from empty evidence",
  () => {
    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-empty",
          memberCount: 0,
          members: [],
        },
        domain,
        [],
      );

    assert(result.status === "blocked", "empty evidence must block");

    if (result.status !== "blocked") {
      return;
    }

    assert(
      result.blockingReason ===
        "bound_condition_collection:empty_truth_not_specified:collection-empty",
      "empty evidence changed semantic state",
    );
  },
);

Deno.test(
  "leaf decision blocks multiple matching filtered FALSE evidence",
  () => {
    const first =
      makeFilteredFalse("filtered-false-1", "token-false-1");

    const second =
      makeFilteredFalse("filtered-false-2", "token-false-2");

    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-multiple-false",
          memberCount: 0,
          members: [],
        },
        domain,
        [first, second],
      );

    assert(
      result.status === "blocked",
      "multiple filtered FALSE evidence must block",
    );

    if (result.status !== "blocked") {
      return;
    }

    assert(
      result.blockingReason ===
        "filtered_false_condition:not_exactly_one:domain-1",
      "multiple filtered FALSE evidence was aggregated",
    );
  },
);

Deno.test(
  "leaf decision blocks multiple bound members",
  () => {
    const first =
      makeBoundMember("bound-1", true);

    const second =
      makeBoundMember("bound-2", true);

    const result =
      decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafTruthV1(
        {
          boundConditionCollectionId: "collection-multiple-bound",
          memberCount: 2,
          members: [first, second],
        },
        domain,
        [],
      );

    assert(
      result.status === "blocked",
      "multiple bound members must block",
    );

    if (result.status !== "blocked") {
      return;
    }

    assert(
      result.blockingReason ===
        "bound_condition_collection:multiple_member_truth_aggregation_not_specified:collection-multiple-bound",
      "multiple bound members were aggregated",
    );
  },
);
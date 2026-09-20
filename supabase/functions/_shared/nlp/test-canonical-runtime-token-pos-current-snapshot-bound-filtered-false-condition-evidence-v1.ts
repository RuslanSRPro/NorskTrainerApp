import {
  isExactFilteredFalse,
} from "./canonical-runtime-token-pos-current-snapshot-bound-filtered-false-condition-evidence-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function exactFilteredFalseOccurrence():
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1 {
  return {
    bindingEligibilityOccurrenceId:
      "fixture:binding-eligibility-occurrence:1",
    status:
      "proven_snapshot_bound_binding_eligibility",

    sourceFilteringId:
      "fixture:filtering:1",
    sourceDispositionId:
      "fixture:disposition:1",

    snapshotIdentityId:
      "fixture:snapshot:1",
    snapshotSentenceOccurrenceIdentityId:
      "fixture:snapshot-sentence-occurrence:1",
    snapshotTokenOccurrenceIdentityId:
      "fixture:snapshot-token-occurrence:1",

    graphDocumentId:
      "fixture:graph-document:1",
    sentenceNodeId:
      "fixture:sentence:1",
    sentenceIndex:
      0,

    tokenNodeId:
      "fixture:token:1",
    containmentEdgeId:
      "fixture:containment:1",
    sentenceTokenIndex:
      0,

    disposition:
      "rejected",
    booleanTruth:
      false,
    booleanTruthResolved:
      true,

    filteringState:
      "filtered_out",
    survivesFiltering:
      false,

    eligibilityState:
      "filtered_out",
    bindingEligible:
      false,
  };
}

Deno.test(
  "filtered FALSE seam accepts the exact proven rejected occurrence contract",
  () => {
    const occurrence =
      exactFilteredFalseOccurrence();

    assert(
      isExactFilteredFalse(
        occurrence,
      ),
      "exact rejected + resolved FALSE + filtered_out occurrence must be accepted",
    );

    assert(
      occurrence.snapshotTokenOccurrenceIdentityId ===
        "fixture:snapshot-token-occurrence:1",
      "occurrence identity must remain available at the seam",
    );
  },
);

Deno.test(
  "filtered FALSE seam rejects every near-miss and never infers FALSE from absence",
  () => {
    const exact =
      exactFilteredFalseOccurrence();

    const nearMisses:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1[] =
        [
          {
            ...exact,
            disposition: "satisfied",
          },
          {
            ...exact,
            booleanTruth: true,
          },
          {
            ...exact,
            booleanTruthResolved: false,
          },
          {
            ...exact,
            filteringState: "survives",
          },
          {
            ...exact,
            survivesFiltering: true,
          },
          {
            ...exact,
            eligibilityState: "eligible",
          },
          {
            ...exact,
            bindingEligible: true,
          },
        ];

    for (
      const occurrence of nearMisses
    ) {
      assert(
        !isExactFilteredFalse(
          occurrence,
        ),
        JSON.stringify(
          occurrence,
        ),
      );
    }

    const noOccurrence:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1[] =
        [];

    assert(
      noOccurrence.filter(
        isExactFilteredFalse,
      ).length ===
        0,
      "absence of occurrence must not synthesize FALSE evidence",
    );
  },
);
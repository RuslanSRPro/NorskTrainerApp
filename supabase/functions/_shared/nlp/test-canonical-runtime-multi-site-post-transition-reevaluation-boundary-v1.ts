import {
  CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_V1,
  deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1,
} from "./canonical-runtime-multi-site-post-transition-reevaluation-boundary-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.8C multi-site post-transition boundary exports canonical producer", () => {
  assert(
    CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_V1 ===
      "canonical_runtime_multi_site_post_transition_reevaluation_boundary_v1",
    "producer mismatch",
  );
  assert(
    typeof deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1 ===
      "function",
    "deriver missing",
  );
});

Deno.test("A3.8C rejects empty token domain without selecting authority", async () => {
  const result =
    await deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1({
      seed: {} as never,
      tokenNodeIds: [],
    });
  assert(result.status === "blocked", "empty token domain must block");
  assert(result.stage === "site_domain", "wrong blocking stage");
  assert(
    result.governance.tokenWinnerSelected === false &&
      result.governance.firstTokenUsedAsAuthority === false,
    "token authority must not be invented",
  );
});

Deno.test("A3.8C source preserves multi-site governance and no execution", () => {
  const source = Deno.readTextFileSync(
    new URL(
      "./canonical-runtime-multi-site-post-transition-reevaluation-boundary-v1.ts",
      import.meta.url,
    ),
  );
  for (
    const token of [
      "tokenNodeIds: readonly string[]",
      "for (const tokenNodeId of input.tokenNodeIds)",
      "snapshotIdentityId !== first.snapshotIdentityId",
      "snapshotSentenceOccurrenceIdentityId !==",
      "actionCandidateBridges = siteResults.flatMap",
      "endpointEvidence = siteResults.flatMap",
      "d4Evidence = siteResults.flatMap",
      "tokenWinnerSelected: false",
      "firstTokenUsedAsAuthority: false",
      "runtimeActionExecuted: false",
      "schedulerInvoked: false",
      "activationPermissionResolved: false",
    ]
  ) {
    assert(source.includes(token), `missing governance token: ${token}`);
  }
});

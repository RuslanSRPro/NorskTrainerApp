// Test-only projection of an existing V32 prefix clause into a bounded candidate.
// It does not run in Production or authorize a grammar rule.
const fixtureUrl = new URL("../artifacts/R077-scoped-core-contract-fixture.json", import.meta.url);
const fixture = JSON.parse(await Deno.readTextFile(fixtureUrl));

let checkCount = 0;
function check(condition, message) {
  checkCount += 1;
  if (!condition) throw new Error(message);
}

export function projectScopedCoreCandidate(input) {
  const tokens = input.tokens ?? [];
  const ids = tokens.map((token) => token.canonical_token_id);
  check(tokens.length > 0, "tokens_missing");
  check(ids.every((id) => typeof id === "string" && id.length > 0), "canonical_id_missing");
  check(new Set(ids).size === ids.length, "canonical_id_duplicate");
  check(tokens.every((token, offset) => token.token_index === offset + 1), "token_index_noncontiguous");

  const prefixClauses = input.prefix_clauses ?? [];
  if (prefixClauses.length !== 1) {
    return { status: "blocked", reason: "unique_prefix_core_absent", graph_edges: [] };
  }
  const clause = prefixClauses[0];
  const subject = tokens.find((token) => token.token_index === clause.subject_token_index);
  const finite = tokens.find((token) => token.token_index === clause.finite_token_index);
  check(subject && finite && subject !== finite, "core_binding_invalid");

  const claimedCoreTokenIds = [subject.canonical_token_id, finite.canonical_token_id];
  const deferredTokenIds = ids.filter((id) => !claimedCoreTokenIds.includes(id));
  const expressionCandidates = (input.early_expression_candidates ?? []).map((candidate) => {
    check(candidate.status === "candidate", "expression_status_promoted");
    check(candidate.canonical_token_ids.every((id) => deferredTokenIds.includes(id)), "expression_span_not_deferred");
    return {
      status: "candidate",
      source_lexeme_id: candidate.source_lexeme_id,
      canonical_token_ids: candidate.canonical_token_ids,
    };
  });

  return {
    status: "candidate",
    subject_role_status: "unverified",
    whole_sentence_status: "unverified",
    subject_token_id: subject.canonical_token_id,
    finite_token_id: finite.canonical_token_id,
    claimed_core_token_ids: claimedCoreTokenIds,
    deferred_token_ids: deferredTokenIds,
    expression_candidates: expressionCandidates,
    graph_edges: [],
  };
}

const results = Object.fromEntries(
  fixture.cases.map((input) => [input.text, projectScopedCoreCandidate(input)]),
);
const longTail = results["Hunden spiser fisken i dag"];
check(longTail.status === "candidate", "long_tail_core_missing");
check(longTail.claimed_core_token_ids.length === 2, "long_tail_core_coverage");
check(longTail.deferred_token_ids.length === 3, "long_tail_deferred_coverage");
check(longTail.expression_candidates.length === 1, "long_tail_expression_candidate");
check(longTail.expression_candidates[0].canonical_token_ids.every(
  (id) => longTail.deferred_token_ids.includes(id)
), "long_tail_expression_outside_deferred");
check(longTail.graph_edges.length === 0, "long_tail_graph_edge_leak");
for (const label of ["Hunden spiser fisken i boken", "Hunden spiser fisken dag i"]) {
  const result = results[label];
  check(result.status === "candidate", "near_negative_core_missing:" + label);
  check(result.expression_candidates.length === 0,
    "near_negative_expression_promoted:" + label);
  check(result.deferred_token_ids.length === 3, "near_negative_tail_erased:" + label);
  check(result.graph_edges.length === 0, "near_negative_edge_leak:" + label);
}

const svoOvs = results["Fisken spiser hunden"];
check(svoOvs.status === "candidate" && svoOvs.subject_role_status === "unverified",
  "svo_ovs_unjustified_resolution");
check(svoOvs.deferred_token_ids.length === 1, "svo_ovs_object_unclaimed");
check(svoOvs.graph_edges.length === 0, "svo_ovs_graph_edge_leak");

for (const label of ["Spiser hunden fisken?", "Hunden og fisken"]) {
  check(results[label].status === "blocked" && results[label].graph_edges.length === 0,
    "invented_core:" + label);
}
for (const [label, result] of Object.entries(results)) {
  if (result.status !== "candidate") continue;
  const original = fixture.cases.find((input) => input.text === label);
  const all = new Set(original.tokens.map((token) => token.canonical_token_id));
  const covered = [...result.claimed_core_token_ids, ...result.deferred_token_ids];
  check(covered.length === all.size && new Set(covered).size === all.size &&
    covered.every((id) => all.has(id)), "token_coverage_loss:" + label);
}

const malformed = structuredClone(fixture.cases.find((input) => input.text === "Fisken spiser hunden"));
malformed.tokens[2].canonical_token_id = malformed.tokens[0].canonical_token_id;
let rejected = false;
try { projectScopedCoreCandidate(malformed); } catch { rejected = true; }
check(rejected, "duplicate_canonical_id_not_rejected");

console.log(JSON.stringify({
  status: "PASS",
  checks: checkCount,
  production_mutation: false,
  graph_transition: false,
  results,
}, null, 2));

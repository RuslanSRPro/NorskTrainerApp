import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
  type LanguageGraphEvidenceV1,
  type LanguageGraphProvenanceV1,
} from "../../supabase/functions/_shared/nlp/canonical-language-graph-core-v1.ts";
import { buildCanonicalSurfaceDocumentV1 } from "../../supabase/functions/_shared/nlp/canonical-surface-boundary-v1.ts";
import { buildSqlStructuralCompatibilityMapV1 } from "../../supabase/functions/_shared/nlp/sql-structural-compatibility-map-v1.ts";
import { clausePatchFromLegacyV11 } from "../../supabase/functions/_shared/nlp/legacy-language-graph-adapter-v1.ts";

const fixture = JSON.parse(await Deno.readTextFile(
  new URL("../artifacts/R077-scoped-core-contract-fixture.json", import.meta.url),
));
const prior = JSON.parse(await Deno.readTextFile(
  new URL("../artifacts/R077-scoped-core-contract-result.json", import.meta.url),
)).test_result.results;
let checks = 0;
function check(ok: unknown, message: string): asserts ok {
  checks++;
  if (!ok) throw new Error(message);
}

function spanFor(surface: ReturnType<typeof buildCanonicalSurfaceDocumentV1>, ids: string[]) {
  const first = surface.tokens.find((token) => token.id === ids[0]);
  const last = surface.tokens.find((token) => token.id === ids.at(-1));
  check(first && last, "span_token_missing");
  return {
    startTokenId: first.id,
    endTokenId: last.id,
    tokenIds: ids,
    startUtf16: first.startUtf16,
    endUtf16: last.endUtf16,
  };
}

function candidatePatch(
  surface: ReturnType<typeof buildCanonicalSurfaceDocumentV1>,
  result: (typeof prior)[string],
): GraphPatchV1 {
  const producer = "r078_test_only_scoped_core_projection";
  if (result.status !== "candidate") {
    return { producer, producerVersion: "test-only-1", nodes: [], edges: [] };
  }
  const id = `scoped-core-candidate:${result.subject_token_id}:${result.finite_token_id}`;
  const evidenceId = `evidence:${id}`;
  const provenanceId = `prov:${id}`;
  const nodes: LanguageGraphNodeV1[] = [{
    id, type: "span", subtype: "subject_predicate_core",
    status: "candidate",
    span: spanFor(surface, result.claimed_core_token_ids),
    features: {
      scope: "bounded_core_only",
      subjectRoleStatus: "unverified",
      wholeSentenceStatus: "unverified",
      deferredTokenIds: result.deferred_token_ids,
      testOnly: true,
    },
    producer,
    evidenceIds: [evidenceId],
    provenanceIds: [provenanceId],
  }];
  const evidence: LanguageGraphEvidenceV1[] = [{
    id: evidenceId, kind: "structural", status: "supports",
    targetIds: [id], producer, provenanceIds: [provenanceId],
    payload: { claim: "candidate_core_only", testOnly: true },
  }];
  const provenance: LanguageGraphProvenanceV1[] = [{
    id: provenanceId, sourceType: "system",
    sourceId: "R077_scoped_core_test_fixture",
    payload: { testOnly: true },
  }];
  for (const expression of result.expression_candidates) {
    const mweId = `source-expression-candidate:${expression.source_lexeme_id}:${expression.canonical_token_ids[0]}`;
    const mweEvidenceId = `evidence:${mweId}`;
    const mweProvenanceId = `prov:${mweId}`;
    nodes.push({
      id: mweId, type: "mwe", subtype: "source_expression",
      status: "candidate",
      span: spanFor(surface, expression.canonical_token_ids),
      features: { sourceLexemeId: expression.source_lexeme_id, syntacticFunction: null, testOnly: true },
      producer,
      evidenceIds: [mweEvidenceId],
      provenanceIds: [mweProvenanceId],
    });
    evidence.push({
      id: mweEvidenceId, kind: "lexical", status: "supports",
      targetIds: [mweId], producer, provenanceIds: [mweProvenanceId],
      payload: { claim: "source_expression_surface_candidate", testOnly: true },
    });
    provenance.push({
      id: mweProvenanceId, sourceType: "lexicon",
      sourceId: expression.source_lexeme_id,
      payload: { testOnly: true },
    });
  }
  return { producer, producerVersion: "test-only-1", nodes, edges: [], evidence, provenance };
}

const summary: Record<string, unknown> = {};
for (const input of fixture.cases) {
  const result = prior[input.text];
  check(result, "prior_case_missing:" + input.text);
  const surface = buildCanonicalSurfaceDocumentV1(input.text);
  const wordIds = surface.tokens.filter((token) => token.kind === "word").map((token) => token.id);
  check(wordIds.join("|") === input.tokens.map((token: { canonical_token_id: string }) => token.canonical_token_id).join("|"),
    "canonical_surface_drift:" + input.text);
  const patch = candidatePatch(surface, result);
  const graph = applyGraphPatchV1(createCanonicalLanguageGraphV1(surface), patch);
  check(assertCanonicalLanguageGraphV1(graph).length === 0, "graph_invariant_failed:" + input.text);
  check(graph.edges.every((edge) => edge.relation === "contains"), "grammar_edge_leak:" + input.text);
  const candidateNodes = graph.nodes.filter((node) => node.producer === patch.producer);
  check(candidateNodes.every((node) => node.status === "candidate"), "candidate_promotion:" + input.text);
  check(candidateNodes.length === (result.status === "candidate" ? 1 + result.expression_candidates.length : 0),
    "candidate_count_mismatch:" + input.text);
  check((patch.evidence ?? []).every((item) => item.targetIds.every((id) => graph.nodes.some((node) => node.id === id))),
    "orphan_evidence:" + input.text);
  const again = applyGraphPatchV1(graph, patch);
  check(again.nodes.length === graph.nodes.length && again.edges.length === graph.edges.length,
    "patch_not_idempotent:" + input.text);
  summary[input.text] = {
    candidate_nodes: candidateNodes.length,
    grammar_edges: graph.edges.filter((edge) => edge.relation !== "contains").length,
    graph_invariants: "PASS",
  };
}
check((summary["Hunden spiser fisken i dag"] as { candidate_nodes: number }).candidate_nodes === 2,
  "source_expression_candidate_missing");
check((summary["Fisken spiser hunden"] as { candidate_nodes: number }).candidate_nodes === 1,
  "svo_ovs_core_candidate_missing");
const longTailInput = fixture.cases.find((input: { text: string }) =>
  input.text === "Hunden spiser fisken i dag");
check(longTailInput, "long_tail_fixture_missing");
const longTailSurface = buildCanonicalSurfaceDocumentV1(longTailInput.text);
const unsafeLegacyPatch = clausePatchFromLegacyV11(
  { language_graph: { clause_build_v1: {
    clause_hypotheses: [{ ...longTailInput.prefix_clauses[0], status: "candidate" }],
  } } },
  {
    surface: longTailSurface,
    sentenceIndex: 0,
    sqlMap: buildSqlStructuralCompatibilityMapV1(longTailSurface, 0),
    diagnostics: [],
  },
);
check((unsafeLegacyPatch.edges ?? []).some((edge) =>
  edge.relation === "subject_of" && edge.status === "candidate"),
  "legacy_clause_adapter_subject_edge_not_observed");
console.log(JSON.stringify({ status: "PASS", checks, production_mutation: false, deployed: false, results: summary }, null, 2));

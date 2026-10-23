import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
  type LanguageGraphEdgeV1,
  type LanguageGraphEvidenceV1,
  type LanguageGraphProvenanceV1,
} from "../../supabase/functions/_shared/nlp/canonical-language-graph-core-v1.ts";
import { buildCanonicalSurfaceDocumentV1 } from "../../supabase/functions/_shared/nlp/canonical-surface-boundary-v1.ts";
import { compilePronounParadigmV1, recognizePronounFormV1 } from "./pronoun-paradigm-contract-v1.mjs";

const fixture = JSON.parse(await Deno.readTextFile(new URL("../artifacts/R084-pronoun-paradigm-source-fixture.json", import.meta.url)));
const paradigm = compilePronounParadigmV1(fixture);
const producer = "r085_test_only_pronoun_paradigm_projection";
let checks = 0;
function check(ok: unknown, message: string): asserts ok {
  checks++;
  if (!ok) throw new Error(message);
}

function candidatePatch(surface: ReturnType<typeof buildCanonicalSurfaceDocumentV1>): GraphPatchV1 {
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const evidence: LanguageGraphEvidenceV1[] = [];
  const provenance: LanguageGraphProvenanceV1[] = [{
    id: `prov:source_rule:${fixture.candidate_id}`,
    sourceType: "source_rule",
    sourceId: fixture.candidate_id,
    payload: { sourceSection: fixture.source_section, candidateCode: fixture.candidate_code, testOnly: true },
  }];
  for (const token of surface.tokens) {
    if (token.kind !== "word") continue;
    const readings = recognizePronounFormV1(paradigm, token.surface);
    for (const reading of readings) {
      const lexicalId = `lexical:pronoun:${token.id}:${reading.lemma}`;
      const morphId = `morph:pronoun:${token.id}:${reading.lemma}:${reading.case}`;
      const lexicalEvidenceId = `evidence:${lexicalId}`;
      const morphEvidenceId = `evidence:${morphId}`;
      const provenanceIds = [provenance[0].id];
      const span = { startTokenId: token.id, endTokenId: token.id, tokenIds: [token.id], startUtf16: token.startUtf16, endUtf16: token.endUtf16 };
      if (!nodes.some((node) => node.id === lexicalId)) {
        nodes.push({
          id: lexicalId, type: "lexical_reading", subtype: "pronoun", status: "candidate", span,
          features: { lemma: reading.lemma, pos: "pronoun", exhaustive: false, testOnly: true },
          producer, evidenceIds: [lexicalEvidenceId], provenanceIds,
        });
        edges.push({
          id: `edge:lexical_reading_of:${lexicalId}:${token.id}`, relation: "lexical_reading_of",
          sourceId: lexicalId, targetId: token.id, status: "candidate", features: {}, producer,
          evidenceIds: [lexicalEvidenceId], provenanceIds,
        });
        evidence.push({
          id: lexicalEvidenceId, kind: "source_rule", status: "supports", targetIds: [lexicalId, token.id],
          payload: { claim: "possible_pronoun_lemma", candidateOnly: true, exhaustive: false }, producer, provenanceIds,
        });
      }
      nodes.push({
        id: morphId, type: "morph_reading", subtype: "pronoun", status: "candidate", span,
        features: { lemma: reading.lemma, pos: "pronoun", canonicalFeatures: { Case: reading.case }, exhaustive: false, testOnly: true },
        producer, evidenceIds: [morphEvidenceId], provenanceIds,
      });
      edges.push({
        id: `edge:morph_reading_of:${morphId}:${lexicalId}`, relation: "morph_reading_of",
        sourceId: morphId, targetId: lexicalId, status: "candidate", features: { Case: reading.case }, producer,
        evidenceIds: [morphEvidenceId], provenanceIds,
      });
      evidence.push({
        id: morphEvidenceId, kind: "source_rule", status: "supports", targetIds: [morphId, lexicalId, token.id],
        payload: { claim: "possible_pronoun_case", Case: reading.case, candidateOnly: true, exhaustive: false },
        producer, provenanceIds,
      });
    }
  }
  return { producer, producerVersion: "test-only-1", nodes, edges, evidence, provenance };
}

const cases = [
  { text: "Meg ser han", expected: [["Meg", "jeg", "Acc"], ["han", "han", "Nom"]] },
  { text: "Jeg ser meg", expected: [["Jeg", "jeg", "Nom"], ["meg", "jeg", "Acc"]] },
  { text: "Den ser det", expected: [["Den", "den", "Nom"], ["Den", "den", "Acc"], ["det", "det", "Nom"], ["det", "det", "Acc"]] },
];
for (const item of cases) {
  const surface = buildCanonicalSurfaceDocumentV1(item.text);
  const initial = createCanonicalLanguageGraphV1(surface);
  const patched = applyGraphPatchV1(initial, candidatePatch(surface));
  const repeated = applyGraphPatchV1(patched, candidatePatch(surface));
  check(assertCanonicalLanguageGraphV1(patched).length === 0, `graph_invalid:${item.text}`);
  check(repeated.nodes.length === patched.nodes.length && repeated.edges.length === patched.edges.length, `not_idempotent:${item.text}`);
  check(patched.nodes.filter((node) => node.type === "token").map((node) => node.id).join("|") === initial.nodes.filter((node) => node.type === "token").map((node) => node.id).join("|"), `token_identity_changed:${item.text}`);
  check(patched.nodes.every((node) => node.type !== "morph_reading" || node.status === "candidate"), `morphology_resolved_early:${item.text}`);
  check(patched.nodes.every((node) => node.type !== "morph_reading" || node.features.exhaustive === false), `closed_world_case_claim:${item.text}`);
  check(patched.edges.every((edge) => !["subject_of", "obj"].includes(edge.relation)), `grammar_edge_early:${item.text}`);
  for (const [form, lemma, grammaticalCase] of item.expected) {
    check(patched.nodes.some((node) => node.type === "morph_reading" &&
      node.features.lemma === lemma && (node.features.canonicalFeatures as { Case?: string })?.Case === grammaticalCase &&
      surface.tokens.some((token) => token.surface === form && node.span?.tokenIds?.includes(token.id))), `reading_missing:${item.text}:${form}:${grammaticalCase}`);
  }
}
console.log(JSON.stringify({ status: "PASS", cases: cases.length, checks, sourceCandidateId: fixture.candidate_id, scope: "test-only candidate patch, no grammar edges" }));

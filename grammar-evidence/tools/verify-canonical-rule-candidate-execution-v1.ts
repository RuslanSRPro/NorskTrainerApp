import {
  executeCanonicalRuleCandidatesV1,
} from "../../supabase/functions/_shared/nlp/canonical-rule-candidate-execution-v1.ts";
import { applyGraphPatchV1, type CanonicalLanguageGraphV1 } from
  "../../supabase/functions/_shared/nlp/canonical-language-graph-core-v1.ts";
import type { SentenceSourceTokenV1 } from
  "../../supabase/functions/_shared/nlp/adjective-sentence-context-producer-v1.ts";

let checks = 0;
function check(ok: boolean, label: string) { checks++; if (!ok) throw new Error(label); }
const adjectiveId = "81a6cba3-26d1-4bf1-9cb3-41997911dd50";
const adjectiveCandidateId = `surface:${adjectiveId}:adjective`;
const snapshotId = "965f0a1a-9f22-446a-b36c-f573c9a002d8";
const bookIds = ["ec9da2b9-22d4-4292-81e3-05b26f4aa852",
  "ff26110c-7180-4ef4-92e9-372355e40a90"];
const tokens: SentenceSourceTokenV1[] = [
  { canonical_token_id: "t1", token_index: 1, surface: "En" },
  { canonical_token_id: "t2", token_index: 2, surface: "åpen",
    surface_resolution: { candidates: [{ candidate_id: adjectiveCandidateId,
      lexeme_id: adjectiveId, source_pos: "adjective" }] } },
  { canonical_token_id: "t3", token_index: 3, surface: "bok",
    surface_resolution: { candidates: bookIds.map((id) =>
      ({ candidate_id: `surface:${id}:noun`, lexeme_id: id, source_pos: "noun" })) } },
];
const graph = {
  version: "canonical-language-graph-v1", documentId: "doc",
  surfaceVersion: "canonical-surface-boundary-v1",
  nodes: [
    ...tokens.map((token) => ({ id: token.canonical_token_id, type: "token",
      status: "resolved", features: { surface: token.surface }, producer: "surface",
      evidenceIds: [], provenanceIds: [] })),
    { id: "lex:apen", type: "lexical_reading", status: "candidate",
      span: { tokenIds: ["t2"] },
      features: { lexemeId: adjectiveId, sourcePos: "adjective" },
      producer: "canonical_candidate_lattice_v1", evidenceIds: [], provenanceIds: [] },
    ...bookIds.map((id) => ({ id: `lex:${id}`, type: "lexical_reading",
      status: "candidate", span: { tokenIds: ["t3"] },
      features: { lexemeId: id, sourcePos: "noun" },
      producer: "canonical_candidate_lattice_v1", evidenceIds: [], provenanceIds: [] })),
  ], edges: [], evidence: [], provenance: [], alternativeSets: [], constraintTrace: [],
  producerState: {}, invariants: {
    oneCanonicalGraph: true, stableSurfaceTokenIds: true,
    appendEvidenceDoNotReparseText: true, candidatesMayCoexist: true,
    resolvedFactsRequireEvidence: true, learnerErrorSeparateFromParserUncertainty: true,
  },
} as CanonicalLanguageGraphV1;
const finding = { tokenId: "t2", candidateId: adjectiveCandidateId,
  lexemeId: adjectiveId, sourcePos: "adjective", status: "context_supported" as const,
  reason: "article_adjective_noun_frame_compatible", inputTokenIds: ["t1", "t2", "t3"],
  evidenceRefs: ["source:article"], competingCandidateIds: [] };
const positiveRule = { ok: true, status: "candidate", lexemeId: adjectiveId,
  positiveForm: "åpen", candidate: "åpnere",
  positiveSnapshotId: snapshotId, articleId: 1033,
  manifestCode: "shadow.adjective.degree.apen.en_deletion.v1",
  ruleCode: "nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative",
  sourceCandidateId: "8cd6ed7e-c27d-4283-bcf1-58af141f387c",
  activationAuthority: false, graphMutation: false };

let calls = 0;
const positive = await executeCanonicalRuleCandidatesV1({ graph, tokens,
  sentenceFindings: [finding], callAdjectiveRule: async (id) => {
    calls++; check(id === adjectiveId, "operator called for exact lexeme");
    return positiveRule;
  } });
check(calls === 1, "one private rule call");
check(positive.familiesEvaluated.length === 1 && positive.results.length === 1,
  "adjective family selected");
check(positive.results[0].status === "candidate" &&
  positive.results[0].derivedForm === "åpnere" &&
  positive.results[0].sourceCandidateId === adjectiveCandidateId,
  "rule derivation bound to source candidate");
check(positive.patch.evidence?.length === 1 &&
  positive.patch.evidence[0].status === "neutral" &&
  positive.patch.evidence[0].targetIds.includes("lex:apen"),
  "candidate-only graph evidence");
const after = applyGraphPatchV1(graph, positive.patch);
check(after.nodes.length === graph.nodes.length &&
  bookIds.every((id) => after.nodes.some((node) => node.id === `lex:${id}`)),
  "both book readings retained");
check(after.nodes.find((node) => node.id === "lex:apen")?.status === "candidate" &&
  positive.results[0].activationAuthority === false &&
  positive.results[0].persistenceAuthority === false,
  "no reading selection, activation or persistence");

const wrongCandidate = await executeCanonicalRuleCandidatesV1({ graph, tokens,
  sentenceFindings: [{ ...finding, candidateId: "surface:wrong:adjective" }],
  callAdjectiveRule: async () => { throw Error("must not call"); } });
check(wrongCandidate.results[0].status === "withheld" &&
  wrongCandidate.patch.evidence?.length === 0, "wrong candidate withheld before call");
const wrongSnapshot = await executeCanonicalRuleCandidatesV1({ graph, tokens,
  sentenceFindings: [finding], callAdjectiveRule: async () =>
    ({ ...positiveRule, positiveSnapshotId: "wrong" }) });
check(wrongSnapshot.results[0].status === "withheld" &&
  wrongSnapshot.patch.evidence?.length === 0, "wrong snapshot withheld");
const ambiguous = await executeCanonicalRuleCandidatesV1({ graph, tokens,
  sentenceFindings: [{ ...finding, status: "ambiguous" }],
  callAdjectiveRule: async () => { throw Error("must not call"); } });
check(ambiguous.results.length === 0 && ambiguous.patch.evidence?.length === 0,
  "ambiguous context cannot invoke adjective rule");

const pronounTokens: SentenceSourceTokenV1[] = [
  { canonical_token_id: "p1", token_index: 1, surface: "Jeg" },
  { canonical_token_id: "p2", token_index: 2, surface: "ser" },
  { canonical_token_id: "p3", token_index: 3, surface: "meg" },
];
const pronounGraph = { ...graph, nodes: [...graph.nodes, ...pronounTokens.map((token) => ({
  id: token.canonical_token_id, type: "token", status: "resolved",
  features: { surface: token.surface }, producer: "surface",
  evidenceIds: [], provenanceIds: [],
}))] } as CanonicalLanguageGraphV1;
const pronoun = await executeCanonicalRuleCandidatesV1({ graph: pronounGraph, tokens: pronounTokens,
  sentenceFindings: [], callAdjectiveRule: async () => { throw Error("must not call"); } });
check(pronoun.results.length === 2 && pronoun.patch.evidence?.length === 2,
  "one shared route emits both pronoun case candidates");
check(pronoun.results[0].readings?.[0].Case === "Nom" &&
  pronoun.results[1].readings?.[0].Case === "Acc", "pronoun forms recognized");
check(pronoun.patch.evidence?.every((item) => item.status === "neutral" &&
  item.payload.candidateOnly === true && item.payload.verifiedCard === false) === true,
  "pronoun evidence is nonauthoritative");
check(pronoun.results.every((item) => item.caseContext?.roleStatus === "deferred" &&
  item.caseContext.subjectOrObjectAuthority === false),
  "case forms do not resolve syntactic roles");
for (const [surfaces, expectedReason] of [
  [["Han", "og", "meg", "gikk"], "coordination_exception_scope"],
  [["Han", "eller", "meg", "ser"], "coordination_exception_scope"],
  [["hun", "enn", "meg"], "comparison_exception_scope"],
  [["uten", "meg"], "preposition_exception_scope"],
] as const) {
  const scopedTokens: SentenceSourceTokenV1[] = surfaces.map((surface, index) => ({
    canonical_token_id: `scope:${index + 1}`, token_index: index + 1, surface,
  }));
  const scopedGraph = { ...graph, nodes: [...graph.nodes, ...scopedTokens.map((token) => ({
    id: token.canonical_token_id, type: "token", status: "resolved",
    features: { surface: token.surface }, producer: "surface",
    evidenceIds: [], provenanceIds: [],
  }))] } as CanonicalLanguageGraphV1;
  const scoped = await executeCanonicalRuleCandidatesV1({ graph: scopedGraph,
    tokens: scopedTokens, sentenceFindings: [],
    callAdjectiveRule: async () => { throw Error("must not call"); } });
  check(scoped.results.some((item) => item.caseContext?.reason === expectedReason &&
    item.caseContext.subjectOrObjectAuthority === false),
    `${expectedReason} defers role selection`);
  check(scoped.patch.evidence?.every((item) => item.status === "neutral") === true,
    `${expectedReason} remains neutral graph evidence`);
}
const denGraph = { ...graph, nodes: [...graph.nodes, { id: "d1", type: "token",
  status: "resolved", features: { surface: "Den" }, producer: "surface",
  evidenceIds: [], provenanceIds: [] }] } as CanonicalLanguageGraphV1;
const den = await executeCanonicalRuleCandidatesV1({ graph: denGraph,
  tokens: [{ canonical_token_id: "d1", token_index: 1, surface: "Den" }],
  sentenceFindings: [], callAdjectiveRule: async () => { throw Error("must not call"); } });
check(den.results.length === 1 && den.results[0].readings?.length === 2 &&
  den.results[0].readings?.some((item) => item.Case === "Nom") &&
  den.results[0].readings?.some((item) => item.Case === "Acc"),
"ambiguous den case forms preserved");


const penId = "2504e6fd-2466-4fbb-8894-e5e1885a61fd";
const penCandidateId = `surface:${penId}:adjective`;
const penTokens: SentenceSourceTokenV1[] = [
  { canonical_token_id: "pen:1", token_index: 1, surface: "En" },
  { canonical_token_id: "pen:2", token_index: 2, surface: "pen",
    surface_resolution: { candidates: [{ candidate_id: penCandidateId,
      lexeme_id: penId, source_pos: "adjective" }] } },
  { canonical_token_id: "pen:3", token_index: 3, surface: "bok" },
];
const penGraph = { ...graph, nodes: [
  ...penTokens.map((token) => ({ id: token.canonical_token_id,
    type: "token", status: "resolved", features: { surface: token.surface },
    producer: "surface", evidenceIds: [], provenanceIds: [] })),
  { id: "lex:pen", type: "lexical_reading", status: "candidate",
    span: { tokenIds: ["pen:2"] },
    features: { lexemeId: penId, lemma: "pen", sourcePos: "adjective" },
    producer: "canonical_candidate_lattice_v1",
    evidenceIds: [], provenanceIds: [] },
] } as CanonicalLanguageGraphV1;
const penFinding = { ...finding, tokenId: "pen:2", candidateId: penCandidateId,
  lexemeId: penId, inputTokenIds: ["pen:1", "pen:2", "pen:3"] };
const positivePenRow = {
  lexeme_id: penId, snapshot_id: "bc1a34c6-e31a-4a9a-83b8-3ca7bc53b560",
  dictionary_code: "bm", article_id: 44555, pos: "adjective", lemma: "pen",
  form_key: "positive_singular_indefinite_common", primary_values: ["pen"],
  article_ids: ["44555"], evidence_ids: ["ordbokene:official-form"],
};
let penReads = 0;
const pen = await executeCanonicalRuleCandidatesV1({ graph: penGraph,
  tokens: penTokens, sentenceFindings: [penFinding],
  callAdjectiveRule: async () => { throw Error("wrong operator"); },
  loadPositiveAdjectiveRow: async (id) => { penReads++;
    check(id === penId, "pen positive row loaded for exact lexeme");
    return [positivePenRow]; } });
check(penReads === 1 && pen.results.length === 1 &&
  pen.results[0].status === "candidate" &&
  pen.results[0].derivedForm === "penere", "regular pen rule derives from positive");
check(pen.patch.evidence?.length === 1 && pen.patch.evidence[0].status === "neutral" &&
  pen.patch.evidence[0].targetIds.includes("lex:pen"),
  "pen derivation stays candidate-scoped");
const wrongPenSnapshot = await executeCanonicalRuleCandidatesV1({ graph: penGraph,
  tokens: penTokens, sentenceFindings: [penFinding],
  callAdjectiveRule: async () => { throw Error("wrong operator"); },
  loadPositiveAdjectiveRow: async () => [{ ...positivePenRow, snapshot_id: "wrong" }] });
check(wrongPenSnapshot.results[0].status === "withheld" &&
  wrongPenSnapshot.patch.evidence?.length === 0, "wrong pen snapshot withheld");
const ambiguousPen = await executeCanonicalRuleCandidatesV1({ graph: penGraph,
  tokens: penTokens, sentenceFindings: [{ ...penFinding, status: "ambiguous" }],
  callAdjectiveRule: async () => { throw Error("wrong operator"); },
  loadPositiveAdjectiveRow: async () => { throw Error("must not read source"); } });
check(ambiguousPen.results.length === 0 && ambiguousPen.patch.evidence?.length === 0,
  "ambiguous pen context cannot execute rule");

console.log(`CANONICAL_RULE_CANDIDATE_EXECUTION=PASS checks=${checks}`);

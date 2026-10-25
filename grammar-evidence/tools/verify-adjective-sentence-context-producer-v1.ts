import { produceAdjectiveSentenceContextV1, type SentenceSourceTokenV1 } from
  "../../supabase/functions/_shared/nlp/adjective-sentence-context-producer-v1.ts";
import { produceCanonicalSentenceEvidenceV1 } from
  "../../supabase/functions/_shared/nlp/canonical-sentence-evidence-producer-v1.ts";
import { adjectiveSentenceEvidenceFamilyV1 } from
  "../../supabase/functions/_shared/nlp/adjective-sentence-evidence-family-v1.ts";
import { buildCanonicalConstraintPropagationPatchV1 } from
  "../../supabase/functions/_shared/nlp/canonical-constraint-propagation-v1.ts";
import type { CanonicalLanguageGraphV1 } from
  "../../supabase/functions/_shared/nlp/canonical-language-graph-core-v1.ts";

let checks = 0;
function check(ok: boolean, label: string) { checks++; if (!ok) throw new Error(label); }
const adj = { candidate_id: "surface:81a6cba3-26d1-4bf1-9cb3-41997911dd50:adjective",
  lexeme_id: "81a6cba3-26d1-4bf1-9cb3-41997911dd50", source_pos: "adjective" };
const noun = (id: string, snapshot: string, articles: string[]) => ({
  candidate_id: `surface:${id}:noun`, lexeme_id: id, source_pos: "noun",
  evidence: [{ source: "lexeme_form_display_v2", form_type: "noun_singular_indefinite",
    grammatical_features: { accepted_articles: articles, snapshot_id: snapshot } }],
});
const article = (prefix: string): SentenceSourceTokenV1 => ({ canonical_token_id: `${prefix}:t1`, token_index: 1,
  surface: "En", lexical_classes: [{ class_code: "indefinite_article", membership_source: "nrg_1997_3.4.2.1" }] });
const adjective = (prefix: string): SentenceSourceTokenV1 => ({ canonical_token_id: `${prefix}:t2`, token_index: 2,
  surface: "åpen", surface_resolution: { candidates: [adj] } });
const bok: SentenceSourceTokenV1 = { canonical_token_id: "book:t3", token_index: 3, surface: "bok",
  surface_resolution: { candidates: [
    noun("ec9da2b9-22d4-4292-81e3-05b26f4aa852", "1b2c41d0-e785-4fa2-86c2-c38c2a38cd36", ["en", "ei"]),
    noun("ff26110c-7180-4ef4-92e9-372355e40a90", "fbe08c8a-88fe-4ce4-8e30-fbf85e15d62f", ["en", "ei"]),
  ] } };

const positive = produceAdjectiveSentenceContextV1([article("book"), adjective("book"), bok]);
check(positive.length === 1 && positive[0].status === "context_supported", "article-adjective-noun context");
check(positive[0].candidateId === adj.candidate_id && positive[0].canonicalTokenId === "book:t2", "exact target binding");
check(positive[0].headCandidateIds.length === 2 && positive[0].headCandidateIds.includes(bok.surface_resolution!.candidates![1].candidate_id), "both bok homographs preserved");
check(positive[0].posAuthority === false && positive[0].ruleActivationAuthority === false, "context has no POS or activation authority");
check(positive[0].evidenceRefs.length === 3, "article class and both noun sources retained");

const door: SentenceSourceTokenV1 = { canonical_token_id: "door:t3", token_index: 3, surface: "dør",
  surface_resolution: { candidates: [
    { candidate_id: "surface:259c4d57-9743-40b4-af15-e7a3382a58a6:verb",
      lexeme_id: "259c4d57-9743-40b4-af15-e7a3382a58a6", source_pos: "verb" },
    noun("98a11d14-52c7-45b7-9321-04cb1a598192", "8bed60ba-40aa-44c2-b499-c57dcc3cb4bc", ["en", "ei"]),
  ] } };
const ambiguousHead = produceAdjectiveSentenceContextV1([article("door"), adjective("door"), door]);
check(ambiguousHead[0].status === "ambiguous" && ambiguousHead[0].reason === "head_pos_competes_or_missing", "dør noun/verb abstention");
check(ambiguousHead[0].headCandidateIds.length === 2, "dør alternatives preserved");

const targetCompeting = adjective("book");
targetCompeting.surface_resolution!.candidates!.push({ candidate_id: "other:noun", lexeme_id: "other", source_pos: "noun" });
const ambiguousTarget = produceAdjectiveSentenceContextV1([article("book"), targetCompeting, bok]);
check(ambiguousTarget[0].status === "ambiguous" && ambiguousTarget[0].competingCandidateIds.includes("other:noun"), "target POS alternative abstention");

const isolated = produceAdjectiveSentenceContextV1([{ canonical_token_id: "single:t1", token_index: 1,
  surface: "åpen", surface_resolution: { candidates: [adj] } }]);
check(isolated[0].status === "insufficient_context", "isolated adjective is not sentence proof");
const predicative = produceAdjectiveSentenceContextV1([
  { canonical_token_id: "pred:t1", token_index: 1, surface: "Han" },
  { canonical_token_id: "pred:t2", token_index: 2, surface: "er" },
  { canonical_token_id: "pred:t3", token_index: 3, surface: "åpen", surface_resolution: { candidates: [adj] } },
], [{ relation: "copula_links_predicative", source_token_id: "pred:t2", target_token_id: "pred:t3" }]);
check(predicative[0].status === "ambiguous" && predicative[0].reason === "copular_predicative_allows_noun_or_adjective", "copula does not prove adjective POS");

const noClass = article("book"); noClass.lexical_classes = [];
check(produceAdjectiveSentenceContextV1([noClass, adjective("book"), bok])[0].status === "insufficient_context", "article class required");
const noArticleEvidence = structuredClone(bok);
noArticleEvidence.surface_resolution!.candidates![0].evidence = [];
check(produceAdjectiveSentenceContextV1([article("book"), adjective("book"), noArticleEvidence])[0].status === "ambiguous", "all noun articles must be supported");
const duplicateIdentity = adjective("book"); duplicateIdentity.canonical_token_id = "book:t1";
check(produceAdjectiveSentenceContextV1([article("book"), duplicateIdentity, bok])[0].status === "withheld", "duplicate canonical ID denied");

const graph = {
  version: "canonical-language-graph-v1", documentId: "doc", surfaceVersion: "canonical-surface-boundary-v1",
  nodes: [{ id: "lex:apen", type: "lexical_reading", status: "candidate",
    span: { tokenIds: ["book:t2"] }, features: { lexemeId: adj.lexeme_id, sourcePos: "adjective" },
    producer: "canonical_candidate_lattice_v1", evidenceIds: [], provenanceIds: [] }],
  edges: [], evidence: [], provenance: [], alternativeSets: [], constraintTrace: [], producerState: {},
  invariants: { oneCanonicalGraph: true, stableSurfaceTokenIds: true, appendEvidenceDoNotReparseText: true,
    candidatesMayCoexist: true, resolvedFactsRequireEvidence: true, learnerErrorSeparateFromParserUncertainty: true },
} as CanonicalLanguageGraphV1;
const produced = produceCanonicalSentenceEvidenceV1([article("book"), adjective("book"), bok], [],
  [adjectiveSentenceEvidenceFamilyV1]);
check(produced.findings.length === 1 && produced.findings[0].status === "context_supported", "family adapter registers finding");
const evaluations = produced.evaluator({ graph, iteration: 0,
  availableCapabilities: new Set(["canonical_candidate_lattice_v1"]) });
check(evaluations.length === 1 && evaluations[0].affectedIds[0] === "lex:apen" &&
  evaluations[0].outcome === "support" && evaluations[0].strength === "supporting", "generic producer targets canonical reading");
const propagated = buildCanonicalConstraintPropagationPatchV1(graph, produced.evaluator,
  { availableCapabilities: ["canonical_candidate_lattice_v1"] });
check(propagated.summary.support === 1 && propagated.summary.resolve === 0, "support never resolves candidate");
const noPromotion = produceCanonicalSentenceEvidenceV1([article("door"), adjective("door"), door], [],
  [adjectiveSentenceEvidenceFamilyV1]);
check(noPromotion.evaluator({ graph, iteration: 0,
  availableCapabilities: new Set(["canonical_candidate_lattice_v1"]) }).length === 0,
  "ambiguous family finding cannot propagate as proof");
const secondFamily = { code: "shadow.sentence.other.v1", trigger: { relations: ["other_relation"] },
  produce: () => { throw Error("unrelated family should be skipped"); } };
const composed = produceCanonicalSentenceEvidenceV1([article("book"), adjective("book"), bok], [],
  [secondFamily, adjectiveSentenceEvidenceFamilyV1]);
check(composed.findings.length === 1 && composed.familiesEvaluated.length === 1 &&
  composed.familiesSkipped.includes(secondFamily.code), "unrelated family skipped by trigger");
const nounOnly = produceCanonicalSentenceEvidenceV1([{ canonical_token_id: "noun:t1", token_index: 1,
  surface: "bok", surface_resolution: { candidates: bok.surface_resolution!.candidates } }], [],
  [adjectiveSentenceEvidenceFamilyV1]);
check(nounOnly.findings.length === 0 && nounOnly.familiesSkipped.length === 1,
  "adjective family skipped when no adjective candidate exists");
console.log(`ADJECTIVE_SENTENCE_CONTEXT_PRODUCER=PASS checks=${checks}`);

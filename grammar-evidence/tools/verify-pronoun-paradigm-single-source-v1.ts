// R133: one pronoun paradigm (release table), one subject decision (SQL).
// Checks that the TS operator reads pairs from release rows, falls back to the
// embedded manifest only when a release has no rows, rejects malformed rows,
// and carries the SQL subject decision as preferred/soft evidence only.
import {
  embeddedPronounParadigmSourceV1, pronounParadigmManifestV1,
  pronounParadigmSourceFromRowsV1, producePronounCaseCandidatesV1,
} from "../../supabase/functions/_shared/nlp/pronoun-paradigm-operator-v1.ts";
import {
  executeCanonicalRuleCandidatesV1, pronounCaseCandidateFamilyV1,
  sqlPronounSubjectAuthorityFromAnalysisV1,
} from "../../supabase/functions/_shared/nlp/canonical-rule-candidate-execution-v1.ts";
import type { CanonicalLanguageGraphV1 } from
  "../../supabase/functions/_shared/nlp/canonical-language-graph-core-v1.ts";
import type { SentenceSourceTokenV1 } from
  "../../supabase/functions/_shared/nlp/adjective-sentence-context-producer-v1.ts";

let checks = 0;
function check(ok: boolean, label: string) { checks++; if (!ok) throw new Error(label); }
function throws(fn: () => unknown, message: string) {
  try { fn(); } catch (error) { return (error as Error).message === message; }
  return false;
}
const SOURCE = "d99c8781-1212-45ed-a490-df7cfa105ede";
const RELEASE = "runtime-structural-v1.38";
// Mirrors grammar_runtime_release_pronoun_paradigm_v1 rows of v1.38
// (lemma, nominative, accusative, candidate_id); the SQL draft gate checks the live table.
const v138Rows = [["de","dem"],["den","den"],["dere","dere"],["det","det"],["du","deg"],
  ["han","ham"],["hun","henne"],["jeg","meg"],["vi","oss"]]
  .map(([nominative, accusative]) => ({ lemma: nominative, nominative, accusative, source_candidate_id: SOURCE }));

// 1. Parity: release rows and embedded manifest are the same paradigm.
const fromTable = pronounParadigmSourceFromRowsV1(v138Rows, RELEASE);
check(fromTable.origin === "release_table" && fromTable.releaseCode === RELEASE, "table origin");
check(fromTable.sourceCandidateId === pronounParadigmManifestV1.sourceCandidateId, "same source candidate");
const key = (pairs: readonly (readonly [string, string])[]) => pairs.map((p) => p.join(">")).sort().join("|");
check(key(fromTable.pairs) === key(embeddedPronounParadigmSourceV1.pairs), "pair parity table vs embedded");

// 2. Empty release (v1.37) falls back to embedded, origin is visible.
for (const empty of [[], null, undefined]) {
  const s = pronounParadigmSourceFromRowsV1(empty, "runtime-structural-v1.37");
  check(s.origin === "embedded_manifest" && s.releaseCode === "runtime-structural-v1.37", "empty -> embedded");
}

// 3. Malformed rows are rejected, never silently merged.
check(throws(() => pronounParadigmSourceFromRowsV1([{ nominative: "jeg", accusative: "", source_candidate_id: SOURCE }], RELEASE),
  "pronoun_paradigm_rows_invalid"), "missing accusative rejected");
check(throws(() => pronounParadigmSourceFromRowsV1([...v138Rows, v138Rows[0]], RELEASE),
  "pronoun_paradigm_rows_duplicate"), "duplicate rejected");
check(throws(() => pronounParadigmSourceFromRowsV1([...v138Rows.slice(1), { ...v138Rows[0], source_candidate_id: "x" }], RELEASE),
  "pronoun_paradigm_rows_mixed_sources"), "mixed sources rejected");

// 4. Identical candidates from either source for every surface.
for (const surface of ["Jeg","meg","du","deg","han","ham","hun","henne","den","det","vi","oss","dere","de","dem","bok"]) {
  check(JSON.stringify(producePronounCaseCandidatesV1(surface, fromTable)) ===
    JSON.stringify(producePronounCaseCandidatesV1(surface)), `candidates parity ${surface}`);
}
// A table that differs from the manifest is what the operator uses (single source).
const reduced = pronounParadigmSourceFromRowsV1(v138Rows.filter((r) => r.nominative !== "hun"), RELEASE);
check(producePronounCaseCandidatesV1("henne", reduced).length === 0, "table is authoritative");

// 5. SQL subject decision -> preferred/soft evidence, only on the SQL subject token.
const tokens: SentenceSourceTokenV1[] = [
  { canonical_token_id: "t1", token_index: 1, surface: "Meg" },
  { canonical_token_id: "t2", token_index: 2, surface: "ser" },
  { canonical_token_id: "t3", token_index: 3, surface: "han" },
];
const graph = {
  version: "canonical-language-graph-v1", documentId: "doc", surfaceVersion: "canonical-surface-boundary-v1",
  nodes: tokens.map((token) => ({ id: token.canonical_token_id, type: "token", status: "resolved",
    features: { surface: token.surface }, producer: "surface", evidenceIds: [], provenanceIds: [] })),
  edges: [], evidence: [], provenance: [], alternativeSets: [], constraintTrace: [], producerState: {},
  invariants: { oneCanonicalGraph: true, stableSurfaceTokenIds: true, appendEvidenceDoNotReparseText: true,
    candidatesMayCoexist: true, resolvedFactsRequireEvidence: true, learnerErrorSeparateFromParserUncertainty: true },
} as CanonicalLanguageGraphV1;
const sqlAnalysis = { language_graph: { pronoun_subject_authority_v1: {
  version: "pronoun-subject-authority-v1", release_code: RELEASE, status: "applied",
  pattern: "acc_finite_nom", subject_token_index: 3, finite_token_index: 2 } } };
const authority = sqlPronounSubjectAuthorityFromAnalysisV1(sqlAnalysis);
check(authority?.status === "applied" && authority.subjectTokenIndex === 3, "authority read from SQL plane");
check(sqlPronounSubjectAuthorityFromAnalysisV1({ language_graph: {} }) === null, "absent plane -> null");

const run = await executeCanonicalRuleCandidatesV1({ graph, tokens, sentenceFindings: [],
  callAdjectiveRule: async () => { throw new Error("unexpected"); },
  pronounParadigm: fromTable, sqlPronounSubjectAuthority: authority }, [pronounCaseCandidateFamilyV1]);
const meg = run.results.find((r) => r.tokenId === "t1");
const han = run.results.find((r) => r.tokenId === "t3");
check(run.results.length === 2 && !!meg && !!han, "two pronoun results");
check(han?.roleEvidence?.recommendation === "preferred" && han.roleEvidence.strength === "soft" &&
  han.roleEvidence.role === "subject" && han.roleEvidence.releaseCode === RELEASE, "subject evidence on han");
check(meg?.roleEvidence === undefined, "no role evidence on meg");
check(run.results.every((r) => r.paradigmOrigin === "release_table"), "origin carried");
check(run.results.every((r) => r.caseContext?.subjectOrObjectAuthority === false), "guard decides nothing");
check(run.results.every((r) => r.activationAuthority === false && r.persistenceAuthority === false), "no authority");
const evidence = run.patch.evidence ?? [];
check(evidence.length === 2 && evidence.every((e) => e.status === "neutral" &&
  (e.payload as Record<string, unknown>).selectedPos === null), "graph evidence stays neutral");
check(JSON.stringify(run).indexOf('"chosen"') === -1, "never chosen");

// 6. Not applied in SQL -> no role evidence at all.
const notApplied = await executeCanonicalRuleCandidatesV1({ graph, tokens, sentenceFindings: [],
  callAdjectiveRule: async () => { throw new Error("unexpected"); },
  pronounParadigm: fromTable, sqlPronounSubjectAuthority: { ...authority!, status: "not_applied" } },
  [pronounCaseCandidateFamilyV1]);
check(notApplied.results.every((r) => r.roleEvidence === undefined), "not_applied -> no evidence");
// 7. Default context (no paradigm, no authority) = previous behaviour.
const legacy = await executeCanonicalRuleCandidatesV1({ graph, tokens, sentenceFindings: [],
  callAdjectiveRule: async () => { throw new Error("unexpected"); } }, [pronounCaseCandidateFamilyV1]);
check(legacy.results.every((r) => r.paradigmOrigin === "embedded_manifest" && r.roleEvidence === undefined), "default unchanged");

console.log(`verify-pronoun-paradigm-single-source-v1: PASS (${checks} checks)`);

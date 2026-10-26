// Compiled from source candidate d99c8781-1212-45ed-a490-df7cfa105ede (section 4.1.1).
// Readings are possible, not exhaustive: Bokmål also permits objective `han`.
export const pronounParadigmManifestV1 = {
  code: "ir.pronoun.personal.forms.bokmal.paradigm",
  operator: "morphological_paradigm",
  sourceCandidateId: "d99c8781-1212-45ed-a490-df7cfa105ede",
  sourceSection: "4.1.1",
  language: "nb",
  phase: "pre_structure_morphology_candidates",
  capabilities: ["recognize", "generate", "explain"],
  status: "candidate_only",
  exhaustive: false,
  pairs: [
    ["jeg", "meg"], ["du", "deg"], ["han", "ham"],
    ["hun", "henne"], ["den", "den"], ["det", "det"],
    ["vi", "oss"], ["dere", "dere"], ["de", "dem"],
  ],
} as const;

export const pronounCaseSelectionManifestV1 = {
  code: "ir.pronoun.personal.case.subject_vs_complement",
  operator: "case_selection",
  sourceCandidateId: "f7c256e7-efe7-4687-aadc-26ee831a35bc",
  sourceSection: "4.1.2",
  ruleStrength: "default_with_exceptions",
  output: "candidate_subject_evidence",
  status: "blocked_pending_exception_context",
} as const;

export type PronounCaseCandidateV1 = {
  lemma: string;
  Case: "Nom" | "Acc";
  source_candidate_id: string;
  status: "candidate";
  exhaustive: false;
};

// Single source (R133): a runtime release that carries the release-bound paradigm
// (grammar_runtime_release_pronoun_paradigm_v1, read via pronoun_paradigm_pairs_v1)
// supplies the pairs; the embedded manifest above is the fallback for releases
// without paradigm rows and must stay identical to the release table (tested).
export type PronounParadigmSourceV1 = {
  readonly pairs: readonly (readonly [string, string])[];
  readonly sourceCandidateId: string;
  readonly origin: "release_table" | "embedded_manifest";
  readonly releaseCode: string | null;
};

export const embeddedPronounParadigmSourceV1: PronounParadigmSourceV1 = {
  pairs: pronounParadigmManifestV1.pairs,
  sourceCandidateId: pronounParadigmManifestV1.sourceCandidateId,
  origin: "embedded_manifest",
  releaseCode: null,
};

export function pronounParadigmSourceFromRowsV1(rows: unknown, releaseCode: string): PronounParadigmSourceV1 {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...embeddedPronounParadigmSourceV1, releaseCode };
  }
  const norm = (value: unknown) =>
    typeof value === "string" ? value.normalize("NFC").trim().toLocaleLowerCase("nb-NO") : "";
  const pairs: [string, string][] = [];
  const sources = new Set<string>();
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const nominative = norm(r.nominative);
    const accusative = norm(r.accusative);
    const source = typeof r.source_candidate_id === "string" ? r.source_candidate_id : "";
    if (!nominative || !accusative || !source) throw new Error("pronoun_paradigm_rows_invalid");
    if (pairs.some(([nom]) => nom === nominative)) throw new Error("pronoun_paradigm_rows_duplicate");
    pairs.push([nominative, accusative]);
    sources.add(source);
  }
  if (sources.size !== 1) throw new Error("pronoun_paradigm_rows_mixed_sources");
  return { pairs, sourceCandidateId: [...sources][0], origin: "release_table", releaseCode };
}

export function producePronounCaseCandidatesV1(
  surface: string,
  paradigm: PronounParadigmSourceV1 = embeddedPronounParadigmSourceV1,
): PronounCaseCandidateV1[] {
  const normalized = surface.toLocaleLowerCase("nb-NO");
  const candidates: PronounCaseCandidateV1[] = [];
  for (const [nominative, accusative] of paradigm.pairs) {
    if (normalized === nominative) candidates.push({ lemma: nominative, Case: "Nom", source_candidate_id: paradigm.sourceCandidateId, status: "candidate", exhaustive: false });
    if (normalized === accusative) candidates.push({ lemma: nominative, Case: "Acc", source_candidate_id: paradigm.sourceCandidateId, status: "candidate", exhaustive: false });
  }
  return candidates;
}

export function generatePronounCaseFormV1(lemma: string, grammaticalCase: "Nom" | "Acc"): string | null {
  const pair = pronounParadigmManifestV1.pairs.find(([nom]) => nom === lemma.toLocaleLowerCase("nb-NO"));
  return pair ? pair[grammaticalCase === "Nom" ? 0 : 1] : null;
}

export function withPronounCaseCandidatesV1<T extends { surface: string }>(tokens: T[]): (T & { pronoun_case_candidates_v1: PronounCaseCandidateV1[] })[] {
  return tokens.map((token) => ({ ...token, pronoun_case_candidates_v1: producePronounCaseCandidatesV1(token.surface) }));
}

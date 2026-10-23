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

export function producePronounCaseCandidatesV1(surface: string): PronounCaseCandidateV1[] {
  const normalized = surface.toLocaleLowerCase("nb-NO");
  const candidates: PronounCaseCandidateV1[] = [];
  for (const [nominative, accusative] of pronounParadigmManifestV1.pairs) {
    if (normalized === nominative) candidates.push({ lemma: nominative, Case: "Nom", source_candidate_id: pronounParadigmManifestV1.sourceCandidateId, status: "candidate", exhaustive: false });
    if (normalized === accusative) candidates.push({ lemma: nominative, Case: "Acc", source_candidate_id: pronounParadigmManifestV1.sourceCandidateId, status: "candidate", exhaustive: false });
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

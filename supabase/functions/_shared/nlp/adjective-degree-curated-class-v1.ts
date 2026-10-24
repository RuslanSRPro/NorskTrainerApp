import { evaluateLexemeExceptionV1, type LexemeExceptionIdentityV1 } from "./adjective-degree-lexeme-exception-v1.ts";

// R109 editorial attestation: NDLA explicitly includes åpen in the -en
// contracted degree class. No comparative target is stored or read here.
const APEN_CLASS_ATTESTATION = {
  decision_id: "r109-apen-suffix-rule-article-1033",
  decision: "regular_confirmed" as const,
  lexeme_id: "81a6cba3-26d1-4bf1-9cb3-41997911dd50",
  lemma: "åpen",
  pos: "adjective",
  dictionary_code: "bm",
  article_id: 1033,
  snapshot_id: "965f0a1a-9f22-446a-b36c-f573c9a002d8",
  rule_source_candidate_id: "8cd6ed7e-c27d-4283-bcf1-58af141f387c",
  source_revision: "NDLA 2026-04-23; Production positive-row snapshot 965f0a1a-9f22-446a-b36c-f573c9a002d8",
  source_evidence_ids: [
    "ndla:adjective-degree:section-3:apen-class-member:2026-04-23",
    "ordbokene:bm:article:1033:lemma-pos-identity",
    "production:positive-row:965f0a1a-9f22-446a-b36c-f573c9a002d8:1033",
  ],
};

export function evaluateCuratedAdjectiveClassV1(identity: LexemeExceptionIdentityV1) {
  const decision = evaluateLexemeExceptionV1(
    identity, [APEN_CLASS_ATTESTATION], APEN_CLASS_ATTESTATION.source_revision,
  );
  return {
    ...decision,
    sourceEvidenceIds: decision.class === "regular_confirmed"
      ? APEN_CLASS_ATTESTATION.source_evidence_ids : [],
  };
}

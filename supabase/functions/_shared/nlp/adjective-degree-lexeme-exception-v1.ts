export type LexemeExceptionIdentityV1 = {
  lexeme_id: string;
  lemma: string;
  pos: string;
  dictionary_code: string;
  article_id: number;
  snapshot_id: string;
  rule_source_candidate_id: string;
};

export type LexemeExceptionAttestationV1 = LexemeExceptionIdentityV1 & {
  decision_id: string;
  decision: "regular_confirmed" | "irregular_confirmed" | "unknown" | "conflict";
  source_revision: string;
  source_evidence_ids: string[];
};

export type LexemeExceptionDecisionV1 = {
  class: "regular_confirmed" | "irregular_confirmed" | "unknown" | "conflict";
  exceptionCheckRequired: boolean;
  reason: string;
  decisionIds: string[];
};

const unknown = (reason: string): LexemeExceptionDecisionV1 =>
  ({ class: "unknown", exceptionCheckRequired: true, reason, decisionIds: [] });

// This bounded evaluator consumes class attestations, never stored degree forms.
// Source review and admission remain separate from the graph operator.
export function evaluateLexemeExceptionV1(
  identity: LexemeExceptionIdentityV1,
  attestations: LexemeExceptionAttestationV1[],
  requiredSourceRevision: string,
): LexemeExceptionDecisionV1 {
  const matched = attestations.filter((item) =>
    item.lexeme_id === identity.lexeme_id && item.lemma === identity.lemma &&
    item.pos === identity.pos && item.dictionary_code === identity.dictionary_code &&
    item.article_id === identity.article_id && item.snapshot_id === identity.snapshot_id &&
    item.rule_source_candidate_id === identity.rule_source_candidate_id
  );
  if (!matched.length) return unknown("no_exact_lexeme_article_attestation");
  if (matched.some((item) => item.source_revision !== requiredSourceRevision)) {
    return unknown("source_revision_mismatch");
  }
  if (matched.some((item) => !item.decision_id || !Array.isArray(item.source_evidence_ids) ||
      !(item.decision === "regular_confirmed"
        ? item.source_evidence_ids.some((id) => id.startsWith("ndla:adjective-degree:section-3:"))
        : item.decision === "irregular_confirmed"
        ? item.source_evidence_ids.some((id) => id.startsWith("independent:irregular-degree:"))
        : true) ||
      !item.source_evidence_ids.includes(`ordbokene:bm:article:${identity.article_id}:lemma-pos-identity`) ||
      !item.source_evidence_ids.includes(`production:positive-row:${identity.snapshot_id}:${identity.article_id}`) ||
      Object.keys(item).some((key) => /comparative|superlative|stored_target|^candidate$|observed_candidate/i.test(key)))) {
    return unknown("independent_class_or_identity_evidence_missing");
  }
  const classes = new Set(matched.map((item) => item.decision));
  if (classes.has("conflict") || classes.size > 1) {
    return { class: "conflict", exceptionCheckRequired: true,
      reason: "incompatible_attestations", decisionIds: matched.map((item) => item.decision_id) };
  }
  const selected = matched[0].decision;
  return {
    class: selected,
    exceptionCheckRequired: selected !== "regular_confirmed",
    reason: selected === "regular_confirmed" ? "suffix_rule_licensed_for_exact_lexeme" :
      selected === "irregular_confirmed" ? "suffix_rule_blocked_by_lexeme_exception" : "class_unresolved",
    decisionIds: matched.map((item) => item.decision_id),
  };
}

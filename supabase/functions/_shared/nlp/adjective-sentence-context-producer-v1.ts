// Candidate-neutral sentence context. This does not choose POS or execute a rule.
export type SentenceSourceCandidateV1 = {
  candidate_id: string;
  lexeme_id: string;
  source_pos: string;
  evidence?: Array<{
    source?: string;
    form_type?: string;
    grammatical_features?: { accepted_articles?: string[]; snapshot_id?: string };
  }>;
};

export type SentenceSourceTokenV1 = {
  canonical_token_id: string;
  token_index: number;
  surface: string;
  surface_resolution?: { candidates?: SentenceSourceCandidateV1[] };
  lexical_classes?: Array<{ class_code: string; membership_source?: string }>;
};

export type SentenceRelationV1 = {
  relation: string;
  source_token_id: string;
  target_token_id: string;
};

export type AdjectiveSentenceContextV1 = {
  canonicalTokenId: string;
  candidateId: string;
  lexemeId: string;
  status: "context_supported" | "ambiguous" | "insufficient_context" | "withheld";
  reason: string;
  supportKind: "article_adjective_noun_frame" | "copular_predicative" | null;
  articleTokenId: string | null;
  headTokenId: string | null;
  headCandidateIds: string[];
  competingCandidateIds: string[];
  evidenceRefs: string[];
  posAuthority: false;
  ruleActivationAuthority: false;
};

function norm(value: string): string { return value.normalize("NFC").toLocaleLowerCase("nb-NO"); }
function candidates(token: SentenceSourceTokenV1 | undefined): SentenceSourceCandidateV1[] {
  return Array.isArray(token?.surface_resolution?.candidates) ? token.surface_resolution.candidates : [];
}
function nounArticleEvidence(candidate: SentenceSourceCandidateV1, article: string): string | null {
  for (const item of candidate.evidence ?? []) {
    const forms = item.grammatical_features?.accepted_articles;
    if (item.source !== "lexeme_form_display_v2" || item.form_type !== "noun_singular_indefinite" ||
        !Array.isArray(forms) || !forms.map(norm).includes(article) ||
        !item.grammatical_features?.snapshot_id) continue;
    return `lexeme_form_display_v2:${candidate.lexeme_id}:${item.grammatical_features.snapshot_id}`;
  }
  return null;
}

export function produceAdjectiveSentenceContextV1(
  tokens: SentenceSourceTokenV1[],
  relations: SentenceRelationV1[] = [],
): AdjectiveSentenceContextV1[] {
  const ordered = [...tokens].sort((a, b) => a.token_index - b.token_index);
  const tokenIds = new Set(ordered.map((t) => t.canonical_token_id));
  const validIdentity = ordered.every((t, i) => Boolean(t.canonical_token_id) &&
    Number.isInteger(t.token_index) && t.token_index === i + 1) && tokenIds.size === ordered.length;
  const output: AdjectiveSentenceContextV1[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const target = ordered[i];
    const targetCandidates = candidates(target);
    for (const adjective of targetCandidates.filter((c) => c.source_pos === "adjective")) {
      const base = {
        canonicalTokenId: target.canonical_token_id,
        candidateId: adjective.candidate_id,
        lexemeId: adjective.lexeme_id,
        articleTokenId: null as string | null,
        headTokenId: null as string | null,
        headCandidateIds: [] as string[],
        competingCandidateIds: targetCandidates.filter((c) => c.candidate_id !== adjective.candidate_id)
          .map((c) => c.candidate_id),
        evidenceRefs: [] as string[],
        posAuthority: false as const,
        ruleActivationAuthority: false as const,
      };
      const emit = (status: AdjectiveSentenceContextV1["status"], reason: string,
        supportKind: AdjectiveSentenceContextV1["supportKind"], extra = {}) =>
        output.push({ ...base, status, reason, supportKind, ...extra });
      if (!validIdentity || !adjective.candidate_id || !adjective.lexeme_id ||
          new Set(targetCandidates.map((c) => c.candidate_id)).size !== targetCandidates.length) {
        emit("withheld", "canonical_or_candidate_identity_invalid", null);
        continue;
      }
      const article = ordered[i - 1];
      const head = ordered[i + 1];
      const articleClass = article?.lexical_classes?.find((c) =>
        c.class_code === "indefinite_article" && Boolean(c.membership_source));
      if (article && head && articleClass) {
        const headCandidates = candidates(head);
        const frame = {
          articleTokenId: article.canonical_token_id,
          headTokenId: head.canonical_token_id,
          headCandidateIds: headCandidates.map((c) => c.candidate_id),
        };
        if (base.competingCandidateIds.length) {
          emit("ambiguous", "target_readings_compete", "article_adjective_noun_frame", frame);
          continue;
        }
        if (!headCandidates.length || headCandidates.some((c) => c.source_pos !== "noun")) {
          emit("ambiguous", "head_pos_competes_or_missing", "article_adjective_noun_frame", frame);
          continue;
        }
        const articleForm = norm(article.surface);
        const headEvidence = headCandidates.map((c) => nounArticleEvidence(c, articleForm));
        if (headEvidence.some((ref) => !ref)) {
          emit("ambiguous", "head_article_agreement_unproved", "article_adjective_noun_frame", frame);
          continue;
        }
        emit("context_supported", "article_adjective_noun_frame_compatible",
          "article_adjective_noun_frame", { ...frame,
            evidenceRefs: [`lexical_class:indefinite_article:${articleClass.membership_source}`,
              ...headEvidence.filter((ref): ref is string => Boolean(ref))] });
        continue;
      }
      const copula = relations.find((r) => r.relation === "copula_links_predicative" &&
        r.target_token_id === target.canonical_token_id && tokenIds.has(r.source_token_id));
      if (copula) {
        emit("ambiguous", "copular_predicative_allows_noun_or_adjective", "copular_predicative",
          { evidenceRefs: [`relation:${copula.relation}:${copula.source_token_id}:${target.canonical_token_id}`] });
      } else {
        emit("insufficient_context", "no_independent_adjective_context", null);
      }
    }
  }
  return output;
}

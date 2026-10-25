import type { CandidateRuleFamilyV1, CandidateRuleResultV1 } from "./canonical-rule-candidate-execution-v1.ts";
import { adjectiveDegreeRegularPenManifestV1 as manifest } from
  "./adjective-degree-regular-pen-manifest-v1.ts";

const FAMILY = "adjective_degree_rule_first.regular_ere.pen.v1";

function withheld(tokenId: string, reason: string): CandidateRuleResultV1 {
  return { familyCode: FAMILY, status: "withheld", reason, tokenId,
    sourceCandidateId: null, lexemeId: manifest.lexemeId, lexicalNodeId: null,
    ruleCode: manifest.ruleCode, sourceRuleCandidateId: manifest.ruleSourceCandidateId,
    activationAuthority: false, persistenceAuthority: false };
}

export const regularPenDegreeCandidateFamilyV1: CandidateRuleFamilyV1 = {
  code: FAMILY,
  triggered: ({ sentenceFindings }) => sentenceFindings.some((finding) =>
    finding.status === "context_supported" && finding.lexemeId === manifest.lexemeId),
  async evaluate({ graph, tokens, sentenceFindings, loadPositiveAdjectiveRow }) {
    const results: CandidateRuleResultV1[] = [];
    for (const finding of sentenceFindings.filter((item) =>
      item.status === "context_supported" && item.lexemeId === manifest.lexemeId)) {
      const token = tokens.find((item) => item.canonical_token_id === finding.tokenId);
      const matching = token?.surface_resolution?.candidates?.filter((candidate) =>
        candidate.candidate_id === finding.candidateId &&
        candidate.lexeme_id === finding.lexemeId &&
        candidate.source_pos === "adjective") ?? [];
      const lexicalNodes = graph.nodes.filter((node) => node.type === "lexical_reading" &&
        node.producer === "canonical_candidate_lattice_v1" &&
        node.span?.tokenIds?.includes(finding.tokenId) &&
        node.features.lexemeId === manifest.lexemeId &&
        node.features.lemma === manifest.lemma &&
        node.features.sourcePos === "adjective");
      if (!token || token.surface.normalize("NFC").toLocaleLowerCase("nb-NO") !== manifest.lemma ||
          finding.candidateId !== `surface:${manifest.lexemeId}:adjective` ||
          matching.length !== 1 || lexicalNodes.length !== 1 ||
          lexicalNodes[0].status !== "candidate") {
        results.push(withheld(finding.tokenId, "candidate_token_or_lexical_identity_mismatch"));
        continue;
      }
      let raw: unknown;
      try { raw = await loadPositiveAdjectiveRow?.(manifest.lexemeId); }
      catch {
        results.push(withheld(finding.tokenId, "positive_source_unavailable"));
        continue;
      }
      const rows = Array.isArray(raw) ? raw : [];
      const row = rows.length === 1 && rows[0] && typeof rows[0] === "object"
        ? rows[0] as Record<string, unknown> : {};
      if (rows.length !== 1 || row.lexeme_id !== manifest.lexemeId ||
          row.snapshot_id !== manifest.snapshotId ||
          row.dictionary_code !== "bm" || Number(row.article_id) !== manifest.articleId ||
          row.pos !== "adjective" || row.lemma !== manifest.lemma ||
          row.form_key !== "positive_singular_indefinite_common" ||
          !Array.isArray(row.primary_values) || row.primary_values.length !== 1 ||
          row.primary_values[0] !== manifest.lemma ||
          !Array.isArray(row.article_ids) ||
          !row.article_ids.some((id) => String(id) === String(manifest.articleId)) ||
          !Array.isArray(row.evidence_ids) ||
          !row.evidence_ids.includes("ordbokene:official-form")) {
        results.push(withheld(finding.tokenId, "positive_source_or_snapshot_mismatch"));
        continue;
      }
      // NDLA independently names pen as a regular -ere example. No stored
      // comparative value enters this operation or the admission checks.
      results.push({ familyCode: FAMILY, status: "candidate",
        reason: "independently_licensed_regular_suffix_derivation",
        tokenId: finding.tokenId, sourceCandidateId: finding.candidateId,
        lexemeId: manifest.lexemeId, lexicalNodeId: lexicalNodes[0].id,
        ruleCode: manifest.ruleCode, sourceRuleCandidateId: manifest.ruleSourceCandidateId,
        derivedForm: `${manifest.lemma}${manifest.suffix}`,
        positiveSnapshotId: manifest.snapshotId,
        activationAuthority: false, persistenceAuthority: false });
    }
    return results;
  },
};

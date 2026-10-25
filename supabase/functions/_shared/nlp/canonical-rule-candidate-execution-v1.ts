// Candidate-only rule execution shared by morphology families. No rule grant,
// reading selection, card persistence or application mutation occurs here.
import type {
  CanonicalLanguageGraphV1, GraphPatchV1, LanguageGraphEvidenceV1,
  LanguageGraphProvenanceV1,
} from "./canonical-language-graph-core-v1.ts";
import type { SentenceSourceTokenV1 } from "./adjective-sentence-context-producer-v1.ts";
import type { SentenceEvidenceFindingV1 } from "./canonical-sentence-evidence-producer-v1.ts";
import {
  producePronounCaseCandidatesV1, pronounParadigmManifestV1,
} from "./pronoun-paradigm-operator-v1.ts";
import { adjectiveDegreeRuleFirstShadowManifestV1 as adjectiveManifest } from
  "./adjective-degree-rule-first-shadow-manifest-v1.ts";

const PRODUCER = "canonical_rule_candidate_execution_v1";
const PRONOUN_FAMILY = "morphological_paradigm.personal_pronoun_case.v1";
const ADJECTIVE_FAMILY = "adjective_degree_rule_first.apen.v1";

export type CandidateRuleResultV1 = {
  familyCode: string;
  status: "candidate" | "withheld";
  reason: string;
  tokenId: string;
  sourceCandidateId: string | null;
  lexemeId: string | null;
  lexicalNodeId: string | null;
  ruleCode: string;
  sourceRuleCandidateId: string;
  readings?: Array<{ lemma: string; Case: "Nom" | "Acc" }>;
  derivedForm?: string;
  positiveSnapshotId?: string;
  activationAuthority: false;
  persistenceAuthority: false;
};

export type CandidateRuleContextV1 = {
  graph: CanonicalLanguageGraphV1;
  tokens: readonly SentenceSourceTokenV1[];
  sentenceFindings: readonly SentenceEvidenceFindingV1[];
  callAdjectiveRule: (lexemeId: string) => Promise<unknown>;
};

export type CandidateRuleFamilyV1 = {
  code: string;
  triggered: (context: CandidateRuleContextV1) => boolean;
  evaluate: (context: CandidateRuleContextV1) => Promise<CandidateRuleResultV1[]>;
};

function validTokenIdentity(
  graph: CanonicalLanguageGraphV1,
  tokens: readonly SentenceSourceTokenV1[],
): boolean {
  const ordered = [...tokens].sort((a, b) => a.token_index - b.token_index);
  return new Set(ordered.map((token) => token.canonical_token_id)).size === ordered.length &&
    ordered.every((token, index) => Boolean(token.canonical_token_id) &&
      token.token_index === index + 1 &&
      graph.nodes.filter((node) => node.id === token.canonical_token_id &&
        node.type === "token" && node.features.surface === token.surface).length === 1);
}

function withheld(reason: string, tokenId: string): CandidateRuleResultV1 {
  return { familyCode: ADJECTIVE_FAMILY, status: "withheld", reason, tokenId,
    sourceCandidateId: null, lexemeId: adjectiveManifest.lexemeId,
    lexicalNodeId: null, ruleCode: adjectiveManifest.ruleCode,
    sourceRuleCandidateId: adjectiveManifest.ruleSourceCandidateId,
    activationAuthority: false, persistenceAuthority: false };
}

export const pronounCaseCandidateFamilyV1: CandidateRuleFamilyV1 = {
  code: PRONOUN_FAMILY,
  triggered: ({ tokens }) => tokens.some((token) =>
    producePronounCaseCandidatesV1(token.surface).length > 0),
  async evaluate({ tokens }) {
    return tokens.flatMap((token) => {
      const readings = producePronounCaseCandidatesV1(token.surface);
      return readings.length ? [{
        familyCode: PRONOUN_FAMILY, status: "candidate" as const,
        reason: "source_backed_nonexhaustive_case_readings",
        tokenId: token.canonical_token_id, sourceCandidateId: null,
        lexemeId: null, lexicalNodeId: null,
        ruleCode: pronounParadigmManifestV1.code,
        sourceRuleCandidateId: pronounParadigmManifestV1.sourceCandidateId,
        readings: readings.map(({ lemma, Case }) => ({ lemma, Case })),
        activationAuthority: false as const, persistenceAuthority: false as const,
      }] : [];
    });
  },
};

export const adjectiveDegreeCandidateFamilyV1: CandidateRuleFamilyV1 = {
  code: ADJECTIVE_FAMILY,
  triggered: ({ sentenceFindings }) => sentenceFindings.some((finding) =>
    finding.status === "context_supported" && finding.lexemeId === adjectiveManifest.lexemeId),
  async evaluate({ graph, tokens, sentenceFindings, callAdjectiveRule }) {
    const results: CandidateRuleResultV1[] = [];
    for (const finding of sentenceFindings.filter((item) =>
      item.status === "context_supported" && item.lexemeId === adjectiveManifest.lexemeId)) {
      const token = tokens.find((item) => item.canonical_token_id === finding.tokenId);
      const matching = token?.surface_resolution?.candidates?.filter((candidate) =>
        candidate.candidate_id === finding.candidateId &&
        candidate.lexeme_id === finding.lexemeId && candidate.source_pos === "adjective") ?? [];
      const lexicalNodes = graph.nodes.filter((node) => node.type === "lexical_reading" &&
        node.producer === "canonical_candidate_lattice_v1" &&
        node.span?.tokenIds?.includes(finding.tokenId) &&
        node.features.lexemeId === finding.lexemeId &&
        node.features.sourcePos === "adjective");
      if (!token || token.surface.normalize("NFC").toLocaleLowerCase("nb-NO") !== "åpen" ||
          finding.candidateId !== `surface:${adjectiveManifest.lexemeId}:adjective` ||
          matching.length !== 1 || lexicalNodes.length !== 1 ||
          lexicalNodes[0].status !== "candidate") {
        results.push(withheld("candidate_token_or_lexical_identity_mismatch", finding.tokenId));
        continue;
      }
      let raw: unknown;
      try { raw = await callAdjectiveRule(adjectiveManifest.lexemeId); }
      catch {
        results.push(withheld("private_rule_operator_unavailable", finding.tokenId));
        continue;
      }
      const rule = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw as Record<string, unknown> : {};
      if (rule.ok !== true || rule.status !== "candidate" ||
          rule.activationAuthority !== false || rule.graphMutation !== false ||
          rule.lexemeId !== adjectiveManifest.lexemeId ||
          rule.positiveForm !== "åpen" ||
          rule.positiveSnapshotId !== adjectiveManifest.snapshotId ||
          Number(rule.articleId) !== adjectiveManifest.articleId ||
          rule.manifestCode !== adjectiveManifest.code ||
          rule.ruleCode !== adjectiveManifest.ruleCode ||
          rule.sourceCandidateId !== adjectiveManifest.ruleSourceCandidateId ||
          typeof rule.candidate !== "string" || !rule.candidate) {
        results.push(withheld("rule_result_or_source_snapshot_mismatch", finding.tokenId));
        continue;
      }
      results.push({ familyCode: ADJECTIVE_FAMILY, status: "candidate",
        reason: "rule_first_derivation_observed", tokenId: finding.tokenId,
        sourceCandidateId: finding.candidateId, lexemeId: finding.lexemeId,
        lexicalNodeId: lexicalNodes[0].id, ruleCode: adjectiveManifest.ruleCode,
        sourceRuleCandidateId: adjectiveManifest.ruleSourceCandidateId,
        derivedForm: rule.candidate, positiveSnapshotId: adjectiveManifest.snapshotId,
        activationAuthority: false, persistenceAuthority: false });
    }
    return results;
  },
};

export async function executeCanonicalRuleCandidatesV1(
  context: CandidateRuleContextV1,
  families: readonly CandidateRuleFamilyV1[] =
    [pronounCaseCandidateFamilyV1, adjectiveDegreeCandidateFamilyV1],
): Promise<{ patch: GraphPatchV1; results: CandidateRuleResultV1[];
  familiesEvaluated: string[]; familiesSkipped: string[] }> {
  const codes = families.map((family) => family.code);
  if (codes.some((code) => !code) || new Set(codes).size !== codes.length)
    throw new Error("candidate_rule_family_codes_invalid");
  if (!validTokenIdentity(context.graph, context.tokens))
    throw new Error("candidate_rule_token_identity_invalid");
  const ordered = [...families].sort((a, b) => a.code.localeCompare(b.code));
  const applicable = ordered.filter((family) => family.triggered(context));
  const results = (await Promise.all(applicable.map((family) => family.evaluate(context)))).flat();
  const tokenIds = new Set(context.tokens.map((token) => token.canonical_token_id));
  const evidence: LanguageGraphEvidenceV1[] = [];
  const provenance: LanguageGraphProvenanceV1[] = [];
  for (const result of results.filter((item) => item.status === "candidate")) {
    if (!tokenIds.has(result.tokenId) || result.activationAuthority !== false ||
        result.persistenceAuthority !== false) throw new Error("candidate_rule_output_invalid");
    const id = `evidence:${PRODUCER}:${result.familyCode}:${result.tokenId}`;
    const provId = `prov:${PRODUCER}:${result.familyCode}:${result.tokenId}`;
    provenance.push({ id: provId, sourceType: "source_rule",
      sourceId: result.sourceRuleCandidateId,
      payload: { ruleCode: result.ruleCode, candidateOnly: true } });
    evidence.push({ id, kind: "morphological", status: "neutral",
      targetIds: result.lexicalNodeId ? [result.tokenId, result.lexicalNodeId] : [result.tokenId],
      payload: { ...result, candidateOnly: true, exhaustive: false,
        selectedPos: null, verifiedCard: false },
      producer: PRODUCER, provenanceIds: [provId] });
  }
  const selected = new Set(applicable.map((family) => family.code));
  return { patch: { producer: PRODUCER, producerVersion: "1", evidence, provenance },
    results, familiesEvaluated: applicable.map((family) => family.code),
    familiesSkipped: ordered.filter((family) => !selected.has(family.code)).map((family) => family.code) };
}

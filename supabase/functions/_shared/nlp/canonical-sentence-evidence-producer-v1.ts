// Family-neutral bridge from sentence evidence producers to the existing
// canonical constraint engine. Findings remain support-only until a separate
// source-backed activation decision authorizes stronger outcomes.
import type { CanonicalLanguageGraphV1 } from "./canonical-language-graph-core-v1.ts";
import type {
  CanonicalConstraintEvaluationV1,
  CanonicalConstraintEvaluatorV1,
} from "./canonical-constraint-propagation-v1.ts";
import type {
  SentenceRelationV1,
  SentenceSourceTokenV1,
} from "./adjective-sentence-context-producer-v1.ts";

export type SentenceEvidenceFindingV1 = {
  tokenId: string;
  candidateId: string;
  lexemeId: string;
  sourcePos: string;
  status: "context_supported" | "ambiguous" | "insufficient_context" | "withheld";
  reason: string;
  inputTokenIds: string[];
  evidenceRefs: string[];
  competingCandidateIds: string[];
};

export type SentenceEvidenceFamilyV1 = {
  code: string;
  trigger?: {
    candidatePos?: readonly string[];
    lexicalClasses?: readonly string[];
    relations?: readonly string[];
  };
  produce: (tokens: readonly SentenceSourceTokenV1[], relations: readonly SentenceRelationV1[]) =>
    readonly SentenceEvidenceFindingV1[];
};

export type SentenceEvidenceProductionV1 = {
  findings: Array<SentenceEvidenceFindingV1 & { familyCode: string }>;
  familiesEvaluated: string[];
  familiesSkipped: string[];
  evaluator: CanonicalConstraintEvaluatorV1;
};

function lexicalNodeFor(
  graph: CanonicalLanguageGraphV1,
  finding: SentenceEvidenceFindingV1,
): string | null {
  const matches = graph.nodes.filter((node) => node.type === "lexical_reading" &&
    node.producer === "canonical_candidate_lattice_v1" &&
    node.span?.tokenIds?.includes(finding.tokenId) &&
    node.features.lexemeId === finding.lexemeId &&
    node.features.sourcePos === finding.sourcePos);
  return matches.length === 1 ? matches[0].id : null;
}

export function produceCanonicalSentenceEvidenceV1(
  tokens: readonly SentenceSourceTokenV1[],
  relations: readonly SentenceRelationV1[],
  families: readonly SentenceEvidenceFamilyV1[],
): SentenceEvidenceProductionV1 {
  const codes = families.map((family) => family.code);
  if (codes.some((code) => !code) || new Set(codes).size !== codes.length)
    throw new Error("sentence_evidence_family_codes_invalid");
  const presentPos = new Set(tokens.flatMap((token) =>
    (token.surface_resolution?.candidates ?? []).map((candidate) => candidate.source_pos)));
  const presentClasses = new Set(tokens.flatMap((token) =>
    (token.lexical_classes ?? []).map((item) => item.class_code)));
  const presentRelations = new Set(relations.map((relation) => relation.relation));
  const orderedFamilies = [...families].sort((a, b) => a.code.localeCompare(b.code));
  const applicable = orderedFamilies.filter((family) => {
    const trigger = family.trigger;
    return (!trigger?.candidatePos?.length || trigger.candidatePos.some((pos) => presentPos.has(pos))) &&
      (!trigger?.lexicalClasses?.length || trigger.lexicalClasses.some((code) => presentClasses.has(code))) &&
      (!trigger?.relations?.length || trigger.relations.some((code) => presentRelations.has(code)));
  });
  const selected = new Set(applicable.map((family) => family.code));
  const findings = applicable
    .flatMap((family) => family.produce(tokens, relations).map((finding) =>
      ({ ...finding, familyCode: family.code })));
  const tokenIds = new Set(tokens.map((token) => token.canonical_token_id));
  const evaluator: CanonicalConstraintEvaluatorV1 = ({ graph }) => {
    const evaluations: CanonicalConstraintEvaluationV1[] = [];
    for (const finding of findings) {
      if (finding.status !== "context_supported" || !tokenIds.has(finding.tokenId) ||
          !finding.candidateId || !finding.lexemeId ||
          finding.inputTokenIds.some((id) => !tokenIds.has(id))) continue;
      const nodeId = lexicalNodeFor(graph, finding);
      if (!nodeId) continue;
      evaluations.push({
        id: `sentence-evidence:${finding.familyCode}:${finding.tokenId}:${finding.candidateId}`,
        constraintCode: finding.familyCode,
        strength: "supporting",
        outcome: "support",
        inputIds: [...new Set(finding.inputTokenIds)],
        affectedIds: [nodeId],
        requiredCapabilities: ["canonical_candidate_lattice_v1"],
        payload: {
          candidateId: finding.candidateId,
          lexemeId: finding.lexemeId,
          sourcePos: finding.sourcePos,
          reason: finding.reason,
          evidenceRefs: finding.evidenceRefs,
          competingCandidateIds: finding.competingCandidateIds,
          posAuthority: false,
          ruleActivationAuthority: false,
        },
        provenance: [{ id: `prov:sentence-evidence:${finding.familyCode}:${finding.tokenId}`,
          sourceType: "runtime_fact", sourceId: finding.familyCode,
          payload: { status: "candidate_support", authority: false } }],
      });
    }
    return evaluations;
  };
  return { findings, familiesEvaluated: applicable.map((family) => family.code),
    familiesSkipped: orderedFamilies.filter((family) => !selected.has(family.code)).map((family) => family.code),
    evaluator };
}

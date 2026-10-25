import { produceAdjectiveSentenceContextV1 } from "./adjective-sentence-context-producer-v1.ts";
import type { SentenceEvidenceFamilyV1 } from "./canonical-sentence-evidence-producer-v1.ts";

export const adjectiveSentenceEvidenceFamilyV1: SentenceEvidenceFamilyV1 = {
  code: "shadow.sentence.adjective.article_noun_context.v1",
  produce(tokens, relations) {
    return produceAdjectiveSentenceContextV1([...tokens], [...relations]).map((item) => ({
      tokenId: item.canonicalTokenId,
      candidateId: item.candidateId,
      lexemeId: item.lexemeId,
      sourcePos: "adjective",
      status: item.status,
      reason: item.reason,
      inputTokenIds: [item.articleTokenId, item.canonicalTokenId, item.headTokenId]
        .filter((value): value is string => Boolean(value)),
      evidenceRefs: item.evidenceRefs,
      competingCandidateIds: item.competingCandidateIds,
    }));
  },
};

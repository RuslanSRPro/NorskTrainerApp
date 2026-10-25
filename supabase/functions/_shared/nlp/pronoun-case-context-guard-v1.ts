// Case form evidence is independent of syntactic role. The source describes
// subject/complement case as a default with exceptions, so this guard never
// turns a form candidate into a resolved subject or object.
import type { SentenceSourceTokenV1 } from "./adjective-sentence-context-producer-v1.ts";

export const pronounCaseExceptionSourcesV1 = {
  coordination: "a0a84d73-e761-4aad-a52e-28d50ce4d34c",
  comparison: "c409afc3-0b25-42cc-90b9-c62073e579c8",
  preposition: "ee225cc9-84ed-4593-824c-edfcb76a6590",
} as const;

export type PronounCaseContextV1 = {
  roleStatus: "deferred";
  reason: "coordination_exception_scope" | "comparison_exception_scope" |
    "preposition_exception_scope" | "independent_role_evidence_missing";
  exceptionSourceCandidateIds: string[];
  subjectOrObjectAuthority: false;
};

export function assessPronounCaseContextV1(
  tokens: readonly SentenceSourceTokenV1[], tokenIndex: number,
): PronounCaseContextV1 {
  const ordered = [...tokens].sort((a, b) => a.token_index - b.token_index);
  const at = ordered.findIndex((token) => token.token_index === tokenIndex);
  const norm = (value: string | undefined) =>
    value?.normalize("NFC").toLocaleLowerCase("nb-NO") ?? "";
  const neighbors = [norm(ordered[at - 1]?.surface), norm(ordered[at + 1]?.surface)];
  let reason: PronounCaseContextV1["reason"] = "independent_role_evidence_missing";
  let source: string | null = null;
  if (neighbors.some((surface) => surface === "og" || surface === "eller")) {
    reason = "coordination_exception_scope";
    source = pronounCaseExceptionSourcesV1.coordination;
  } else if (neighbors.some((surface) => surface === "enn" || surface === "som")) {
    reason = "comparison_exception_scope";
    source = pronounCaseExceptionSourcesV1.comparison;
  } else if (["for", "uten", "unntatt"].includes(norm(ordered[at - 1]?.surface))) {
    reason = "preposition_exception_scope";
    source = pronounCaseExceptionSourcesV1.preposition;
  }
  return { roleStatus: "deferred", reason,
    exceptionSourceCandidateIds: source ? [source] : [],
    subjectOrObjectAuthority: false };
}

import {
  type AggregateAssessment,
  type AssessmentPage,
  CAPABILITY_NAMES,
  type CapabilityName,
  type CapabilityStatus,
  CONTRACT_VERSION,
  type QualityStage,
} from "./contract.ts";

const QUALITY_STAGES: QualityStage[] = [
  "ready",
  "provisional",
  "needs_review",
  "blocked",
];
const CAPABILITY_STATUSES: CapabilityStatus[] = [
  "ready",
  "provisional",
  "blocked",
  "not_applicable",
];

export function aggregateAssessmentPages(
  pages: readonly AssessmentPage[],
): AggregateAssessment {
  if (pages.length === 0) throw new Error("ASSESSMENT_PAGES_REQUIRED");
  const snapshotToken = pages[0].snapshot_token;
  if (!snapshotToken) throw new Error("SNAPSHOT_TOKEN_REQUIRED");

  const byEntity = new Map<string, AssessmentPage["assessments"][number]>();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (page.snapshot_token !== snapshotToken) {
      throw new Error("SNAPSHOT_CHANGED");
    }
    if (index > 0 && page.cursor !== pages[index - 1].next_cursor) {
      throw new Error("NON_CONTIGUOUS_ASSESSMENT_PAGES");
    }
    if (index < pages.length - 1 && !page.has_more) {
      throw new Error("EARLY_TERMINAL_PAGE");
    }
    for (const assessment of page.assessments) {
      if (assessment.snapshot_token !== snapshotToken) {
        throw new Error("SNAPSHOT_CHANGED");
      }
      if (byEntity.has(assessment.entity_key)) {
        throw new Error(`DUPLICATE_ENTITY:${assessment.entity_key}`);
      }
      byEntity.set(assessment.entity_key, assessment);
    }
  }
  if (pages.at(-1)?.has_more) throw new Error("INCOMPLETE_ASSESSMENT_PAGES");

  const assessments = [...byEntity.values()].sort((a, b) =>
    a.entity_key.localeCompare(b.entity_key)
  );
  const qualityCounts = Object.fromEntries(
    QUALITY_STAGES.map((stage) => [stage, 0]),
  ) as Record<
    QualityStage,
    number
  >;
  const capabilityCounts = Object.fromEntries(CAPABILITY_NAMES.map((name) => [
    name,
    Object.fromEntries(CAPABILITY_STATUSES.map((status) => [status, 0])),
  ])) as Record<CapabilityName, Record<CapabilityStatus, number>>;

  for (const assessment of assessments) {
    qualityCounts[assessment.quality_stage] += 1;
    for (const capability of CAPABILITY_NAMES) {
      capabilityCounts[capability][
        assessment.capabilities[capability].status
      ] += 1;
    }
  }

  return {
    contract_version: CONTRACT_VERSION,
    snapshot_token: snapshotToken,
    total_entities: assessments.length,
    learner_ready_entities:
      assessments.filter((assessment) => assessment.quality_stage === "ready")
        .length,
    quality_counts: qualityCounts,
    capability_counts: capabilityCounts,
    assessments,
  };
}

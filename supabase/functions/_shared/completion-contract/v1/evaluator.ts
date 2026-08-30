import {
  type AssessmentIssue,
  CAPABILITY_NAMES,
  type CapabilityAssessment,
  type CapabilityAssessments,
  type CapabilityName,
  type CapabilityStatus,
  CONTRACT_VERSION,
  type EntityCompletionAssessment,
  type EntityEvidenceSnapshot,
  EVALUATOR_VERSION,
  type FormEvidence,
  type Locale,
  PARADIGM_TYPES,
  type ParadigmType,
  type QualityStage,
  SNAPSHOT_VERSION,
  type TranslationEvidence,
} from "./contract.ts";

const VERIFIED_STATUSES = new Set([
  "accepted",
  "approved",
  "authoritative",
  "multi_source",
  "verified",
  "usage_verified",
  "source_verified",
  "multi_source_verified",
  "manual_verified",
]);

const REVIEW_STATUSES = new Set(["needs_review", "manual_review", "disputed"]);
const RELATION_READY_STATUSES = new Set([
  ...VERIFIED_STATUSES,
  "resolved",
  "trusted",
]);
const INFLECTING_POS = new Set(["noun", "verb", "adjective"]);
const FUNCTION_POS = new Set([
  "adposition",
  "article",
  "auxiliary",
  "conjunction",
  "determiner",
  "interjection",
  "particle",
  "preposition",
  "pronoun",
  "subjunction",
]);

const REQUIRED_FORMS: Readonly<Record<string, readonly string[]>> = {
  noun: [
    "singular_indefinite",
    "singular_definite",
    "plural_indefinite",
    "plural_definite",
  ],
  verb: ["infinitive", "present", "past", "present_perfect", "past_participle"],
  adjective: [
    "positive_common",
    "positive_neuter",
    "positive_definite",
    "positive_plural",
    "comparative",
    "superlative",
    "superlative_definite",
  ],
};

const SOURCE_BACKED_EXCEPTIONS = new Set<ParadigmType>([
  "suppletive",
  "defective",
  "indeclinable",
  "uncountable",
  "plural_only",
]);

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function issueSort(a: AssessmentIssue, b: AssessmentIssue): number {
  return [a.severity, a.capability ?? "", a.locale ?? "", a.code, a.detail]
    .join("\u0000")
    .localeCompare(
      [b.severity, b.capability ?? "", b.locale ?? "", b.code, b.detail].join(
        "\u0000",
      ),
    );
}

function makeIssue(
  code: string,
  severity: AssessmentIssue["severity"],
  capability: CapabilityName | null,
  detail: string,
  locale: Locale | null = null,
): AssessmentIssue {
  return { code, severity, capability, locale, detail };
}

function makeCapability(
  status: CapabilityStatus,
  issues: readonly AssessmentIssue[] = [],
  refs: readonly string[] = [],
): CapabilityAssessment {
  return {
    status,
    issue_codes: uniqueSorted(issues.map((issue) => issue.code)),
    evidence_refs: uniqueSorted(refs),
  };
}

function acceptedForm(form: FormEvidence): boolean {
  return form.is_accepted &&
    !form.needs_review &&
    VERIFIED_STATUSES.has(normalized(form.verification_status)) &&
    form.source_refs.length > 0 &&
    normalized(form.normalized_form).length > 0;
}

interface FormsResult {
  paradigmType: ParadigmType | null;
  status: CapabilityStatus;
  issues: AssessmentIssue[];
  refs: string[];
}

function evaluateForms(snapshot: EntityEvidenceSnapshot): FormsResult {
  const pos = normalized(snapshot.pos);
  if (!INFLECTING_POS.has(pos)) {
    return {
      paradigmType: null,
      status: "not_applicable",
      issues: [],
      refs: [],
    };
  }

  const explicit = snapshot.identity.paradigm_type;
  const validExplicit = explicit && PARADIGM_TYPES.includes(explicit)
    ? explicit
    : null;
  const required = REQUIRED_FORMS[pos] ?? [];
  const accepted = snapshot.forms.filter(acceptedForm);
  const acceptedTypes = new Set(
    accepted.map((form) => normalized(form.form_type)),
  );
  const allowedMissing = new Set(
    snapshot.identity.allowed_missing_slots.map(normalized),
  );
  const hasSourceBackedException = validExplicit !== null &&
    SOURCE_BACKED_EXCEPTIONS.has(validExplicit) &&
    snapshot.identity.paradigm_source_refs.length > 0;
  const missing = required.filter((slot) =>
    !acceptedTypes.has(slot) &&
    !(hasSourceBackedException && allowedMissing.has(slot))
  );
  const refs = uniqueSorted([
    ...accepted.flatMap((form) => form.source_refs),
    ...snapshot.identity.paradigm_source_refs,
  ]);

  let paradigmType: ParadigmType;
  if (validExplicit && validExplicit !== "unknown") {
    paradigmType = validExplicit;
  } else if (missing.length > 0) {
    paradigmType = "unknown";
  } else if (accepted.some((form) => form.is_irregular)) {
    paradigmType = "irregular";
  } else {
    paradigmType = "regular";
  }

  if (validExplicit === "unknown") {
    const issue = makeIssue(
      "PARADIGM_UNKNOWN",
      "blocking",
      null,
      "The inflection paradigm is explicitly unknown.",
    );
    return {
      paradigmType: "unknown",
      status: "blocked",
      issues: [issue],
      refs,
    };
  }

  if (missing.length > 0) {
    const issue = makeIssue(
      "REQUIRED_FORMS_MISSING",
      "blocking",
      null,
      `Missing source-verified form slots: ${missing.join(", ")}.`,
    );
    return { paradigmType, status: "blocked", issues: [issue], refs };
  }

  return { paradigmType, status: "ready", issues: [], refs };
}

interface TranslationResult {
  status: CapabilityStatus;
  issues: AssessmentIssue[];
  refs: string[];
}

function translationBelongsToEntity(
  snapshot: EntityEvidenceSnapshot,
  translation: TranslationEvidence,
): boolean {
  return snapshot.entity_kind === "expression"
    ? translation.expression_id === snapshot.entity_id
    : translation.lexeme_id === snapshot.entity_id &&
      translation.expression_id === null;
}

function evaluateTranslation(
  snapshot: EntityEvidenceSnapshot,
  locale: Locale,
  translations = snapshot.translations,
  owningExpressionId: string | null = snapshot.entity_kind === "expression"
    ? snapshot.entity_id
    : null,
  wholeUnitRefs = snapshot.identity.expression_whole_unit_source_refs,
): TranslationResult {
  const applicable = translations
    .filter((translation) => translation.locale === locale)
    .filter((translation) => normalized(translation.value).length > 0)
    .filter((translation) =>
      owningExpressionId
        ? translation.expression_id === owningExpressionId
        : translationBelongsToEntity(snapshot, translation)
    );

  const reviewed = applicable.filter((translation) => translation.needs_review);
  const usable = applicable.filter((translation) => !translation.needs_review);
  const ready = usable.filter((translation) => {
    const provider = normalized(translation.provider);
    if (provider === "manual_verified") return true;
    if (provider !== "lexin" || translation.source_refs.length === 0) {
      return false;
    }
    if (owningExpressionId) return wholeUnitRefs.length > 0;
    return translation.canonical;
  });

  if (ready.length > 0) {
    return {
      status: "ready",
      issues: [],
      refs: uniqueSorted(
        ready.flatMap((translation) => translation.source_refs),
      ),
    };
  }

  if (reviewed.length > 0) {
    const issue = makeIssue(
      "TRANSLATION_NEEDS_REVIEW",
      "review",
      null,
      `The ${locale} translation is marked for review and cannot be published.`,
      locale,
    );
    return {
      status: "blocked",
      issues: [issue],
      refs: uniqueSorted(
        reviewed.flatMap((translation) => translation.source_refs),
      ),
    };
  }

  const aiOnly = usable.filter((translation) =>
    normalized(translation.provider) === "ai_fallback"
  );
  if (aiOnly.length > 0) {
    const issue = makeIssue(
      "AI_ONLY_TRANSLATION",
      "provisional",
      null,
      `The ${locale} translation has AI evidence only.`,
      locale,
    );
    return {
      status: "provisional",
      issues: [issue],
      refs: uniqueSorted(
        aiOnly.flatMap((translation) => translation.source_refs),
      ),
    };
  }

  if (usable.length > 0) {
    const issue = makeIssue(
      "TRANSLATION_NOT_CANONICAL",
      "provisional",
      null,
      `The ${locale} translation is present but lacks publishable canonical evidence.`,
      locale,
    );
    return {
      status: "provisional",
      issues: [issue],
      refs: uniqueSorted(
        usable.flatMap((translation) => translation.source_refs),
      ),
    };
  }

  const issue = makeIssue(
    "TRANSLATION_MISSING",
    "blocking",
    null,
    `No usable ${locale} translation evidence exists.`,
    locale,
  );
  return { status: "blocked", issues: [issue], refs: [] };
}

function withCapability(
  issues: readonly AssessmentIssue[],
  capability: CapabilityName,
): AssessmentIssue[] {
  return issues.map((issue) => ({ ...issue, capability }));
}

function combineStatus(
  statuses: readonly CapabilityStatus[],
): CapabilityStatus {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("provisional")) return "provisional";
  if (statuses.some((status) => status === "ready")) return "ready";
  return "not_applicable";
}

function qualityStage(
  capabilities: CapabilityAssessments,
  issues: readonly AssessmentIssue[],
): QualityStage {
  const requiredCapabilities = CAPABILITY_NAMES.filter((name) =>
    name !== "lexeme360_ready"
  )
    .map((name) => capabilities[name])
    .filter((capability) => capability.status !== "not_applicable");
  if (
    requiredCapabilities.some((capability) => capability.status === "blocked")
  ) {
    return issues.some((issue) => issue.severity === "review")
      ? "needs_review"
      : "blocked";
  }
  if (
    requiredCapabilities.some((capability) =>
      capability.status === "provisional"
    )
  ) return "provisional";
  return "ready";
}

function evaluateLexeme360(snapshot: EntityEvidenceSnapshot): {
  capability: CapabilityAssessment;
  issues: AssessmentIssue[];
} {
  if (snapshot.entity_kind !== "lexeme" || snapshot.relations.length === 0) {
    return { capability: makeCapability("not_applicable"), issues: [] };
  }

  const readyRefs: string[] = [];
  let hasCandidate = false;
  for (const relation of snapshot.relations) {
    const accepted = RELATION_READY_STATUSES.has(normalized(relation.status)) &&
      !relation.needs_review && relation.source_refs.length > 0 &&
      relation.expression_id;
    if (!accepted) {
      hasCandidate = true;
      continue;
    }
    const uk = evaluateTranslation(
      snapshot,
      "uk",
      relation.translations,
      relation.expression_id,
      relation.source_refs,
    );
    const en = evaluateTranslation(
      snapshot,
      "en",
      relation.translations,
      relation.expression_id,
      relation.source_refs,
    );
    if (uk.status === "ready" && en.status === "ready") {
      readyRefs.push(...relation.source_refs, ...uk.refs, ...en.refs);
    } else {
      hasCandidate = true;
    }
  }

  if (readyRefs.length > 0) {
    return { capability: makeCapability("ready", [], readyRefs), issues: [] };
  }
  if (hasCandidate) {
    const issue = makeIssue(
      "LEXEME360_RELATION_PROVISIONAL",
      "warning",
      "lexeme360_ready",
      "Semantic-shift candidates exist, but none has complete source and bilingual expression evidence.",
    );
    return {
      capability: makeCapability("provisional", [issue]),
      issues: [issue],
    };
  }
  return { capability: makeCapability("not_applicable"), issues: [] };
}

export function evaluateCompletion(
  snapshot: EntityEvidenceSnapshot,
): EntityCompletionAssessment {
  if (snapshot.snapshot_version !== SNAPSHOT_VERSION) {
    throw new Error(
      `UNSUPPORTED_SNAPSHOT_VERSION:${snapshot.snapshot_version}`,
    );
  }
  if (!snapshot.snapshot_token.trim()) {
    throw new Error("SNAPSHOT_TOKEN_REQUIRED");
  }
  if (!snapshot.captured_at.trim()) throw new Error("CAPTURED_AT_REQUIRED");

  const issues: AssessmentIssue[] = [];
  const evidenceRefs = new Set<string>();
  const pos = normalized(snapshot.pos);
  const isFunctionWord = FUNCTION_POS.has(pos) &&
    snapshot.identity.is_learning_lexeme === false;

  let analysisStatus: CapabilityStatus = "ready";
  const analysisIssues: AssessmentIssue[] = [];
  if (snapshot.execution_state === "failed") {
    analysisStatus = "blocked";
    analysisIssues.push(
      makeIssue(
        "EXECUTION_FAILED",
        "blocking",
        "analysis_ready",
        "The source job failed.",
      ),
    );
  } else if (snapshot.execution_state === "needs_manual_review") {
    analysisStatus = "blocked";
    analysisIssues.push(makeIssue(
      "EXECUTION_NEEDS_MANUAL_REVIEW",
      "review",
      "analysis_ready",
      "The source job requires manual review.",
    ));
  } else if (snapshot.execution_state !== "completed") {
    analysisStatus = "provisional";
    analysisIssues.push(makeIssue(
      "EXECUTION_NOT_COMPLETE",
      "provisional",
      "analysis_ready",
      `The source job is ${snapshot.execution_state}.`,
    ));
  }

  if (!pos || pos === "unknown") {
    analysisStatus = "blocked";
    analysisIssues.push(
      makeIssue(
        "POS_UNKNOWN",
        "blocking",
        "analysis_ready",
        "Part of speech is unknown.",
      ),
    );
  }
  if (
    !snapshot.identity.accepted ||
    !VERIFIED_STATUSES.has(normalized(snapshot.identity.verification_status))
  ) {
    if (
      REVIEW_STATUSES.has(normalized(snapshot.identity.verification_status))
    ) {
      analysisStatus = "blocked";
      analysisIssues.push(makeIssue(
        "IDENTITY_NEEDS_REVIEW",
        "review",
        "analysis_ready",
        "Entity identity is marked for review.",
      ));
    } else if (analysisStatus !== "blocked") {
      analysisStatus = "provisional";
      analysisIssues.push(makeIssue(
        "IDENTITY_NOT_VERIFIED",
        "provisional",
        "analysis_ready",
        "Entity identity is not source-verified.",
      ));
    }
  }
  if (
    snapshot.entity_kind === "expression" &&
    snapshot.identity.expression_whole_unit_source_refs.length === 0
  ) {
    analysisStatus = "blocked";
    analysisIssues.push(makeIssue(
      "EXPRESSION_WHOLE_UNIT_EVIDENCE_MISSING",
      "blocking",
      "analysis_ready",
      "The expression lacks whole-unit source evidence.",
    ));
  }
  snapshot.identity.source_refs.forEach((ref) => evidenceRefs.add(ref));
  snapshot.identity.expression_whole_unit_source_refs.forEach((ref) =>
    evidenceRefs.add(ref)
  );
  issues.push(...analysisIssues);

  const forms = evaluateForms(snapshot);
  forms.refs.forEach((ref) => evidenceRefs.add(ref));

  const capabilities = {} as CapabilityAssessments;
  capabilities.analysis_ready = makeCapability(
    analysisStatus,
    analysisIssues,
    [
      ...snapshot.identity.source_refs,
      ...snapshot.identity.expression_whole_unit_source_refs,
    ],
  );

  for (const locale of ["uk", "en"] as const) {
    const dictionaryName: CapabilityName = `dictionary_ready_${locale}`;
    const trainingName: CapabilityName = `training_ready_${locale}`;
    if (isFunctionWord) {
      capabilities[dictionaryName] = makeCapability("not_applicable");
      capabilities[trainingName] = makeCapability("not_applicable");
      continue;
    }

    const translation = evaluateTranslation(snapshot, locale);
    const dictionaryIssues = withCapability(translation.issues, dictionaryName);
    translation.refs.forEach((ref) => evidenceRefs.add(ref));
    capabilities[dictionaryName] = makeCapability(
      translation.status,
      dictionaryIssues,
      translation.refs,
    );
    issues.push(...dictionaryIssues);

    const trainingIssues = [
      ...withCapability(analysisIssues, trainingName),
      ...withCapability(translation.issues, trainingName),
      ...withCapability(forms.issues, trainingName),
    ];
    const trainingStatus = combineStatus([
      analysisStatus,
      translation.status,
      forms.status,
    ]);
    capabilities[trainingName] = makeCapability(
      trainingStatus,
      trainingIssues,
      [
        ...translation.refs,
        ...forms.refs,
        ...snapshot.identity.source_refs,
      ],
    );
    issues.push(...withCapability(forms.issues, trainingName));
  }

  const lexeme360 = evaluateLexeme360(snapshot);
  capabilities.lexeme360_ready = lexeme360.capability;
  issues.push(...lexeme360.issues);
  lexeme360.capability.evidence_refs.forEach((ref) => evidenceRefs.add(ref));

  const deduplicatedIssues = [...new Map(
    issues.map((issue) => [
      [
        issue.code,
        issue.severity,
        issue.capability ?? "",
        issue.locale ?? "",
        issue.detail,
      ].join("\u0000"),
      issue,
    ]),
  ).values()].sort(issueSort);
  const blockers = deduplicatedIssues.filter((issue) =>
    issue.severity !== "warning"
  );
  const warnings = deduplicatedIssues.filter((issue) =>
    issue.severity === "warning"
  );

  return {
    contract_version: CONTRACT_VERSION,
    evaluator_version: EVALUATOR_VERSION,
    snapshot_version: SNAPSHOT_VERSION,
    snapshot_token: snapshot.snapshot_token,
    entity_key: snapshot.entity_key,
    entity_kind: snapshot.entity_kind,
    entity_id: snapshot.entity_id,
    lemma: snapshot.lemma,
    pos: snapshot.pos,
    item_ids: uniqueSorted(snapshot.item_ids),
    execution_state: snapshot.execution_state,
    quality_stage: qualityStage(capabilities, blockers),
    is_learning_lexeme: !isFunctionWord,
    paradigm_type: forms.paradigmType,
    capabilities,
    blockers,
    warnings,
    evidence_refs: uniqueSorted([...evidenceRefs]),
    evaluated_at: snapshot.captured_at,
  };
}

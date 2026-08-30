export const CONTRACT_VERSION = "completion-contract/v1" as const;
export const EVALUATOR_VERSION = "1.0.0" as const;
export const SNAPSHOT_VERSION = "completion-evidence-snapshot/v1" as const;

export const CAPABILITY_NAMES = [
  "analysis_ready",
  "dictionary_ready_uk",
  "dictionary_ready_en",
  "training_ready_uk",
  "training_ready_en",
  "lexeme360_ready",
] as const;

export const PARADIGM_TYPES = [
  "regular",
  "irregular",
  "suppletive",
  "defective",
  "indeclinable",
  "uncountable",
  "plural_only",
  "unknown",
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];
export type ParadigmType = (typeof PARADIGM_TYPES)[number];
export type CapabilityStatus =
  | "ready"
  | "provisional"
  | "blocked"
  | "not_applicable";
export type QualityStage = "ready" | "provisional" | "needs_review" | "blocked";
export type ExecutionState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "needs_manual_review";
export type EntityKind = "lexeme" | "expression";
export type Locale = "uk" | "en";

export interface IdentityEvidence {
  accepted: boolean;
  verification_status: string | null;
  source_refs: string[];
  expression_whole_unit_source_refs: string[];
  is_learning_lexeme: boolean | null;
  paradigm_type: ParadigmType | null;
  paradigm_source_refs: string[];
  allowed_missing_slots: string[];
}

export interface FormEvidence {
  id: string;
  form_type: string;
  normalized_form: string | null;
  is_accepted: boolean;
  needs_review: boolean;
  verification_status: string | null;
  is_irregular: boolean;
  source_refs: string[];
}

export interface TranslationEvidence {
  id: string;
  locale: Locale;
  value: string | null;
  provider: string | null;
  canonical: boolean;
  needs_review: boolean;
  source_refs: string[];
  lexeme_id: string | null;
  expression_id: string | null;
}

export interface RelationEvidence {
  id: string;
  relation_type: string;
  status: string | null;
  needs_review: boolean;
  expression_id: string | null;
  source_refs: string[];
  translations: TranslationEvidence[];
}

export interface EntityEvidenceSnapshot {
  snapshot_version: typeof SNAPSHOT_VERSION;
  snapshot_token: string;
  captured_at: string;
  entity_key: string;
  entity_kind: EntityKind;
  entity_id: string;
  lemma: string;
  pos: string | null;
  item_ids: string[];
  execution_state: ExecutionState;
  identity: IdentityEvidence;
  forms: FormEvidence[];
  translations: TranslationEvidence[];
  relations: RelationEvidence[];
}

export interface AssessmentIssue {
  code: string;
  severity: "blocking" | "review" | "provisional" | "warning";
  capability: CapabilityName | null;
  locale: Locale | null;
  detail: string;
}

export interface CapabilityAssessment {
  status: CapabilityStatus;
  issue_codes: string[];
  evidence_refs: string[];
}

export type CapabilityAssessments = Record<
  CapabilityName,
  CapabilityAssessment
>;

export interface EntityCompletionAssessment {
  contract_version: typeof CONTRACT_VERSION;
  evaluator_version: typeof EVALUATOR_VERSION;
  snapshot_version: typeof SNAPSHOT_VERSION;
  snapshot_token: string;
  entity_key: string;
  entity_kind: EntityKind;
  entity_id: string;
  lemma: string;
  pos: string | null;
  item_ids: string[];
  execution_state: ExecutionState;
  quality_stage: QualityStage;
  is_learning_lexeme: boolean;
  paradigm_type: ParadigmType | null;
  capabilities: CapabilityAssessments;
  blockers: AssessmentIssue[];
  warnings: AssessmentIssue[];
  evidence_refs: string[];
  evaluated_at: string;
}

export interface AssessmentPage {
  snapshot_token: string;
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
  assessments: EntityCompletionAssessment[];
}

export interface AggregateAssessment {
  contract_version: typeof CONTRACT_VERSION;
  snapshot_token: string;
  total_entities: number;
  learner_ready_entities: number;
  quality_counts: Record<QualityStage, number>;
  capability_counts: Record<CapabilityName, Record<CapabilityStatus, number>>;
  assessments: EntityCompletionAssessment[];
}

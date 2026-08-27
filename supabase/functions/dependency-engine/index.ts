// supabase/functions/dependency-engine/index.ts
//
// Norsk Trainer
// Dependency Engine v1.3
//
// Pipeline position:
//   Grammar Pattern Engine
//     -> Construction Resolution Engine
//     -> Predicate Builder (canonical PredicateFrame)
//     -> Clause Pattern Engine
//     -> Dependency Engine
//     -> updated Sentence Model
//     -> Language Graph Engine
//
// Responsibilities:
//   1. Accept a Sentence Model and detected clauses.
//   2. Load active dependency_sequence rules from Grammar Knowledge Base.
//   3. Match structural dependency rules without knowing Norwegian words.
//   4. Build normalized subject, object and dependency records.
//   5. Attach dependency results to a cloned Sentence Model.
//   6. Produce deterministic trace, diagnostics and summary data.
//
// Non-responsibilities:
//   - Does not tokenize text.
//   - Does not resolve surface forms.
//   - Does not select lexical candidates.
//   - Does not identify grammar constructions.
//   - Does not discover clauses.
//   - Does not contain Norwegian lexemes or language-specific conditions.
//   - Does not build visual graph nodes or edges.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

type DependencyRelation =
  | 'subject_of'
  | 'object_of'
  | 'indirect_object_of'
  | 'predicate_modifier_of'
  | 'adverbial_of'
  | 'attribute_of'
  | 'complement_of'
  | string;

type DependencyNodeKind =
  | 'token'
  | 'predicate'
  | 'predicate_head'
  | 'clause'
  | 'subject'
  | 'object';

type DependencySelectorEntity =
  | 'clause_subject'
  | 'clause_predicate'
  | 'predicate_head'
  | 'clause_object';

type SelectedCandidate = {
  token_index: number;
  surface: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  form_types: string[];
  score: number;
  base_priority: number;
  base_confidence: string | null;
  selection_status:
    | 'only_candidate'
    | 'preferred'
    | 'tied'
    | 'weak_preference';
  score_margin: number | null;
  trace: Array<Record<string, JsonValue>>;
};

type SentenceModelToken = {
  token_index: number;
  surface: string;
  normalized_surface: string;
  token_role: string | null;
  selected_candidate: SelectedCandidate | null;
  alternatives: JsonValue[];
  grammar_roles: JsonValue[];
};

type PredicateMember = {
  role: string;
  slot: string;
  token_index: number;
  surface: string;
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  form_types: string[];
};

type PredicateFrame = {
  predicate_contract_version: string;

  id: string;

  /**
   * Deprecated compatibility alias for root_construction_type.
   * Canonical consumers must use root_construction_type.
   */
  construction_type: string;

  rule_id: string;
  rule_code: string;
  token_start: number;
  token_end: number;

  head: PredicateMember;
  finite_member: PredicateMember | null;
  members: PredicateMember[];

  tense: string | null;
  aspect: string | null;
  mood: string | null;
  voice: string | null;

  confidence: number;
  priority: number;

  explanations: Record<string, JsonValue>;

  /**
   * Raw snapshot of the root Grammar Rule result only.
   * It is not a construction provenance source.
   */
  source_result: Record<string, JsonValue>;

  construction_tree_root_id: string;
  construction_ids: string[];

  root_construction_type: string;
  semantic_construction_id: string;
  semantic_construction_type: string;
  construction_tree_depth: number;
};

type SubjectBinding = {
  token_index: number;
  surface: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
};

type ClauseObject = {
  id: string;
  clause_type: string;
  rule_id: string;
  rule_code: string;
  token_start: number;
  token_end: number;
  subject: SubjectBinding;
  predicate_id: string;
  confidence: number;
  priority: number;
  explanations: Record<string, JsonValue>;
  source_result: Record<string, JsonValue>;
};

type SentenceModel = {
  model_version: string;
  text: string | null;
  tokens: SentenceModelToken[];
  predicates: PredicateFrame[];
  clauses: JsonValue[];
  dependencies: JsonValue[];
  subjects: JsonValue[];
  objects: JsonValue[];
  diagnostics: JsonValue[];
  summary: Record<string, JsonValue>;
};

type DependencySelector = {
  entity: DependencySelectorEntity;
  required?: boolean;
  role?: string;
};

type DependencySequencePattern = {
  source: DependencySelector;
  target: DependencySelector;
  relation?: DependencyRelation;
  clause_type?: string;
  predicate_construction_type?: string;
  require_same_clause?: boolean;
};

type DependencyRule = {
  id: string;
  code: string;
  category: string;
  subcategory: string | null;
  rule_type: string;
  pattern_type: 'dependency_sequence';
  pattern: DependencySequencePattern;
  result: Record<string, JsonValue>;
  parser_actions: JsonValue[];
  learning_explanation: Record<string, JsonValue>;
  priority: number;
  base_confidence: number;
  version: number;
  source: 'grammar_kb' | 'structural_fallback';
};

type DependencyNode = {
  id: string;
  kind: DependencyNodeKind;
  token_index: number | null;
  surface: string | null;
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  predicate_id: string | null;
  clause_id: string | null;
  metadata: Record<string, JsonValue>;
};

type DependencyEdge = {
  id: string;
  relation: DependencyRelation;
  source_node_id: string;
  target_node_id: string;
  clause_id: string;
  predicate_id: string;
  rule_id: string;
  rule_code: string;
  confidence: number;
  priority: number;
  metadata: Record<string, JsonValue>;
};

type Dependency = DependencyEdge & {
  source: DependencyNode;
  target: DependencyNode;
};

type SubjectReference = {
  id: string;
  clause_id: string;
  predicate_id: string;
  dependency_id: string;
  token_index: number;
  surface: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  confidence: number;
  rule_id: string;
  rule_code: string;
};

type ObjectReference = {
  id: string;
  clause_id: string;
  predicate_id: string;
  dependency_id: string;
  token_index: number;
  surface: string;
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  confidence: number;
  rule_id: string;
  rule_code: string;
};

type DependencyBinding = {
  selector: DependencySelector;
  node: DependencyNode;
};

type DependencyMatch = {
  matched: true;
  rule_id: string;
  rule_code: string;
  rule_source: DependencyRule['source'];
  pattern_type: 'dependency_sequence';
  relation: DependencyRelation;
  clause_id: string;
  predicate_id: string;
  source: DependencyBinding;
  target: DependencyBinding;
  confidence: number;
  priority: number;
  result: Record<string, JsonValue>;
  explanations: Record<string, JsonValue>;
  trace: Array<Record<string, JsonValue>>;
};

type DependencyTraceEntry = {
  sequence: number;
  stage:
    | 'request_validation'
    | 'rule_loading'
    | 'rule_matching'
    | 'dependency_building'
    | 'deduplication'
    | 'model_update'
    | 'completion';
  status: 'started' | 'matched' | 'created' | 'skipped' | 'warning' | 'completed';
  code: string;
  message: string;
  rule_code: string | null;
  clause_id: string | null;
  predicate_id: string | null;
  dependency_id: string | null;
  metadata: Record<string, JsonValue>;
};

type DependencyDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  clause_id?: string;
  predicate_id?: string;
  rule_code?: string;
  metadata?: Record<string, JsonValue>;
};

type DependencyEngineRequest = {
  sentence_model: SentenceModel;
  clauses?: ClauseObject[];
  ruleCodes?: string[];
  dryRun?: boolean;
  includeTrace?: boolean;
  strictValidation?: boolean;
  allowStructuralFallback?: boolean;
};

type DependencySummary = {
  input_token_count: number;
  input_predicate_count: number;
  input_clause_count: number;
  database_rule_count: number;
  fallback_rule_count: number;
  evaluated_rule_count: number;
  match_count: number;
  dependency_count: number;
  subject_count: number;
  object_count: number;
  duplicate_dependency_count: number;
  skipped_clause_count: number;
  warning_count: number;
  error_count: number;
  dry_run: boolean;
};

const ENGINE_VERSION = 'dependency-engine-v1.3';
const SENTENCE_MODEL_VERSION = 'sentence-model-v1.0';

const PREDICATE_CONTRACT_VERSION = 'predicate-frame-v1.0';
const DEPENDENCY_CONTRACT_VERSION = 'dependency-frame-v1.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const STRUCTURAL_SUBJECT_RULE: DependencyRule = {
  id: 'structural:clause-subject-of-predicate',
  code: 'dependency.structural.clause_subject.subject_of.predicate',
  category: 'dependency',
  subcategory: 'subject',
  rule_type: 'clause',
  pattern_type: 'dependency_sequence',
  pattern: {
    source: {
      entity: 'clause_subject',
      required: true,
    },
    target: {
      entity: 'clause_predicate',
      required: true,
    },
    relation: 'subject_of',
    require_same_clause: true,
  },
  result: {
    dependency_type: 'subject_of',
    source_role: 'subject',
    target_role: 'predicate',
  },
  parser_actions: [],
  learning_explanation: {},
  priority: 0,
  base_confidence: 1,
  version: 1,
  source: 'structural_fallback',
};

class RequestValidationError extends Error {
  status = 400;
  details: Record<string, JsonValue> | null;

  constructor(
    message: string,
    details: Record<string, JsonValue> | null = null,
  ) {
    super(message);
    this.name = 'RequestValidationError';
    this.details = details;
  }
}

class DependencyEngineError extends Error {
  code: string;
  details: Record<string, JsonValue> | null;

  constructor(
    code: string,
    message: string,
    details: Record<string, JsonValue> | null = null,
  ) {
    super(message);
    this.name = 'DependencyEngineError';
    this.code = code;
    this.details = details;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value);
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase('nb-NO');
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function jsonObjectValue(value: unknown): Record<string, JsonValue> {
  return isJsonObject(value) ? value : {};
}

function jsonArrayValue(value: unknown): JsonValue[] {
  return Array.isArray(value) ? value as JsonValue[] : [];
}

function stableIdPart(value: string | number | null | undefined): string {
  return String(value ?? 'null')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, '_');
}

/**
 * Sentence Model entity IDs are raw stable IDs without a graph namespace.
 * Language Graph Engine is solely responsible for projecting them to:
 *   subject:<rawId>
 *   object:<rawId>
 *
 * Graph-addressable dependency endpoints remain explicitly namespaced in
 * source_node_id / target_node_id, for example token:0 or predicate:<id>.
 */
function createEntityReferenceId(
  clauseId: string,
  tokenIndex: number,
): string {
  return [
    stableIdPart(clauseId),
    stableIdPart(tokenIndex),
  ].join(':');
}

function createTraceCollector(enabled: boolean) {
  const entries: DependencyTraceEntry[] = [];
  let sequence = 0;

  return {
    push(
      entry: Omit<DependencyTraceEntry, 'sequence'>,
    ): void {
      if (!enabled) return;
      sequence += 1;
      entries.push({ sequence, ...entry });
    },
    entries,
  };
}

function appendDiagnostic(
  diagnostics: DependencyDiagnostic[],
  diagnostic: DependencyDiagnostic,
): void {
  diagnostics.push(diagnostic);
}

function cloneSentenceModel(model: SentenceModel): SentenceModel {
  return {
    model_version: model.model_version || SENTENCE_MODEL_VERSION,
    text: model.text ?? null,
    tokens: model.tokens.map((token) => ({
      ...token,
      alternatives: [...(token.alternatives ?? [])],
      grammar_roles: [...(token.grammar_roles ?? [])],
      selected_candidate: token.selected_candidate
        ? {
            ...token.selected_candidate,
            form_types: [...(token.selected_candidate.form_types ?? [])],
            trace: [...(token.selected_candidate.trace ?? [])],
          }
        : null,
    })),
    predicates: model.predicates.map((predicate) => ({
      ...predicate,
      predicate_contract_version:
        predicate.predicate_contract_version,
      head: {
        ...predicate.head,
        form_types: [...(predicate.head.form_types ?? [])],
      },
      finite_member: predicate.finite_member
        ? {
            ...predicate.finite_member,
            form_types: [...(predicate.finite_member.form_types ?? [])],
          }
        : null,
      members: predicate.members.map((member) => ({
        ...member,
        form_types: [...(member.form_types ?? [])],
      })),
      explanations: { ...(predicate.explanations ?? {}) },
      source_result: { ...(predicate.source_result ?? {}) },
      construction_ids: [...(predicate.construction_ids ?? [])],
    })),
    clauses: [...(model.clauses ?? [])],
    dependencies: [...(model.dependencies ?? [])],
    subjects: [...(model.subjects ?? [])],
    objects: [...(model.objects ?? [])],
    diagnostics: [...(model.diagnostics ?? [])],
    summary: { ...(model.summary ?? {}) },
  };
}

function validateSelectedCandidate(
  value: unknown,
  tokenIndex: number,
): asserts value is SelectedCandidate | null {
  if (value === null) return;
  if (!isRecord(value)) {
    throw new RequestValidationError(
      `sentence_model.tokens[${tokenIndex}].selected_candidate must be an object or null.`,
    );
  }

  if (
    typeof value.lexeme_id !== 'string' ||
    typeof value.lemma !== 'string' ||
    typeof value.pos !== 'string'
  ) {
    throw new RequestValidationError(
      `sentence_model.tokens[${tokenIndex}].selected_candidate is incomplete.`,
    );
  }
}

function validateSentenceModelToken(
  value: unknown,
  position: number,
): asserts value is SentenceModelToken {
  if (!isRecord(value)) {
    throw new RequestValidationError(
      `sentence_model.tokens[${position}] must be an object.`,
    );
  }

  if (
    typeof value.token_index !== 'number' ||
    !Number.isInteger(value.token_index) ||
    value.token_index < 0
  ) {
    throw new RequestValidationError(
      `sentence_model.tokens[${position}].token_index must be a non-negative integer.`,
    );
  }

  if (
    typeof value.surface !== 'string' ||
    typeof value.normalized_surface !== 'string'
  ) {
    throw new RequestValidationError(
      `sentence_model.tokens[${position}] must contain surface and normalized_surface.`,
    );
  }

  validateSelectedCandidate(value.selected_candidate, position);
}

function validatePredicateMember(
  value: unknown,
  path: string,
): asserts value is PredicateMember {
  if (!isRecord(value)) {
    throw new RequestValidationError(`${path} must be an object.`);
  }

  if (
    typeof value.role !== 'string' ||
    typeof value.slot !== 'string' ||
    typeof value.token_index !== 'number' ||
    typeof value.surface !== 'string'
  ) {
    throw new RequestValidationError(
      `${path} must contain role, slot, token_index and surface.`,
    );
  }
}

function validatePredicateFrame(
  value: unknown,
  position: number,
): asserts value is PredicateFrame {
  const path = `sentence_model.predicates[${position}]`;

  if (!isRecord(value)) {
    throw new RequestValidationError(`${path} must be an object.`);
  }

  if (
    typeof value.predicate_contract_version !== 'string' ||
    !value.predicate_contract_version.trim()
  ) {
    throw new RequestValidationError(
      `${path}.predicate_contract_version must be a non-empty string.`,
    );
  }

  if (
    value.predicate_contract_version !==
    PREDICATE_CONTRACT_VERSION
  ) {
    throw new RequestValidationError(
      `${path}.predicate_contract_version "${value.predicate_contract_version}" is not supported; expected "${PREDICATE_CONTRACT_VERSION}".`,
    );
  }

  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.construction_type !== 'string' ||
    typeof value.token_start !== 'number' ||
    typeof value.token_end !== 'number'
  ) {
    throw new RequestValidationError(
      `${path} must contain id, construction_type, token_start and token_end.`,
    );
  }

  validatePredicateMember(value.head, `${path}.head`);

  if (value.finite_member !== null && value.finite_member !== undefined) {
    validatePredicateMember(value.finite_member, `${path}.finite_member`);
  }

  if (!Array.isArray(value.members)) {
    throw new RequestValidationError(`${path}.members must be an array.`);
  }

  value.members.forEach((member, memberIndex) =>
    validatePredicateMember(member, `${path}.members[${memberIndex}]`)
  );

  if (
    typeof value.construction_tree_root_id !== 'string' ||
    !value.construction_tree_root_id.trim()
  ) {
    throw new RequestValidationError(
      `${path}.construction_tree_root_id must be a non-empty string.`,
    );
  }

  if (
    !Array.isArray(value.construction_ids) ||
    value.construction_ids.some(
      (item) => typeof item !== 'string' || !item.trim(),
    )
  ) {
    throw new RequestValidationError(
      `${path}.construction_ids must be an array of non-empty strings.`,
    );
  }

  if (
    value.construction_ids.length === 0 ||
    value.construction_ids[0] !==
      value.construction_tree_root_id
  ) {
    throw new RequestValidationError(
      `${path}.construction_ids[0] must equal construction_tree_root_id.`,
    );
  }

  if (
    new Set(value.construction_ids).size !==
    value.construction_ids.length
  ) {
    throw new RequestValidationError(
      `${path}.construction_ids must not contain duplicates.`,
    );
  }

  if (
    typeof value.root_construction_type !== 'string' ||
    !value.root_construction_type.trim()
  ) {
    throw new RequestValidationError(
      `${path}.root_construction_type must be a non-empty string.`,
    );
  }

  if (
    typeof value.semantic_construction_id !== 'string' ||
    !value.semantic_construction_id.trim() ||
    !value.construction_ids.includes(
      value.semantic_construction_id,
    )
  ) {
    throw new RequestValidationError(
      `${path}.semantic_construction_id must be present in construction_ids.`,
    );
  }

  if (
    typeof value.semantic_construction_type !== 'string' ||
    !value.semantic_construction_type.trim()
  ) {
    throw new RequestValidationError(
      `${path}.semantic_construction_type must be a non-empty string.`,
    );
  }

  if (
    typeof value.construction_tree_depth !== 'number' ||
    !Number.isInteger(value.construction_tree_depth) ||
    value.construction_tree_depth < 0
  ) {
    throw new RequestValidationError(
      `${path}.construction_tree_depth must be a non-negative integer.`,
    );
  }

  if (
    value.construction_type !==
    value.root_construction_type
  ) {
    throw new RequestValidationError(
      `${path}.construction_type must match root_construction_type while the compatibility alias is retained.`,
    );
  }

  const headMember = value.members.find(
    (member) =>
      member.token_index === value.head.token_index &&
      member.slot === value.head.slot,
  );

  if (!headMember) {
    throw new RequestValidationError(
      `${path}.head must correspond to one of predicate.members.`,
    );
  }

  if (headMember.role !== value.head.role) {
    throw new RequestValidationError(
      `${path}.head.role must match the corresponding members[].role.`,
    );
  }

  if (value.finite_member) {
    const finiteMember = value.members.find(
      (member) =>
        member.token_index ===
          value.finite_member?.token_index &&
        member.slot === value.finite_member?.slot,
    );

    if (!finiteMember) {
      throw new RequestValidationError(
        `${path}.finite_member must correspond to one of predicate.members.`,
      );
    }

    if (
      finiteMember.role !==
      value.finite_member.role
    ) {
      throw new RequestValidationError(
        `${path}.finite_member.role must match the corresponding members[].role.`,
      );
    }
  }
}

function validateSentenceModel(value: unknown): asserts value is SentenceModel {
  if (!isRecord(value)) {
    throw new RequestValidationError('sentence_model must be an object.');
  }

  if (!Array.isArray(value.tokens)) {
    throw new RequestValidationError('sentence_model.tokens must be an array.');
  }

  if (!Array.isArray(value.predicates)) {
    throw new RequestValidationError('sentence_model.predicates must be an array.');
  }

  value.tokens.forEach(validateSentenceModelToken);
  value.predicates.forEach(validatePredicateFrame);

  const tokenIndexes = new Set<number>();
  for (const token of value.tokens) {
    if (tokenIndexes.has(token.token_index)) {
      throw new RequestValidationError(
        `sentence_model contains duplicate token_index ${token.token_index}.`,
      );
    }
    tokenIndexes.add(token.token_index);
  }

  const predicateIds = new Set<string>();
  for (const predicate of value.predicates) {
    if (predicateIds.has(predicate.id)) {
      throw new RequestValidationError(
        `sentence_model contains duplicate predicate id "${predicate.id}".`,
      );
    }
    predicateIds.add(predicate.id);
  }
}

function validateSubjectBinding(
  value: unknown,
  path: string,
): asserts value is SubjectBinding {
  if (!isRecord(value)) {
    throw new RequestValidationError(`${path} must be an object.`);
  }

  if (
    typeof value.token_index !== 'number' ||
    !Number.isInteger(value.token_index) ||
    value.token_index < 0 ||
    typeof value.surface !== 'string' ||
    typeof value.lexeme_id !== 'string' ||
    typeof value.lemma !== 'string' ||
    typeof value.pos !== 'string'
  ) {
    throw new RequestValidationError(
      `${path} must contain token_index, surface, lexeme_id, lemma and pos.`,
    );
  }
}

function validateClauseObject(
  value: unknown,
  position: number,
): asserts value is ClauseObject {
  const path = `clauses[${position}]`;

  if (!isRecord(value)) {
    throw new RequestValidationError(`${path} must be an object.`);
  }

  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.clause_type !== 'string' ||
    typeof value.predicate_id !== 'string' ||
    !value.predicate_id.trim() ||
    typeof value.token_start !== 'number' ||
    typeof value.token_end !== 'number'
  ) {
    throw new RequestValidationError(
      `${path} must contain id, clause_type, predicate_id, token_start and token_end.`,
    );
  }

  validateSubjectBinding(value.subject, `${path}.subject`);
}

function parseClausesFromSentenceModel(model: SentenceModel): ClauseObject[] {
  const parsed: ClauseObject[] = [];

  for (let index = 0; index < model.clauses.length; index += 1) {
    const value = model.clauses[index];
    validateClauseObject(value, index);
    parsed.push(value);
  }

  return parsed;
}

function validateRequest(body: unknown): DependencyEngineRequest {
  if (!isRecord(body)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }

  validateSentenceModel(body.sentence_model);

  if (body.clauses !== undefined && !Array.isArray(body.clauses)) {
    throw new RequestValidationError('clauses must be an array when provided.');
  }

  const explicitClauses: ClauseObject[] | undefined = Array.isArray(body.clauses)
    ? body.clauses.map((clause, index) => {
        validateClauseObject(clause, index);
        return clause;
      })
    : undefined;

  if (
    body.ruleCodes !== undefined &&
    (
      !Array.isArray(body.ruleCodes) ||
      body.ruleCodes.some((item) => typeof item !== 'string' || !item.trim())
    )
  ) {
    throw new RequestValidationError(
      'ruleCodes must be an array of non-empty strings.',
    );
  }

  for (const property of [
    'dryRun',
    'includeTrace',
    'strictValidation',
    'allowStructuralFallback',
  ]) {
    if (body[property] !== undefined && typeof body[property] !== 'boolean') {
      throw new RequestValidationError(`${property} must be a boolean.`);
    }
  }

  return {
    sentence_model: body.sentence_model,
    clauses: explicitClauses,
    ruleCodes: Array.isArray(body.ruleCodes)
      ? body.ruleCodes.map((code) => code.trim())
      : undefined,
    dryRun: booleanValue(body.dryRun, false),
    includeTrace: booleanValue(body.includeTrace, true),
    strictValidation: booleanValue(body.strictValidation, false),
    allowStructuralFallback: booleanValue(body.allowStructuralFallback, true),
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();

  if (!raw.trim()) {
    throw new RequestValidationError('Request body is empty.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestValidationError(
      'Request body is not valid JSON.',
      { raw_body_preview: raw.slice(0, 500) },
    );
  }
}

function normalizeSelector(value: unknown): DependencySelector | null {
  if (!isRecord(value)) return null;

  const entity = normalizeText(nullableString(value.entity));
  const allowed: DependencySelectorEntity[] = [
    'clause_subject',
    'clause_predicate',
    'predicate_head',
    'clause_object',
  ];

  if (!allowed.includes(entity as DependencySelectorEntity)) {
    return null;
  }

  return {
    entity: entity as DependencySelectorEntity,
    required: booleanValue(value.required, true),
    role: nullableString(value.role) ?? undefined,
  };
}

function normalizeDependencyRule(row: Record<string, unknown>): DependencyRule | null {
  const pattern = isRecord(row.pattern) ? row.pattern : null;
  if (!pattern) return null;

  const source = normalizeSelector(pattern.source);
  const target = normalizeSelector(pattern.target);
  if (!source || !target) return null;

  const normalizedPattern: DependencySequencePattern = {
    source,
    target,
    relation: nullableString(pattern.relation) ?? undefined,
    clause_type: nullableString(pattern.clause_type) ?? undefined,
    predicate_construction_type:
      nullableString(pattern.predicate_construction_type) ?? undefined,
    require_same_clause: booleanValue(pattern.require_same_clause, true),
  };

  return {
    id: stringValue(row.id),
    code: stringValue(row.code),
    category: stringValue(row.category, 'dependency'),
    subcategory: nullableString(row.subcategory),
    rule_type: stringValue(row.rule_type, 'clause'),
    pattern_type: 'dependency_sequence',
    pattern: normalizedPattern,
    result: jsonObjectValue(row.result),
    parser_actions: jsonArrayValue(row.parser_actions),
    learning_explanation: jsonObjectValue(row.learning_explanation),
    priority: numberValue(row.priority),
    base_confidence: numberValue(row.base_confidence, 1),
    version: numberValue(row.version, 1),
    source: 'grammar_kb',
  };
}

async function loadDependencyRules(
  supabase: ReturnType<typeof createClient>,
  ruleCodes: string[] | undefined,
): Promise<{
  rules: DependencyRule[];
  rejectedRuleCount: number;
}> {
  let query = supabase
    .from('grammar_rules')
    .select(`
      id,
      code,
      category,
      subcategory,
      rule_type,
      pattern_type,
      pattern,
      result,
      parser_actions,
      learning_explanation,
      priority,
      base_confidence,
      version
    `)
    .eq('is_active', true)
    .eq('pattern_type', 'dependency_sequence')
    .order('priority', { ascending: false });

  if (ruleCodes?.length) {
    query = query.in('code', ruleCodes);
  }

  const { data, error } = await query;

  if (error) {
    const unsupportedPatternType =
      normalizeText(error.message).includes('dependency_sequence') ||
      normalizeText(error.message).includes('check constraint');

    if (unsupportedPatternType) {
      return { rules: [], rejectedRuleCount: 0 };
    }

    throw new DependencyEngineError(
      'dependency_rule_load_failed',
      `Failed to load dependency rules: ${error.message}`,
    );
  }

  const rules: DependencyRule[] = [];
  let rejectedRuleCount = 0;

  for (const rawRow of data ?? []) {
    const normalized = normalizeDependencyRule(rawRow as Record<string, unknown>);
    if (!normalized || !normalized.id || !normalized.code) {
      rejectedRuleCount += 1;
      continue;
    }
    rules.push(normalized);
  }

  return { rules, rejectedRuleCount };
}

function relationFromRule(rule: DependencyRule): DependencyRelation {
  const resultRelation = nullableString(rule.result.dependency_type);
  const patternRelation = rule.pattern.relation;
  return resultRelation ?? patternRelation ?? 'dependency';
}

function createTokenNode(
  token: SubjectBinding,
  clause: ClauseObject,
): DependencyNode {
  return {
    id: `token:${stableIdPart(token.token_index)}`,
    kind: 'token',
    token_index: token.token_index,
    surface: token.surface,
    lexeme_id: token.lexeme_id,
    lemma: token.lemma,
    pos: token.pos,
    predicate_id: clause.predicate_id,
    clause_id: clause.id,
    metadata: {
      semantic_role: 'subject',
    },
  };
}

function predicateProvenanceMetadata(
  predicate: PredicateFrame,
): Record<string, JsonValue> {
  return {
    predicate_contract_version:
      predicate.predicate_contract_version,

    root_construction_type:
      predicate.root_construction_type,

    semantic_construction_id:
      predicate.semantic_construction_id,

    semantic_construction_type:
      predicate.semantic_construction_type,

    construction_tree_depth:
      predicate.construction_tree_depth,

    construction_tree_root_id:
      predicate.construction_tree_root_id,

    construction_ids:
      [...predicate.construction_ids],
  };
}

function createPredicateNode(
  predicate: PredicateFrame,
  clause: ClauseObject,
): DependencyNode {
  return {
    id: `predicate:${stableIdPart(predicate.id)}`,
    kind: 'predicate',
    token_index: predicate.head.token_index,
    surface: predicate.members.map((member) => member.surface).join(' '),
    lexeme_id: predicate.head.lexeme_id,
    lemma: predicate.head.lemma,
    pos: predicate.head.pos,
    predicate_id: predicate.id,
    clause_id: clause.id,
    metadata: {
      ...predicateProvenanceMetadata(predicate),

      /**
       * Deprecated compatibility alias.
       * Canonical consumers must use root_construction_type.
       */
      construction_type: predicate.root_construction_type,

      token_start: predicate.token_start,
      token_end: predicate.token_end,
      head_token_index: predicate.head.token_index,
    },
  };
}

function createPredicateHeadNode(
  predicate: PredicateFrame,
  clause: ClauseObject,
): DependencyNode {
  return {
    id: `predicate-head:${stableIdPart(predicate.id)}:${stableIdPart(predicate.head.token_index)}`,
    kind: 'predicate_head',
    token_index: predicate.head.token_index,
    surface: predicate.head.surface,
    lexeme_id: predicate.head.lexeme_id,
    lemma: predicate.head.lemma,
    pos: predicate.head.pos,
    predicate_id: predicate.id,
    clause_id: clause.id,
    metadata: {
      ...predicateProvenanceMetadata(predicate),

      /**
       * Deprecated compatibility alias.
       * Canonical consumers must use root_construction_type.
       */
      construction_type: predicate.root_construction_type,

      role: predicate.head.role,
      slot: predicate.head.slot,
    },
  };
}

function resolveSelector(
  selector: DependencySelector,
  clause: ClauseObject,
  predicate: PredicateFrame,
): DependencyBinding | null {
  switch (selector.entity) {
    case 'clause_subject':
      return {
        selector,
        node: createTokenNode(clause.subject, clause),
      };

    case 'clause_predicate':
      return {
        selector,
        node: createPredicateNode(predicate, clause),
      };

    case 'predicate_head':
      return {
        selector,
        node: createPredicateHeadNode(predicate, clause),
      };

    case 'clause_object':
      return null;

    default:
      return null;
  }
}

function clauseMatchesRule(
  clause: ClauseObject,
  predicate: PredicateFrame,
  rule: DependencyRule,
): boolean {
  const requiredClauseType = normalizeText(rule.pattern.clause_type);
  if (
    requiredClauseType &&
    normalizeText(clause.clause_type) !== requiredClauseType
  ) {
    return false;
  }

  const requiredConstructionType = normalizeText(
    rule.pattern.predicate_construction_type,
  );

  if (
    requiredConstructionType &&
    normalizeText(predicate.root_construction_type) !==
      requiredConstructionType
  ) {
    return false;
  }

  return true;
}

function matchDependencyRule(
  sentenceModel: SentenceModel,
  clauses: ClauseObject[],
  rule: DependencyRule,
  diagnostics: DependencyDiagnostic[],
): DependencyMatch[] {
  const matches: DependencyMatch[] = [];
  const predicateById = new Map(
    sentenceModel.predicates.map((predicate) => [predicate.id, predicate]),
  );

  for (const clause of clauses) {
    const predicate = predicateById.get(clause.predicate_id);

    if (!predicate) {
      appendDiagnostic(diagnostics, {
        severity: 'warning',
        code: 'clause_predicate_not_found',
        message:
          `Clause "${clause.id}" references missing predicate "${clause.predicate_id}".`,
        clause_id: clause.id,
        predicate_id: clause.predicate_id,
        rule_code: rule.code,
      });
      continue;
    }

    if (!clauseMatchesRule(clause, predicate, rule)) {
      continue;
    }

    const source = resolveSelector(rule.pattern.source, clause, predicate);
    const target = resolveSelector(rule.pattern.target, clause, predicate);

    if (!source && rule.pattern.source.required !== false) {
      appendDiagnostic(diagnostics, {
        severity: 'warning',
        code: 'required_dependency_source_missing',
        message:
          `Rule "${rule.code}" could not resolve source selector "${rule.pattern.source.entity}".`,
        clause_id: clause.id,
        predicate_id: predicate.id,
        rule_code: rule.code,
      });
      continue;
    }

    if (!target && rule.pattern.target.required !== false) {
      appendDiagnostic(diagnostics, {
        severity: 'warning',
        code: 'required_dependency_target_missing',
        message:
          `Rule "${rule.code}" could not resolve target selector "${rule.pattern.target.entity}".`,
        clause_id: clause.id,
        predicate_id: predicate.id,
        rule_code: rule.code,
      });
      continue;
    }

    if (!source || !target) continue;

    if (
      rule.pattern.require_same_clause !== false &&
      source.node.clause_id !== target.node.clause_id
    ) {
      appendDiagnostic(diagnostics, {
        severity: 'warning',
        code: 'dependency_nodes_cross_clause',
        message:
          `Rule "${rule.code}" resolved nodes from different clauses.`,
        clause_id: clause.id,
        predicate_id: predicate.id,
        rule_code: rule.code,
      });
      continue;
    }

    matches.push({
      matched: true,
      rule_id: rule.id,
      rule_code: rule.code,
      rule_source: rule.source,
      pattern_type: 'dependency_sequence',
      relation: relationFromRule(rule),
      clause_id: clause.id,
      predicate_id: predicate.id,
      source,
      target,
      confidence: Math.min(
        numberValue(rule.base_confidence, 1),
        numberValue(clause.confidence, 1),
        numberValue(predicate.confidence, 1),
      ),
      priority: Math.max(
        numberValue(rule.priority),
        numberValue(clause.priority),
        numberValue(predicate.priority),
      ),
      result: rule.result,
      explanations: rule.learning_explanation,
      trace: [
        {
          type: 'clause_match',
          clause_id: clause.id,
          clause_type: clause.clause_type,
          predicate_id: predicate.id,
        },
        {
          type: 'source_selector_match',
          selector: rule.pattern.source.entity,
          node_id: source.node.id,
          node_kind: source.node.kind,
        },
        {
          type: 'target_selector_match',
          selector: rule.pattern.target.entity,
          node_id: target.node.id,
          node_kind: target.node.kind,
        },
      ],
    });
  }

  return matches;
}

function createDependency(match: DependencyMatch): Dependency {
  const dependencyId = [
    'dependency',
    stableIdPart(match.relation),
    stableIdPart(match.clause_id),
    stableIdPart(match.source.node.id),
    stableIdPart(match.target.node.id),
  ].join(':');

  return {
    id: dependencyId,
    relation: match.relation,
    source_node_id: match.source.node.id,
    target_node_id: match.target.node.id,
    clause_id: match.clause_id,
    predicate_id: match.predicate_id,
    rule_id: match.rule_id,
    rule_code: match.rule_code,
    confidence: match.confidence,
    priority: match.priority,
    metadata: {
      rule_source: match.rule_source,
      source_selector: match.source.selector.entity,
      target_selector: match.target.selector.entity,
      explanations: match.explanations,
      source_result: match.result,
    },
    source: match.source.node,
    target: match.target.node,
  };
}

function dependencyIdentity(dependency: Dependency): string {
  return [
    normalizeText(dependency.relation),
    dependency.clause_id,
    dependency.source_node_id,
    dependency.target_node_id,
  ].join('::');
}

function compareDependencies(left: Dependency, right: Dependency): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }

  const clauseDifference = left.clause_id.localeCompare(right.clause_id);
  if (clauseDifference !== 0) return clauseDifference;

  return left.id.localeCompare(right.id);
}

function deduplicateDependencies(
  dependencies: Dependency[],
): {
  dependencies: Dependency[];
  duplicateCount: number;
} {
  const ordered = [...dependencies].sort(compareDependencies);
  const unique = new Map<string, Dependency>();
  let duplicateCount = 0;

  for (const dependency of ordered) {
    const identity = dependencyIdentity(dependency);
    if (unique.has(identity)) {
      duplicateCount += 1;
      continue;
    }
    unique.set(identity, dependency);
  }

  return {
    dependencies: [...unique.values()].sort(compareDependencies),
    duplicateCount,
  };
}

function subjectFromDependency(dependency: Dependency): SubjectReference | null {
  if (normalizeText(dependency.relation) !== 'subject_of') return null;
  if (dependency.source.token_index === null) return null;
  if (!dependency.source.surface) return null;
  if (!dependency.source.lexeme_id) return null;
  if (!dependency.source.lemma) return null;
  if (!dependency.source.pos) return null;

  return {
    id: createEntityReferenceId(
      dependency.clause_id,
      dependency.source.token_index,
    ),
    clause_id: dependency.clause_id,
    predicate_id: dependency.predicate_id,
    dependency_id: dependency.id,
    token_index: dependency.source.token_index,
    surface: dependency.source.surface,
    lexeme_id: dependency.source.lexeme_id,
    lemma: dependency.source.lemma,
    pos: dependency.source.pos,
    confidence: dependency.confidence,
    rule_id: dependency.rule_id,
    rule_code: dependency.rule_code,
  };
}

function objectFromDependency(dependency: Dependency): ObjectReference | null {
  if (normalizeText(dependency.relation) !== 'object_of') return null;
  if (dependency.source.token_index === null) return null;
  if (!dependency.source.surface) return null;

  return {
    id: createEntityReferenceId(
      dependency.clause_id,
      dependency.source.token_index,
    ),
    clause_id: dependency.clause_id,
    predicate_id: dependency.predicate_id,
    dependency_id: dependency.id,
    token_index: dependency.source.token_index,
    surface: dependency.source.surface,
    lexeme_id: dependency.source.lexeme_id,
    lemma: dependency.source.lemma,
    pos: dependency.source.pos,
    confidence: dependency.confidence,
    rule_id: dependency.rule_id,
    rule_code: dependency.rule_code,
  };
}

function buildSubjects(dependencies: Dependency[]): SubjectReference[] {
  const subjects = dependencies
    .map(subjectFromDependency)
    .filter((item): item is SubjectReference => item !== null);

  const unique = new Map<string, SubjectReference>();
  for (const subject of subjects) {
    const key = `${subject.clause_id}::${subject.token_index}::${subject.predicate_id}`;
    const existing = unique.get(key);
    if (!existing || subject.confidence > existing.confidence) {
      unique.set(key, subject);
    }
  }

  return [...unique.values()].sort((left, right) => {
    if (left.token_index !== right.token_index) {
      return left.token_index - right.token_index;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildObjects(dependencies: Dependency[]): ObjectReference[] {
  const objects = dependencies
    .map(objectFromDependency)
    .filter((item): item is ObjectReference => item !== null);

  const unique = new Map<string, ObjectReference>();
  for (const object of objects) {
    const key = `${object.clause_id}::${object.token_index}::${object.predicate_id}`;
    const existing = unique.get(key);
    if (!existing || object.confidence > existing.confidence) {
      unique.set(key, object);
    }
  }

  return [...unique.values()].sort((left, right) => {
    if (left.token_index !== right.token_index) {
      return left.token_index - right.token_index;
    }
    return left.id.localeCompare(right.id);
  });
}

function appendDependencyRolesToTokens(
  sentenceModel: SentenceModel,
  dependencies: Dependency[],
): void {
  const tokenByIndex = new Map(
    sentenceModel.tokens.map((token) => [token.token_index, token]),
  );

  for (const dependency of dependencies) {
    const sourceTokenIndex = dependency.source.token_index;
    if (sourceTokenIndex === null) continue;

    const token = tokenByIndex.get(sourceTokenIndex);
    if (!token) continue;

    const role = {
      dependency_id: dependency.id,
      relation: dependency.relation,
      clause_id: dependency.clause_id,
      predicate_id: dependency.predicate_id,
      target_node_id: dependency.target_node_id,
      rule_code: dependency.rule_code,
    };

    const alreadyPresent = token.grammar_roles.some((existing) => {
      if (!isJsonObject(existing)) return false;
      return existing.dependency_id === dependency.id;
    });

    if (!alreadyPresent) {
      token.grammar_roles.push(role);
    }
  }
}

function mergeDiagnosticsIntoModel(
  model: SentenceModel,
  diagnostics: DependencyDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    model.diagnostics.push({
      engine: ENGINE_VERSION,
      ...diagnostic,
    });
  }
}

function updateSentenceModel(
  inputModel: SentenceModel,
  clauses: ClauseObject[],
  dependencies: Dependency[],
  subjects: SubjectReference[],
  objects: ObjectReference[],
  diagnostics: DependencyDiagnostic[],
  summary: DependencySummary,
): SentenceModel {
  const model = cloneSentenceModel(inputModel);

  model.clauses = clauses as unknown as JsonValue[];
  model.dependencies = dependencies as unknown as JsonValue[];
  model.subjects = subjects as unknown as JsonValue[];
  model.objects = objects as unknown as JsonValue[];

  appendDependencyRolesToTokens(model, dependencies);
  mergeDiagnosticsIntoModel(model, diagnostics);

  model.summary = {
    ...model.summary,
    clause_count: clauses.length,
    dependency_count: dependencies.length,
    subject_count: subjects.length,
    object_count: objects.length,
    dependency_warning_count: summary.warning_count,
    dependency_error_count: summary.error_count,
    dependency_engine_version: ENGINE_VERSION,
    predicate_contract_version:
      PREDICATE_CONTRACT_VERSION,
    dependency_contract_version:
      DEPENDENCY_CONTRACT_VERSION,
  };

  return model;
}

function collectStructuralDiagnostics(
  model: SentenceModel,
  clauses: ClauseObject[],
  strictValidation: boolean,
): DependencyDiagnostic[] {
  const diagnostics: DependencyDiagnostic[] = [];
  const tokenByIndex = new Map(model.tokens.map((token) => [token.token_index, token]));
  const predicateById = new Map(model.predicates.map((predicate) => [predicate.id, predicate]));
  const clauseIds = new Set<string>();

  for (const clause of clauses) {
    if (clauseIds.has(clause.id)) {
      const diagnostic: DependencyDiagnostic = {
        severity: strictValidation ? 'error' : 'warning',
        code: 'duplicate_clause_id',
        message: `Duplicate clause id "${clause.id}".`,
        clause_id: clause.id,
      };
      diagnostics.push(diagnostic);
    }
    clauseIds.add(clause.id);

    if (!predicateById.has(clause.predicate_id)) {
      diagnostics.push({
        severity: strictValidation ? 'error' : 'warning',
        code: 'missing_clause_predicate',
        message:
          `Clause "${clause.id}" references missing predicate "${clause.predicate_id}".`,
        clause_id: clause.id,
        predicate_id: clause.predicate_id,
      });
    }

    const token = tokenByIndex.get(clause.subject.token_index);
    if (!token) {
      diagnostics.push({
        severity: strictValidation ? 'error' : 'warning',
        code: 'missing_clause_subject_token',
        message:
          `Clause "${clause.id}" references missing subject token index ${clause.subject.token_index}.`,
        clause_id: clause.id,
      });
      continue;
    }

    const selected = token.selected_candidate;
    if (
      selected &&
      selected.lexeme_id !== clause.subject.lexeme_id
    ) {
      diagnostics.push({
        severity: 'warning',
        code: 'clause_subject_candidate_mismatch',
        message:
          `Clause subject lexeme differs from selected candidate at token ${clause.subject.token_index}.`,
        clause_id: clause.id,
        metadata: {
          clause_lexeme_id: clause.subject.lexeme_id,
          selected_lexeme_id: selected.lexeme_id,
        },
      });
    }
  }

  return diagnostics;
}

function assertNoStrictValidationErrors(
  diagnostics: DependencyDiagnostic[],
): void {
  const errors = diagnostics.filter((item) => item.severity === 'error');
  if (!errors.length) return;

  throw new DependencyEngineError(
    'strict_dependency_validation_failed',
    `Dependency validation failed with ${errors.length} error(s).`,
    {
      errors: errors as unknown as JsonValue,
    },
  );
}

function createSummary(
  request: DependencyEngineRequest,
  clauses: ClauseObject[],
  databaseRuleCount: number,
  fallbackRuleCount: number,
  evaluatedRuleCount: number,
  matchCount: number,
  dependencyCount: number,
  subjectCount: number,
  objectCount: number,
  duplicateDependencyCount: number,
  diagnostics: DependencyDiagnostic[],
): DependencySummary {
  const predicateIds = new Set(
    request.sentence_model.predicates.map((predicate) => predicate.id),
  );

  const skippedClauseCount = clauses.filter(
    (clause) => !predicateIds.has(clause.predicate_id),
  ).length;

  return {
    input_token_count: request.sentence_model.tokens.length,
    input_predicate_count: request.sentence_model.predicates.length,
    input_clause_count: clauses.length,
    database_rule_count: databaseRuleCount,
    fallback_rule_count: fallbackRuleCount,
    evaluated_rule_count: evaluatedRuleCount,
    match_count: matchCount,
    dependency_count: dependencyCount,
    subject_count: subjectCount,
    object_count: objectCount,
    duplicate_dependency_count: duplicateDependencyCount,
    skipped_clause_count: skippedClauseCount,
    warning_count: diagnostics.filter((item) => item.severity === 'warning').length,
    error_count: diagnostics.filter((item) => item.severity === 'error').length,
    dry_run: request.dryRun ?? false,
  };
}

function selectRules(
  databaseRules: DependencyRule[],
  allowStructuralFallback: boolean,
): {
  rules: DependencyRule[];
  fallbackRuleCount: number;
} {
  const hasSubjectRule = databaseRules.some(
    (rule) => normalizeText(relationFromRule(rule)) === 'subject_of',
  );

  if (!allowStructuralFallback || hasSubjectRule) {
    return {
      rules: databaseRules,
      fallbackRuleCount: 0,
    };
  }

  return {
    rules: [...databaseRules, STRUCTURAL_SUBJECT_RULE],
    fallbackRuleCount: 1,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          ok: false,
          engine_version: ENGINE_VERSION,
          predicate_contract_version:
            PREDICATE_CONTRACT_VERSION,
          dependency_contract_version:
            DEPENDENCY_CONTRACT_VERSION,
          error: 'Method not allowed.',
        },
        405,
      );
    }

    const requestBody = validateRequest(await readJsonBody(request));
    const trace = createTraceCollector(requestBody.includeTrace ?? true);

    trace.push({
      stage: 'request_validation',
      status: 'completed',
      code: 'request_validated',
      message: 'Dependency Engine request passed contract validation.',
      rule_code: null,
      clause_id: null,
      predicate_id: null,
      dependency_id: null,
      metadata: {
        token_count: requestBody.sentence_model.tokens.length,
        predicate_count: requestBody.sentence_model.predicates.length,
      },
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new DependencyEngineError(
        'missing_supabase_environment',
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const clauses = requestBody.clauses ??
      parseClausesFromSentenceModel(requestBody.sentence_model);

    const structuralDiagnostics = collectStructuralDiagnostics(
      requestBody.sentence_model,
      clauses,
      requestBody.strictValidation ?? false,
    );

    if (requestBody.strictValidation) {
      assertNoStrictValidationErrors(structuralDiagnostics);
    }

    trace.push({
      stage: 'rule_loading',
      status: 'started',
      code: 'dependency_rule_loading_started',
      message: 'Loading active dependency_sequence rules.',
      rule_code: null,
      clause_id: null,
      predicate_id: null,
      dependency_id: null,
      metadata: {
        requested_rule_codes: requestBody.ruleCodes ?? [],
      },
    });

    const loaded = await loadDependencyRules(
      supabase,
      requestBody.ruleCodes,
    );

    const selected = selectRules(
      loaded.rules,
      requestBody.allowStructuralFallback ?? true,
    );

    const diagnostics: DependencyDiagnostic[] = [...structuralDiagnostics];

    if (loaded.rejectedRuleCount > 0) {
      diagnostics.push({
        severity: 'warning',
        code: 'dependency_rules_rejected',
        message:
          `${loaded.rejectedRuleCount} dependency rule(s) were rejected because their pattern contract was invalid.`,
        metadata: {
          rejected_rule_count: loaded.rejectedRuleCount,
        },
      });
    }

    if (selected.fallbackRuleCount > 0) {
      diagnostics.push({
        severity: 'info',
        code: 'structural_subject_rule_used',
        message:
          'No active subject_of dependency rule was found; the language-neutral structural fallback was used.',
      });
    }

    trace.push({
      stage: 'rule_loading',
      status: 'completed',
      code: 'dependency_rules_loaded',
      message: 'Dependency rules are ready for matching.',
      rule_code: null,
      clause_id: null,
      predicate_id: null,
      dependency_id: null,
      metadata: {
        database_rule_count: loaded.rules.length,
        fallback_rule_count: selected.fallbackRuleCount,
        rejected_rule_count: loaded.rejectedRuleCount,
      },
    });

    const matches: DependencyMatch[] = [];

    for (const rule of selected.rules) {
      trace.push({
        stage: 'rule_matching',
        status: 'started',
        code: 'dependency_rule_evaluation_started',
        message: `Evaluating dependency rule "${rule.code}".`,
        rule_code: rule.code,
        clause_id: null,
        predicate_id: null,
        dependency_id: null,
        metadata: {
          relation: relationFromRule(rule),
          rule_source: rule.source,
        },
      });

      const ruleMatches = matchDependencyRule(
        requestBody.sentence_model,
        clauses,
        rule,
        diagnostics,
      );

      matches.push(...ruleMatches);

      if (!ruleMatches.length) {
        trace.push({
          stage: 'rule_matching',
          status: 'skipped',
          code: 'dependency_rule_no_match',
          message: `Rule "${rule.code}" produced no matches.`,
          rule_code: rule.code,
          clause_id: null,
          predicate_id: null,
          dependency_id: null,
          metadata: {},
        });
      }

      for (const match of ruleMatches) {
        trace.push({
          stage: 'rule_matching',
          status: 'matched',
          code: 'dependency_rule_matched',
          message:
            `Rule "${rule.code}" matched clause "${match.clause_id}".`,
          rule_code: rule.code,
          clause_id: match.clause_id,
          predicate_id: match.predicate_id,
          dependency_id: null,
          metadata: {
            relation: match.relation,
            source_node_id: match.source.node.id,
            target_node_id: match.target.node.id,
          },
        });
      }
    }

    matches.sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return left.clause_id.localeCompare(right.clause_id);
    });

    const builtDependencies = matches.map((match) => {
      const dependency = createDependency(match);

      trace.push({
        stage: 'dependency_building',
        status: 'created',
        code: 'dependency_created',
        message:
          `Created ${dependency.relation} dependency for clause "${dependency.clause_id}".`,
        rule_code: dependency.rule_code,
        clause_id: dependency.clause_id,
        predicate_id: dependency.predicate_id,
        dependency_id: dependency.id,
        metadata: {
          source_node_id: dependency.source_node_id,
          target_node_id: dependency.target_node_id,
        },
      });

      return dependency;
    });

    const deduplicated = deduplicateDependencies(builtDependencies);

    if (deduplicated.duplicateCount > 0) {
      trace.push({
        stage: 'deduplication',
        status: 'completed',
        code: 'duplicate_dependencies_removed',
        message:
          `Removed ${deduplicated.duplicateCount} duplicate dependency record(s).`,
        rule_code: null,
        clause_id: null,
        predicate_id: null,
        dependency_id: null,
        metadata: {
          duplicate_count: deduplicated.duplicateCount,
        },
      });
    }

    const subjects = buildSubjects(deduplicated.dependencies);
    const objects = buildObjects(deduplicated.dependencies);

    const summary = createSummary(
      requestBody,
      clauses,
      loaded.rules.length,
      selected.fallbackRuleCount,
      selected.rules.length,
      matches.length,
      deduplicated.dependencies.length,
      subjects.length,
      objects.length,
      deduplicated.duplicateCount,
      diagnostics,
    );

    const projectedSentenceModel = updateSentenceModel(
      requestBody.sentence_model,
      clauses,
      deduplicated.dependencies,
      subjects,
      objects,
      diagnostics,
      summary,
    );

    trace.push({
      stage: 'model_update',
      status: 'completed',
      code: requestBody.dryRun
        ? 'sentence_model_projection_created'
        : 'sentence_model_updated',
      message: requestBody.dryRun
        ? 'Created a projected Sentence Model without persistence.'
        : 'Attached clauses, dependencies, subjects and objects to the Sentence Model.',
      rule_code: null,
      clause_id: null,
      predicate_id: null,
      dependency_id: null,
      metadata: {
        clause_count: clauses.length,
        dependency_count: deduplicated.dependencies.length,
        subject_count: subjects.length,
        object_count: objects.length,
      },
    });

    trace.push({
      stage: 'completion',
      status: 'completed',
      code: 'dependency_engine_completed',
      message: 'Dependency Engine completed successfully.',
      rule_code: null,
      clause_id: null,
      predicate_id: null,
      dependency_id: null,
      metadata: {
        dry_run: requestBody.dryRun ?? false,
      },
    });

    return jsonResponse({
      ok: true,
      engine_version: ENGINE_VERSION,
      predicate_contract_version:
        PREDICATE_CONTRACT_VERSION,
      dependency_contract_version:
        DEPENDENCY_CONTRACT_VERSION,
      dry_run: requestBody.dryRun ?? false,
      rules: selected.rules.map((rule) => ({
        id: rule.id,
        code: rule.code,
        source: rule.source,
        relation: relationFromRule(rule),
        priority: rule.priority,
        base_confidence: rule.base_confidence,
      })),
      matches,
      clauses,
      subjects,
      objects,
      dependencies: deduplicated.dependencies,
      dependency_trace: trace.entries,
      diagnostics,
      sentence_model: projectedSentenceModel,
      summary,
    });
  } catch (error) {
    const validation = error instanceof RequestValidationError;
    const engineError = error instanceof DependencyEngineError;

    console.error(
      validation
        ? '[DEPENDENCY ENGINE REQUEST ERROR]'
        : '[DEPENDENCY ENGINE ERROR]',
      error,
    );

    return jsonResponse(
      {
        ok: false,
        engine_version: ENGINE_VERSION,
        predicate_contract_version:
          PREDICATE_CONTRACT_VERSION,
        dependency_contract_version:
          DEPENDENCY_CONTRACT_VERSION,
        error: error instanceof Error ? error.message : String(error),
        error_code: engineError
          ? error.code
          : validation
            ? 'request_validation_failed'
            : 'dependency_engine_failed',
        details: engineError
          ? error.details
          : validation
            ? error.details
            : null,
      },
      validation ? validation.status : 500,
    );
  }
});
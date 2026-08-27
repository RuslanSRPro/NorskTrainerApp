// supabase/functions/grammar-interpretation-engine/index.ts
//
// Norsk Trainer
// Grammar Interpretation Engine v1.4
//
// Converts ranked tokens and grammar constructions into Sentence Model v1.
// It does not tokenize, resolve surfaces, match grammar rules, or infer
// subjects/objects/clauses that have not yet been detected.

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type LexicalCandidate = {
  lexeme_id: string;
  lemma: string;
  pos: string;
  form_types: string[];
  sources?: string[];
  evidence?: JsonValue;
  base_confidence?: string | null;
  base_priority?: number;
  score?: number;
  trace?: Array<Record<string, JsonValue>>;
};

type AnalysisToken = {
  index: number;
  surface: string;
  normalized_surface: string;
  token_role?: string | null;
  candidates: LexicalCandidate[];
};

type SlotBinding = {
  slot: string;
  token_index: number;
  surface: string;
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  form_types: string[];
  token_role: string | null;
};

type GrammarConstruction = {
  rule_id: string;
  rule_code: string;
  construction_type: string;
  token_start: number;
  token_end: number;
  confidence: number;
  priority: number;
  slot_bindings: Record<string, SlotBinding>;
  result: Record<string, JsonValue>;
  explanations: Record<string, JsonValue>;
};

type CompositionLink = {
  parent_construction_id: string;
  child_construction_id: string;
  relation: string;
  shared_token_index: number | null;
};

type ConstructionTreeNode = {
  construction_id: string;
  parent_construction_id: string | null;
  child_construction_ids: string[];
  depth: number;
  relation_from_parent: string | null;
  shared_token_index: number | null;
};

type ConstructionTree = {
  root_construction_ids: string[];
  nodes: ConstructionTreeNode[];
  max_depth: number;
};

type ConstructionModel = {
  model_version: string;
  constructions: GrammarConstruction[];
  root_construction_ids: string[];
  composition_links: CompositionLink[];
  construction_tree?: ConstructionTree;
};

type InterpretationRequest = {
  text?: string;
  tokens: AnalysisToken[];
  constructions: GrammarConstruction[];
  construction_model?: ConstructionModel;
  selectionMargin?: number;
};

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
  selection_basis:
    | 'only_candidate'
    | 'score'
    | 'base_priority'
    | 'base_confidence'
    | 'deterministic_tiebreak'
    | 'unresolved_tie';
  score_margin: number | null;
  priority_margin: number | null;
  confidence_margin: number | null;
  trace: Array<Record<string, JsonValue>>;
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
  id: string;
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
  source_result: Record<string, JsonValue>;
};

type InterpretationDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  token_index?: number;
  rule_code?: string;
  metadata?: Record<string, JsonValue>;
};

const INTERPRETER_VERSION = 'grammar-interpretation-engine-v1.4';
const SENTENCE_MODEL_VERSION = 'sentence-model-v1.1';
const DEFAULT_SELECTION_MARGIN = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

class RequestValidationError extends Error {
  status = 400;
  details?: Record<string, JsonValue>;

  constructor(
    message: string,
    details?: Record<string, JsonValue>,
  ) {
    super(message);
    this.name = 'RequestValidationError';
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

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('nb-NO');
}

function numberValue(
  value: number | null | undefined,
  fallback = 0,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function confidenceRank(
  value: string | null | undefined,
): number {
  switch (normalizeText(value)) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function compareCandidates(
  left: LexicalCandidate,
  right: LexicalCandidate,
): number {
  const score =
    numberValue(right.score) - numberValue(left.score);

  if (score !== 0) return score;

  const priority =
    numberValue(right.base_priority) -
    numberValue(left.base_priority);

  if (priority !== 0) return priority;

  const confidence =
    confidenceRank(right.base_confidence) -
    confidenceRank(left.base_confidence);

  if (confidence !== 0) return confidence;

  const lemma = left.lemma.localeCompare(right.lemma, 'nb-NO');
  if (lemma !== 0) return lemma;

  return left.pos.localeCompare(right.pos, 'nb-NO');
}

function selectCandidate(
  token: AnalysisToken,
  margin: number,
): SelectedCandidate | null {
  if (!token.candidates.length) return null;

  const ranked = [...token.candidates].sort(compareCandidates);
  const selected = ranked[0];
  const second = ranked[1] ?? null;

  const selectedScore = numberValue(selected.score);
  const selectedPriority = numberValue(selected.base_priority);
  const selectedConfidence = confidenceRank(selected.base_confidence);

  const scoreMargin =
    second === null
      ? null
      : selectedScore - numberValue(second.score);

  const priorityMargin =
    second === null
      ? null
      : selectedPriority - numberValue(second.base_priority);

  const confidenceMargin =
    second === null
      ? null
      : selectedConfidence - confidenceRank(second.base_confidence);

  let status: SelectedCandidate['selection_status'];
  let selectionBasis: SelectedCandidate['selection_basis'];

  if (second === null) {
    status = 'only_candidate';
    selectionBasis = 'only_candidate';
  } else if (scoreMargin !== 0) {
    status =
      scoreMargin !== null && scoreMargin >= margin
        ? 'preferred'
        : 'weak_preference';
    selectionBasis = 'score';
  } else if (priorityMargin !== 0) {
    status = 'preferred';
    selectionBasis = 'base_priority';
  } else if (confidenceMargin !== 0) {
    status = 'preferred';
    selectionBasis = 'base_confidence';
  } else {
    // Lemma/POS ordering in compareCandidates is only a stable serializer
    // tie-breaker. It is not linguistic evidence and must not turn a real
    // ambiguity into a preferred candidate.
    status = 'tied';
    selectionBasis = 'unresolved_tie';
  }

  return {
    token_index: token.index,
    surface: token.surface,
    lexeme_id: selected.lexeme_id,
    lemma: selected.lemma,
    pos: selected.pos,
    form_types: [...(selected.form_types ?? [])],
    score: selectedScore,
    base_priority: selectedPriority,
    base_confidence: selected.base_confidence ?? null,
    selection_status: status,
    selection_basis: selectionBasis,
    score_margin: scoreMargin,
    priority_margin: priorityMargin,
    confidence_margin: confidenceMargin,
    trace: [...(selected.trace ?? [])],
  };
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function extractDeclaredSlotRoles(
  result: Record<string, JsonValue>,
): Map<string, string> {
  const roles = new Map<string, string>();

  for (const [key, value] of Object.entries(result)) {
    if (
      key === 'finite_slot' ||
      !key.endsWith('_slot') ||
      typeof value !== 'string'
    ) {
      continue;
    }

    roles.set(value, key.slice(0, -'_slot'.length));
  }

  return roles;
}

function resolveHeadSlot(
  construction: GrammarConstruction,
  roles: Map<string, string>,
): string | null {
  const explicit =
    asString(construction.result.predicate_head_slot) ??
    asString(construction.result.main_verb_slot);

  if (explicit && construction.slot_bindings[explicit]) {
    return explicit;
  }

  for (const [slot, role] of roles) {
    if (role === 'predicate_head' || role === 'main_verb') {
      return slot;
    }
  }

  return (
    [...Object.values(construction.slot_bindings)]
      .reverse()
      .find((binding) => normalizeText(binding.pos) === 'verb')
      ?.slot ?? null
  );
}

function memberFromBinding(
  binding: SlotBinding,
  role: string,
): PredicateMember {
  return {
    role,
    slot: binding.slot,
    token_index: binding.token_index,
    surface: binding.surface,
    lexeme_id: binding.lexeme_id,
    lemma: binding.lemma,
    pos: binding.pos,
    form_types: [...(binding.form_types ?? [])],
  };
}

function resolveFiniteMember(
  construction: GrammarConstruction,
  roles: Map<string, string>,
  diagnostics: InterpretationDiagnostic[],
): PredicateMember | null {
  const declaredFiniteSlot = construction.result.finite_slot;

  // An explicit null means that the construction is non-finite.
  if (declaredFiniteSlot === null) {
    return null;
  }

  // Interpretation must not infer finiteness from word, position, POS or role.
  if (declaredFiniteSlot === undefined) {
    diagnostics.push({
      severity: 'warning',
      code: 'finite_slot_not_declared',
      message:
        `Construction ${construction.rule_code} does not declare result.finite_slot.`,
      rule_code: construction.rule_code,
      metadata: {
        construction_type: construction.construction_type,
      },
    });
    return null;
  }

  if (
    typeof declaredFiniteSlot !== 'string' ||
    !declaredFiniteSlot.trim()
  ) {
    diagnostics.push({
      severity: 'warning',
      code: 'finite_slot_invalid',
      message:
        `Construction ${construction.rule_code} has an invalid result.finite_slot.`,
      rule_code: construction.rule_code,
      metadata: {
        construction_type: construction.construction_type,
      },
    });
    return null;
  }

  const finiteSlot = declaredFiniteSlot.trim();
  const binding = construction.slot_bindings[finiteSlot];

  if (!binding) {
    diagnostics.push({
      severity: 'warning',
      code: 'finite_member_binding_missing',
      message:
        `Finite slot "${finiteSlot}" is absent from bindings for construction ${construction.rule_code}.`,
      rule_code: construction.rule_code,
      metadata: {
        construction_type: construction.construction_type,
        finite_slot: finiteSlot,
      },
    });
    return null;
  }

  return memberFromBinding(
    binding,
    roles.get(finiteSlot) ?? 'finite_member',
  );
}

function constructionId(construction: GrammarConstruction): string {
  return [construction.rule_id, construction.construction_type, construction.token_start, construction.token_end].join(':');
}

function compositionDescendants(
  root: GrammarConstruction,
  model: ConstructionModel | undefined,
): GrammarConstruction[] {
  if (!model) return [];

  const byId = new Map(
    model.constructions.map((item) => [constructionId(item), item]),
  );
  const children = new Map<string, string[]>();

  if (model.construction_tree?.nodes?.length) {
    for (const node of model.construction_tree.nodes) {
      children.set(
        node.construction_id,
        [...(node.child_construction_ids ?? [])],
      );
    }
  } else {
    for (const link of model.composition_links ?? []) {
      const list = children.get(link.parent_construction_id) ?? [];
      list.push(link.child_construction_id);
      children.set(link.parent_construction_id, list);
    }
  }

  for (const ids of children.values()) {
    ids.sort((left, right) => left.localeCompare(right));
  }

  const result: GrammarConstruction[] = [];
  const visited = new Set<string>();

  const walk = (id: string) => {
    for (const childId of children.get(id) ?? []) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = byId.get(childId);
      if (!child) continue;
      result.push(child);
      walk(childId);
    }
  };

  walk(constructionId(root));
  return result;
}

function createPredicate(
  construction: GrammarConstruction,
  diagnostics: InterpretationDiagnostic[],
  constructionModel?: ConstructionModel,
): PredicateFrame | null {
  const descendants = compositionDescendants(construction, constructionModel);
  const semanticConstruction = descendants.length > 0
    ? [...descendants].sort((left, right) => {
        if (left.token_end !== right.token_end) {
          return right.token_end - left.token_end;
        }
        if (left.token_start !== right.token_start) {
          return right.token_start - left.token_start;
        }
        return right.priority - left.priority;
      })[0]
    : construction;
  const roles = extractDeclaredSlotRoles(semanticConstruction.result ?? {});
  const headSlot = resolveHeadSlot(semanticConstruction, roles);

  if (!headSlot) {
    diagnostics.push({
      severity: 'warning',
      code: 'predicate_head_not_found',
      message:
        `Construction ${semanticConstruction.rule_code} has no predicate head slot.`,
      rule_code: semanticConstruction.rule_code,
    });
    return null;
  }

  const headBinding = semanticConstruction.slot_bindings[headSlot];

  if (!headBinding) {
    diagnostics.push({
      severity: 'warning',
      code: 'predicate_head_binding_missing',
      message:
        `Predicate head slot "${headSlot}" is absent from bindings.`,
      rule_code: construction.rule_code,
    });
    return null;
  }

  const finiteMember = resolveFiniteMember(
    construction,
    roles,
    diagnostics,
  );

  const allConstructions = [construction, ...descendants];
  const memberMap = new Map<number, PredicateMember>();
  for (const item of allConstructions) {
    const itemRoles = extractDeclaredSlotRoles(item.result ?? {});
    const itemHeadSlot = resolveHeadSlot(item, itemRoles);
    for (const binding of Object.values(item.slot_bindings)) {
      const role = item === semanticConstruction
        ? (itemRoles.get(binding.slot) ?? (binding.slot === itemHeadSlot ? 'predicate_head' : binding.slot))
        : (itemRoles.get(binding.slot) ?? binding.slot);
      memberMap.set(binding.token_index, memberFromBinding(binding, role));
    }
  }
  const members = [...memberMap.values()].sort((a, b) => a.token_index - b.token_index);
  const composedStart = Math.min(...allConstructions.map((item) => item.token_start));
  const composedEnd = Math.max(...allConstructions.map((item) => item.token_end));

  return {
    id: [
      construction.rule_id,
      construction.token_start,
      construction.token_end,
    ].join(':'),
    construction_type: construction.construction_type,
    rule_id: construction.rule_id,
    rule_code: construction.rule_code,
    token_start: composedStart,
    token_end: composedEnd,
    head: memberFromBinding(
      headBinding,
      roles.get(headSlot) ?? 'predicate_head',
    ),
    finite_member: finiteMember,
    members,
    tense:
      asString(construction.result.tense) ??
      allConstructions.map((item) => asString(item.result.tense)).find(Boolean) ??
      null,
    aspect:
      [...allConstructions].reverse()
        .map((item) => asString(item.result.aspect))
        .find(Boolean) ?? null,
    mood:
      asString(construction.result.mood) ??
      allConstructions.map((item) => asString(item.result.mood)).find(Boolean) ??
      null,
    voice:
      [...allConstructions].reverse()
        .map((item) => asString(item.result.voice))
        .find(Boolean) ?? null,
    confidence: numberValue(construction.confidence),
    priority: numberValue(construction.priority),
    explanations: construction.explanations ?? {},
    source_result: {
      ...(construction.result ?? {}),
      composed_construction_ids: descendants.map(constructionId),
      semantic_construction_id: constructionId(semanticConstruction),
      composition_depth: descendants.length,
    },
  };
}

function buildSentenceModel(request: InterpretationRequest) {
  const margin =
    request.selectionMargin ?? DEFAULT_SELECTION_MARGIN;

  const diagnostics: InterpretationDiagnostic[] = [];

  const modelConstructions = request.construction_model?.constructions ?? request.constructions;
  const declaredRootIds =
    request.construction_model?.construction_tree?.root_construction_ids ??
    request.construction_model?.root_construction_ids ??
    [];

  const roots = request.construction_model
    ? modelConstructions.filter((item) =>
        declaredRootIds.includes(constructionId(item)),
      )
    : request.constructions;

  if (request.construction_model && roots.length === 0 && modelConstructions.length > 0) {
    diagnostics.push({
      severity: 'error',
      code: 'construction_model_has_no_roots',
      message: 'Construction Model contains constructions but no valid root construction IDs.',
      metadata: {
        construction_count: modelConstructions.length,
        declared_root_ids: declaredRootIds,
      },
    });
  }

  const predicates = roots
    .map((item) => createPredicate(item, diagnostics, request.construction_model))
    .filter((item): item is PredicateFrame => item !== null)
    .sort((a, b) => {
      if (a.token_start !== b.token_start) {
        return a.token_start - b.token_start;
      }
      if (a.token_end !== b.token_end) {
        return a.token_end - b.token_end;
      }
      return b.priority - a.priority;
    });

  const tokenModels = request.tokens
    .map((token) => {
      const selected = selectCandidate(token, margin);

      if (
        token.candidates.length > 1 &&
        selected?.selection_status === 'tied'
      ) {
        diagnostics.push({
          severity: 'warning',
          code: 'candidate_selection_tied',
          message:
            `Token "${token.surface}" has equally ranked candidates.`,
          token_index: token.index,
        });
      }

      return {
        token_index: token.index,
        surface: token.surface,
        normalized_surface: token.normalized_surface,
        token_role: token.token_role ?? null,
        selected_candidate: selected,
        alternatives: token.candidates.map((candidate) => ({
          lexeme_id: candidate.lexeme_id,
          lemma: candidate.lemma,
          pos: candidate.pos,
          form_types: candidate.form_types,
          score: numberValue(candidate.score),
          base_priority: numberValue(candidate.base_priority),
        })),
        grammar_roles: [] as Array<{
          predicate_id: string;
          construction_type: string;
          role: string;
          slot: string;
          rule_code: string;
        }>,
      };
    })
    .sort((a, b) => a.token_index - b.token_index);

  const tokenByIndex = new Map(
    tokenModels.map((token) => [token.token_index, token]),
  );

  for (const predicate of predicates) {
    for (const member of predicate.members) {
      const token = tokenByIndex.get(member.token_index);
      if (!token) continue;

      token.grammar_roles.push({
        predicate_id: predicate.id,
        construction_type: predicate.construction_type,
        role: member.role,
        slot: member.slot,
        rule_code: predicate.rule_code,
      });
    }
  }

  const selectedCount = tokenModels.filter(
    (token) => token.selected_candidate !== null,
  ).length;

  const ambiguousCount = request.tokens.filter(
    (token) => token.candidates.length > 1,
  ).length;

  return {
    model_version: SENTENCE_MODEL_VERSION,
    text: request.text ?? null,
    tokens: tokenModels,
    predicates,

    // Reserved until dedicated engines exist.
    clauses: [],
    dependencies: [],
    subjects: [],
    objects: [],

    diagnostics,
    summary: {
      token_count: request.tokens.length,
      selected_candidate_count: selectedCount,
      ambiguous_token_count: ambiguousCount,
      predicate_count: predicates.length,
      finite_predicate_count: predicates.filter(
        (predicate) => predicate.finite_member !== null,
      ).length,
      construction_count: modelConstructions.length,
      warning_count: diagnostics.filter(
        (item) =>
          item.severity === 'warning' ||
          item.severity === 'error',
      ).length,
    },
  };
}

function validateRequest(body: unknown): InterpretationRequest {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new RequestValidationError(
      'Request body must be a JSON object.',
    );
  }

  const request = body as Partial<InterpretationRequest>;

  if (!Array.isArray(request.tokens)) {
    throw new RequestValidationError(
      'Body must contain a tokens array.',
    );
  }

  if (!Array.isArray(request.constructions)) {
    throw new RequestValidationError('Body must contain a constructions array.');
  }
  if (request.construction_model !== undefined && (
    request.construction_model === null ||
    typeof request.construction_model !== 'object' ||
    !Array.isArray(request.construction_model.constructions) ||
    !Array.isArray(request.construction_model.root_construction_ids) ||
    !Array.isArray(request.construction_model.composition_links) ||
    (
      request.construction_model.construction_tree !== undefined &&
      (
        request.construction_model.construction_tree === null ||
        typeof request.construction_model.construction_tree !== 'object' ||
        !Array.isArray(request.construction_model.construction_tree.root_construction_ids) ||
        !Array.isArray(request.construction_model.construction_tree.nodes)
      )
    )
  )) {
    throw new RequestValidationError('construction_model has an invalid contract.');
  }

  for (const token of request.tokens) {
    if (
      !token ||
      typeof token !== 'object' ||
      typeof token.index !== 'number' ||
      typeof token.surface !== 'string' ||
      typeof token.normalized_surface !== 'string' ||
      !Array.isArray(token.candidates)
    ) {
      throw new RequestValidationError(
        'Every token must contain index, surface, normalized_surface and candidates.',
      );
    }
  }

  for (const construction of request.constructions) {
    if (
      !construction ||
      typeof construction !== 'object' ||
      typeof construction.rule_id !== 'string' ||
      typeof construction.rule_code !== 'string' ||
      typeof construction.construction_type !== 'string' ||
      typeof construction.token_start !== 'number' ||
      typeof construction.token_end !== 'number' ||
      !construction.slot_bindings ||
      typeof construction.slot_bindings !== 'object' ||
      Array.isArray(construction.slot_bindings) ||
      !construction.result ||
      typeof construction.result !== 'object' ||
      Array.isArray(construction.result)
    ) {
      throw new RequestValidationError(
        'Every construction must contain rule data, token range, slot_bindings and result.',
      );
    }

    const finiteSlot = construction.result.finite_slot;

    if (
      finiteSlot !== undefined &&
      finiteSlot !== null &&
      (
        typeof finiteSlot !== 'string' ||
        !finiteSlot.trim()
      )
    ) {
      throw new RequestValidationError(
        `Construction ${construction.rule_code} result.finite_slot must be a non-empty string or null.`,
      );
    }
  }

  if (
    request.selectionMargin !== undefined &&
    (
      typeof request.selectionMargin !== 'number' ||
      !Number.isFinite(request.selectionMargin) ||
      request.selectionMargin < 0
    )
  ) {
    throw new RequestValidationError(
      'selectionMargin must be a non-negative finite number.',
    );
  }

  return {
    text: request.text?.trim() || undefined,
    tokens: [...request.tokens].sort(
      (a, b) => a.index - b.index,
    ),
    constructions: [...request.constructions],
    construction_model: request.construction_model
      ? structuredClone(request.construction_model)
      : undefined,
    selectionMargin:
      request.selectionMargin ?? DEFAULT_SELECTION_MARGIN,
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

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          ok: false,
          interpreter_version: INTERPRETER_VERSION,
          error: 'Method not allowed.',
        },
        405,
      );
    }

    const body = validateRequest(await readJsonBody(request));
    const sentenceModel = buildSentenceModel(body);

    return jsonResponse({
      ok: true,
      interpreter_version: INTERPRETER_VERSION,
      sentence_model: sentenceModel,
    });
  } catch (error) {
    const validation =
      error instanceof RequestValidationError;

    console.error(
      validation
        ? '[GRAMMAR INTERPRETATION REQUEST ERROR]'
        : '[GRAMMAR INTERPRETATION ERROR]',
      error,
    );

    return jsonResponse(
      {
        ok: false,
        interpreter_version: INTERPRETER_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        details:
          validation ? error.details ?? null : null,
      },
      validation ? error.status : 500,
    );
  }
});
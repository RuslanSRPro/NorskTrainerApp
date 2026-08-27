// supabase/functions/construction-resolution-engine/index.ts
//
// Norsk Trainer
// Construction Resolution Engine v1.2
//
// Pipeline position:
//   grammar-pattern-engine
//     -> construction-resolution-engine
//     -> grammar-interpretation-engine
//
// Responsibilities:
//   1. Validate construction candidates produced by Grammar Pattern Engine.
//   2. Build pairwise structural relations between constructions.
//   3. Suppress true competitors deterministically.
//   4. Preserve independent and composable constructions.
//   5. Build a deterministic construction tree from composition links.
//   6. Emit composition links, diagnostics and resolution trace.
//
// Non-responsibilities:
//   - Does not match grammar rules.
//   - Does not know Norwegian words or individual constructions.
//   - Does not infer tense, aspect, mood, voice, semantic head or clauses.
//   - Does not mutate lexical candidate scores.
//   - Does not build PredicateFrame or Sentence Model.

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = Record<string, JsonValue>;

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

type ResolutionRequest = {
  constructions: GrammarConstruction[];
  includeTrace?: boolean;
  strictValidation?: boolean;
};

type ConstructionRelationType =
  | 'disjoint'
  | 'duplicate'
  | 'contains'
  | 'contained_by'
  | 'competing'
  | 'composes'
  | 'overlap_unresolved';

type ConstructionRelation = {
  left_id: string;
  right_id: string;
  relation: ConstructionRelationType;
  overlap_tokens: number[];
  shared_binding_tokens: number[];
  parent_id: string | null;
  child_id: string | null;
  composition_relation: CompositionRelationType | null;
  reason: string;
};

type SuppressionReason =
  | 'duplicate'
  | 'absorbed_by_parent'
  | 'lower_priority'
  | 'lower_specificity'
  | 'shorter_competing_span'
  | 'lower_confidence'
  | 'deterministic_tiebreak';

type SuppressedConstruction = {
  construction: GrammarConstruction;
  construction_id: string;
  reason: SuppressionReason;
  winner_construction_id: string;
  winner_rule_code: string;
  details: JsonObject;
};

type CompositionRelationType =
  | 'complement'
  | 'contains'
  | 'finite_component'
  | 'lexical_head_component';

type CompositionLink = {
  parent_construction_id: string;
  child_construction_id: string;
  relation: CompositionRelationType;
  shared_token_index: number | null;
  source: 'structural_inference';
};


type ConstructionTreeNode = {
  construction_id: string;
  parent_construction_id: string | null;
  child_construction_ids: string[];
  depth: number;
  relation_from_parent: CompositionRelationType | null;
  shared_token_index: number | null;
};

type ConstructionTree = {
  root_construction_ids: string[];
  nodes: ConstructionTreeNode[];
  max_depth: number;
};

type ResolverDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  construction_ids?: string[];
  metadata?: JsonObject;
};

type ResolutionTraceEntry = {
  stage: 'validation' | 'relation_builder' | 'resolution_planner' | 'finalize';
  status: 'completed' | 'created' | 'accepted' | 'suppressed' | 'warning';
  code: string;
  message: string;
  construction_ids?: string[];
  metadata?: JsonObject;
};

type RankedConstruction = {
  construction: GrammarConstruction;
  id: string;
  span_length: number;
  binding_count: number;
  specificity: number;
};

const ENGINE_VERSION = 'construction-resolution-engine-v1.2.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

class RequestValidationError extends Error {
  status = 400;
  details?: JsonObject;

  constructor(message: string, details?: JsonObject) {
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

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase('nb-NO');
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function constructionId(construction: GrammarConstruction): string {
  return [
    construction.rule_id,
    construction.construction_type,
    construction.token_start,
    construction.token_end,
  ].join(':');
}

function constructionStableKey(construction: GrammarConstruction): string {
  return [
    construction.rule_code,
    construction.construction_type,
    construction.token_start,
    construction.token_end,
    JSON.stringify(construction.slot_bindings),
  ].join('|');
}

function spanLength(construction: GrammarConstruction): number {
  return Math.max(0, construction.token_end - construction.token_start + 1);
}

function tokenSet(construction: GrammarConstruction): Set<number> {
  const result = new Set<number>();
  for (
    let index = construction.token_start;
    index <= construction.token_end;
    index++
  ) {
    result.add(index);
  }
  return result;
}

function bindingTokenSet(construction: GrammarConstruction): Set<number> {
  return new Set(
    Object.values(construction.slot_bindings)
      .map((binding) => binding.token_index)
      .filter((index) => Number.isInteger(index)),
  );
}

function intersection(left: Set<number>, right: Set<number>): number[] {
  return [...left].filter((item) => right.has(item)).sort((a, b) => a - b);
}

function containsSpan(
  outer: GrammarConstruction,
  inner: GrammarConstruction,
): boolean {
  return (
    outer.token_start <= inner.token_start &&
    outer.token_end >= inner.token_end
  );
}

function sameSpan(left: GrammarConstruction, right: GrammarConstruction): boolean {
  return (
    left.token_start === right.token_start &&
    left.token_end === right.token_end
  );
}

function declaredSlotToken(
  construction: GrammarConstruction,
  resultField: string,
): number | null {
  const slot = asString(construction.result[resultField]);
  if (!slot) return null;
  const binding = construction.slot_bindings[slot];
  return binding ? binding.token_index : null;
}

function finiteToken(construction: GrammarConstruction): number | null {
  if (construction.result.finite_slot === null) return null;
  return declaredSlotToken(construction, 'finite_slot');
}

function headToken(construction: GrammarConstruction): number | null {
  return (
    declaredSlotToken(construction, 'predicate_head_slot') ??
    declaredSlotToken(construction, 'main_verb_slot') ??
    [...Object.values(construction.slot_bindings)]
      .reverse()
      .find((binding) => normalizeText(binding.pos) === 'verb')
      ?.token_index ??
    null
  );
}

function isPredicateConstruction(construction: GrammarConstruction): boolean {
  return (
    construction.result.finite_slot !== undefined ||
    construction.result.main_verb_slot !== undefined ||
    construction.result.predicate_head_slot !== undefined
  );
}

function computeSpecificity(construction: GrammarConstruction): number {
  // v1.0 computes specificity only from the stable construction contract.
  // Pattern-level specificity can be added later without changing the API.
  const bindings = Object.values(construction.slot_bindings);
  let score = bindings.length * 10;

  for (const binding of bindings) {
    if (binding.lexeme_id) score += 4;
    if (binding.lemma) score += 3;
    if (binding.pos) score += 2;
    if (binding.form_types?.length) score += Math.min(3, binding.form_types.length);
    if (binding.token_role) score += 1;
  }

  if (construction.result.finite_slot !== undefined) score += 4;
  if (construction.result.main_verb_slot !== undefined) score += 4;
  if (construction.result.predicate_head_slot !== undefined) score += 4;
  if (construction.result.construction_family !== undefined) score += 1;

  return score;
}

function rankConstruction(construction: GrammarConstruction): RankedConstruction {
  return {
    construction,
    id: constructionId(construction),
    span_length: spanLength(construction),
    binding_count: Object.keys(construction.slot_bindings).length,
    specificity: computeSpecificity(construction),
  };
}

function compareRanked(left: RankedConstruction, right: RankedConstruction): number {
  const priority = numberValue(right.construction.priority) -
    numberValue(left.construction.priority);
  if (priority !== 0) return priority;

  const specificity = right.specificity - left.specificity;
  if (specificity !== 0) return specificity;

  const span = right.span_length - left.span_length;
  if (span !== 0) return span;

  const bindings = right.binding_count - left.binding_count;
  if (bindings !== 0) return bindings;

  const confidence = numberValue(right.construction.confidence) -
    numberValue(left.construction.confidence);
  if (confidence !== 0) return confidence;

  const ruleCode = left.construction.rule_code.localeCompare(
    right.construction.rule_code,
    'nb-NO',
  );
  if (ruleCode !== 0) return ruleCode;

  return left.id.localeCompare(right.id, 'en');
}

function suppressionReason(
  loser: RankedConstruction,
  winner: RankedConstruction,
): SuppressionReason {
  if (numberValue(loser.construction.priority) !== numberValue(winner.construction.priority)) {
    return 'lower_priority';
  }
  if (loser.specificity !== winner.specificity) return 'lower_specificity';
  if (loser.span_length !== winner.span_length) return 'shorter_competing_span';
  if (numberValue(loser.construction.confidence) !== numberValue(winner.construction.confidence)) {
    return 'lower_confidence';
  }
  return 'deterministic_tiebreak';
}

function detectComposition(
  left: GrammarConstruction,
  right: GrammarConstruction,
): {
  parent: GrammarConstruction;
  child: GrammarConstruction;
  relation: CompositionRelationType;
  sharedToken: number | null;
  reason: string;
} | null {
  const leftHead = headToken(left);
  const rightHead = headToken(right);
  const leftFinite = finiteToken(left);
  const rightFinite = finiteToken(right);

  const leftComplement = declaredSlotToken(left, 'complement_slot');
  const rightComplement = declaredSlotToken(right, 'complement_slot');
  const leftEntry = declaredSlotToken(left, 'entry_slot');
  const rightEntry = declaredSlotToken(right, 'entry_slot');

  // Explicit universal composition anchors declared by Grammar KB.
  // A parent complement slot may be realized by the entry slot of a child
  // construction. This supports modal -> perfect -> passive chains without
  // hardcoding construction names or Norwegian words.
  if (leftComplement !== null && rightEntry !== null && leftComplement === rightEntry) {
    return {
      parent: left, child: right, relation: 'complement',
      sharedToken: leftComplement,
      reason: 'Parent complement slot matches child entry slot.',
    };
  }
  if (rightComplement !== null && leftEntry !== null && rightComplement === leftEntry) {
    return {
      parent: right, child: left, relation: 'complement',
      sharedToken: rightComplement,
      reason: 'Parent complement slot matches child entry slot.',
    };
  }

  // A construction whose semantic/head slot is exactly the finite member of
  // another predicate can take that predicate as its complement.
  if (
    leftHead !== null &&
    rightFinite !== null &&
    leftHead === rightFinite &&
    constructionId(left) !== constructionId(right)
  ) {
    return {
      parent: left,
      child: right,
      relation: 'complement',
      sharedToken: leftHead,
      reason: 'Parent head token is the child finite-member token.',
    };
  }

  if (
    rightHead !== null &&
    leftFinite !== null &&
    rightHead === leftFinite &&
    constructionId(left) !== constructionId(right)
  ) {
    return {
      parent: right,
      child: left,
      relation: 'complement',
      sharedToken: rightHead,
      reason: 'Parent head token is the child finite-member token.',
    };
  }

  // Strict containment is compositional only when neither construction is a
  // single-token predicate absorbed by a member of the larger predicate.
  if (containsSpan(left, right) && !sameSpan(left, right)) {
    return {
      parent: left,
      child: right,
      relation: 'contains',
      sharedToken: null,
      reason: 'The parent span strictly contains the child span.',
    };
  }

  if (containsSpan(right, left) && !sameSpan(left, right)) {
    return {
      parent: right,
      child: left,
      relation: 'contains',
      sharedToken: null,
      reason: 'The parent span strictly contains the child span.',
    };
  }

  return null;
}

function isAbsorbableSinglePredicate(
  smaller: GrammarConstruction,
  larger: GrammarConstruction,
): boolean {
  if (!isPredicateConstruction(smaller) || !isPredicateConstruction(larger)) {
    return false;
  }
  if (spanLength(smaller) !== 1 || !containsSpan(larger, smaller)) return false;

  const smallHead = headToken(smaller);
  const smallFinite = finiteToken(smaller);
  const largeFinite = finiteToken(larger);
  const largeHead = headToken(larger);

  const smallToken = smallHead ?? smallFinite ?? smaller.token_start;

  return (
    smallToken === largeFinite &&
    largeHead !== null &&
    largeHead !== smallToken
  );
}

function relationBetween(
  left: GrammarConstruction,
  right: GrammarConstruction,
): ConstructionRelation {
  const leftId = constructionId(left);
  const rightId = constructionId(right);
  const overlapTokens = intersection(tokenSet(left), tokenSet(right));
  const sharedBindingTokens = intersection(
    bindingTokenSet(left),
    bindingTokenSet(right),
  );

  if (constructionStableKey(left) === constructionStableKey(right)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'duplicate',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: null,
      child_id: null,
      composition_relation: null,
      reason: 'Both construction candidates have the same stable identity.',
    };
  }

  if (overlapTokens.length === 0) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'disjoint',
      overlap_tokens: [],
      shared_binding_tokens: [],
      parent_id: null,
      child_id: null,
      composition_relation: null,
      reason: 'Construction spans do not overlap.',
    };
  }

  if (isAbsorbableSinglePredicate(left, right)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'competing',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: rightId,
      child_id: leftId,
      composition_relation: 'finite_component',
      reason: 'Single-token predicate is realized as the finite member of a larger predicate.',
    };
  }

  if (isAbsorbableSinglePredicate(right, left)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'competing',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: leftId,
      child_id: rightId,
      composition_relation: 'finite_component',
      reason: 'Single-token predicate is realized as the finite member of a larger predicate.',
    };
  }

  const composition = detectComposition(left, right);
  if (composition) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'composes',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: constructionId(composition.parent),
      child_id: constructionId(composition.child),
      composition_relation: composition.relation,
      reason: composition.reason,
    };
  }

  if (sameSpan(left, right) && isPredicateConstruction(left) && isPredicateConstruction(right)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'competing',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: null,
      child_id: null,
      composition_relation: null,
      reason: 'Predicate constructions occupy the same token span.',
    };
  }

  if (containsSpan(left, right) && !sameSpan(left, right)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'contains',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: leftId,
      child_id: rightId,
      composition_relation: null,
      reason: 'Left construction strictly contains the right construction.',
    };
  }

  if (containsSpan(right, left) && !sameSpan(left, right)) {
    return {
      left_id: leftId,
      right_id: rightId,
      relation: 'contained_by',
      overlap_tokens: overlapTokens,
      shared_binding_tokens: sharedBindingTokens,
      parent_id: rightId,
      child_id: leftId,
      composition_relation: null,
      reason: 'Left construction is strictly contained by the right construction.',
    };
  }

  return {
    left_id: leftId,
    right_id: rightId,
    relation: 'overlap_unresolved',
    overlap_tokens: overlapTokens,
    shared_binding_tokens: sharedBindingTokens,
    parent_id: null,
    child_id: null,
    composition_relation: null,
    reason: 'Construction spans overlap, but no universal competition or composition relation was proven.',
  };
}

function validateConstruction(
  value: unknown,
  index: number,
  strict: boolean,
  diagnostics: ResolverDiagnostic[],
): value is GrammarConstruction {
  if (!isJsonObject(value)) {
    if (strict) {
      throw new RequestValidationError(`Construction at index ${index} must be an object.`);
    }
    diagnostics.push({
      severity: 'error',
      code: 'construction_not_object',
      message: `Construction at index ${index} was ignored because it is not an object.`,
    });
    return false;
  }

  const requiredStringFields = ['rule_id', 'rule_code', 'construction_type'] as const;
  for (const field of requiredStringFields) {
    if (typeof value[field] !== 'string' || !String(value[field]).trim()) {
      if (strict) {
        throw new RequestValidationError(
          `Construction at index ${index} must contain non-empty ${field}.`,
        );
      }
      diagnostics.push({
        severity: 'error',
        code: 'construction_field_invalid',
        message: `Construction at index ${index} was ignored because ${field} is invalid.`,
      });
      return false;
    }
  }

  if (
    typeof value.token_start !== 'number' ||
    typeof value.token_end !== 'number' ||
    !Number.isInteger(value.token_start) ||
    !Number.isInteger(value.token_end) ||
    value.token_start < 0 ||
    value.token_end < value.token_start
  ) {
    if (strict) {
      throw new RequestValidationError(
        `Construction at index ${index} has an invalid token span.`,
      );
    }
    diagnostics.push({
      severity: 'error',
      code: 'construction_span_invalid',
      message: `Construction at index ${index} was ignored because its token span is invalid.`,
    });
    return false;
  }

  if (!isJsonObject(value.slot_bindings) || !isJsonObject(value.result)) {
    if (strict) {
      throw new RequestValidationError(
        `Construction at index ${index} must contain slot_bindings and result objects.`,
      );
    }
    diagnostics.push({
      severity: 'error',
      code: 'construction_contract_invalid',
      message: `Construction at index ${index} was ignored because its contract is incomplete.`,
    });
    return false;
  }

  return true;
}

function validateRequest(body: unknown): ResolutionRequest {
  if (!isJsonObject(body)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }
  if (!Array.isArray(body.constructions)) {
    throw new RequestValidationError('Body must contain a constructions array.');
  }
  if (body.includeTrace !== undefined && typeof body.includeTrace !== 'boolean') {
    throw new RequestValidationError('includeTrace must be a boolean.');
  }
  if (
    body.strictValidation !== undefined &&
    typeof body.strictValidation !== 'boolean'
  ) {
    throw new RequestValidationError('strictValidation must be a boolean.');
  }

  return {
    constructions: body.constructions as unknown as GrammarConstruction[],
    includeTrace: body.includeTrace === true,
    strictValidation: body.strictValidation !== false,
  };
}


function buildConstructionTree(
  resolved: GrammarConstruction[],
  rootConstructionIds: string[],
  compositionLinks: CompositionLink[],
): ConstructionTree {
  const resolvedIds = new Set(resolved.map(constructionId));
  const parentByChild = new Map<string, CompositionLink>();
  const childrenByParent = new Map<string, CompositionLink[]>();

  for (const link of compositionLinks) {
    if (
      !resolvedIds.has(link.parent_construction_id) ||
      !resolvedIds.has(link.child_construction_id)
    ) {
      continue;
    }

    parentByChild.set(link.child_construction_id, link);
    const children = childrenByParent.get(link.parent_construction_id) ?? [];
    children.push(link);
    childrenByParent.set(link.parent_construction_id, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) =>
      left.child_construction_id.localeCompare(right.child_construction_id),
    );
  }

  const depthById = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveDepth = (id: string): number => {
    const cached = depthById.get(id);
    if (cached !== undefined) return cached;

    if (visiting.has(id)) {
      // A cycle should not occur because composition links are directed from
      // complement host to complement realization. Keep the model usable if
      // malformed data nevertheless creates one.
      return 0;
    }

    visiting.add(id);
    const parent = parentByChild.get(id);
    const depth = parent ? resolveDepth(parent.parent_construction_id) + 1 : 0;
    visiting.delete(id);
    depthById.set(id, depth);
    return depth;
  };

  const nodes = [...resolvedIds]
    .sort((left, right) => left.localeCompare(right))
    .map((id): ConstructionTreeNode => {
      const parentLink = parentByChild.get(id) ?? null;
      const childLinks = childrenByParent.get(id) ?? [];

      return {
        construction_id: id,
        parent_construction_id:
          parentLink?.parent_construction_id ?? null,
        child_construction_ids: childLinks.map(
          (link) => link.child_construction_id,
        ),
        depth: resolveDepth(id),
        relation_from_parent: parentLink?.relation ?? null,
        shared_token_index: parentLink?.shared_token_index ?? null,
      };
    });

  return {
    root_construction_ids: [...rootConstructionIds],
    nodes,
    max_depth: nodes.reduce(
      (maximum, node) => Math.max(maximum, node.depth),
      0,
    ),
  };
}

function resolveConstructions(request: ResolutionRequest) {
  const diagnostics: ResolverDiagnostic[] = [];
  const trace: ResolutionTraceEntry[] = [];
  const strict = request.strictValidation !== false;

  const constructions = request.constructions
    .filter((item, index) => validateConstruction(item, index, strict, diagnostics))
    .map((item) => cloneValue(item));

  trace.push({
    stage: 'validation',
    status: 'completed',
    code: 'construction_validation_completed',
    message: `Validated ${constructions.length} construction candidates.`,
    metadata: {
      input_count: request.constructions.length,
      valid_count: constructions.length,
    },
  });

  const byId = new Map<string, RankedConstruction>();
  for (const construction of constructions) {
    const ranked = rankConstruction(construction);
    // IDs should already be unique. Keep a deterministic suffix only when a
    // malformed upstream payload contains collisions.
    let id = ranked.id;
    let suffix = 2;
    while (byId.has(id)) {
      id = `${ranked.id}#${suffix++}`;
    }
    byId.set(id, { ...ranked, id });
  }

  const ranked = [...byId.values()];
  const relations: ConstructionRelation[] = [];

  for (let leftIndex = 0; leftIndex < ranked.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < ranked.length; rightIndex++) {
      const relation = relationBetween(
        ranked[leftIndex].construction,
        ranked[rightIndex].construction,
      );
      // Replace computed IDs with collision-safe IDs used in this request.
      relation.left_id = ranked[leftIndex].id;
      relation.right_id = ranked[rightIndex].id;
      if (relation.parent_id === constructionId(ranked[leftIndex].construction)) {
        relation.parent_id = ranked[leftIndex].id;
      } else if (relation.parent_id === constructionId(ranked[rightIndex].construction)) {
        relation.parent_id = ranked[rightIndex].id;
      }
      if (relation.child_id === constructionId(ranked[leftIndex].construction)) {
        relation.child_id = ranked[leftIndex].id;
      } else if (relation.child_id === constructionId(ranked[rightIndex].construction)) {
        relation.child_id = ranked[rightIndex].id;
      }
      relations.push(relation);
    }
  }

  trace.push({
    stage: 'relation_builder',
    status: 'completed',
    code: 'construction_relations_built',
    message: `Built ${relations.length} pairwise construction relations.`,
    metadata: { relation_count: relations.length },
  });

  const suppressed = new Map<string, SuppressedConstruction>();
  const compositionLinks = new Map<string, CompositionLink>();

  for (const relation of relations) {
    const left = byId.get(relation.left_id);
    const right = byId.get(relation.right_id);
    if (!left || !right) continue;

    if (relation.relation === 'duplicate') {
      const ordered = [left, right].sort(compareRanked);
      const winner = ordered[0];
      const loser = ordered[1];
      if (!suppressed.has(loser.id)) {
        suppressed.set(loser.id, {
          construction: loser.construction,
          construction_id: loser.id,
          reason: 'duplicate',
          winner_construction_id: winner.id,
          winner_rule_code: winner.construction.rule_code,
          details: { relation: 'duplicate' },
        });
      }
      continue;
    }

    if (relation.relation === 'competing') {
      let winner: RankedConstruction;
      let loser: RankedConstruction;

      // Absorption relation explicitly identifies the larger parent.
      if (relation.parent_id && relation.child_id) {
        winner = byId.get(relation.parent_id) ?? [left, right].sort(compareRanked)[0];
        loser = byId.get(relation.child_id) ?? (winner.id === left.id ? right : left);
      } else {
        [winner, loser] = [left, right].sort(compareRanked);
      }

      if (!suppressed.has(loser.id)) {
        const absorbed = relation.composition_relation === 'finite_component';
        suppressed.set(loser.id, {
          construction: loser.construction,
          construction_id: loser.id,
          reason: absorbed
            ? 'absorbed_by_parent'
            : suppressionReason(loser, winner),
          winner_construction_id: winner.id,
          winner_rule_code: winner.construction.rule_code,
          details: {
            relation: relation.relation,
            overlap_tokens: relation.overlap_tokens,
            specificity_loser: loser.specificity,
            specificity_winner: winner.specificity,
          },
        });
      }
      continue;
    }

    if (
      relation.relation === 'composes' &&
      relation.parent_id &&
      relation.child_id &&
      relation.composition_relation
    ) {
      const sharedToken = relation.overlap_tokens.length === 1
        ? relation.overlap_tokens[0]
        : relation.shared_binding_tokens.length === 1
        ? relation.shared_binding_tokens[0]
        : null;
      const link: CompositionLink = {
        parent_construction_id: relation.parent_id,
        child_construction_id: relation.child_id,
        relation: relation.composition_relation,
        shared_token_index: sharedToken,
        source: 'structural_inference',
      };
      const key = [
        link.parent_construction_id,
        link.child_construction_id,
        link.relation,
      ].join('|');
      compositionLinks.set(key, link);
      continue;
    }

    if (relation.relation === 'overlap_unresolved') {
      diagnostics.push({
        severity: 'warning',
        code: 'construction_overlap_unresolved',
        message:
          'Overlapping constructions were preserved because no universal conflict or composition relation was proven.',
        construction_ids: [relation.left_id, relation.right_id],
        metadata: {
          overlap_tokens: relation.overlap_tokens,
          shared_binding_tokens: relation.shared_binding_tokens,
        },
      });
    }
  }

  const resolved = ranked
    .filter((item) => !suppressed.has(item.id))
    .sort((left, right) => {
      if (left.construction.token_start !== right.construction.token_start) {
        return left.construction.token_start - right.construction.token_start;
      }
      if (left.construction.token_end !== right.construction.token_end) {
        return left.construction.token_end - right.construction.token_end;
      }
      return compareRanked(left, right);
    })
    .map((item) => item.construction);

  for (const item of suppressed.values()) {
    trace.push({
      stage: 'resolution_planner',
      status: 'suppressed',
      code: `construction_${item.reason}`,
      message:
        `Suppressed ${item.construction.rule_code} in favour of ${item.winner_rule_code}.`,
      construction_ids: [item.construction_id, item.winner_construction_id],
      metadata: item.details,
    });
  }

  for (const link of compositionLinks.values()) {
    trace.push({
      stage: 'resolution_planner',
      status: 'created',
      code: 'composition_link_created',
      message: `Created ${link.relation} composition link.`,
      construction_ids: [
        link.parent_construction_id,
        link.child_construction_id,
      ],
      metadata: {
        relation: link.relation,
        shared_token_index: link.shared_token_index,
      },
    });
  }

  trace.push({
    stage: 'finalize',
    status: 'completed',
    code: 'construction_resolution_completed',
    message:
      `Resolved ${resolved.length} constructions; suppressed ${suppressed.size}; created ${compositionLinks.size} composition links.`,
    metadata: {
      input_count: constructions.length,
      resolved_count: resolved.length,
      suppressed_count: suppressed.size,
      composition_link_count: compositionLinks.size,
      diagnostic_count: diagnostics.length,
    },
  });

  const childIds = new Set([...compositionLinks.values()].map((link) => link.child_construction_id));
  const rootConstructionIds = [...byId.values()]
    .filter((item) => !suppressed.has(item.id) && !childIds.has(item.id))
    .map((item) => item.id);

  const finalCompositionLinks = [...compositionLinks.values()];
  const constructionTree = buildConstructionTree(
    resolved,
    rootConstructionIds,
    finalCompositionLinks,
  );

  const constructionModel = {
    model_version: 'construction-model-v1.1',
    constructions: resolved,
    root_construction_ids: rootConstructionIds,
    composition_links: finalCompositionLinks,
    construction_tree: constructionTree,
    suppressed_constructions: [...suppressed.values()],
    relations,
    diagnostics,
    summary: {
      construction_count: resolved.length,
      root_construction_count: rootConstructionIds.length,
      suppressed_construction_count: suppressed.size,
      composition_link_count: compositionLinks.size,
      construction_tree_node_count: constructionTree.nodes.length,
      construction_tree_max_depth: constructionTree.max_depth,
    },
  };

  return {
    construction_model: constructionModel,
    resolved_constructions: resolved,
    suppressed_constructions: [...suppressed.values()],
    composition_links: [...compositionLinks.values()],
    relations,
    diagnostics,
    trace: request.includeTrace ? trace : [],
    summary: {
      input_construction_count: constructions.length,
      resolved_construction_count: resolved.length,
      suppressed_construction_count: suppressed.size,
      composition_link_count: compositionLinks.size,
      relation_count: relations.length,
      unresolved_overlap_count: diagnostics.filter(
        (item) => item.code === 'construction_overlap_unresolved',
      ).length,
      warning_count: diagnostics.filter(
        (item) => item.severity === 'warning' || item.severity === 'error',
      ).length,
    },
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
          error: 'Method not allowed.',
        },
        405,
      );
    }

    const raw = await request.text();
    if (!raw.trim()) {
      throw new RequestValidationError('Request body is empty.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RequestValidationError('Request body is not valid JSON.');
    }

    const requestBody = validateRequest(parsed);
    const result = resolveConstructions(requestBody);

    return jsonResponse({
      ok: true,
      engine_version: ENGINE_VERSION,
      ...result,
    });
  } catch (error) {
    console.error('[CONSTRUCTION RESOLUTION ENGINE ERROR]', error);

    const status = error instanceof RequestValidationError ? error.status : 500;
    return jsonResponse(
      {
        ok: false,
        engine_version: ENGINE_VERSION,
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof RequestValidationError
            ? error.details ?? null
            : null,
      },
      status,
    );
  }
});
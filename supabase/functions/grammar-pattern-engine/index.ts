// supabase/functions/grammar-pattern-engine/index.ts
//
// Norsk Trainer
// Grammar Pattern Engine v1.2
//
// Supported pattern types:
//   - token_sequence
//
// Supported actions:
//   - add_candidate_score
//   - create_construction
//
// Responsibilities:
//   1. Receive tokenized text with lexical candidates.
//   2. Load active grammar rules.
//   3. Dispatch each rule to its registered matcher.
//   4. Match declarative token-sequence patterns.
//   5. Apply declarative grammar actions.
//   6. Return matches, constructions, candidate scores and trace.
//
// Non-responsibilities:
//   - Does not tokenize text.
//   - Does not resolve surface forms.
//   - Does not know specific Norwegian words such as har/hadde/kan.
//   - Does not contain parser-specific grammar conditions.
//   - Does not select one final lexical winner yet.
//   - Does not write analysis results to the database yet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonPrimitive = string | number | boolean | null;

type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type CandidateTraceEntry = {
  type: 'grammar_score';
  rule_id: string;
  rule_code: string;
  slot: string;
  delta: number;
  score_before: number;
  score_after: number;
  reason: string;
};

type LexicalCandidate = {
  lexeme_id: string;
  lemma: string;
  pos: string;

  form_types: string[];

  sources?: string[];
  evidence?: JsonValue;

  base_confidence?: string;
  base_priority?: number;

  score?: number;
  trace?: CandidateTraceEntry[];
};

type GrammarToken = {
  index: number;

  surface: string;
  normalized_surface: string;

  token_role?: string | null;

  candidates: LexicalCandidate[];
};

type TokenSequenceSlot = {
  slot: string;

  token?: string;
  token_role?: string;

  lemma?: string;
  lexical_class?: string;

  pos?: string;
  form_type?: string;

  optional?: boolean;

  min_gap?: number;
  max_gap?: number;

  forbidden_previous_token?: string;
  forbidden_next_token?: string;
};

type GrammarAction = {
  action: string;

  slot?: string;
  delta?: number;

  candidate_pos?: string;
  candidate_form_type?: string;

  construction_type?: string;

  [key: string]: JsonValue | undefined;
};

type GrammarRule = {
  id: string;
  code: string;

  category: string;
  subcategory: string | null;

  pattern_type: string;

  pattern: {
    slots: TokenSequenceSlot[];
  };

  result: Record<string, JsonValue>;

  parser_actions: GrammarAction[];
  learning_explanation: Record<string, JsonValue>;

  diagnostics: Record<string, JsonValue>;
  examples: JsonValue[];

  priority: number;
  base_confidence: number;

  version: number;
};

type LexicalClassMembership = {
  class_code: string;

  lexeme_id: string | null;
  normalized_lemma: string | null;
  pos: string | null;
};

type CandidateBinding = {
  token_index: number;
  surface: string;

  candidate: LexicalCandidate | null;
  token_role: string | null;
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

type RuleMatch = {
  matched: boolean;

  rule_id: string;
  rule_code: string;

  pattern_type: string;

  token_start: number | null;
  token_end: number | null;

  slot_bindings: Record<string, SlotBinding>;

  result: Record<string, JsonValue>;

  parser_actions: GrammarAction[];
  learning_explanation: Record<string, JsonValue>;

  diagnostics: Record<string, JsonValue>;
  examples: JsonValue[];

  priority: number;
  confidence: number;

  trace: Array<Record<string, JsonValue>>;
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

type AppliedActionsResult = {
  tokens: GrammarToken[];
  constructions: GrammarConstruction[];
  action_trace: Array<Record<string, JsonValue>>;
};

type EngineRequest = {
  tokens: GrammarToken[];

  ruleCodes?: string[];

  /**
   * dryRun=true:
   * patterns are matched, but actions do not modify candidate scores
   * and do not create constructions.
   */
  dryRun?: boolean;
};

type EngineResponse = {
  ok: boolean;
  engine_version: string;
  dry_run: boolean;

  tokens: GrammarToken[];
  matches: RuleMatch[];

  constructions: GrammarConstruction[];
  action_trace: Array<Record<string, JsonValue>>;

  summary: {
    token_count: number;
    rule_count: number;
    match_count: number;
    construction_count: number;
    applied_action_count: number;
    unsupported_action_count: number;
  };
};

const ENGINE_VERSION = 'grammar-pattern-engine-v1.2.0';


class RequestValidationError extends Error {
  status: number;
  details?: Record<string, JsonValue>;

  constructor(
    message: string,
    details?: Record<string, JsonValue>,
  ) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = 400;
    this.details = details;
  }
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const rawText = await request.text();

  if (!rawText.trim()) {
    throw new RequestValidationError(
      'Request body is empty. Add a JSON object containing a tokens array.',
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new RequestValidationError(
      'Request body is not valid JSON.',
      {
        raw_body_preview: rawText.slice(0, 500),
      },
    );
  }

  // Supabase Test Function normally sends the JSON object directly.
  // These fallbacks make the endpoint tolerant of common wrappers used by
  // local tools or intermediary clients.
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed)
  ) {
    const record = parsed as Record<string, unknown>;

    if (Array.isArray(record.tokens)) {
      return record;
    }

    if (
      record.body &&
      typeof record.body === 'object' &&
      !Array.isArray(record.body)
    ) {
      const nestedBody = record.body as Record<string, unknown>;

      if (Array.isArray(nestedBody.tokens)) {
        return nestedBody;
      }
    }

    if (typeof record.body === 'string') {
      try {
        const nestedBody = JSON.parse(record.body);

        if (
          nestedBody &&
          typeof nestedBody === 'object' &&
          Array.isArray(
            (nestedBody as Record<string, unknown>).tokens,
          )
        ) {
          return nestedBody;
        }
      } catch {
        // validateRequest will return a precise error below.
      }
    }

    if (
      record.payload &&
      typeof record.payload === 'object' &&
      !Array.isArray(record.payload)
    ) {
      const payload = record.payload as Record<string, unknown>;

      if (Array.isArray(payload.tokens)) {
        return payload;
      }
    }
  }

  return parsed;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function normalizeText(
  value: string | null | undefined,
): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('nb-NO');
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function candidateHasFormType(
  candidate: LexicalCandidate,
  requiredFormType: string,
): boolean {
  const normalizedRequired = normalizeText(requiredFormType);
  const candidateFormTypes = asStringArray(
    candidate.form_types,
  );

  return candidateFormTypes.includes(normalizedRequired);
}

function membershipMatchesCandidate(
  membership: LexicalClassMembership,
  candidate: LexicalCandidate,
): boolean {
  if (
    membership.lexeme_id &&
    membership.lexeme_id === candidate.lexeme_id
  ) {
    return true;
  }

  if (
    membership.normalized_lemma &&
    normalizeText(candidate.lemma) ===
      normalizeText(membership.normalized_lemma) &&
    (
      !membership.pos ||
      normalizeText(candidate.pos) ===
        normalizeText(membership.pos)
    )
  ) {
    return true;
  }

  return false;
}

function candidateBelongsToClass(
  candidate: LexicalCandidate,
  classCode: string,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): boolean {
  const memberships =
    membershipsByClass.get(normalizeText(classCode)) ?? [];

  return memberships.some((membership) =>
    membershipMatchesCandidate(
      membership,
      candidate,
    )
  );
}

function tokenMatchesLiteral(
  token: GrammarToken,
  expectedToken: string,
): boolean {
  return (
    normalizeText(
      token.normalized_surface || token.surface,
    ) === normalizeText(expectedToken)
  );
}

function tokenRoleMatches(
  token: GrammarToken,
  requiredRole: string,
): boolean {
  return (
    normalizeText(token.token_role) ===
    normalizeText(requiredRole)
  );
}

function candidateMatchesSlot(
  candidate: LexicalCandidate,
  slot: TokenSequenceSlot,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): boolean {
  if (
    slot.lemma &&
    normalizeText(candidate.lemma) !==
      normalizeText(slot.lemma)
  ) {
    return false;
  }

  if (
    slot.pos &&
    normalizeText(candidate.pos) !==
      normalizeText(slot.pos)
  ) {
    return false;
  }

  if (
    slot.form_type &&
    !candidateHasFormType(
      candidate,
      slot.form_type,
    )
  ) {
    return false;
  }

  if (
    slot.lexical_class &&
    !candidateBelongsToClass(
      candidate,
      slot.lexical_class,
      membershipsByClass,
    )
  ) {
    return false;
  }

  return true;
}

function matchSlotAgainstToken(
  token: GrammarToken,
  slot: TokenSequenceSlot,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): CandidateBinding | null {
  if (
    slot.token &&
    !tokenMatchesLiteral(token, slot.token)
  ) {
    return null;
  }

  if (
    slot.token_role &&
    !tokenRoleMatches(token, slot.token_role)
  ) {
    return null;
  }

  const requiresCandidate =
    Boolean(slot.lemma) ||
    Boolean(slot.lexical_class) ||
    Boolean(slot.pos) ||
    Boolean(slot.form_type);

  if (!requiresCandidate) {
    return {
      token_index: token.index,
      surface: token.surface,
      candidate: null,
      token_role: token.token_role ?? null,
    };
  }

  const matchingCandidate = token.candidates.find(
    (candidate) =>
      candidateMatchesSlot(
        candidate,
        slot,
        membershipsByClass,
      ),
  );

  if (!matchingCandidate) {
    return null;
  }

  return {
    token_index: token.index,
    surface: token.surface,
    candidate: matchingCandidate,
    token_role: token.token_role ?? null,
  };
}

function violatesNeighbourConstraint(
  tokens: GrammarToken[],
  tokenPosition: number,
  slot: TokenSequenceSlot,
): boolean {
  if (slot.forbidden_previous_token) {
    const previousToken =
      tokenPosition > 0
        ? tokens[tokenPosition - 1]
        : null;

    if (
      previousToken &&
      tokenMatchesLiteral(
        previousToken,
        slot.forbidden_previous_token,
      )
    ) {
      return true;
    }
  }

  if (slot.forbidden_next_token) {
    const nextToken =
      tokenPosition < tokens.length - 1
        ? tokens[tokenPosition + 1]
        : null;

    if (
      nextToken &&
      tokenMatchesLiteral(
        nextToken,
        slot.forbidden_next_token,
      )
    ) {
      return true;
    }
  }

  return false;
}

function toSlotBinding(
  slot: TokenSequenceSlot,
  binding: CandidateBinding,
): SlotBinding {
  return {
    slot: slot.slot,

    token_index: binding.token_index,
    surface: binding.surface,

    lexeme_id:
      binding.candidate?.lexeme_id ?? null,

    lemma:
      binding.candidate?.lemma ?? null,

    pos:
      binding.candidate?.pos ?? null,

    form_types:
      binding.candidate?.form_types ?? [],

    token_role: binding.token_role,
  };
}

function buildRuleTrace(
  rule: GrammarRule,
  slotBindings: Record<string, SlotBinding>,
): Array<Record<string, JsonValue>> {
  return Object.values(slotBindings).map(
    (binding) => ({
      type: 'slot_match',

      rule_id: rule.id,
      rule_code: rule.code,

      slot: binding.slot,

      token_index: binding.token_index,
      surface: binding.surface,

      lexeme_id: binding.lexeme_id,
      lemma: binding.lemma,
      pos: binding.pos,

      form_types: binding.form_types,
      token_role: binding.token_role,
    }),
  );
}

function matchTokenSequenceAt(
  tokens: GrammarToken[],
  rule: GrammarRule,
  startPosition: number,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): RuleMatch | null {
  const slots = rule.pattern?.slots ?? [];

  if (slots.length === 0) {
    return null;
  }

  const slotBindings: Record<
    string,
    SlotBinding
  > = {};

  let currentPosition = startPosition;

  let firstMatchedPosition: number | null = null;
  let lastMatchedPosition: number | null = null;

  for (
    let slotIndex = 0;
    slotIndex < slots.length;
    slotIndex++
  ) {
    const slot = slots[slotIndex];

    const minimumGap =
      slotIndex === 0
        ? 0
        : Math.max(0, slot.min_gap ?? 0);

    const maximumGap =
      slotIndex === 0
        ? 0
        : Math.max(
            minimumGap,
            slot.max_gap ?? minimumGap,
          );

    const searchStart =
      slotIndex === 0
        ? currentPosition
        : currentPosition + minimumGap;

    const searchEnd =
      slotIndex === 0
        ? currentPosition
        : Math.min(
            tokens.length - 1,
            currentPosition + maximumGap,
          );

    let matchedBinding: CandidateBinding | null =
      null;

    let matchedPosition: number | null = null;

    for (
      let candidatePosition = searchStart;
      candidatePosition <= searchEnd;
      candidatePosition++
    ) {
      const token = tokens[candidatePosition];

      if (!token) {
        continue;
      }

      if (
        violatesNeighbourConstraint(
          tokens,
          candidatePosition,
          slot,
        )
      ) {
        continue;
      }

      const binding = matchSlotAgainstToken(
        token,
        slot,
        membershipsByClass,
      );

      if (binding) {
        matchedBinding = binding;
        matchedPosition = candidatePosition;
        break;
      }
    }

    if (
      !matchedBinding ||
      matchedPosition === null
    ) {
      if (slot.optional === true) {
        continue;
      }

      return null;
    }

    slotBindings[slot.slot] = toSlotBinding(
      slot,
      matchedBinding,
    );

    if (firstMatchedPosition === null) {
      firstMatchedPosition = matchedPosition;
    }

    lastMatchedPosition = matchedPosition;

    /*
     * currentPosition is the next token after the
     * currently matched slot.
     *
     * For the next required slot with min_gap=0,
     * search starts exactly at the following token.
     */
    currentPosition = matchedPosition + 1;
  }

  if (
    firstMatchedPosition === null ||
    lastMatchedPosition === null
  ) {
    return null;
  }

  return {
    matched: true,

    rule_id: rule.id,
    rule_code: rule.code,

    pattern_type: rule.pattern_type,

    token_start:
      tokens[firstMatchedPosition]?.index ?? null,

    token_end:
      tokens[lastMatchedPosition]?.index ?? null,

    slot_bindings: slotBindings,

    result: rule.result ?? {},
    actions: rule.parser_actions ?? [],
    explanations: rule.learning_explanation ?? {},

    priority: Number(rule.priority ?? 0),
    confidence: Number(
      rule.base_confidence ?? 1,
    ),

    trace: buildRuleTrace(
      rule,
      slotBindings,
    ),
  };
}

function matchTokenSequence(
  tokens: GrammarToken[],
  rule: GrammarRule,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (
    let startPosition = 0;
    startPosition < tokens.length;
    startPosition++
  ) {
    const match = matchTokenSequenceAt(
      tokens,
      rule,
      startPosition,
      membershipsByClass,
    );

    if (match) {
      matches.push(match);
    }
  }

  return matches;
}

function matchRule(
  tokens: GrammarToken[],
  rule: GrammarRule,
  membershipsByClass: Map<
    string,
    LexicalClassMembership[]
  >,
): RuleMatch[] {
  switch (rule.pattern_type) {
    case 'token_sequence':
      return matchTokenSequence(
        tokens,
        rule,
        membershipsByClass,
      );

    default:
      console.warn(
        '[GRAMMAR ENGINE] Unsupported pattern type',
        {
          ruleCode: rule.code,
          patternType: rule.pattern_type,
        },
      );

      return [];
  }
}

function cloneJsonValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneTokens(
  tokens: GrammarToken[],
): GrammarToken[] {
  return tokens.map((token) => ({
    ...token,

    candidates: token.candidates.map(
      (candidate) => ({
        ...candidate,

        form_types: [
          ...(candidate.form_types ?? []),
        ],

        sources: candidate.sources
          ? [...candidate.sources]
          : undefined,

        evidence:
          candidate.evidence === undefined
            ? undefined
            : cloneJsonValue(candidate.evidence),

        score: Number(candidate.score ?? 0),

        trace: [
          ...(candidate.trace ?? []),
        ],
      }),
    ),
  }));
}

function candidateMatchesAction(
  candidate: LexicalCandidate,
  action: GrammarAction,
  binding: SlotBinding,
): boolean {
  if (
    binding.lexeme_id &&
    candidate.lexeme_id !== binding.lexeme_id
  ) {
    return false;
  }

  if (
    action.candidate_pos &&
    normalizeText(candidate.pos) !==
      normalizeText(action.candidate_pos)
  ) {
    return false;
  }

  if (
    action.candidate_form_type &&
    !candidateHasFormType(
      candidate,
      action.candidate_form_type,
    )
  ) {
    return false;
  }

  return true;
}

function applyCandidateScoreAction(
  tokens: GrammarToken[],
  match: RuleMatch,
  action: GrammarAction,
): Record<string, JsonValue> | null {
  if (
    !action.slot ||
    typeof action.delta !== 'number'
  ) {
    return null;
  }

  const binding =
    match.slot_bindings[action.slot];

  if (
    !binding ||
    binding.lexeme_id === null
  ) {
    return null;
  }

  const token = tokens.find(
    (item) =>
      item.index === binding.token_index,
  );

  if (!token) {
    return null;
  }

  const candidate = token.candidates.find(
    (item) =>
      candidateMatchesAction(
        item,
        action,
        binding,
      ),
  );

  if (!candidate) {
    return null;
  }

  const scoreBefore = Number(
    candidate.score ?? 0,
  );

  const scoreAfter =
    scoreBefore + action.delta;

  candidate.score = scoreAfter;

  const traceEntry: CandidateTraceEntry = {
    type: 'grammar_score',

    rule_id: match.rule_id,
    rule_code: match.rule_code,

    slot: action.slot,

    delta: action.delta,

    score_before: scoreBefore,
    score_after: scoreAfter,

    reason:
      `Matched grammar rule ${match.rule_code} ` +
      `for slot ${action.slot}.`,
  };

  candidate.trace = [
    ...(candidate.trace ?? []),
    traceEntry,
  ];

  return {
    type: 'candidate_score_applied',

    rule_id: match.rule_id,
    rule_code: match.rule_code,

    slot: action.slot,

    token_index: binding.token_index,

    lexeme_id: candidate.lexeme_id,
    lemma: candidate.lemma,
    pos: candidate.pos,

    form_types: candidate.form_types,

    delta: action.delta,

    score_before: scoreBefore,
    score_after: scoreAfter,
  };
}

function createConstructionFromAction(
  match: RuleMatch,
  action: GrammarAction,
): GrammarConstruction | null {
  if (
    match.token_start === null ||
    match.token_end === null
  ) {
    return null;
  }

  const actionConstructionType =
    typeof action.construction_type === 'string'
      ? action.construction_type
      : null;

  const resultConstructionType =
    typeof match.result.construction_type ===
      'string'
      ? match.result.construction_type
      : null;

  const constructionType =
    actionConstructionType ??
    resultConstructionType;

  if (!constructionType) {
    return null;
  }

  return {
    rule_id: match.rule_id,
    rule_code: match.rule_code,

    construction_type: constructionType,

    token_start: match.token_start,
    token_end: match.token_end,

    confidence: match.confidence,
    priority: match.priority,

    slot_bindings: cloneJsonValue(
      match.slot_bindings,
    ),

    result: cloneJsonValue(match.result),

    explanations: cloneJsonValue(
      match.explanations,
    ),
  };
}

function constructionKey(
  construction: GrammarConstruction,
): string {
  return [
    construction.rule_id,
    construction.construction_type,
    construction.token_start,
    construction.token_end,
  ].join(':');
}

function applyGrammarActions(
  originalTokens: GrammarToken[],
  matches: RuleMatch[],
  dryRun: boolean,
): AppliedActionsResult {
  const tokens = cloneTokens(originalTokens);

  const constructions: GrammarConstruction[] =
    [];

  const constructionKeys = new Set<string>();

  const actionTrace: Array<
    Record<string, JsonValue>
  > = [];

  if (dryRun) {
    return {
      tokens,
      constructions,
      action_trace: [
        {
          type: 'dry_run',
          message:
            'Pattern matching completed, but grammar actions were not applied.',
        },
      ],
    };
  }

  for (const match of matches) {
    for (const action of match.actions ?? []) {
      switch (action.action) {
        case 'add_candidate_score': {
          const traceEntry =
            applyCandidateScoreAction(
              tokens,
              match,
              action,
            );

          if (traceEntry) {
            actionTrace.push(traceEntry);
          } else {
            actionTrace.push({
              type: 'action_not_applied',

              rule_id: match.rule_id,
              rule_code: match.rule_code,

              action: action.action,

              reason:
                'No candidate matching the action and slot binding was found.',
            });
          }

          break;
        }

        case 'create_construction': {
          const construction =
            createConstructionFromAction(
              match,
              action,
            );

          if (!construction) {
            actionTrace.push({
              type: 'action_not_applied',

              rule_id: match.rule_id,
              rule_code: match.rule_code,

              action: action.action,

              reason:
                'Construction could not be created from the match.',
            });

            break;
          }

          const key =
            constructionKey(construction);

          if (!constructionKeys.has(key)) {
            constructionKeys.add(key);
            constructions.push(construction);

            actionTrace.push({
              type: 'construction_created',

              rule_id: match.rule_id,
              rule_code: match.rule_code,

              construction_type:
                construction.construction_type,

              token_start:
                construction.token_start,

              token_end:
                construction.token_end,
            });
          }

          break;
        }

        default:
          actionTrace.push({
            type: 'unsupported_action',

            rule_id: match.rule_id,
            rule_code: match.rule_code,

            action: action.action,
          });
      }
    }
  }

  for (const token of tokens) {
    token.candidates.sort(
      (left, right) => {
        const scoreDifference =
          Number(right.score ?? 0) -
          Number(left.score ?? 0);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const priorityDifference =
          Number(right.base_priority ?? 0) -
          Number(left.base_priority ?? 0);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        const confidenceDifference =
          confidenceRank(
            right.base_confidence,
          ) -
          confidenceRank(
            left.base_confidence,
          );

        if (confidenceDifference !== 0) {
          return confidenceDifference;
        }

        const lemmaDifference =
          left.lemma.localeCompare(
            right.lemma,
            'nb-NO',
          );

        if (lemmaDifference !== 0) {
          return lemmaDifference;
        }

        return left.pos.localeCompare(
          right.pos,
          'nb-NO',
        );
      },
    );
  }

  constructions.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (
      left.token_start !== right.token_start
    ) {
      return (
        left.token_start -
        right.token_start
      );
    }

    if (left.token_end !== right.token_end) {
      return left.token_end - right.token_end;
    }

    return left.rule_code.localeCompare(
      right.rule_code,
    );
  });

  return {
    tokens,
    constructions,
    action_trace: actionTrace,
  };
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

async function loadRules(
  supabase: ReturnType<typeof createClient>,
  ruleCodes?: string[],
): Promise<GrammarRule[]> {
  let query = supabase
    .from('grammar_rules')
    .select(`
      id,
      code,
      category,
      subcategory,
      pattern_type,
      pattern,
      result,
      parser_actions,
      learning_explanation,
      diagnostics,
      examples,
      priority,
      base_confidence,
      version
    `)
    .eq('is_active', true)
    .order('priority', {
      ascending: false,
    });

  if (ruleCodes?.length) {
    query = query.in('code', ruleCodes);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to load grammar rules: ${error.message}`,
    );
  }

  return (data ?? []) as GrammarRule[];
}

async function loadLexicalClassMemberships(
  supabase: ReturnType<typeof createClient>,
): Promise<
  Map<string, LexicalClassMembership[]>
> {
  const { data, error } = await supabase
    .from(
      'grammar_lexical_class_members',
    )
    .select(`
      lexeme_id,
      normalized_lemma,
      pos,
      grammar_lexical_classes!inner (
        code
      )
    `)
    .eq('is_active', true)
    .eq(
      'grammar_lexical_classes.is_active',
      true,
    );

  if (error) {
    throw new Error(
      `Failed to load lexical class memberships: ${error.message}`,
    );
  }

  const result = new Map<
    string,
    LexicalClassMembership[]
  >();

  for (const row of data ?? []) {
    const relation =
      row.grammar_lexical_classes as
        | { code?: string }
        | Array<{ code?: string }>
        | null;

    const classCode = Array.isArray(
      relation,
    )
      ? relation[0]?.code
      : relation?.code;

    if (!classCode) {
      continue;
    }

    const normalizedClassCode =
      normalizeText(classCode);

    const membership: LexicalClassMembership =
      {
        class_code:
          normalizedClassCode,

        lexeme_id:
          row.lexeme_id ?? null,

        normalized_lemma:
          row.normalized_lemma ?? null,

        pos:
          row.pos ?? null,
      };

    const existing =
      result.get(normalizedClassCode) ?? [];

    existing.push(membership);

    result.set(
      normalizedClassCode,
      existing,
    );
  }

  return result;
}

function validateCandidate(
  candidate: unknown,
  tokenIndex: number,
): asserts candidate is LexicalCandidate {
  if (
    !candidate ||
    typeof candidate !== 'object'
  ) {
    throw new Error(
      `Token ${tokenIndex}: every candidate must be an object.`,
    );
  }

  const value =
    candidate as Partial<LexicalCandidate>;

  if (
    typeof value.lexeme_id !== 'string' ||
    !value.lexeme_id.trim()
  ) {
    throw new Error(
      `Token ${tokenIndex}: candidate.lexeme_id must be a non-empty string.`,
    );
  }

  if (
    typeof value.lemma !== 'string' ||
    !value.lemma.trim()
  ) {
    throw new Error(
      `Token ${tokenIndex}: candidate.lemma must be a non-empty string.`,
    );
  }

  if (
    typeof value.pos !== 'string' ||
    !value.pos.trim()
  ) {
    throw new Error(
      `Token ${tokenIndex}: candidate.pos must be a non-empty string.`,
    );
  }

  if (!Array.isArray(value.form_types)) {
    throw new Error(
      `Token ${tokenIndex}: candidate.form_types must be an array.`,
    );
  }
}

function validateRequest(
  body: unknown,
): EngineRequest {
  if (
    !body ||
    typeof body !== 'object'
  ) {
    throw new RequestValidationError(
      'Request body must be a JSON object.',
    );
  }

  const request =
    body as Partial<EngineRequest>;

  if (!Array.isArray(request.tokens)) {
    const receivedKeys =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body)
        ? Object.keys(body as Record<string, unknown>)
        : [];

    throw new RequestValidationError(
      'Body must contain a tokens array.',
      {
        received_type: Array.isArray(body)
          ? 'array'
          : typeof body,
        received_keys: receivedKeys,
        expected_example: {
          tokens: [],
        },
      },
    );
  }

  const seenTokenIndexes =
    new Set<number>();

  for (const token of request.tokens) {
    if (
      !token ||
      typeof token !== 'object'
    ) {
      throw new Error(
        'Each token must be an object.',
      );
    }

    if (
      typeof token.index !== 'number' ||
      !Number.isInteger(token.index)
    ) {
      throw new Error(
        'Each token.index must be an integer.',
      );
    }

    if (
      seenTokenIndexes.has(token.index)
    ) {
      throw new Error(
        `Duplicate token index: ${token.index}.`,
      );
    }

    seenTokenIndexes.add(token.index);

    if (
      typeof token.surface !== 'string' ||
      !token.surface.trim()
    ) {
      throw new Error(
        `Token ${token.index}: surface must be a non-empty string.`,
      );
    }

    if (
      typeof token.normalized_surface !==
        'string'
    ) {
      throw new Error(
        `Token ${token.index}: normalized_surface must be a string.`,
      );
    }

    if (!Array.isArray(token.candidates)) {
      throw new Error(
        `Token ${token.index}: candidates must be an array.`,
      );
    }

    for (const candidate of token.candidates) {
      validateCandidate(
        candidate,
        token.index,
      );
    }
  }

  if (
    request.ruleCodes !== undefined &&
    (
      !Array.isArray(request.ruleCodes) ||
      request.ruleCodes.some(
        (code) =>
          typeof code !== 'string' ||
          !code.trim(),
      )
    )
  ) {
    throw new Error(
      'ruleCodes must be an array of non-empty strings.',
    );
  }

  if (
    request.dryRun !== undefined &&
    typeof request.dryRun !== 'boolean'
  ) {
    throw new Error(
      'dryRun must be a boolean.',
    );
  }

  return {
    tokens: [...request.tokens].sort(
      (left, right) =>
        left.index - right.index,
    ),

    ruleCodes: request.ruleCodes,

    dryRun: request.dryRun ?? false,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    });
  }

  try {
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          ok: false,
          engine_version: ENGINE_VERSION,
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            'Content-Type':
              'application/json',
          },
        },
      );
    }

    const parsedBody = await readJsonBody(request);

    const requestBody = validateRequest(
      parsedBody,
    );

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const [
      rules,
      membershipsByClass,
    ] = await Promise.all([
      loadRules(
        supabase,
        requestBody.ruleCodes,
      ),

      loadLexicalClassMemberships(
        supabase,
      ),
    ]);

    const matches: RuleMatch[] = [];

    for (const rule of rules) {
      matches.push(
        ...matchRule(
          requestBody.tokens,
          rule,
          membershipsByClass,
        ),
      );
    }

    matches.sort((left, right) => {
      if (
        right.priority !== left.priority
      ) {
        return (
          right.priority -
          left.priority
        );
      }

      if (
        left.token_start !== null &&
        right.token_start !== null &&
        left.token_start !==
          right.token_start
      ) {
        return (
          left.token_start -
          right.token_start
        );
      }

      if (
        left.token_end !== null &&
        right.token_end !== null &&
        left.token_end !== right.token_end
      ) {
        return (
          left.token_end -
          right.token_end
        );
      }

      return left.rule_code.localeCompare(
        right.rule_code,
      );
    });

    const appliedActions =
      applyGrammarActions(
        requestBody.tokens,
        matches,
        requestBody.dryRun ?? false,
      );

    const unsupportedActionCount =
      appliedActions.action_trace.filter(
        (entry) =>
          entry.type ===
          'unsupported_action',
      ).length;

    const appliedActionCount =
      appliedActions.action_trace.filter(
        (entry) =>
          entry.type ===
            'candidate_score_applied' ||
          entry.type ===
            'construction_created',
      ).length;

    const responseBody: EngineResponse = {
      ok: true,

      engine_version: ENGINE_VERSION,

      dry_run:
        requestBody.dryRun ?? false,

      tokens: appliedActions.tokens,

      matches,

      constructions:
        appliedActions.constructions,

      action_trace:
        appliedActions.action_trace,

      summary: {
        token_count:
          requestBody.tokens.length,

        rule_count:
          rules.length,

        match_count:
          matches.length,

        construction_count:
          appliedActions
            .constructions.length,

        applied_action_count:
          appliedActionCount,

        unsupported_action_count:
          unsupportedActionCount,
      },
    };

    return new Response(
      JSON.stringify(responseBody),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':
            'application/json',
        },
      },
    );
  } catch (error) {
    const isValidationError =
      error instanceof RequestValidationError;

    console.error(
      isValidationError
        ? '[GRAMMAR PATTERN ENGINE REQUEST ERROR]'
        : '[GRAMMAR PATTERN ENGINE ERROR]',
      error,
    );

    return new Response(
      JSON.stringify({
        ok: false,

        engine_version:
          ENGINE_VERSION,

        error:
          error instanceof Error
            ? error.message
            : String(error),

        details:
          isValidationError
            ? error.details ?? null
            : null,
      }),
      {
        status:
          isValidationError
            ? error.status
            : 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':
            'application/json',
        },
      },
    );
  }
});
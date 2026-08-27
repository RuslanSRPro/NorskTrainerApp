// supabase/functions/clause-pattern-engine/index.ts
// Norsk Trainer — Clause Pattern Engine v1.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

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
  selection_status: 'only_candidate' | 'preferred' | 'tied' | 'weak_preference';
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
  construction_tree_root_id: string;
  construction_ids: string[];
  root_construction_type: string;
  semantic_construction_id: string;
  semantic_construction_type: string;
  construction_tree_depth: number;
};

type SentenceModel = {
  model_version: string;
  predicate_contract_version?: string;
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

type ClauseSequencePattern = {
  subject: { lexical_class: string };
  predicate: {
    required?: boolean;
    requires_finite_member?: boolean;
    construction_type?: string;

    // Deprecated compatibility field.
    // New rules must use requires_finite_member instead.
    finite_member_role?: string;
  };
  order?: ['subject', 'predicate'];
  max_gap?: number;
};

type ClauseRule = {
  id: string;
  code: string;
  category: string;
  subcategory: string | null;
  pattern_type: 'clause_sequence';
  pattern: ClauseSequencePattern;
  result: Record<string, JsonValue>;
  parser_actions: JsonValue[];
  learning_explanation: Record<string, JsonValue>;
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

type SubjectBinding = {
  token_index: number;
  surface: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
};

type ClauseMatch = {
  matched: true;
  rule_id: string;
  rule_code: string;
  pattern_type: 'clause_sequence';
  subject: SubjectBinding;
  predicate_id: string;
  token_start: number;
  token_end: number;
  result: Record<string, JsonValue>;
  explanations: Record<string, JsonValue>;
  priority: number;
  confidence: number;
  trace: Array<Record<string, JsonValue>>;
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

type ClauseEngineRequest = {
  sentence_model: SentenceModel;
  ruleCodes?: string[];
};

const ENGINE_VERSION = 'clause-pattern-engine-v1.3';
const CLAUSE_CONTRACT_VERSION = 'clause-frame-v1.0';
const PREDICATE_CONTRACT_VERSION = 'predicate-frame-v1.0';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

class RequestValidationError extends Error {
  status = 400;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase('nb-NO');
}

function membershipMatchesCandidate(
  membership: LexicalClassMembership,
  candidate: SelectedCandidate,
): boolean {
  if (membership.lexeme_id && membership.lexeme_id === candidate.lexeme_id) {
    return true;
  }

  return Boolean(
    membership.normalized_lemma &&
      normalizeText(membership.normalized_lemma) === normalizeText(candidate.lemma) &&
      (!membership.pos || normalizeText(membership.pos) === normalizeText(candidate.pos)),
  );
}

function candidateBelongsToClass(
  candidate: SelectedCandidate,
  classCode: string,
  membershipsByClass: Map<string, LexicalClassMembership[]>,
): boolean {
  const memberships = membershipsByClass.get(normalizeText(classCode)) ?? [];
  return memberships.some((membership) =>
    membershipMatchesCandidate(membership, candidate)
  );
}

function predicateMatchesFiniteConstraint(
  predicate: PredicateFrame,
  predicatePattern: ClauseSequencePattern['predicate'] | undefined,
): boolean {
  if (!predicatePattern) return true;

  if (
    predicatePattern.requires_finite_member === true &&
    predicate.finite_member === null
  ) {
    return false;
  }

  // Transitional compatibility for rules created before PredicateFrame
  // received the generic finite_member field. New clause rules must not
  // use this field.
  const legacyRequiredRole = predicatePattern.finite_member_role;

  if (legacyRequiredRole) {
    return Boolean(
      predicate.finite_member &&
        normalizeText(predicate.finite_member.role) ===
          normalizeText(legacyRequiredRole),
    );
  }

  return true;
}

function matchClauseRule(
  model: SentenceModel,
  rule: ClauseRule,
  membershipsByClass: Map<string, LexicalClassMembership[]>,
): ClauseMatch[] {
  const matches: ClauseMatch[] = [];
  const subjectClass = rule.pattern?.subject?.lexical_class;
  if (!subjectClass) return matches;

  const maxGap = Math.max(0, Number(rule.pattern.max_gap ?? 0));

  for (const predicate of model.predicates) {
    const requiredConstructionType = rule.pattern.predicate?.construction_type;

    if (
      requiredConstructionType &&
      normalizeText(predicate.construction_type) !== normalizeText(requiredConstructionType)
    ) {
      continue;
    }

    if (
      !predicateMatchesFiniteConstraint(
        predicate,
        rule.pattern.predicate,
      )
    ) {
      continue;
    }

    for (const token of model.tokens) {
      const selected = token.selected_candidate;
      if (!selected) continue;

      if (!candidateBelongsToClass(selected, subjectClass, membershipsByClass)) {
        continue;
      }

      const distance = predicate.token_start - token.token_index - 1;
      if (
        token.token_index >= predicate.token_start ||
        distance < 0 ||
        distance > maxGap
      ) {
        continue;
      }

      const subject: SubjectBinding = {
        token_index: token.token_index,
        surface: token.surface,
        lexeme_id: selected.lexeme_id,
        lemma: selected.lemma,
        pos: selected.pos,
      };

      matches.push({
        matched: true,
        rule_id: rule.id,
        rule_code: rule.code,
        pattern_type: 'clause_sequence',
        subject,
        predicate_id: predicate.id,
        token_start: subject.token_index,
        token_end: predicate.token_end,
        result: rule.result ?? {},
        explanations: rule.learning_explanation ?? {},
        priority: Number(rule.priority ?? 0),
        confidence: Number(rule.base_confidence ?? 1),
        trace: [
          {
            type: 'subject_class_match',
            rule_code: rule.code,
            lexical_class: subjectClass,
            token_index: subject.token_index,
            lexeme_id: subject.lexeme_id,
            lemma: subject.lemma,
            pos: subject.pos,
          },
          {
            type: 'predicate_match',
            rule_code: rule.code,
            predicate_id: predicate.id,
            // Deprecated compatibility alias for root_construction_type.
            construction_type: predicate.construction_type,
            root_construction_type: predicate.root_construction_type,
            semantic_construction_id: predicate.semantic_construction_id,
            semantic_construction_type:
              predicate.semantic_construction_type,
            construction_tree_depth:
              predicate.construction_tree_depth,
            construction_tree_root_id:
              predicate.construction_tree_root_id,
            construction_ids: predicate.construction_ids,
            predicate_contract_version:
              predicate.predicate_contract_version,
            requires_finite_member:
              rule.pattern.predicate?.requires_finite_member ?? false,
            finite_member:
              predicate.finite_member === null
                ? null
                : {
                    role: predicate.finite_member.role,
                    slot: predicate.finite_member.slot,
                    token_index: predicate.finite_member.token_index,
                    surface: predicate.finite_member.surface,
                    lemma: predicate.finite_member.lemma,
                    form_types: predicate.finite_member.form_types,
                  },
            legacy_finite_member_role:
              rule.pattern.predicate?.finite_member_role ?? null,
          },
        ],
      });
    }
  }

  return matches;
}

function createClause(match: ClauseMatch): ClauseObject {
  const clauseType =
    typeof match.result.clause_type === 'string'
      ? match.result.clause_type
      : 'main_declarative';

  return {
    id: [match.rule_id, match.token_start, match.token_end].join(':'),
    clause_type: clauseType,
    rule_id: match.rule_id,
    rule_code: match.rule_code,
    token_start: match.token_start,
    token_end: match.token_end,
    subject: match.subject,
    predicate_id: match.predicate_id,
    confidence: match.confidence,
    priority: match.priority,
    explanations: match.explanations,
    source_result: match.result,
  };
}

async function loadClauseRules(
  supabase: ReturnType<typeof createClient>,
  ruleCodes?: string[],
): Promise<ClauseRule[]> {
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
      priority,
      base_confidence,
      version
    `)
    .eq('is_active', true)
    .eq('pattern_type', 'clause_sequence')
    .order('priority', { ascending: false });

  if (ruleCodes?.length) query = query.in('code', ruleCodes);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load clause rules: ${error.message}`);
  }

  return (data ?? []) as ClauseRule[];
}

async function loadLexicalClassMemberships(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, LexicalClassMembership[]>> {
  const { data, error } = await supabase
    .from('grammar_lexical_class_members')
    .select(`
      lexeme_id,
      normalized_lemma,
      pos,
      grammar_lexical_classes!inner (
        code
      )
    `)
    .eq('is_active', true)
    .eq('grammar_lexical_classes.is_active', true);

  if (error) {
    throw new Error(`Failed to load lexical class memberships: ${error.message}`);
  }

  const result = new Map<string, LexicalClassMembership[]>();

  for (const row of data ?? []) {
    const relation = row.grammar_lexical_classes as
      | { code?: string }
      | Array<{ code?: string }>
      | null;

    const classCode = Array.isArray(relation)
      ? relation[0]?.code
      : relation?.code;

    if (!classCode) continue;

    const normalizedClass = normalizeText(classCode);
    const existing = result.get(normalizedClass) ?? [];

    existing.push({
      class_code: normalizedClass,
      lexeme_id: row.lexeme_id ?? null,
      normalized_lemma: row.normalized_lemma ?? null,
      pos: row.pos ?? null,
    });

    result.set(normalizedClass, existing);
  }

  return result;
}

function validateSentenceModel(value: unknown): asserts value is SentenceModel {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('sentence_model must be an object.');
  }

  const model = value as Partial<SentenceModel>;
  if (!Array.isArray(model.tokens)) {
    throw new RequestValidationError('sentence_model.tokens must be an array.');
  }
  if (!Array.isArray(model.predicates)) {
    throw new RequestValidationError('sentence_model.predicates must be an array.');
  }

  for (const predicate of model.predicates) {
    if (
      predicate === null ||
      typeof predicate !== 'object' ||
      typeof predicate.id !== 'string' ||
      typeof predicate.token_start !== 'number' ||
      typeof predicate.token_end !== 'number' ||
      !Array.isArray(predicate.members)
    ) {
      throw new RequestValidationError(
        'Every sentence_model predicate must contain id, token range and members.',
      );
    }

    if (
      predicate.finite_member !== null &&
      (
        typeof predicate.finite_member !== 'object' ||
        typeof predicate.finite_member.slot !== 'string' ||
        typeof predicate.finite_member.role !== 'string' ||
        typeof predicate.finite_member.token_index !== 'number'
      )
    ) {
      throw new RequestValidationError(
        'predicate.finite_member must be null or a valid PredicateMember.',
      );
    }

    if (
      typeof predicate.predicate_contract_version !== 'string' ||
      !predicate.predicate_contract_version.trim()
    ) {
      throw new RequestValidationError(
        'Every predicate must contain predicate_contract_version.',
      );
    }

    if (
      predicate.predicate_contract_version !==
      PREDICATE_CONTRACT_VERSION
    ) {
      throw new RequestValidationError(
        [
          'Unsupported predicate contract version:',
          predicate.predicate_contract_version,
          `Expected ${PREDICATE_CONTRACT_VERSION}.`,
        ].join(' '),
      );
    }

    if (
      typeof predicate.construction_tree_root_id !== 'string' ||
      !Array.isArray(predicate.construction_ids) ||
      typeof predicate.root_construction_type !== 'string' ||
      typeof predicate.semantic_construction_id !== 'string' ||
      typeof predicate.semantic_construction_type !== 'string' ||
      typeof predicate.construction_tree_depth !== 'number'
    ) {
      throw new RequestValidationError(
        'Every predicate must contain canonical construction provenance fields.',
      );
    }

    if (
      predicate.construction_ids.length === 0 ||
      predicate.construction_ids[0] !==
        predicate.construction_tree_root_id
    ) {
      throw new RequestValidationError(
        'predicate.construction_ids[0] must equal construction_tree_root_id.',
      );
    }

    if (
      !predicate.construction_ids.includes(
        predicate.semantic_construction_id,
      )
    ) {
      throw new RequestValidationError(
        'predicate.semantic_construction_id must be present in construction_ids.',
      );
    }
  }
}

function validateRequest(body: unknown): ClauseEngineRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }

  const request = body as Partial<ClauseEngineRequest>;
  validateSentenceModel(request.sentence_model);

  if (
    request.ruleCodes !== undefined &&
    (!Array.isArray(request.ruleCodes) ||
      request.ruleCodes.some((item) => typeof item !== 'string' || !item.trim()))
  ) {
    throw new RequestValidationError(
      'ruleCodes must be an array of non-empty strings.',
    );
  }

  return {
    sentence_model: request.sentence_model,
    ruleCodes: request.ruleCodes,
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new RequestValidationError('Request body is empty.');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new RequestValidationError('Request body is not valid JSON.');
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    if (request.method !== 'POST') {
      return jsonResponse(
        { ok: false, engine_version: ENGINE_VERSION, clause_contract_version: CLAUSE_CONTRACT_VERSION, error: 'Method not allowed.' },
        405,
      );
    }

    const requestBody = validateRequest(await readJsonBody(request));
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [rules, membershipsByClass] = await Promise.all([
      loadClauseRules(supabase, requestBody.ruleCodes),
      loadLexicalClassMemberships(supabase),
    ]);

    const matches: ClauseMatch[] = [];
    for (const rule of rules) {
      matches.push(
        ...matchClauseRule(
          requestBody.sentence_model,
          rule,
          membershipsByClass,
        ),
      );
    }

    matches.sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.token_start - right.token_start;
    });

    const clauses = matches.map(createClause);

    return jsonResponse({
      ok: true,
      engine_version: ENGINE_VERSION,
      clause_contract_version: CLAUSE_CONTRACT_VERSION,
      predicate_contract_version:
        requestBody.sentence_model.predicates[0]
          ?.predicate_contract_version ??
        requestBody.sentence_model.predicate_contract_version ??
        PREDICATE_CONTRACT_VERSION,
      matches,
      clauses,
      summary: {
        rule_count: rules.length,
        predicate_count: requestBody.sentence_model.predicates.length,
        finite_predicate_count:
          requestBody.sentence_model.predicates.filter(
            (predicate) => predicate.finite_member !== null,
          ).length,
        match_count: matches.length,
        clause_count: clauses.length,
      },
    });
  } catch (error) {
    const validation = error instanceof RequestValidationError;

    console.error(
      validation ? '[CLAUSE PATTERN REQUEST ERROR]' : '[CLAUSE PATTERN ERROR]',
      error,
    );

    return jsonResponse(
      {
        ok: false,
        engine_version: ENGINE_VERSION,
        clause_contract_version: CLAUSE_CONTRACT_VERSION,
        error: error instanceof Error ? error.message : String(error),
      },
      validation ? validation.status : 500,
    );
  }
});
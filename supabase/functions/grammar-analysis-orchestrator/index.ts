// supabase/functions/grammar-analysis-orchestrator/index.ts
//
// Norsk Trainer
// Grammar Analysis Orchestrator v1.11
//
// Pipeline:
//   raw text
//     -> tokenize
//     -> resolve_surface_form_v2 for each token
//     -> infer token roles from active grammar rules
//     -> build GrammarToken[]
//     -> call grammar-pattern-engine
//     -> call construction-resolution-engine
//     -> call predicate-builder
//     -> call clause-pattern-engine
//     -> call dependency-engine
//     -> call language-graph-engine
//     -> return lexical + grammar + clauses + dependencies + sentence model + graph
//
// Responsibilities:
//   1. Accept raw Norwegian text.
//   2. Tokenize it using the shared NLP tokenizer.
//   3. Obtain all lexical candidates from resolve_surface_form_v2.
//   4. Build the stable GrammarToken contract.
//   5. Forward prepared tokens to grammar-pattern-engine.
//   6. Forward construction candidates to construction-resolution-engine.
//   7. Forward ranked tokens and the Construction Model to predicate-builder.
//   8. Forward sentence_model to clause-pattern-engine.
//   9. Forward sentence_model + clauses to dependency-engine.
//  10. Forward dependency-enriched sentence_model to language-graph-engine.
//  11. Return one combined analysis response.
//
// Non-responsibilities:
//   - Does not contain Norwegian grammar rules.
//   - Does not decide what har, hadde, kan or å mean.
//   - Does not score candidates itself.
//   - Does not select the final lexical winner itself.
//   - Does not infer predicates itself.
//   - Does not build graph nodes or edges itself.
//   - Does not perform clause segmentation itself.
//   - Does not infer dependencies itself.
//   - Does not write analysis results to database.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeExpression,
  tokenize,
} from '../_shared/nlp/normalize.ts';

type JsonPrimitive = string | number | boolean | null;

type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = Record<string, JsonValue>;

type SurfaceResolverRow = {
  lexeme_id: string;
  lemma: string;
  pos: string;

  form_types: JsonValue;
  sources: JsonValue;
  evidence: JsonValue;

  base_confidence: string | null;
  base_priority: number | null;

  score: number | null;
  trace: JsonValue;

  is_ambiguous: boolean;
  candidate_count: number;

  resolution_status: string;
  resolution_context: JsonValue;
};


type CompoundComponent = {
  position: number;
  role: 'forledd' | 'etterledd' | 'intermediate_component';
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  surface: string;
  linking_element_after: string | null;
  is_head: boolean;
  metadata: JsonObject;
};

type CompoundAnalysis = {
  analysis_id: string;
  analysis_type: 'compound' | 'derived_compound' | 'multi_level_compound';
  status: 'source_verified' | 'implemented';
  component_count: number;
  head_component_position: number;
  confidence: number;
  components: CompoundComponent[];
};

type LexicalAnalysis = {
  compound_analysis?: CompoundAnalysis;
};

type CompoundAnalysisRow = {
  id: string;
  compound_lexeme_id: string;
  analysis_type: string;
  status: string;
  component_count: number;
  head_component_position: number;
  confidence: number | string | null;
};

type CompoundComponentRow = {
  compound_analysis_id: string;
  component_position: number;
  component_role: string;
  component_lexeme_id: string | null;
  component_surface: string;
  linking_element_after: string | null;
  is_head: boolean;
  metadata: JsonValue;
};

type ComponentLexemeRow = {
  id: string;
  lemma: string;
  pos: string;
};

type LexicalCandidate = {
  lexeme_id: string;
  lemma: string;
  pos: string;

  form_types: string[];
  sources: string[];
  evidence: JsonValue;

  base_confidence: string | null;
  base_priority: number;

  score: number;
  trace: JsonValue[];

  /**
   * Internal lexical enrichment attached to a candidate before selection.
   * Predicate Builder projects the winning candidate's enrichment to
   * sentence_model.tokens[].lexical_analysis.
   */
  lexical_analysis?: LexicalAnalysis;
};

type AnalysisToken = {
  index: number;

  surface: string;
  normalized_surface: string;

  token_role: string | null;

  candidates: LexicalCandidate[];

  lexical_status?: string;
  is_ambiguous?: boolean;
  candidate_count?: number;

  resolution_context?: JsonValue;
};

type GrammarRuleMarkerRow = {
  code: string;
  pattern_type: string;
  pattern: JsonValue;
};

type TokenRoleDefinition = {
  token: string;
  token_role: string;
  source_rule_codes: string[];
};

type ResponseProfile =
  | 'legacy'
  | 'debug'
  | 'model'
  | 'graph'
  | 'compact';

type TraceLevel =
  | 'none'
  | 'errors'
  | 'summary'
  | 'full';

type OrchestratorRequest = {
  text: string;

  ruleCodes?: string[];
  dryRun?: boolean;

  /**
   * New response contract. When omitted, legacy mode preserves the v1.2
   * payload and honours includeSentenceModel/includeLanguageGraph.
   */
  responseProfile?: ResponseProfile;
  traceLevel?: TraceLevel;

  /** Legacy compatibility flags. Used only when responseProfile is omitted
   * or explicitly set to "legacy". */
  includeLexicalDetails?: boolean;
  includeSentenceModel?: boolean;
  includeLanguageGraph?: boolean;

  /**
   * Minimum score advantage used by Predicate Builder
   * to mark the selected candidate as "preferred".
   */
  selectionMargin?: number;
};

type ResolvedExecutionPlan = {
  responseProfile: ResponseProfile;
  traceLevel: TraceLevel;
  legacyMode: boolean;
  includeLexicalDetails: boolean;
  returnSentenceModel: boolean;
  computeLanguageGraph: boolean;
  returnLanguageGraph: boolean;
  returnDebugArtifacts: boolean;
  returnCompactAnalysis: boolean;
  dependencyTraceEnabled: boolean;
};

type GrammarEngineResponse = {
  ok: boolean;
  engine_version?: string;
  dry_run?: boolean;

  tokens?: AnalysisToken[];
  matches?: JsonValue[];
  constructions?: JsonValue[];
  action_trace?: JsonValue[];

  summary?: {
    token_count?: number;
    rule_count?: number;
    match_count?: number;
    construction_count?: number;
    applied_action_count?: number;
    unsupported_action_count?: number;
  };

  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};

type ConstructionResolutionEngineResponse = {
  ok: boolean;
  engine_version?: string;
  construction_model?: JsonObject;
  resolved_constructions?: JsonValue[];
  suppressed_constructions?: JsonValue[];
  composition_links?: JsonValue[];
  relations?: JsonValue[];
  diagnostics?: JsonValue[];
  trace?: JsonValue[];
  summary?: {
    input_construction_count?: number;
    resolved_construction_count?: number;
    suppressed_construction_count?: number;
    composition_link_count?: number;
    relation_count?: number;
    unresolved_overlap_count?: number;
    warning_count?: number;
  };
  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};

type PredicateBuilderResponse = {
  ok: boolean;
  builder_version?: string;
  predicate_contract_version?: string;
  predicate_builder_version?: string;
  /** Deprecated compatibility alias. Remove in v2.0. */
  interpreter_version?: string;
  sentence_model?: JsonObject;
  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};


type ClauseEngineResponse = {
  ok: boolean;
  engine_version?: string;
  clause_contract_version?: string;
  predicate_contract_version?: string;
  matches?: JsonValue[];
  clauses?: JsonValue[];
  summary?: JsonObject;
  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};

type DependencyEngineResponse = {
  ok: boolean;
  engine_version?: string;
  dependency_contract_version?: string;
  predicate_contract_version?: string;
  clause_contract_version?: string;
  dry_run?: boolean;
  rules?: JsonValue[];
  matches?: JsonValue[];
  clauses?: JsonValue[];
  subjects?: JsonValue[];
  objects?: JsonValue[];
  dependencies?: JsonValue[];
  dependency_trace?: JsonValue[];
  diagnostics?: JsonValue[];
  sentence_model?: JsonObject;
  summary?: JsonObject;
  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};

type LanguageGraphEngineResponse = {
  ok: boolean;
  engine_version?: string;
  graph?: JsonObject;
  error?: string;
  details?: JsonValue;

  [key: string]: unknown;
};

type OrchestratorSummary = {
  token_count: number;
  resolved_token_count: number;
  unresolved_token_count: number;
  ambiguous_token_count: number;
  grammar_rule_count: number;
  grammar_match_count: number;
  construction_count: number;
  resolved_construction_count: number;
  suppressed_construction_count: number;
  composition_link_count: number;
  applied_action_count: number;
  unsupported_action_count: number;
  selected_candidate_count: number;
  predicate_count: number;
  finite_predicate_count: number;
  clause_count: number;
  dependency_count: number;
  subject_count: number;
  object_count: number;
  warning_count: number;
  error_count: number;
  graph_node_count: number;
  graph_edge_count: number;
};

type OrchestratorBaseResponse = {
  ok: true;
  orchestrator_version: string;
  response_profile: ResponseProfile;
  trace_level: TraceLevel;
  grammar_engine_version: string | null;
  construction_resolution_engine_version: string | null;
  predicate_builder_version: string | null;
  predicate_contract_version: string | null;
  clause_contract_version: string | null;
  dependency_contract_version: string | null;

  /**
   * Deprecated compatibility alias.
   * Scheduled for removal in orchestrator v2.0.
   */
  interpretation_engine_version: string | null;
  clause_engine_version: string | null;
  dependency_engine_version: string | null;
  language_graph_engine_version: string | null;
  text: string;
  summary: OrchestratorSummary;
  diagnostics: JsonValue[];
};

const ORCHESTRATOR_VERSION =
  'grammar-analysis-orchestrator-v1.12';

const GRAMMAR_ENGINE_FUNCTION =
  'grammar-pattern-engine';

const CONSTRUCTION_RESOLUTION_ENGINE_FUNCTION =
  'construction-resolution-engine';

const PREDICATE_BUILDER_FUNCTION =
  'predicate-builder';

const CLAUSE_ENGINE_FUNCTION =
  'clause-pattern-engine';

const DEPENDENCY_ENGINE_FUNCTION =
  'dependency-engine';

const LANGUAGE_GRAPH_ENGINE_FUNCTION =
  'language-graph-engine';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    },
  );
}

function normalizeText(
  value: string | null | undefined,
): string {
  return normalizeExpression(
    String(value ?? ''),
  );
}

function asStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === 'string',
    )
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function asJsonArray(
  value: unknown,
): JsonValue[] {
  return Array.isArray(value)
    ? value as JsonValue[]
    : [];
}

function isJsonObject(
  value: unknown,
): value is JsonObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function numberFromUnknown(
  value: unknown,
  fallback = 0,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function mapResolverCandidate(
  row: SurfaceResolverRow,
): LexicalCandidate {
  return {
    lexeme_id: row.lexeme_id,
    lemma: row.lemma,
    pos: row.pos,

    form_types: asStringArray(
      row.form_types,
    ),

    sources: asStringArray(
      row.sources,
    ),

    evidence:
      row.evidence ?? [],

    base_confidence:
      row.base_confidence ?? null,

    base_priority:
      Number(row.base_priority ?? 0),

    score:
      Number(row.score ?? 0),

    trace:
      asJsonArray(row.trace),
  };
}

function extractTokenRoleDefinitions(
  rules: GrammarRuleMarkerRow[],
): TokenRoleDefinition[] {
  const roleMap = new Map<
    string,
    TokenRoleDefinition
  >();

  for (const rule of rules) {
    if (
      rule.pattern_type !==
      'token_sequence'
    ) {
      continue;
    }

    if (!isJsonObject(rule.pattern)) {
      continue;
    }

    const slots = rule.pattern.slots;

    if (!Array.isArray(slots)) {
      continue;
    }

    for (const rawSlot of slots) {
      if (!isJsonObject(rawSlot)) {
        continue;
      }

      const token =
        typeof rawSlot.token === 'string'
          ? normalizeText(rawSlot.token)
          : '';

      const tokenRole =
        typeof rawSlot.token_role ===
          'string'
          ? normalizeText(
              rawSlot.token_role,
            )
          : '';

      if (!token || !tokenRole) {
        continue;
      }

      const key =
        `${token}::${tokenRole}`;

      const existing =
        roleMap.get(key);

      if (existing) {
        if (
          !existing.source_rule_codes
            .includes(rule.code)
        ) {
          existing.source_rule_codes.push(
            rule.code,
          );
        }

        continue;
      }

      roleMap.set(key, {
        token,
        token_role: tokenRole,
        source_rule_codes: [
          rule.code,
        ],
      });
    }
  }

  return Array.from(roleMap.values())
    .sort((left, right) => {
      const tokenDifference =
        left.token.localeCompare(
          right.token,
          'nb-NO',
        );

      if (tokenDifference !== 0) {
        return tokenDifference;
      }

      return left.token_role.localeCompare(
        right.token_role,
        'nb-NO',
      );
    });
}

function createTokenRoleLookup(
  definitions: TokenRoleDefinition[],
): Map<string, string> {
  const lookup =
    new Map<string, string>();

  for (const definition of definitions) {
    if (!lookup.has(definition.token)) {
      lookup.set(
        definition.token,
        definition.token_role,
      );
    }
  }

  return lookup;
}

async function loadTokenRoleRules(
  supabase: ReturnType<
    typeof createClient
  >,
  ruleCodes?: string[],
): Promise<GrammarRuleMarkerRow[]> {
  let query = supabase
    .from('grammar_rules')
    .select(`
      code,
      pattern_type,
      pattern
    `)
    .eq('is_active', true)
    .eq(
      'pattern_type',
      'token_sequence',
    );

  if (ruleCodes?.length) {
    query = query.in(
      'code',
      ruleCodes,
    );
  }

  const { data, error } =
    await query;

  if (error) {
    throw new Error(
      `Failed to load grammar rule markers: ${error.message}`,
    );
  }

  return (
    data ?? []
  ) as GrammarRuleMarkerRow[];
}

async function resolveTokenCandidates(
  supabase: ReturnType<
    typeof createClient
  >,
  tokensRaw: string[],
  tokenIndex: number,
  tokenRole: string | null,
): Promise<AnalysisToken> {
  const surface =
    tokensRaw[tokenIndex];

  const normalizedSurface =
    normalizeText(surface);

  const previousToken =
    tokenIndex > 0
      ? tokensRaw[tokenIndex - 1]
      : null;

  const nextToken =
    tokenIndex <
      tokensRaw.length - 1
      ? tokensRaw[tokenIndex + 1]
      : null;

  const precededByInfinitiveMarker =
    tokenIndex > 0 &&
    normalizeText(previousToken) === 'å';

  const { data, error } =
    await supabase.rpc(
      'resolve_surface_form_v2',
      {
        p_surface_form: surface,
        p_prev_token: previousToken,
        p_next_token: nextToken,
        p_preceded_by_infinitive_marker:
          precededByInfinitiveMarker,
      },
    );

  if (error) {
    throw new Error(
      [
        `resolve_surface_form_v2 failed`,
        `for token "${surface}"`,
        `at index ${tokenIndex}:`,
        error.message,
      ].join(' '),
    );
  }

  const rows =
    (data ?? []) as SurfaceResolverRow[];

  const candidates =
    rows.map(mapResolverCandidate);

  const firstRow =
    rows[0] ?? null;

  return {
    index: tokenIndex,

    surface,
    normalized_surface:
      normalizedSurface,

    token_role: tokenRole,

    candidates,

    lexical_status:
      firstRow?.resolution_status ??
      (
        candidates.length > 0
          ? 'resolved'
          : 'unresolved'
      ),

    is_ambiguous:
      firstRow?.is_ambiguous ??
      candidates.length > 1,

    candidate_count:
      firstRow?.candidate_count ??
      candidates.length,

    resolution_context:
      firstRow?.resolution_context ??
      {
        surface_form: surface,
        normalized_surface:
          normalizedSurface,

        prev_token:
          previousToken,

        next_token:
          nextToken,

        preceded_by_infinitive_marker:
          precededByInfinitiveMarker,

        context_applied: false,
      },
  };
}

async function buildAnalysisTokens(
  supabase: ReturnType<
    typeof createClient
  >,
  tokensRaw: string[],
  tokenRoleLookup: Map<
    string,
    string
  >,
): Promise<AnalysisToken[]> {
  return await Promise.all(
    tokensRaw.map(
      (
        surface,
        tokenIndex,
      ) => {
        const normalizedSurface =
          normalizeText(surface);

        const tokenRole =
          tokenRoleLookup.get(
            normalizedSurface,
          ) ?? null;

        return resolveTokenCandidates(
          supabase,
          tokensRaw,
          tokenIndex,
          tokenRole,
        );
      },
    ),
  );
}


function normalizeCompoundRole(
  value: string,
): CompoundComponent['role'] | null {
  switch (normalizeText(value)) {
    case 'forledd':
      return 'forledd';
    case 'etterledd':
      return 'etterledd';
    case 'intermediate_component':
      return 'intermediate_component';
    default:
      return null;
  }
}

function normalizeCompoundAnalysisType(
  value: string,
): CompoundAnalysis['analysis_type'] | null {
  switch (normalizeText(value)) {
    case 'compound':
      return 'compound';
    case 'derived_compound':
      return 'derived_compound';
    case 'multi_level_compound':
      return 'multi_level_compound';
    default:
      return null;
  }
}

function normalizeCompoundStatus(
  value: string,
): CompoundAnalysis['status'] | null {
  switch (normalizeText(value)) {
    case 'source_verified':
      return 'source_verified';
    case 'implemented':
      return 'implemented';
    default:
      return null;
  }
}

async function loadCompoundAnalysesByLexemeId(
  supabase: ReturnType<typeof createClient>,
  lexemeIds: string[],
): Promise<Map<string, CompoundAnalysis>> {
  const uniqueLexemeIds = [...new Set(lexemeIds.filter(Boolean))];

  if (uniqueLexemeIds.length === 0) {
    return new Map();
  }

  const { data: analysesData, error: analysesError } = await supabase
    .from('lexeme_compound_analyses')
    .select(`
      id,
      compound_lexeme_id,
      analysis_type,
      status,
      component_count,
      head_component_position,
      confidence
    `)
    .in('compound_lexeme_id', uniqueLexemeIds)
    .in('status', ['source_verified', 'implemented']);

  if (analysesError) {
    throw new Error(
      `Failed to load compound analyses: ${analysesError.message}`,
    );
  }

  const rawAnalyses = (analysesData ?? []) as CompoundAnalysisRow[];

  if (rawAnalyses.length === 0) {
    return new Map();
  }

  // Prefer implemented analyses, then higher confidence, then stable ID order.
  const selectedByLexeme = new Map<string, CompoundAnalysisRow>();

  for (const row of rawAnalyses) {
    const current = selectedByLexeme.get(row.compound_lexeme_id);

    if (!current) {
      selectedByLexeme.set(row.compound_lexeme_id, row);
      continue;
    }

    const rowStatusRank = normalizeText(row.status) === 'implemented' ? 2 : 1;
    const currentStatusRank =
      normalizeText(current.status) === 'implemented' ? 2 : 1;

    const rowConfidence = numberFromUnknown(row.confidence);
    const currentConfidence = numberFromUnknown(current.confidence);

    if (
      rowStatusRank > currentStatusRank ||
      (
        rowStatusRank === currentStatusRank &&
        rowConfidence > currentConfidence
      ) ||
      (
        rowStatusRank === currentStatusRank &&
        rowConfidence === currentConfidence &&
        row.id.localeCompare(current.id) < 0
      )
    ) {
      selectedByLexeme.set(row.compound_lexeme_id, row);
    }
  }

  const selectedAnalyses = [...selectedByLexeme.values()];
  const analysisIds = selectedAnalyses.map((row) => row.id);

  const { data: componentsData, error: componentsError } = await supabase
    .from('lexeme_compound_components')
    .select(`
      compound_analysis_id,
      component_position,
      component_role,
      component_lexeme_id,
      component_surface,
      linking_element_after,
      is_head,
      metadata
    `)
    .in('compound_analysis_id', analysisIds)
    .order('component_position', { ascending: true });

  if (componentsError) {
    throw new Error(
      `Failed to load compound components: ${componentsError.message}`,
    );
  }

  const rawComponents = (componentsData ?? []) as CompoundComponentRow[];
  const componentLexemeIds = [
    ...new Set(
      rawComponents
        .map((row) => row.component_lexeme_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const componentLexemes = new Map<string, ComponentLexemeRow>();

  if (componentLexemeIds.length > 0) {
    const { data: lexemesData, error: lexemesError } = await supabase
      .from('lexemes')
      .select('id, lemma, pos')
      .in('id', componentLexemeIds);

    if (lexemesError) {
      throw new Error(
        `Failed to load compound component lexemes: ${lexemesError.message}`,
      );
    }

    for (const row of (lexemesData ?? []) as ComponentLexemeRow[]) {
      componentLexemes.set(row.id, row);
    }
  }

  const componentsByAnalysis = new Map<string, CompoundComponent[]>();

  for (const row of rawComponents) {
    const role = normalizeCompoundRole(row.component_role);
    if (!role) continue;

    const lexeme = row.component_lexeme_id
      ? componentLexemes.get(row.component_lexeme_id) ?? null
      : null;

    const component: CompoundComponent = {
      position: Number(row.component_position),
      role,
      lexeme_id: row.component_lexeme_id ?? null,
      lemma: lexeme?.lemma ?? null,
      pos: lexeme?.pos ?? null,
      surface: row.component_surface,
      linking_element_after: row.linking_element_after ?? null,
      is_head: Boolean(row.is_head),
      metadata: isJsonObject(row.metadata) ? row.metadata : {},
    };

    const list = componentsByAnalysis.get(row.compound_analysis_id) ?? [];
    list.push(component);
    componentsByAnalysis.set(row.compound_analysis_id, list);
  }

  const result = new Map<string, CompoundAnalysis>();

  for (const row of selectedAnalyses) {
    const analysisType = normalizeCompoundAnalysisType(row.analysis_type);
    const status = normalizeCompoundStatus(row.status);

    if (!analysisType || !status) continue;

    const components = (componentsByAnalysis.get(row.id) ?? [])
      .sort((left, right) => left.position - right.position);

    if (components.length === 0) continue;

    result.set(row.compound_lexeme_id, {
      analysis_id: row.id,
      analysis_type: analysisType,
      status,
      component_count: Number(row.component_count),
      head_component_position: Number(row.head_component_position),
      confidence: numberFromUnknown(row.confidence, 1),
      components,
    });
  }

  return result;
}

async function enrichTokensWithLexicalAnalysis(
  supabase: ReturnType<typeof createClient>,
  tokens: AnalysisToken[],
): Promise<AnalysisToken[]> {
  const lexemeIds = tokens.flatMap((token) =>
    token.candidates.map((candidate) => candidate.lexeme_id)
  );

  const compoundByLexemeId = await loadCompoundAnalysesByLexemeId(
    supabase,
    lexemeIds,
  );

  if (compoundByLexemeId.size === 0) {
    return tokens;
  }

  return tokens.map((token) => ({
    ...token,
    candidates: token.candidates.map((candidate) => {
      const compoundAnalysis = compoundByLexemeId.get(candidate.lexeme_id);

      if (!compoundAnalysis) {
        return candidate;
      }

      return {
        ...candidate,
        lexical_analysis: {
          ...(candidate.lexical_analysis ?? {}),
          compound_analysis: compoundAnalysis,
        },
      };
    }),
  }));
}

async function callInternalFunction<TResponse extends {
  ok: boolean;
  error?: string;
}>(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: unknown,
  displayName: string,
): Promise<TResponse> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${serviceRoleKey}`,

        apikey:
          serviceRoleKey,

        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify(body),
    },
  );

  const responseText =
    await response.text();

  let parsed: TResponse;

  try {
    parsed =
      responseText
        ? JSON.parse(responseText)
        : {
            ok: false,
            error:
              `${displayName} returned an empty response.`,
          } as TResponse;
  } catch {
    throw new Error(
      [
        `${displayName} returned non-JSON response.`,
        `HTTP ${response.status}.`,
        responseText.slice(0, 500),
      ].join(' '),
    );
  }

  if (
    !response.ok ||
    parsed.ok !== true
  ) {
    throw new Error(
      parsed.error ??
      [
        `${displayName} failed.`,
        `HTTP ${response.status}.`,
      ].join(' '),
    );
  }

  return parsed;
}

async function callGrammarPatternEngine(
  supabaseUrl: string,
  serviceRoleKey: string,
  tokens: AnalysisToken[],
  ruleCodes: string[] | undefined,
  dryRun: boolean,
): Promise<GrammarEngineResponse> {
  return await callInternalFunction<
    GrammarEngineResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    GRAMMAR_ENGINE_FUNCTION,
    {
      tokens: tokens.map(
        (token) => ({
          index:
            token.index,

          surface:
            token.surface,

          normalized_surface:
            token.normalized_surface,

          token_role:
            token.token_role,

          candidates:
            token.candidates,
        }),
      ),

      ruleCodes,
      dryRun,
    },
    'Grammar Pattern Engine',
  );
}

async function callConstructionResolutionEngine(
  supabaseUrl: string,
  serviceRoleKey: string,
  constructions: JsonValue[],
  includeTrace: boolean,
): Promise<ConstructionResolutionEngineResponse> {
  return await callInternalFunction<
    ConstructionResolutionEngineResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    CONSTRUCTION_RESOLUTION_ENGINE_FUNCTION,
    {
      constructions,
      includeTrace,
      strictValidation: true,
    },
    'Construction Resolution Engine',
  );
}

async function callPredicateBuilder(
  supabaseUrl: string,
  serviceRoleKey: string,
  text: string,
  tokens: AnalysisToken[],
  constructions: JsonValue[],
  constructionModel: JsonObject | null,
  selectionMargin: number,
): Promise<PredicateBuilderResponse> {
  return await callInternalFunction<
    PredicateBuilderResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    PREDICATE_BUILDER_FUNCTION,
    {
      text,
      tokens,
      constructions,
      construction_model: constructionModel,
      selectionMargin,
    },
    'Predicate Builder',
  );
}


async function callClausePatternEngine(
  supabaseUrl: string,
  serviceRoleKey: string,
  sentenceModel: JsonObject,
  ruleCodes: string[] | undefined,
): Promise<ClauseEngineResponse> {
  return await callInternalFunction<
    ClauseEngineResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    CLAUSE_ENGINE_FUNCTION,
    {
      sentence_model: sentenceModel,
      ruleCodes,
    },
    'Clause Pattern Engine',
  );
}

async function callDependencyEngine(
  supabaseUrl: string,
  serviceRoleKey: string,
  sentenceModel: JsonObject,
  clauses: JsonValue[],
  ruleCodes: string[] | undefined,
  dryRun: boolean,
  includeTrace: boolean,
): Promise<DependencyEngineResponse> {
  return await callInternalFunction<
    DependencyEngineResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    DEPENDENCY_ENGINE_FUNCTION,
    {
      sentence_model: sentenceModel,
      clauses,
      ruleCodes,
      dryRun,
      includeTrace,
      strictValidation: false,
      allowStructuralFallback: true,
    },
    'Dependency Engine',
  );
}

async function callLanguageGraphEngine(
  supabaseUrl: string,
  serviceRoleKey: string,
  sentenceModel: JsonObject,
): Promise<LanguageGraphEngineResponse> {
  return await callInternalFunction<
    LanguageGraphEngineResponse
  >(
    supabaseUrl,
    serviceRoleKey,
    LANGUAGE_GRAPH_ENGINE_FUNCTION,
    {
      sentence_model:
        sentenceModel,
    },
    'Language Graph Engine',
  );
}

function validateEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(
      `${field} must be one of: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

function validateRequestBody(
  body: unknown,
): OrchestratorRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const request = body as Partial<OrchestratorRequest>;

  if (typeof request.text !== 'string' || !request.text.trim()) {
    throw new Error('Body must contain a non-empty text string.');
  }

  if (request.ruleCodes !== undefined) {
    if (
      !Array.isArray(request.ruleCodes) ||
      request.ruleCodes.some(
        (code) => typeof code !== 'string' || !code.trim(),
      )
    ) {
      throw new Error('ruleCodes must be an array of non-empty strings.');
    }
  }

  for (const field of [
    'dryRun',
    'includeLexicalDetails',
    'includeSentenceModel',
    'includeLanguageGraph',
  ] as const) {
    if (request[field] !== undefined && typeof request[field] !== 'boolean') {
      throw new Error(`${field} must be a boolean.`);
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
    throw new Error(
      'selectionMargin must be a non-negative finite number.',
    );
  }

  const responseProfile = validateEnumValue(
    request.responseProfile,
    ['legacy', 'debug', 'model', 'graph', 'compact'] as const,
    'responseProfile',
  );

  const traceLevel = validateEnumValue(
    request.traceLevel,
    ['none', 'errors', 'summary', 'full'] as const,
    'traceLevel',
  );

  return {
    text: request.text.trim(),
    ruleCodes: request.ruleCodes?.map((code) => code.trim()),
    dryRun: request.dryRun ?? false,
    responseProfile,
    traceLevel,
    includeLexicalDetails: request.includeLexicalDetails,
    includeSentenceModel: request.includeSentenceModel,
    includeLanguageGraph: request.includeLanguageGraph,
    selectionMargin: request.selectionMargin ?? 20,
  };
}

function resolveExecutionPlan(
  request: OrchestratorRequest,
): ResolvedExecutionPlan {
  const explicitlySelectedProfile = request.responseProfile !== undefined;
  const responseProfile: ResponseProfile = request.responseProfile ?? 'legacy';
  const legacyMode = responseProfile === 'legacy';

  const traceLevel: TraceLevel = request.traceLevel ??
    (responseProfile === 'debug' ? 'full' : legacyMode ? 'full' : 'none');

  if (legacyMode) {
    const returnSentenceModel = request.includeSentenceModel ?? true;
    const returnLanguageGraph = request.includeLanguageGraph ?? true;

    return {
      responseProfile,
      traceLevel,
      legacyMode: true,
      includeLexicalDetails: request.includeLexicalDetails ?? true,
      returnSentenceModel,
      computeLanguageGraph: returnLanguageGraph,
      returnLanguageGraph,
      returnDebugArtifacts: true,
      returnCompactAnalysis: false,
      dependencyTraceEnabled: traceLevel !== 'none',
    };
  }

  const computeLanguageGraph = responseProfile === 'graph' ||
    responseProfile === 'debug';

  return {
    responseProfile,
    traceLevel,
    legacyMode: !explicitlySelectedProfile,
    includeLexicalDetails: responseProfile === 'debug',
    returnSentenceModel:
      responseProfile === 'model' ||
      responseProfile === 'graph' ||
      responseProfile === 'debug',
    computeLanguageGraph,
    returnLanguageGraph: computeLanguageGraph,
    returnDebugArtifacts: responseProfile === 'debug',
    returnCompactAnalysis: responseProfile === 'compact',
    dependencyTraceEnabled:
      responseProfile === 'debug' && traceLevel !== 'none',
  };
}

async function parseRequestBody(
  request: Request,
): Promise<unknown> {
  const rawBody =
    await request.text();

  if (!rawBody.trim()) {
    throw new Error(
      'Request body is empty.',
    );
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(
      'Request body is not valid JSON.',
    );
  }
}

function filterDiagnosticsByTraceLevel(
  diagnostics: JsonValue[],
  traceLevel: TraceLevel,
): JsonValue[] {
  // Diagnostics are part of the stable response contract and are not traces.
  // traceLevel="none" suppresses trace arrays, not warnings/errors.
  if (traceLevel !== 'errors') return diagnostics;

  return diagnostics.filter((item) => {
    if (!isJsonObject(item)) return false;
    return item.severity === 'error';
  });
}

function summarizeTraceEntries(entries: JsonValue[]): JsonValue[] {
  return entries
    .filter((item) => {
      if (!isJsonObject(item)) return false;
      return item.status === 'completed' ||
        item.status === 'warning' ||
        item.status === 'created';
    })
    .map((item) => {
      if (!isJsonObject(item)) return item;
      return {
        stage: item.stage ?? null,
        status: item.status ?? null,
        code: item.code ?? null,
        message: item.message ?? null,
      } as JsonObject;
    });
}

function projectTrace(
  entries: JsonValue[],
  traceLevel: TraceLevel,
): JsonValue[] {
  switch (traceLevel) {
    case 'full':
      return entries;
    case 'summary':
      return summarizeTraceEntries(entries);
    case 'errors':
    case 'none':
    default:
      return [];
  }
}

function collectUnifiedDiagnostics(
  sentenceModel: JsonObject | null,
  constructionDiagnostics: JsonValue[],
  dependencyDiagnostics: JsonValue[],
  languageGraph: JsonObject | null,
  traceLevel: TraceLevel,
): JsonValue[] {
  const collected: JsonValue[] = [];

  if (sentenceModel && Array.isArray(sentenceModel.diagnostics)) {
    collected.push(...sentenceModel.diagnostics);
  }

  collected.push(...constructionDiagnostics);
  collected.push(...dependencyDiagnostics);

  if (languageGraph && Array.isArray(languageGraph.diagnostics)) {
    collected.push(...languageGraph.diagnostics);
  }

  const unique = new Map<string, JsonValue>();
  for (const diagnostic of collected) {
    const key = JSON.stringify(diagnostic);
    if (!unique.has(key)) unique.set(key, diagnostic);
  }

  return filterDiagnosticsByTraceLevel([...unique.values()], traceLevel);
}

function createEmptySentenceModel(text: string): JsonObject {
  return {
    model_version: 'sentence-model-v1.0',
    text,
    tokens: [],
    predicates: [],
    clauses: [],
    dependencies: [],
    subjects: [],
    objects: [],
    diagnostics: [],
    summary: {
      token_count: 0,
      selected_candidate_count: 0,
      ambiguous_token_count: 0,
      predicate_count: 0,
      finite_predicate_count: 0,
      construction_count: 0,
      warning_count: 0,
      clause_count: 0,
      dependency_count: 0,
      subject_count: 0,
      object_count: 0,
    },
  };
}

function emptyResponse(
  requestBody: OrchestratorRequest,
  plan: ResolvedExecutionPlan,
): JsonObject {
  const summary: OrchestratorSummary = {
    token_count: 0,
    resolved_token_count: 0,
    unresolved_token_count: 0,
    ambiguous_token_count: 0,
    grammar_rule_count: 0,
    grammar_match_count: 0,
    construction_count: 0,
    resolved_construction_count: 0,
    suppressed_construction_count: 0,
    composition_link_count: 0,
    applied_action_count: 0,
    unsupported_action_count: 0,
    selected_candidate_count: 0,
    predicate_count: 0,
    finite_predicate_count: 0,
    clause_count: 0,
    dependency_count: 0,
    subject_count: 0,
    object_count: 0,
    warning_count: 0,
    error_count: 0,
    graph_node_count: 0,
    graph_edge_count: 0,
  };

  const base: JsonObject = {
    ok: true,
    orchestrator_version: ORCHESTRATOR_VERSION,
    response_profile: plan.responseProfile,
    trace_level: plan.traceLevel,
    grammar_engine_version: null,
    construction_resolution_engine_version: null,
    predicate_builder_version: null,
    predicate_contract_version: null,
    clause_contract_version: null,
    dependency_contract_version: null,
    interpretation_engine_version: null,
    clause_engine_version: null,
    dependency_engine_version: null,
    language_graph_engine_version: null,
    text: requestBody.text,
    summary: summary as unknown as JsonValue,
    diagnostics: [],
  };

  if (plan.legacyMode || plan.returnDebugArtifacts) {
    Object.assign(base, {
      tokens: [], matches: [], constructions: [], resolved_constructions: [],
      suppressed_constructions: [], composition_links: [],
      construction_relations: [], construction_resolution_trace: [],
      construction_resolution_diagnostics: [], action_trace: [],
      clause_matches: [], clauses: [], dependency_matches: [],
      dependencies: [], subjects: [], objects: [], dependency_trace: [],
      dependency_diagnostics: [], token_role_definitions: [],
      contract_deprecations: [
        {
          field: 'interpretation_engine_version',
          replacement: 'predicate_builder_version',
          remove_in: 'grammar-analysis-orchestrator-v2.0',
        },
      ],
    });
  }

  if (plan.returnSentenceModel) {
    base.sentence_model = createEmptySentenceModel(requestBody.text);
  }

  if (plan.returnLanguageGraph) {
    base.language_graph = null;
  }

  if (plan.returnCompactAnalysis) {
    base.analysis = {
      text: requestBody.text,
      tokens: [],
      predicates: [],
      clauses: [],
      dependencies: [],
    };
  }

  return base;
}

function buildCompactAnalysis(sentenceModel: JsonObject | null): JsonObject {
  if (!sentenceModel) {
    return {
      tokens: [], predicates: [], clauses: [], dependencies: [],
      subjects: [], objects: [],
    };
  }

  const tokens = Array.isArray(sentenceModel.tokens)
    ? sentenceModel.tokens.map((raw) => {
        if (!isJsonObject(raw)) return raw;
        const selected = isJsonObject(raw.selected_candidate)
          ? raw.selected_candidate
          : null;
        return {
          token_index: raw.token_index ?? null,
          surface: raw.surface ?? null,
          lemma: selected?.lemma ?? null,
          pos: selected?.pos ?? null,
          selection_status: selected?.selection_status ?? null,
        } as JsonObject;
      })
    : [];

  return {
    tokens,
    predicates: Array.isArray(sentenceModel.predicates)
      ? sentenceModel.predicates
      : [],
    clauses: Array.isArray(sentenceModel.clauses)
      ? sentenceModel.clauses
      : [],
    dependencies: Array.isArray(sentenceModel.dependencies)
      ? sentenceModel.dependencies
      : [],
    subjects: Array.isArray(sentenceModel.subjects)
      ? sentenceModel.subjects
      : [],
    objects: Array.isArray(sentenceModel.objects)
      ? sentenceModel.objects
      : [],
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
          orchestrator_version: ORCHESTRATOR_VERSION,
          error: 'Method not allowed.',
        },
        405,
      );
    }

    const requestBody = validateRequestBody(await parseRequestBody(request));
    const plan = resolveExecutionPlan(requestBody);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokensRaw = tokenize(requestBody.text);
    if (tokensRaw.length === 0) {
      return jsonResponse(emptyResponse(requestBody, plan));
    }

    const tokenRoleRules = await loadTokenRoleRules(
      supabase,
      requestBody.ruleCodes,
    );
    const tokenRoleDefinitions = extractTokenRoleDefinitions(tokenRoleRules);
    const tokenRoleLookup = createTokenRoleLookup(tokenRoleDefinitions);
    const lexicalTokens = await buildAnalysisTokens(
      supabase,
      tokensRaw,
      tokenRoleLookup,
    );

    const grammarResult = await callGrammarPatternEngine(
      supabaseUrl,
      serviceRoleKey,
      lexicalTokens,
      requestBody.ruleCodes,
      requestBody.dryRun ?? false,
    );

    let finalTokens = Array.isArray(grammarResult.tokens)
      ? grammarResult.tokens
      : lexicalTokens;

    // Lexical enrichment happens after grammar scoring and before Predicate
    // Builder selection. The winning candidate's enrichment is projected to
    // Sentence Model token.lexical_analysis by Predicate Builder.
    finalTokens = await enrichTokensWithLexicalAnalysis(
      supabase,
      finalTokens,
    );
    const matches = Array.isArray(grammarResult.matches)
      ? grammarResult.matches
      : [];
    const constructions = Array.isArray(grammarResult.constructions)
      ? grammarResult.constructions
      : [];
    const actionTrace = Array.isArray(grammarResult.action_trace)
      ? grammarResult.action_trace
      : [];

    const constructionResolutionResult =
      await callConstructionResolutionEngine(
        supabaseUrl,
        serviceRoleKey,
        constructions,
        plan.traceLevel !== 'none',
      );

    const constructionModel = isJsonObject(
      constructionResolutionResult.construction_model,
    ) ? constructionResolutionResult.construction_model : null;

    const resolvedConstructions = Array.isArray(
      constructionResolutionResult.resolved_constructions,
    )
      ? constructionResolutionResult.resolved_constructions
      : [];
    const suppressedConstructions = Array.isArray(
      constructionResolutionResult.suppressed_constructions,
    )
      ? constructionResolutionResult.suppressed_constructions
      : [];
    const compositionLinks = Array.isArray(
      constructionResolutionResult.composition_links,
    )
      ? constructionResolutionResult.composition_links
      : [];
    const constructionRelations = Array.isArray(
      constructionResolutionResult.relations,
    )
      ? constructionResolutionResult.relations
      : [];
    const constructionResolutionDiagnostics = Array.isArray(
      constructionResolutionResult.diagnostics,
    )
      ? constructionResolutionResult.diagnostics
      : [];
    const constructionResolutionTrace = Array.isArray(
      constructionResolutionResult.trace,
    )
      ? constructionResolutionResult.trace
      : [];

    // Sentence Model is the canonical internal contract. Every non-legacy
    // profile still computes it, including compact, but it is only serialized
    // when the selected profile requires it.
    const predicateBuilderResult = await callPredicateBuilder(
      supabaseUrl,
      serviceRoleKey,
      requestBody.text,
      finalTokens,
      resolvedConstructions,
      constructionModel,
      requestBody.selectionMargin ?? 20,
    );

    let sentenceModel = isJsonObject(predicateBuilderResult.sentence_model)
      ? predicateBuilderResult.sentence_model
      : null;
    if (!sentenceModel) {
      throw new Error(
        'Predicate Builder returned no sentence_model.',
      );
    }

    const clauseResult = await callClausePatternEngine(
      supabaseUrl,
      serviceRoleKey,
      sentenceModel,
      requestBody.ruleCodes,
    );
    const clauseMatches = Array.isArray(clauseResult.matches)
      ? clauseResult.matches
      : [];
    const clauses = Array.isArray(clauseResult.clauses)
      ? clauseResult.clauses
      : [];

    const dependencyResult = await callDependencyEngine(
      supabaseUrl,
      serviceRoleKey,
      sentenceModel,
      clauses,
      requestBody.ruleCodes,
      requestBody.dryRun ?? false,
      plan.dependencyTraceEnabled,
    );

    const dependencyMatches = Array.isArray(dependencyResult.matches)
      ? dependencyResult.matches
      : [];
    const dependencies = Array.isArray(dependencyResult.dependencies)
      ? dependencyResult.dependencies
      : [];
    const subjects = Array.isArray(dependencyResult.subjects)
      ? dependencyResult.subjects
      : [];
    const objects = Array.isArray(dependencyResult.objects)
      ? dependencyResult.objects
      : [];
    const dependencyTrace = Array.isArray(dependencyResult.dependency_trace)
      ? dependencyResult.dependency_trace
      : [];
    const dependencyDiagnostics = Array.isArray(dependencyResult.diagnostics)
      ? dependencyResult.diagnostics
      : [];

    sentenceModel = isJsonObject(dependencyResult.sentence_model)
      ? dependencyResult.sentence_model
      : null;
    if (!sentenceModel) {
      throw new Error('Dependency Engine returned no sentence_model.');
    }

    let languageGraph: JsonObject | null = null;
    let languageGraphEngineVersion: string | null = null;

    // Computation gating: graph engine is not called for model or compact.
    if (plan.computeLanguageGraph) {
      const graphResult = await callLanguageGraphEngine(
        supabaseUrl,
        serviceRoleKey,
        sentenceModel,
      );
      languageGraphEngineVersion = graphResult.engine_version ?? null;
      languageGraph = isJsonObject(graphResult.graph)
        ? graphResult.graph
        : null;
      if (!languageGraph) {
        throw new Error('Language Graph Engine returned no graph.');
      }
    }

    const resolvedTokenCount = finalTokens.filter(
      (token) => Array.isArray(token.candidates) && token.candidates.length > 0,
    ).length;
    const unresolvedTokenCount = finalTokens.length - resolvedTokenCount;
    const ambiguousTokenCount = finalTokens.filter(
      (token) => Array.isArray(token.candidates) && token.candidates.length > 1,
    ).length;

    const grammarSummary = grammarResult.summary ?? {};
    const constructionResolutionSummary =
      constructionResolutionResult.summary ?? {};
    const sentenceSummary = isJsonObject(sentenceModel.summary)
      ? sentenceModel.summary
      : {};
    const graphSummary = languageGraph && isJsonObject(languageGraph.summary)
      ? languageGraph.summary
      : {};

    const rawDiagnostics = collectUnifiedDiagnostics(
      sentenceModel,
      constructionResolutionDiagnostics,
      dependencyDiagnostics,
      languageGraph,
      'full',
    );
    const warningCount = rawDiagnostics.filter(
      (item) => isJsonObject(item) && item.severity === 'warning',
    ).length;
    const errorCount = rawDiagnostics.filter(
      (item) => isJsonObject(item) && item.severity === 'error',
    ).length;

    const summary: OrchestratorSummary = {
      token_count: finalTokens.length,
      resolved_token_count: resolvedTokenCount,
      unresolved_token_count: unresolvedTokenCount,
      ambiguous_token_count: ambiguousTokenCount,
      grammar_rule_count: numberFromUnknown(grammarSummary.rule_count),
      grammar_match_count: numberFromUnknown(grammarSummary.match_count),
      construction_count: numberFromUnknown(
        grammarSummary.construction_count,
        constructions.length,
      ),
      resolved_construction_count: numberFromUnknown(
        constructionResolutionSummary.resolved_construction_count,
        resolvedConstructions.length,
      ),
      suppressed_construction_count: numberFromUnknown(
        constructionResolutionSummary.suppressed_construction_count,
        suppressedConstructions.length,
      ),
      composition_link_count: numberFromUnknown(
        constructionResolutionSummary.composition_link_count,
        compositionLinks.length,
      ),
      applied_action_count: numberFromUnknown(
        grammarSummary.applied_action_count,
      ),
      unsupported_action_count: numberFromUnknown(
        grammarSummary.unsupported_action_count,
      ),
      selected_candidate_count: numberFromUnknown(
        sentenceSummary.selected_candidate_count,
      ),
      predicate_count: numberFromUnknown(sentenceSummary.predicate_count),
      finite_predicate_count: numberFromUnknown(
        sentenceSummary.finite_predicate_count,
      ),
      clause_count: numberFromUnknown(sentenceSummary.clause_count, clauses.length),
      dependency_count: numberFromUnknown(
        sentenceSummary.dependency_count,
        dependencies.length,
      ),
      subject_count: numberFromUnknown(
        sentenceSummary.subject_count,
        subjects.length,
      ),
      object_count: numberFromUnknown(
        sentenceSummary.object_count,
        objects.length,
      ),
      warning_count: warningCount,
      error_count: errorCount,
      graph_node_count: numberFromUnknown(graphSummary.node_count),
      graph_edge_count: numberFromUnknown(graphSummary.edge_count),
    };

    const responseBody: JsonObject = {
      ok: true,
      orchestrator_version: ORCHESTRATOR_VERSION,
      response_profile: plan.responseProfile,
      trace_level: plan.traceLevel,
      grammar_engine_version: grammarResult.engine_version ?? null,
      construction_resolution_engine_version:
        constructionResolutionResult.engine_version ?? null,
      predicate_builder_version:
        predicateBuilderResult.builder_version ??
        predicateBuilderResult.predicate_builder_version ??
        predicateBuilderResult.interpreter_version ??
        null,
      predicate_contract_version:
        predicateBuilderResult.predicate_contract_version ??
        null,
      clause_contract_version:
        clauseResult.clause_contract_version ??
        null,
      dependency_contract_version:
        dependencyResult.dependency_contract_version ??
        null,

      // Deprecated compatibility alias. Remove in orchestrator v2.0.
      interpretation_engine_version:
        predicateBuilderResult.builder_version ??
        predicateBuilderResult.predicate_builder_version ??
        predicateBuilderResult.interpreter_version ??
        null,
      clause_engine_version: clauseResult.engine_version ?? null,
      dependency_engine_version: dependencyResult.engine_version ?? null,
      language_graph_engine_version: languageGraphEngineVersion,
      text: requestBody.text,
      summary: summary as unknown as JsonValue,
      diagnostics: collectUnifiedDiagnostics(
        sentenceModel,
        constructionResolutionDiagnostics,
        dependencyDiagnostics,
        languageGraph,
        plan.traceLevel,
      ),
    };

    if (plan.legacyMode || plan.returnDebugArtifacts) {
      Object.assign(responseBody, {
        tokens: plan.includeLexicalDetails ? finalTokens : finalTokens.map(
          (token) => ({
            index: token.index,
            surface: token.surface,
            normalized_surface: token.normalized_surface,
            token_role: token.token_role,
          }),
        ),
        matches,
        constructions,
        construction_model: constructionModel,
        resolved_constructions: resolvedConstructions,
        suppressed_constructions: suppressedConstructions,
        composition_links: compositionLinks,
        construction_relations: constructionRelations,
        construction_resolution_trace: projectTrace(
          constructionResolutionTrace,
          plan.traceLevel,
        ),
        construction_resolution_diagnostics:
          filterDiagnosticsByTraceLevel(
            constructionResolutionDiagnostics,
            plan.traceLevel,
          ),
        action_trace: projectTrace(actionTrace, plan.traceLevel),
        clause_matches: clauseMatches,
        clauses,
        dependency_matches: dependencyMatches,
        dependencies,
        subjects,
        objects,
        dependency_trace: projectTrace(dependencyTrace, plan.traceLevel),
        dependency_diagnostics: filterDiagnosticsByTraceLevel(
          dependencyDiagnostics,
          plan.traceLevel,
        ),
        token_role_definitions: tokenRoleDefinitions,
        contract_deprecations: [
          {
            field: 'interpretation_engine_version',
            replacement: 'predicate_builder_version',
            remove_in: 'grammar-analysis-orchestrator-v2.0',
          },
        ],
      });

      // Preserve the v1.2 key shape in legacy mode, including explicit nulls.
      if (plan.legacyMode) {
        responseBody.sentence_model = plan.returnSentenceModel
          ? sentenceModel
          : null;
        responseBody.language_graph = plan.returnLanguageGraph
          ? languageGraph
          : null;
      }
    }

    if (!plan.legacyMode && plan.returnSentenceModel) {
      responseBody.sentence_model = sentenceModel;
    }

    if (!plan.legacyMode && plan.returnLanguageGraph) {
      responseBody.language_graph = languageGraph;
    }

    if (plan.returnCompactAnalysis) {
      responseBody.analysis = buildCompactAnalysis(sentenceModel);
    }

    return jsonResponse(responseBody);
  } catch (error) {
    console.error('[GRAMMAR ANALYSIS ORCHESTRATOR ERROR]', error);

    const message = error instanceof Error ? error.message : String(error);
    const isClientError = [
      'Request body',
      'Body must',
      'ruleCodes',
      'dryRun',
      'includeLexicalDetails',
      'includeSentenceModel',
      'includeLanguageGraph',
      'selectionMargin',
      'responseProfile',
      'traceLevel',
    ].some((fragment) => message.includes(fragment));

    return jsonResponse(
      {
        ok: false,
        orchestrator_version: ORCHESTRATOR_VERSION,
        error: message,
      },
      isClientError ? 400 : 500,
    );
  }
});
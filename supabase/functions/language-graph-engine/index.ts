// supabase/functions/language-graph-engine/index.ts
//
// Norsk Trainer — Language Graph Engine v1.2
//
// Pure projection engine. It builds graph nodes and edges only from data
// already present in Sentence Model. It does not infer grammar or syntax.

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;


type CompoundComponent = {
  position: number;
  role: 'forledd' | 'etterledd' | 'intermediate_component';
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
  surface: string;
  linking_element_after: string | null;
  is_head: boolean;
  metadata: Record<string, JsonValue>;
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

type TokenAlternative = {
  lexeme_id: string;
  lemma: string;
  pos: string;
  form_types: string[];
  score: number;
  base_priority: number;
};

type SentenceModelToken = {
  token_index: number;
  surface: string;
  normalized_surface: string;
  token_role: string | null;
  selected_candidate: SelectedCandidate | null;
  lexical_analysis: LexicalAnalysis | null;
  alternatives: TokenAlternative[];
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

type ClauseSubject = {
  token_index: number;
  surface: string;
  lexeme_id: string | null;
  lemma: string | null;
  pos: string | null;
};

type ClauseObject = {
  id: string;
  clause_type: string;
  rule_id: string;
  rule_code: string;
  token_start: number;
  token_end: number;
  subject?: ClauseSubject | null;
  predicate_id: string;
  confidence: number;
  priority: number;
  explanations?: Record<string, JsonValue>;
  source_result?: Record<string, JsonValue>;
};

type SubjectReference = {
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

type ObjectReference = SubjectReference;

type SentenceDependency = {
  id: string;
  relation: string;
  source_node_id: string;
  target_node_id: string;
  clause_id?: string | null;
  predicate_id?: string | null;
  rule_id?: string | null;
  rule_code?: string | null;
  confidence?: number | null;
  priority?: number | null;
  metadata?: Record<string, JsonValue>;
  source?: Record<string, JsonValue>;
  target?: Record<string, JsonValue>;
};

type SentenceDiagnostic = {
  engine?: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  token_index?: number;
  rule_code?: string;
  metadata?: Record<string, JsonValue>;
};

type SentenceModel = {
  model_version: string;
  text: string | null;
  tokens: SentenceModelToken[];
  predicates: PredicateFrame[];
  clauses: ClauseObject[];
  dependencies: SentenceDependency[];
  subjects: SubjectReference[];
  objects: ObjectReference[];
  diagnostics: SentenceDiagnostic[];
  summary: Record<string, JsonValue>;
};

type LanguageGraphRequest = { sentence_model: SentenceModel };

type GraphNodeType =
  | 'sentence'
  | 'token'
  | 'candidate'
  | 'compound_analysis'
  | 'compound_component'
  | 'construction'
  | 'predicate'
  | 'clause'
  | 'subject'
  | 'object'
  | 'diagnostic';

type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  data: JsonObject;
};

type GraphEdge = {
  id: string;
  type: string;
  from: string;
  to: string;
  label: string;
  data: JsonObject;
};

type GraphDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  dependency_id?: string;
  source_node_id?: string;
  target_node_id?: string;
  metadata?: JsonObject;
};

const ENGINE_VERSION = 'language-graph-engine-v1.3';
const GRAPH_VERSION = 'language-graph-v1.3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

class RequestValidationError extends Error {
  status = 400;
  details?: Record<string, JsonValue>;

  constructor(message: string, details?: Record<string, JsonValue>) {
    super(message);
    this.name = 'RequestValidationError';
    this.details = details;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) return value;

  if (Array.isArray(value)) return value.map(asJsonValue);

  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = asJsonValue(item);
    }
    return result;
  }

  return String(value);
}

function asJsonObject(value: unknown): JsonObject {
  const converted = asJsonValue(value);
  return isObject(converted) ? converted as JsonObject : {};
}

/**
 * Converts a raw Sentence Model entity ID into a graph-addressable node ID.
 *
 * Contract:
 * - Sentence Model entity IDs are raw and do not include their entity namespace.
 * - Graph node IDs always include exactly one namespace.
 * - Dependency source_node_id / target_node_id are already graph-addressable and
 *   therefore must not be passed through this function again.
 */
function toGraphNodeId(type: GraphNodeType, rawId: string): string {
  return `${type}:${rawId}`;
}

function edgeId(type: string, from: string, to: string, suffix = ''): string {
  return [type, from, to, suffix].filter(Boolean).join(':');
}

function addNode(
  nodes: GraphNode[],
  nodeIds: Set<string>,
  node: GraphNode,
): boolean {
  if (nodeIds.has(node.id)) return false;
  nodeIds.add(node.id);
  nodes.push(node);
  return true;
}

function addEdge(
  edges: GraphEdge[],
  edgeIds: Set<string>,
  edge: GraphEdge,
): boolean {
  if (edgeIds.has(edge.id)) return false;
  edgeIds.add(edge.id);
  edges.push(edge);
  return true;
}

function addDiagnostic(
  diagnostics: GraphDiagnostic[],
  keys: Set<string>,
  diagnostic: GraphDiagnostic,
): void {
  const key = [
    diagnostic.code,
    diagnostic.entity_type ?? '',
    diagnostic.entity_id ?? '',
    diagnostic.dependency_id ?? '',
    diagnostic.source_node_id ?? '',
    diagnostic.target_node_id ?? '',
  ].join('::');

  if (keys.has(key)) return;
  keys.add(key);
  diagnostics.push(diagnostic);
}

function hasOwnNamespace(
  type: Exclude<GraphNodeType, 'sentence' | 'token' | 'candidate' | 'construction' | 'diagnostic'>,
  rawId: string,
): boolean {
  return rawId.startsWith(`${type}:`);
}

function addNamespacedEntityIdDiagnostic(
  diagnostics: GraphDiagnostic[],
  keys: Set<string>,
  type: 'predicate' | 'clause' | 'subject' | 'object',
  rawId: string,
): void {
  if (!hasOwnNamespace(type, rawId)) return;

  addDiagnostic(diagnostics, keys, {
    severity: 'warning',
    code: 'sentence_model_entity_id_is_namespaced',
    message:
      `${type} entity ID "${rawId}" already contains its namespace. ` +
      'Sentence Model entity IDs must be raw; the graph namespace is added only by Language Graph Engine.',
    entity_type: type,
    entity_id: rawId,
    metadata: {
      expected_raw_id: rawId.slice(type.length + 1),
      received_id: rawId,
    },
  });
}

function buildLanguageGraph(model: SentenceModel) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const graphDiagnostics: GraphDiagnostic[] = [];
  const diagnosticKeys = new Set<string>();

  const root: GraphNode = {
    id: toGraphNodeId('sentence', 'root'),
    type: 'sentence',
    label: model.text ?? 'Sentence',
    data: {
      text: model.text,
      model_version: model.model_version,
      summary: asJsonValue(model.summary ?? {}),
    },
  };

  addNode(nodes, nodeIds, root);

  const tokenNodesByIndex: Record<string, string> = {};
  const selectedCandidateNodesByTokenIndex: Record<string, string> = {};
  const compoundAnalysisNodesById: Record<string, string> = {};
  const compoundComponentNodesByAnalysisId: Record<string, string[]> = {};
  const predicateNodesById: Record<string, string> = {};
  const constructionNodesByPredicateId: Record<string, string> = {};
  const clauseNodesById: Record<string, string> = {};
  const subjectNodesById: Record<string, string> = {};
  const objectNodesById: Record<string, string> = {};
  const dependencyEdgesById: Record<string, string> = {};

  for (const token of model.tokens) {
    const tokenNodeId = toGraphNodeId('token', String(token.token_index));

    addNode(nodes, nodeIds, {
      id: tokenNodeId,
      type: 'token',
      label: token.surface,
      data: {
        token_index: token.token_index,
        surface: token.surface,
        normalized_surface: token.normalized_surface,
        token_role: token.token_role,
        grammar_roles: asJsonValue(token.grammar_roles ?? []),
      },
    });

    tokenNodesByIndex[String(token.token_index)] = tokenNodeId;

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, tokenNodeId),
      type: 'contains',
      from: root.id,
      to: tokenNodeId,
      label: 'contains token',
      data: { token_index: token.token_index },
    });

    const selectedLexemeId = token.selected_candidate?.lexeme_id ?? null;
    const seen = new Set<string>();

    for (const candidate of token.alternatives ?? []) {
      const selected = candidate.lexeme_id === selectedLexemeId;
      const candidateNodeId = toGraphNodeId(
        'candidate',
        `${token.token_index}:${candidate.lexeme_id}`,
      );

      addNode(nodes, nodeIds, {
        id: candidateNodeId,
        type: 'candidate',
        label: `${candidate.lemma} · ${candidate.pos}`,
        data: {
          token_index: token.token_index,
          lexeme_id: candidate.lexeme_id,
          lemma: candidate.lemma,
          pos: candidate.pos,
          form_types: asJsonValue(candidate.form_types ?? []),
          score: candidate.score ?? 0,
          base_priority: candidate.base_priority ?? 0,
          selected,
        },
      });

      seen.add(candidate.lexeme_id);

      addEdge(edges, edgeIds, {
        id: edgeId('has_candidate', tokenNodeId, candidateNodeId),
        type: 'has_candidate',
        from: tokenNodeId,
        to: candidateNodeId,
        label: 'has candidate',
        data: { selected },
      });

      addEdge(edges, edgeIds, {
        id: edgeId(
          selected ? 'selected_candidate' : 'alternative_candidate',
          tokenNodeId,
          candidateNodeId,
        ),
        type: selected ? 'selected_candidate' : 'alternative_candidate',
        from: tokenNodeId,
        to: candidateNodeId,
        label: selected ? 'selected candidate' : 'alternative candidate',
        data: { score: candidate.score ?? 0 },
      });

      if (selected) {
        selectedCandidateNodesByTokenIndex[String(token.token_index)] =
          candidateNodeId;
      }
    }

    const selectedCandidate = token.selected_candidate;

    if (selectedCandidate && !seen.has(selectedCandidate.lexeme_id)) {
      const candidateNodeId = toGraphNodeId(
        'candidate',
        `${token.token_index}:${selectedCandidate.lexeme_id}`,
      );

      addNode(nodes, nodeIds, {
        id: candidateNodeId,
        type: 'candidate',
        label: `${selectedCandidate.lemma} · ${selectedCandidate.pos}`,
        data: {
          token_index: token.token_index,
          lexeme_id: selectedCandidate.lexeme_id,
          lemma: selectedCandidate.lemma,
          pos: selectedCandidate.pos,
          form_types: asJsonValue(selectedCandidate.form_types ?? []),
          score: selectedCandidate.score ?? 0,
          base_priority: selectedCandidate.base_priority ?? 0,
          base_confidence: selectedCandidate.base_confidence,
          selected: true,
          selection_status: selectedCandidate.selection_status,
          score_margin: selectedCandidate.score_margin,
          trace: asJsonValue(selectedCandidate.trace ?? []),
        },
      });

      addEdge(edges, edgeIds, {
        id: edgeId('has_candidate', tokenNodeId, candidateNodeId),
        type: 'has_candidate',
        from: tokenNodeId,
        to: candidateNodeId,
        label: 'has candidate',
        data: { selected: true },
      });

      addEdge(edges, edgeIds, {
        id: edgeId('selected_candidate', tokenNodeId, candidateNodeId),
        type: 'selected_candidate',
        from: tokenNodeId,
        to: candidateNodeId,
        label: 'selected candidate',
        data: { score: selectedCandidate.score ?? 0 },
      });

      selectedCandidateNodesByTokenIndex[String(token.token_index)] =
        candidateNodeId;
    }

    const compoundAnalysis =
      token.lexical_analysis?.compound_analysis ?? null;
    const selectedCandidateNodeId =
      selectedCandidateNodesByTokenIndex[String(token.token_index)] ?? null;

    if (compoundAnalysis && selectedCandidateNodeId) {
      const compoundNodeId = toGraphNodeId(
        'compound_analysis',
        compoundAnalysis.analysis_id,
      );

      addNode(nodes, nodeIds, {
        id: compoundNodeId,
        type: 'compound_analysis',
        label:
          token.selected_candidate?.lemma ??
          compoundAnalysis.analysis_type,
        data: {
          analysis_id: compoundAnalysis.analysis_id,
          token_index: token.token_index,
          compound_lexeme_id:
            token.selected_candidate?.lexeme_id ?? null,
          compound_lemma:
            token.selected_candidate?.lemma ?? null,
          analysis_type: compoundAnalysis.analysis_type,
          status: compoundAnalysis.status,
          component_count: compoundAnalysis.component_count,
          head_component_position:
            compoundAnalysis.head_component_position,
          confidence: compoundAnalysis.confidence,
        },
      });

      compoundAnalysisNodesById[compoundAnalysis.analysis_id] =
        compoundNodeId;
      compoundComponentNodesByAnalysisId[
        compoundAnalysis.analysis_id
      ] = [];

      addEdge(edges, edgeIds, {
        id: edgeId(
          'has_compound_analysis',
          selectedCandidateNodeId,
          compoundNodeId,
        ),
        type: 'has_compound_analysis',
        from: selectedCandidateNodeId,
        to: compoundNodeId,
        label: 'has compound analysis',
        data: {
          token_index: token.token_index,
          analysis_id: compoundAnalysis.analysis_id,
        },
      });

      for (const component of compoundAnalysis.components ?? []) {
        const componentNodeId = toGraphNodeId(
          'compound_component',
          `${compoundAnalysis.analysis_id}:${component.position}`,
        );

        addNode(nodes, nodeIds, {
          id: componentNodeId,
          type: 'compound_component',
          label:
            component.lemma ??
            component.surface,
          data: {
            analysis_id: compoundAnalysis.analysis_id,
            token_index: token.token_index,
            position: component.position,
            role: component.role,
            lexeme_id: component.lexeme_id,
            lemma: component.lemma,
            pos: component.pos,
            surface: component.surface,
            linking_element_after:
              component.linking_element_after,
            is_head: component.is_head,
            metadata: asJsonValue(component.metadata ?? {}),
          },
        });

        compoundComponentNodesByAnalysisId[
          compoundAnalysis.analysis_id
        ].push(componentNodeId);

        const roleEdgeType =
          component.role === 'forledd'
            ? 'has_forledd'
            : component.role === 'etterledd'
            ? 'has_etterledd'
            : 'has_intermediate_component';

        addEdge(edges, edgeIds, {
          id: edgeId(
            roleEdgeType,
            compoundNodeId,
            componentNodeId,
            String(component.position),
          ),
          type: roleEdgeType,
          from: compoundNodeId,
          to: componentNodeId,
          label: component.role,
          data: {
            position: component.position,
            linking_element_after:
              component.linking_element_after,
          },
        });

        if (component.is_head) {
          addEdge(edges, edgeIds, {
            id: edgeId(
              'compound_head',
              compoundNodeId,
              componentNodeId,
              String(component.position),
            ),
            type: 'compound_head',
            from: compoundNodeId,
            to: componentNodeId,
            label: 'compound head',
            data: {
              position: component.position,
              role: component.role,
            },
          });
        }
      }
    }
  }

  for (const predicate of model.predicates) {
    addNamespacedEntityIdDiagnostic(
      graphDiagnostics,
      diagnosticKeys,
      'predicate',
      predicate.id,
    );

    const constructionNodeId = toGraphNodeId('construction', predicate.id);
    const predicateNodeId = toGraphNodeId('predicate', predicate.id);

    addNode(nodes, nodeIds, {
      id: constructionNodeId,
      type: 'construction',
      label: predicate.construction_type,
      data: {
        predicate_id: predicate.id,
        construction_type: predicate.construction_type,
        rule_id: predicate.rule_id,
        rule_code: predicate.rule_code,
        token_start: predicate.token_start,
        token_end: predicate.token_end,
        confidence: predicate.confidence,
        priority: predicate.priority,
        explanations: asJsonValue(predicate.explanations ?? {}),
        source_result: asJsonValue(predicate.source_result ?? {}),
      },
    });

    addNode(nodes, nodeIds, {
      id: predicateNodeId,
      type: 'predicate',
      label: predicate.head.lemma ?? predicate.head.surface,
      data: {
        predicate_id: predicate.id,
        construction_type: predicate.construction_type,
        rule_id: predicate.rule_id,
        rule_code: predicate.rule_code,
        token_start: predicate.token_start,
        token_end: predicate.token_end,
        head: asJsonValue(predicate.head),
        finite_member: asJsonValue(predicate.finite_member),
        members: asJsonValue(predicate.members),
        tense: predicate.tense,
        aspect: predicate.aspect,
        mood: predicate.mood,
        voice: predicate.voice,
        confidence: predicate.confidence,
        priority: predicate.priority,
      },
    });

    predicateNodesById[predicate.id] = predicateNodeId;
    constructionNodesByPredicateId[predicate.id] = constructionNodeId;

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, constructionNodeId),
      type: 'contains',
      from: root.id,
      to: constructionNodeId,
      label: 'contains construction',
      data: {},
    });

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, predicateNodeId),
      type: 'contains',
      from: root.id,
      to: predicateNodeId,
      label: 'contains predicate',
      data: {},
    });

    addEdge(edges, edgeIds, {
      id: edgeId('forms_predicate', constructionNodeId, predicateNodeId),
      type: 'forms_predicate',
      from: constructionNodeId,
      to: predicateNodeId,
      label: 'forms predicate',
      data: { construction_type: predicate.construction_type },
    });

    for (let index = predicate.token_start; index <= predicate.token_end; index++) {
      const tokenNodeId = tokenNodesByIndex[String(index)];

      if (!tokenNodeId) {
        addDiagnostic(graphDiagnostics, diagnosticKeys, {
          severity: 'warning',
          code: 'predicate_span_token_missing',
          message: `Predicate "${predicate.id}" references missing token index ${index}.`,
          entity_type: 'predicate',
          entity_id: predicate.id,
          metadata: { token_index: index },
        });
        continue;
      }

      addEdge(edges, edgeIds, {
        id: edgeId('spans_token', constructionNodeId, tokenNodeId, String(index)),
        type: 'spans_token',
        from: constructionNodeId,
        to: tokenNodeId,
        label: 'spans token',
        data: { token_index: index },
      });
    }

    for (const member of predicate.members) {
      const tokenNodeId = tokenNodesByIndex[String(member.token_index)];

      if (!tokenNodeId) {
        addDiagnostic(graphDiagnostics, diagnosticKeys, {
          severity: 'warning',
          code: 'predicate_member_token_missing',
          message:
            `Predicate "${predicate.id}" member "${member.slot}" references missing token index ${member.token_index}.`,
          entity_type: 'predicate',
          entity_id: predicate.id,
          metadata: {
            slot: member.slot,
            role: member.role,
            token_index: member.token_index,
          },
        });
        continue;
      }

      addEdge(edges, edgeIds, {
        id: edgeId('realizes_slot', constructionNodeId, tokenNodeId, member.slot),
        type: 'realizes_slot',
        from: constructionNodeId,
        to: tokenNodeId,
        label: `slot ${member.slot}`,
        data: { slot: member.slot, role: member.role },
      });

      const isHead = member.token_index === predicate.head.token_index;

      addEdge(edges, edgeIds, {
        id: edgeId(
          isHead ? 'predicate_head' : 'predicate_member',
          predicateNodeId,
          tokenNodeId,
          member.slot,
        ),
        type: isHead ? 'predicate_head' : 'predicate_member',
        from: predicateNodeId,
        to: tokenNodeId,
        label: isHead ? 'predicate head' : member.role,
        data: { slot: member.slot, role: member.role },
      });
    }
  }

  for (const clause of model.clauses) {
    addNamespacedEntityIdDiagnostic(
      graphDiagnostics,
      diagnosticKeys,
      'clause',
      clause.id,
    );

    const clauseNodeId = toGraphNodeId('clause', clause.id);

    addNode(nodes, nodeIds, {
      id: clauseNodeId,
      type: 'clause',
      label: clause.clause_type,
      data: {
        clause_id: clause.id,
        clause_type: clause.clause_type,
        rule_id: clause.rule_id,
        rule_code: clause.rule_code,
        token_start: clause.token_start,
        token_end: clause.token_end,
        predicate_id: clause.predicate_id,
        subject: asJsonValue(clause.subject ?? null),
        confidence: clause.confidence,
        priority: clause.priority,
        explanations: asJsonValue(clause.explanations ?? {}),
        source_result: asJsonValue(clause.source_result ?? {}),
      },
    });

    clauseNodesById[clause.id] = clauseNodeId;

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, clauseNodeId),
      type: 'contains',
      from: root.id,
      to: clauseNodeId,
      label: 'contains clause',
      data: { clause_id: clause.id },
    });

    const predicateNodeId = predicateNodesById[clause.predicate_id];

    if (predicateNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('has_predicate', clauseNodeId, predicateNodeId),
        type: 'has_predicate',
        from: clauseNodeId,
        to: predicateNodeId,
        label: 'has predicate',
        data: {
          clause_id: clause.id,
          predicate_id: clause.predicate_id,
        },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'clause_predicate_node_missing',
        message:
          `Clause "${clause.id}" references missing predicate "${clause.predicate_id}".`,
        entity_type: 'clause',
        entity_id: clause.id,
        target_node_id: toGraphNodeId('predicate', clause.predicate_id),
      });
    }

    // Structural membership only. This does not create subject_of.
    if (clause.subject && Number.isInteger(clause.subject.token_index)) {
      const tokenNodeId = tokenNodesByIndex[String(clause.subject.token_index)];

      if (tokenNodeId) {
        addEdge(edges, edgeIds, {
          id: edgeId('contains_subject', clauseNodeId, tokenNodeId),
          type: 'contains_subject',
          from: clauseNodeId,
          to: tokenNodeId,
          label: 'contains subject',
          data: {
            clause_id: clause.id,
            token_index: clause.subject.token_index,
          },
        });
      } else {
        addDiagnostic(graphDiagnostics, diagnosticKeys, {
          severity: 'warning',
          code: 'clause_subject_token_missing',
          message:
            `Clause "${clause.id}" references missing subject token index ${clause.subject.token_index}.`,
          entity_type: 'clause',
          entity_id: clause.id,
          source_node_id: toGraphNodeId('token', String(clause.subject.token_index)),
        });
      }
    }
  }

  for (const subject of model.subjects) {
    addNamespacedEntityIdDiagnostic(
      graphDiagnostics,
      diagnosticKeys,
      'subject',
      subject.id,
    );

    const subjectNodeId = toGraphNodeId('subject', subject.id);

    addNode(nodes, nodeIds, {
      id: subjectNodeId,
      type: 'subject',
      label: subject.surface || subject.lemma || subject.id,
      data: asJsonObject(subject),
    });

    subjectNodesById[subject.id] = subjectNodeId;

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, subjectNodeId),
      type: 'contains',
      from: root.id,
      to: subjectNodeId,
      label: 'contains subject',
      data: { subject_id: subject.id },
    });

    const tokenNodeId = tokenNodesByIndex[String(subject.token_index)];
    if (tokenNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('realizes_token', subjectNodeId, tokenNodeId),
        type: 'realizes_token',
        from: subjectNodeId,
        to: tokenNodeId,
        label: 'realizes token',
        data: { token_index: subject.token_index },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'subject_token_node_missing',
        message:
          `Subject "${subject.id}" references missing token index ${subject.token_index}.`,
        entity_type: 'subject',
        entity_id: subject.id,
        target_node_id: toGraphNodeId('token', String(subject.token_index)),
      });
    }

    const clauseNodeId = clauseNodesById[subject.clause_id];
    if (clauseNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('belongs_to_clause', subjectNodeId, clauseNodeId),
        type: 'belongs_to_clause',
        from: subjectNodeId,
        to: clauseNodeId,
        label: 'belongs to clause',
        data: { clause_id: subject.clause_id },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'subject_clause_node_missing',
        message:
          `Subject "${subject.id}" references missing clause "${subject.clause_id}".`,
        entity_type: 'subject',
        entity_id: subject.id,
        target_node_id: toGraphNodeId('clause', subject.clause_id),
      });
    }

    const predicateNodeId = predicateNodesById[subject.predicate_id];
    if (predicateNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('targets_predicate', subjectNodeId, predicateNodeId),
        type: 'targets_predicate',
        from: subjectNodeId,
        to: predicateNodeId,
        label: 'targets predicate',
        data: { predicate_id: subject.predicate_id },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'subject_predicate_node_missing',
        message:
          `Subject "${subject.id}" references missing predicate "${subject.predicate_id}".`,
        entity_type: 'subject',
        entity_id: subject.id,
        target_node_id: toGraphNodeId('predicate', subject.predicate_id),
      });
    }
  }

  for (const object of model.objects) {
    addNamespacedEntityIdDiagnostic(
      graphDiagnostics,
      diagnosticKeys,
      'object',
      object.id,
    );

    const objectNodeId = toGraphNodeId('object', object.id);

    addNode(nodes, nodeIds, {
      id: objectNodeId,
      type: 'object',
      label: object.surface || object.lemma || object.id,
      data: asJsonObject(object),
    });

    objectNodesById[object.id] = objectNodeId;

    addEdge(edges, edgeIds, {
      id: edgeId('contains', root.id, objectNodeId),
      type: 'contains',
      from: root.id,
      to: objectNodeId,
      label: 'contains object',
      data: { object_id: object.id },
    });

    const tokenNodeId = tokenNodesByIndex[String(object.token_index)];
    if (tokenNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('realizes_token', objectNodeId, tokenNodeId),
        type: 'realizes_token',
        from: objectNodeId,
        to: tokenNodeId,
        label: 'realizes token',
        data: { token_index: object.token_index },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'object_token_node_missing',
        message:
          `Object "${object.id}" references missing token index ${object.token_index}.`,
        entity_type: 'object',
        entity_id: object.id,
        target_node_id: toGraphNodeId('token', String(object.token_index)),
      });
    }

    const clauseNodeId = clauseNodesById[object.clause_id];
    if (clauseNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('belongs_to_clause', objectNodeId, clauseNodeId),
        type: 'belongs_to_clause',
        from: objectNodeId,
        to: clauseNodeId,
        label: 'belongs to clause',
        data: { clause_id: object.clause_id },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'object_clause_node_missing',
        message:
          `Object "${object.id}" references missing clause "${object.clause_id}".`,
        entity_type: 'object',
        entity_id: object.id,
        target_node_id: toGraphNodeId('clause', object.clause_id),
      });
    }

    const predicateNodeId = predicateNodesById[object.predicate_id];
    if (predicateNodeId) {
      addEdge(edges, edgeIds, {
        id: edgeId('targets_predicate', objectNodeId, predicateNodeId),
        type: 'targets_predicate',
        from: objectNodeId,
        to: predicateNodeId,
        label: 'targets predicate',
        data: { predicate_id: object.predicate_id },
      });
    } else {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'object_predicate_node_missing',
        message:
          `Object "${object.id}" references missing predicate "${object.predicate_id}".`,
        entity_type: 'object',
        entity_id: object.id,
        target_node_id: toGraphNodeId('predicate', object.predicate_id),
      });
    }
  }

  // Universal dependency projection. No inference is allowed here.
  for (const dependency of model.dependencies) {
    const sourceExists = nodeIds.has(dependency.source_node_id);
    const targetExists = nodeIds.has(dependency.target_node_id);

    if (!sourceExists) {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'dependency_source_node_missing',
        message:
          `Dependency "${dependency.id}" source node "${dependency.source_node_id}" does not exist.`,
        entity_type: 'dependency',
        entity_id: dependency.id,
        dependency_id: dependency.id,
        source_node_id: dependency.source_node_id,
        target_node_id: dependency.target_node_id,
      });
    }

    if (!targetExists) {
      addDiagnostic(graphDiagnostics, diagnosticKeys, {
        severity: 'warning',
        code: 'dependency_target_node_missing',
        message:
          `Dependency "${dependency.id}" target node "${dependency.target_node_id}" does not exist.`,
        entity_type: 'dependency',
        entity_id: dependency.id,
        dependency_id: dependency.id,
        source_node_id: dependency.source_node_id,
        target_node_id: dependency.target_node_id,
      });
    }

    if (!sourceExists || !targetExists) continue;

    const graphEdgeId = dependency.id || edgeId(
      dependency.relation,
      dependency.source_node_id,
      dependency.target_node_id,
    );

    const created = addEdge(edges, edgeIds, {
      id: graphEdgeId,
      type: dependency.relation,
      from: dependency.source_node_id,
      to: dependency.target_node_id,
      label: dependency.relation,
      data: asJsonObject(dependency),
    });

    if (created) dependencyEdgesById[dependency.id] = graphEdgeId;
  }

  for (let index = 0; index < model.diagnostics.length; index++) {
    const diagnostic = model.diagnostics[index];
    const diagnosticNodeId = toGraphNodeId('diagnostic', `model:${index}`);

    addNode(nodes, nodeIds, {
      id: diagnosticNodeId,
      type: 'diagnostic',
      label: diagnostic.code,
      data: asJsonObject({
        source: 'sentence_model',
        ...diagnostic,
        token_index: diagnostic.token_index ?? null,
        rule_code: diagnostic.rule_code ?? null,
        metadata: diagnostic.metadata ?? {},
      }),
    });

    const targetNodeId =
      diagnostic.token_index !== undefined
        ? tokenNodesByIndex[String(diagnostic.token_index)] ?? root.id
        : root.id;

    addEdge(edges, edgeIds, {
      id: edgeId('has_diagnostic', targetNodeId, diagnosticNodeId),
      type: 'has_diagnostic',
      from: targetNodeId,
      to: diagnosticNodeId,
      label: 'has diagnostic',
      data: { severity: diagnostic.severity },
    });
  }

  for (let index = 0; index < graphDiagnostics.length; index++) {
    const diagnostic = graphDiagnostics[index];
    const diagnosticNodeId = toGraphNodeId('diagnostic', `graph:${index}`);

    addNode(nodes, nodeIds, {
      id: diagnosticNodeId,
      type: 'diagnostic',
      label: diagnostic.code,
      data: asJsonObject({
        source: 'language_graph_engine',
        ...diagnostic,
      }),
    });

    const candidates = [
      diagnostic.source_node_id,
      diagnostic.target_node_id,
      diagnostic.entity_type && diagnostic.entity_id
        ? `${diagnostic.entity_type}:${diagnostic.entity_id}`
        : null,
    ].filter((item): item is string => Boolean(item));

    const targetNodeId =
      candidates.find((candidate) => nodeIds.has(candidate)) ?? root.id;

    addEdge(edges, edgeIds, {
      id: edgeId('has_diagnostic', targetNodeId, diagnosticNodeId),
      type: 'has_diagnostic',
      from: targetNodeId,
      to: diagnosticNodeId,
      label: 'has diagnostic',
      data: { severity: diagnostic.severity },
    });
  }

  const countByType = (type: GraphNodeType): number =>
    nodes.filter((node) => node.type === type).length;

  const dependencyEdgeCount = model.dependencies.filter(
    (dependency) => dependencyEdgesById[dependency.id] !== undefined,
  ).length;

  return {
    graph_version: GRAPH_VERSION,
    source_model_version: model.model_version,
    root_node_id: root.id,
    nodes,
    edges,
    indexes: {
      token_nodes_by_index: tokenNodesByIndex,
      selected_candidate_nodes_by_token_index:
        selectedCandidateNodesByTokenIndex,
      compound_analysis_nodes_by_id:
        compoundAnalysisNodesById,
      compound_component_nodes_by_analysis_id:
        compoundComponentNodesByAnalysisId,
      predicate_nodes_by_id: predicateNodesById,
      construction_nodes_by_predicate_id:
        constructionNodesByPredicateId,
      clause_nodes_by_id: clauseNodesById,
      subject_nodes_by_id: subjectNodesById,
      object_nodes_by_id: objectNodesById,
      dependency_edges_by_id: dependencyEdgesById,
    },
    diagnostics: graphDiagnostics,
    summary: {
      node_count: nodes.length,
      edge_count: edges.length,
      sentence_count: countByType('sentence'),
      token_count: countByType('token'),
      candidate_count: countByType('candidate'),
      compound_analysis_count: countByType('compound_analysis'),
      compound_component_count: countByType('compound_component'),
      construction_count: countByType('construction'),
      predicate_count: countByType('predicate'),
      clause_count: countByType('clause'),
      subject_count: countByType('subject'),
      object_count: countByType('object'),
      diagnostic_count: countByType('diagnostic'),
      source_dependency_count: model.dependencies.length,
      dependency_edge_count: dependencyEdgeCount,
      skipped_dependency_count: model.dependencies.length - dependencyEdgeCount,
      graph_diagnostic_count: graphDiagnostics.length,
    },
  };
}

function validateArrayField(model: Record<string, unknown>, field: string): void {
  if (!Array.isArray(model[field])) {
    throw new RequestValidationError(
      `sentence_model.${field} must be an array.`,
    );
  }
}

function validateSentenceModel(value: unknown): asserts value is SentenceModel {
  if (!isObject(value)) {
    throw new RequestValidationError('sentence_model must be an object.');
  }

  if (typeof value.model_version !== 'string' || !value.model_version.trim()) {
    throw new RequestValidationError(
      'sentence_model.model_version must be a non-empty string.',
    );
  }

  validateArrayField(value, 'tokens');
  validateArrayField(value, 'predicates');
  validateArrayField(value, 'clauses');
  validateArrayField(value, 'dependencies');
  validateArrayField(value, 'subjects');
  validateArrayField(value, 'objects');
  validateArrayField(value, 'diagnostics');

  const dependencies = value.dependencies as unknown[];

  for (let index = 0; index < dependencies.length; index++) {
    const dependency = dependencies[index];

    if (!isObject(dependency)) {
      throw new RequestValidationError(
        `sentence_model.dependencies[${index}] must be an object.`,
      );
    }

    for (const field of ['id', 'relation', 'source_node_id', 'target_node_id']) {
      if (typeof dependency[field] !== 'string' || !dependency[field].trim()) {
        throw new RequestValidationError(
          `sentence_model.dependencies[${index}].${field} must be a non-empty string.`,
        );
      }
    }
  }
}

function validateRequest(body: unknown): LanguageGraphRequest {
  if (!isObject(body)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }

  validateSentenceModel(body.sentence_model);
  return { sentence_model: body.sentence_model };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    throw new RequestValidationError('Request body is empty.');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new RequestValidationError(
      'Request body is not valid JSON.',
      { raw_body_preview: rawBody.slice(0, 500) },
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
          engine_version: ENGINE_VERSION,
          error: 'Method not allowed.',
        },
        405,
      );
    }

    const body = validateRequest(await readJsonBody(request));
    const graph = buildLanguageGraph(body.sentence_model);

    return jsonResponse({
      ok: true,
      engine_version: ENGINE_VERSION,
      graph,
    });
  } catch (error) {
    const validation = error instanceof RequestValidationError;

    console.error(
      validation
        ? '[LANGUAGE GRAPH REQUEST ERROR]'
        : '[LANGUAGE GRAPH ERROR]',
      error,
    );

    return jsonResponse(
      {
        ok: false,
        engine_version: ENGINE_VERSION,
        error: error instanceof Error ? error.message : String(error),
        details: validation ? error.details ?? null : null,
      },
      validation ? validation.status : 500,
    );
  }
});
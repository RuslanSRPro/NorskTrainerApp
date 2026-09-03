// Norsk Trainer — Canonical Phrase Candidate Lattice V1 (v1.43)
//
// Native canonical phrase candidate generation over Canonical Language Graph V1.
// This producer does not retokenize text, does not require resolved POS, and does
// not resolve phrases. Runtime IR provides the phrase-generation knowledge;
// this file only interprets that knowledge into bounded graph candidates.

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  GraphSpanV1,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1 =
  'canonical_phrase_candidate_lattice_v1';
export const CANONICAL_PHRASE_CANDIDATE_LATTICE_VERSION_V1 = '1';

type Json = Record<string, unknown>;

export type CanonicalPhraseConstraintStrengthV1 =
  | 'hard'
  | 'categorical'
  | 'obligatory'
  | 'strong'
  | 'default'
  | 'default_paradigm'
  | 'default_with_lexical_exceptions'
  | 'supporting'
  | 'preference'
  | string;

export type CanonicalPhraseRuntimeSourceRefV1 = {
  candidateId?: string;
  candidateCode: string;
  sourceSection?: string;
  status?: string;
  title?: string;
  bindingLevel: 'manifest' | 'rule';
};

export type CanonicalPhraseRuntimeRuleV1 = {
  ruleId: string;
  ruleCode: string;
  runtimeFamily?: string;
  executionPhase?: string;
  patternType: 'phrase_pattern';
  constraintStrength?: CanonicalPhraseConstraintStrengthV1;
  pattern: {
    bindings?: Json;
    head_ref?: string;
    condition?: unknown;
    phrase_type?: string;
    build_strategy?: string;
    dependent_ref?: string;
    max_gap?: number;
    transparent_lexical_classes?: string[];
    max_left_tokens?: number;
    allowed_left_dependents?: string[];
    allowed_right_dependents?: string[];
    [key: string]: unknown;
  };
  actions?: unknown[];
  // sourceRefs preserves the live DB distinction between manifest-level source
  // context and direct grammar-rule source ownership. The flattened arrays are
  // retained as a compatibility/summary view only.
  sourceRefs?: CanonicalPhraseRuntimeSourceRefV1[];
  ruleSourceCandidateCodes?: string[];
  manifestSourceCandidateCodes?: string[];
  sourceCandidateCodes?: string[];
  sourceSections?: string[];
  manifestCode?: string;
  compilerVersion?: string;
  compileHash?: string;
};

export type CanonicalPhraseRuntimeRuleRowV1 = {
  rule_id?: unknown;
  rule_code?: unknown;
  runtime_family?: unknown;
  execution_phase?: unknown;
  pattern_type?: unknown;
  constraint_strength?: unknown;
  pattern?: unknown;
  actions?: unknown;
  manifest_code?: unknown;
  compiler_version?: unknown;
  compile_hash?: unknown;
  manifest_sources?: unknown;
  rule_sources?: unknown;
  source_candidate_codes?: unknown;
  source_sections?: unknown;
};

// Optional source-backed structural support that is not yet represented as its
// own canonical node family. This is data input, never a Norwegian word list.
export type CanonicalPhraseLexicalClassFactV1 = {
  id: string;
  tokenId: string;
  classCode: string;
  status: 'candidate' | 'resolved' | 'ambiguous';
  evidenceIds?: string[];
  provenanceIds?: string[];
  payload?: Record<string, unknown>;
};

export type CanonicalPhraseRelationSpecV1 = {
  relation: string;
  sourcePhraseType: string;
  targetPhraseType: string;
  position: 'left' | 'right' | 'inside';
  sourceCandidateCodes?: string[];
  sourceSections?: string[];
};

export type CanonicalPhraseCandidateOptionsV1 = {
  // Operational safety bounds only; these are not linguistic rules.
  maxPasses?: number;
  maxCandidatesPerSentence?: number;
};

export type CanonicalPhraseCandidateSummaryV1 = {
  producer: typeof CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1;
  producerVersion: typeof CANONICAL_PHRASE_CANDIDATE_LATTICE_VERSION_V1;
  phraseNodes: number;
  phraseTypes: Record<string, number>;
  candidateEdges: number;
  headEdges: number;
  memberEdges: number;
  phraseRelations: number;
  alternativeSets: number;
  singletonAlternativeSets: number;
  resolvedFacts: number;
  rejectedFacts: number;
};

type TokenInfo = {
  id: string;
  sentenceIndex: number;
  sentenceTokenIndex: number;
  documentTokenIndex: number;
  startUtf16?: number;
  endUtf16?: number;
};

type PosCandidate = {
  node: LanguageGraphNodeV1;
  tokenId: string;
  pos: string;
};

type MorphFeatureConstraint = {
  key: string;
  value: string;
};

type HeadBindingSpec =
  | {
      headRef: string;
      kind: 'pos';
      pos: string;
    }
  | {
      headRef: string;
      kind: 'morph_features';
      features: MorphFeatureConstraint[];
    };

type PhraseHeadCandidate = {
  node: LanguageGraphNodeV1;
  tokenId: string;
  pos?: string;
  bindingRef: string;
  bindingKind: HeadBindingSpec['kind'];
  featureConstraints?: MorphFeatureConstraint[];
};

type DependentUnit = {
  id: string;
  label: string;
  sentenceIndex: number;
  startIndex: number;
  endIndex: number;
  tokenIds: string[];
  kind: 'phrase' | 'lexical_class';
  evidenceIds: string[];
  provenanceIds: string[];
};

type PhraseBuild = {
  node: LanguageGraphNodeV1;
  edges: LanguageGraphEdgeV1[];
  evidence: LanguageGraphEvidenceV1;
  provenance: LanguageGraphProvenanceV1[];
};

const DEFAULT_MAX_PASSES = 4;
const DEFAULT_MAX_CANDIDATES_PER_SENTENCE = 512;

const SUPPORTED_PHRASE_BUILD_STRATEGIES = new Set([
  'head_only',
  'head_plus_left_dependents',
  'head_plus_adjacent_right_dependent',
]);

function asRecord(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Json
    : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizedLabel(value: unknown): string | undefined {
  const v = stringValue(value);
  return v?.normalize('NFC').toLocaleLowerCase('nb-NO');
}

function idPart(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '_');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const map = new Map<string, T>();
  for (const value of values) map.set(value.id, value);
  return [...map.values()];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map(stringValue).filter((x): x is string => Boolean(x))).sort();
}

function runtimeSourceRefsFromRowV1(
  value: unknown,
  bindingLevel: 'manifest' | 'rule',
): CanonicalPhraseRuntimeSourceRefV1[] {
  if (!Array.isArray(value)) return [];
  const out: CanonicalPhraseRuntimeSourceRefV1[] = [];
  for (const raw of value) {
    const item = asRecord(raw);
    const candidateCode = stringValue(item.candidate_code);
    if (!candidateCode) continue;
    out.push({
      candidateId: stringValue(item.candidate_id),
      candidateCode,
      sourceSection: stringValue(item.source_section),
      status: stringValue(item.status),
      title: stringValue(item.title),
      bindingLevel,
    });
  }
  return out.sort((a, b) =>
    a.candidateCode.localeCompare(b.candidateCode) ||
    a.bindingLevel.localeCompare(b.bindingLevel) ||
    (a.sourceSection ?? '').localeCompare(b.sourceSection ?? '')
  );
}

export function canonicalPhraseRuntimeRuleFromRowV1(
  row: CanonicalPhraseRuntimeRuleRowV1,
): CanonicalPhraseRuntimeRuleV1 | undefined {
  const ruleId = stringValue(row.rule_id);
  const ruleCode = stringValue(row.rule_code);
  const patternType = stringValue(row.pattern_type);
  const pattern = asRecord(row.pattern);
  if (!ruleId || !ruleCode || patternType !== 'phrase_pattern') return undefined;
  if (!stringValue(pattern.phrase_type) || !headBindingSpec({
    ruleId,
    ruleCode,
    patternType: 'phrase_pattern',
    pattern,
  })) return undefined;

  const manifestSourceRefs = runtimeSourceRefsFromRowV1(
    row.manifest_sources,
    'manifest',
  );
  const ruleSourceRefs = runtimeSourceRefsFromRowV1(row.rule_sources, 'rule');
  const sourceRefs = [...manifestSourceRefs, ...ruleSourceRefs];
  const flattenedCandidateCodes = stringArray(row.source_candidate_codes);
  const flattenedSections = stringArray(row.source_sections);
  const sourceCandidateCodes = unique([
    ...flattenedCandidateCodes,
    ...sourceRefs.map((ref) => ref.candidateCode),
  ]).sort();
  const sourceSections = unique([
    ...flattenedSections,
    ...sourceRefs.map((ref) => ref.sourceSection).filter((x): x is string => Boolean(x)),
  ]).sort();

  return {
    ruleId,
    ruleCode,
    runtimeFamily: stringValue(row.runtime_family),
    executionPhase: stringValue(row.execution_phase),
    patternType: 'phrase_pattern',
    constraintStrength: stringValue(row.constraint_strength),
    pattern,
    actions: Array.isArray(row.actions) ? row.actions : [],
    sourceRefs,
    ruleSourceCandidateCodes: unique(ruleSourceRefs.map((ref) => ref.candidateCode)).sort(),
    manifestSourceCandidateCodes: unique(manifestSourceRefs.map((ref) => ref.candidateCode)).sort(),
    sourceCandidateCodes,
    sourceSections,
    manifestCode: stringValue(row.manifest_code),
    compilerVersion: stringValue(row.compiler_version),
    compileHash: stringValue(row.compile_hash),
  };
}

export function normalizeCanonicalPhraseRuntimeRuleRowsV1(
  rows: readonly CanonicalPhraseRuntimeRuleRowV1[],
): CanonicalPhraseRuntimeRuleV1[] {
  const byCode = new Map<string, CanonicalPhraseRuntimeRuleV1>();
  for (const row of rows) {
    const rule = canonicalPhraseRuntimeRuleFromRowV1(row);
    if (rule) byCode.set(rule.ruleCode, rule);
  }
  return [...byCode.values()].sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
}

function tokenMap(graph: CanonicalLanguageGraphV1): Map<string, TokenInfo> {
  const out = new Map<string, TokenInfo>();
  for (const node of graph.nodes) {
    if (node.type !== 'token') continue;
    const sentenceIndex = numberValue(node.features.sentenceIndex);
    const sentenceTokenIndex = numberValue(node.features.sentenceTokenIndex);
    const documentTokenIndex = numberValue(node.features.documentTokenIndex);
    if (
      sentenceIndex === undefined || sentenceTokenIndex === undefined ||
      documentTokenIndex === undefined
    ) continue;
    out.set(node.id, {
      id: node.id,
      sentenceIndex,
      sentenceTokenIndex,
      documentTokenIndex,
      startUtf16: node.span?.startUtf16,
      endUtf16: node.span?.endUtf16,
    });
  }
  return out;
}

function sentenceTokens(tokens: Map<string, TokenInfo>): Map<number, TokenInfo[]> {
  const out = new Map<number, TokenInfo[]>();
  for (const token of tokens.values()) {
    const arr = out.get(token.sentenceIndex) ?? [];
    arr.push(token);
    out.set(token.sentenceIndex, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.sentenceTokenIndex - b.sentenceTokenIndex);
  }
  return out;
}

function tokenIdFromNode(node: LanguageGraphNodeV1): string | undefined {
  const ids = node.span?.tokenIds ?? [];
  if (ids.length === 1) return ids[0];
  if (
    node.span?.startTokenId && node.span.startTokenId === node.span.endTokenId
  ) return node.span.startTokenId;
  return undefined;
}

function posCandidates(
  graph: CanonicalLanguageGraphV1,
  tokens: Map<string, TokenInfo>,
): PosCandidate[] {
  const out: PosCandidate[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'lexical_reading') continue;
    if (node.status === 'rejected' || node.status === 'blocked') continue;

    // v1.41 uses subtype=pos_candidate. subtype=pos is accepted only as a
    // compatibility read; it does not change ownership or upgrade its status.
    if (node.subtype !== 'pos_candidate' && node.subtype !== 'pos') continue;
    const pos = normalizedLabel(node.features.pos);
    const tokenId = tokenIdFromNode(node);
    if (!pos || !tokenId || !tokens.has(tokenId)) continue;
    out.push({ node, tokenId, pos });
  }
  return out.sort((a, b) => a.node.id.localeCompare(b.node.id));
}

function featureAssignment(
  value: unknown,
): { key: string; value: string } | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;

  const separator = raw.indexOf('=');
  if (separator <= 0 || separator >= raw.length - 1) return undefined;

  const key = raw.slice(0, separator).trim();
  const featureValue = raw.slice(separator + 1).trim();
  if (!key || !featureValue) return undefined;

  return { key, value: featureValue };
}

function morphFeatureConstraint(
  expression: unknown,
  bindingRef: string,
): MorphFeatureConstraint | undefined {
  const item = asRecord(expression);
  if (normalizedLabel(item.op) !== 'has_feature') return undefined;

  const left = asRecord(item.left);
  if (stringValue(left.ref) !== `${bindingRef}.morph`) return undefined;

  return featureAssignment(item.right);
}

function bindingSpecForRef(
  rule: CanonicalPhraseRuntimeRuleV1,
  bindingRef: string,
): HeadBindingSpec | undefined {
  const bindings = asRecord(rule.pattern.bindings);
  const binding = asRecord(bindings[bindingRef]);
  const where = asRecord(binding.where);

  const all = Array.isArray(where.all) ? where.all : undefined;
  if (all) {
    if (all.length === 0) return undefined;

    const features = all.map((expression) =>
      morphFeatureConstraint(expression, bindingRef)
    );

    if (features.some((feature) => !feature)) return undefined;

    return {
      headRef: bindingRef,
      kind: 'morph_features',
      features: features as MorphFeatureConstraint[],
    };
  }

  const op = normalizedLabel(where.op);
  const left = asRecord(where.left);
  const ref = stringValue(left.ref);

  if (!ref) return undefined;

  if (op === 'eq' && ref === `${bindingRef}.pos`) {
    const pos = normalizedLabel(where.right);
    if (!pos) return undefined;

    return {
      headRef: bindingRef,
      kind: 'pos',
      pos,
    };
  }

  if (op === 'has_feature' && ref === `${bindingRef}.morph`) {
    const feature = featureAssignment(where.right);
    if (!feature) return undefined;

    return {
      headRef: bindingRef,
      kind: 'morph_features',
      features: [feature],
    };
  }

  return undefined;
}

function headBindingSpec(
  rule: CanonicalPhraseRuntimeRuleV1,
): HeadBindingSpec | undefined {
  const headRef = stringValue(rule.pattern.head_ref) ?? 'head';
  return bindingSpecForRef(rule, headRef);
}

function phraseHeadCandidates(
  graph: CanonicalLanguageGraphV1,
  tokens: Map<string, TokenInfo>,
  spec: HeadBindingSpec,
): PhraseHeadCandidate[] {
  if (spec.kind === 'pos') {
    return posCandidates(graph, tokens)
      .filter((candidate) => candidate.pos === spec.pos)
      .map((candidate) => ({
        node: candidate.node,
        tokenId: candidate.tokenId,
        pos: candidate.pos,
        bindingRef: spec.headRef,
        bindingKind: spec.kind,
      }));
  }

  const out: PhraseHeadCandidate[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'morph_reading') continue;
    if (node.status === 'rejected' || node.status === 'blocked') continue;

    const tokenId = tokenIdFromNode(node);
    if (!tokenId || !tokens.has(tokenId)) continue;

    const canonicalFeatures = asRecord(node.features.canonicalFeatures);

    const matchesAllFeatures = spec.features.every((feature) => {
      const actual = canonicalFeatures[feature.key];
      return actual !== undefined && String(actual) === feature.value;
    });

    if (!matchesAllFeatures) continue;

    out.push({
      node,
      tokenId,
      pos: normalizedLabel(node.features.pos),
      bindingRef: spec.headRef,
      bindingKind: spec.kind,
      featureConstraints: spec.features.map((feature) => ({ ...feature })),
    });
  }

  return out.sort((a, b) => a.node.id.localeCompare(b.node.id));
}

function headEvidenceFeatures(head: PhraseHeadCandidate): Json {
  if (head.bindingKind === 'pos') {
    return {
      headPosCandidateId: head.node.id,
      headPos: head.pos ?? null,
    };
  }

  const morphFeatures = (head.featureConstraints ?? [])
    .map((feature) => `${feature.key}=${feature.value}`);

  return {
    headMorphReadingId: head.node.id,
    headMorphFeature: morphFeatures.length === 1 ? morphFeatures[0] : null,
    headMorphFeatures: morphFeatures,
    headPos: head.pos ?? null,
    headBindingRef: head.bindingRef,
  };
}

function phraseType(rule: CanonicalPhraseRuntimeRuleV1): string | undefined {
  return stringValue(rule.pattern.phrase_type);
}

function graphSpanForTokenIds(
  tokenIds: string[],
  tokens: Map<string, TokenInfo>,
): GraphSpanV1 | undefined {
  if (!tokenIds.length) return undefined;
  const tokenInfos = tokenIds
    .map((id) => tokens.get(id))
    .filter((t): t is TokenInfo => Boolean(t))
    .sort((a, b) => a.sentenceTokenIndex - b.sentenceTokenIndex);
  if (!tokenInfos.length || tokenInfos.length !== tokenIds.length) return undefined;
  const sentenceIndex = tokenInfos[0].sentenceIndex;
  if (tokenInfos.some((t) => t.sentenceIndex !== sentenceIndex)) return undefined;
  return {
    startTokenId: tokenInfos[0].id,
    endTokenId: tokenInfos[tokenInfos.length - 1].id,
    tokenIds: tokenInfos.map((t) => t.id),
    startUtf16: tokenInfos[0].startUtf16,
    endUtf16: tokenInfos[tokenInfos.length - 1].endUtf16,
  };
}

function phraseNodeToUnit(
  node: LanguageGraphNodeV1,
  tokens: Map<string, TokenInfo>,
): DependentUnit | undefined {
  if (node.type !== 'phrase' || node.status === 'rejected' || node.status === 'blocked') {
    return undefined;
  }
  const label = stringValue(node.subtype);
  const ids = node.span?.tokenIds ?? [];
  if (!label || !ids.length) return undefined;
  const first = tokens.get(ids[0]);
  const last = tokens.get(ids[ids.length - 1]);
  if (!first || !last || first.sentenceIndex !== last.sentenceIndex) return undefined;
  return {
    id: node.id,
    label,
    sentenceIndex: first.sentenceIndex,
    startIndex: first.sentenceTokenIndex,
    endIndex: last.sentenceTokenIndex,
    tokenIds: [...ids],
    kind: 'phrase',
    evidenceIds: [...node.evidenceIds],
    provenanceIds: [...node.provenanceIds],
  };
}

function lexicalClassToUnit(
  fact: CanonicalPhraseLexicalClassFactV1,
  tokens: Map<string, TokenInfo>,
): DependentUnit | undefined {
  const token = tokens.get(fact.tokenId);
  if (!token) return undefined;
  if (fact.status === 'ambiguous' || fact.status === 'candidate' || fact.status === 'resolved') {
    return {
      id: fact.id,
      label: fact.classCode,
      sentenceIndex: token.sentenceIndex,
      startIndex: token.sentenceTokenIndex,
      endIndex: token.sentenceTokenIndex,
      tokenIds: [token.id],
      kind: 'lexical_class',
      evidenceIds: [...(fact.evidenceIds ?? [])],
      provenanceIds: [...(fact.provenanceIds ?? [])],
    };
  }
  return undefined;
}

function leftExpansions(
  head: TokenInfo,
  units: DependentUnit[],
  allowedLabels: Set<string>,
  maxLeftTokens: number,
): DependentUnit[][] {
  const out: DependentUnit[][] = [[]];
  if (maxLeftTokens <= 0 || allowedLabels.size === 0) return out;

  const byEnd = new Map<number, DependentUnit[]>();
  for (const unit of units) {
    if (unit.sentenceIndex !== head.sentenceIndex) continue;
    if (!allowedLabels.has(unit.label)) continue;
    const arr = byEnd.get(unit.endIndex) ?? [];
    arr.push(unit);
    byEnd.set(unit.endIndex, arr);
  }
  for (const arr of byEnd.values()) arr.sort((a, b) => a.id.localeCompare(b.id));

  const walk = (
    currentStart: number,
    usedTokens: number,
    chosenNearestFirst: DependentUnit[],
  ) => {
    const next = byEnd.get(currentStart - 1) ?? [];
    for (const unit of next) {
      const width = unit.endIndex - unit.startIndex + 1;
      if (width <= 0 || usedTokens + width > maxLeftTokens) continue;
      if (chosenNearestFirst.some((x) => x.id === unit.id)) continue;
      const chosen = [...chosenNearestFirst, unit];
      out.push([...chosen].reverse());
      walk(unit.startIndex, usedTokens + width, chosen);
    }
  };

  walk(head.sentenceTokenIndex, 0, []);
  return out;
}

function adjacentRightExpansions(
  head: TokenInfo,
  units: DependentUnit[],
  allowedLabels: Set<string>,
): DependentUnit[][] {
  const out: DependentUnit[][] = [[]];
  if (allowedLabels.size === 0) return out;

  const nextIndex = head.sentenceTokenIndex + 1;
  const candidates = units
    .filter((unit) =>
      unit.sentenceIndex === head.sentenceIndex &&
      unit.startIndex === nextIndex &&
      allowedLabels.has(unit.label)
    )
    .sort((a, b) =>
      a.endIndex - b.endIndex ||
      a.id.localeCompare(b.id)
    );

  for (const unit of candidates) {
    out.push([unit]);
  }

  return out;
}
function ruleProvenance(rule: CanonicalPhraseRuntimeRuleV1): LanguageGraphProvenanceV1[] {
  const runtimeId = `prov:${CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1}:runtime_rule:${idPart(rule.ruleCode)}`;
  const out: LanguageGraphProvenanceV1[] = [{
    id: runtimeId,
    sourceType: 'runtime_fact',
    sourceId: rule.ruleCode,
    payload: {
      ruleId: rule.ruleId,
      runtimeFamily: rule.runtimeFamily ?? null,
      executionPhase: rule.executionPhase ?? null,
      patternType: rule.patternType,
      manifestCode: rule.manifestCode ?? null,
      compilerVersion: rule.compilerVersion ?? null,
      compileHash: rule.compileHash ?? null,
    },
  }];

  const grouped = new Map<string, {
    candidateIds: Set<string>;
    sourceSections: Set<string>;
    statuses: Set<string>;
    titles: Set<string>;
    bindingLevels: Set<'manifest' | 'rule'>;
  }>();

  for (const ref of rule.sourceRefs ?? []) {
    const group = grouped.get(ref.candidateCode) ?? {
      candidateIds: new Set<string>(),
      sourceSections: new Set<string>(),
      statuses: new Set<string>(),
      titles: new Set<string>(),
      bindingLevels: new Set<'manifest' | 'rule'>(),
    };
    if (ref.candidateId) group.candidateIds.add(ref.candidateId);
    if (ref.sourceSection) group.sourceSections.add(ref.sourceSection);
    if (ref.status) group.statuses.add(ref.status);
    if (ref.title) group.titles.add(ref.title);
    group.bindingLevels.add(ref.bindingLevel);
    grouped.set(ref.candidateCode, group);
  }

  // Backward-compatible fallback for older flattened snapshots/fixtures.
  if (grouped.size === 0) {
    for (const code of unique(rule.sourceCandidateCodes ?? []).sort()) {
      grouped.set(code, {
        candidateIds: new Set<string>(),
        sourceSections: new Set(rule.sourceSections ?? []),
        statuses: new Set<string>(),
        titles: new Set<string>(),
        bindingLevels: new Set<'manifest' | 'rule'>(),
      });
    }
  }

  for (const [code, group] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out.push({
      id: `prov:${CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1}:source_rule:${idPart(code)}`,
      sourceType: 'source_rule',
      sourceId: code,
      payload: {
        candidateIds: [...group.candidateIds].sort(),
        sourceSections: [...group.sourceSections].sort(),
        statuses: [...group.statuses].sort(),
        titles: [...group.titles].sort(),
        bindingLevels: [...group.bindingLevels].sort(),
      },
    });
  }
  return out;
}

function buildPhraseCandidate(
  rule: CanonicalPhraseRuntimeRuleV1,
  headCandidate: PhraseHeadCandidate,
  head: TokenInfo,
  dependentUnits: DependentUnit[],
  tokens: Map<string, TokenInfo>,
  relationSpecs: readonly CanonicalPhraseRelationSpecV1[],
): PhraseBuild | undefined {
  const type = phraseType(rule);
  if (!type) return undefined;

  const dependentTokenIds = dependentUnits.flatMap((u) => u.tokenIds);
  const memberTokenIds = unique([...dependentTokenIds, head.id]).sort((a, b) => {
    const aa = tokens.get(a)?.sentenceTokenIndex ?? Number.MAX_SAFE_INTEGER;
    const bb = tokens.get(b)?.sentenceTokenIndex ?? Number.MAX_SAFE_INTEGER;
    return aa - bb;
  });
  const span = graphSpanForTokenIds(memberTokenIds, tokens);
  if (!span) return undefined;

  const start = tokens.get(span.startTokenId ?? '');
  const end = tokens.get(span.endTokenId ?? '');
  if (!start || !end || start.sentenceIndex !== head.sentenceIndex) return undefined;

  const candidateId = [
    'phrasecand',
    idPart(type),
    idPart(head.id),
    idPart(span.startTokenId ?? head.id),
    idPart(span.endTokenId ?? head.id),
    idPart(headCandidate.node.id),
    idPart(rule.ruleCode),
    dependentUnits.map((u) => idPart(u.id)).join('+') || 'head_only',
  ].join(':');

  const newProvenance = ruleProvenance(rule);
  const provenanceIds = unique([
    ...headCandidate.node.provenanceIds,
    ...dependentUnits.flatMap((u) => u.provenanceIds),
    ...newProvenance.map((p) => p.id),
  ]);
  const evidenceId = `evidence:${CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1}:${candidateId}`;

  const node: LanguageGraphNodeV1 = {
    id: candidateId,
    type: 'phrase',
    subtype: type,
    status: 'candidate',
    span,
    features: {
      phraseType: type,
      sentenceIndex: head.sentenceIndex,
      headTokenId: head.id,
      ...headEvidenceFeatures(headCandidate),
      ruleId: rule.ruleId,
      ruleCode: rule.ruleCode,
      runtimeFamily: rule.runtimeFamily ?? null,
      buildStrategy: rule.pattern.build_strategy ?? null,
      constraintStrength: rule.constraintStrength ?? null,
      memberTokenIds,
      dependentNodeIds: dependentUnits.map((u) => u.id),
      dependentLabels: dependentUnits.map((u) => u.label),
      sourceCandidateCodes: [...(rule.sourceCandidateCodes ?? [])],
      ruleSourceCandidateCodes: [...(rule.ruleSourceCandidateCodes ?? [])],
      manifestSourceCandidateCodes: [...(rule.manifestSourceCandidateCodes ?? [])],
      candidateGeneration: 'runtime_ir',
    },
    producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
    evidenceIds: [evidenceId],
    provenanceIds,
  };

  const edges: LanguageGraphEdgeV1[] = [];
  edges.push({
    id: `edge:head_of:${idPart(head.id)}:${idPart(candidateId)}`,
    relation: 'head_of',
    sourceId: head.id,
    targetId: candidateId,
    status: 'candidate',
    features: headEvidenceFeatures(headCandidate),
    producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
    evidenceIds: [evidenceId],
    provenanceIds,
  });

  for (const tokenId of memberTokenIds) {
    if (tokenId === head.id) continue;
    edges.push({
      id: `edge:member_of:${idPart(tokenId)}:${idPart(candidateId)}`,
      relation: 'member_of',
      sourceId: tokenId,
      targetId: candidateId,
      status: 'candidate',
      features: {},
      producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
      evidenceIds: [evidenceId],
      provenanceIds,
    });
  }

  // Phrase-to-phrase relations are source-backed data. The generic engine
  // never assumes that a particular phrase type implies a particular relation.
  for (const unit of dependentUnits) {
    if (unit.kind !== 'phrase') continue;
    for (const spec of relationSpecs) {
      if (spec.position !== 'left') continue;
      if (spec.sourcePhraseType !== unit.label || spec.targetPhraseType !== type) continue;
      const relation = stringValue(spec.relation);
      if (!relation) continue;
      edges.push({
        id: `edge:${idPart(relation)}:${idPart(unit.id)}:${idPart(candidateId)}`,
        relation,
        sourceId: unit.id,
        targetId: candidateId,
        status: 'candidate',
        features: {
          sourceCandidateCodes: [...(spec.sourceCandidateCodes ?? [])],
          sourceSections: [...(spec.sourceSections ?? [])],
        },
        producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
        evidenceIds: [evidenceId],
        provenanceIds,
      });
    }
  }

  const evidence: LanguageGraphEvidenceV1 = {
    id: evidenceId,
    kind: 'source_rule',
    status: 'supports',
    targetIds: [node.id, ...edges.map((e) => e.id)],
    payload: {
      ruleCode: rule.ruleCode,
      ruleId: rule.ruleId,
      patternType: rule.patternType,
      phraseType: type,
      buildStrategy: rule.pattern.build_strategy ?? null,
      constraintStrength: rule.constraintStrength ?? null,
      ...headEvidenceFeatures(headCandidate),
      sourceCandidateCodes: [...(rule.sourceCandidateCodes ?? [])],
      ruleSourceCandidateCodes: [...(rule.ruleSourceCandidateCodes ?? [])],
      manifestSourceCandidateCodes: [...(rule.manifestSourceCandidateCodes ?? [])],
      sourceRefs: (rule.sourceRefs ?? []).map((ref) => ({ ...ref })),
      sourceSections: [...(rule.sourceSections ?? [])],
      manifestCode: rule.manifestCode ?? null,
      compilerVersion: rule.compilerVersion ?? null,
      compileHash: rule.compileHash ?? null,
      dependentUnits: dependentUnits.map((u) => ({
        id: u.id,
        label: u.label,
        kind: u.kind,
      })),
      resolutionPolicy: 'candidate_only',
    },
    producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
    provenanceIds,
  };

  return { node, edges, evidence, provenance: newProvenance };
}

function alternativeSetsForPhrases(
  nodes: LanguageGraphNodeV1[],
): LanguageGraphAlternativeSetV1[] {
  const groups = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.type !== 'phrase') continue;
    const type = stringValue(node.subtype);
    const headTokenId = stringValue(node.features.headTokenId);
    const sentenceIndex = numberValue(node.features.sentenceIndex);
    if (!type || !headTokenId || sentenceIndex === undefined) continue;
    const key = `${sentenceIndex}|${type}|${headTokenId}`;
    const arr = groups.get(key) ?? [];
    arr.push(node.id);
    groups.set(key, arr);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, memberIds]) => ({
      id: `alt:phrase:${idPart(key)}`,
      memberIds: unique(memberIds).sort(),
      resolvedMemberIds: [],
      status: 'open' as const,
      reason: 'canonical_phrase_candidates_wait_for_evidence',
    }));
}

export function buildCanonicalPhraseCandidateLatticePatchV1(
  graph: CanonicalLanguageGraphV1,
  rules: readonly CanonicalPhraseRuntimeRuleV1[],
  lexicalClassFacts: readonly CanonicalPhraseLexicalClassFactV1[] = [],
  relationSpecs: readonly CanonicalPhraseRelationSpecV1[] = [],
  options: CanonicalPhraseCandidateOptionsV1 = {},
): GraphPatchV1 {
  const producer = CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1;
  const producerVersion = CANONICAL_PHRASE_CANDIDATE_LATTICE_VERSION_V1;
  const tokens = tokenMap(graph);
  const bySentence = sentenceTokens(tokens);

  const maxPasses = Math.max(1, Math.floor(options.maxPasses ?? DEFAULT_MAX_PASSES));
  const maxPerSentence = Math.max(
    1,
    Math.floor(options.maxCandidatesPerSentence ?? DEFAULT_MAX_CANDIDATES_PER_SENTENCE),
  );

  const phraseRules = [...rules]
    .filter((r) => r.patternType === 'phrase_pattern')
    .filter((r) => Boolean(phraseType(r) && headBindingSpec(r)))
    .sort((a, b) => {
      const aa = a.pattern.build_strategy === 'head_only' ? 0 : 1;
      const bb = b.pattern.build_strategy === 'head_only' ? 0 : 1;
      return aa - bb || a.ruleCode.localeCompare(b.ruleCode);
    });

  const nodes = new Map<string, LanguageGraphNodeV1>();
  const edges = new Map<string, LanguageGraphEdgeV1>();
  const evidence = new Map<string, LanguageGraphEvidenceV1>();
  const provenance = new Map<string, LanguageGraphProvenanceV1>();
  const candidateCountBySentence = new Map<number, number>();

  const lexicalUnits = lexicalClassFacts
    .map((f) => lexicalClassToUnit(f, tokens))
    .filter((x): x is DependentUnit => Boolean(x));

  const addBuild = (build: PhraseBuild): boolean => {
    const sentenceIndex = numberValue(build.node.features.sentenceIndex);
    if (sentenceIndex === undefined) return false;
    if (nodes.has(build.node.id)) return false;
    const current = candidateCountBySentence.get(sentenceIndex) ?? 0;
    if (current >= maxPerSentence) return false;
    nodes.set(build.node.id, build.node);
    candidateCountBySentence.set(sentenceIndex, current + 1);
    for (const edge of build.edges) edges.set(edge.id, edge);
    evidence.set(build.evidence.id, build.evidence);
    for (const p of build.provenance) provenance.set(p.id, p);
    return true;
  };

  for (let pass = 0; pass < maxPasses; pass++) {
    let addedThisPass = 0;
    const phraseUnits = [...nodes.values()]
      .map((n) => phraseNodeToUnit(n, tokens))
      .filter((x): x is DependentUnit => Boolean(x));
    const units = [...lexicalUnits, ...phraseUnits];

    for (const rule of phraseRules) {
      const binding = headBindingSpec(rule);
      const type = phraseType(rule);
      if (!binding || !type) continue;

      const strategy = stringValue(rule.pattern.build_strategy) ?? 'head_only';
      if (!SUPPORTED_PHRASE_BUILD_STRATEGIES.has(strategy)) continue;

      const headCandidates = phraseHeadCandidates(graph, tokens, binding);

      const allowedLeft = new Set((rule.pattern.allowed_left_dependents ?? []).map((x) => x.trim()).filter(Boolean));
      const allowedRight = new Set((rule.pattern.allowed_right_dependents ?? []).map((x) => x.trim()).filter(Boolean));
      const maxLeftTokens = Math.max(0, Math.floor(rule.pattern.max_left_tokens ?? 0));

      for (const headCandidate of headCandidates) {
        const head = tokens.get(headCandidate.tokenId);
        if (!head || !bySentence.has(head.sentenceIndex)) continue;

        // Every supported head gets a head-only phrase candidate. A richer
        // phrase strategy may add structural alternatives; construction
        // recognition is owned by the construction layer.
        const variants = strategy === 'head_plus_left_dependents'
          ? leftExpansions(head, units, allowedLeft, maxLeftTokens)
          : strategy === 'head_plus_adjacent_right_dependent'
          ? adjacentRightExpansions(head, units, allowedRight)
          : [[]];

        for (const dependentUnits of variants) {
          const build = buildPhraseCandidate(
            rule,
            headCandidate,
            head,
            dependentUnits,
            tokens,
            relationSpecs,
          );
          if (build && addBuild(build)) addedThisPass++;
        }
      }
    }

    if (addedThisPass === 0) break;
  }

  const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edgeList = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));

  return {
    producer,
    producerVersion,
    nodes: nodeList,
    edges: edgeList,
    evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)),
    provenance: [...provenance.values()].sort((a, b) => a.id.localeCompare(b.id)),
    alternativeSets: alternativeSetsForPhrases(nodeList),
  };
}

export function summarizeCanonicalPhraseCandidateLatticePatchV1(
  patch: GraphPatchV1,
): CanonicalPhraseCandidateSummaryV1 {
  const phraseNodes = (patch.nodes ?? []).filter((n) => n.type === 'phrase');
  const phraseTypes: Record<string, number> = {};
  for (const node of phraseNodes) {
    const type = node.subtype ?? '<unknown>';
    phraseTypes[type] = (phraseTypes[type] ?? 0) + 1;
  }
  const edges = patch.edges ?? [];
  const allFacts = [...(patch.nodes ?? []), ...edges];
  return {
    producer: CANONICAL_PHRASE_CANDIDATE_LATTICE_PRODUCER_V1,
    producerVersion: CANONICAL_PHRASE_CANDIDATE_LATTICE_VERSION_V1,
    phraseNodes: phraseNodes.length,
    phraseTypes,
    candidateEdges: edges.filter((e) => e.status === 'candidate').length,
    headEdges: edges.filter((e) => e.relation === 'head_of').length,
    memberEdges: edges.filter((e) => e.relation === 'member_of').length,
    phraseRelations: edges.filter((e) => e.sourceId.startsWith('phrasecand:') && e.targetId.startsWith('phrasecand:') && e.relation !== 'head_of' && e.relation !== 'member_of').length,
    alternativeSets: (patch.alternativeSets ?? []).length,
    singletonAlternativeSets: (patch.alternativeSets ?? []).filter((a) => a.memberIds.length === 1).length,
    resolvedFacts: allFacts.filter((f) => f.status === 'resolved').length,
    rejectedFacts: allFacts.filter((f) => f.status === 'rejected').length,
  };
}

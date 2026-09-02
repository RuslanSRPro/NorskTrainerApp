import type { CanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
  GraphStatus,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';
import { applyGraphPatchV1 } from './canonical-language-graph-core-v1.ts';
import type { SqlStructuralCompatibilityMapV1 } from './sql-structural-compatibility-map-v1.ts';
import {
  canonicalTokenIdForSqlStructuralIndexV1,
  canonicalTokenIdsForSqlStructuralRangeV1,
} from './sql-structural-compatibility-map-v1.ts';

type J = Record<string, any>;

export type LegacyGraphAdapterDiagnosticV11 = {
  producer: string;
  code: string;
  rawId?: string;
  details?: Record<string, unknown>;
};

export type LegacyGraphProjectionV11 = {
  graph: CanonicalLanguageGraphV1;
  diagnostics: LegacyGraphAdapterDiagnosticV11[];
};

type AdapterContextV11 = {
  surface: CanonicalSurfaceDocumentV1;
  sentenceIndex: number;
  sqlMap: SqlStructuralCompatibilityMapV1;
  diagnostics: LegacyGraphAdapterDiagnosticV11[];
};

function arr(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function str(value: any): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function graphStatus(value: unknown, fallback: GraphStatus = 'candidate'): GraphStatus {
  const v = String(value ?? '').toLowerCase();
  if ([
    'resolved', 'valid', 'recognized', 'resolved_single', 'resolved_by_evidence',
    'resolved_by_structure', 'unchanged_resolved', 'preferred', 'only_candidate',
  ].includes(v)) return 'resolved';
  if (['rejected', 'pruned', 'invalid', 'suppressed'].includes(v)) return 'rejected';
  if (['blocked', 'deferred', 'upstream_blocked'].includes(v)) return 'blocked';
  if (['ambiguous', 'unresolved', 'tied', 'weak_preference'].includes(v)) return 'ambiguous';
  if (['hypothesis', 'candidate'].includes(v)) return 'candidate';
  return fallback;
}

function tokenId(ctx: AdapterContextV11, legacyIndex: unknown): string | undefined {
  return canonicalTokenIdForSqlStructuralIndexV1(ctx.sqlMap, legacyIndex);
}

function predicateNodeId(ctx: AdapterContextV11, rawId: unknown): string | undefined {
  const id = str(rawId);
  return id ? `predicate:${ctx.sentenceIndex}:${id}` : undefined;
}

function clauseNodeId(ctx: AdapterContextV11, rawId: unknown): string | undefined {
  const id = str(rawId);
  return id ? `clause:${ctx.sentenceIndex}:${id}` : undefined;
}

function clauseNodeIdForFiniteToken(
  ctx: AdapterContextV11,
  legacy: J,
  legacyIndex: unknown,
): string | undefined {
  const index = Number(legacyIndex);
  if (!Number.isInteger(index)) return undefined;

  const clause = arr(legacy?.language_graph?.clause_build_v1?.clauses)
    .find((item: J) => Number(item?.finite_token_index) === index);

  return clause ? clauseNodeId(ctx, clause.id) : undefined;
}
function pushDiagnostic(
  ctx: AdapterContextV11,
  producer: string,
  code: string,
  raw: J = {},
  details?: Record<string, unknown>,
) {
  ctx.diagnostics.push({ producer, code, rawId: str(raw.id), details });
}

function baseProvenanceId(producer: string, sentenceIndex: number) {
  return `prov:${producer}:runtime:s${sentenceIndex}`;
}

function provenanceFor(
  producer: string,
  raw: J,
  sentenceIndex: number,
): LanguageGraphProvenanceV1[] {
  const out: LanguageGraphProvenanceV1[] = [{
    id: baseProvenanceId(producer, sentenceIndex),
    sourceType: 'runtime_fact',
    sourceId: producer,
    payload: { legacyProjection: true, adapterVersion: '1.1', sentenceIndex },
  }];

  for (const item of arr(raw.provenance)) {
    const sourceId = str(item?.candidate_id) ?? str(item?.candidate_code) ?? str(item?.source_id);
    if (!sourceId) continue;
    out.push({
      id: `prov:${producer}:source:${sourceId}`,
      sourceType: 'source_rule',
      sourceId,
      payload: typeof item === 'object' ? item : { value: item },
    });
  }
  return out;
}

function provenanceIdsFor(producer: string, raw: J, sentenceIndex: number): string[] {
  return provenanceFor(producer, raw, sentenceIndex).map((p) => p.id);
}

function evidence(
  producer: string,
  id: string,
  targetIds: string[],
  raw: J,
  sentenceIndex: number,
  status: 'supports' | 'opposes' | 'neutral' = 'supports',
): LanguageGraphEvidenceV1 {
  return {
    id: `evidence:${producer}:${id}`,
    kind: producer.includes('morph') ? 'morphological' : producer.includes('pos') ? 'lexical' : 'structural',
    status,
    targetIds,
    payload: { legacyFact: raw },
    producer,
    provenanceIds: provenanceIdsFor(producer, raw, sentenceIndex),
  };
}

function appendProvenance(
  target: LanguageGraphProvenanceV1[],
  producer: string,
  raw: J,
  sentenceIndex: number,
) {
  target.push(...provenanceFor(producer, raw, sentenceIndex));
}

function safeSpanFromSqlRange(
  ctx: AdapterContextV11,
  producer: string,
  raw: J,
  start: unknown,
  end: unknown,
) {
  const ids = canonicalTokenIdsForSqlStructuralRangeV1(ctx.sqlMap, start, end);
  if (!ids.length) {
    pushDiagnostic(ctx, producer, 'unmapped_legacy_span', raw, { start, end });
    return undefined;
  }

  const first = ctx.surface.tokens.find((t) => t.id === ids[0]);
  const last = ctx.surface.tokens.find((t) => t.id === ids[ids.length - 1]);
  if (!first || !last) {
    pushDiagnostic(ctx, producer, 'missing_canonical_span_endpoint', raw, { start, end });
    return undefined;
  }

  const excludedBetween = ctx.surface.tokens.filter(
    (t) =>
      t.sentenceIndex === ctx.sentenceIndex &&
      t.documentTokenIndex >= first.documentTokenIndex &&
      t.documentTokenIndex <= last.documentTokenIndex &&
      t.kind !== 'word' &&
      t.kind !== 'number',
  );

  if (excludedBetween.length) {
    pushDiagnostic(ctx, producer, 'span_crosses_excluded_surface_token', raw, {
      start,
      end,
      excludedCanonicalTokenIds: excludedBetween.map((t) => t.id),
    });
    return undefined;
  }

  return {
    startTokenId: ids[0],
    endTokenId: ids[ids.length - 1],
    tokenIds: ids,
    startUtf16: first.startUtf16,
    endUtf16: last.endUtf16,
  };
}

export function morphologyPatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_morphology_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];

  for (const item of arr(legacy?.language_graph?.morphology_v1)) {
    const tid = tokenId(ctx, item.token_index);
    if (!tid) {
      pushDiagnostic(ctx, producer, 'unmapped_token_index', item, { token_index: item.token_index });
      continue;
    }

    const selectedKey = str(item.selected_reading_key);
    const surviving = arr(item.surviving_readings);
    const rejected = arr(item.rejected_readings);

    if (!surviving.length && !rejected.length) {
      pushDiagnostic(ctx, producer, 'no_materializable_morph_reading', item, { status: item.status });
      continue;
    }

    surviving.forEach((reading: J, index: number) => {
      const readingKey = str(reading.reading_key) ?? str(reading.reading_id) ?? `${str(reading.lemma) ?? 'unknown'}:${index}`;
      const id = `morph:${tid}:${readingKey}`;
      const eid = `${id}:legacy`;
      const isSelected = selectedKey !== undefined && selectedKey === str(reading.reading_key);
      const status: GraphStatus =
        isSelected ||
        (surviving.length === 1 && ['resolved_single', 'resolved_by_evidence'].includes(String(item.status ?? '')))
          ? 'resolved'
          : 'candidate';
      const raw = { tokenResolution: item, reading };

      nodes.push({
        id,
        type: 'morph_reading',
        subtype: str(reading.source_pos),
        status,
        span: { startTokenId: tid, endTokenId: tid, tokenIds: [tid] },
        features: {
          ...reading,
          token_index: item.token_index,
          surface: item.surface,
          resolution_status: item.status,
          resolution_confidence: item.confidence ?? null,
        },
        producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, raw, ctx.sentenceIndex),
      });
      ev.push(evidence(producer, eid, [id, tid], raw, ctx.sentenceIndex));
      appendProvenance(prov, producer, raw, ctx.sentenceIndex);
    });

    rejected.forEach((reading: J, index: number) => {
      const readingKey = str(reading.reading_key) ?? str(reading.reading_id) ?? `${str(reading.lemma) ?? 'unknown'}:rejected:${index}`;
      const id = `morph:${tid}:${readingKey}`;
      const eid = `${id}:legacy`;
      const raw = { tokenResolution: item, reading };

      nodes.push({
        id,
        type: 'morph_reading',
        subtype: str(reading.source_pos),
        status: 'rejected',
        span: { startTokenId: tid, endTokenId: tid, tokenIds: [tid] },
        features: {
          ...reading,
          token_index: item.token_index,
          surface: item.surface,
          resolution_status: item.status,
        },
        producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, raw, ctx.sentenceIndex),
      });
      ev.push(evidence(producer, eid, [id, tid], raw, ctx.sentenceIndex, 'opposes'));
      appendProvenance(prov, producer, raw, ctx.sentenceIndex);
    });
  }

  return { producer, producerVersion: '1.1', nodes, evidence: ev, provenance: prov };
}

export function posPatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_pos_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];
  const alternativeSets: LanguageGraphAlternativeSetV1[] = [];

  const structural = legacy?.language_graph?.structural_pos_v1;
  const structuralResolutions = arr(structural?.token_resolutions);
  const local = arr(legacy?.language_graph?.local_pos_v1);
  const layer = structuralResolutions.length
    ? structuralResolutions.map((envelope: J) => ({
        ...(envelope.refined_local_pos ?? {}),
        _structural_refinement: envelope,
      }))
    : local;

  for (const item of layer) {
    const tid = tokenId(ctx, item.token_index);
    if (!tid) {
      pushDiagnostic(ctx, producer, 'unmapped_token_index', item, { token_index: item.token_index });
      continue;
    }

    const selected = str(item.selected_grammar_pos);
    const competing = [...new Set(arr(item.competing_pos).map(String))];
    const sourceSet = [...new Set(arr(item.source_pos_set).map(String))];
    const candidates = selected ? [selected] : competing.length ? competing : sourceSet;

    if (!candidates.length) {
      pushDiagnostic(ctx, producer, 'no_materializable_pos_candidate', item, { status: item.status });
      continue;
    }

    const memberIds: string[] = [];
    for (const pos of candidates) {
      const normalizedPos = String(pos).toLowerCase();
      const id = `lexread:${tid}:pos:${normalizedPos}`;
      const eid = `${id}:legacy`;
      const status: GraphStatus =
        selected && normalizedPos === selected.toLowerCase() ? 'resolved' : 'candidate';

      nodes.push({
        id,
        type: 'lexical_reading',
        subtype: 'pos',
        status,
        span: { startTokenId: tid, endTokenId: tid, tokenIds: [tid] },
        features: {
          pos: normalizedPos,
          token_index: item.token_index,
          surface: item.surface,
          resolution_status: item.status,
          reason_code: item.reason_code ?? null,
          confidence: item.confidence ?? null,
          evidence: item.evidence ?? [],
          hard_pos_set: item.hard_pos_set ?? [],
          excluded_pos_set: item.excluded_pos_set ?? [],
          structural_refinement_status: item._structural_refinement?.refinement_status ?? null,
          structural_hard_evidence: item._structural_refinement?.structural_hard_evidence ?? [],
          structural_soft_evidence: item._structural_refinement?.structural_soft_evidence ?? [],
        },
        producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, item, ctx.sentenceIndex),
      });
      ev.push(evidence(producer, eid, [id, tid], item, ctx.sentenceIndex));
      appendProvenance(prov, producer, item, ctx.sentenceIndex);
      memberIds.push(id);
    }

    if (!selected && memberIds.length > 1) {
      alternativeSets.push({
        id: `alternatives:pos:${tid}`,
        memberIds,
        resolvedMemberIds: [],
        status: 'open',
        reason: str(item.reason_code) ?? 'multiple_pos_candidates',
      });
    }
  }

  return {
    producer,
    producerVersion: '1.1',
    nodes,
    evidence: ev,
    provenance: prov,
    alternativeSets,
  };
}

export function phrasePatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_phrase_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];
  const layer = legacy?.language_graph?.phrase_build_v1 ?? {};
  const items = [...arr(layer.resolved_phrases), ...arr(layer.phrase_hypotheses)];

  for (const p of items) {
    const start = p.span_start ?? p.start_token_index ?? p.head_token_index;
    const end = p.span_end ?? p.end_token_index ?? p.head_token_index;
    const span = safeSpanFromSqlRange(ctx, producer, p, start, end);
    if (!span) continue;

    const id = `phrase:${ctx.sentenceIndex}:${str(p.id) ?? `${start}:${end}`}`;
    const eid = `${id}:legacy`;
    const status = graphStatus(p.status, 'candidate');

    nodes.push({
      id, type: 'phrase', subtype: str(p.type ?? p.phrase_type), status, span,
      features: { ...p }, producer,
      evidenceIds: [`evidence:${producer}:${eid}`],
      provenanceIds: provenanceIdsFor(producer, p, ctx.sentenceIndex),
    });
    ev.push(evidence(producer, eid, [id], p, ctx.sentenceIndex));
    appendProvenance(prov, producer, p, ctx.sentenceIndex);

    const head = tokenId(ctx, p.head_token_index ?? p.head_index);
    if (head) {
      edges.push({
        id: `edge:head_of:${head}:${id}`, relation: 'head_of',
        sourceId: head, targetId: id, status, features: {}, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, p, ctx.sentenceIndex),
      });
    }

    for (const memberIndex of arr(p.member_token_indices)) {
      const member = tokenId(ctx, memberIndex);
      if (!member || member === head) continue;
      edges.push({
        id: `edge:member_of:${member}:${id}`, relation: 'member_of',
        sourceId: member, targetId: id, status, features: {}, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, p, ctx.sentenceIndex),
      });
    }
  }

  return { producer, producerVersion: '1.1', nodes, edges, evidence: ev, provenance: prov };
}

export function mwePatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_mwe_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];

  const layer = legacy?.language_graph?.multiword_function_expression_v1 ?? {};
  const items = [
    ...arr(layer.resolved_expressions),
    ...arr(layer.candidate_expressions),
    ...arr(layer.blocked_or_deferred),
  ];

  for (const x of items) {
    const start = x.start_token_index ?? x.span_start;
    const end = x.end_token_index ?? x.span_end;
    const span = safeSpanFromSqlRange(ctx, producer, x, start, end);
    if (!span) continue;

    const id = `mwe:${ctx.sentenceIndex}:${str(x.id ?? x.mwe_code) ?? `${start}:${end}`}`;
    const eid = `${id}:legacy`;
    const status = graphStatus(x.status, 'candidate');

    nodes.push({
      id, type: 'mwe', subtype: str(x.mwe_family ?? x.mwe_code), status, span,
      features: { ...x }, producer,
      evidenceIds: [`evidence:${producer}:${eid}`],
      provenanceIds: provenanceIdsFor(producer, x, ctx.sentenceIndex),
    });
    ev.push(evidence(producer, eid, [id], x, ctx.sentenceIndex));
    appendProvenance(prov, producer, x, ctx.sentenceIndex);

    for (const member of span.tokenIds ?? []) {
      edges.push({
        id: `edge:mwe_member:${member}:${id}`, relation: 'mwe_member',
        sourceId: member, targetId: id, status, features: {}, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, x, ctx.sentenceIndex),
      });
    }
  }

  return { producer, producerVersion: '1.1', nodes, edges, evidence: ev, provenance: prov };
}

export function predicatePatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_predicate_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];

  const layer = legacy?.language_graph?.predicate_build_v1 ?? {};
  const items = [...arr(layer.predicates), ...arr(layer.predicate_hypotheses), ...arr(layer.blocked_predicates)];

  for (const p of items) {
    const start = p.span_start ?? p.finite_token_index ?? p.lexical_head_token_index ?? p.grammatical_head_token_index;
    const end = p.span_end ?? p.finite_token_index ?? p.lexical_head_token_index ?? p.grammatical_head_token_index;
    const span = safeSpanFromSqlRange(ctx, producer, p, start, end);
    if (!span) continue;

    const rawId = str(p.id) ?? `${start}:${end}`;
    const id = `predicate:${ctx.sentenceIndex}:${rawId}`;
    const eid = `${id}:legacy`;
    const status = graphStatus(p.status, 'candidate');

    nodes.push({
      id, type: 'predicate', subtype: str(p.predicate_kind), status, span,
      features: { ...p }, producer,
      evidenceIds: [`evidence:${producer}:${eid}`],
      provenanceIds: provenanceIdsFor(producer, p, ctx.sentenceIndex),
    });
    ev.push(evidence(producer, eid, [id], p, ctx.sentenceIndex));
    appendProvenance(prov, producer, p, ctx.sentenceIndex);

    const head = tokenId(ctx, p.lexical_head_token_index ?? p.grammatical_head_token_index ?? p.finite_token_index);
    if (head) {
      edges.push({
        id: `edge:head_of:${head}:${id}`, relation: 'head_of',
        sourceId: head, targetId: id, status,
        features: { headKind: 'predicate' }, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, p, ctx.sentenceIndex),
      });
    }
  }

  return { producer, producerVersion: '1.1', nodes, edges, evidence: ev, provenance: prov };
}

export function clausePatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_clause_adapter_v1';
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];

  const layer = legacy?.language_graph?.clause_build_v1 ?? {};
  const items = [...arr(layer.clauses), ...arr(layer.clause_hypotheses), ...arr(layer.blocked_clauses)];

  for (const c of items) {
    const start = c.span_start ?? c.start_token_index ?? c.subject_token_index ?? c.finite_token_index;
    const end = c.span_end ?? c.end_token_index ?? c.finite_token_index;
    const span = safeSpanFromSqlRange(ctx, producer, c, start, end);
    if (!span) continue;

    const rawId = str(c.id) ?? `${start}:${end}`;
    const id = `clause:${ctx.sentenceIndex}:${rawId}`;
    const eid = `${id}:legacy`;
    const status = graphStatus(c.status, 'candidate');

    nodes.push({
      id, type: 'clause', subtype: str(c.clause_type ?? c.schema ?? c.schema_hint), status, span,
      features: { ...c }, producer,
      evidenceIds: [`evidence:${producer}:${eid}`],
      provenanceIds: provenanceIdsFor(producer, c, ctx.sentenceIndex),
    });
    ev.push(evidence(producer, eid, [id], c, ctx.sentenceIndex));
    appendProvenance(prov, producer, c, ctx.sentenceIndex);

    const subject = tokenId(ctx, c.subject_token_index);
    if (subject) {
      edges.push({
        id: `edge:subject_of:${subject}:${id}`, relation: 'subject_of',
        sourceId: subject, targetId: id, status, features: {}, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, c, ctx.sentenceIndex),
      });
    }

    const predicate = predicateNodeId(ctx, c.predicate_id);
    if (predicate) {
      edges.push({
        id: `edge:predicate_of_clause:${predicate}:${id}`, relation: 'predicate_of_clause',
        sourceId: predicate, targetId: id, status, features: {}, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, c, ctx.sentenceIndex),
      });
    }
  }

  return { producer, producerVersion: '1.1', nodes, edges, evidence: ev, provenance: prov };
}

export function attachmentPatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_attachment_adapter_v1';
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];
  const layer = legacy?.language_graph?.clause_attachment_function_v1 ?? {};

  const groups: Array<[any[], GraphStatus]> = [
    [arr(layer.resolved_attachments), 'resolved'],
    [arr(layer.candidate_attachments), 'candidate'],
    [arr(layer.pruned_candidates), 'rejected'],
    [arr(layer.blocked_or_ambiguous), 'blocked'],
  ];

  for (const [items, fallback] of groups) {
    for (const x of items) {
      const source =
        predicateNodeId(ctx, x.matrix_predicate_id) ??
        tokenId(ctx, x.matrix_predicate_token_index ?? x.source_token_index);
      const embeddedHeadIndex =
        x.embedded_head_token_index ?? x.target_token_index;
      const target =
        clauseNodeIdForFiniteToken(ctx, legacy, embeddedHeadIndex) ??
        tokenId(ctx, embeddedHeadIndex);

      if (!source || !target) {
        pushDiagnostic(ctx, producer, 'unmaterializable_attachment_endpoints', x, {
          matrix_predicate_id: x.matrix_predicate_id ?? null,
          matrix_predicate_token_index: x.matrix_predicate_token_index ?? null,
          embedded_head_token_index: x.embedded_head_token_index ?? null,
          status: x.status ?? fallback,
        });
        continue;
      }

      const relation = str(x.relation) ?? 'attachment';
      const rawId = str(x.id) ?? `${x.matrix_predicate_token_index ?? 'p'}:${x.embedded_head_token_index ?? 'e'}:${relation}`;
      const id = `edge:${relation}:s${ctx.sentenceIndex}:${rawId}`;
      const eid = `${id}:legacy`;
      const status = graphStatus(x.status, fallback);

      edges.push({
        id, relation, sourceId: source, targetId: target, status,
        features: { ...x }, producer,
        evidenceIds: [`evidence:${producer}:${eid}`],
        provenanceIds: provenanceIdsFor(producer, x, ctx.sentenceIndex),
      });
      ev.push(evidence(
        producer, eid, [id, source, target], x, ctx.sentenceIndex,
        status === 'rejected' ? 'opposes' : 'supports',
      ));
      appendProvenance(prov, producer, x, ctx.sentenceIndex);
    }
  }

  return { producer, producerVersion: '1.1', edges, evidence: ev, provenance: prov };
}

function dependencyEndpoint(
  ctx: AdapterContextV11,
  item: J,
  side: 'source' | 'target',
): string | undefined {
  const entity = str(item[`${side}_entity`])?.toLowerCase();
  if (entity === 'token') return tokenId(ctx, item[`${side}_token_index`]);
  if (entity === 'predicate') return predicateNodeId(ctx, item[`${side}_id`]);
  if (entity === 'clause') return clauseNodeId(ctx, item[`${side}_id`]);
  return undefined;
}

export function dependencyPatchFromLegacyV11(legacy: J, ctx: AdapterContextV11): GraphPatchV1 {
  const producer = 'legacy_dependency_adapter_v1';
  const edges: LanguageGraphEdgeV1[] = [];
  const ev: LanguageGraphEvidenceV1[] = [];
  const prov: LanguageGraphProvenanceV1[] = [];
  const layer = legacy?.language_graph?.dependency_build_v2 ?? {};

  for (const x of arr(layer.dependencies)) {
    const relation = str(x.relation) ?? 'dependency';

    // Clause adapter already owns the canonical predicate -> clause bridge.
    // A second edge here would duplicate the same logical fact.
    if (relation === 'predicate_of_clause') {
      pushDiagnostic(
        ctx,
        producer,
        'dependency_relation_owned_by_clause_adapter',
        x,
        { relation },
      );
      continue;
    }
    const source = dependencyEndpoint(ctx, x, 'source');
    const target = dependencyEndpoint(ctx, x, 'target');

    if (!source || !target) {
      pushDiagnostic(ctx, producer, 'unmaterializable_dependency_endpoints', x, {
        source_entity: x.source_entity ?? null,
        target_entity: x.target_entity ?? null,
        source_token_index: x.source_token_index ?? null,
        target_token_index: x.target_token_index ?? null,
        source_id: x.source_id ?? null,
        target_id: x.target_id ?? null,
      });
      continue;
    }


    const rawId = str(x.id) ?? `${relation}:${source}:${target}`;
    const id = `edge:${relation}:s${ctx.sentenceIndex}:${rawId}`;
    const eid = `${id}:legacy`;
    const status = graphStatus(x.status, 'candidate');

    edges.push({
      id, relation, sourceId: source, targetId: target, status,
      features: { ...x }, producer,
      evidenceIds: [`evidence:${producer}:${eid}`],
      provenanceIds: provenanceIdsFor(producer, x, ctx.sentenceIndex),
    });
    ev.push(evidence(
      producer, eid, [id, source, target], x, ctx.sentenceIndex,
      status === 'rejected' ? 'opposes' : 'supports',
    ));
    appendProvenance(prov, producer, x, ctx.sentenceIndex);
  }

  const hypothesisCount = arr(layer.dependency_hypotheses).length;
  const blockedCount = arr(layer.blocked_dependencies).length;
  if (hypothesisCount) {
    pushDiagnostic(ctx, producer, 'dependency_hypotheses_not_edges', {}, {
      count: hypothesisCount,
      policy: 'preserved outside edge projection until dependency-set graph representation exists',
    });
  }
  if (blockedCount) {
    pushDiagnostic(ctx, producer, 'blocked_dependencies_not_edges', {}, {
      count: blockedCount,
      policy: 'preserved outside edge projection until blocked dependency-set graph representation exists',
    });
  }

  return { producer, producerVersion: '1.1', edges, evidence: ev, provenance: prov };
}

export function projectLegacyAnalysisIntoCanonicalGraphV11(
  graph: CanonicalLanguageGraphV1,
  legacyAnalysis: J,
  surface: CanonicalSurfaceDocumentV1,
  sentenceIndex: number,
  sqlMap: SqlStructuralCompatibilityMapV1,
): LegacyGraphProjectionV11 {
  const diagnostics: LegacyGraphAdapterDiagnosticV11[] = [];
  const ctx: AdapterContextV11 = { surface, sentenceIndex, sqlMap, diagnostics };

  const patches: GraphPatchV1[] = [
    morphologyPatchFromLegacyV11(legacyAnalysis, ctx),
    posPatchFromLegacyV11(legacyAnalysis, ctx),
    phrasePatchFromLegacyV11(legacyAnalysis, ctx),
    mwePatchFromLegacyV11(legacyAnalysis, ctx),
    predicatePatchFromLegacyV11(legacyAnalysis, ctx),
    clausePatchFromLegacyV11(legacyAnalysis, ctx),
    attachmentPatchFromLegacyV11(legacyAnalysis, ctx),
    dependencyPatchFromLegacyV11(legacyAnalysis, ctx),
  ];

  return {
    graph: patches.reduce((current, patch) => applyGraphPatchV1(current, patch), graph),
    diagnostics,
  };
}

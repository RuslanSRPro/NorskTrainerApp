// Norsk Trainer вЂ” Canonical Candidate Lattice V1 (v1.41)
//
// First native parser capability on Canonical Language Graph.
// This module does not tokenize, disambiguate, or apply Norwegian grammar rules.
// It materializes possible lexical identities, POS hypotheses, and token-scoped
// morphology from canonical DB candidate/morph contracts. All facts remain
// candidate/open until a later constraint-propagation capability proves more.

import type { CanonicalSurfaceDocumentV1, SurfaceTokenV1 } from './canonical-surface-boundary-v1.ts';
import type {
  GraphPatchV1,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphEvidenceV1,
  LanguageGraphNodeV1,
  LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';

export const CANONICAL_CANDIDATE_LATTICE_V1_PRODUCER = 'canonical_candidate_lattice_v1';
export const CANONICAL_CANDIDATE_LATTICE_V1_VERSION = '1';

type J = Record<string, unknown>;

export type CanonicalSurfaceCandidateV1 = {
  lexeme_id?: string | null;
  lemma?: string | null;
  source_pos?: string | null;
  form_types?: unknown;
  sources?: unknown;
  evidence?: unknown;
  base_confidence?: string | null;
  base_priority?: number | null;
  identity_basis?: string | null;
  identity_strength?: string | null;
  requires_sense_validation?: boolean | null;
  requires_grammar_pos_evidence?: boolean | null;
  [key: string]: unknown;
};

export type CanonicalSurfaceCandidateBatchRowV1 = {
  normalized_surface: string;
  candidates: CanonicalSurfaceCandidateV1[];
};

export type CanonicalMorphRegistryEntryV1 = {
  pos: string;
  form_key: string;
  form_scope: 'token' | 'construction' | string;
  canonical_features: J;
  provenance_policy?: string | null;
  source_id?: string | null;
  [key: string]: unknown;
};

export type CanonicalCandidateLatticeSummaryV1 = {
  lexicalCandidates: number;
  posCandidates: number;
  morphCandidates: number;
  unknownWordTokens: number;
  lexicalAlternativeSets: number;
  posAlternativeSets: number;
  morphAlternativeSets: number;
  resolvedFacts: number;
};

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return arr(value)
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
}

function normalizePos(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US') || 'unknown';
}

function idPart(value: unknown): string {
  return encodeURIComponent(String(value ?? '').normalize('NFC'));
}

function candidateKey(candidate: CanonicalSurfaceCandidateV1, ordinal: number): string {
  const lexemeId = String(candidate.lexeme_id ?? '').trim();
  if (lexemeId) return `lexeme:${idPart(lexemeId)}`;

  // Defensive fallback only. canonical_surface_candidate_batch_v1 is expected
  // to provide lexeme_id, but graph identity must remain deterministic if an
  // incomplete source candidate is surfaced.
  const lemma = String(candidate.lemma ?? 'unknown').trim();
  const pos = normalizePos(candidate.source_pos);
  const basis = String(candidate.identity_basis ?? 'unknown').trim();
  return `fallback:${idPart(lemma)}:${idPart(pos)}:${idPart(basis)}:${ordinal}`;
}

function tokenSpan(token: SurfaceTokenV1) {
  return {
    startTokenId: token.id,
    endTokenId: token.id,
    tokenIds: [token.id],
    startUtf16: token.startUtf16,
    endUtf16: token.endUtf16,
  };
}

function lexicalSourceNames(candidate: CanonicalSurfaceCandidateV1): string[] {
  const values = strings(candidate.sources);
  return values.length ? [...new Set(values)] : ['canonical_surface_candidate_batch_v1'];
}

function lexicalProvenance(
  candidate: CanonicalSurfaceCandidateV1,
): LanguageGraphProvenanceV1[] {
  return lexicalSourceNames(candidate).map((source) => ({
    id: `prov:${CANONICAL_CANDIDATE_LATTICE_V1_PRODUCER}:lexicon:${idPart(source)}`,
    sourceType: 'lexicon',
    sourceId: source,
    payload: {
      contract: 'canonical_surface_candidate_batch_v1',
    },
  }));
}

function morphProvenance(entry: CanonicalMorphRegistryEntryV1): LanguageGraphProvenanceV1 {
  const sourceId =
    String(entry.source_id ?? '').trim() ||
    `grammar_morph_form_registry_v1:${entry.pos}:${entry.form_key}`;
  return {
    id: `prov:${CANONICAL_CANDIDATE_LATTICE_V1_PRODUCER}:morph:${idPart(entry.pos)}:${idPart(entry.form_key)}`,
    sourceType: 'system',
    sourceId,
    payload: {
      contract: 'grammar_morph_form_registry_v1',
      provenancePolicy: entry.provenance_policy ?? null,
      formScope: entry.form_scope,
    },
  };
}

function evidenceId(kind: string, targetId: string, discriminator: string): string {
  return `evidence:${CANONICAL_CANDIDATE_LATTICE_V1_PRODUCER}:${kind}:${idPart(targetId)}:${idPart(discriminator)}`;
}

function lexicalReadingId(
  token: SurfaceTokenV1,
  candidate: CanonicalSurfaceCandidateV1,
  ordinal: number,
): string {
  return `lexread:${token.id}:${candidateKey(candidate, ordinal)}`;
}

function posReadingId(token: SurfaceTokenV1, pos: string): string {
  return `lexread:${token.id}:pos:${idPart(pos)}`;
}

function morphReadingId(lexicalId: string, formKey: string): string {
  return `morph:${lexicalId}:${idPart(formKey)}`;
}

function registryIndex(entries: readonly CanonicalMorphRegistryEntryV1[]) {
  const index = new Map<string, CanonicalMorphRegistryEntryV1>();
  for (const entry of entries) {
    if (!entry || entry.form_scope !== 'token') continue;
    const pos = normalizePos(entry.pos);
    const formKey = String(entry.form_key ?? '').trim();
    if (!formKey || pos === 'unknown') continue;
    index.set(`${pos}\u0000${formKey}`, entry);
  }
  return index;
}

function batchIndex(rows: readonly CanonicalSurfaceCandidateBatchRowV1[]) {
  const index = new Map<string, CanonicalSurfaceCandidateV1[]>();
  for (const row of rows) {
    const surface = String(row?.normalized_surface ?? '').normalize('NFC');
    if (!surface) continue;
    index.set(surface, Array.isArray(row.candidates) ? row.candidates : []);
  }
  return index;
}

function openAlternativeSet(
  id: string,
  memberIds: string[],
  reason: string,
): LanguageGraphAlternativeSetV1 {
  return {
    id,
    memberIds: [...new Set(memberIds)],
    resolvedMemberIds: [],
    status: 'open',
    reason,
  };
}

export function buildCanonicalCandidateLatticePatchV1(
  surface: CanonicalSurfaceDocumentV1,
  batchRows: readonly CanonicalSurfaceCandidateBatchRowV1[],
  morphRegistry: readonly CanonicalMorphRegistryEntryV1[],
): GraphPatchV1 {
  const producer = CANONICAL_CANDIDATE_LATTICE_V1_PRODUCER;
  const nodes: LanguageGraphNodeV1[] = [];
  const edges: LanguageGraphEdgeV1[] = [];
  const evidence: LanguageGraphEvidenceV1[] = [];
  const provenance: LanguageGraphProvenanceV1[] = [];
  const alternativeSets: LanguageGraphAlternativeSetV1[] = [];

  const bySurface = batchIndex(batchRows);
  const morphByPosForm = registryIndex(morphRegistry);

  for (const token of surface.tokens) {
    // Numeric, punctuation and symbol interpretation belongs to later graph
    // capabilities. v1.41 only builds lexical/POS/morph candidates for words.
    if (token.kind !== 'word') continue;

    const candidates = bySurface.get(token.normalizedSurface) ?? [];

    if (!candidates.length) {
      const eid = evidenceId('lexical_unknown', token.id, token.normalizedSurface);
      evidence.push({
        id: eid,
        kind: 'lexical',
        status: 'neutral',
        targetIds: [token.id],
        payload: {
          observation: 'no_lexical_candidate',
          normalizedSurface: token.normalizedSurface,
          parserUncertainty: true,
          learnerError: false,
          sourceContract: 'canonical_surface_candidate_batch_v1',
        },
        producer,
        provenanceIds: [],
      });
      continue;
    }

    const lexicalIds: string[] = [];
    const posMembers = new Map<string, { id: string; lexicalIds: string[]; provenanceIds: Set<string> }>();

    candidates.forEach((candidate, ordinal) => {
      const lexicalId = lexicalReadingId(token, candidate, ordinal);
      const pos = normalizePos(candidate.source_pos);
      const sourceProvenance = lexicalProvenance(candidate);
      const sourceProvIds = sourceProvenance.map((p) => p.id);
      provenance.push(...sourceProvenance);

      const lexEvidenceId = evidenceId('lexical_identity', lexicalId, 'source_candidate');
      const posEvidenceId = evidenceId('source_pos', lexicalId, pos);

      nodes.push({
        id: lexicalId,
        type: 'lexical_reading',
        subtype: 'lexical_candidate',
        status: 'candidate',
        span: tokenSpan(token),
        features: {
          lexemeId: candidate.lexeme_id ?? null,
          lemma: candidate.lemma ?? null,
          sourcePos: pos,
          identityBasis: candidate.identity_basis ?? null,
          identityStrength: candidate.identity_strength ?? null,
          requiresSenseValidation: candidate.requires_sense_validation === true,
          requiresGrammarPosEvidence: candidate.requires_grammar_pos_evidence === true,
          formTypes: strings(candidate.form_types),
          baseConfidence: candidate.base_confidence ?? null,
          basePriority: candidate.base_priority ?? null,
        },
        producer,
        evidenceIds: [lexEvidenceId, posEvidenceId],
        provenanceIds: sourceProvIds,
      });

      edges.push({
        id: `edge:lexical_reading_of:${idPart(lexicalId)}:${idPart(token.id)}`,
        relation: 'lexical_reading_of',
        sourceId: lexicalId,
        targetId: token.id,
        status: 'candidate',
        features: {},
        producer,
        evidenceIds: [lexEvidenceId],
        provenanceIds: sourceProvIds,
      });

      evidence.push({
        id: lexEvidenceId,
        kind: 'lexical',
        status: 'supports',
        targetIds: [lexicalId, token.id],
        payload: {
          claim: 'possible_lexical_identity',
          candidate,
          sourceContract: 'canonical_surface_candidate_batch_v1',
          notResolved: true,
        },
        producer,
        provenanceIds: sourceProvIds,
      });

      evidence.push({
        id: posEvidenceId,
        kind: 'lexical',
        status: pos === 'unknown' ? 'neutral' : 'supports',
        targetIds: [lexicalId, token.id],
        payload: {
          claim: 'possible_pos',
          pos,
          authority: false,
          sourcePosIsEvidenceNotAuthority: true,
        },
        producer,
        provenanceIds: sourceProvIds,
      });

      lexicalIds.push(lexicalId);

      if (pos !== 'unknown') {
        const posId = posReadingId(token, pos);
        const current = posMembers.get(pos) ?? {
          id: posId,
          lexicalIds: [],
          provenanceIds: new Set<string>(),
        };
        current.lexicalIds.push(lexicalId);
        sourceProvIds.forEach((id) => current.provenanceIds.add(id));
        posMembers.set(pos, current);
      }

      const morphIds: string[] = [];
      for (const formType of strings(candidate.form_types)) {
        const registryEntry = morphByPosForm.get(`${pos}\u0000${formType}`);
        if (!registryEntry) continue;

        const morphId = morphReadingId(lexicalId, formType);
        const morphProv = morphProvenance(registryEntry);
        provenance.push(morphProv);
        const morphEvidenceId = evidenceId('morph', morphId, formType);

        nodes.push({
          id: morphId,
          type: 'morph_reading',
          subtype: pos,
          status: 'candidate',
          span: tokenSpan(token),
          features: {
            lexicalReadingId: lexicalId,
            lexemeId: candidate.lexeme_id ?? null,
            lemma: candidate.lemma ?? null,
            pos,
            formKey: formType,
            canonicalFeatures: registryEntry.canonical_features ?? {},
            formScope: registryEntry.form_scope,
          },
          producer,
          evidenceIds: [morphEvidenceId],
          provenanceIds: [...new Set([...sourceProvIds, morphProv.id])],
        });

        edges.push({
          id: `edge:morph_reading_of:${idPart(morphId)}:${idPart(lexicalId)}`,
          relation: 'morph_reading_of',
          sourceId: morphId,
          targetId: lexicalId,
          status: 'candidate',
          features: { pos, formKey: formType },
          producer,
          evidenceIds: [morphEvidenceId],
          provenanceIds: [...new Set([...sourceProvIds, morphProv.id])],
        });

        evidence.push({
          id: morphEvidenceId,
          kind: 'morphological',
          status: 'supports',
          targetIds: [morphId, lexicalId, token.id],
          payload: {
            claim: 'possible_morphology',
            formKey: formType,
            pos,
            canonicalFeatures: registryEntry.canonical_features ?? {},
            sourceContract: 'grammar_morph_form_registry_v1',
            formScope: 'token',
            notResolved: true,
          },
          producer,
          provenanceIds: [...new Set([...sourceProvIds, morphProv.id])],
        });

        morphIds.push(morphId);
      }

      if (morphIds.length) {
        alternativeSets.push(openAlternativeSet(
          `alt:morph:${lexicalId}`,
          morphIds,
          'awaiting_constraint_propagation',
        ));
      }
    });

    alternativeSets.push(openAlternativeSet(
      `alt:lexical:${token.id}`,
      lexicalIds,
      'single_candidate_not_auto_resolved',
    ));

    const posIds: string[] = [];
    for (const [pos, entry] of [...posMembers.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const posEvidenceIds = entry.lexicalIds.map((lexicalId) =>
        evidenceId('pos_hypothesis', entry.id, lexicalId)
      );
      const provIds = [...entry.provenanceIds];

      nodes.push({
        id: entry.id,
        type: 'lexical_reading',
        subtype: 'pos_candidate',
        status: 'candidate',
        span: tokenSpan(token),
        features: {
          pos,
          contributingLexicalReadingIds: [...new Set(entry.lexicalIds)],
          sourcePosIsEvidenceNotAuthority: true,
        },
        producer,
        evidenceIds: posEvidenceIds,
        provenanceIds: provIds,
      });

      edges.push({
        id: `edge:pos_of:${idPart(entry.id)}:${idPart(token.id)}`,
        relation: 'pos_of',
        sourceId: entry.id,
        targetId: token.id,
        status: 'candidate',
        features: { pos },
        producer,
        evidenceIds: posEvidenceIds,
        provenanceIds: provIds,
      });

      entry.lexicalIds.forEach((lexicalId, index) => {
        const eid = posEvidenceIds[index];
        edges.push({
          id: `edge:lexical_supports_pos:${idPart(lexicalId)}:${idPart(entry.id)}`,
          relation: 'lexical_supports_pos',
          sourceId: lexicalId,
          targetId: entry.id,
          status: 'candidate',
          features: { pos },
          producer,
          evidenceIds: [eid],
          provenanceIds: provIds,
        });
        evidence.push({
          id: eid,
          kind: 'lexical',
          status: 'supports',
          targetIds: [entry.id, lexicalId, token.id],
          payload: {
            claim: 'possible_pos',
            pos,
            basis: 'source_pos',
            authority: false,
          },
          producer,
          provenanceIds: provIds,
        });
      });

      posIds.push(entry.id);
    }

    if (posIds.length) {
      alternativeSets.push(openAlternativeSet(
        `alt:pos:${token.id}`,
        posIds,
        'awaiting_constraint_propagation',
      ));
    }
  }

  return {
    producer,
    producerVersion: CANONICAL_CANDIDATE_LATTICE_V1_VERSION,
    nodes,
    edges,
    evidence,
    provenance,
    alternativeSets,
  };
}

export function summarizeCanonicalCandidateLatticePatchV1(
  patch: GraphPatchV1,
): CanonicalCandidateLatticeSummaryV1 {
  const nodes = patch.nodes ?? [];
  const sets = patch.alternativeSets ?? [];
  return {
    lexicalCandidates: nodes.filter((n) =>
      n.type === 'lexical_reading' && n.subtype === 'lexical_candidate'
    ).length,
    posCandidates: nodes.filter((n) =>
      n.type === 'lexical_reading' && n.subtype === 'pos_candidate'
    ).length,
    morphCandidates: nodes.filter((n) => n.type === 'morph_reading').length,
    unknownWordTokens: (patch.evidence ?? []).filter((e) =>
      e.payload?.observation === 'no_lexical_candidate'
    ).length,
    lexicalAlternativeSets: sets.filter((s) => s.id.startsWith('alt:lexical:')).length,
    posAlternativeSets: sets.filter((s) => s.id.startsWith('alt:pos:')).length,
    morphAlternativeSets: sets.filter((s) => s.id.startsWith('alt:morph:')).length,
    resolvedFacts:
      nodes.filter((n) => n.status === 'resolved').length +
      (patch.edges ?? []).filter((e) => e.status === 'resolved').length,
  };
}

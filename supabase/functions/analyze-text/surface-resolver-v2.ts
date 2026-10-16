// ============================================================================
// Surface-form resolution on resolve_surface_form_v2 (V2 forms).
//
// resolve_surface_form_v2 returns EVERY candidate for a word form (one row per
// lexeme + POS) and does not choose between them. The previous resolver
// (resolve_surface_form, legacy form tables) chose one POS from the sentence
// context. That choice is reproduced here unchanged, so that analysis keeps
// creating one item per word in running text:
//   - one candidate POS           -> that candidate
//   - several, no neighbours      -> all candidates (word list / single word)
//   - several, with neighbours    -> rules in the legacy order:
//       å + verb, modal + verb, subject pronoun + verb, copula + adjective,
//       adjective before a noun, adverb after a verb, adverb before an
//       adjective, then fallback verb > noun > adjective > adverb.
// Only the four legacy POS groups take part in the context choice, one lexeme
// per POS (the first in resolver order), exactly as the legacy resolver did.
// When none of the four is present, one exact lexeme is returned (known POS
// first), as the legacy exact-lexeme fallback did.
//
// GRAMMAR GRAPH (future):
//   1. Known words: candidates keep coming from resolve_surface_form_v2.
//   2. selectByContext() is replaced by grammar-graph scoring; the graph fills
//      merge_surface_candidates.score / trace and this module only reads them.
//   3. Unknown words (no candidates) are analysed by grammar-graph morphology
//      rules. Insertion point: grammar-parser.ts planItems(), branch
//      `resolutions.length === 0` (marked "GRAMMAR GRAPH HOOK").
// ============================================================================

import type { SurfaceFormContext, SurfaceResolution } from './grammar-parser.ts';

export type SurfaceCandidateV2 = {
  lexeme_id: string | null;
  lemma: string;
  pos: string | null;
  form_types: unknown;
  sources: unknown;
  evidence: unknown;
  base_confidence: string | null;
  base_priority: number | null;
  score?: number | null;
  trace?: unknown;
  is_ambiguous?: boolean | null;
  candidate_count?: number | null;
  resolution_status?: string | null;
  resolution_context?: unknown;
};

export type NeighbourPos = {
  prev: Set<string> | null;
  next: Set<string> | null;
};

const CORE_POS = ['verb', 'noun', 'adjective', 'adverb'] as const;
type CorePos = (typeof CORE_POS)[number];

const MODAL_VERBS = new Set(['må', 'skal', 'vil', 'kan', 'bør', 'burde', 'måtte', 'skulle', 'ville', 'kunne']);
const SUBJECT_PRONOUNS = new Set(['jeg', 'du', 'han', 'hun', 'den', 'det', 'vi', 'dere', 'de']);
const COPULA_VERBS = new Set(['er', 'var', 'blir', 'ble', 'blitt', 'synes', 'syntes', 'virker', 'virket', 'føles', 'føltes']);

// Same normalisation as public.normalize_surface_form.
export function normalizeSurface(value: string | null | undefined): string | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"“”'«»()[\]{}]/g, '')
    .replace(/\s+/g, ' ');
  return text ? text : null;
}

function firstEvidence(row: SurfaceCandidateV2): Record<string, any> | null {
  return Array.isArray(row.evidence) && row.evidence.length > 0
    ? (row.evidence[0] as Record<string, any>)
    : null;
}

export function toSurfaceResolution(
  row: SurfaceCandidateV2,
  extra?: { confidence?: string; features?: Record<string, unknown> },
): SurfaceResolution {
  const evidence = firstEvidence(row);
  const formTypes = Array.isArray(row.form_types) ? row.form_types : [];
  const sources = Array.isArray(row.sources) ? row.sources : [];
  return {
    lexeme_id: row.lexeme_id,
    lemma: row.lemma,
    pos: String(row.pos ?? 'unknown'),
    form_type: String(evidence?.form_type ?? formTypes[0] ?? 'base'),
    grammatical_features: {
      ...((evidence?.grammatical_features as Record<string, unknown>) ?? {}),
      resolver: 'resolve_surface_form_v2',
      v2_form_types: formTypes,
      v2_sources: sources,
      v2_candidate_count: row.candidate_count ?? null,
      v2_resolution_status: row.resolution_status ?? null,
      ...(extra?.features ?? {}),
    },
    confidence: extra?.confidence ?? String(row.base_confidence ?? 'low'),
    source: String(evidence?.source ?? sources[0] ?? 'resolve_surface_form_v2'),
  };
}

function candidatePosSet(rows: SurfaceCandidateV2[] | null | undefined): Set<string> {
  return new Set((rows ?? []).map((row) => String(row.pos ?? '').toLowerCase()).filter(Boolean));
}

export function neighbourPos(
  prevRows: SurfaceCandidateV2[] | null,
  nextRows: SurfaceCandidateV2[] | null,
): NeighbourPos {
  return {
    prev: prevRows ? candidatePosSet(prevRows) : null,
    next: nextRows ? candidatePosSet(nextRows) : null,
  };
}

// Pure: picks the resolutions for one token from its V2 candidates.
export function selectByContext(
  rows: SurfaceCandidateV2[],
  context: SurfaceFormContext,
  neighbours: NeighbourPos,
): SurfaceResolution[] {
  if (rows.length === 0) return [];

  const perPos = new Map<CorePos, SurfaceCandidateV2>();
  for (const row of rows) {
    const pos = String(row.pos ?? '').toLowerCase() as CorePos;
    if ((CORE_POS as readonly string[]).includes(pos) && !perPos.has(pos)) perPos.set(pos, row);
  }

  if (perPos.size === 0) {
    // Legacy exact-lexeme fallback: the word itself as a lexeme (lemma or
    // display form), known POS first. A V2 form of another lexeme (e.g. "det"
    // as a form of the determiner "den") is used only when no exact lexeme
    // exists.
    const isExact = (row: SurfaceCandidateV2) =>
      Array.isArray(row.sources) && row.sources.includes('lexemes');
    const isKnown = (row: SurfaceCandidateV2) => Boolean(row.pos) && row.pos !== 'unknown';
    const chosen = rows.find((row) => isExact(row) && isKnown(row))
      ?? rows.find(isExact)
      ?? rows.find(isKnown)
      ?? rows[0];
    return [toSurfaceResolution(chosen)];
  }

  const count = perPos.size;
  if (count === 1) {
    // Legacy: a single POS candidate always had confidence 'high'.
    return [toSurfaceResolution([...perPos.values()][0], { confidence: 'high' })];
  }

  const ambiguous = (rule: string) => ({ pos_ambiguous: true, disambiguation_rule: rule, candidate_count: count });
  const pick = (pos: CorePos, rule: string, confidence: string) =>
    [toSurfaceResolution(perPos.get(pos)!, { confidence, features: ambiguous(rule) })];

  const prevNorm = normalizeSurface(context.prevToken);
  const nextNorm = normalizeSurface(context.nextToken);

  if (!context.prevToken && !context.nextToken) {
    return CORE_POS.filter((pos) => perPos.has(pos)).map((pos) =>
      toSurfaceResolution(perPos.get(pos)!, {
        confidence: 'medium',
        features: ambiguous('no_context_all_candidates_returned'),
      }));
  }

  if (context.precededByInfinitiveMarker && perPos.has('verb')) return pick('verb', 'preceded_by_infinitive_marker', 'medium');
  if (prevNorm && MODAL_VERBS.has(prevNorm) && perPos.has('verb')) return pick('verb', 'preceded_by_modal_verb', 'medium');
  if (prevNorm && SUBJECT_PRONOUNS.has(prevNorm) && perPos.has('verb')) return pick('verb', 'preceded_by_subject_pronoun', 'medium');
  if (prevNorm && COPULA_VERBS.has(prevNorm) && perPos.has('adjective')) {
    return pick('adjective', 'preceded_by_copula_predicative_adjective', 'medium');
  }
  if (nextNorm && neighbours.next?.has('noun') && perPos.has('adjective')) return pick('adjective', 'followed_by_noun', 'medium');
  if (prevNorm && neighbours.prev?.has('verb') && perPos.has('adverb')) return pick('adverb', 'preceded_by_verb', 'medium');
  if (nextNorm && neighbours.next?.has('adjective') && perPos.has('adverb')) return pick('adverb', 'followed_by_adjective', 'medium');

  for (const pos of CORE_POS) {
    if (perPos.has(pos)) return pick(pos, `no_signal_fallback_to_${pos}`, 'low');
  }
  return [];
}

// Which neighbour candidate lists selectByContext may need. Lets the caller
// skip neighbour lookups for single-candidate words.
export function needsNeighbours(rows: SurfaceCandidateV2[], context: SurfaceFormContext): boolean {
  if (!context.prevToken && !context.nextToken) return false;
  const pos = new Set(rows.map((row) => String(row.pos ?? '').toLowerCase()));
  const core = CORE_POS.filter((value) => pos.has(value));
  return core.length > 1 && (pos.has('adjective') || pos.has('adverb'));
}

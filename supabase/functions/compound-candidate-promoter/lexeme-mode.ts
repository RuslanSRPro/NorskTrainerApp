// D10 15.10.2026 (agreed): promoter mode "only these words", used by the job
// after the forms chain. The old mode (global queue, manual run) is unchanged.
//
// NAOB candidates of the given words:
//   "sammensatt av barn og hage" -> parts by linking elements ('', s, e)
//   "annet ledd hus"             -> first part = lemma minus the head
// Written through d10_write_compound_analysis_v1 (precedence, same rules as
// the coloring trigger; never replaces a manual analysis).

import { naobAnnetLeddParts } from '../_shared/d10-compound-split.ts';

const LINKS = ['', 's', 'e'];

type Relation = {
  id: string; source_entity_type: string; source_entity_id: string;
  target_text: string; source: string | null; confidence: string | null; evidence: unknown;
};

export function splitCandidateTokens(targetText: string): string[] {
  return String(targetText || '')
    .split(/\s*(?:,|\bog\b|\beller\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tryReconstruct(lemma: string, tokens: string[]): { parts: string[]; links: string[] } | null {
  const n = tokens.length;
  if (n < 2 || tokens.some((t) => /\s/.test(t))) return null;
  const gaps = n - 1;
  const total = Math.pow(LINKS.length, gaps);
  const target = lemma.trim().toLowerCase();
  for (let c = 0; c < total; c++) {
    const combo: string[] = [];
    let rem = c;
    for (let g = 0; g < gaps; g++) { combo.push(LINKS[rem % LINKS.length]); rem = Math.floor(rem / LINKS.length); }
    let built = tokens[0];
    for (let i = 0; i < combo.length; i++) built += combo[i] + tokens[i + 1];
    if (built.toLowerCase() === target) return { parts: tokens.map((t) => t.toLowerCase()), links: combo };
  }
  return null;
}

function confidenceToNumber(confidence: string | null): number {
  switch ((confidence || '').toLowerCase()) {
    case 'high': return 0.9;
    case 'low': return 0.5;
    default: return 0.7;
  }
}

export async function promoteForLexemes(supabase: any, lexemeIds: string[]) {
  const ids = [...new Set(lexemeIds.filter((id) => typeof id === 'string'))];
  const summary = { processed: 0, promoted: 0, needs_review: 0, failed: 0, outcomes: [] as Record<string, unknown>[] };
  if (!ids.length) return summary;

  const { data: rels, error } = await supabase.rpc('d10_compound_candidates_for_lexemes_v1', { p_lexeme_ids: ids });
  if (error) throw new Error(`COMPOUND_CANDIDATES_LOAD_FAILED:${error.message}`);
  const relations = (rels ?? []) as Relation[];
  if (!relations.length) return summary;

  const { data: lexemes, error: lexError } = await supabase.from('lexemes').select('id, lemma')
    .in('id', [...new Set(relations.map((r) => r.source_entity_id))]);
  if (lexError) throw new Error(`LEXEME_LOAD_FAILED:${lexError.message}`);
  const lemmaById = new Map<string, string>(((lexemes ?? []) as any[]).map((r) => [r.id, r.lemma]));

  const mark = async (rel: Relation, status: 'promoted' | 'needs_review', note: string | null) => {
    const evidence = {
      ...(rel.evidence && typeof rel.evidence === 'object' ? rel.evidence as Record<string, unknown> : {}),
      compound_promoter_note: note, compound_promoter_status: status,
      compound_promoter_mode: 'lexemes', compound_promoter_at: new Date().toISOString(),
    };
    const { error: updError } = await supabase.from('authoritative_semantic_relations')
      .update({ status, evidence, updated_at: new Date().toISOString() }).eq('id', rel.id);
    if (updError) throw new Error(`RELATION_MARK_FAILED:${updError.message}`);
  };

  for (const rel of relations) {
    summary.processed++;
    try {
      const lemma = lemmaById.get(rel.source_entity_id);
      if (!lemma) { await mark(rel, 'needs_review', 'source lexeme not found'); summary.needs_review++; continue; }
      const annet = naobAnnetLeddParts(lemma, rel.target_text);
      const rec = annet ?? tryReconstruct(lemma, splitCandidateTokens(rel.target_text));
      if (!rec) {
        await mark(rel, 'needs_review', `no split reproduces "${lemma}" from "${rel.target_text}"`);
        summary.needs_review++;
        summary.outcomes.push({ relation_id: rel.id, lemma, action: 'needs_review' });
        continue;
      }
      const { data: written, error: writeError } = await supabase.rpc('d10_write_compound_analysis_v1', {
        p_lexeme_id: rel.source_entity_id, p_parts: rec.parts, p_links: rec.links,
        p_source: annet ? 'naob_annet_ledd' : 'naob_sammensatt',
        p_confidence: confidenceToNumber(rel.confidence),
        p_evidence: { relation_id: rel.id, excerpt: rel.target_text, source: rel.source },
      });
      if (writeError) {
        await mark(rel, 'needs_review', `analysis refused: ${writeError.message}`);
        summary.needs_review++;
        summary.outcomes.push({ relation_id: rel.id, lemma, action: 'needs_review', error: writeError.message });
        continue;
      }
      if (written === 'kept_existing') {
        await mark(rel, 'needs_review', 'another analysis of this word is kept');
        summary.needs_review++;
      } else {
        await mark(rel, 'promoted', null);
        summary.promoted++;
      }
      summary.outcomes.push({ relation_id: rel.id, lemma, action: written, parts: rec.parts, links: rec.links });
    } catch (e) {
      summary.failed++;
      summary.outcomes.push({ relation_id: rel.id, action: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return summary;
}

import { QUALITY_VERSION } from './pos-sense-guard.ts';

const norm = (s: unknown) => String(s ?? '').normalize('NFC').trim().toLowerCase()
  .replace(/[\[\]]/g, '').replace(/\|/g, '/').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
export const EXPRESSION_REVIEW_VERSION = 'd10_expression_review_v2';
export const NO_DEFINITION_STATUS = 'ai_reviewed_no_definition';
export const NO_DEFINITION_CONSTRAINT = 'No dictionary explanation exists for this expression (no_definition). ' +
  'Use only its well-known, standard meaning as a fixed Norwegian expression; if unsure, return empty fields.';

// Only definitions belonging to this catalog entry; never the parent word's preview.
export function expressionContext(row: any): string {
  const raw = row.raw_sources ?? {};
  const evidence = row.verification_evidence ?? {};
  const definitions: string[] = [];
  const sources: Record<string, unknown>[] = [];
  const examples: string[] = [];
  const ob = evidence.Ordbokene;
  const article = String(ob?.article_id ?? ob?.evidence?.article_id ?? '');
  if (raw.source === 'Ordbokene' && raw.source_type === 'sub_article' &&
      ob?.status === 'done' && ob?.whole_unit_match === true && /^\d+$/.test(article) &&
      article === String(raw.article_id) && String(raw.dictionary_code).toLowerCase() === 'bm' &&
      typeof raw.definition_preview === 'string' && raw.definition_preview.trim()) {
    definitions.push(raw.definition_preview.trim());
    sources.push({ provider: 'Ordbokene', dictionary: 'bm', article_id: article });
    examples.push(...(Array.isArray(raw.examples) ? raw.examples : []).filter((x: unknown) => typeof x === 'string' && x.trim()));
  }
  const naob = evidence.NAOB;
  if (raw.source === 'NAOB' && raw.source_type === 'uttrykk' && naob?.status === 'done' &&
      naob?.whole_unit_match === true && Array.isArray(raw.glosses)) {
    for (const g of raw.glosses) {
      if (g?.type !== 'direct' || norm(g.naob_form) !== norm(row.lemma) ||
          typeof g.gloss !== 'string' || !g.gloss.trim() || typeof g.slug !== 'string' || !g.slug.trim()) continue;
      definitions.push((g.context ? `[${g.context}] ` : '') + g.gloss.trim());
      sources.push({ provider: 'NAOB', slug: g.slug, anchor_id: g.anchor_id ?? null, context: g.context ?? null });
    }
  }
  if (!definitions.length) {
    // D10 09.11.2026 (agreed, NAOB 2): a dictionary confirmed this expression
    // as a whole unit, but neither Ordbøkene nor NAOB (also after following
    // "se ...") gives it its own explanation. AI translates the whole
    // expression from general knowledge; the result is marked "≈".
    const confirmed: Record<string, unknown>[] = [];
    if (ob?.status === 'done' && ob?.whole_unit_match === true) {
      confirmed.push({ provider: 'Ordbokene', dictionary: 'bm', article_id: /^\d+$/.test(article) ? article : null });
    }
    if (naob?.status === 'done' && naob?.whole_unit_match === true) {
      confirmed.push({ provider: 'NAOB' });
    }
    if (!confirmed.length) throw new Error('AI_EXPRESSION_OWN_DEFINITION_REQUIRED');
    return JSON.stringify({ basis: 'expression', expression_id: row.id, lemma: row.lemma,
      pos: row.pos ?? 'expression', definitions: [], examples: [], sources: confirmed, no_definition: true,
      translation_constraints: [NO_DEFINITION_CONSTRAINT,
        'Translate the whole expression, not its individual words.',
        'The example and its Ukrainian translation must illustrate the same sense as the equivalent.'] });
  }
  return JSON.stringify({ basis: 'expression', expression_id: row.id, lemma: row.lemma,
    pos: row.pos ?? 'expression', definitions: [...new Set(definitions)], examples,
    sources, translation_constraints: ['Translate the whole expression in its attested sense, not its individual words.',
      'The example and its Ukrainian translation must illustrate the same sense as the equivalent.'] });
}

// Bind approval to the exact owner, context, and text before any existing row is replaced.
export function expressionEvidence(context: string, review: any, id: string,
  content: { language_code: 'uk' | 'en'; translation: string } |
    { example_text: string; translation_uk: string | null }): Record<string, unknown> {
  const source = JSON.parse(context);
  const proposal = review?.approved_proposal;
  if (source.basis !== 'expression' || source.expression_id !== id ||
      review?.status !== 'accepted' || review?.version !== QUALITY_VERSION ||
      JSON.stringify(proposal?.context) !== JSON.stringify(source)) throw new Error('AI_EXPRESSION_REVIEW_REQUIRED');
  if ('translation' in content) {
    const field = content.language_code === 'uk' ? 'translation_ua' : 'translation_en';
    if (!proposal.missing?.includes(field) || !Array.isArray(proposal.answer?.[field]) ||
        !proposal.answer[field].some((value: unknown) => typeof value === 'string' && value.trim() === content.translation.trim())) {
      throw new Error('AI_EXPRESSION_TRANSLATION_NOT_REVIEWED');
    }
  } else if (!proposal.missing?.includes('example') ||
      proposal.answer?.example_nb?.trim() !== content.example_text.trim() ||
      !content.translation_uk?.trim() ||
      proposal.answer?.example_translation_ua?.trim() !== content.translation_uk.trim()) {
    throw new Error('AI_EXPRESSION_EXAMPLE_NOT_REVIEWED');
  }
  return { version: QUALITY_VERSION, expression_review_version: EXPRESSION_REVIEW_VERSION,
    status: source.no_definition === true ? NO_DEFINITION_STATUS : 'ai_reviewed', source_verified: false,
    ...(source.no_definition === true ? { reliability: 'low', review_suggested: true } : {}), source, review,
    expression_binding: { expression_id: id, ...content } };
}

export function currentExpressionEvidence(row: any, id: string, currentContext?: string | null): boolean {
  const e = row?.enrichment_evidence;
  if (e?.expression_review_version !== EXPRESSION_REVIEW_VERSION || e?.expression_binding?.expression_id !== id) return false;
  // D10 09.11.2026: a "≈" result is redone once the expression has its own explanation
  if (e?.source?.no_definition === true && currentContext) {
    try { if (JSON.parse(currentContext)?.no_definition !== true) return false; } catch { /* keep */ }
  }
  try {
    const content = typeof row.translation === 'string'
      ? { language_code: row.language_code, translation: row.translation }
      : { example_text: row.example_text, translation_uk: row.translation_uk };
    if ('translation' in content && !['uk', 'en'].includes(content.language_code)) return false;
    expressionEvidence(JSON.stringify(e.source), e.review, id, content);
    return true;
  } catch { return false; }
}

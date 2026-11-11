export const AI_BINDING_VERSION = 'd10_ai_review_binding_v1';
export const AI_QUALITY_VERSION = 'd10_ai_pos_sense_v3';
// D10 11.11.2026 (agreed): a word's retry is reviewed by OpenAI (gpt-6-luna), the first attempt by Gemini.
export const AI_REVIEW_PROVIDERS: unknown[] = ['gemini', 'openai'];
const nonempty = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const norm = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';

export function createTranslationBinding(context: string, review: any,
  identity: { lexemeId: string; languageCode: 'uk' | 'en'; value: string }) {
  const source = JSON.parse(context);
  const proposal = review?.approved_proposal;
  const field = identity.languageCode === 'uk' ? 'translation_ua' : 'translation_en';
  const values = proposal?.answer?.[field];
  if (source?.basis === NO_ARTICLE_BASIS) return createNoArticleTranslationBinding(source, review, identity);
  if (review?.version !== AI_QUALITY_VERSION || review?.status !== 'accepted' ||
      !AI_REVIEW_PROVIDERS.includes(review?.provider) || !nonempty(review.model) || !nonempty(review.reason) ||
      !nonempty(review.reviewed_at) || !Number.isFinite(Date.parse(review.reviewed_at)) ||
      JSON.stringify(proposal?.context) !== JSON.stringify(source) ||
      !Array.isArray(proposal?.missing) || !proposal.missing.includes(field) ||
      !Array.isArray(values) || values.length !== 1 || !nonempty(values[0]) ||
      values[0].trim() !== identity.value.trim() || !nonempty(identity.lexemeId) ||
      source.dictionary !== 'bm' || !nonempty(source.lemma) || !nonempty(source.pos) ||
      !/^\d+$/.test(String(source.article_id)) || !Array.isArray(source.definitions) ||
      !source.definitions.some(nonempty)) throw new Error('AI_REVIEWED_CONTENT_MISMATCH');
  return { version: AI_BINDING_VERSION, kind: 'translation',
    lexeme_id: identity.lexemeId, language_code: identity.languageCode,
    value: identity.value.trim(), lemma: source.lemma, pos: source.pos,
    dictionary: 'bm', article_id: String(source.article_id) };
}

// No AI calls or database reads. Checks the exact stored proposal against the
// current entity, effective translation and currently active BM article IDs.
export function boundAiReviewReason(entity: {entity_id: string; lemma: string; pos: string | null},
  translation: {locale: string; value: string | null; lexeme_id: string | null;
    expression_id: string | null; provider: string | null; canonical: boolean;
    original_value?: string | null; source_pos?: string | null;
    translation_rank?: number | null; translation_type?: string | null;
    current_article_ids?: string[]; enrichment_evidence?: unknown}): string | null {
  const e: any = translation.enrichment_evidence;
  if (!e?.content_binding) return 'AI_REVIEW_BINDING_MISSING';
  if (e.status === 'ai_reviewed_no_article') return noArticleReviewReason(entity, translation);
  const b = e.content_binding, r = e.review, s = e.source;
  if (e.version !== AI_QUALITY_VERSION || e.status !== 'ai_reviewed' || e.source_verified !== false ||
      b.version !== AI_BINDING_VERSION || b.kind !== 'translation' ||
      r?.version !== AI_QUALITY_VERSION || r?.status !== 'accepted' || !AI_REVIEW_PROVIDERS.includes(r?.provider) ||
      !nonempty(r.model) || !nonempty(r.reason) || !nonempty(r.reviewed_at) || !Number.isFinite(Date.parse(r.reviewed_at)))
    return 'AI_REVIEW_BINDING_INVALID';
  if (translation.provider !== 'ai_fallback' || !translation.canonical ||
      translation.translation_rank !== 1 || translation.translation_type !== 'primary')
    return 'AI_REVIEW_PRIMARY_CANONICAL_REQUIRED';
  if (translation.expression_id !== null || translation.lexeme_id !== entity.entity_id ||
      b.lexeme_id !== entity.entity_id || b.language_code !== translation.locale ||
      !['uk','en'].includes(translation.locale) || norm(b.lemma) !== norm(entity.lemma) ||
      b.pos !== entity.pos || s?.pos !== entity.pos || translation.source_pos !== entity.pos ||
      norm(s.lemma) !== norm(entity.lemma)) return 'AI_REVIEW_IDENTITY_CHANGED';
  if (!nonempty(b.value) || b.value !== translation.value?.trim() ||
      b.value !== translation.original_value?.trim()) return 'AI_REVIEW_TEXT_CHANGED';
  if (b.dictionary !== 'bm' || s?.dictionary !== 'bm' || s?.provider !== 'Ordbokene' ||
      String(s.article_id) !== b.article_id || !/^\d+$/.test(b.article_id) ||
      (!Array.isArray(translation.current_article_ids) || !translation.current_article_ids.includes(b.article_id))) return 'AI_REVIEW_ARTICLE_CHANGED';
  const context = r.approved_proposal?.context;
  const field = translation.locale === 'uk' ? 'translation_ua' : 'translation_en';
  const values = r.approved_proposal?.answer?.[field];
  if (!context || context.dictionary !== 'bm' || String(context.article_id) !== b.article_id ||
      norm(context.lemma) !== norm(entity.lemma) || context.pos !== entity.pos ||
      !Array.isArray(context.definitions) || !context.definitions.some(nonempty) ||
      JSON.stringify(context.definitions) !== JSON.stringify(s.definitions) ||
      JSON.stringify(context.examples) !== JSON.stringify(s.examples) ||
      JSON.stringify(context.translation_constraints ?? []) !== JSON.stringify(s.translation_constraints ?? []) ||
      (!Array.isArray(r.approved_proposal.missing) || !r.approved_proposal.missing.includes(field)) ||
      !Array.isArray(values) || values.length !== 1 || !nonempty(values[0]) || values[0].trim() !== b.value)
    return 'AI_REVIEW_PROPOSAL_MISMATCH';
  return null;
}

// ---------------------------------------------------------------------------
// D10 15.10.2026 (agreed, rule R12): AI translation of a word WITHOUT its own
// Ordbøkene article. Basis: part of speech + NAOB / Lexin / Wiktionary
// excerpts. Low reliability, suggested for review; it counts as ready only
// while the word still has no article. When an article appears later, the
// translation stops counting (AI_NO_ARTICLE_ARTICLE_NOW_EXISTS) and the next
// audit translates the word from its article.
export const NO_ARTICLE_BASIS = 'no_article';
// D10 27.10.2026 (agreed): the card HAS an Ordbøkene article, but it has no
// explanation (bare, 4507: only the sub-article "bare seg"); the translation
// is made like a no-article one (source cascade) and marked with this note
// (same value as ARTICLE_WITHOUT_EXPLANATION in pos-sense-guard.ts).
const ARTICLE_WITHOUT_EXPLANATION_NOTE = 'ordbokene_article_without_explanation';

// The card's current articles are exactly articles recorded as "without an
// explanation" when the translation was made -> the translation still counts.
// A new article (another number) -> it does not (the Audit translates by it).
function onlyArticlesWithoutExplanation(source: any, context: any, current: string[]): boolean {
  if (source?.basis_note !== ARTICLE_WITHOUT_EXPLANATION_NOTE) return false;
  const recorded = source?.article_without_explanation_ids;
  if (!Array.isArray(recorded) || !recorded.length || !recorded.every((id: unknown) => /^\d+$/.test(String(id)))) return false;
  if (context?.basis_note !== ARTICLE_WITHOUT_EXPLANATION_NOTE ||
      JSON.stringify(context?.article_without_explanation_ids ?? null) !== JSON.stringify(recorded)) return false;
  const allowed = new Set(recorded.map(String));
  return current.every((id) => allowed.has(String(id)));
}
export const AI_NO_ARTICLE_BINDING_VERSION = 'd10_ai_review_binding_no_article_v1';

function sameSources(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function validSources(sources: any): boolean {
  return !!sources && typeof sources === 'object' && !Array.isArray(sources) &&
    Object.values(sources).some(nonempty);
}

// Publication proves lemma + POS, not the accuracy of the provisional translation.
export type PublicationProof = { source: string; lemma: string; pos: string; registered_entry: true; pos_match: 'match' };
export const PUBLISHED_WITHOUT_EXPLANATION = 'published_entry_without_explanation';
export function publicationProofs(evidence: any, lemma: string, pos: string | null): PublicationProof[] {
  if (!pos || ['unknown', 'expression', ''].includes(pos)) return [];
  return ['Ordbokene', 'NAOB', 'Lexin', 'Wiktionary'].flatMap(source => {
    const row = evidence?.[source], ev = row?.evidence;
    return row?.status === 'done' && (row.registered_entry === true || ev?.registered_entry === true)
      && ev?.pos_match === 'match' && ev?.requested_pos === pos && norm(ev?.canonical_query) === norm(lemma)
      ? [{ source, lemma, pos, registered_entry: true as const, pos_match: 'match' as const }] : [];
  });
}
function validPublication(source: any): boolean {
  return Array.isArray(source?.publication_evidence) && source.publication_evidence.some((p: any) =>
    ['Ordbokene', 'NAOB', 'Lexin', 'Wiktionary'].includes(p?.source) && p.registered_entry === true &&
    p.pos_match === 'match' && norm(p.lemma) === norm(source.lemma) && p.pos === source.pos);
}
function validFallbackBasis(source: any): boolean {
  if (validSources(source?.sources)) return true;
  if (source?.basis_note === ARTICLE_WITHOUT_EXPLANATION_NOTE) {
    const ids = source.article_without_explanation_ids;
    return Array.isArray(ids) && ids.length > 0 && ids.every((id: unknown) => /^\d+$/.test(String(id)));
  }
  return source?.basis_note === PUBLISHED_WITHOUT_EXPLANATION && validPublication(source);
}

function createNoArticleTranslationBinding(source: any, review: any,
  identity: { lexemeId: string; languageCode: 'uk' | 'en'; value: string }) {
  const proposal = review?.approved_proposal;
  const field = identity.languageCode === 'uk' ? 'translation_ua' : 'translation_en';
  const values = proposal?.answer?.[field];
  if (review?.version !== AI_QUALITY_VERSION || review?.status !== 'accepted' ||
      !AI_REVIEW_PROVIDERS.includes(review?.provider) || !nonempty(review.model) || !nonempty(review.reason) ||
      !nonempty(review.reviewed_at) || !Number.isFinite(Date.parse(review.reviewed_at)) ||
      JSON.stringify(proposal?.context) !== JSON.stringify(source) ||
      !Array.isArray(proposal?.missing) || !proposal.missing.includes(field) ||
      !Array.isArray(values) || values.length !== 1 || !nonempty(values[0]) ||
      values[0].trim() !== identity.value.trim() || !nonempty(identity.lexemeId) ||
      source.basis !== NO_ARTICLE_BASIS || source.article_id !== null ||
      !nonempty(source.lemma) || !nonempty(source.pos))
    throw new Error('AI_REVIEWED_CONTENT_MISMATCH: PROPOSAL_OR_IDENTITY_MISMATCH');
  if (!validFallbackBasis(source)) throw new Error('AI_REVIEWED_FALLBACK_BASIS_MISSING');
  return { version: AI_NO_ARTICLE_BINDING_VERSION, kind: 'translation',
    lexeme_id: identity.lexemeId, language_code: identity.languageCode,
    value: identity.value.trim(), lemma: source.lemma, pos: source.pos,
    dictionary: null, article_id: null, basis: NO_ARTICLE_BASIS };
}

function noArticleReviewReason(entity: {entity_id: string; lemma: string; pos: string | null},
  translation: {locale: string; value: string | null; lexeme_id: string | null;
    expression_id: string | null; provider: string | null; canonical: boolean;
    original_value?: string | null; source_pos?: string | null;
    translation_rank?: number | null; translation_type?: string | null;
    current_article_ids?: string[]; enrichment_evidence?: unknown}): string | null {
  const e: any = translation.enrichment_evidence;
  const b = e.content_binding, r = e.review, s = e.source;
  if (e.version !== AI_QUALITY_VERSION || e.source_verified !== false ||
      b?.version !== AI_NO_ARTICLE_BINDING_VERSION || b.kind !== 'translation' ||
      r?.version !== AI_QUALITY_VERSION || r?.status !== 'accepted' || !AI_REVIEW_PROVIDERS.includes(r?.provider) ||
      !nonempty(r.model) || !nonempty(r.reason) || !nonempty(r.reviewed_at) || !Number.isFinite(Date.parse(r.reviewed_at)))
    return 'AI_REVIEW_BINDING_INVALID';
  if (translation.provider !== 'ai_fallback' || !translation.canonical ||
      translation.translation_rank !== 1 || translation.translation_type !== 'primary')
    return 'AI_REVIEW_PRIMARY_CANONICAL_REQUIRED';
  if (translation.expression_id !== null || translation.lexeme_id !== entity.entity_id ||
      b.lexeme_id !== entity.entity_id || b.language_code !== translation.locale ||
      !['uk','en'].includes(translation.locale) || norm(b.lemma) !== norm(entity.lemma) ||
      b.pos !== entity.pos || s?.pos !== entity.pos || translation.source_pos !== entity.pos ||
      norm(s?.lemma) !== norm(entity.lemma)) return 'AI_REVIEW_IDENTITY_CHANGED';
  if (!nonempty(b.value) || b.value !== translation.value?.trim() ||
      b.value !== translation.original_value?.trim()) return 'AI_REVIEW_TEXT_CHANGED';
  if (b.basis !== NO_ARTICLE_BASIS || b.article_id !== null || s?.basis !== NO_ARTICLE_BASIS ||
      s?.article_id !== null || !validFallbackBasis(s)) return 'AI_REVIEW_BINDING_INVALID';
  const context = r.approved_proposal?.context;
  if (!Array.isArray(translation.current_article_ids) || (translation.current_article_ids.length > 0 &&
      !onlyArticlesWithoutExplanation(s, context, translation.current_article_ids)))
    return 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS';
  const field = translation.locale === 'uk' ? 'translation_ua' : 'translation_en';
  const values = r.approved_proposal?.answer?.[field];
  if (!context || context.basis !== NO_ARTICLE_BASIS || context.article_id !== null ||
      norm(context.lemma) !== norm(entity.lemma) || context.pos !== entity.pos ||
      !sameSources(context.sources, s.sources) ||
      !sameSources(context.publication_evidence, s.publication_evidence) ||
      context.basis_note !== s.basis_note || context.basis_step !== s.basis_step ||
      (!Array.isArray(r.approved_proposal.missing) || !r.approved_proposal.missing.includes(field)) ||
      !Array.isArray(values) || values.length !== 1 || !nonempty(values[0]) || values[0].trim() !== b.value)
    return 'AI_REVIEW_PROPOSAL_MISMATCH';
  return null;
}

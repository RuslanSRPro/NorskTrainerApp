import type { SourceEvidence, UnifiedEvidenceSummary, ItemType } from './types.ts';

const POSITIVE_STATUSES = new Set([
  'expr_entry',
  'sub_article',
  'article_ref',
  'uttrykk',
  'example',
  'entry',
  'matched_uttrykk',
  'matched_example',
]);

const NEGATIVE_STATUSES = new Set([
  'not_listed',
  'not_found',
  'expression_not_found_in_article',
]);

export function buildUnifiedEvidenceSummary(params: {
  item_type: ItemType;
  item_id: string;
  ordbokene?: SourceEvidence;
  naob?: SourceEvidence;
}): UnifiedEvidenceSummary {
  const sources = [params.ordbokene, params.naob].filter(Boolean) as SourceEvidence[];

  const attempted_sources = sources.length;
  const successful_sources = sources.filter((s) => s.success).length;

  const positive_sources = sources.filter((s) => {
    return s.status ? POSITIVE_STATUSES.has(s.status) : false;
  }).length;

  const negative_sources = sources.filter((s) => {
    return s.status ? NEGATIVE_STATUSES.has(s.status) : false;
  }).length;

  return {
    item_type: params.item_type,
    item_id: params.item_id,
    sources: {
      ordbokene: params.ordbokene,
      naob: params.naob,
    },
    summary: {
      attempted_sources,
      successful_sources,
      positive_sources,
      negative_sources,
      has_authoritative_evidence: positive_sources > 0,
    },
  };
}

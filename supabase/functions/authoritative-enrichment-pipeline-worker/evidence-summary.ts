import type {
  SourceEvidence,
  UnifiedEvidenceSummary,
  ItemType,
  SourceDetail,
  VerificationTier,
  VerificationStatus,
} from './types.ts';

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

  const sourceDetails = sources.map(toSourceDetail);

  const attempted_sources = sources.length;
  const successful_sources = sources.filter((s) => s.success).length;

  const positive_sources = sources.filter((s) => {
    return s.status ? POSITIVE_STATUSES.has(s.status) : false;
  }).length;

  const negative_sources = sources.filter((s) => {
    return s.status ? NEGATIVE_STATUSES.has(s.status) : false;
  }).length;

  const strongest = getStrongestSourceDetail(sourceDetails);
  const hasInfrastructureFailure = sourceDetails.some(
    (detail) => detail.tier === 'technical_error',
  );

  const verification_status = getVerificationStatus({
    strongest,
    hasInfrastructureFailure,
  });

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
      verification_status,
      strongest_tier: strongest?.tier ?? 'not_found',
      strongest_source: strongest?.source ?? null,
      source_details: sourceDetails,
    },
  };
}

function toSourceDetail(source: SourceEvidence): SourceDetail {
  if (!source.success) {
    return {
      source: source.source,
      status: source.status,
      success: false,
      tier: 'technical_error',
      found: false,
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      confidence: source.confidence ?? null,
      evidence_label: `${source.source}: technical failure`,
    };
  }

  if (source.source === 'ordbokene') {
    return mapOrdbokene(source);
  }

  if (source.source === 'naob') {
    return mapNaob(source);
  }

  return mapGeneric(source);
}

function mapOrdbokene(source: SourceEvidence): SourceDetail {
  if (source.status === 'expr_entry' || source.status === 'entry') {
    return {
      source: source.source,
      status: source.status,
      success: true,
      tier: 'dictionary_entry',
      found: true,
      registered_entry: true,
      whole_unit_match: true,
      component_match: false,
      usage_match: false,
      confidence: source.confidence ?? 1,
      evidence_label: 'Ordbokene registered entry',
    };
  }

  if (source.status === 'sub_article') {
    return {
      source: source.source,
      status: source.status,
      success: true,
      tier: 'usage_evidence',
      found: true,
      registered_entry: false,
      whole_unit_match: true,
      component_match: false,
      usage_match: true,
      confidence: source.confidence ?? 0.8,
      evidence_label: 'Ordbokene sub-article expression evidence',
    };
  }

  if (source.status === 'article_ref') {
    return {
      source: source.source,
      status: source.status,
      success: true,
      tier: 'usage_evidence',
      found: true,
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: true,
      confidence: source.confidence ?? 0.6,
      evidence_label: 'Ordbokene article reference evidence',
    };
  }

  if (source.status === 'not_listed' || source.status === 'not_found') {
    return notFoundDetail(source, 'Ordbokene: no registered entry found');
  }

  return mapGeneric(source);
}

function mapNaob(source: SourceEvidence): SourceDetail {
  if (source.status === 'uttrykk') {
    return {
      source: source.source,
      status: source.status,
      success: true,
      tier: 'dictionary_entry',
      found: true,
      registered_entry: true,
      whole_unit_match: true,
      component_match: false,
      usage_match: false,
      confidence: source.confidence ?? 1,
      evidence_label: 'NAOB UTTRYKK entry',
    };
  }

  if (source.status === 'example') {
    return {
      source: source.source,
      status: source.status,
      success: true,
      tier: 'usage_evidence',
      found: true,
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: true,
      confidence: source.confidence ?? 0.8,
      evidence_label: 'NAOB example usage evidence',
    };
  }

  if (
    source.status === 'not_listed' ||
    source.status === 'not_found' ||
    source.status === 'expression_not_found_in_article'
  ) {
    return notFoundDetail(source, 'NAOB: expression not found in checked articles');
  }

  return mapGeneric(source);
}

function mapGeneric(source: SourceEvidence): SourceDetail {
  if (source.status && POSITIVE_STATUSES.has(source.status)) {
    return {
      source: source.source,
      status: source.status,
      success: source.success,
      tier: 'usage_evidence',
      found: true,
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: true,
      confidence: source.confidence ?? 0.7,
      evidence_label: `${source.source}: positive evidence`,
    };
  }

  if (source.status && NEGATIVE_STATUSES.has(source.status)) {
    return notFoundDetail(source, `${source.source}: no match found`);
  }

  return notFoundDetail(source, `${source.source}: no usable evidence`);
}

function notFoundDetail(
  source: SourceEvidence,
  label: string,
): SourceDetail {
  return {
    source: source.source,
    status: source.status,
    success: source.success,
    tier: 'not_found',
    found: false,
    registered_entry: false,
    whole_unit_match: false,
    component_match: false,
    usage_match: false,
    confidence: source.confidence ?? 1,
    evidence_label: label,
  };
}

function getStrongestSourceDetail(
  details: SourceDetail[],
): SourceDetail | null {
  if (!details.length) return null;

  return [...details].sort((a, b) => {
    return getTierRank(b.tier) - getTierRank(a.tier);
  })[0];
}

function getTierRank(tier: VerificationTier): number {
  switch (tier) {
    case 'dictionary_entry':
      return 4;
    case 'usage_evidence':
      return 3;
    case 'component_match':
      return 2;
    case 'not_found':
      return 1;
    case 'technical_error':
      return 0;
    default:
      return 0;
  }
}

function getVerificationStatus(params: {
  strongest: SourceDetail | null;
  hasInfrastructureFailure: boolean;
}): VerificationStatus {
  if (params.hasInfrastructureFailure) {
    return 'infrastructure_failure';
  }

  if (!params.strongest) {
    return 'unverified';
  }

  if (params.strongest.tier === 'dictionary_entry') {
    return 'verified';
  }

  if (
    params.strongest.tier === 'usage_evidence' ||
    params.strongest.tier === 'component_match'
  ) {
    return 'partial';
  }

  return 'unverified';
}
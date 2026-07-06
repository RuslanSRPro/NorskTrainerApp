// services/verification.ts
// Norsk Trainer App — unified verification resolver
// Centralizes verification tier logic for Badge, Dashboard, Reading, Training, Audit reports.

import type { AppLanguage } from '@/services/i18n';
import { t } from '@/services/i18n';

export type VerificationTier =
  | 'dictionary_entry'
  | 'dictionary_match'
  | 'normative_reference'
  | 'usage_evidence'
  | 'component_match'
  | 'ai_candidate';

export type EvidenceQuality =
  | 'registered_entry'
  | 'structured_entry_match'
  | 'learner_dictionary'
  | 'exact_expression_match'
  | 'usage_example_match'
  | 'normative_reference'
  | 'search_page_match'
  | 'component_match'
  | 'ai_suggestion'
  | 'not_found'
  | 'not_checked'
  | string;

export type SourceName =
  | 'NAOB'
  | 'Ordbokene'
  | 'Lexin'
  | 'Språkrådet'
  | 'Wiktionary'
  | 'Gemini'
  | 'Manual'
  | string;

export type SourceEvidence = {
  source?: SourceName;
  quality?: EvidenceQuality;
  found?: boolean;
  registered_entry?: boolean;
  whole_unit_match?: boolean;
  component_match?: boolean;
  usage_match?: boolean;
  confidence?: number;
  evidence_label?: string;
  url?: string;
  raw_preview?: string;
  [key: string]: any;
};

export type VerificationEvidence =
  | Record<string, SourceEvidence | null | undefined>
  | SourceEvidence[]
  | null
  | undefined;

export type VerificationInput = {
  verification_tier?: VerificationTier | string | null;
  verification_status?: string | null;
  verification_group?: string | null;
  source_verified?: string | string[] | null;
  registered_sources?: string[] | string | null;
  usage_sources?: string[] | string | null;
  normative_sources?: string[] | string | null;
  verification_confidence?: number | string | null;
  verification_evidence?: VerificationEvidence;
  source_evidence_scope?: any;
  whole_unit_verified?: boolean | null;
  component_verified?: boolean | null;
  source_verified_bool?: boolean | null;
  sourceVerified?: string | string[] | null;
  evidence?: VerificationEvidence;
  tier?: VerificationTier | string | null;
  [key: string]: any;
};

export type VerificationResolved = {
  tier: VerificationTier;
  label: string;
  description: string;
  confidence: number;
  stars: number;
  color: string;
  bg: string;
  dot: string;
  sourceVerified: string;
  foundSources: Array<[string, SourceEvidence]>;
  strongSources: Array<[string, SourceEvidence]>;
  weakSources: Array<[string, SourceEvidence]>;
  isStrong: boolean;
  isTrusted: boolean;
  isAiOnly: boolean;
  group: 'strong' | 'source_supported' | 'weak' | 'ai_only' | 'unresolved';
  explanation: string;
};

export const TIER_RANK: Record<VerificationTier, number> = {
  dictionary_entry: 6,
  dictionary_match: 5,
  normative_reference: 4,
  usage_evidence: 3,
  component_match: 2,
  ai_candidate: 1,
};

export const TIER_STARS: Record<VerificationTier, number> = {
  dictionary_entry: 5,
  dictionary_match: 4,
  normative_reference: 4,
  usage_evidence: 3,
  component_match: 2,
  ai_candidate: 1,
};

export const TIER_COLORS: Record<VerificationTier, { color: string; bg: string; dot: string }> = {
  dictionary_entry: {
    color: '#0F6E56',
    bg: '#E1F5EE',
    dot: '#27C96A',
  },
  dictionary_match: {
    color: '#185FA5',
    bg: '#E6F1FB',
    dot: '#0A84FF',
  },
  normative_reference: {
    color: '#854F0B',
    bg: '#FAEEDA',
    dot: '#FF9F0A',
  },
  usage_evidence: {
    color: '#3B6D11',
    bg: '#EAF3DE',
    dot: '#FFD60A',
  },
  component_match: {
    color: '#5F5E5A',
    bg: '#F1EFE8',
    dot: '#8E8E93',
  },
  ai_candidate: {
    color: '#5F5E5A',
    bg: '#F1EFE8',
    dot: '#636366',
  },
};

export const QUALITY_SCORE: Record<string, number> = {
  registered_entry: 100,
  structured_entry_match: 90,
  learner_dictionary: 85,
  exact_expression_match: 75,
  usage_example_match: 60,
  normative_reference: 50,
  search_page_match: 35,
  component_match: 30,
  ai_suggestion: 10,
  not_found: 0,
  not_checked: 0,
};

// Sources whose `registered_entry: true` / `whole_unit_match: true` flags
// are trusted as authoritative dictionary signals. Mirrors the server's
// AUTHORITATIVE_DICTIONARIES set in semantic-audit-worker exactly — see
// the reconciliation note on getEvidenceTier() below.
const AUTHORITATIVE_DICTIONARIES = new Set<string>(['NAOB', 'Ordbokene']);

// Quality strings that map to a tier WITHOUT needing a specific source or
// boolean-flag combination. Deliberately does NOT include 'registered_entry',
// 'structured_entry_match', or 'normative_reference' — on the server
// (aggregateVerificationTier in semantic-audit-worker), those three are
// reachable only through a combination of a boolean flag AND a specific
// authoritative source, never from the quality string alone. Including them
// here would let evidence reach dictionary_entry / dictionary_match /
// normative_reference from any source, bypassing that check — see
// architecture-audit-full.md for the full reconciliation table.
export const QUALITY_TO_TIER: Record<string, VerificationTier> = {
  learner_dictionary: 'usage_evidence',
  exact_expression_match: 'usage_evidence',
  usage_example_match: 'usage_evidence',
  search_page_match: 'component_match',
  component_match: 'component_match',
  ai_suggestion: 'ai_candidate',
};

const TIER_DESC_KEYS: Record<VerificationTier, string> = {
  dictionary_entry: 'dict_entry_desc',
  dictionary_match: 'dict_match_desc',
  normative_reference: 'normative_ref_desc',
  usage_evidence: 'usage_evidence_desc',
  component_match: 'component_match_desc',
  ai_candidate: 'ai_candidate_desc',
};

const FALLBACK_LABELS: Record<VerificationTier, Record<AppLanguage, string>> = {
  dictionary_entry: {
    ua: 'Словникова стаття',
    en: 'Dictionary entry',
    no: 'Ordbokartikkel',
  },
  dictionary_match: {
    ua: 'Знайдено в словнику',
    en: 'Dictionary match',
    no: 'Funnet i ordbok',
  },
  normative_reference: {
    ua: 'Нормативне підтвердження',
    en: 'Normative reference',
    no: 'Normativ referanse',
  },
  usage_evidence: {
    ua: 'Підтверджено вживанням',
    en: 'Usage evidence',
    no: 'Bruksbelegg',
  },
  component_match: {
    ua: 'Підтверджені компоненти',
    en: 'Components verified',
    no: 'Komponenter bekreftet',
  },
  ai_candidate: {
    ua: 'AI-кандидат',
    en: 'AI candidate',
    no: 'AI-kandidat',
  },
};

const FALLBACK_DESCRIPTIONS: Record<VerificationTier, Record<AppLanguage, string>> = {
  dictionary_entry: {
    ua: 'Є окрема зареєстрована словникова стаття для цієї одиниці.',
    en: 'A registered dictionary entry exists for this lexical unit.',
    no: 'Det finnes en registrert ordbokartikkel for denne leksikalske enheten.',
  },
  dictionary_match: {
    ua: 'Одиницю знайдено або підтверджено словниковим джерелом.',
    en: 'The unit is found or supported by a dictionary source.',
    no: 'Enheten er funnet eller støttet av en ordbokkilde.',
  },
  normative_reference: {
    ua: 'Є нормативне або мовне підтвердження, але це не обовʼязково окрема словникова стаття.',
    en: 'There is normative or language-reference support, but not necessarily a dictionary entry.',
    no: 'Det finnes normativ eller språkfaglig støtte, men ikke nødvendigvis en egen ordbokartikkel.',
  },
  usage_evidence: {
    ua: 'Одиниця підтверджена прикладами реального вживання.',
    en: 'The unit is supported by usage examples or authentic usage.',
    no: 'Enheten er støttet av brukseksempler eller autentisk bruk.',
  },
  component_match: {
    ua: 'Підтверджені частини виразу, але не вся одиниця як ціле.',
    en: 'Components are verified, but the full unit is not confirmed as a whole.',
    no: 'Komponentene er bekreftet, men hele uttrykket er ikke bekreftet som én enhet.',
  },
  ai_candidate: {
    ua: 'Запропоновано AI або ще не підтверджено авторитетними джерелами.',
    en: 'Suggested by AI or not yet confirmed by authoritative sources.',
    no: 'Foreslått av AI eller ennå ikke bekreftet av autoritative kilder.',
  },
};

function safeLang(lang?: AppLanguage | string | null): AppLanguage {
  if (lang === 'ua' || lang === 'en' || lang === 'no') return lang;
  return 'ua';
}

function safeT(key: string, lang: AppLanguage, fallback: string): string {
  try {
    const value = t(key as any, lang);
    if (value && value !== key) return value;
  } catch {
    // keep fallback
  }
  return fallback;
}

export function normalizeSourceList(value?: string | string[] | null): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  return String(value)
    .split(/[,+;/|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifySources(value?: string | string[] | null): string {
  return normalizeSourceList(value).join('+');
}

export function normalizeEvidence(evidence: VerificationEvidence): Array<[string, SourceEvidence]> {
  if (!evidence) return [];

  if (Array.isArray(evidence)) {
    return evidence
      .map((item, index) => {
        const source = item?.source || `source_${index + 1}`;
        return [String(source), item || {}] as [string, SourceEvidence];
      })
      .filter(([, item]) => Boolean(item));
  }

  return Object.entries(evidence)
    .filter(([, item]) => Boolean(item))
    .map(([source, item]) => [source, item || {}]);
}

export function isFoundEvidence(item?: SourceEvidence | null): boolean {
  if (!item) return false;
  if (item.found === false) return false;
  if (item.quality === 'not_checked' || item.quality === 'not_found') return false;
  return Boolean(item.found || item.registered_entry || item.whole_unit_match || item.component_match || item.quality);
}

export function getEvidenceQualityScore(item?: SourceEvidence | null): number {
  if (!item) return 0;

  if (typeof item.confidence === 'number' && Number.isFinite(item.confidence)) {
    if (item.confidence <= 1) return Math.round(item.confidence * 100);
    return Math.round(Math.min(item.confidence, 100));
  }

  const quality = item.quality || 'not_checked';
  return QUALITY_SCORE[quality] ?? 0;
}

// Mirrors the server's aggregateVerificationTier() in semantic-audit-worker
// branch-for-branch, same priority order. Diverging from this — even by one
// quality string or a missing source check — produces a tier on the client
// that disagrees with what review_status the server actually wrote, which
// is exactly the "two truths" failure mode this reconciliation closes. See
// architecture-audit-full.md for the full before/after comparison table.
export function getEvidenceTier(item?: SourceEvidence | null): VerificationTier {
  if (!item || !isFoundEvidence(item)) return 'ai_candidate';

  const isAuthoritativeSource = Boolean(
    item.source && AUTHORITATIVE_DICTIONARIES.has(item.source),
  );

  if (item.registered_entry && isAuthoritativeSource) {
    return 'dictionary_entry';
  }

  if (
    item.whole_unit_match &&
    item.quality === 'structured_entry_match' &&
    isAuthoritativeSource
  ) {
    return 'dictionary_match';
  }

  if (item.quality === 'normative_reference' && item.source === 'Språkrådet') {
    return 'normative_reference';
  }

  if (item.usage_match === true) {
    return 'usage_evidence';
  }

  if (item.quality && QUALITY_TO_TIER[item.quality]) {
    return QUALITY_TO_TIER[item.quality];
  }

  if (item.component_match) return 'component_match';

  // Server's equivalent fallback (when nothing in the evidence list matched
  // any condition) is 'ai_candidate', not a softer tier — matched here
  // deliberately so the client never shows evidence as more confirmed than
  // the server's own review_status. Confirmed by the user.
  return 'ai_candidate';
}

export function chooseStrongerTier(a: VerificationTier, b: VerificationTier): VerificationTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function normalizeTier(value?: VerificationTier | string | null): VerificationTier {
  if (
    value === 'dictionary_entry' ||
    value === 'dictionary_match' ||
    value === 'normative_reference' ||
    value === 'usage_evidence' ||
    value === 'component_match' ||
    value === 'ai_candidate'
  ) {
    return value;
  }

  if (value === 'verified_dictionary' || value === 'registered_entry') return 'dictionary_entry';
  if (value === 'source_supported' || value === 'dictionary_verified') return 'dictionary_match';
  // Legacy verification statuses are no longer treated as verified tiers.
  // They remain candidates until reprocessed by the new verification pipeline.
  if (value === 'candidate_authoritative') return 'ai_candidate';
  if (value === 'component_verified') return 'ai_candidate';

  return 'ai_candidate';
}

export function inferVerificationTier(input?: VerificationInput | null): VerificationTier {
  if (!input) return 'ai_candidate';

  const explicit = input.verification_tier ?? input.tier;
  if (explicit) return normalizeTier(explicit);

  const evidenceEntries = normalizeEvidence(input.verification_evidence ?? input.evidence);
  const foundEvidence = evidenceEntries.filter(([, item]) => isFoundEvidence(item));

  let tier: VerificationTier = 'ai_candidate';

  for (const [, item] of foundEvidence) {
    tier = chooseStrongerTier(tier, getEvidenceTier(item));
  }

  const registeredSources = normalizeSourceList(input.registered_sources);
  const usageSources = normalizeSourceList(input.usage_sources);
  const normativeSources = normalizeSourceList(input.normative_sources);
  const sourceVerified = normalizeSourceList(input.source_verified ?? input.sourceVerified);

  if (registeredSources.length > 0 || input.whole_unit_verified) {
    tier = chooseStrongerTier(tier, 'dictionary_entry');
  } else if (sourceVerified.length > 0) {
    tier = chooseStrongerTier(tier, 'dictionary_match');
  }

  if (normativeSources.length > 0) {
    tier = chooseStrongerTier(tier, 'normative_reference');
  }

  if (usageSources.length > 0) {
    tier = chooseStrongerTier(tier, 'usage_evidence');
  }

  // Legacy component_verified should not automatically promote a lexeme.
  // Only explicit verification_method='component' (new pipeline) may do that.
  if (
    input.component_verified &&
    (input as any).verification_method === 'component'
  ) {
    tier = chooseStrongerTier(tier, 'component_match');
  }

  return tier;
}

export function resolveVerificationConfidence(input?: VerificationInput | null): number {
  if (!input) return 10;

  const explicit = Number(input.verification_confidence);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit <= 1 ? Math.round(explicit * 100) : Math.round(Math.min(explicit, 100));
  }

  const foundEvidence = normalizeEvidence(input.verification_evidence ?? input.evidence)
    .filter(([, item]) => isFoundEvidence(item));

  if (foundEvidence.length > 0) {
    return Math.max(...foundEvidence.map(([, item]) => getEvidenceQualityScore(item)));
  }

  const tier = inferVerificationTier(input);

  switch (tier) {
    case 'dictionary_entry':
      return 100;
    case 'dictionary_match':
      return 85;
    case 'normative_reference':
      return 65;
    case 'usage_evidence':
      return 55;
    case 'component_match':
      return 35;
    case 'ai_candidate':
    default:
      return 10;
  }
}

export function getVerificationGroup(
  tier: VerificationTier,
  confidence = 0
): VerificationResolved['group'] {
  if (tier === 'dictionary_entry' || tier === 'dictionary_match') return 'strong';
  if (tier === 'normative_reference' || tier === 'usage_evidence') return 'source_supported';
  if (tier === 'component_match') return 'weak';
  if (tier === 'ai_candidate' && confidence <= 15) return 'ai_only';
  return 'unresolved';
}

export function getTierLabel(tier: VerificationTier, lang?: AppLanguage | string | null): string {
  const l = safeLang(lang);
  return safeT(tier, l, FALLBACK_LABELS[tier][l]);
}

export function getTierDescription(tier: VerificationTier, lang?: AppLanguage | string | null): string {
  const l = safeLang(lang);
  return safeT(TIER_DESC_KEYS[tier], l, FALLBACK_DESCRIPTIONS[tier][l]);
}

export function getQualityLabel(quality?: EvidenceQuality | null, lang?: AppLanguage | string | null): string {
  const l = safeLang(lang);
  const q = quality || 'not_checked';

  const fallback: Record<string, Record<AppLanguage, string>> = {
    registered_entry: { ua: 'Зареєстрована стаття', en: 'Registered entry', no: 'Registrert artikkel' },
    structured_entry_match: { ua: 'Структурований збіг', en: 'Structured entry match', no: 'Strukturert treff' },
    learner_dictionary: { ua: 'Навчальний словник', en: 'Learner dictionary', no: 'Læringsordbok' },
    exact_expression_match: { ua: 'Точний збіг виразу', en: 'Exact expression match', no: 'Eksakt uttrykkstreff' },
    usage_example_match: { ua: 'Приклад вживання', en: 'Usage example', no: 'Brukseksempel' },
    normative_reference: { ua: 'Нормативна довідка', en: 'Normative reference', no: 'Normativ referanse' },
    search_page_match: { ua: 'Знайдено пошуком', en: 'Search page match', no: 'Treff i søk' },
    component_match: { ua: 'Збіг компонентів', en: 'Component match', no: 'Komponenttreff' },
    ai_suggestion: { ua: 'AI-пропозиція', en: 'AI suggestion', no: 'AI-forslag' },
    not_found: { ua: 'Не знайдено', en: 'Not found', no: 'Ikke funnet' },
    not_checked: { ua: 'Не перевірено', en: 'Not checked', no: 'Ikke sjekket' },
  };

  return safeT(q, l, fallback[q]?.[l] || String(q));
}

export function resolveVerification(
  input?: VerificationInput | null,
  lang?: AppLanguage | string | null
): VerificationResolved {
  const l = safeLang(lang);
  const tier = inferVerificationTier(input);
  const confidence = resolveVerificationConfidence(input);
  const colors = TIER_COLORS[tier];

  const evidenceEntries = normalizeEvidence(input?.verification_evidence ?? input?.evidence);
  const foundSources = evidenceEntries.filter(([, item]) => isFoundEvidence(item));
  const strongSources = foundSources.filter(([, item]) => getEvidenceQualityScore(item) >= 60);
  const weakSources = foundSources.filter(([, item]) => getEvidenceQualityScore(item) < 60);

  const sourceVerified =
    stringifySources(input?.source_verified ?? input?.sourceVerified) ||
    stringifySources(input?.registered_sources) ||
    foundSources.map(([source]) => source).join('+');

  const group = getVerificationGroup(tier, confidence);
  const label = getTierLabel(tier, l);
  const description = getTierDescription(tier, l);

  return {
    tier,
    label,
    description,
    confidence,
    stars: TIER_STARS[tier],
    color: colors.color,
    bg: colors.bg,
    dot: colors.dot,
    sourceVerified,
    foundSources,
    strongSources,
    weakSources,
    isStrong: group === 'strong',
    isTrusted: group === 'strong' || group === 'source_supported',
    isAiOnly: group === 'ai_only',
    group,
    explanation: description,
  };
}

export function getVerificationSortScore(input?: VerificationInput | null): number {
  const resolved = resolveVerification(input);
  return TIER_RANK[resolved.tier] * 100 + resolved.confidence;
}

export function isVerificationTrusted(input?: VerificationInput | null): boolean {
  return resolveVerification(input).isTrusted;
}

export function isAiOnlyVerification(input?: VerificationInput | null): boolean {
  return resolveVerification(input).isAiOnly;
}

export function summarizeVerificationCounts(items: VerificationInput[]) {
  const summary = {
    total: items.length,
    strong: 0,
    source_supported: 0,
    weak: 0,
    ai_only: 0,
    unresolved: 0,
    byTier: {
      dictionary_entry: 0,
      dictionary_match: 0,
      normative_reference: 0,
      usage_evidence: 0,
      component_match: 0,
      ai_candidate: 0,
    } as Record<VerificationTier, number>,
  };

  for (const item of items) {
    const resolved = resolveVerification(item);
    summary[resolved.group] += 1;
    summary.byTier[resolved.tier] += 1;
  }

  return summary;
}

export function buildVerificationPatch(input?: VerificationInput | null) {
  const resolved = resolveVerification(input);

  return {
    verification_tier: resolved.tier,
    verification_group: resolved.group,
    verification_confidence: resolved.confidence,
    source_verified: resolved.sourceVerified || null,
  };
}
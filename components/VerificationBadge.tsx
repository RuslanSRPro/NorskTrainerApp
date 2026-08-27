// components/VerificationBadge.tsx
// Norsk Trainer App — verification badge with localized evidence popup
// Uses services/verification.ts as the single source of truth.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';

import type {
  EvidenceQuality,
  SourceEvidence,
  VerificationEvidence,
  VerificationTier,
} from '@/services/verification';

import {
  getQualityLabel,
  resolveVerification,
} from '@/services/verification';

import type { AppLanguage } from '@/services/i18n';

type Props = {
  tier?: VerificationTier | string | null;
  sourceVerified?: string | string[] | null;
  evidence?: VerificationEvidence | null;
  lemma?: string;
  size?: 'sm' | 'md';
  lang?: AppLanguage | string | null;
};

// ── Local UI strings not owned by verification resolver ───────────────────────
const UI = {
  ua: {
    accessibilityPrefix: 'Верифікація',
    accessibilitySuffix: 'Натисни, щоб переглянути деталі.',
    confirmed_by: 'ДЖЕРЕЛА ТА РІВЕНЬ ПІДТВЕРДЖЕННЯ',
    registered_in: 'Зареєстровано в',
    registered: 'зареєстровано',
    close: 'Закрити',
    no_evidence: 'Авторитетні джерела поки не підтвердили цей вираз.',
    ai_analysis: 'AI-аналіз',
  },
  en: {
    accessibilityPrefix: 'Verification',
    accessibilitySuffix: 'Tap for details.',
    confirmed_by: 'SOURCES AND VERIFICATION LEVEL',
    registered_in: 'Registered in',
    registered: 'registered',
    close: 'Close',
    no_evidence: 'No authoritative sources confirmed this expression yet.',
    ai_analysis: 'AI analysis',
  },
  no: {
    accessibilityPrefix: 'Verifisering',
    accessibilitySuffix: 'Trykk for detaljer.',
    confirmed_by: 'KILDER OG BEKREFTELSESNIVÅ',
    registered_in: 'Registrert i',
    registered: 'registrert',
    close: 'Lukk',
    no_evidence: 'Ingen autoritative kilder har bekreftet dette uttrykket ennå.',
    ai_analysis: 'AI-analyse',
  },
} as const;

type SafeLanguage = keyof typeof UI;
type UiKey = keyof typeof UI.en;

function normalizeLang(lang?: AppLanguage | string | null): SafeLanguage {
  return lang === 'ua' || lang === 'no' || lang === 'en' ? lang : 'ua';
}

function tr(key: UiKey, lang?: AppLanguage | string | null): string {
  const safeLang = normalizeLang(lang);
  return UI[safeLang][key] || UI.en[key] || key;
}

const QUALITY_ICONS: Record<string, { icon: string; strong: boolean }> = {
  registered_entry: { icon: '📖', strong: true },
  structured_entry_match: { icon: '📖', strong: true },
  learner_dictionary: { icon: '📚', strong: true },
  normative_reference: { icon: '🏛', strong: true },
  exact_expression_match: { icon: '✓', strong: false },
  search_page_match: { icon: '🔍', strong: false },
  usage_example_match: { icon: '💬', strong: false },
  component_match: { icon: '🧩', strong: false },
  ai_suggestion: { icon: '🤖', strong: false },
};

const SOURCE_LABELS: Record<SafeLanguage, Record<string, string>> = {
  ua: {
    NAOB: 'NAOB — Det Norske Akademis ordbok',
    Ordbokene: 'Ordbøkene (UiB + Språkrådet)',
    Lexin: 'Lexin — OsloMet',
    Språkrådet: 'Språkrådet',
    Wiktionary: 'Wiktionary',
    Gemini: UI.ua.ai_analysis,
    Manual: 'Manual',
  },
  en: {
    NAOB: 'NAOB — Det Norske Akademis ordbok',
    Ordbokene: 'Ordbøkene (UiB + Språkrådet)',
    Lexin: 'Lexin — OsloMet',
    Språkrådet: 'Språkrådet',
    Wiktionary: 'Wiktionary',
    Gemini: UI.en.ai_analysis,
    Manual: 'Manual',
  },
  no: {
    NAOB: 'NAOB — Det Norske Akademis ordbok',
    Ordbokene: 'Ordbøkene (UiB + Språkrådet)',
    Lexin: 'Lexin — OsloMet',
    Språkrådet: 'Språkrådet',
    Wiktionary: 'Wiktionary',
    Gemini: UI.no.ai_analysis,
    Manual: 'Manual',
  },
};

function getSourceLabel(source: string, lang: SafeLanguage) {
  return SOURCE_LABELS[lang][source] || source;
}

function sanitizeEvidenceLabel(label?: string | null): string {
  if (!label) return '';

  const value = String(label).trim();

  if (!value) return '';

  const debugMarkers = [
    'HTTP',
    'crosscheck',
    'HTML primary',
    'api/',
    'Errors:',
    'search:',
    'lemma:',
    'limit=',
    'v2.',
  ];

  if (debugMarkers.some((marker) => value.includes(marker))) {
    return '';
  }

  if (value.length > 120) {
    return '';
  }

  return value;
}


function getQualityExplanation(
  item: SourceEvidence,
  quality: EvidenceQuality,
  lang: SafeLanguage
) {
  const isRegistered = item.registered_entry === true;
  const isWhole = item.whole_unit_match === true;
  const isComponent = item.component_match === true;
  const isUsage = item.usage_match === true;

  if (lang === 'ua') {
    if (isRegistered || quality === 'registered_entry' || quality === 'structured_entry_match') return 'Окремий словниковий запис';
    if (quality === 'learner_dictionary') return 'Запис у навчальному словнику';
    if (quality === 'normative_reference') return 'Нормативне підтвердження';
    if (isWhole || quality === 'exact_expression_match') return 'Знайдено як цілісну одиницю';
    if (isUsage || quality === 'usage_example_match') return 'Знайдено у прикладах уживання';
    if (isComponent || quality === 'component_match') return 'Компоненти підтверджені';
    if (quality === 'search_page_match') return 'Знайдено через пошук у джерелі';
    if (quality === 'not_found') return 'Джерело перевірено, збігу не знайдено';
    if (quality === 'error') return 'Джерело не відповіло або сталася помилка';
    if (quality === 'not_checked') return 'Джерело ще не перевірено';
    if (quality === 'ai_suggestion') return 'AI-підказка, не авторитетне джерело';
    return 'Дані джерела отримані';
  }

  if (lang === 'no') {
    if (isRegistered || quality === 'registered_entry' || quality === 'structured_entry_match') return 'Egen ordbokartikkel';
    if (quality === 'learner_dictionary') return 'Oppslag i læringsordbok';
    if (quality === 'normative_reference') return 'Normativ bekreftelse';
    if (isWhole || quality === 'exact_expression_match') return 'Funnet som hel enhet';
    if (isUsage || quality === 'usage_example_match') return 'Funnet i brukseksempler';
    if (isComponent || quality === 'component_match') return 'Komponenter bekreftet';
    if (quality === 'search_page_match') return 'Funnet via søk i kilden';
    if (quality === 'not_found') return 'Kilden er sjekket, men ingen treff ble funnet';
    if (quality === 'error') return 'Kilden svarte ikke eller ga feil';
    if (quality === 'not_checked') return 'Kilden er ikke sjekket ennå';
    if (quality === 'ai_suggestion') return 'AI-forslag, ikke autoritativ kilde';
    return 'Kildedata funnet';
  }

  if (isRegistered || quality === 'registered_entry' || quality === 'structured_entry_match') return 'Separate dictionary entry';
  if (quality === 'learner_dictionary') return 'Learner dictionary entry';
  if (quality === 'normative_reference') return 'Normative confirmation';
  if (isWhole || quality === 'exact_expression_match') return 'Found as a whole unit';
  if (isUsage || quality === 'usage_example_match') return 'Found in usage examples';
  if (isComponent || quality === 'component_match') return 'Components verified';
  if (quality === 'search_page_match') return 'Found through source search';
  if (quality === 'not_found') return 'Source checked, no match found';
  if (quality === 'error') return 'Source unavailable or returned an error';
  if (quality === 'not_checked') return 'Source not checked yet';
  if (quality === 'ai_suggestion') return 'AI suggestion, not authoritative';
  return 'Source data found';
}

function getQualityStatusStyle(quality: EvidenceQuality, item: SourceEvidence) {
  if (
    item.registered_entry ||
    quality === 'registered_entry' ||
    quality === 'structured_entry_match' ||
    quality === 'learner_dictionary' ||
    quality === 'normative_reference'
  ) {
    return 'strong';
  }

  if (
    item.whole_unit_match ||
    item.usage_match ||
    quality === 'exact_expression_match' ||
    quality === 'usage_example_match' ||
    quality === 'search_page_match'
  ) {
    return 'medium';
  }

  if (item.component_match || quality === 'component_match') {
    return 'component';
  }

  if (quality === 'error' || quality === 'not_found') {
    return 'weak';
  }

  return 'neutral';
}

function Stars({ count, color }: { count: number; color: string }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { color: i <= count ? color : '#D3D1C7' }]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}


function getShortQualityBadgeLabel(quality: EvidenceQuality, lang: SafeLanguage) {
  if (lang === 'ua') {
    switch (quality) {
      case 'registered_entry':
      case 'structured_entry_match':
        return 'запис';
      case 'learner_dictionary':
        return 'навч. словник';
      case 'normative_reference':
        return 'норма';
      case 'exact_expression_match':
        return 'ціла одиниця';
      case 'search_page_match':
        return 'пошук';
      case 'usage_example_match':
        return 'приклад';
      case 'component_match':
        return 'компоненти';
      case 'ai_suggestion':
        return 'AI';
      case 'not_found':
        return 'не знайдено';
      case 'not_checked':
        return 'не перевірено';
      case 'error':
        return 'помилка';
      default:
        return 'джерело';
    }
  }

  if (lang === 'no') {
    switch (quality) {
      case 'registered_entry':
      case 'structured_entry_match':
        return 'oppslag';
      case 'learner_dictionary':
        return 'læringsordbok';
      case 'normative_reference':
        return 'norm';
      case 'exact_expression_match':
        return 'hel enhet';
      case 'search_page_match':
        return 'søk';
      case 'usage_example_match':
        return 'eksempel';
      case 'component_match':
        return 'komponenter';
      case 'ai_suggestion':
        return 'AI';
      case 'not_found':
        return 'ikke funnet';
      case 'not_checked':
        return 'ikke sjekket';
      case 'error':
        return 'feil';
      default:
        return 'kilde';
    }
  }

  switch (quality) {
    case 'registered_entry':
    case 'structured_entry_match':
      return 'entry';
    case 'learner_dictionary':
      return 'learner dict';
    case 'normative_reference':
      return 'normative';
    case 'exact_expression_match':
      return 'whole unit';
    case 'search_page_match':
      return 'search';
    case 'usage_example_match':
      return 'example';
    case 'component_match':
      return 'components';
    case 'ai_suggestion':
      return 'AI';
    case 'not_found':
      return 'not found';
    case 'not_checked':
      return 'not checked';
    case 'error':
      return 'error';
    default:
      return 'source';
  }
}

function shouldShowEvidenceLabel(label?: string | null) {
  if (!label) return false;

  const value = String(label).trim();
  if (!value) return false;

  const technicalMarkers = [
    'registered entry found',
    'component evidence',
    'components:',
    'exact normative reference found',
    'search endpoint',
    'direct lemma endpoint',
    'registered entry:',
    'HTML:',
    'API:',
    'v2.',
    'HTTP',
    'crosscheck',
    'limit=',
    'errors:',
    'error:',
  ];

  return !technicalMarkers.some((marker) =>
    value.toLowerCase().includes(marker.toLowerCase())
  );
}

function EvidenceRow({
  source,
  item,
  lang,
}: {
  source: string;
  item: SourceEvidence;
  lang: SafeLanguage;
}) {
  const quality = (item.quality || 'not_checked') as EvidenceQuality;
  const qi = QUALITY_ICONS[String(quality)] ?? { icon: '○', strong: false };
  const sourceLabel = getSourceLabel(source, lang);
  const safeEvidenceLabel = shouldShowEvidenceLabel(item.evidence_label)
    ? sanitizeEvidenceLabel(item.evidence_label)
    : '';
  const explanation = getQualityExplanation(item, quality, lang);
  const statusStyle = getQualityStatusStyle(quality, item);

  return (
    <View style={styles.evidenceRow}>
      <View style={styles.evidenceLeft}>
        <Text style={styles.evidenceIcon}>{qi.icon}</Text>

        <View style={styles.evidenceText}>
          <View style={styles.evidenceTopLine}>
            <Text style={styles.evidenceSource}>{sourceLabel}</Text>

            <View
              style={[
                styles.qualityBadge,
                statusStyle === 'strong' && styles.qualityBadgeStrong,
                statusStyle === 'medium' && styles.qualityBadgeMedium,
                statusStyle === 'component' && styles.qualityBadgeComponent,
                statusStyle === 'weak' && styles.qualityBadgeWeak,
              ]}
            >
              <Text
                style={[
                  styles.qualityBadgeText,
                  statusStyle === 'strong' && styles.qualityBadgeTextStrong,
                  statusStyle === 'medium' && styles.qualityBadgeTextMedium,
                  statusStyle === 'component' && styles.qualityBadgeTextComponent,
                  statusStyle === 'weak' && styles.qualityBadgeTextWeak,
                ]}
              >
                {getShortQualityBadgeLabel(quality, lang)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.evidenceQuality,
              qi.strong && styles.evidenceQualityStrong,
            ]}
          >
            {getQualityLabel(quality, lang)}
          </Text>

          <Text style={styles.evidenceExplanation}>{explanation}</Text>

          {safeEvidenceLabel ? (
            <Text style={styles.evidenceLabel}>{safeEvidenceLabel}</Text>
          ) : null}

          {item.error ? (
            <Text style={styles.evidenceError} numberOfLines={2}>
              {String(item.error)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function VerificationBadge({
  tier,
  sourceVerified,
  evidence,
  lemma,
  size = 'md',
  lang = 'ua',
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const safeLang = normalizeLang(lang);

  const verification = resolveVerification(
    {
      tier,
      sourceVerified,
      evidence,
      verification_tier: tier,
      source_verified: sourceVerified,
      verification_evidence: evidence,
    },
    safeLang
  );

  // ФИКС: раньше badge был просто цветной точкой 10px (size='sm') почти
  // без отступов (paddingHorizontal: 0 для badgeSm) — реальная область
  // нажатия была едва больше самой точки, из-за чего требовалось попадать
  // несколько раз подряд. Теперь вместо голой точки — иконка (тот же
  // emoji-стиль, что уже используется в QUALITY_ICONS этого файла и в
  // триггере Lexeme360, не новая библиотека), в цветном полупрозрачном
  // круге — цвет сохраняет мгновенное считывание уровня verification,
  // иконка даёт форму, которую легче видеть и легче попасть пальцем.
  // hitSlop расширяет тач-таргет до Apple HIG-минимума (44×44), не меняя
  // визуальный размер самого бейджа.
  const iconSize = size === 'sm' ? 26 : 32;

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.badge}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`${tr('accessibilityPrefix', safeLang)}: ${verification.label}. ${tr('accessibilitySuffix', safeLang)}`}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconCircle,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              backgroundColor: `${verification.dot}26`,
              borderColor: `${verification.dot}55`,
            },
          ]}
        >
          <Text style={{ fontSize: iconSize * 0.5, color: verification.dot }}>
            💡
          </Text>
        </View>

        {size === 'md' ? (
          <Text style={[styles.badgeLabel, { color: verification.color }]}>
            {verification.label}
          </Text>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.popup} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.popupHeader, { backgroundColor: verification.bg }]}>
              <Stars count={verification.stars} color={verification.color} />

              <Text style={[styles.popupTier, { color: verification.color }]}>
                {verification.label}
              </Text>

              {lemma ? <Text style={styles.popupLemma}>«{lemma}»</Text> : null}
            </View>

            <ScrollView
              style={styles.popupBody}
              contentContainerStyle={styles.popupBodyContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.popupDescription}>
                {verification.description}
              </Text>

              {verification.foundSources.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {tr('confirmed_by', safeLang)}
                  </Text>

                  {verification.foundSources.map(([source, item]) => (
                    <EvidenceRow
                      key={source}
                      source={source}
                      item={item}
                      lang={safeLang}
                    />
                  ))}
                </>
              ) : (
                <Text style={styles.noEvidence}>
                  {tr('no_evidence', safeLang)}
                </Text>
              )}

              {verification.sourceVerified ? (
                <View style={styles.verifiedSummary}>
                  <Text style={styles.verifiedLabel}>
                    {tr('registered_in', safeLang)}
                  </Text>

                  <Text style={styles.verifiedValue}>
                    {verification.sourceVerified}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>{tr('close', safeLang)}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  star: {
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  popup: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '86%',
    flexShrink: 1,
  },
  popupHeader: {
    padding: 20,
    paddingBottom: 16,
  },
  popupTier: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  popupLemma: {
    fontSize: 13,
    color: '#888780',
    fontStyle: 'italic',
    marginTop: 2,
  },
  popupBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  popupBodyContent: {
    padding: 16,
    paddingBottom: 24,
  },
  popupDescription: {
    fontSize: 14,
    color: '#444441',
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888780',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  evidenceRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
  },
  evidenceLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  evidenceIcon: {
    fontSize: 17,
    width: 22,
    textAlign: 'center',
    marginTop: 1,
  },
  evidenceText: {
    flex: 1,
    minWidth: 0,
  },
  evidenceTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  evidenceSource: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#2C2C2A',
  },
  qualityBadge: {
    maxWidth: 118,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  qualityBadgeStrong: {
    backgroundColor: '#E1F5EE',
  },
  qualityBadgeMedium: {
    backgroundColor: '#E0F2FE',
  },
  qualityBadgeComponent: {
    backgroundColor: '#F1EFE8',
  },
  qualityBadgeWeak: {
    backgroundColor: '#FEE2E2',
  },
  qualityBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    color: '#6B7280',
    textAlign: 'center',
  },
  qualityBadgeTextStrong: {
    color: '#0F6E56',
  },
  qualityBadgeTextMedium: {
    color: '#185FA5',
  },
  qualityBadgeTextComponent: {
    color: '#888780',
  },
  qualityBadgeTextWeak: {
    color: '#991B1B',
  },
  evidenceQuality: {
    fontSize: 12,
    lineHeight: 17,
    color: '#888780',
    marginTop: 2,
  },
  evidenceQualityStrong: {
    color: '#0F6E56',
    fontWeight: '700',
  },
  evidenceExplanation: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
    marginTop: 2,
  },
  evidenceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 15,
  },
  evidenceError: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 3,
    lineHeight: 14,
  },
  noEvidence: {
    fontSize: 13,
    color: '#888780',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  verifiedSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#D3D1C7',
  },
  verifiedLabel: {
    fontSize: 12,
    color: '#888780',
  },
  verifiedValue: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#185FA5',
    flexShrink: 1,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  closeBtn: {
    margin: 12,
    marginTop: 4,
    padding: 14,
    backgroundColor: '#F1EFE8',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444441',
  },
});
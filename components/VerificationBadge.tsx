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
    confirmed_by: 'ПІДТВЕРДЖЕНО ДЖЕРЕЛАМИ',
    registered_in: 'Зареєстровано в',
    registered: 'зареєстровано',
    close: 'Закрити',
    no_evidence: 'Авторитетні джерела поки не підтвердили цей вираз.',
    ai_analysis: 'AI-аналіз',
  },
  en: {
    accessibilityPrefix: 'Verification',
    accessibilitySuffix: 'Tap for details.',
    confirmed_by: 'CONFIRMED BY',
    registered_in: 'Registered in',
    registered: 'registered',
    close: 'Close',
    no_evidence: 'No authoritative sources confirmed this expression yet.',
    ai_analysis: 'AI analysis',
  },
  no: {
    accessibilityPrefix: 'Verifisering',
    accessibilitySuffix: 'Trykk for detaljer.',
    confirmed_by: 'BEKREFTET AV',
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
  const safeEvidenceLabel = sanitizeEvidenceLabel(item.evidence_label);

  return (
    <View style={styles.evidenceRow}>
      <View style={styles.evidenceLeft}>
        <Text style={styles.evidenceIcon}>{qi.icon}</Text>

        <View style={styles.evidenceText}>
          <Text style={styles.evidenceSource}>{sourceLabel}</Text>

          <Text
            style={[
              styles.evidenceQuality,
              qi.strong && styles.evidenceQualityStrong,
            ]}
          >
            {getQualityLabel(quality, lang)}
          </Text>

          {safeEvidenceLabel ? (
            <Text style={styles.evidenceLabel}>{safeEvidenceLabel}</Text>
          ) : null}
        </View>
      </View>

      {item.registered_entry ? (
        <View style={styles.registeredBadge}>
          <Text style={styles.registeredText}>{tr('registered', lang)}</Text>
        </View>
      ) : null}
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

  const dotSize = size === 'sm' ? 10 : 13;

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={[styles.badge, size === 'sm' && styles.badgeSm]}
        accessibilityLabel={`${tr('accessibilityPrefix', safeLang)}: ${verification.label}. ${tr('accessibilitySuffix', safeLang)}`}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              backgroundColor: verification.dot,
              shadowColor: verification.dot,
              shadowOpacity: 0.5,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
          ]}
        />

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
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  badgeSm: {
    paddingHorizontal: 0,
  },
  dot: {
    borderRadius: 99,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
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
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '82%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
  },
  evidenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  evidenceIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  evidenceText: {
    flex: 1,
  },
  evidenceSource: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  evidenceQuality: {
    fontSize: 12,
    color: '#888780',
    marginTop: 1,
  },
  evidenceQualityStrong: {
    color: '#0F6E56',
    fontWeight: '500',
  },
  evidenceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 15,
  },
  registeredBadge: {
    backgroundColor: '#E1F5EE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 8,
  },
  registeredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F6E56',
    letterSpacing: 0.3,
  },
  noEvidence: {
    fontSize: 13,
    color: '#888780',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  verifiedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontWeight: '600',
    color: '#185FA5',
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
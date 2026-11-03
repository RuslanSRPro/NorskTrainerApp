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
  VerificationEvidence,
  VerificationTier,
} from '@/services/verification';

import {
  resolveVerification,
} from '@/services/verification';

import type { AppLanguage } from '@/services/i18n';
import { useServerRating, type ServerRatingDetail } from '@/services/serverStars';
// D10 27.10.2026 (agreed): the dictionary definition at the top of the popup
import { useDefinitionHint } from '@/services/definitionHint';
import { CardHelpContext } from '@/components/CardHelpContext';

type Props = {
  tier?: VerificationTier | string | null;
  sourceVerified?: string | string[] | null;
  evidence?: VerificationEvidence | null;
  lemma?: string;
  size?: 'sm' | 'md';
  lang?: AppLanguage | string | null;
  // D10 16.10.2026: id of the lexeme / expression; its stars come from the server.
  entityId?: string | null;
};

// ── D10 16.10.2026: server rating explained (grey card, POS per source) ─────
const RATING_UI = {
  ua: {
    grey_title: 'Сіра картка',
    grey_word: 'Слово є в базі й у навчанні, але словники ще не підтвердили його для цієї частини мови. Рівень підніметься, коли під час нової перевірки знайдеться стаття.',
    grey_expr: 'Вираз є в базі й у навчанні, але словники ще не підтвердили його як цілісний вираз. Рівень підніметься, коли під час нової перевірки знайдеться стаття.',
    unchecked_title: 'Ще не перевірено',
    unchecked_body: 'Цю картку ще не перевіряли за словниками. Зірки з’являться після перевірки.',
    no_ordbokene: 'Немає в навчальному словнику Ordbøkene — підтверджено іншими словниками.',
    by_source: 'ЩО ДАЛО КОЖНЕ ДЖЕРЕЛО',
    pos: 'Частина мови картки',
    article: 'стаття цієї частини мови',
    article_expr: 'стаття виразу',
    article_pos_unknown: 'стаття, частину мови не підтверджено',
    entry: 'запис цієї частини мови',
    entry_expr: 'запис виразу',
    other_pos: 'є лише як інша частина мови — не враховано',
    mention: 'лише згадка',
    mention_sprak: 'згадка (дає не більше 2★)',
    none: 'немає',
  },
  en: {
    grey_title: 'Grey card',
    grey_word: 'The word is in the base and in training, but dictionaries have not yet confirmed it for this part of speech. The level rises when a new check finds an article.',
    grey_expr: 'The expression is in the base and in training, but dictionaries have not yet confirmed it as a whole expression. The level rises when a new check finds an article.',
    unchecked_title: 'Not checked yet',
    unchecked_body: 'This card has not been checked against dictionaries yet. Stars appear after the check.',
    no_ordbokene: 'Not in the Ordbøkene learner dictionary — confirmed by other dictionaries.',
    by_source: 'WHAT EACH SOURCE GAVE',
    pos: 'Card part of speech',
    article: 'article for this part of speech',
    article_expr: 'expression article',
    article_pos_unknown: 'article, part of speech not confirmed',
    entry: 'entry for this part of speech',
    entry_expr: 'expression entry',
    other_pos: 'only as another part of speech — not counted',
    mention: 'mention only',
    mention_sprak: 'mention (gives at most 2★)',
    none: 'none',
  },
  no: {
    grey_title: 'Grått kort',
    grey_word: 'Ordet finnes i basen og i treningen, men ordbøkene har ennå ikke bekreftet det for denne ordklassen. Nivået stiger når en ny sjekk finner en artikkel.',
    grey_expr: 'Uttrykket finnes i basen og i treningen, men ordbøkene har ennå ikke bekreftet det som et helt uttrykk. Nivået stiger når en ny sjekk finner en artikkel.',
    unchecked_title: 'Ikke sjekket ennå',
    unchecked_body: 'Dette kortet er ikke sjekket mot ordbøker ennå. Stjernene kommer etter sjekken.',
    no_ordbokene: 'Ikke i læringsordboka Ordbøkene — bekreftet av andre ordbøker.',
    by_source: 'HVA HVER KILDE GA',
    pos: 'Kortets ordklasse',
    article: 'artikkel for denne ordklassen',
    article_expr: 'artikkel for uttrykket',
    article_pos_unknown: 'artikkel, ordklasse ikke bekreftet',
    entry: 'oppslag for denne ordklassen',
    entry_expr: 'oppslag for uttrykket',
    other_pos: 'bare som en annen ordklasse — ikke talt med',
    mention: 'bare omtale',
    mention_sprak: 'omtale (gir høyst 2★)',
    none: 'ingen',
  },
} as const;

const POS_NAMES: Record<string, Record<'ua' | 'en' | 'no', string>> = {
  noun: { ua: 'іменник', en: 'noun', no: 'substantiv' },
  verb: { ua: 'дієслово', en: 'verb', no: 'verb' },
  adjective: { ua: 'прикметник', en: 'adjective', no: 'adjektiv' },
  adverb: { ua: 'прислівник', en: 'adverb', no: 'adverb' },
  preposition: { ua: 'прийменник', en: 'preposition', no: 'preposisjon' },
  pronoun: { ua: 'займенник', en: 'pronoun', no: 'pronomen' },
  conjunction: { ua: 'сполучник', en: 'conjunction', no: 'konjunksjon' },
  subjunction: { ua: 'підрядний сполучник', en: 'subjunction', no: 'subjunksjon' },
  interjection: { ua: 'вигук', en: 'interjection', no: 'interjeksjon' },
  determiner: { ua: 'детермінатив', en: 'determiner', no: 'determinativ' },
  numeral: { ua: 'числівник', en: 'numeral', no: 'tallord' },
  proper_noun: { ua: 'власна назва', en: 'proper noun', no: 'egennavn' },
};

const RATING_SOURCES: Array<[keyof ServerRatingDetail, string]> = [
  ['ordbokene', 'Ordbokene'],
  ['naob', 'NAOB'],
  ['lexin', 'Lexin'],
  ['wiktionary', 'Wiktionary'],
  ['sprakradet', 'Språkrådet'],
];

// D10 16.10.2026 (agreed): level names and descriptions by server stars.
const STAR_LEVELS: Record<'ua' | 'en' | 'no', Record<number, { title: string; desc: string }>> = {
  ua: {
    5: { title: 'Навчальний словник', desc: 'Є стаття в Ordbøkene для цієї частини мови.' },
    4: { title: 'Два словники', desc: 'Стаття NAOB і запис у Lexin або Wiktionary для цієї частини мови.' },
    3: { title: 'Один словник', desc: 'Підтверджує один словник (NAOB, Lexin або Wiktionary) для цієї частини мови.' },
    2: { title: 'Згадка', desc: 'Лише згадки у словниках, окремого запису для цієї частини мови немає.' },
    1: { title: 'Не підтверджено', desc: 'Словники не підтвердили слово (переклад від ШІ) або перевірки ще не було.' },
  },
  en: {
    5: { title: 'Learner dictionary', desc: 'Ordbøkene has an article for this part of speech.' },
    4: { title: 'Two dictionaries', desc: 'A NAOB article and a Lexin or Wiktionary entry for this part of speech.' },
    3: { title: 'One dictionary', desc: 'One dictionary (NAOB, Lexin or Wiktionary) confirms this part of speech.' },
    2: { title: 'Mention', desc: 'Only mentions in dictionaries, no entry for this part of speech.' },
    1: { title: 'Not confirmed', desc: 'Not confirmed by dictionaries (AI translation) or not checked yet.' },
  },
  no: {
    5: { title: 'Læringsordbok', desc: 'Ordbøkene har en artikkel for denne ordklassen.' },
    4: { title: 'To ordbøker', desc: 'En NAOB-artikkel og et oppslag i Lexin eller Wiktionary for denne ordklassen.' },
    3: { title: 'Én ordbok', desc: 'Én ordbok (NAOB, Lexin eller Wiktionary) bekrefter denne ordklassen.' },
    2: { title: 'Omtale', desc: 'Bare omtaler i ordbøker, ikke noe oppslag for denne ordklassen.' },
    1: { title: 'Ikke bekreftet', desc: 'Ikke bekreftet av ordbøker (AI-oversettelse) eller ikke sjekket ennå.' },
  },
};

// D10 27.10.2026 (agreed): definition block of the popup
const DEFINITION_UI = {
  ua: { title: 'Тлумачення', norwegian: 'норвезькою' },
  en: { title: 'Definition', norwegian: 'in Norwegian' },
  no: { title: 'Forklaring', norwegian: '' },
} as const;

const DETAIL_UI = {
  ua: { article_no: 'стаття', only_as: 'лише як', details: 'Подробиці', hide: 'Сховати подробиці' },
  en: { article_no: 'article', only_as: 'only as', details: 'Details', hide: 'Hide details' },
  no: { article_no: 'artikkel', only_as: 'bare som', details: 'Detaljer', hide: 'Skjul detaljer' },
} as const;

function posNames(list: unknown, lang: 'ua' | 'en' | 'no'): string {
  return (Array.isArray(list) ? list : [])
    .map((p) => POS_NAMES[String(p).toLowerCase().split('_')[0]]?.[lang] ?? String(p))
    .filter(Boolean).join(', ');
}

// Extra detail of one source row, from the stored evidence: Ordbøkene article
// numbers, the parts of speech a source shows when it is not the card's.
function ratingDetail(source: string, value: string | undefined, evidence: any, lang: 'ua' | 'en' | 'no'): string {
  const item = evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence[source] : null;
  const ev = item?.evidence ?? {};
  const d = DETAIL_UI[lang];
  if (source === 'Ordbokene' && (value === 'article' || value === 'article_pos_unknown')) {
    const ids = Array.isArray(ev?.raw_preview?.article_ids) ? ev.raw_preview.article_ids.map(String) : [];
    return ids.length ? `${d.article_no} ${ids.join(', ')}` : '';
  }
  if (value === 'other_pos') {
    const names = posNames(ev?.found_pos ?? (ev?.raw_preview?.pos ? [ev.raw_preview.pos] : []), lang);
    return names ? `${d.only_as}: ${names}` : '';
  }
  return '';
}

function ratingStateLabel(key: string, value: string | undefined, isExpression: boolean, lang: 'ua' | 'en' | 'no'): string {
  const t = RATING_UI[lang];
  const v = value || 'none';
  if (key === 'sprakradet') return v === 'mention' ? t.mention_sprak : t.none;
  if (v === 'article') return isExpression ? t.article_expr : t.article;
  if (v === 'entry') return isExpression ? t.entry_expr : t.entry;
  if (v === 'article_pos_unknown') return t.article_pos_unknown;
  if (v === 'other_pos') return t.other_pos;
  if (v === 'mention') return t.mention;
  return t.none;
}

function ServerRatingBlock({ stars, rating, lang, evidence }: { stars: number; rating: ServerRatingDetail; lang: 'ua' | 'en' | 'no'; evidence?: unknown }) {
  const t = RATING_UI[lang];
  const isExpression = rating.kind === 'expression';
  const unchecked = rating.basis === 'no_evidence';
  const posName = rating.card_pos ? (POS_NAMES[rating.card_pos]?.[lang] ?? rating.card_pos) : null;
  return (
    <View style={styles.ratingBlock}>
      {unchecked ? (
        <View style={styles.greyBox}>
          <Text style={styles.greyTitle}>{t.unchecked_title}</Text>
          <Text style={styles.greyText}>{t.unchecked_body}</Text>
        </View>
      ) : stars <= 2 ? (
        <View style={styles.greyBox}>
          <Text style={styles.greyTitle}>{t.grey_title}</Text>
          <Text style={styles.greyText}>{isExpression ? t.grey_expr : t.grey_word}</Text>
        </View>
      ) : null}

      {rating.note === 'no_ordbokene_article' ? (
        <Text style={styles.ratingNote}>{t.no_ordbokene}</Text>
      ) : null}

      {!unchecked ? (
        <>
          <Text style={styles.sectionTitle}>{t.by_source}</Text>
          {posName && !isExpression ? (
            <Text style={styles.ratingPos}>{`${t.pos}: ${posName}`}</Text>
          ) : null}
          {RATING_SOURCES.map(([key, source]) => {
            const value = rating[key] as string | undefined;
            const counted = value === 'article' || value === 'entry';
            const detail = ratingDetail(source, value, evidence, lang);
            return (
              <View key={source} style={styles.ratingRow}>
                <Text style={styles.ratingSource}>{getSourceLabel(source, lang)}</Text>
                <View style={styles.ratingStateBox}>
                  <Text style={[styles.ratingState, counted && styles.ratingStateCounted]}>
                    {ratingStateLabel(String(key), value, isExpression, lang)}
                  </Text>
                  {detail ? <Text style={styles.ratingDetail}>{detail}</Text> : null}
                </View>
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

// ── Local UI strings not owned by verification resolver ───────────────────────
const UI = {
  ua: {
    accessibilityPrefix: 'Верифікація',
    accessibilitySuffix: 'Натисни, щоб переглянути деталі.',
    confirmed_by: 'ДЖЕРЕЛА ТА РІВЕНЬ ПІДТВЕРДЖЕННЯ',
    registered_in: 'Джерела підтвердження',
    registered: 'зареєстровано',
    close: 'Закрити',
    no_evidence: 'Авторитетні джерела поки не підтвердили цей вираз.',
    ai_analysis: 'AI-аналіз',
  },
  en: {
    accessibilityPrefix: 'Verification',
    accessibilitySuffix: 'Tap for details.',
    confirmed_by: 'SOURCES AND VERIFICATION LEVEL',
    registered_in: 'Sources with evidence',
    registered: 'registered',
    close: 'Close',
    no_evidence: 'No authoritative sources confirmed this expression yet.',
    ai_analysis: 'AI analysis',
  },
  no: {
    accessibilityPrefix: 'Verifisering',
    accessibilitySuffix: 'Trykk for detaljer.',
    confirmed_by: 'KILDER OG BEKREFTELSESNIVÅ',
    registered_in: 'Kilder med belegg',
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


export function VerificationBadge({
  tier,
  sourceVerified,
  evidence,
  lemma,
  size = 'md',
  lang = 'ua',
  entityId = null,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const safeLang = normalizeLang(lang);
  const server = useServerRating(entityId);
  // loaded only once the popup is opened (the list stays as fast as before)
  const definition = useDefinitionHint(entityId, safeLang, modalVisible);
  const starLevel = server ? STAR_LEVELS[safeLang][server.stars] : undefined;

  const verification = resolveVerification(
    {
      tier,
      sourceVerified,
      evidence,
      verification_tier: tier,
      source_verified: sourceVerified,
      verification_evidence: evidence,
      server_stars: server?.stars ?? null,
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
        {/* D10 16.10.2026: scrolling fix - the popup is a View, not a Pressable; a tap outside closes */}
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.popup}>
            <View style={[styles.popupHeader, { backgroundColor: verification.bg }]}>
              <Stars count={verification.stars} color={verification.color} />

              <Text style={[styles.popupTier, { color: verification.color }]}>
                {starLevel?.title ?? verification.label}
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
              {definition ? (
                <View style={styles.definitionBox}>
                  <Text style={styles.sectionTitle}>
                    {DEFINITION_UI[safeLang].title}
                    {definition.isFallback && DEFINITION_UI[safeLang].norwegian ? ` · ${DEFINITION_UI[safeLang].norwegian}` : ''}
                  </Text>
                  {definition.items.map((item, index) => (
                    <Text key={`${index}-${item}`} style={styles.definitionItem}>
                      {definition.items.length > 1 ? `• ${item}` : item}
                    </Text>
                  ))}
                </View>
              ) : null}

              <CardHelpContext entityId={entityId} lang={safeLang} enabled={modalVisible} styles={styles} />
              <Text style={styles.popupDescription}>
                {starLevel?.desc ?? verification.description}
              </Text>

              {server ? (
                <ServerRatingBlock stars={server.stars} rating={server.rating} lang={safeLang} evidence={evidence} />
              ) : null}

            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>{tr('close', safeLang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  definitionBox: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
  },
  definitionItem: {
    fontSize: 15,
    color: '#2C2C2A',
    lineHeight: 21,
    marginBottom: 4,
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
  ratingBlock: {
    marginBottom: 14,
  },
  greyBox: {
    backgroundColor: '#F1EFE8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  greyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5F5E5A',
    marginBottom: 4,
  },
  greyText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#5F5E5A',
  },
  ratingNote: {
    fontSize: 12,
    lineHeight: 17,
    color: '#185FA5',
    marginBottom: 12,
  },
  ratingPos: {
    fontSize: 12,
    color: '#444441',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  ratingSource: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  ratingStateBox: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  ratingState: {
    flexShrink: 1,
    fontSize: 12,
    color: '#888780',
    textAlign: 'right',
  },
  ratingDetail: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 1,
  },
  detailsToggle: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#185FA5',
  },
  ratingStateCounted: {
    color: '#0F6E56',
    fontWeight: '600',
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

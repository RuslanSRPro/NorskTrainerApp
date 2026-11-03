// Synonym popup: source sense AND class filters; canonical card translations are never written.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { filterSynonyms, SYNONYM_TEXT, sourceMeaningsTitle } from '@/services/synonymPresentation';
import type { AppLanguage } from '@/services/i18n';
import { Lexeme360Carousel } from '@/components/Lexeme360Carousel';
import {
  fetchSynonymSenseCarousel,
  senseLabel,
  type SynonymCarouselItem,
  type SynonymSense,
} from '@/services/synonymCarousel';
import { addLexemeToLearningFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';

export type SynonymEntry = {
  text: string;
  resolved: boolean;
  target_entity_type?: 'lexeme' | 'expression' | null;
  target_entity_id?: string | null;
  confidence?: string | null;
  source?: string | null;
  decision?: string | null;
};

type Props = {
  synonyms?: SynonymEntry[] | null;
  lemma?: string;
  size?: 'sm' | 'md';
  lang?: AppLanguage | string | null;
  // D10 stage D: the card whose synonyms are shown; enables the 360-style carousel.
  lexemeId?: string | null;
  onSelectSynonym?: (entityId: string, entityType: 'lexeme' | 'expression') => void;
};

const UI = {
  ua: {
    title: 'Синоніми',
    accessibilityPrefix: 'Синоніми',
    accessibilitySuffix: 'Натисни, щоб переглянути.',
    close: 'Закрити',
    candidate_badge: 'КАНДИДАТ',
    resolved_badge: 'СИНОНІМ',
    contextual_badge: 'СИНОНІМ У КОНТЕКСТІ',
    loading: 'Завантаження…',
    candidate_note: 'Ще не пов’язано з карткою в базі — точний збіг не знайдено.',
    open: 'Відкрити',
  },
  en: {
    title: 'Synonyms',
    accessibilityPrefix: 'Synonyms',
    accessibilitySuffix: 'Tap to view.',
    close: 'Close',
    candidate_badge: 'CANDIDATE',
    resolved_badge: 'SYNONYM',
    contextual_badge: 'SYNONYM IN CONTEXT',
    loading: 'Loading…',
    candidate_note: 'Not yet linked to a card in the database — no exact match found.',
    open: 'Open',
  },
  no: {
    title: 'Synonymer',
    accessibilityPrefix: 'Synonymer',
    accessibilitySuffix: 'Trykk for å se.',
    close: 'Lukk',
    candidate_badge: 'KANDIDAT',
    resolved_badge: 'SYNONYM',
    contextual_badge: 'SYNONYM I KONTEKST',
    loading: 'Laster…',
    candidate_note: 'Ikke koblet til et kort i databasen ennå — ingen eksakt match funnet.',
    open: 'Åpne',
  },
} as const;

type SafeLanguage = keyof typeof UI;

function normalizeLang(lang?: AppLanguage | string | null): SafeLanguage {
  return lang === 'ua' || lang === 'no' || lang === 'en' ? lang : 'ua';
}

function tr(key: keyof typeof UI.en, lang?: AppLanguage | string | null): string {
  const safeLang = normalizeLang(lang);
  return UI[safeLang][key] || UI.en[key] || key;
}

const ACCENT = '#7C5CFC';
const CARD_WIDTH = Math.min(Dimensions.get('window').width - 88, 280);

export function SynonymsBadge(props: Props) {
  return <SynonymsBadgeContent key={`${props.lexemeId ?? props.lemma}:${props.lang}`} {...props} />;
}

function SynonymsBadgeContent({
  synonyms,
  lemma,
  size = 'sm',
  lang = 'ua',
  lexemeId,
  onSelectSynonym,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const safeLang = normalizeLang(lang);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { preferred_user } = useSettingsStore();
  // D10 stage D: 360-style carousel data (loaded when the window opens)
  const [items, setItems] = useState<SynonymCarouselItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  // D10 point 5: senses of the word, the sense of the card in view, scroll requests
  const [senses, setSenses] = useState<SynonymSense[]>([]);
  const [wordTr, setWordTr] = useState<{ uk: string; en: string } | null>(null);
  const [selectedSense, setSelectedSense] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  // Reserve room for the card and its fixed controls before allocating space to meanings.
  const sensePanelHeight = Math.max(64, Math.min(136,
    (bodyHeight || window.height * 0.6) - 300 * Math.min(window.fontScale, 1.3) - 84));
  const labels = SYNONYM_TEXT[safeLang];

  const list = Array.isArray(synonyms) ? synonyms.filter((item) => item?.text && item.resolved && item.decision === 'verified_synonym') : [];

  // Іконка з'являється тільки якщо реально є дані — сама видимість це
  // сигнал, а не декоративний елемент.
  if (list.length === 0) return null;

  const iconSize = size === 'sm' ? 26 : 32;

  function handleScrollEnd(event: any) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + 12));
    setActiveIndex(Math.max(0, Math.min(index, list.length - 1)));
  }

  function openModal() {
    setActiveIndex(0);
    setModalVisible(true);
    if (lexemeId && !loading) {
      setLoading(true);
      setLoadError(false);
      fetchSynonymSenseCarousel(lexemeId, lemma, safeLang)
        .then((result) => {
          setItems(result.items);
          setSenses(result.senses);
          setWordTr(result.word ?? null);
        })
        .catch((error) => {
          console.error('Synonyms carousel load failed:', error);
          setItems(null);
          setSenses([]);
          setLoadError(true);
        })
        .finally(() => setLoading(false));
    }
  }

  async function addToLearning(id: string) {
    if (!id || addingId || learnedIds.has(id)) return;
    setAddingId(id);
    try {
      await addLexemeToLearningFromSupabase({ preferred_user, lexemeId: id });
      setLearnedIds((prev) => new Set(prev).add(id));
    } catch (err) {
      console.error('Synonyms add to learning error:', err);
    } finally {
      setAddingId(null);
    }
  }

  const carouselItems = filterSynonyms(items ?? [], selectedSense, ['strict'])
    .map(item => ({ ...item, learned: Boolean(item.learned || learnedIds.has(item.cardId ?? item.id)) }));
  const showCarousel360 = Boolean(lexemeId);

  function showSense(key: string) {
    setSelectedSense(current => current === key ? null : key);
  }

  return (
    <>
      <TouchableOpacity
        onPress={openModal}
        style={styles.badge}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`${tr('accessibilityPrefix', safeLang)}. ${tr('accessibilitySuffix', safeLang)}`}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconCircle,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              backgroundColor: `${ACCENT}26`,
              borderColor: `${ACCENT}55`,
            },
          ]}
        >
          <Ionicons name="swap-horizontal" size={Math.round(iconSize * 0.6)} color={ACCENT} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheet, { height: Math.max(1, window.height - insets.top - Math.max(insets.bottom, 12) - 16), maxHeight: '100%' }]} onPress={(event) => event.stopPropagation()}>
            <GlassOverlay material="overlay" shape="sheet" radius={24} />
            <ScrollView style={{ maxHeight: window.height * 0.16, flexGrow: 0 }} nestedScrollEnabled>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: ACCENT }]}>{tr('title', safeLang)}</Text>
                {lemma ? <Text style={styles.lemma}>«{lemma}»</Text> : null}
                {wordTr && (wordTr.uk || wordTr.en) ? (
                  <Text style={styles.wordTr} numberOfLines={2}>
                    {[wordTr.uk, wordTr.en].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>

              {showCarousel360 ? null : (
              <Text style={styles.counter}>
                {activeIndex + 1} / {list.length}
              </Text>
              )}
            </View>

            </ScrollView>
            {showCarousel360 ? (
              loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={styles.loadingText}>{tr('loading', safeLang)}</Text>
                </View>
              ) : (
                <View style={styles.carousel360} onLayout={({ nativeEvent: { layout } }) => setBodyHeight(layout.height)}>
                  <ScrollView style={{ maxHeight: sensePanelHeight, flexGrow: 0, marginBottom: 8 }}
                    nestedScrollEnabled showsVerticalScrollIndicator bounces={false}>
                  <Text style={styles.loadingText}>{sourceMeaningsTitle(lemma || '',safeLang)}</Text>
                  {senses.length > 0 ? <Pressable onPress={() => setSelectedSense(null)} accessibilityRole="button">
                    <Text style={{ color: ACCENT, padding: 8 }}>{selectedSense ? labels.all : `✓ ${labels.all}`}</Text>
                  </Pressable> : null}
                  {senses.length > 0 ? (
                    <View style={{ marginHorizontal: 12, marginBottom: 10 }}>
                      {senses.map((sense) => {
                        const active = selectedSense === sense.key;
                        return (
                          <Pressable
                            key={sense.key}
                            style={[styles.senseRow, active && styles.senseRowActive]}
                            onPress={() => showSense(sense.key)}
                          >
                            {senses.length > 1 ? (
                              <Text style={[styles.senseNo, active && styles.senseNoActive]}>{senseLabel(sense)}</Text>
                            ) : null}
                            <View style={styles.senseBody}>
                              {sense.uk ? (
                                <Text style={[styles.senseUk, active && styles.senseUkActive]} numberOfLines={1}>
                                  {sense.uk}{sense.en ? ` · ${sense.en}` : ''}
                                </Text>
                              ) : null}
                              <Text style={styles.senseText} numberOfLines={2}>{sense.text}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  </ScrollView>
                  {loadError ? (
                    <Pressable onPress={openModal} accessibilityRole="button">
                      <Text style={styles.loadingText}>{safeLang === 'ua' ? 'Не вдалося завантажити. Натисни, щоб повторити.' : safeLang === 'no' ? 'Kunne ikke laste. Trykk for å prøve igjen.' : 'Could not load. Tap to retry.'}</Text>
                    </Pressable>
                  ) : carouselItems.length === 0 ? (
                    <Text style={{ color: '#6B7280', padding: 24 }}>{labels.empty}</Text>
                  ) : <Lexeme360Carousel
                    key={`${lexemeId}:${selectedSense ?? 'all'}`}
                    fillAvailable
                    pinActions
                    compactFooter
                    items={carouselItems}
                    lang={safeLang as AppLanguage}
                    title={tr('title', safeLang)}
                    onSelect={onSelectSynonym ? (id) => {
                      setModalVisible(false);
                      onSelectSynonym(id, 'lexeme');
                    } : undefined}
                    onAdd={addToLearning}
                  />}

                </View>
              )
            ) : (
            <>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled={false}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScrollEnd}
              contentContainerStyle={styles.carouselContent}
            >
              {list.map((item, index) => {
                const isTappable =
                  item.resolved && item.target_entity_id && item.target_entity_type && onSelectSynonym;

                const CardWrapper = isTappable ? TouchableOpacity : View;

                return (
                  <CardWrapper
                    key={`${item.text}-${index}`}
                    style={[
                      styles.card,
                      { width: CARD_WIDTH },
                      item.resolved ? styles.cardResolved : styles.cardCandidate,
                    ]}
                    activeOpacity={isTappable ? 0.75 : 1}
                    onPress={
                      isTappable
                        ? () => {
                            setModalVisible(false);
                            onSelectSynonym!(item.target_entity_id!, item.target_entity_type!);
                          }
                        : undefined
                    }
                  >
                    <View
                      style={[
                        styles.cardBadge,
                        item.resolved ? styles.cardBadgeResolved : styles.cardBadgeCandidate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardBadgeText,
                          item.resolved ? styles.cardBadgeTextResolved : styles.cardBadgeTextCandidate,
                        ]}
                      >
                        {item.resolved
                          ? item.decision === 'contextual_synonym' ? tr('contextual_badge', safeLang) : tr('resolved_badge', safeLang)
                          : tr('candidate_badge', safeLang)}
                      </Text>
                    </View>

                    <Text style={styles.cardWord}>{item.text}</Text>

                    {!item.resolved ? (
                      <Text style={styles.cardCandidateNote}>{tr('candidate_note', safeLang)}</Text>
                    ) : null}

                    {isTappable ? (
                      <View style={styles.cardOpenRow}>
                        <Text style={styles.cardOpenText}>{tr('open', safeLang)} →</Text>
                      </View>
                    ) : null}
                  </CardWrapper>
                );
              })}
            </ScrollView>

            {list.length > 1 ? (
              <View style={styles.dots}>
                {list.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === activeIndex && { backgroundColor: ACCENT, width: 16 },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <GlassOverlay material="button" shape="card" radius={16} />
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
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: 'transparent',
    borderRadius: 24,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  lemma: {
    fontSize: 13,
    color: '#888780',
    fontStyle: 'italic',
    marginTop: 2,
  },
  counter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 2,
  },
  carouselContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 130,
    justifyContent: 'flex-start',
  },
  cardResolved: {
    borderColor: `${ACCENT}55`,
    backgroundColor: `${ACCENT}0D`,
  },
  cardCandidate: {
    borderColor: '#E5E1F5',
    backgroundColor: '#FAFAFC',
  },
  cardBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  cardBadgeResolved: {
    backgroundColor: `${ACCENT}22`,
  },
  cardBadgeCandidate: {
    backgroundColor: '#EDEDF2',
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardBadgeTextResolved: {
    color: ACCENT,
  },
  cardBadgeTextCandidate: {
    color: '#8B8B94',
  },
  cardWord: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1F1F23',
    lineHeight: 25,
  },
  cardCandidateNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  cardOpenRow: {
    marginTop: 12,
  },
  cardOpenText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E1F5',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  carousel360: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
  },
  headerText: {
    flexShrink: 1,
  },
  wordTr: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
    marginTop: 2,
  },
  senseList: {
    maxHeight: 170,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  senseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  senseRowActive: {
    backgroundColor: `${ACCENT}12`,
    borderColor: `${ACCENT}55`,
  },
  senseNo: {
    minWidth: 22,
    fontSize: 15,
    fontWeight: '800',
    color: '#9CA3AF',
    lineHeight: 21,
  },
  senseNoActive: {
    color: ACCENT,
  },
  senseBody: {
    flex: 1,
  },
  senseUk: {
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
  },
  senseUkActive: {
    color: ACCENT,
  },
  senseText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#888780',
    fontStyle: 'italic',
  },
  closeBtn: {
    marginTop: 4,
    flexShrink: 0,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444441',
  },
});

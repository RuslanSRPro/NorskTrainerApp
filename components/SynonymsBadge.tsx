// components/SynonymsBadge.tsx
// Norsk Trainer App — synonyms badge with card-carousel popup
//
// Читает lexemes.synonyms (заповнюється тригером sync_lexeme_synonym_column
// з authoritative_semantic_relations, relation_type='synonym'). Іконка
// показується ТІЛЬКИ якщо для слова реально є хоча б один синонім.
//
// v2: замінено плаский список на горизонтальну карусель карток — той самий
// візуальний підхід, що й у 360°-карусели: картка з кольоровою рамкою-
// акцентом, бейдж зверху (resolved/candidate), жирний заголовок. resolved-
// картки клікабельні (перехід через onSelectSynonym), candidate — лише
// інформаційні.

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
} from 'react-native';

import type { AppLanguage } from '@/services/i18n';

export type SynonymEntry = {
  text: string;
  resolved: boolean;
  target_entity_type?: 'lexeme' | 'expression' | null;
  target_entity_id?: string | null;
  confidence?: string | null;
  source?: string | null;
};

type Props = {
  synonyms?: SynonymEntry[] | null;
  lemma?: string;
  size?: 'sm' | 'md';
  lang?: AppLanguage | string | null;
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

export function SynonymsBadge({
  synonyms,
  lemma,
  size = 'sm',
  lang = 'ua',
  onSelectSynonym,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const safeLang = normalizeLang(lang);

  const list = Array.isArray(synonyms) ? synonyms.filter((item) => item?.text) : [];

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
          <Text style={{ fontSize: iconSize * 0.5, color: ACCENT }}>🔁</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: ACCENT }]}>{tr('title', safeLang)}</Text>
                {lemma ? <Text style={styles.lemma}>«{lemma}»</Text> : null}
              </View>

              <Text style={styles.counter}>
                {activeIndex + 1} / {list.length}
              </Text>
            </View>

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
                        {item.resolved ? tr('resolved_badge', safeLang) : tr('candidate_badge', safeLang)}
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

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
  closeBtn: {
    marginTop: 16,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: '#F1EFE8',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444441',
  },
});
// components/Lexeme360Carousel.tsx
// Norsk Trainer App — semantic carousel for Lexeme360
// FlatList-based carousel: better horizontal gestures inside modal/scroll containers.

import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppLanguage } from '@/services/i18n';
import { t } from '@/services/i18n';

export type Lexeme360CarouselItem = {
  id: string;
  lemma: string;
  translation_ua?: string;
  translation_en?: string;
  translation_no?: string;
  pos?: string;
  relation_type: string;
  confidence?: number;
  importance_level?: string;
  importance_score?: number;
  frequency_score?: number;
  semantic_shift_score?: number;
  learner_value_score?: number;
  example?: string;
  learned?: boolean;
  status?: 'ready' | 'candidate';
  canOpen?: boolean;
  canAdd?: boolean;
  sourceLabel?: string;
  colorKey?: string;
};

type Props = {
  items: Lexeme360CarouselItem[];
  lang: AppLanguage;
  onSelect?: (id: string, lemma: string) => void;
  onAdd?: (id: string) => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = Math.min(350, SCREEN_WIDTH - 56);
const CARD_HEIGHT = Math.min(382, Math.max(320, Math.round(SCREEN_HEIGHT * 0.43)));
const CARD_GAP = 12;
const SNAP = CARD_WIDTH + CARD_GAP;

function safeT(key: string, lang: AppLanguage, fallback: string) {
  try {
    const value = t(key as any, lang);
    if (value && value !== key) return value;
  } catch {
    // fallback
  }

  return fallback;
}

function pickTranslation(item: Lexeme360CarouselItem, lang: AppLanguage) {
  const ua = item.translation_ua || '';
  const en = item.translation_en || '';
  const no = item.translation_no || '';

  if (lang === 'ua') return ua || en || no;
  if (lang === 'no') return no || en || ua;
  return en || ua || no;
}

function displayLemmaWithInfinitiveMarker(lemma: string, pos?: string) {
  const value = String(lemma || '').trim();
  const safePos = String(pos || '').toLowerCase();

  if (!value) return value;
  if (value.toLowerCase().startsWith('å ')) return value;

  if (safePos === 'verb' || safePos.includes('verb') || safePos === 'expression') {
    return `å ${value}`;
  }

  return value;
}

function relationLabel(type: string, lang: AppLanguage) {
  if (lang === 'ua') return 'Новий сенс';
  if (lang === 'no') return 'Ny betydning';
  return 'New meaning';
}

function stableColorIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 5;
}

function getReadyBorderColor(item: Lexeme360CarouselItem) {
  const colors = ['#0EA5E9', '#22C55E', '#F59E0B', '#EC4899', '#8B5CF6'];
  return colors[stableColorIndex(item.id || item.lemma || '')];
}

function getCardVisual(item: Lexeme360CarouselItem) {
  const isCandidate = item.status === 'candidate' || item.canOpen === false;

  if (isCandidate) {
    return {
      card: styles.cardCandidate,
      badge: styles.badgeCandidate,
      badgeText: styles.badgeCandidateText,
      borderColor: '#D1D5DB',
    };
  }

  return {
    card: null,
    badge: null,
    badgeText: null,
    borderColor: getReadyBorderColor(item),
  };
}


function EmptyState({ lang }: { lang: AppLanguage }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>🧠</Text>

      <Text style={styles.emptyTitle}>
        {safeT(
          'no_connections',
          lang,
          lang === 'ua'
            ? 'Звʼязків ще немає'
            : lang === 'no'
              ? 'Ingen forbindelser ennå'
              : 'No connections yet'
        )}
      </Text>

      <Text style={styles.emptyText}>
        {safeT(
          'no_network_yet',
          lang,
          lang === 'ua'
            ? 'Семантична мережа для цього слова ще не побудована.'
            : lang === 'no'
              ? 'Det semantiske nettverket for dette ordet er ikke bygget ennå.'
              : 'The semantic network for this word has not been built yet.'
        )}
      </Text>
    </View>
  );
}

function clampIndex(value: number, max: number) {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function importanceRank(level?: string) {
  if (level === 'core') return 1;
  if (level === 'important') return 2;
  if (level === 'advanced') return 3;
  if (level === 'optional') return 4;
  return 5;
}

function importanceDescription(level?: string, lang?: AppLanguage) {
  const safeLevel = level || 'important';

  if (lang === 'ua') {
    if (safeLevel === 'core') {
      return 'Дуже частий вираз у живій норвезькій мові.\nРекомендується вивчити одним із перших.';
    }

    if (safeLevel === 'important') {
      return 'Корисний вираз для повсякденного спілкування.\nЧасто зустрічається в розмовній мові.';
    }

    if (safeLevel === 'advanced') {
      return 'Більш абстрактний або формальний вираз.\nЧастіше використовується на рівні B2+.';
    }

    return 'Додатковий вираз для розширення словникового запасу.';
  }

  if (lang === 'no') {
    if (safeLevel === 'core') {
      return 'Et svært vanlig uttrykk i levende norsk.\nAnbefales å lære tidlig.';
    }

    if (safeLevel === 'important') {
      return 'Et nyttig uttrykk for daglig kommunikasjon.\nBrukes ofte i muntlig språk.';
    }

    if (safeLevel === 'advanced') {
      return 'Et mer abstrakt eller formelt uttrykk.\nVanligere på B2-nivå og høyere.';
    }

    return 'Et ekstra uttrykk for å utvide ordforrådet.';
  }

  if (safeLevel === 'core') {
    return 'A very common expression in spoken Norwegian.\nRecommended to learn early.';
  }

  if (safeLevel === 'important') {
    return 'A useful expression for everyday communication.\nCommon in spoken language.';
  }

  if (safeLevel === 'advanced') {
    return 'A more abstract or formal expression.\nMore common at B2 level and above.';
  }

  return 'An additional expression for expanding vocabulary.';
}


export function Lexeme360Carousel({
  items,
  lang,
  onSelect,
  onAdd,
}: Props) {
  const listRef = useRef<FlatList<Lexeme360CarouselItem>>(null);
  const [index, setIndex] = useState(0);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.id && item.lemma)
        .sort((a, b) => {
          const rankA = importanceRank(a.importance_level);
          const rankB = importanceRank(b.importance_level);

          if (rankA !== rankB) return rankA - rankB;

          const scoreA = Number(a.importance_score ?? 0);
          const scoreB = Number(b.importance_score ?? 0);

          if (scoreA !== scoreB) return scoreB - scoreA;

          const confidenceA = Number(a.confidence ?? 0);
          const confidenceB = Number(b.confidence ?? 0);

          return confidenceB - confidenceA || a.lemma.localeCompare(b.lemma);
        }),
    [items]
  );

  if (!visibleItems.length) return <EmptyState lang={lang} />;

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    const next = clampIndex(
      Math.round(x / SNAP),
      visibleItems.length - 1
    );
    setIndex(next);
  }

  function goTo(next: number) {
    const safeNext = clampIndex(next, visibleItems.length - 1);
    setIndex(safeNext);
    listRef.current?.scrollToOffset({
      offset: safeNext * SNAP,
      animated: true,
    });
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <Text style={styles.carouselTitle}>
          {lang === 'ua'
            ? 'Смислові звʼязки'
            : lang === 'no'
              ? 'Betydningsnettverk'
              : 'Meaning network'}
        </Text>

        <Text style={styles.counter}>
          {index + 1} / {visibleItems.length}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={visibleItems}
        keyExtractor={(item) => `${item.relation_type}-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        snapToInterval={SNAP}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, itemIndex) => ({
          length: SNAP,
          offset: SNAP * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item }) => {
          const translation = pickTranslation(item, lang);
          const displayLemma = displayLemmaWithInfinitiveMarker(item.lemma, item.pos);
          const isCandidate = item.status === 'candidate' || item.canOpen === false;
          const label = isCandidate
            ? lang === 'ua'
              ? 'Кандидат'
              : lang === 'no'
                ? 'Kandidat'
                : 'Candidate'
            : relationLabel(item.relation_type, lang);
          const visual = getCardVisual(item);

          return (
            <Pressable
              style={[styles.card, visual.card, { borderColor: visual.borderColor }]}
              disabled={isCandidate}
              onPress={() => onSelect?.(item.id, displayLemma)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.badge, visual.badge]}>
                  <Text style={[styles.badgeText, visual.badgeText]}>{label}</Text>
                </View>

                {item.pos ? (
                  <View style={styles.posBadge}>
                    <Text style={styles.posText}>{item.pos}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.lemma}>{displayLemma}</Text>

              {translation ? (
                <Text style={styles.translation} numberOfLines={2}>
                  {translation}
                </Text>
              ) : null}

              {item.example ? (
                <View style={styles.exampleBox}>
                  <Text style={styles.exampleText} numberOfLines={3}>
                    {item.example}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {onAdd && item.canAdd !== false ? (
                  <Pressable
                    style={[
                      styles.actionButton,
                      item.learned && styles.actionButtonDisabled,
                    ]}
                    disabled={item.learned}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAdd(item.id);
                    }}
                  >
                    <Text style={styles.actionText}>
                      {item.learned
                        ? lang === 'ua'
                          ? '✅ У навчанні'
                          : lang === 'no'
                            ? '✅ I læring'
                            : '✅ In learning'
                        : lang === 'ua'
                          ? '➕ Додати'
                          : lang === 'no'
                            ? '➕ Legg til'
                            : '➕ Add'}
                    </Text>
                  </Pressable>
                ) : null}

                {item.canOpen !== false ? (
                  <Pressable
                    style={[styles.actionButton, styles.openButton]}
                    onPress={(event) => {
                      event.stopPropagation();
                      onSelect?.(item.id, displayLemma);
                    }}
                  >
                    <Text style={styles.openText}>
                      {lang === 'ua'
                        ? 'Відкрити'
                        : lang === 'no'
                          ? 'Åpne'
                          : 'Open'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.compactHint, isCandidate && styles.compactHintCandidate]} numberOfLines={3}>
                {isCandidate
                  ? item.sourceLabel ||
                    (lang === 'ua'
                      ? 'Знайдено в словнику · очікує обробки'
                      : lang === 'no'
                        ? 'Funnet i ordbok · venter på behandling'
                        : 'Found in dictionary · waiting for processing')
                  : importanceDescription(item.importance_level, lang)}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.navRow}>
        <Pressable
          style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
          disabled={index === 0}
          onPress={() => goTo(index - 1)}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>

        <View style={styles.dotsRow}>
          {visibleItems.slice(0, 12).map((item, dotIndex) => (
            <View
              key={`${item.id}-dot`}
              style={[
                styles.dot,
                dotIndex === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={[
            styles.navButton,
            index === visibleItems.length - 1 && styles.navButtonDisabled,
          ]}
          disabled={index === visibleItems.length - 1}
          onPress={() => goTo(index + 1)}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  carouselTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counter: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  list: {
    height: CARD_HEIGHT,
    maxHeight: CARD_HEIGHT,
  },
  listContent: {
    paddingRight: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: CARD_GAP,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  cardCandidate: {
    backgroundColor: '#F9FAFB',
    borderStyle: 'dashed',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.2,
  },
  badgeCandidate: {
    backgroundColor: '#E5E7EB',
  },
  badgeCandidateText: {
    color: '#6B7280',
  },
  posBadge: {
    backgroundColor: '#F1EFE8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  posText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888780',
    textTransform: 'uppercase',
  },
  lemma: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  translation: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    color: '#0EA5E9',
    marginBottom: 8,
  },
  hintBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  hintText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#4B5563',
  },
  exampleBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginTop: 4,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#374151',
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 'auto',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  openButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  openText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  compactHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  compactHintCandidate: {
    color: '#9CA3AF',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    color: '#374151',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#0EA5E9',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#374151',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
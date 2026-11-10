import { HighlightedExample } from './HighlightedExample';
export { HighlightedExample } from './HighlightedExample';
// components/Lexeme360Carousel.tsx
// Norsk Trainer App — semantic carousel for Lexeme360
// FlatList-based carousel: better horizontal gestures inside modal/scroll containers.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useWindowDimensions,
  FlatList,
  Modal,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppLanguage } from '@/services/i18n';
import { t } from '@/services/i18n';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';

export type Lexeme360CarouselItem = {
  id: string;
  // Optional synonym view identity: actions still open the original card.
  cardId?: string;
  accentColor?: string;
  translationCaption?: string;
  sourceMeaningCaption?: string;
  sourceMeaning?: string;
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
  example_translation_uk?: string;
  example_evidence?: unknown;
  expressionId?: string;
  learned?: boolean;
  status?: 'ready' | 'candidate';
  canOpen?: boolean;
  canAdd?: boolean;
  sourceLabel?: string;
  colorKey?: string;
  // D10 30.10.2026 (stage D): own hint line under the card (synonyms);
  // without it the card shows the importance text as before.
  hint?: string;
  // D10 30.10.2026 (point 5): text before the badge label (sense number "② ") and the
  // proof shown by the ⓘ button in place of the example; both optional.
  labelPrefix?: string;
  details?: string;
  // D10_synonym_nuance_chip_v1 (05.11.2026, agreed): a short second chip next to the badge (label of a contextual
  // synonym, e.g. "Close meaning · colloquial"); with it the hint line under the card is not shown (it stays in details)
  tag?: string;
};

type Props = {
  fillAvailable?: boolean;
  pinActions?: boolean;
  compactFooter?: boolean;
  highlightExamples?: boolean;
  hideTitle?: boolean;
  items: Lexeme360CarouselItem[];
  lang: AppLanguage;
  onSelect?: (id: string, lemma: string) => void;
  onAdd?: (id: string) => void;
  // ФИКС: id элемента, к которому нужно автоскроллить и подсветить при
  // открытии — используется, когда 360° открыт напрямую с конкретной
  // expression (например, из превью в analyze-text), а не с корня.
  highlightId?: string;
  // D10 30.10.2026 (stage D): carousel title; default 'Смислові звʼязки' as before.
  title?: string;
  // D10 30.10.2026 (point 5): the card in view changed (index + item); a request to scroll to a card
  // (id, nonce so the same card can be asked again). Both optional; the family 360 does not use them.
  onActiveChange?: (item: Lexeme360CarouselItem, index: number) => void;
  scrollRequest?: { id: string; nonce: number } | null;
};

const CARD_GAP = 12;

// Measure the whole scrollable area, after fixed actions have taken their space.
// Each step waits for its own layout; stale measurements cannot shrink it again.
function FitCardScroll({ children }: { children: (scale: number) => React.ReactNode }) {
  const [step, setStep] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [content, setContent] = useState({ step: -1, height: 0 });
  useEffect(() => {
    if (viewportHeight > 0 && content.step === step && content.height > viewportHeight + 2 && step < 8) {
      setStep(step + 1);
    }
  }, [viewportHeight, content, step]);
  return <ScrollView nestedScrollEnabled showsVerticalScrollIndicator
    onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
    style={{ flex: 1, minHeight: 0 }}>
    <View key={step} style={{ minHeight: viewportHeight }}
      onLayout={({ nativeEvent }) => setContent({ step, height: nativeEvent.layout.height })}>
      {children(1 - step * 0.04)}
    </View>
  </ScrollView>;
}

function AdaptiveCardText({ children, kind, scale }: {
  children: string; kind: 'lemma' | 'translation'; scale: number;
}) {
  const baseSize = kind === 'lemma' ? (children.length > 25 ? 21 : 26) : (children.length > 70 ? 14 : 17);
  const size = Math.max(kind === 'lemma' ? 16 : 12, baseSize * scale);
  return <Text
    style={[kind === 'lemma' ? styles.lemma : styles.translation,
      { fontSize: size, lineHeight: Math.ceil(size * (kind === 'lemma' ? 1.2 : 1.39)) }]}
  >{children}</Text>;
}

function fittedExampleStyle(text: string, scale: number) {
  const size = Math.max(12, (text.length > 90 ? 13 : 14) * scale);
  return { fontSize: size, lineHeight: Math.ceil(size * 1.36) };
}

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
  if (type === 'one_way_replacement') {
    return lang === 'ua' ? 'Одностороння заміна' : lang === 'no' ? 'Enveis erstatning' : 'One-way replacement';
  }
  // D10 30.10.2026 (stage D): synonym cards (the rest as before).
  if (type === 'synonym') {
    return lang === 'ua' ? 'Синонім' : lang === 'no' ? 'Synonym' : 'Synonym';
  }
  if (type === 'contextual_synonym') {
    return lang === 'ua' ? 'Синонім у контексті' : lang === 'no' ? 'Synonym i kontekst' : 'Synonym in context';
  }
  if (lang === 'ua') return 'Новий сенс';
  if (lang === 'no') return 'Ny betydning';
  return 'New meaning';
}

// D10 30.10.2026 (stage D): hint line of synonym cards ('' for other cards).
function synonymHint(type: string, lang: AppLanguage) {
  if (type === 'synonym') {
    return lang === 'ua'
      ? 'Те саме значення — можна вжити замість слова.'
      : lang === 'no'
        ? 'Samme betydning — kan brukes i stedet for ordet.'
        : 'Same meaning — can be used instead of the word.';
  }
  if (type === 'contextual_synonym') {
    return lang === 'ua'
      ? 'Збігається лише в одному значенні — дивись на контекст.'
      : lang === 'no'
        ? 'Samme betydning bare i én sammenheng — se på konteksten.'
        : 'Same meaning only in one sense — check the context.';
  }
  return '';
}

function stableColorIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 5;
}

function getReadyBorderColor(item: Lexeme360CarouselItem) {
  if (item.accentColor) return item.accentColor;
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
  highlightId,
  title,
  onActiveChange,
  scrollRequest,
  fillAvailable = false,
  pinActions = false,
  compactFooter = false,
  highlightExamples = false,
  hideTitle = false,
}: Props) {
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const cardWidth = Math.min(350, Math.max(1, (viewport.width || window.width - 32) - 12));
  const cardHeight = fillAvailable ? Math.max(1, viewport.height) : Math.min(360, window.height * 0.42);
  const SNAP = cardWidth + CARD_GAP;
  const listRef = useRef<FlatList<Lexeme360CarouselItem>>(null);
  const [index, setIndex] = useState(0);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const currentIndex = useRef(0);
  useEffect(() => { currentIndex.current = index; }, [index]);

  // Keep the same card aligned when the window/container width changes.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: currentIndex.current * SNAP, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [SNAP]);

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

  // ФИКС: автоскролл к highlightId при первом появлении данных.
  // getItemLayout уже есть в FlatList ниже, поэтому scrollToIndex надёжен
  // без задержки на измерение layout. Хук расположен ДО условного return
  // ниже — обязательное требование Rules of Hooks (хуки нельзя вызывать
  // после условного выхода).
  useEffect(() => {
    if (!highlightId || visibleItems.length === 0) return;

    const targetIndex = visibleItems.findIndex((item) => item.id === highlightId);
    if (targetIndex < 0) return;

    setIndex(targetIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
    });
  }, [highlightId, visibleItems]);

  // D10 30.10.2026 (point 5): tell the parent which card is in view
  useEffect(() => {
    const item = visibleItems[index];
    if (item && onActiveChange) onActiveChange(item, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, visibleItems]);

  // D10 30.10.2026 (point 5): the parent asks to show a card
  useEffect(() => {
    if (!scrollRequest) return;
    const target = visibleItems.findIndex((item) => item.id === scrollRequest.id);
    if (target < 0) return;
    setIndex(target);
    listRef.current?.scrollToOffset({ offset: target * SNAP, animated: true });
  }, [scrollRequest, SNAP, visibleItems]);

  if (!visibleItems.length) return <EmptyState lang={lang} />;
  const synonymDetails = visibleItems.find(item => item.id === detailsId && item.accentColor);

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
    <View style={[styles.wrapper, fillAvailable && { flex: 1, minHeight: 0 }, compactFooter && { marginBottom: 0 }]}>
      {!hideTitle ? <View style={styles.topRow}>
        <Text style={styles.carouselTitle}>
          {title ? title : lang === 'ua'
            ? 'Смислові звʼязки'
            : lang === 'no'
              ? 'Betydningsnettverk'
              : 'Meaning network'}
        </Text>

        <Text style={styles.counter}>
          {index + 1} / {visibleItems.length}
        </Text>
      </View> : null}

      <View style={fillAvailable ? { flex: 1, minHeight: 0 } : { height: cardHeight }}
        onLayout={({ nativeEvent: { layout } }) => setViewport(current =>
          current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height })}>
      <FlatList
        ref={listRef}
        style={{ height: cardHeight, flexGrow: 0 }}
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
          const translations = [
            item.translation_ua,
            item.translation_en,
          ].filter(Boolean).join('\n') || pickTranslation(item, lang);
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
          const isHighlighted = highlightId != null && item.id === highlightId;

          const actions = (
            <View style={styles.actionsRow}>
                {onAdd && item.canAdd !== false ? (
                  <Pressable
                    style={[
                      styles.actionButton,
                      pinActions && { minHeight: 44, justifyContent: 'center' },
                      item.learned && styles.actionButtonDisabled,
                    ]}
                    disabled={item.learned}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAdd(item.cardId ?? item.id);
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

                {item.details ? (
                  <Pressable
                    style={[styles.infoButton, detailsId === item.id && styles.infoButtonActive]}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      setDetailsId((current) => (current === item.id ? null : item.id));
                    }}
                  >
                    <Text style={styles.infoText}>ⓘ</Text>
                  </Pressable>
                ) : null}

                {item.canOpen !== false ? (
                  <Pressable
                    style={[styles.actionButton, styles.openButton, pinActions && { minHeight: 44, justifyContent: 'center' }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      onSelect?.(item.cardId ?? item.id, displayLemma);
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
          );

          return (
            <Pressable
              style={[
                styles.card,
                { width: cardWidth, height: cardHeight },
                visual.card,
                { borderColor: isHighlighted ? '#0EA5E9' : visual.borderColor },
                isHighlighted && { borderWidth: 2 },
              ]}
              disabled={isCandidate}
              onPress={() => onSelect?.(item.cardId ?? item.id, displayLemma)}
            >
              <GlassOverlay material="card" shape="card" radius={24} />
              <FitCardScroll key={JSON.stringify([item.id, cardWidth, cardHeight, window.fontScale, displayLemma, translations, item.example, item.example_translation_uk, detailsId === item.id, pinActions, item.learned, item.details, item.sourceMeaning, item.hint])}>
              {(fitScale) => <>
              <View style={[styles.cardHeader, item.accentColor ? { flexWrap: 'wrap' } : null]}>
                <View style={[styles.badge, visual.badge, item.accentColor ? { backgroundColor: `${item.accentColor}20` } : null]}>
                  <Text style={[styles.badgeText, visual.badgeText, item.accentColor ? { color: item.accentColor } : null]}>{`${item.labelPrefix ?? ''}${label}`}</Text>
                </View>

                {item.pos ? (
                  <View style={styles.posBadge}>
                    <Text style={styles.posText}>{item.pos}</Text>
                  </View>
                ) : null}

                {item.tag ? (
                  <View style={[styles.tagChip, item.accentColor ? { borderColor: `${item.accentColor}66` } : null]}>
                    <Text style={[styles.tagText, item.accentColor ? { color: item.accentColor } : null]}>{item.tag}</Text>
                  </View>
                ) : null}
              </View>

              {item.sourceMeaning ? <View style={{marginBottom:8}}>
                <Text style={{fontSize:11,color:'#6B7280'}}>{item.sourceMeaningCaption}</Text>
                <Text style={{fontSize:15,lineHeight:20,fontWeight:'700',color:'#374151'}}>{item.sourceMeaning}</Text>
              </View> : null}
              <AdaptiveCardText kind="lemma" scale={fitScale}>{displayLemma}</AdaptiveCardText>
              {item.translationCaption ? <Text style={{ fontSize: 11, color: '#6B7280' }}>{item.translationCaption}</Text> : null}

              {translations ? (
                <AdaptiveCardText kind="translation" scale={fitScale}>{translations}</AdaptiveCardText>
              ) : null}

              {item.details && detailsId === item.id && !item.accentColor ? (
                <View style={styles.exampleBox}>
                  <Text style={styles.detailsText} numberOfLines={6}>{item.details}</Text>
                </View>
              ) : item.example ? (
                <View style={styles.exampleBox}>
                  <HighlightedExample text={item.example} phrase={item.lemma} evidence={item.example_evidence} textStyle={[styles.exampleText, fittedExampleStyle(item.example, fitScale)]} />
                  {item.example_translation_uk ? <HighlightedExample text={item.example_translation_uk} phrase={item.translation_ua || ''} evidence={item.example_evidence} language="uk" textStyle={[styles.exampleText, fittedExampleStyle(item.example_translation_uk, fitScale)]} /> : null}
                </View>
              ) : null}

              {!pinActions ? actions : null}

              {item.tag && !isCandidate ? null : <Text style={[styles.compactHint, isCandidate && styles.compactHintCandidate]} numberOfLines={3}>
                {isCandidate
                  ? item.sourceLabel ||
                    (lang === 'ua'
                      ? 'Знайдено в словнику · очікує обробки'
                      : lang === 'no'
                        ? 'Funnet i ordbok · venter på behandling'
                        : 'Found in dictionary · waiting for processing')
                  : item.hint || synonymHint(item.relation_type, lang) || importanceDescription(item.importance_level, lang)}
              </Text>}
              </>}
              </FitCardScroll>
              {pinActions ? <View style={{ flexShrink: 0, marginTop: 8 }}>{actions}</View> : null}
            </Pressable>
          );
        }}
      />
      </View>

      <View style={[styles.navRow, compactFooter && { paddingBottom: 0, marginTop: 4 }]}>
        <Pressable
          style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityLabel={lang === 'ua' ? 'Попередня картка' : lang === 'no' ? 'Forrige kort' : 'Previous card'}
          onPress={() => goTo(index - 1)}
        >
          <GlassOverlay material="button" shape="card" radius={22} />
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
          accessibilityRole="button"
          accessibilityLabel={lang === 'ua' ? 'Наступна картка' : lang === 'no' ? 'Neste kort' : 'Next card'}
          onPress={() => goTo(index + 1)}
        >
          <GlassOverlay material="button" shape="card" radius={22} />
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      {synonymDetails ? <Modal transparent animationType="fade" onRequestClose={() => setDetailsId(null)}>
        <Pressable onPress={() => setDetailsId(null)} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable onPress={event => event.stopPropagation()} style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, maxHeight: '80%' }}>
            <ScrollView>
              <Text style={styles.lemma}>{synonymDetails.lemma}</Text>
              <Text style={styles.detailsText}>{synonymDetails.details}</Text>
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setDetailsId(null)} style={{ padding: 12 }}>
              <Text style={styles.openText}>{lang === 'ua' ? 'Закрити' : lang === 'no' ? 'Lukk' : 'Close'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal> : null}
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

  },
  listContent: {
    paddingRight: CARD_GAP,
  },
  card: {
    overflow: 'hidden',
    marginRight: CARD_GAP,
    backgroundColor: 'rgba(248,250,252,0.28)',
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
  // D10_synonym_nuance_chip_v1: second chip (label of a contextual synonym); wraps to its own line when long
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
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
  exampleTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  exampleHighlight: {
    color: '#8B4513',
    fontWeight: '900',
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
  infoButton: {
    width: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoButtonActive: {
    borderColor: '#0EA5E9',
  },
  infoText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0EA5E9',
  },
  detailsText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#374151',
  },
  compactHintCandidate: {
    color: '#9CA3AF',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    flexShrink: 0,
    paddingBottom: 6,
    minHeight: 48,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
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

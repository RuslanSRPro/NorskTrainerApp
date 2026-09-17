import { useEffect, useMemo, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { AppLanguage } from '@/services/i18n';

import { TrainingMeta } from './TrainingMeta';
import { TrainingModeRenderer } from './TrainingModeRenderer';
import { TrainingTask } from './types';

export type TrainingDensity = 'normal' | 'compact' | 'dense';

type Props = {
  currentTask: TrainingTask; current: any; isDark: boolean; s: any;
  appLanguage: AppLanguage; taskTitle: string; textColor: string; mutedColor: string; fonts: any;
  answerVisible: boolean; typedAnswer: string; feedback: string; savingReview: boolean; reviewSaved: boolean;
  ui: (key: any) => string;
  getCategoryLabel: (cat: string) => string; getMainWord: (w: any) => string; getImageUrl: (w: any) => string;
  getTranslation: (w: any) => string; getAllForms: (w: any) => { label: string; value: string }[]; getClozeHint: (w: any) => string;
  hasVerification: (w: any) => boolean; hasRelations: (w: any) => boolean;
  speakCurrentTask: () => void; selectChoice: (option: string) => void; setTypedAnswer: (value: string) => void;
  checkTyped: () => void; onToggleFlashcard: () => void;
};

const nextDensity = (value: TrainingDensity): TrainingDensity =>
  value === 'normal' ? 'compact' : value === 'compact' ? 'dense' : 'dense';

export function TrainingCard(props: Props) {
  const {
    currentTask, current, isDark, s, appLanguage, taskTitle, textColor, mutedColor, fonts,
    answerVisible, typedAnswer, feedback, savingReview, reviewSaved, ui, getCategoryLabel,
    getMainWord, getImageUrl, getTranslation, getAllForms, getClozeHint, hasVerification,
    hasRelations, speakCurrentTask, selectChoice, setTypedAnswer, checkTyped, onToggleFlashcard,
  } = props;

  const isFlashcard = currentTask.mode === 'flashcards';
  const isAdaptiveMode = isFlashcard || currentTask.mode === 'choice';
  const [density, setDensity] = useState<TrainingDensity>('normal');
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    setDensity('normal');
    setContentHeight(0);
    setAtBottom(true);
  }, [currentTask.id, answerVisible]);

  const overflow = viewportHeight > 0 && contentHeight > viewportHeight + 4;

  useEffect(() => {
    if (!isAdaptiveMode || !overflow || density === 'dense') return;
    const timer = setTimeout(() => setDensity((value) => nextDensity(value)), 0);
    return () => clearTimeout(timer);
  }, [contentHeight, viewportHeight, overflow, density, isAdaptiveMode]);

  const contentStyle = useMemo(() => [
    s.cardInner,
    density === 'compact' && styles.cardInnerCompact,
    density === 'dense' && styles.cardInnerDense,
  ], [s.cardInner, density]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 10);
  };

  return (
    <Pressable style={s.cardPress} onPress={isFlashcard ? onToggleFlashcard : undefined}>
      <GlassSurface variant="card" dark={isDark} style={s.cardGlass} contentStyle={s.cardGlassInner}>
        <View style={styles.viewport} onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}>
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isAdaptiveMode || (density === 'dense' && overflow)}
            bounces={density === 'dense' && overflow}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onContentSizeChange={(_, height) => setContentHeight(height)}
            contentContainerStyle={contentStyle}
          >
            <TrainingMeta
              current={current} isDark={isDark} s={s} appLanguage={appLanguage} taskTitle={taskTitle}
              getCategoryLabel={getCategoryLabel} getMainWord={getMainWord}
              hasVerification={hasVerification} hasRelations={hasRelations}
            />

            {getImageUrl(current) ? (
              <Image source={{ uri: getImageUrl(current) }} style={s.image} resizeMode="cover" />
            ) : null}

            <TrainingModeRenderer
              currentTask={currentTask} current={current} isDark={isDark} s={s} fonts={fonts}
              textColor={textColor} mutedColor={mutedColor} answerVisible={answerVisible}
              typedAnswer={typedAnswer} feedback={feedback} savingReview={savingReview}
              reviewSaved={reviewSaved} ui={ui} getMainWord={getMainWord}
              getTranslation={getTranslation} getAllForms={getAllForms} getClozeHint={getClozeHint}
              speakCurrentTask={speakCurrentTask} selectChoice={selectChoice}
              setTypedAnswer={setTypedAnswer} checkTyped={checkTyped} density={density}
            />
          </ScrollView>

          {isAdaptiveMode && density === 'dense' && overflow && !atBottom ? (
            <View pointerEvents="none" style={[styles.overflowCue, isDark && styles.overflowCueDark]} />
          ) : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scroll: { flex: 1 },
  cardInnerCompact: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18 },
  cardInnerDense: { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 14 },
  overflowCue: {
    position: 'absolute', left: 18, right: 18, bottom: 5, height: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  overflowCueDark: { backgroundColor: 'rgba(255,255,255,0.24)' },
});

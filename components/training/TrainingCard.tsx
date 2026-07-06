import { Image, Pressable, ScrollView } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { AppLanguage } from '@/services/i18n';

import { TrainingMeta } from './TrainingMeta';
import { TrainingModeRenderer } from './TrainingModeRenderer';
import { TrainingTask } from './types';

type Props = {
  currentTask: TrainingTask;
  current: any;
  isDark: boolean;
  s: any;

  appLanguage: AppLanguage;
  taskTitle: string;
  textColor: string;
  mutedColor: string;
  fonts: any;

  answerVisible: boolean;
  typedAnswer: string;
  feedback: string;
  savingReview: boolean;
  reviewSaved: boolean;

  ui: (key: any) => string;

  getCategoryLabel: (cat: string) => string;
  getMainWord: (w: any) => string;
  getImageUrl: (w: any) => string;
  getTranslation: (w: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  getClozeHint: (w: any) => string;

  hasVerification: (w: any) => boolean;
  hasRelations: (w: any) => boolean;

  speakCurrentTask: () => void;
  selectChoice: (option: string) => void;
  setTypedAnswer: (value: string) => void;
  checkTyped: () => void;
  onToggleFlashcard: () => void;
};

export function TrainingCard({
  currentTask,
  current,
  isDark,
  s,
  appLanguage,
  taskTitle,
  textColor,
  mutedColor,
  fonts,
  answerVisible,
  typedAnswer,
  feedback,
  savingReview,
  reviewSaved,
  ui,
  getCategoryLabel,
  getMainWord,
  getImageUrl,
  getTranslation,
  getAllForms,
  getClozeHint,
  hasVerification,
  hasRelations,
  speakCurrentTask,
  selectChoice,
  setTypedAnswer,
  checkTyped,
  onToggleFlashcard,
}: Props) {
  return (
    <Pressable
      style={s.cardPress}
      onPress={currentTask.mode === 'flashcards' ? onToggleFlashcard : undefined}
    >
      <GlassSurface
        variant="card"
        dark={isDark}
        style={s.cardGlass}
        contentStyle={s.cardGlassInner}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.cardInner}
        >
          <TrainingMeta
            current={current}
            isDark={isDark}
            s={s}
            appLanguage={appLanguage}
            taskTitle={taskTitle}
            getCategoryLabel={getCategoryLabel}
            getMainWord={getMainWord}
            hasVerification={hasVerification}
            hasRelations={hasRelations}
          />

          {getImageUrl(current) ? (
            <Image
              source={{ uri: getImageUrl(current) }}
              style={s.image}
              resizeMode="cover"
            />
          ) : null}

          <TrainingModeRenderer
            currentTask={currentTask}
            current={current}
            isDark={isDark}
            s={s}
            fonts={fonts}
            textColor={textColor}
            mutedColor={mutedColor}
            answerVisible={answerVisible}
            typedAnswer={typedAnswer}
            feedback={feedback}
            savingReview={savingReview}
            reviewSaved={reviewSaved}
            ui={ui}
            getMainWord={getMainWord}
            getTranslation={getTranslation}
            getAllForms={getAllForms}
            getClozeHint={getClozeHint}
            speakCurrentTask={speakCurrentTask}
            selectChoice={selectChoice}
            setTypedAnswer={setTypedAnswer}
            checkTyped={checkTyped}
          />
        </ScrollView>
      </GlassSurface>
    </Pressable>
  );
}
import { Text, View } from 'react-native';

import { TrainingMode } from '@/services/settings';

import { TrainingGlassButton } from './TrainingGlassButton';
import { TrainingGradeButton } from './TrainingGradeButton';

type Grade = 'Hard' | 'OK' | 'Easy';

type Props = {
  mode: TrainingMode;
  isDark: boolean;
  s: any;
  savingReview: boolean;
  ui: (key: any) => string;
  onNext: () => void;
  onGrade: (label: Grade) => void;
};

export function TrainingBottomBar({
  mode,
  isDark,
  s,
  savingReview,
  ui,
  onNext,
  onGrade,
}: Props) {
  const modeName = String(mode || '').toLowerCase();

  const isFlashcardMode =
    modeName === 'flashcards' ||
    modeName === 'flashcard' ||
    modeName === 'card' ||
    modeName === 'cards';

  if (isFlashcardMode) {
    return (
      <View style={s.bottomBar}>
        {savingReview ? (
          <Text style={s.savingText}>{ui('saving')}</Text>
        ) : null}

        <View style={s.gradeRow}>
          <TrainingGradeButton
            label={ui('hard')}
            tone="hard"
            isDark={isDark}
            disabled={savingReview}
            onPress={() => onGrade('Hard')}
          />

          <TrainingGradeButton
            label={ui('ok')}
            tone="ok"
            isDark={isDark}
            disabled={savingReview}
            onPress={() => onGrade('OK')}
          />

          <TrainingGradeButton
            label={ui('easy')}
            tone="easy"
            isDark={isDark}
            disabled={savingReview}
            onPress={() => onGrade('Easy')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={s.bottomBar}>
      {savingReview ? (
        <Text style={s.savingText}>{ui('saving')}</Text>
      ) : null}

      <TrainingGlassButton
        label={ui('next_task')}
        onPress={onNext}
        disabled={savingReview}
        isDark={isDark}
      />
    </View>
  );
}
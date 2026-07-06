import { Text, View } from 'react-native';

import { TrainingMode } from '@/services/settings';

import { TrainingGlassButton } from './TrainingGlassButton';
import { TrainingGradeButton } from './TrainingGradeButton';

type Props = {
  mode: TrainingMode;
  isDark: boolean;
  s: any;
  savingReview: boolean;
  ui: (key: any) => string;
  onNext: () => void;
  onGrade: (label: 'Hard' | 'OK' | 'Easy') => void;
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
  return (
    <View style={s.bottomBar}>
      {savingReview ? (
        <Text style={s.savingText}>{ui('saving')}</Text>
      ) : null}

      {mode === 'flashcards' ? (
        <View style={s.gradeRow}>
          <TrainingGradeButton
            label={ui('hard')}
            onPress={() => onGrade('Hard')}
            disabled={savingReview}
            isDark={isDark}
            tone="hard"
          />

          <TrainingGradeButton
            label={ui('ok')}
            onPress={() => onGrade('OK')}
            disabled={savingReview}
            isDark={isDark}
            tone="ok"
          />

          <TrainingGradeButton
            label={ui('easy')}
            onPress={() => onGrade('Easy')}
            disabled={savingReview}
            isDark={isDark}
            tone="easy"
          />
        </View>
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
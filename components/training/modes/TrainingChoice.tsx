import { Text, View } from 'react-native';

import { GlassControl } from '@/components/ui/glass/GlassControl';
import { isIrregularMorphology } from '@/services/formPresentation';
import type { TrainingDensity } from '../TrainingCard';
import { TrainingFormsList } from '../TrainingFormsList';

type Props = {
  current: any;
  options?: string[];
  isDark: boolean;
  s: any;
  fonts: any;
  textColor: string;
  mutedColor: string;
  answerVisible: boolean;
  savingReview: boolean;
  reviewSaved: boolean;
  ui: (key: any) => string;
  getMainWord: (w: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  speakCurrentTask: () => void;
  selectChoice: (option: string) => void;
  density?: TrainingDensity;
};

export function TrainingChoice({
  current,
  options,
  isDark,
  s,
  fonts,
  textColor,
  mutedColor,
  answerVisible,
  savingReview,
  reviewSaved,
  ui,
  getMainWord,
  getAllForms,
  speakCurrentTask,
  selectChoice,
  density = 'normal',
}: Props) {
  const compact = density !== 'normal';
  const dense = density === 'dense';
  return (
    <>
      <Text
        style={[
          s.word,
          compact && { fontSize: Math.max(32, fonts.word * 0.9), lineHeight: Math.max(37, fonts.word * 1.02), marginBottom: 9 },
          dense && { fontSize: Math.max(30, fonts.word * 0.84), lineHeight: Math.max(35, fonts.word * 0.96), marginBottom: 6 },
          isIrregularMorphology(current) && {
            color: isDark ? '#FF7373' : '#C62828',
          },
        ]}
        onPress={speakCurrentTask}
      >
        {getMainWord(current)}
      </Text>

      <View style={[s.choiceGrid, compact && { gap: 8 }, dense && { gap: 6 }]}>
        {options?.map((option) => (
          <GlassControl
            key={option}
            onPress={() => selectChoice(option)}
            disabled={savingReview || reviewSaved}
            dark={isDark}
            size="regular"
            material="tile"
            style={[s.choiceBtn, dense && { minHeight: 44 }]}
            contentStyle={[s.choiceInner, compact && { paddingVertical: 10 }, dense && { paddingVertical: 8 }]}
          >
            <Text style={[s.choiceText, compact && { fontSize: Math.max(15, fonts.base * 0.94) }, dense && { fontSize: Math.max(14, fonts.base * 0.88) }]}>{option}</Text>
          </GlassControl>
        ))}
      </View>

      {answerVisible ? (
        <TrainingFormsList
          forms={getAllForms(current)}
          title={ui('forms')}
          alternativeLabel={ui('alternative_forms')}
          isDark={isDark}
          textColor={isIrregularMorphology(current) ? (isDark ? '#FF6B6B' : '#D92D20') : textColor}
          mutedColor={mutedColor}
          fonts={fonts}
          density={density}
        />
      ) : null}
    </>
  );
}

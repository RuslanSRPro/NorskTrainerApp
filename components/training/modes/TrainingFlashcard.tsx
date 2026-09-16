import { Text, View } from 'react-native';

import { isIrregularMorphology } from '@/services/formPresentation';

import type { TrainingDensity } from '../TrainingCard';
import { TrainingFormsList } from '../TrainingFormsList';
import { TrainingInfoBlock } from '../TrainingInfoBlock';

type Props = {
  current: any; isDark: boolean; s: any; fonts: any; textColor: string; mutedColor: string;
  answerVisible: boolean; ui: (key: any) => string; getMainWord: (w: any) => string;
  getTranslation: (w: any) => string; getAllForms: (w: any) => { label: string; value: string }[];
  speakCurrentTask: () => void; density?: TrainingDensity;
};

export function TrainingFlashcard({
  current, isDark, s, fonts, textColor, mutedColor, answerVisible, ui, getMainWord,
  getTranslation, getAllForms, speakCurrentTask, density = 'normal',
}: Props) {
  const compact = density !== 'normal';
  const dense = density === 'dense';
  const translation = getTranslation(current);
  const baseTranslationSize = translation.length > 30 ? fonts.base : fonts.translation;
  const translationSize = Math.max(20, baseTranslationSize * (dense ? 0.82 : compact ? 0.91 : 1));

  return (
    <>
      <Text
        style={[
          s.word,
          compact && { fontSize: Math.max(32, fonts.word * 0.9), lineHeight: Math.max(37, fonts.word * 1.02), marginBottom: 9 },
          dense && { fontSize: Math.max(30, fonts.word * 0.84), lineHeight: Math.max(35, fonts.word * 0.96), marginBottom: 6 },
          isIrregularMorphology(current) && { color: isDark ? '#FF7373' : '#C62828' },
        ]}
        onPress={speakCurrentTask}
      >
        {getMainWord(current)}
      </Text>

      {current.example ? (
        <Text style={[
          s.example,
          compact && { fontSize: Math.max(17, fonts.base * 0.92), lineHeight: Math.max(23, fonts.base * 1.28), marginBottom: 9 },
          dense && { fontSize: Math.max(16, fonts.base * 0.86), lineHeight: Math.max(21, fonts.base * 1.18), marginBottom: 6 },
        ]}>
          {current.example}
        </Text>
      ) : null}

      <View style={[s.answerArea, dense && { minHeight: 0 }]}>
        {answerVisible ? (
          <>
            <TrainingInfoBlock isDark={isDark} density={density}>
              <Text style={[s.answerLabel, compact && { marginBottom: dense ? 2 : 4, fontSize: Math.max(12, fonts.meta * 0.92) }]}>
                {ui('translation')}
              </Text>
              <Text style={[s.answerText, { fontSize: translationSize, lineHeight: translationSize * (dense ? 1.22 : 1.32) }]}>
                {translation}
              </Text>
            </TrainingInfoBlock>

            <TrainingFormsList
              forms={getAllForms(current)} title={ui('forms')} alternativeLabel={ui('alternative_forms')}
              isDark={isDark} textColor={isIrregularMorphology(current) ? (isDark ? '#FF6B6B' : '#D92D20') : textColor}
              mutedColor={mutedColor} fonts={fonts} density={density}
            />
          </>
        ) : (
          <TrainingInfoBlock isDark={isDark} density={density}>
            <Text style={s.tapHintText}>{ui('tap_to_reveal')}</Text>
          </TrainingInfoBlock>
        )}
      </View>
    </>
  );
}

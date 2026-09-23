import { Text, View } from 'react-native';

import { GlassControl } from '@/components/ui/glass/GlassControl';
import { isIrregularMorphology } from '@/services/formPresentation';
import { CompoundWordText } from '@/components/CompoundWordText';
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
}: Props) {
  return (
    <>
      <CompoundWordText
        value={getMainWord(current)}
        word={current}
        style={s.word}
        onPress={speakCurrentTask}
        mainColor={isIrregularMorphology(current)
          ? (isDark ? '#FF7373' : '#C62828')
          : textColor}
        componentColor={textColor}
      />

      <View style={s.choiceGrid}>
        {options?.map((option) => (
          <GlassControl
            key={option}
            onPress={() => selectChoice(option)}
            disabled={savingReview || reviewSaved}
            dark={isDark}
            size="regular"
            material="tile"
            style={s.choiceBtn}
            contentStyle={s.choiceInner}
          >
            <Text style={s.choiceText}>{option}</Text>
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
        />
      ) : null}
    </>
  );
}

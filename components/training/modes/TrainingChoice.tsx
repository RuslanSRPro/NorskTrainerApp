import { Pressable, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
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
      <Text style={s.word} onPress={speakCurrentTask}>
        {getMainWord(current)}
      </Text>

      <View style={s.choiceGrid}>
        {options?.map((option) => (
          <Pressable
            key={option}
            onPress={() => selectChoice(option)}
            disabled={savingReview || reviewSaved}
          >
            <GlassSurface
              variant="tile"
              dark={isDark}
              style={[s.choiceBtn, reviewSaved && s.disabled]}
              contentStyle={s.choiceInner}
            >
              <Text style={s.choiceText}>{option}</Text>
            </GlassSurface>
          </Pressable>
        ))}
      </View>

      {answerVisible ? (
        <TrainingFormsList
          forms={getAllForms(current)}
          title={ui('forms')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          fonts={fonts}
        />
      ) : null}
    </>
  );
}
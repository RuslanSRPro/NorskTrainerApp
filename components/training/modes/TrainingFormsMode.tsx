import { Text, TextInput } from 'react-native';

import { TrainingFormsList } from '../TrainingFormsList';
import { TrainingGlassButton } from '../TrainingGlassButton';

type Props = {
  current: any;
  prompt?: string;
  formLabel?: string;
  isDark: boolean;
  s: any;
  fonts: any;
  textColor: string;
  mutedColor: string;
  answerVisible: boolean;
  typedAnswer: string;
  savingReview: boolean;
  reviewSaved: boolean;
  ui: (key: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  speakCurrentTask: () => void;
  setTypedAnswer: (value: string) => void;
  checkTyped: () => void;
};

export function TrainingFormsMode({
  current,
  prompt,
  formLabel,
  isDark,
  s,
  fonts,
  textColor,
  mutedColor,
  answerVisible,
  typedAnswer,
  savingReview,
  reviewSaved,
  ui,
  getAllForms,
  speakCurrentTask,
  setTypedAnswer,
  checkTyped,
}: Props) {
  return (
    <>
      <Text style={s.formLabel2}>{formLabel}</Text>

      <Text style={s.word} onPress={speakCurrentTask}>
        {prompt}
      </Text>

      <TextInput
        style={s.input}
        value={typedAnswer}
        onChangeText={setTypedAnswer}
        placeholder={ui('type_form')}
        placeholderTextColor={mutedColor}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!reviewSaved && !savingReview}
      />

      <TrainingGlassButton
        label={ui('check')}
        onPress={checkTyped}
        disabled={savingReview || reviewSaved}
        isDark={isDark}
        primary
      />

      {answerVisible ? (
        <TrainingFormsList
          forms={getAllForms(current)}
          title={ui('all_forms')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          fonts={fonts}
        />
      ) : null}
    </>
  );
}
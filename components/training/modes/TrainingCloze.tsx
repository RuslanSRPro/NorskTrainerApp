import { Text, TextInput } from 'react-native';

import { TrainingFormsList } from '../TrainingFormsList';
import { TrainingGlassButton } from '../TrainingGlassButton';
import { TrainingInfoBlock } from '../TrainingInfoBlock';

type Props = {
  current: any;
  prompt?: string;
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
  getClozeHint: (w: any) => string;
  setTypedAnswer: (value: string) => void;
  checkTyped: () => void;
};

export function TrainingCloze({
  current,
  prompt,
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
  getClozeHint,
  setTypedAnswer,
  checkTyped,
}: Props) {
  return (
    <>
      <Text style={s.prompt}>{prompt}</Text>

      {getClozeHint(current) ? (
        <TrainingInfoBlock isDark={isDark}>
          <Text style={s.hintLabel}>{ui('hint')}</Text>
          <Text style={s.hintText}>{getClozeHint(current)}</Text>
        </TrainingInfoBlock>
      ) : null}

      <TextInput
        style={s.input}
        value={typedAnswer}
        onChangeText={setTypedAnswer}
        placeholder={ui('fill_gap')}
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
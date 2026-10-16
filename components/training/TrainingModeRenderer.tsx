import { Text } from 'react-native';


import {
  TrainingCloze,
  TrainingChoice,
  TrainingFlashcard,
  TrainingFormsMode,
  TrainingTyping,
} from './modes';

import { TrainingInfoBlock } from './TrainingInfoBlock';
import type { TrainingDensity } from './TrainingCard';
import { TrainingTask } from './types';

type Props = {
  currentTask: TrainingTask;
  current: any;
  isDark: boolean;
  s: any;
  fonts: any;
  textColor: string;
  mutedColor: string;

  answerVisible: boolean;
  typedAnswer: string;
  feedback: string;
  savingReview: boolean;
  reviewSaved: boolean;

  ui: (key: any) => string;

  getMainWord: (w: any) => string;
  getTranslation: (w: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  getClozeHint: (w: any) => string;

  speakCurrentTask: () => void;
  selectChoice: (option: string) => void;
  setTypedAnswer: (value: string) => void;
  checkTyped: () => void;
  density?: TrainingDensity;
};

// Example sentence of the word with its Ukrainian translation, shown after the
// answer in the modes whose task does not already show it (flashcards show it
// on the card, cloze uses it as the task).
function AnswerExample({ current, answerVisible, isDark, s }: { current: any; answerVisible: boolean; isDark: boolean; s: any }) {
  if (!answerVisible || !current?.example) return null;
  return (
    <TrainingInfoBlock isDark={isDark}>
      <Text style={[s.example, { marginBottom: 0 }]}>{current.example}</Text>
      {current.example_translation_uk ? (
        <Text style={[s.example, { marginTop: 4, marginBottom: 0 }]}>{current.example_translation_uk}</Text>
      ) : null}
    </TrainingInfoBlock>
  );
}

export function TrainingModeRenderer({
  currentTask,
  current,
  isDark,
  s,
  fonts,
  textColor,
  mutedColor,
  answerVisible,
  typedAnswer,
  feedback,
  savingReview,
  reviewSaved,
  ui,
  getMainWord,
  getTranslation,
  getAllForms,
  getClozeHint,
  speakCurrentTask,
  selectChoice,
  setTypedAnswer,
  checkTyped,
  density = 'normal',
}: Props) {
  if (currentTask.mode === 'flashcards') {
    return (
      <>
        <TrainingFlashcard
          current={current}
          isDark={isDark}
          s={s}
          fonts={fonts}
          textColor={textColor}
          mutedColor={mutedColor}
          answerVisible={answerVisible}
          ui={ui}
          getMainWord={getMainWord}
          getTranslation={getTranslation}
          getAllForms={getAllForms}
          speakCurrentTask={speakCurrentTask}
          density={density}
        />

        {feedback ? (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.feedbackText}>{feedback}</Text>
          </TrainingInfoBlock>
        ) : null}
      </>
    );
  }

  if (currentTask.mode === 'choice') {
    return (
      <>
        <TrainingChoice
          current={current}
          options={currentTask.options}
          isDark={isDark}
          s={s}
          fonts={fonts}
          textColor={textColor}
          mutedColor={mutedColor}
          answerVisible={answerVisible}
          savingReview={savingReview}
          reviewSaved={reviewSaved}
          ui={ui}
          getMainWord={getMainWord}
          getAllForms={getAllForms}
          speakCurrentTask={speakCurrentTask}
          selectChoice={selectChoice}
          density={density}
        />

        <AnswerExample current={current} answerVisible={answerVisible} isDark={isDark} s={s} />

        {feedback ? (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.feedbackText}>{feedback}</Text>
          </TrainingInfoBlock>
        ) : null}
      </>
    );
  }

  if (currentTask.mode === 'typing') {
    return (
      <>
        <TrainingTyping
          current={current}
          prompt={currentTask.prompt}
          isDark={isDark}
          s={s}
          fonts={fonts}
          textColor={textColor}
          mutedColor={mutedColor}
          answerVisible={answerVisible}
          typedAnswer={typedAnswer}
          savingReview={savingReview}
          reviewSaved={reviewSaved}
          ui={ui}
          getAllForms={getAllForms}
          setTypedAnswer={setTypedAnswer}
          checkTyped={checkTyped}
        />

        <AnswerExample current={current} answerVisible={answerVisible} isDark={isDark} s={s} />

        {feedback ? (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.feedbackText}>{feedback}</Text>
          </TrainingInfoBlock>
        ) : null}
      </>
    );
  }

  if (currentTask.mode === 'cloze') {
    return (
      <>
        <TrainingCloze
          current={current}
          prompt={currentTask.prompt}
          isDark={isDark}
          s={s}
          fonts={fonts}
          textColor={textColor}
          mutedColor={mutedColor}
          answerVisible={answerVisible}
          typedAnswer={typedAnswer}
          savingReview={savingReview}
          reviewSaved={reviewSaved}
          ui={ui}
          getAllForms={getAllForms}
          getClozeHint={getClozeHint}
          setTypedAnswer={setTypedAnswer}
          checkTyped={checkTyped}
        />

        {feedback ? (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.feedbackText}>{feedback}</Text>
          </TrainingInfoBlock>
        ) : null}
      </>
    );
  }

  if (currentTask.mode === 'forms') {
    return (
      <>
        <TrainingFormsMode
          current={current}
          prompt={currentTask.prompt}
          formLabel={currentTask.formLabel}
          isDark={isDark}
          s={s}
          fonts={fonts}
          textColor={textColor}
          mutedColor={mutedColor}
          answerVisible={answerVisible}
          typedAnswer={typedAnswer}
          savingReview={savingReview}
          reviewSaved={reviewSaved}
          ui={ui}
          getAllForms={getAllForms}
          speakCurrentTask={speakCurrentTask}
          setTypedAnswer={setTypedAnswer}
          checkTyped={checkTyped}
        />

        <AnswerExample current={current} answerVisible={answerVisible} isDark={isDark} s={s} />

        {feedback ? (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.feedbackText}>{feedback}</Text>
          </TrainingInfoBlock>
        ) : null}
      </>
    );
  }

  return null;
}
import { Text, View } from 'react-native';

import { TrainingFormsList } from '../TrainingFormsList';
import { TrainingInfoBlock } from '../TrainingInfoBlock';

type Props = {
  current: any;
  isDark: boolean;
  s: any;
  fonts: any;
  textColor: string;
  mutedColor: string;
  answerVisible: boolean;
  ui: (key: any) => string;
  getMainWord: (w: any) => string;
  getTranslation: (w: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  speakCurrentTask: () => void;
};

export function TrainingFlashcard({
  current,
  isDark,
  s,
  fonts,
  textColor,
  mutedColor,
  answerVisible,
  ui,
  getMainWord,
  getTranslation,
  getAllForms,
  speakCurrentTask,
}: Props) {
  return (
    <>
      <Text style={s.word} onPress={speakCurrentTask}>
        {getMainWord(current)}
      </Text>

      {current.example ? (
        <Text style={s.example}>{current.example}</Text>
      ) : null}

      <View style={s.answerArea}>
        {answerVisible ? (
          <>
            <TrainingInfoBlock isDark={isDark}>
              <Text style={s.answerLabel}>{ui('translation')}</Text>
              <Text
                style={[
                  s.answerText,
                  {
                    fontSize:
                      getTranslation(current).length > 30
                        ? fonts.base
                        : fonts.translation,
                  },
                ]}
              >
                {getTranslation(current)}
              </Text>
            </TrainingInfoBlock>

            <TrainingFormsList
              forms={getAllForms(current)}
              title={ui('forms')}
              isDark={isDark}
              textColor={textColor}
              mutedColor={mutedColor}
              fonts={fonts}
            />
          </>
        ) : (
          <TrainingInfoBlock isDark={isDark}>
            <Text style={s.tapHintText}>{ui('tap_to_reveal')}</Text>
          </TrainingInfoBlock>
        )}
      </View>
    </>
  );
}
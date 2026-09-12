import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  SavedTranscriptSegment,
  TranslationTarget,
} from '@/features/audio/lectureTypes';

import {
  TranscriptView,
} from '@/components/audio/TranscriptView';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';


type TranslationPanelProps = {
  target: TranslationTarget;
  translating: boolean;
  processing: boolean;
  translatedText: string;
  translatedSegments:
    SavedTranscriptSegment[];
  error: string | null;
  accent: string;
  textSecondary: string;
  fontBase: number;
  isCurrent: boolean;
  isLoaded: boolean;
  currentTime: number;
  onSeek: (
    seconds:
      number
  ) => void;
  onTarget: (
    target: TranslationTarget
  ) => void;
  onTranslate: () => void;
  showTargetSelector?: boolean;
};


export function TranslationPanel({
  target,
  translating,
  processing,
  translatedText,
  translatedSegments,
  error,
  accent,
  textSecondary,
  fontBase,
  isCurrent,
  isLoaded,
  currentTime,
  onSeek,
  onTarget,
  onTranslate,
  showTargetSelector = true,
}: TranslationPanelProps) {

  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  return (
    <View
      style={
        styles.translationSection
      }
    >

      {showTargetSelector && (
        <>
          <Text
            style={[
              styles.translationTitle,
              {
                color:
                  textSecondary,
                fontSize:
                  fontBase,
              },
            ]}
          >
            {audioUi.quickTranslation}
          </Text>

          <View
            style={
              styles.translationLanguageRow
            }
          >
            {(
              [
                ['uk', audioUi.ukrainian],
                ['ru', audioUi.russian],
              ] as const
            ).map(
              ([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={
                    value === 'uk'
                      ? audioUi.selectUkrainianTranslation
                      : audioUi.selectRussianTranslation
                  }
                  disabled={processing}
                  onPress={() =>
                    onTarget(
                      value
                    )
                  }
                  style={[
                    styles.translationLanguageButton,
                    {
                      borderColor:
                        accent,
                      backgroundColor:
                        target === value
                          ? accent
                          : 'transparent',
                      opacity:
                        processing
                          ? 0.45
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.translationLanguageText,
                      {
                        color:
                          target === value
                            ? '#FFFFFF'
                            : accent,
                        fontSize:
                          fontBase - 2,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          translatedText
            ? audioUi.translateAgainAccessibility
            : audioUi.translateAccessibility
        }
        disabled={processing}
        onPress={onTranslate}
        style={[
          styles.translateButton,
          {
            borderColor:
              accent,
            opacity:
              processing
                ? 0.45
                : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.translateButtonText,
            {
              color:
                accent,
              fontSize:
                fontBase - 1,
            },
          ]}
        >
          {translating
            ? audioUi.translatingOnDevice
            : translatedText
              ? audioUi.translateAgainGoogle
              : audioUi.translateGoogle}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.translationInfo,
          {
            color:
              textSecondary,
            fontSize:
              fontBase - 3,
          },
        ]}
      >
        {audioUi.translationInfo}
      </Text>

      {!!error && (
        <Text
          style={[
            styles.translationError,
            {
              color:
                textSecondary,
              fontSize:
                fontBase - 2,
            },
          ]}
        >
          {error}
        </Text>
      )}

      {!!translatedText && (
        <View
          style={
            styles.translationResult
          }
        >
          <TranscriptView
            segments={
              translatedSegments
            }
            fallbackText={
              translatedText
            }
            isCurrent={
              isCurrent
            }
            isLoaded={
              isLoaded
            }
            currentTime={
              currentTime
            }
            accent={
              accent
            }
            textSecondary={
              textSecondary
            }
            fontBase={
              fontBase
            }
            onSeek={
              onSeek
            }
          />

          <Text
            style={[
              styles.translationAttribution,
              {
                color:
                  textSecondary,
                fontSize:
                  fontBase - 3,
              },
            ]}
          >
            {audioUi.translationAttribution}
          </Text>
        </View>
      )}

    </View>
  );
}


const styles =
  StyleSheet.create({
    translationSection: {
      marginTop: 4,
    },

    translationTitle: {
      fontWeight: '800',
      marginBottom: 10,
    },

    translationLanguageRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },

    translationLanguageButton: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    translationLanguageText: {
      fontWeight: '800',
      textAlign: 'center',
    },

    translateButton: {
      minHeight: 40,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },

    translateButtonText: {
      fontWeight: '800',
      textAlign: 'center',
    },

    translationInfo: {
      marginTop: 8,
      lineHeight: 17,
      fontWeight: '600',
    },

    translationError: {
      marginTop: 10,
      lineHeight: 19,
      fontWeight: '700',
    },

    translationResult: {
      marginTop: 14,
    },

    translationAttribution: {
      marginTop: 10,
      lineHeight: 16,
      fontWeight: '600',
    },
  });

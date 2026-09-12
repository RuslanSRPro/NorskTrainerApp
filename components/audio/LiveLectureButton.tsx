import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  LectureSourceLanguage,
  TranslationTarget,
} from '@/features/audio/lectureTypes';

import {
  formatTime,
  getLectureLanguageUi,
} from '@/features/audio/lectureStorage';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useLiveLecture,
} from '@/hooks/audio/useLiveLecture';

import {
  useTheme,
} from '@/contexts/ThemeContext';

import {
  useSettingsStore,
} from '@/store/settingsStore';

type Props = {
  sourceLanguage:
    LectureSourceLanguage;
  translationTarget:
    TranslationTarget;
  disabled?: boolean;
  beforeStart?:
    () => void | Promise<void>;
  loadLectures:
    () => void;
  onBusyChange?:
    (busy: boolean) => void;
  onSaved?:
    (lectureId: string) => void;
};

function tail(
  value: string,
  maxChars = 2600
) {
  const text =
    String(value || '').trim();

  if (
    text.length <=
      maxChars
  ) {
    return text;
  }

  return `…${text.slice(
    -maxChars
  )}`;
}

export function LiveLectureButton({
  sourceLanguage,
  translationTarget,
  disabled = false,
  beforeStart,
  loadLectures,
  onBusyChange,
  onSaved,
}: Props) {
  const {
    theme,
    fonts,
    themeName,
  } = useTheme();

  const {
    app_language,
  } = useSettingsStore();

  const copy =
    getAudioUiText(
      app_language
    );

  const live =
    useLiveLecture({
      sourceLanguage,
      translationTarget,
      beforeStart,
      loadLectures,
      onBusyChange,
      onSaved,
    });

  const sourceUi =
    getLectureLanguageUi(
      sourceLanguage
    );

  const targetFlag =
    translationTarget === 'ru'
      ? '🇷🇺'
      : '🇺🇦';

  const isDark =
    themeName === 'dark';

  const modalVisible =
    live.phase !== 'idle';

  const statusText =
    live.phase === 'preparing'
      ? copy.livePreparing
      : live.phase === 'finalizing'
        ? copy.liveFinalizing
        : live.phase === 'saved'
          ? copy.liveSaved
          : live.phase === 'error'
            ? copy.liveError
            : copy.liveListening;

  const canClose =
    live.phase === 'saved' ||
    (
      live.phase === 'error' &&
      !live.isBusy
    );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.live} ${targetFlag}`}
        disabled={
          disabled ||
          live.isBusy
        }
        onPress={() => {
          void live.start();
        }}
        style={[
          styles.liveButton,
          {
            borderColor:
              theme.accent,
            backgroundColor:
              live.isBusy
                ? theme.accent
                : 'transparent',
            opacity:
              disabled
                ? 0.45
                : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.liveButtonText,
            {
              color:
                live.isBusy
                  ? '#FFFFFF'
                  : theme.accent,
              fontSize:
                fonts.base,
            },
          ]}
        >
          ● {copy.live} {targetFlag}
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (canClose) {
            live.reset();
          }
        }}
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor:
                  isDark
                    ? 'rgba(28,28,30,0.97)'
                    : 'rgba(250,250,250,0.98)',
                borderColor:
                  theme.accent,
              },
            ]}
          >
            <View
              style={
                styles.headerRow
              }
            >
              <Text
                style={[
                  styles.title,
                  {
                    color:
                      theme.textPrimary,
                    fontSize:
                      fonts.base + 3,
                  },
                ]}
              >
                ● {copy.liveTitle}
              </Text>

              <Text
                style={[
                  styles.timer,
                  {
                    color:
                      theme.accent,
                  },
                ]}
              >
                {formatTime(
                  live.elapsedMillis
                )}
              </Text>
            </View>

            <Text
              style={[
                styles.route,
                {
                  color:
                    theme.textSecondary,
                },
              ]}
            >
              {sourceUi.flag} {sourceUi.code}
              {'  →  '}
              {targetFlag}
              {' '}
              {translationTarget.toUpperCase()}
            </Text>

            <Text
              style={[
                styles.status,
                {
                  color:
                    live.phase === 'error'
                      ? '#C94B4B'
                      : theme.textSecondary,
                },
              ]}
            >
              {statusText}
            </Text>

            {live.error && (
              <Text
                style={
                  styles.errorText
                }
              >
                {live.error}
              </Text>
            )}

            <ScrollView
              style={
                styles.textArea
              }
              contentContainerStyle={
                styles.textAreaContent
              }
              showsVerticalScrollIndicator
            >
              <Text
                style={[
                  styles.sectionLabel,
                  {
                    color:
                      theme.accent,
                  },
                ]}
              >
                {copy.liveSource}
              </Text>

              <Text
                style={[
                  styles.liveText,
                  {
                    color:
                      theme.textPrimary,
                  },
                ]}
              >
                {tail(
                  live.sourceText
                ) ||
                  copy.liveWaiting}
              </Text>

              <Text
                style={[
                  styles.sectionLabel,
                  styles.translationLabel,
                  {
                    color:
                      theme.accent,
                  },
                ]}
              >
                {copy.liveTranslation}
              </Text>

              <Text
                style={[
                  styles.liveText,
                  {
                    color:
                      theme.textPrimary,
                  },
                ]}
              >
                {tail(
                  live.translationText
                ) ||
                  copy.liveWaiting}
              </Text>
            </ScrollView>

            {canClose ? (
              <Pressable
                accessibilityRole="button"
                onPress={
                  live.reset
                }
                style={[
                  styles.stopButton,
                  {
                    backgroundColor:
                      theme.accent,
                  },
                ]}
              >
                <Text
                  style={
                    styles.stopText
                  }
                >
                  {copy.close}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={
                  live.phase ===
                    'finalizing' ||
                  live.phase ===
                    'preparing'
                }
                onPress={() => {
                  void live.stop();
                }}
                style={[
                  styles.stopButton,
                  {
                    backgroundColor:
                      '#C94B4B',
                    opacity:
                      live.phase ===
                        'finalizing' ||
                      live.phase ===
                        'preparing'
                        ? 0.6
                        : 1,
                  },
                ]}
              >
                <Text
                  style={
                    styles.stopText
                  }
                >
                  {live.phase ===
                  'finalizing'
                    ? copy.processing
                    : copy.stopLive}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    liveButton: {
      minHeight: 56,
      minWidth: 112,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    liveButtonText: {
      fontWeight: '900',
      textAlign: 'center',
    },
    overlay: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.55)',
    },
    modalCard: {
      maxHeight: '82%',
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      flex: 1,
      fontWeight: '900',
    },
    timer: {
      fontSize: 20,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
    },
    route: {
      marginTop: 8,
      fontWeight: '800',
    },
    status: {
      marginTop: 7,
      fontWeight: '700',
    },
    errorText: {
      marginTop: 10,
      color: '#C94B4B',
      fontWeight: '700',
      lineHeight: 20,
    },
    textArea: {
      marginTop: 16,
    },
    textAreaContent: {
      paddingBottom: 8,
    },
    sectionLabel: {
      fontWeight: '900',
      marginBottom: 6,
    },
    translationLabel: {
      marginTop: 18,
    },
    liveText: {
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '600',
    },
    stopButton: {
      marginTop: 18,
      minHeight: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    stopText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  TranslationTarget,
} from '@/features/audio/lectureTypes';

type Props = {
  target:
    TranslationTarget;
  translating:
    boolean;
  processing:
    boolean;
  translatedText:
    string;
  error:
    string | null;
  accent:
    string;
  textSecondary:
    string;
  fontBase:
    number;
  onTarget:
    (
      target:
        TranslationTarget
    ) => void;
  onTranslate:
    () => void;
};

export function TranslationPanel({
  target,
  translating,
  processing,
  translatedText,
  error,
  accent,
  textSecondary,
  fontBase,
  onTarget,
  onTranslate,
}: Props) {
  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.title,
          {
            color:
              textSecondary,
            fontSize:
              fontBase,
          },
        ]}
      >
        Quick translation
      </Text>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Translate to Ukrainian"
          accessibilityState={{
            selected:
              target ===
                'uk',
          }}
          disabled={
            processing
          }
          onPress={() =>
            onTarget('uk')
          }
          style={[
            styles.choice,
            {
              borderColor:
                accent,
              backgroundColor:
                target === 'uk'
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
              styles.choiceText,
              {
                color:
                  target === 'uk'
                    ? '#FFFFFF'
                    : accent,
                fontSize:
                  fontBase - 2,
              },
            ]}
          >
            Українська
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Translate to Russian"
          accessibilityState={{
            selected:
              target ===
                'ru',
          }}
          disabled={
            processing
          }
          onPress={() =>
            onTarget('ru')
          }
          style={[
            styles.choice,
            {
              borderColor:
                accent,
              backgroundColor:
                target === 'ru'
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
              styles.choiceText,
              {
                color:
                  target === 'ru'
                    ? '#FFFFFF'
                    : accent,
                fontSize:
                  fontBase - 2,
              },
            ]}
          >
            Русский
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Translate transcript with Google offline"
        disabled={
          processing
        }
        onPress={
          onTranslate
        }
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
            ? '… Translating on this iPhone'
            : translatedText
              ? 'Translate again with Google'
              : 'Translate with Google'}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.info,
          {
            color:
              textSecondary,
            fontSize:
              fontBase - 3,
          },
        ]}
      >
        Google ML Kit works on-device after the language model is downloaded. First use requires Wi-Fi.
      </Text>

      {!!error && (
        <Text
          style={[
            styles.error,
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
        <View style={styles.result}>
          <Text
            selectable
            style={[
              styles.translationText,
              {
                color:
                  textSecondary,
                fontSize:
                  fontBase,
              },
            ]}
          >
            {translatedText}
          </Text>

          <Text
            style={[
              styles.attribution,
              {
                color:
                  textSecondary,
                fontSize:
                  fontBase - 3,
              },
            ]}
          >
            Automatic translation powered by Google Translate
          </Text>
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        'rgba(128,128,128,0.35)',
    },
    title: {
      fontWeight: '900',
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    choice: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    choiceText: {
      fontWeight: '800',
      textAlign: 'center',
    },
    translateButton: {
      minHeight: 42,
      borderWidth: 1.5,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    translateButtonText: {
      fontWeight: '900',
      textAlign: 'center',
    },
    info: {
      marginTop: 8,
      lineHeight: 17,
      fontWeight: '600',
    },
    error: {
      marginTop: 10,
      lineHeight: 19,
      fontWeight: '700',
    },
    result: {
      marginTop: 16,
    },
    translationText: {
      lineHeight: 24,
      fontWeight: '500',
    },
    attribution: {
      marginTop: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
  });

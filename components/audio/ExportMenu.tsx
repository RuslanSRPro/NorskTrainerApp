import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  LectureExportKind,
} from '@/hooks/audio/useLectureExport';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';


type Props = {
  accent: string;
  textSecondary: string;
  fontBase: number;
  disabled: boolean;
  onExport: (
    kind: LectureExportKind
  ) => void;
};


export function ExportMenu({
  accent,
  textSecondary,
  fontBase,
  disabled,
  onExport,
}: Props) {
  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const options = [
    [
      'audio',
      audioUi.exportAudio,
    ],
    [
      'transcript',
      audioUi.exportTranscript,
    ],
    [
      'ukrainian',
      audioUi.exportUkrainian,
    ],
    [
      'timestamps',
      audioUi.exportTimestamps,
    ],
    [
      'zip',
      audioUi.exportZip,
    ],
  ] as const satisfies readonly (
    readonly [
      LectureExportKind,
      string,
    ]
  )[];

  return (
    <View
      style={
        styles.box
      }
    >
      <Text
        style={[
          styles.title,
          {
            color:
              textSecondary,
            fontSize:
              fontBase - 2,
          },
        ]}
      >
        {audioUi.exportThisLecture}
      </Text>

      {options.map(
        ([kind, label]) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            onPress={() =>
              onExport(kind)
            }
            style={[
              styles.option,
              {
                borderColor:
                  accent,
                opacity:
                  disabled
                    ? 0.45
                    : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color:
                    accent,
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
  );
}


const styles =
  StyleSheet.create({
    box: {
      marginTop: 10,
      padding: 10,
      borderRadius: 13,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        'rgba(128,128,128,0.35)',
      gap: 7,
    },
    title: {
      fontWeight: '900',
      marginBottom: 2,
    },
    option: {
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 11,
      justifyContent: 'center',
      paddingHorizontal: 11,
    },
    optionText: {
      fontWeight: '800',
    },
  });

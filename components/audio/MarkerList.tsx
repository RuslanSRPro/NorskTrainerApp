import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  LectureMarker,
} from '@/features/audio/lectureTypes';

import {
  formatTime,
} from '@/features/audio/lectureStorage';

import {
  getAudioMarkerLabel,
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';


type Props = {
  markers: LectureMarker[];
  accent: string;
  textSecondary: string;
  fontBase: number;
  onSeek: (
    milliseconds: number
  ) => void;
};


export function MarkerList({
  markers,
  accent,
  textSecondary,
  fontBase,
  onSeek,
}: Props) {
  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  if (
    markers.length === 0
  ) {
    return null;
  }

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
        {audioUi.markedMoments}
      </Text>

      <View
        style={
          styles.wrap
        }
      >
        {markers.map(
          marker => (
            <Pressable
              key={
                marker.id
              }
              accessibilityRole="button"
              accessibilityLabel={
                `${getAudioMarkerLabel(marker.type, app_language)} ${formatTime(marker.timeMillis)}`
              }
              onPress={() =>
                onSeek(
                  marker.timeMillis
                )
              }
              style={[
                styles.button,
                {
                  borderColor:
                    accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.text,
                  {
                    color:
                      accent,
                    fontSize:
                      fontBase - 3,
                  },
                ]}
              >
                {getAudioMarkerLabel(
                  marker.type,
                  app_language
                )}
                {' · '}
                {formatTime(
                  marker.timeMillis
                )}
              </Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}


const styles =
  StyleSheet.create({
    box: {
      marginTop: 12,
    },
    title: {
      fontWeight: '900',
      marginBottom: 7,
    },
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    button: {
      borderWidth: 1,
      borderRadius: 999,
      minHeight: 32,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      fontWeight: '800',
    },
  });

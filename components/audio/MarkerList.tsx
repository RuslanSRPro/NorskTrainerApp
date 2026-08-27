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
  markerLabel,
} from '@/features/audio/lectureStorage';

type Props = {
  markers:
    LectureMarker[];
  accent:
    string;
  textSecondary:
    string;
  fontBase:
    number;
  onSeek:
    (
      milliseconds:
        number
    ) => void;
};

export function MarkerList({
  markers,
  accent,
  textSecondary,
  fontBase,
  onSeek,
}: Props) {
  if (
    markers.length ===
      0
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
        Marked moments
      </Text>

      <View
        style={
          styles.wrap
        }
      >
        {markers.map(
          marker => {
            const label =
              `${markerLabel(
                marker.type
              )} · ${formatTime(
                marker.timeMillis
              )}`;

            return (
              <Pressable
                key={
                  marker.id
                }
                accessibilityRole="button"
                accessibilityLabel={
                  `Play ${label}`
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
                  {label}
                </Text>
              </Pressable>
            );
          }
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

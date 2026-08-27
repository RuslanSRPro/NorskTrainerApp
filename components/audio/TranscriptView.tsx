import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  SavedTranscriptSegment,
} from '@/features/audio/lectureTypes';

import {
  formatPlaybackTime,
} from '@/features/audio/lectureStorage';

type Props = {
  segments:
    SavedTranscriptSegment[];
  fallbackText:
    string;
  isCurrent:
    boolean;
  isLoaded:
    boolean;
  currentTime:
    number;
  accent:
    string;
  textSecondary:
    string;
  fontBase:
    number;
  onSeek:
    (
      seconds:
        number
    ) => void;
};

export function TranscriptView({
  segments,
  fallbackText,
  isCurrent,
  isLoaded,
  currentTime,
  accent,
  textSecondary,
  fontBase,
  onSeek,
}: Props) {
  if (
    segments.length ===
      0
  ) {
    return (
      <Text
        selectable
        style={[
          styles.fallback,
          {
            color:
              textSecondary,
            fontSize:
              fontBase,
          },
        ]}
      >
        {fallbackText}
      </Text>
    );
  }

  return (
    <View
      style={
        styles.list
      }
    >
      {segments.map(
        (
          segment,
          index
        ) => {
          const active =
            isCurrent &&
            isLoaded &&
            currentTime >=
              segment.start &&
            currentTime <
              Math.max(
                segment.end,
                segment.start +
                  0.1
              );

          const timestamp =
            formatPlaybackTime(
              segment.start
            );

          return (
            <Pressable
              key={
                `${segment.start}-${index}`
              }
              accessibilityRole="button"
              accessibilityLabel={
                `Play transcript from ${timestamp}: ${segment.text}`
              }
              onPress={() =>
                onSeek(
                  segment.start
                )
              }
              style={[
                styles.row,
                {
                  backgroundColor:
                    active
                      ? `${accent}18`
                      : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.timestamp,
                  {
                    color:
                      accent,
                    fontSize:
                      fontBase - 3,
                  },
                ]}
              >
                {timestamp}
              </Text>

              <Text
                selectable
                style={[
                  styles.text,
                  {
                    color:
                      textSecondary,
                    fontSize:
                      fontBase,
                  },
                ]}
              >
                {segment.text}
              </Text>
            </Pressable>
          );
        }
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    list: {
      gap: 3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    timestamp: {
      minWidth: 44,
      fontWeight: '900',
      paddingTop: 2,
    },
    text: {
      flex: 1,
      lineHeight: 24,
      fontWeight: '500',
    },
    fallback: {
      lineHeight: 24,
      fontWeight: '500',
    },
  });

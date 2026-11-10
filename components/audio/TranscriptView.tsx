import { useMemo, useState } from 'react';
import { stitchTranscriptSegments, transcriptReviewGaps, transcriptNeedsReview } from '@/features/audio/transcriptQuality';
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
  speakerLabel,
} from '@/features/audio/lectureStorage';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';

type Props = {
  reviewDurationSeconds?: number;
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
  segments: originalSegments,
  reviewDurationSeconds,
  fallbackText,
  isCurrent,
  isLoaded,
  currentTime,
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

  const [showGaps, setShowGaps] = useState(false);
  const segments = useMemo(() => reviewDurationSeconds === undefined
    ? originalSegments : stitchTranscriptSegments(originalSegments), [originalSegments, reviewDurationSeconds]);
  const gaps = useMemo(() => transcriptReviewGaps(segments, reviewDurationSeconds ?? 0),
    [segments, reviewDurationSeconds]);
  const language = app_language === 'no' ? 'no' : app_language === 'en' ? 'en' : 'ua';
  const gapCopy = {
    ua: ['Інтервали без тексту', 'Це можуть бути паузи. Натисніть на час, щоб прослухати й перевірити, чи була мова.'],
    en: ['Intervals without text', 'These may be pauses. Tap a time to listen and check whether anyone was speaking.'],
    no: ['Intervaller uten tekst', 'Dette kan være pauser. Trykk på et tidspunkt for å lytte og sjekke om noen snakket.'],
  }[language];

  const reviewFlags = useMemo(() => segments.map(segment =>
    reviewDurationSeconds !== undefined && transcriptNeedsReview(segment)), [segments, reviewDurationSeconds]);
  const reviewCount = reviewFlags.filter(Boolean).length;
  const reviewCopy = {
    ua: ['Варто прослухати', 'Розпізнавання менш упевнене. Це не обов’язково помилка. Натисніть на позначений фрагмент, щоб прослухати; текст збережено повністю.'],
    en: ['Worth checking', 'Recognition is less confident, which does not necessarily mean an error. Tap a marked passage to listen; all text is preserved.'],
    no: ['Bør lyttes gjennom', 'Gjenkjenningen er mindre sikker, men teksten er ikke nødvendigvis feil. Trykk på et merket avsnitt for å lytte; all tekst er bevart.'],
  }[language];

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
      {reviewCount > 0 && <View style={{gap: 4, paddingVertical: 8}}>
        <Text style={{color: accent, fontSize: fontBase, fontWeight: '700'}}>{reviewCopy[0]} ({reviewCount})</Text>
        <Text style={{color: textSecondary, fontSize: fontBase - 2}}>{reviewCopy[1]}</Text>
      </View>}
      {gaps.length > 0 && <View style={{gap: 8}}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded: showGaps}}
          onPress={() => setShowGaps(value => !value)} style={{minHeight: 44, justifyContent: 'center'}}>
          <Text style={{color: accent, fontSize: fontBase}}>{gapCopy[0]} ({gaps.length})</Text>
        </Pressable>
        {showGaps && <>
          <Text style={{color: textSecondary}}>{gapCopy[1]}</Text>
          {gaps.map(gap => <Pressable key={`${gap.start}-${gap.end}`} accessibilityRole="button"
            onPress={() => onSeek(Math.max(0, gap.start - 1))}
            style={{minHeight: 44, justifyContent: 'center'}}>
            <Text style={{color: accent}}>{formatPlaybackTime(gap.start)}–{formatPlaybackTime(gap.end)}</Text>
          </Pressable>)}
        </>}
      </View>}
      {segments.map(
        (
          segment,
          index
        ) => {
          const needsReview = reviewFlags[index];
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
                `${needsReview ? `${reviewCopy[0]}. ` : ''}${audioUi.playTranscriptFrom} ${timestamp}: ${speakerLabel(segment, String(app_language))} ${segment.text}`
              }
              onPress={() =>
                onSeek(
                  needsReview ? Math.max(0, segment.start - 1) : segment.start
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

              <View style={{flex: 1}}>
              {needsReview && <Text style={{color: accent, fontSize: fontBase - 3, fontWeight: '700'}}>
                ◇ {reviewCopy[0]}
              </Text>}
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
                {speakerLabel(segment, String(app_language)) ? `${speakerLabel(segment, String(app_language))}: ` : ''}{segment.text}
              </Text>
              </View>
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
      minHeight: 44,
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
      lineHeight: 24,
      fontWeight: '500',
    },
    fallback: {
      lineHeight: 24,
      fontWeight: '500',
    },
  });

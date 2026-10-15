import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';

import {
  Alert,
} from 'react-native';

import {
  File,
} from 'expo-file-system';

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

import WhisperKitLocal, {
  WHISPERKIT_DEFAULT_MODEL,
  type WhisperProgressEvent,
  type WhisperSegment,
} from '@/modules/whisperkitlocal';

import LectureRecorder from '@/modules/lecturerecorder';

import type {
  LectureItem,
  LectureTranscription,
  SavedTranscriptSegment,
} from '@/features/audio/lectureTypes';

import {
  createChunkPlan,
  getLectureDirectory,
  getTranslationFileName,
  getTranslationSegmentsFileName,
  getWhisperLanguageCode,
  isMeaningfulTranscriptText,
  readMetadata,
  writeJsonArray,
  writeMetadata,
} from '@/features/audio/lectureStorage';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';

const KEEP_AWAKE_TAG =
  'lecture-whisper-transcription';

type ProcessingLock =
  'transcription' |
  'translation' |
  null;

type TranscriptReadyPayload = {
  lecture:
    LectureItem;
  text:
    string;
  segments:
    SavedTranscriptSegment[];
  isRetranscription:
    boolean;
};

type Params = {
  processingLockRef:
    MutableRefObject<
      ProcessingLock
    >;
  loadLectures:
    () => void;
  onTranscriptReady:
    (
      payload:
        TranscriptReadyPayload
    ) => void;
  onTranslationsInvalidated:
    () => void;
};

type DurableRecordingManifestSegment = {
  index: number;
  file: string;
  durationMillis: number;
  bytes: number;
  status: string;
};

type DurableRecordingManifest = {
  segments?: DurableRecordingManifestSegment[];
};

type SegmentTranscriptionSource = {
  uri: string;
  durationSeconds: number;
  globalStartSeconds: number;
};

const SEGMENT_TRANSCRIPTION_OVERLAP_SECONDS = 3;

function getCommittedSegmentSources(
  directory: ReturnType<typeof getLectureDirectory>
): SegmentTranscriptionSource[] {
  const manifestFile = new File(
    directory,
    'recording-manifest.json'
  );

  if (!manifestFile.exists) {
    return [];
  }

  let manifest: DurableRecordingManifest;

  try {
    manifest = JSON.parse(
      manifestFile.textSync()
    ) as DurableRecordingManifest;
  } catch {
    return [];
  }

  const manifestSegments = Array.isArray(
    manifest.segments
  )
    ? manifest.segments
    : [];

  let globalStartSeconds = 0;
  const sources: SegmentTranscriptionSource[] = [];

  for (const segment of manifestSegments) {
    if (
      segment.status !== 'committed' ||
      !segment.file ||
      !Number.isFinite(segment.durationMillis) ||
      segment.durationMillis <= 0 ||
      !Number.isFinite(segment.bytes) ||
      segment.bytes <= 0
    ) {
      return [];
    }

    const file = new File(
      directory,
      '.audio-segments',
      segment.file
    );

    if (
      !file.exists ||
      (file.size ?? 0) <= 0
    ) {
      return [];
    }

    sources.push({
      uri: file.uri,
      durationSeconds:
        segment.durationMillis / 1000,
      globalStartSeconds,
    });

    globalStartSeconds +=
      segment.durationMillis / 1000;
  }

  return sources;
}

function normalizeTranscriptKey(
  value: string
) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function appendTextWithBoundaryDedup(
  existing: string,
  incoming: string
) {
  const left = existing.trim();
  const right = incoming.trim();

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const leftWords = left.split(/\s+/);
  const rightWords = right.split(/\s+/);
  const maxOverlap = Math.min(
    16,
    leftWords.length,
    rightWords.length
  );

  for (
    let count = maxOverlap;
    count >= 1;
    count -= 1
  ) {
    const leftTail = normalizeTranscriptKey(
      leftWords.slice(-count).join(' ')
    );
    const rightHead = normalizeTranscriptKey(
      rightWords.slice(0, count).join(' ')
    );

    if (
      leftTail &&
      leftTail === rightHead
    ) {
      return [
        left,
        rightWords.slice(count).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
    }
  }

  return `${left} ${right}`.trim();
}

function mergeSegmentTranscriptWindows(
  windows: Array<{
    currentStartSeconds: number;
    segments: SavedTranscriptSegment[];
  }>
) {
  const merged: SavedTranscriptSegment[] = [];

  for (const window of windows) {
    const candidates = window.segments
      .filter(
        segment =>
          segment.end >
            window.currentStartSeconds - 0.05 &&
          isMeaningfulTranscriptText(
            segment.text
          )
      )
      .sort(
        (a, b) =>
          a.start - b.start
      );

    for (const candidate of candidates) {
      const previous = merged.at(-1);

      if (previous) {
        const previousKey = normalizeTranscriptKey(
          previous.text
        );
        const candidateKey = normalizeTranscriptKey(
          candidate.text
        );
        const overlapsInTime =
          candidate.start <=
          previous.end + 0.35;
        const sameBoundaryText =
          previousKey.length > 0 &&
          candidateKey.length > 0 &&
          (
            previousKey === candidateKey ||
            previousKey.endsWith(candidateKey) ||
            candidateKey.startsWith(previousKey)
          );

        if (
          overlapsInTime &&
          sameBoundaryText
        ) {
          if (
            candidate.end > previous.end
          ) {
            merged[merged.length - 1] = {
              ...candidate,
              start: Math.min(
                previous.start,
                candidate.start
              ),
            };
          }
          continue;
        }
      }

      merged.push(candidate);
    }
  }

  let text = '';

  for (const segment of merged) {
    text = appendTextWithBoundaryDedup(
      text,
      segment.text
    );
  }

  return {
    text,
    segments: merged,
  };
}

export function useLectureTranscription({
  processingLockRef,
  loadLectures,
  onTranscriptReady,
  onTranslationsInvalidated,
}: Params) {
  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const [
    transcribingLectureId,
    setTranscribingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    whisperStage,
    setWhisperStage,
  ] =
    useState('');

  const [
    retranscribingLectureId,
    setRetranscribingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const isRetranscribingRef =
    useRef(false);

  const [
    liveTranscript,
    setLiveTranscript,
  ] =
    useState('');

  const [
    transcriptionError,
    setTranscriptionError,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    const subscription =
      WhisperKitLocal.addListener(
        'onProgress',
        (
          event:
            WhisperProgressEvent
        ) => {
          setWhisperStage(
            event.stage
          );

          if (
            !isRetranscribingRef.current &&
            event.text &&
            event.text.trim()
          ) {
            setLiveTranscript(
              event.text.trim()
            );
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleCreateTranscript =
    async (
      lecture:
        LectureItem,
      options?: {
        isRetranscription?:
          boolean;
      }
    ) => {
      if (
        lecture.recordingState ===
          'interrupted'
      ) {
        Alert.alert(
          audioUi.recordingInterruptedTitle,
          audioUi.recordingInterruptedCannotTranscribe
        );
        return;
      }

      if (
        transcribingLectureId ||
        processingLockRef.current
      ) {
        return;
      }

      const isRetranscription =
        options?.isRetranscription ===
          true;

      processingLockRef.current =
        'transcription';

      isRetranscribingRef.current =
        isRetranscription;

      try {
        setTranscribingLectureId(
          lecture.id
        );

        setRetranscribingLectureId(
          isRetranscription
            ? lecture.id
            : null
        );

        await activateKeepAwakeAsync(
          KEEP_AWAKE_TAG
        );

        setTranscriptionError(
          null
        );

        setLiveTranscript(
          ''
        );

        setWhisperStage(
          'preparing-model'
        );

        const directory =
          getLectureDirectory(
            lecture.id
          );

        const metadata =
          readMetadata(
            directory
          );

        const baseTranscription =
          metadata.transcription ??
          createChunkPlan(
            lecture.durationMillis
          );

        const transcription:
          LectureTranscription = {
            ...baseTranscription,
            mode:
              'whisperkit-local',
            status:
              'processing',
            error:
              null,
            chunks:
              baseTranscription
                .chunks
                .map(
                  chunk => ({
                    ...chunk,
                  })
                ),
          };

        writeMetadata(
          directory,
          {
            ...metadata,
            id:
              lecture.id,
            createdAt:
              lecture.createdAt,
            durationMillis:
              lecture.durationMillis,
            language:
              lecture.language,
            audioFile:
              lecture.audioFileName,
            transcription,
          }
        );

        loadLectures();

        let finalAudioUsable = false;

        if (lecture.audioUri.length > 0) {
          const validation =
            await LectureRecorder.validateRecording(
              lecture.audioUri
            );

          finalAudioUsable =
            validation.valid &&
            validation.playable &&
            validation.bytes >= 4096 &&
            validation.durationMillis >= 500;
        }

        const segmentSources = finalAudioUsable
          ? []
          : getCommittedSegmentSources(
              directory
            );

        if (
          !finalAudioUsable &&
          segmentSources.length === 0
        ) {
          throw new Error(
            audioUi.audioRecordingInvalid
          );
        }

        await WhisperKitLocal
          .prepareModel(
            WHISPERKIT_DEFAULT_MODEL
          );

        setWhisperStage(
          'transcribing'
        );

        const whisperLanguage =
          getWhisperLanguageCode(
            lecture.language
          );

        let result;
        let finalText = '';

        if (finalAudioUsable) {
          result =
            await WhisperKitLocal
              .transcribe(
                lecture.audioUri,
                whisperLanguage,
                WHISPERKIT_DEFAULT_MODEL
              );

          finalText = String(
            result.text || ''
          ).trim();

          if (!finalText) {
            setWhisperStage(
              'retrying'
            );

            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  600
                )
            );

            result =
              await WhisperKitLocal
                .transcribe(
                  lecture.audioUri,
                  whisperLanguage,
                  WHISPERKIT_DEFAULT_MODEL
                );

            finalText = String(
              result.text || ''
            ).trim();
          }
        } else {
          const windows: Array<{
            currentStartSeconds: number;
            segments: SavedTranscriptSegment[];
          }> = [];

          for (
            let index = 0;
            index < segmentSources.length;
            index += 1
          ) {
            const current = segmentSources[index];
            const previous = index > 0
              ? segmentSources[index - 1]
              : null;

            const segmentResult =
              await WhisperKitLocal
                .transcribeSegment(
                  previous?.uri ?? '',
                  current.uri,
                  whisperLanguage,
                  WHISPERKIT_DEFAULT_MODEL,
                  current.globalStartSeconds,
                  index > 0
                    ? SEGMENT_TRANSCRIPTION_OVERLAP_SECONDS
                    : 0
                );

            const segmentWindow =
              (segmentResult.segments ?? [])
                .map(
                  (segment: WhisperSegment) => ({
                    start: Number(segment.start),
                    end: Number(segment.end),
                    text: String(
                      segment.text || ''
                    ).trim(),
                    noSpeechProb: Number(
                      segment.noSpeechProb
                    ),
                    avgLogProb: Number(
                      segment.avgLogProb
                    ),
                  })
                )
                .filter(
                  segment =>
                    Number.isFinite(segment.start) &&
                    Number.isFinite(segment.end) &&
                    segment.start >= 0 &&
                    segment.end >= segment.start
                );

            windows.push({
              currentStartSeconds:
                current.globalStartSeconds,
              segments: segmentWindow,
            });
          }

          const merged =
            mergeSegmentTranscriptWindows(
              windows
            );

          finalText = merged.text.trim();

          result = {
            ok: true,
            model:
              WHISPERKIT_DEFAULT_MODEL,
            language:
              whisperLanguage,
            text:
              finalText,
            segments:
              merged.segments,
            characters:
              finalText.length,
            audioLoadingMode:
              'segment-windows' as const,
            chunkingStrategy:
              'overlap-dedup' as const,
          };
        }

        if (!finalText) {
          throw new Error(
            audioUi.whisperEmptyAfterRetry
          );
        }

        /*
         * Only invalidate translations AFTER a successful new
         * transcription. If re-transcription fails, the previous
         * transcript/translation remains usable.
         */
        for (
          const target
          of ['uk', 'ru'] as const
        ) {
          for (
            const fileName
            of [
              getTranslationFileName(
                target
              ),
              getTranslationSegmentsFileName(
                target
              ),
            ]
          ) {
            const oldFile =
              new File(
                directory,
                fileName
              );

            if (
              oldFile.exists
            ) {
              oldFile.delete();
            }
          }
        }

        onTranslationsInvalidated();

        const rawWhisperText =
          finalText;

        const rawTranscriptSegments =
          (result.segments ?? [])
            .map(
              segment => ({
                start:
                  Number(
                    segment.start
                  ),
                end:
                  Number(
                    segment.end
                  ),
                text:
                  String(
                    segment.text ||
                    ''
                  ).trim(),
                noSpeechProb:
                  Number(
                    segment.noSpeechProb
                  ),
                avgLogProb:
                  Number(
                    segment.avgLogProb
                  ),
              })
            )
            .filter(
              segment =>
                Number.isFinite(
                  segment.start
                ) &&
                Number.isFinite(
                  segment.end
                ) &&
                segment.start >=
                  0 &&
                segment.end >=
                  segment.start
            );

        const transcriptSegments =
          rawTranscriptSegments
            .filter(
              segment =>
                isMeaningfulTranscriptText(
                  segment.text
                )
            )
            .sort(
              (a, b) =>
                a.start -
                b.start
            );

        const transcriptSegmentsFile =
          new File(
            directory,
            'transcript-segments.json'
          );

        writeJsonArray(
          transcriptSegmentsFile,
          transcriptSegments
        );

        const whisperDebugFile =
          new File(
            directory,
            'whisper-debug.json'
          );

        whisperDebugFile.create({
          overwrite: true,
          intermediates: true,
        });

        whisperDebugFile.write(
          JSON.stringify(
            {
              createdAt:
                new Date()
                  .toISOString(),
              audioDurationMillis:
                lecture.durationMillis,
              sourceLanguage:
                lecture.language,
              whisperLanguage:
                whisperLanguage,
              rawText:
                rawWhisperText,
              rawSegments:
                rawTranscriptSegments,
              cleanedSegments:
                transcriptSegments,
              audioLoadingMode:
                result.audioLoadingMode ??
                'unknown',
              chunkingStrategy:
                result.chunkingStrategy ??
                'unknown',
            },
            null,
            2
          )
        );

        finalText =
          rawWhisperText;

        const transcriptFile =
          new File(
            directory,
            'transcript.txt'
          );

        transcriptFile.create({
          overwrite: true,
          intermediates: true,
        });

        transcriptFile.write(
          finalText
        );

        const doneTranscription:
          LectureTranscription = {
            ...transcription,
            mode:
              'whisperkit-local',
            status:
              'done',
            processedUntilSeconds:
              Math.ceil(
                lecture.durationMillis /
                1000
              ),
            error:
              null,
            chunks:
              transcription
                .chunks
                .map(
                  chunk => ({
                    ...chunk,
                    status:
                      'done',
                    error:
                      null,
                  })
                ),
          };

        writeMetadata(
          directory,
          {
            ...metadata,
            id:
              lecture.id,
            createdAt:
              lecture.createdAt,
            durationMillis:
              lecture.durationMillis,
            language:
              lecture.language,
            audioFile:
              lecture.audioFileName,
            transcriptFile:
              'transcript.txt',
            transcriptReady:
              true,
            characters:
              finalText.length,
            transcription:
              doneTranscription,
          }
        );

        if (
          isRetranscription
        ) {
          setLiveTranscript(
            ''
          );
        } else {
          setLiveTranscript(
            finalText
          );
        }

        setWhisperStage(
          'done'
        );

        onTranscriptReady({
          lecture,
          text:
            finalText,
          segments:
            transcriptSegments,
          isRetranscription,
        });

        loadLectures();

      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (__DEV__) {
          console.error(
            'WhisperKit transcription error:',
            error
          );
        }

        setTranscriptionError(
          message
        );

        setWhisperStage(
          'error'
        );

        Alert.alert(
          audioUi.transcriptionErrorTitle,
          message
        );

        try {
          const directory =
            getLectureDirectory(
              lecture.id
            );

          const metadata =
            readMetadata(
              directory
            );

          const baseTranscription =
            metadata.transcription ??
            createChunkPlan(
              lecture.durationMillis
            );

          const transcription:
            LectureTranscription = {
              ...baseTranscription,
              mode:
                'whisperkit-local',
              status:
                'error',
              error:
                message,
              chunks:
                baseTranscription
                  .chunks
                  .map(
                    chunk => ({
                      ...chunk,
                    })
                  ),
            };

          writeMetadata(
            directory,
            {
              ...metadata,
              transcription,
            }
          );

          loadLectures();

        } catch {
          // Never risk the original audio because status save failed.
        }

      } finally {
        processingLockRef.current =
          null;

        try {
          await deactivateKeepAwake(
            KEEP_AWAKE_TAG
          );
        } catch {
          // Ignore Keep Awake cleanup errors.
        }

        setTranscribingLectureId(
          null
        );

        setRetranscribingLectureId(
          null
        );

        isRetranscribingRef.current =
          false;
      }
    };

  const confirmRetranscribe =
    (
      lecture:
        LectureItem,
      beforeStart?:
        () =>
          void |
          Promise<void>
    ) => {
      if (
        transcribingLectureId ||
        processingLockRef.current
      ) {
        return;
      }

      Alert.alert(
        audioUi.retranscribeTitle,
        audioUi.retranscribePrompt,
        [
          {
            text:
              audioUi.cancel,
            style:
              'cancel',
          },
          {
            text:
              audioUi.retranscribeConfirm,
            onPress:
              () => {
                void (
                  async () => {
                    try {
                      await beforeStart?.();
                    } catch (error) {
                      if (__DEV__) {
                        console.warn(
                          'Could not pause playback before re-transcription:',
                          error
                        );
                      }
                    }

                    await handleCreateTranscript(
                      lecture,
                      {
                        isRetranscription:
                          true,
                      }
                    );
                  }
                )();
              },
          },
        ]
      );
    };

  return {
    transcribingLectureId,
    retranscribingLectureId,
    whisperStage,
    liveTranscript,
    transcriptionError,
    handleCreateTranscript,
    confirmRetranscribe,
  };
}

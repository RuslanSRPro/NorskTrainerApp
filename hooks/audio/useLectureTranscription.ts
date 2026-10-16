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
  commitLectureTextSnapshot,
  writeTextFile,
  writeMetadata,
  validateLectureAudio,
  inspectDurableTranscriptInventory,
  MAX_TRANSCRIPTION_WINDOW_SECONDS,
  withAudioOperationDeadline,
  lectureWorkGeneration,
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

const SEGMENT_TRANSCRIPTION_OVERLAP_SECONDS = 3;

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

  const progressActiveRef = useRef(false);
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
          if (!progressActiveRef.current) return;
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

      progressActiveRef.current = true;
      const generationAtStart = lectureWorkGeneration(lecture.id);
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

        const generation = generationAtStart;
        const assertCurrent = () => {
          if (!directory.exists || lectureWorkGeneration(lecture.id) !== generation) throw new Error("Lecture was deleted or replaced. Late transcription was discarded.");
        };
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

        assertCurrent();
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
        let finalAudioDurationMillis = 0;

        if (lecture.audioUri.length > 0) {
          try {
          const validation = await validateLectureAudio(lecture.audioUri);

          finalAudioDurationMillis = validation.durationMillis;
          finalAudioUsable =
            validation.valid &&
            validation.playable && Number.isFinite(validation.durationMillis) &&
            validation.bytes >= 4096 &&
            validation.durationMillis >= 500;
          } catch { finalAudioUsable = false; }
        }

        const inventory = inspectDurableTranscriptInventory(directory,
          Math.max(lecture.durationMillis, metadata.durationMillis ?? 0));
        if (inventory.unresolved || inventory.present && !inventory.complete) {
          throw new Error(inventory.error || 'Durable audio inventory requires recovery before transcription.');
        }
        const segmentSources = inventory.complete && inventory.sources.every(source => source.durationSeconds <= MAX_TRANSCRIPTION_WINDOW_SECONDS)
          ? inventory.sources : [];
        if (!finalAudioUsable && segmentSources.length === 0) throw new Error(inventory.error || audioUi.audioRecordingInvalid);
        const fileDurationSeconds = finalAudioDurationMillis / 1000;
        if (finalAudioUsable && segmentSources.length === 0 &&
            Math.max(lecture.durationMillis, metadata.durationMillis ?? 0) > finalAudioDurationMillis + 1000) {
          throw new Error('The derived file is shorter than the captured recording. Recovery is required.');
        }
        const verifiedDurationMillis = segmentSources.length ? inventory.durationMillis : finalAudioDurationMillis;
        transcription.chunks = createChunkPlan(verifiedDurationMillis).chunks;
        const useFileWindows = finalAudioUsable && segmentSources.length === 0 && fileDurationSeconds > MAX_TRANSCRIPTION_WINDOW_SECONDS;

        await withAudioOperationDeadline(WhisperKitLocal.prepareModel(WHISPERKIT_DEFAULT_MODEL), 45000, 'Whisper model preparation');

        setWhisperStage(
          'transcribing'
        );

        const whisperLanguage =
          getWhisperLanguageCode(
            lecture.language
          );

        let result;
        let finalText = '';

        if (finalAudioUsable && segmentSources.length === 0 && !useFileWindows) {
          result =
            await withAudioOperationDeadline(WhisperKitLocal.transcribe(lecture.audioUri, whisperLanguage, WHISPERKIT_DEFAULT_MODEL), 180000, 'Whisper short file');

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
              await withAudioOperationDeadline(WhisperKitLocal.transcribe(lecture.audioUri, whisperLanguage, WHISPERKIT_DEFAULT_MODEL), 180000, 'Whisper short file');

            finalText = String(
              result.text || ''
            ).trim();
          }
        } else {
          const windows: Array<{
            currentStartSeconds: number;
            segments: SavedTranscriptSegment[];
          }> = [];

          // Compute each range lazily; never allocate an array proportional to untrusted duration metadata.
          const count = useFileWindows ? Math.ceil(fileDurationSeconds / MAX_TRANSCRIPTION_WINDOW_SECONDS) : segmentSources.length;
          for (
            let index = 0;
            index < count;
            index += 1
          ) {
            assertCurrent();
            const rangeStart = index * MAX_TRANSCRIPTION_WINDOW_SECONDS;
            const rangeEnd = Math.min(fileDurationSeconds, rangeStart + MAX_TRANSCRIPTION_WINDOW_SECONDS);
            const current = useFileWindows ? {globalStartSeconds:rangeStart} : segmentSources[index];
            const previous = index > 0 ? segmentSources[index - 1] : null;
            const operation = useFileWindows
              ? WhisperKitLocal.transcribeRange(lecture.audioUri, whisperLanguage, WHISPERKIT_DEFAULT_MODEL,
                  rangeStart, rangeEnd, index > 0 ? SEGMENT_TRANSCRIPTION_OVERLAP_SECONDS : 0)
              : WhisperKitLocal.transcribeSegment(previous?.uri ?? '', segmentSources[index].uri, whisperLanguage,
                  WHISPERKIT_DEFAULT_MODEL, current.globalStartSeconds, index > 0 ? SEGMENT_TRANSCRIPTION_OVERLAP_SECONDS : 0);
            const segmentResult = await withAudioOperationDeadline(operation, 180000, 'Whisper bounded window');
            assertCurrent();
            if (!segmentResult.ok) throw new Error('Whisper window did not complete. Previous transcript is preserved.');

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
              useFileWindows ? 'file-windows' as const : 'segment-windows' as const,
            chunkingStrategy:
              'overlap-dedup' as const,
          };
        }

        if (!finalText) {
          throw new Error(
            audioUi.whisperEmptyAfterRetry
          );
        }

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

        finalText =
          rawWhisperText;

        const doneTranscription:
          LectureTranscription = {
            ...transcription,
            mode:
              'whisperkit-local',
            status:
              'done',
            processedUntilSeconds:
              Math.ceil(
                verifiedDurationMillis /
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

        assertCurrent();
        commitLectureTextSnapshot(directory, {
          'transcript.txt': finalText,
          'transcript-segments.json': JSON.stringify(transcriptSegments),
          [getTranslationFileName('uk')]: null,
          [getTranslationSegmentsFileName('uk')]: null,
          [getTranslationFileName('ru')]: null,
          [getTranslationSegmentsFileName('ru')]: null,
          'session.json': JSON.stringify({
            ...readMetadata(directory),
            id:
              lecture.id,
            createdAt:
              lecture.createdAt,
            durationMillis:
              verifiedDurationMillis,
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
          }),
        });
        onTranslationsInvalidated();
        try {
        const whisperDebugFile =
          new File(
            directory,
            'whisper-debug.json'
          );

        writeTextFile(whisperDebugFile,
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

        } catch { /* Diagnostics cannot invalidate a committed transcript. */ }


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

          if (!directory.exists || lectureWorkGeneration(lecture.id) !== generationAtStart) throw new Error("Stale transcription status was discarded.");
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
        progressActiveRef.current = false;
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

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

        const transcriptionAudio =
          new File(
            lecture.audioUri
          );

        const transcriptionBytes =
          transcriptionAudio.size ??
          0;

        if (
          !transcriptionAudio.exists ||
          transcriptionBytes <
            4096 ||
          lecture.durationMillis <
            500
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

        let result =
          await WhisperKitLocal
            .transcribe(
              lecture.audioUri,
              whisperLanguage,
              WHISPERKIT_DEFAULT_MODEL
            );

        let finalText =
          String(
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

          finalText =
            String(
              result.text || ''
            ).trim();
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
              (
                segment:
                  WhisperSegment
              ) => ({
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

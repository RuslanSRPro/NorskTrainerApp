import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

import OfflineTranslator from '@/modules/offlinetranslator';

import WhisperKitLocal, {
  WHISPERKIT_DEFAULT_MODEL,
  type WhisperLiveErrorEvent,
  type WhisperLiveUpdateEvent,
  type WhisperSegment,
} from '@/modules/whisperkitlocal';

import type {
  LectureSourceLanguage,
  LectureTranscription,
  SavedTranscriptSegment,
  TranslationTarget,
} from '@/features/audio/lectureTypes';

import {
  createChunkPlan,
  getLectureDirectory,
  getTranslationFileName,
  getTranslationSegmentsFileName,
  getTranslationSourceLanguageCode,
  getWhisperLanguageCode,
  isMeaningfulTranscriptText,
  writeJsonArray,
  writeMetadata,
} from '@/features/audio/lectureStorage';

const KEEP_AWAKE_TAG =
  'lecture-live-transcription';

const LIVE_CLOCK_INTERVAL_MS =
  250;

const LIVE_TRANSLATION_PAUSE_MS =
  1100;

const LIVE_TRANSLATION_MAX_SECONDS =
  7;

export type LiveLecturePhase =
  | 'idle'
  | 'preparing'
  | 'live'
  | 'finalizing'
  | 'saved'
  | 'error';

type Params = {
  sourceLanguage:
    LectureSourceLanguage;
  translationTarget:
    TranslationTarget;
  beforeStart?:
    () => void | Promise<void>;
  loadLectures:
    () => void;
  onBusyChange?:
    (busy: boolean) => void;
  onSaved?:
    (lectureId: string) => void;
};

type ActiveLiveLecture = {
  id: string;
  createdAt: string;
  sourceLanguage:
    LectureSourceLanguage;
  translationTarget:
    TranslationTarget;
  tempAudioFile: File;
};

function normalizeSegments(
  segments:
    WhisperSegment[] | undefined
): SavedTranscriptSegment[] {
  return (segments ?? [])
    .map(
      segment => ({
        start:
          Number(segment.start),
        end:
          Number(segment.end),
        text:
          String(
            segment.text || ''
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
        segment.start >= 0 &&
        segment.end >=
          segment.start &&
        isMeaningfulTranscriptText(
          segment.text
        )
    )
    .sort(
      (a, b) =>
        a.start - b.start
    );
}

function segmentKey(
  segment:
    SavedTranscriptSegment
) {
  return [
    segment.start.toFixed(3),
    segment.end.toFixed(3),
    segment.text,
  ].join('|');
}

export function useLiveLecture({
  sourceLanguage,
  translationTarget,
  beforeStart,
  loadLectures,
  onBusyChange,
  onSaved,
}: Params) {
  const [phase, setPhase] =
    useState<LiveLecturePhase>(
      'idle'
    );

  const [elapsedMillis, setElapsedMillis] =
    useState(0);

  const [sourceText, setSourceText] =
    useState('');

  const [translationText, setTranslationText] =
    useState('');

  const [error, setError] =
    useState<string | null>(null);

  const activeRef =
    useRef<ActiveLiveLecture | null>(
      null
    );

  const confirmedRef =
    useRef<SavedTranscriptSegment[]>(
      []
    );

  const confirmedKeysRef =
    useRef<Set<string>>(
      new Set()
    );

  const translatedRef =
    useRef<SavedTranscriptSegment[]>(
      []
    );

  const translationQueueRef =
    useRef<Promise<void>>(
      Promise.resolve()
    );

  const generationRef =
    useRef(0);

  const stoppingRef =
    useRef(false);

  const liveClockStartedAtRef =
    useRef<number | null>(null);

  const liveClockTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const pendingTranslationRef =
    useRef<SavedTranscriptSegment[]>(
      []
    );

  const translationFlushTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const stopLiveClock = () => {
    if (liveClockTimerRef.current) {
      clearInterval(
        liveClockTimerRef.current
      );
      liveClockTimerRef.current =
        null;
    }

    liveClockStartedAtRef.current =
      null;
  };

  const startLiveClock = () => {
    stopLiveClock();

    const startedAt =
      Date.now();

    liveClockStartedAtRef.current =
      startedAt;

    setElapsedMillis(0);

    liveClockTimerRef.current =
      setInterval(
        () => {
          if (
            liveClockStartedAtRef.current ===
              null ||
            !activeRef.current
          ) {
            return;
          }

          setElapsedMillis(
            Math.max(
              0,
              Date.now() -
                liveClockStartedAtRef.current
            )
          );
        },
        LIVE_CLOCK_INTERVAL_MS
      );
  };

  const clearTranslationFlushTimer =
    () => {
      if (
        translationFlushTimerRef.current
      ) {
        clearTimeout(
          translationFlushTimerRef.current
        );
        translationFlushTimerRef.current =
          null;
      }
    };

  const setBusy =
    (busy: boolean) => {
      onBusyChange?.(busy);
    };

  const queueLiveTranslation =
    (
      newSegments:
        SavedTranscriptSegment[],
      generation:
        number
    ) => {
      if (
        newSegments.length === 0
      ) {
        return;
      }

      const active =
        activeRef.current;

      if (!active) {
        return;
      }

      const sourceCode =
        getTranslationSourceLanguageCode(
          active.sourceLanguage
        );

      const target =
        active.translationTarget;

      translationQueueRef.current =
        translationQueueRef.current
          .catch(() => {})
          .then(
            async () => {
              const result =
                await OfflineTranslator
                  .translateChunks(
                    newSegments.map(
                      segment =>
                        segment.text
                    ),
                    sourceCode,
                    target
                  );

              if (
                generationRef.current !==
                  generation ||
                !activeRef.current
              ) {
                return;
              }

              const translations =
                result.translations
                  .map(
                    value =>
                      String(
                        value || ''
                      ).trim()
                  );

              if (
                translations.length !==
                  newSegments.length ||
                translations.some(
                  value => !value
                )
              ) {
                return;
              }

              translatedRef.current = [
                ...translatedRef.current,
                ...newSegments.map(
                  (
                    segment,
                    index
                  ) => ({
                    start:
                      segment.start,
                    end:
                      segment.end,
                    text:
                      translations[
                        index
                      ],
                  })
                ),
              ].sort(
                (a, b) =>
                  a.start - b.start
              );

              setTranslationText(
                translatedRef.current
                  .map(
                    segment =>
                      segment.text
                  )
                  .join('\n\n')
                  .trim()
              );
            }
          )
          .catch(
            liveTranslationError => {
              if (__DEV__) {
                console.warn(
                  'Live translation update failed:',
                  liveTranslationError
                );
              }
            }
          );
    };

  const flushPendingTranslation =
    (generation: number) => {
      clearTranslationFlushTimer();

      const batch =
        pendingTranslationRef.current;

      if (batch.length === 0) {
        return;
      }

      pendingTranslationRef.current =
        [];

      queueLiveTranslation(
        batch,
        generation
      );
    };

  const bufferLiveTranslation =
    (
      newSegments:
        SavedTranscriptSegment[],
      generation: number
    ) => {
      if (newSegments.length === 0) {
        return;
      }

      pendingTranslationRef.current = [
        ...pendingTranslationRef.current,
        ...newSegments,
      ].sort(
        (a, b) =>
          a.start - b.start
      );

      const pending =
        pendingTranslationRef.current;

      const first = pending[0];
      const last =
        pending[pending.length - 1];

      const combinedText =
        pending
          .map(
            segment =>
              segment.text
          )
          .join(' ')
          .trim();

      const durationSeconds =
        first && last
          ? Math.max(
              0,
              last.end - first.start
            )
          : 0;

      const sentenceFinished =
        /[.!?…][\"'’”»)]*$/.test(
          combinedText
        );

      if (
        sentenceFinished ||
        durationSeconds >=
          LIVE_TRANSLATION_MAX_SECONDS
      ) {
        flushPendingTranslation(
          generation
        );
        return;
      }

      /*
       * If no new stable segment arrives for ~1 second, treat it as a
       * natural speech pause and translate the accumulated stable phrase.
       */
      clearTranslationFlushTimer();
      translationFlushTimerRef.current =
        setTimeout(
          () => {
            flushPendingTranslation(
              generation
            );
          },
          LIVE_TRANSLATION_PAUSE_MS
        );
    };

  useEffect(() => {
    const updateSubscription =
      WhisperKitLocal.addListener(
        'onLiveUpdate',
        (
          event:
            WhisperLiveUpdateEvent
        ) => {
          const active =
            activeRef.current;

          if (!active) {
            return;
          }

          const nativeElapsed =
            Math.max(
              0,
              Number(
                event.elapsedMillis || 0
              )
            );

          setElapsedMillis(
            current =>
              Math.max(
                current,
                nativeElapsed
              )
          );

          const incoming =
            normalizeSegments(
              event.confirmedSegments
            );

          const fresh:
            SavedTranscriptSegment[] =
              [];

          for (
            const segment
            of incoming
          ) {
            const key =
              segmentKey(
                segment
              );

            if (
              confirmedKeysRef.current
                .has(key)
            ) {
              continue;
            }

            confirmedKeysRef.current
              .add(key);

            confirmedRef.current
              .push(segment);

            fresh.push(
              segment
            );
          }

          confirmedRef.current
            .sort(
              (a, b) =>
                a.start - b.start
            );

          const confirmedText =
            confirmedRef.current
              .map(
                segment =>
                  segment.text
              )
              .join(' ')
              .trim();

          const partialText =
            String(
              event.partialText || ''
            ).trim();

          setSourceText(
            [
              confirmedText,
              partialText,
            ]
              .filter(Boolean)
              .join(' ')
              .replace(
                /\s+/g,
                ' '
              )
              .trim()
          );

          bufferLiveTranslation(
            fresh,
            generationRef.current
          );

          setPhase(
            current =>
              current === 'preparing'
                ? 'live'
                : current
          );
        }
      );

    const errorSubscription =
      WhisperKitLocal.addListener(
        'onLiveError',
        (
          event:
            WhisperLiveErrorEvent
        ) => {
          if (!activeRef.current) {
            return;
          }

          const message =
            String(
              event.message ||
              'Live transcription failed.'
            );

          setError(message);
          setPhase('error');
        }
      );

    return () => {
      updateSubscription.remove();
      errorSubscription.remove();
      stopLiveClock();
      clearTranslationFlushTimer();
    };
  }, []);

  const cleanupAudioSession =
    async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          allowsBackgroundRecording: false,
          interruptionMode:
            'doNotMix',
        });
      } catch {
        // Do not hide a successful Live save.
      }
    };

  const start = async () => {
    if (
      activeRef.current ||
      phase === 'preparing' ||
      phase === 'live' ||
      phase === 'finalizing'
    ) {
      return;
    }

    const generation =
      generationRef.current + 1;

    generationRef.current =
      generation;

    setError(null);
    setElapsedMillis(0);
    setSourceText('');
    setTranslationText('');
    setPhase('preparing');
    setBusy(true);

    confirmedRef.current = [];
    translatedRef.current = [];
    confirmedKeysRef.current =
      new Set();
    translationQueueRef.current =
      Promise.resolve();
    pendingTranslationRef.current =
      [];
    clearTranslationFlushTimer();
    stopLiveClock();
    stoppingRef.current = false;

    let tempAudioFile:
      File | null = null;

    try {
      await beforeStart?.();

      const permission =
        await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        throw new Error(
          'Microphone access is required.'
        );
      }

      await activateKeepAwakeAsync(
        KEEP_AWAKE_TAG
      );

      const id =
        Date.now().toString();

      const createdAt =
        new Date().toISOString();

      tempAudioFile =
        new File(
          Paths.cache,
          `norsktrainer-live-${id}.m4a`
        );

      if (tempAudioFile.exists) {
        tempAudioFile.delete();
      }

      activeRef.current = {
        id,
        createdAt,
        sourceLanguage,
        translationTarget,
        tempAudioFile,
      };

      /*
       * startLive now begins microphone capture before loading the Core ML
       * model. Start the UI clock at the same point so the timer no longer
       * waits for Whisper's first decoding update.
       */
      startLiveClock();

      await WhisperKitLocal
        .startLive(
          tempAudioFile.uri,
          getWhisperLanguageCode(
            sourceLanguage
          ),
          WHISPERKIT_DEFAULT_MODEL
        );

      if (
        generationRef.current ===
          generation
      ) {
        setPhase('live');
      }

    } catch (startError) {
      const message =
        startError instanceof Error
          ? startError.message
          : String(startError);

      if (__DEV__) {
        console.error(
          'Live start error:',
          startError
        );
      }

      activeRef.current = null;
      stopLiveClock();
      clearTranslationFlushTimer();
      pendingTranslationRef.current =
        [];
      setError(message);
      setPhase('error');
      setBusy(false);

      try {
        await WhisperKitLocal
          .cancelLive();
      } catch {}

      if (
        tempAudioFile?.exists
      ) {
        try {
          tempAudioFile.delete();
        } catch {}
      }

      try {
        await deactivateKeepAwake(
          KEEP_AWAKE_TAG
        );
      } catch {}

      await cleanupAudioSession();
    }
  };

  const stop = async () => {
    const active =
      activeRef.current;

    if (
      !active ||
      stoppingRef.current
    ) {
      return;
    }

    stoppingRef.current = true;
    stopLiveClock();
    clearTranslationFlushTimer();
    pendingTranslationRef.current =
      [];
    setPhase('finalizing');
    setError(null);

    /*
     * Ignore late provisional translation callbacks from the
     * streaming phase. Stop always rebuilds authoritative text
     * from the finalized M4A using the existing full-file path.
     */
    generationRef.current += 1;

    let permanentAudioCreated =
      false;

    try {
      const stopped =
        await WhisperKitLocal
          .stopLive();

      if (stopped.writerError) {
        throw new Error(
          `Live audio writer: ${stopped.writerError}`
        );
      }

      if (
        stopped.durationMillis <
          500 ||
        stopped.bytes < 4096 ||
        !active.tempAudioFile.exists
      ) {
        throw new Error(
          'The Live audio recording is too short or was not finalized.'
        );
      }

      const directory =
        getLectureDirectory(
          active.id
        );

      directory.create({
        intermediates: true,
        idempotent: true,
      });

      const audioFile =
        new File(
          directory,
          'audio.m4a'
        );

      if (audioFile.exists) {
        audioFile.delete();
      }

      await active.tempAudioFile
        .copy(audioFile);

      const audioBytes =
        audioFile.size ?? 0;

      if (
        !audioFile.exists ||
        audioBytes < 4096
      ) {
        throw new Error(
          'The finalized Live audio copy is invalid.'
        );
      }

      permanentAudioCreated = true;

      const baseTranscription =
        createChunkPlan(
          stopped.durationMillis
        );

      writeMetadata(
        directory,
        {
          id:
            active.id,
          createdAt:
            active.createdAt,
          durationMillis:
            stopped.durationMillis,
          language:
            active.sourceLanguage,
          title:
            null,
          audioFile:
            'audio.m4a',
          transcriptFile:
            null,
          transcriptReady:
            false,
          characters:
            0,
          audioBytes,
          source:
            'recorded',
          recordingState:
            'ready',
          interruptionReason:
            null,
          transcription:
            baseTranscription,
        }
      );

      let finalText = '';
      let finalSegments:
        SavedTranscriptSegment[] =
          [];

      try {
        const result =
          await WhisperKitLocal
            .transcribe(
              audioFile.uri,
              getWhisperLanguageCode(
                active.sourceLanguage
              ),
              WHISPERKIT_DEFAULT_MODEL
            );

        finalText =
          String(
            result.text || ''
          ).trim();

        finalSegments =
          normalizeSegments(
            result.segments
          );

        if (finalText) {
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

          writeJsonArray(
            new File(
              directory,
              'transcript-segments.json'
            ),
            finalSegments
          );

          const doneTranscription:
            LectureTranscription = {
              ...baseTranscription,
              mode:
                'whisperkit-local',
              status:
                'done',
              processedUntilSeconds:
                Math.ceil(
                  stopped.durationMillis /
                    1000
                ),
              error:
                null,
              chunks:
                baseTranscription
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
              id:
                active.id,
              createdAt:
                active.createdAt,
              durationMillis:
                stopped.durationMillis,
              language:
                active.sourceLanguage,
              title:
                null,
              audioFile:
                'audio.m4a',
              transcriptFile:
                'transcript.txt',
              transcriptReady:
                true,
              characters:
                finalText.length,
              audioBytes,
              source:
                'recorded',
              recordingState:
                'ready',
              interruptionReason:
                null,
              transcription:
                doneTranscription,
            }
          );

          const debugFile =
            new File(
              directory,
              'whisper-debug.json'
            );

          debugFile.create({
            overwrite: true,
            intermediates: true,
          });

          debugFile.write(
            JSON.stringify(
              {
                createdAt:
                  new Date()
                    .toISOString(),
                mode:
                  'live-final-full-file',
                sourceLanguage:
                  active.sourceLanguage,
                audioDurationMillis:
                  stopped.durationMillis,
                rawText:
                  finalText,
                cleanedSegments:
                  finalSegments,
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
        }
      } catch (finalTranscriptError) {
        /*
         * Audio is the primary asset. If the accuracy-first
         * post-pass fails, keep the valid recording and let the
         * existing Transcript button retry later.
         */
        if (__DEV__) {
          console.warn(
            'Live final transcription failed; audio kept:',
            finalTranscriptError
          );
        }
      }

      if (
        finalText &&
        finalSegments.length > 0
      ) {
        try {
          const sourceCode =
            getTranslationSourceLanguageCode(
              active.sourceLanguage
            );

          const result =
            await OfflineTranslator
              .translateChunks(
                finalSegments.map(
                  segment =>
                    segment.text
                ),
                sourceCode,
                active.translationTarget
              );

          const translations =
            result.translations
              .map(
                value =>
                  String(
                    value || ''
                  ).trim()
              );

          if (
            translations.length ===
              finalSegments.length &&
            translations.every(Boolean)
          ) {
            const translatedSegments =
              finalSegments.map(
                (
                  segment,
                  index
                ) => ({
                  start:
                    segment.start,
                  end:
                    segment.end,
                  text:
                    translations[index],
                })
              );

            const translatedText =
              translatedSegments
                .map(
                  segment =>
                    segment.text
                )
                .join('\n\n')
                .trim();

            const translationFile =
              new File(
                directory,
                getTranslationFileName(
                  active.translationTarget
                )
              );

            translationFile.create({
              overwrite: true,
              intermediates: true,
            });

            translationFile.write(
              translatedText
            );

            writeJsonArray(
              new File(
                directory,
                getTranslationSegmentsFileName(
                  active.translationTarget
                )
              ),
              translatedSegments
            );
          }
        } catch (finalTranslationError) {
          if (__DEV__) {
            console.warn(
              'Live final translation failed; transcript kept:',
              finalTranslationError
            );
          }
        }
      }

      if (
        active.tempAudioFile.exists
      ) {
        try {
          active.tempAudioFile.delete();
        } catch {}
      }

      activeRef.current = null;
      loadLectures();
      onSaved?.(
        active.id
      );

      setElapsedMillis(
        stopped.durationMillis
      );
      setSourceText(
        finalText ||
        sourceText
      );
      setPhase('saved');
      setBusy(false);

    } catch (stopError) {
      const message =
        stopError instanceof Error
          ? stopError.message
          : String(stopError);

      if (__DEV__) {
        console.error(
          'Live stop error:',
          stopError
        );
      }

      setError(message);
      setPhase('error');

      /*
       * If audio was already copied to the lecture library,
       * leave it there even if a later post-processing step
       * failed. Never delete a valid recording as cleanup.
       */
      activeRef.current = null;

      if (permanentAudioCreated) {
        loadLectures();
      }

      setBusy(false);

    } finally {
      stoppingRef.current = false;

      try {
        await deactivateKeepAwake(
          KEEP_AWAKE_TAG
        );
      } catch {}

      await cleanupAudioSession();
    }
  };

  const reset = () => {
    if (activeRef.current) {
      return;
    }

    stopLiveClock();
    clearTranslationFlushTimer();
    pendingTranslationRef.current =
      [];
    setPhase('idle');
    setElapsedMillis(0);
    setSourceText('');
    setTranslationText('');
    setError(null);
  };

  const isBusy =
    phase === 'preparing' ||
    phase === 'live' ||
    phase === 'finalizing' ||
    (
      phase === 'error' &&
      !!activeRef.current
    );

  return {
    phase,
    isBusy,
    elapsedMillis,
    sourceText,
    translationText,
    error,
    start,
    stop,
    reset,
  };
}

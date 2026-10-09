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

import LectureRecorder from '@/modules/lecturerecorder';

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

const LIVE_TAIL_OVERLAP_SECONDS =
  3;

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
  audioFile: File;
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

function normalizeLiveTranscriptKey(
  value: string
) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function mergeLiveTailSegments(
  confirmed: SavedTranscriptSegment[],
  tail: SavedTranscriptSegment[],
  processedUntilSeconds: number
) {
  const merged = [...confirmed]
    .sort((a, b) => a.start - b.start);

  const candidates = tail
    .filter(
      segment =>
        segment.end >
          processedUntilSeconds + 0.05 &&
        isMeaningfulTranscriptText(
          segment.text
        )
    )
    .sort((a, b) => a.start - b.start);

  for (const candidate of candidates) {
    const previous = merged.at(-1);

    if (previous) {
      const previousKey =
        normalizeLiveTranscriptKey(
          previous.text
        );
      const candidateKey =
        normalizeLiveTranscriptKey(
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
        if (candidate.end > previous.end) {
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

  return merged;
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

  const liveFirstTextTimingLoggedRef =
    useRef(false);

  const liveTranscriptPersistedTimingLoggedRef =
    useRef(false);

  const timingFile =
    new File(
      Paths.document,
      'lectures',
      '_timing.log'
    );

  const recordAudioTiming =
    (
      event: string,
      details?: string
    ) => {
      void LectureRecorder
        .recordTimingEvent(
          event,
          timingFile.uri,
          details ?? null
        )
        .catch(() => {
          // Telemetry must never change Live behavior.
        });
    };

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

  const persistLiveProgress =
    (
      active: ActiveLiveLecture,
      segments: SavedTranscriptSegment[],
      translatedSegments:
        SavedTranscriptSegment[] =
          translatedRef.current
    ) => {
      const directory =
        getLectureDirectory(
          active.id
        );

      directory.create({
        intermediates: true,
        idempotent: true,
      });

      const confirmed =
        [...segments]
          .sort(
            (a, b) =>
              a.start - b.start
          );

      const text =
        confirmed
          .map(
            segment =>
              segment.text
          )
          .join(' ')
          .replace(
            /\s+/g,
            ' '
          )
          .trim();

      if (text) {
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
          text
        );

        writeJsonArray(
          new File(
            directory,
            'transcript-segments.json'
          ),
          confirmed
        );

        if (
          !liveTranscriptPersistedTimingLoggedRef.current
        ) {
          liveTranscriptPersistedTimingLoggedRef.current =
            true;
          recordAudioTiming(
            'LIVE_TRANSCRIPT_PERSISTED',
            `lecture=${active.id};segments=${confirmed.length}`
          );
        }
      }

      const translated =
        [...translatedSegments]
          .sort(
            (a, b) =>
              a.start - b.start
          );

      const translatedText =
        translated
          .map(
            segment =>
              segment.text
          )
          .join('\n\n')
          .trim();

      if (translatedText) {
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
          translated
        );
      }

      return {
        text,
        translatedText,
      };
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
              const currentActive =
                activeRef.current;

              if (currentActive) {
                persistLiveProgress(
                  currentActive,
                  confirmedRef.current,
                  translatedRef.current
                );
              }
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

          if (
            fresh.length > 0
          ) {
            if (
              !liveFirstTextTimingLoggedRef.current
            ) {
              liveFirstTextTimingLoggedRef.current =
                true;
              recordAudioTiming(
                'LIVE_FIRST_TEXT',
                `segments=${fresh.length}`
              );
            }

            const currentActive =
              activeRef.current;

            if (currentActive) {
              persistLiveProgress(
                currentActive,
                confirmedRef.current
              );
            }
          }

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
          const currentActive =
            activeRef.current;

          if (!currentActive) {
            return;
          }

          const message =
            String(
              event.message ||
              'Live transcription failed.'
            );

          persistLiveProgress(
            currentActive,
            confirmedRef.current,
            translatedRef.current
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

  const preserveInterruptedLiveAudio =
    async (
      active: ActiveLiveLecture,
      durationMillis: number,
      reason: string
    ) => {
      const directory =
        getLectureDirectory(active.id);

      directory.create({
        intermediates: true,
        idempotent: true,
      });

      let finalDurationMillis = Math.max(0, Math.round(durationMillis));
      let audioBytes = active.audioFile.exists
        ? (active.audioFile.size ?? 0)
        : 0;
      let recordingState: 'ready' | 'interrupted' = 'interrupted';

      try {
        const status = LectureRecorder.getStatus();
        if (status.uri === active.audioFile.uri) {
          if (status.isRecording) {
            const stopped = await LectureRecorder.stop();
            finalDurationMillis = Math.max(
              finalDurationMillis,
              stopped.durationMillis
            );
          } else {
            // A native session can own this URI before its first durable
            // buffer, while isRecording is still false.
            await LectureRecorder.cancel();
          }
        }

        const afterCleanup = LectureRecorder.getStatus();
        if (afterCleanup.uri === active.audioFile.uri) {
          throw new Error(
            'Native Live recorder cleanup is still pending.'
          );
        }

        const assembled = await LectureRecorder.assembleRecording(
          active.audioFile.uri
        );

        if (assembled.valid && assembled.playable) {
          finalDurationMillis = Math.max(
            finalDurationMillis,
            assembled.durationMillis
          );
          audioBytes = assembled.bytes;
          recordingState = 'ready';
        }
      } catch {
        // Durable segments/manifest remain the recovery authority.
        try {
          const status = LectureRecorder.getStatus();
          if (status.uri === active.audioFile.uri) {
            await LectureRecorder.cancel();
          }
        } catch {}
      }

      writeMetadata(
        directory,
        {
          id: active.id,
          createdAt: active.createdAt,
          durationMillis: finalDurationMillis,
          language: active.sourceLanguage,
          title: null,
          audioFile:
            recordingState === 'ready' && active.audioFile.exists
              ? 'audio.m4a'
              : '',
          transcriptFile: null,
          transcriptReady: false,
          characters: 0,
          audioBytes,
          source: 'recorded',
          recordingState,
          interruptionReason:
            recordingState === 'ready' ? null : reason,
          transcription: createChunkPlan(finalDurationMillis),
        }
      );

      return true;
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
    liveFirstTextTimingLoggedRef.current =
      false;
    liveTranscriptPersistedTimingLoggedRef.current =
      false;
    confirmedKeysRef.current =
      new Set();
    translationQueueRef.current =
      Promise.resolve();
    pendingTranslationRef.current =
      [];
    clearTranslationFlushTimer();
    stopLiveClock();
    stoppingRef.current = false;

    let liveAudioFile:
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

      const directory =
        getLectureDirectory(id);

      directory.create({
        intermediates: true,
        idempotent: true,
      });

      liveAudioFile = new File(
        directory,
        'audio.m4a'
      );

      activeRef.current = {
        id,
        createdAt,
        sourceLanguage,
        translationTarget,
        audioFile: liveAudioFile,
      };

      // Live now uses the same durable recorder/manifest lifecycle as Normal.
      // Persist the lecture shell before capture so a force-quit is visible to
      // the ordinary interrupted-recording classifier on the next mount.
      writeMetadata(
        directory,
        {
          id,
          createdAt,
          durationMillis: 0,
          language: sourceLanguage,
          title: null,
          audioFile: '',
          transcriptFile: null,
          transcriptReady: false,
          characters: 0,
          audioBytes: 0,
          source: 'recorded',
          recordingState: 'recording',
          interruptionReason: null,
          transcription: createChunkPlan(0),
        }
      );

      /*
       * Attach Whisper's PCM consumer first, then start the one durable
       * LectureRecorder engine. startLive() begins listening immediately
       * and may continue loading the model while recorder startup proceeds.
       */
      // Attach both handlers immediately: model loading may reject before
      // the durable recorder has finished starting. Keep the outcome for
      // the existing await point without an unhandled rejection.
      const liveStartOutcome =
        WhisperKitLocal.startLive(
          liveAudioFile.uri,
          getWhisperLanguageCode(sourceLanguage),
          WHISPERKIT_DEFAULT_MODEL,
          timingFile.uri
        ).then(
          () => ({ ok: true as const }),
          (error: unknown) => ({ ok: false as const, error })
        );

      await LectureRecorder.start(
        liveAudioFile.uri
      );

      const recorderDeadline =
        Date.now() + 12000;
      let recorderReady =
        LectureRecorder.getStatus();

      while (
        !recorderReady.isRecording &&
        Date.now() < recorderDeadline
      ) {
        await new Promise(resolve =>
          setTimeout(resolve, 25)
        );
        recorderReady =
          LectureRecorder.getStatus();
      }

      if (!recorderReady.isRecording) {
        throw new Error(
          'The unified recorder did not confirm a durable audio write.'
        );
      }

      startLiveClock();
      const liveStartResult = await liveStartOutcome;
      if (!liveStartResult.ok) {
        throw liveStartResult.error;
      }

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

      /*
       * stop() may legitimately finalize the pending microphone capture
       * while startLive() is still preparing WhisperKit. In that case the
       * rejected start belongs to an older generation and must not delete
       * the audio file that stop() is preserving.
       */
      const supersededByNewerLifecycle =
        generationRef.current !==
          generation;

      if (supersededByNewerLifecycle) {
        return;
      }

      if (__DEV__) {
        console.error(
          'Live start error:',
          startError
        );
      }

      const failedActive =
        activeRef.current;

      const estimatedDurationMillis =
        liveClockStartedAtRef.current ===
          null
          ? 0
          : Math.max(
              0,
              Date.now() -
                liveClockStartedAtRef.current
            );

      stopLiveClock();
      clearTranslationFlushTimer();
      pendingTranslationRef.current =
        [];
      setError(message);
      setPhase('error');
      setBusy(false);

      let cancelled:
        Awaited<
          ReturnType<
            typeof WhisperKitLocal.cancelLive
          >
        > | null =
          null;

      try {
        cancelled =
          await WhisperKitLocal
            .cancelLive();
      } catch {}

      if (failedActive) {
        try {
          const durationMillis =
            Number(
              cancelled?.durationMillis ??
                estimatedDurationMillis
            );

          const preserved =
            await preserveInterruptedLiveAudio(
              failedActive,
              Number.isFinite(
                durationMillis
              )
                ? durationMillis
                : estimatedDurationMillis,
              cancelled?.writerError
                ? `Live recording was interrupted during start: ${cancelled.writerError}`
                : `Live recording was interrupted during start: ${message}`
            );

          if (preserved) {
            loadLectures();
          }
        } catch {
          // Durable segments/manifest remain intact if promotion fails.
        }
      }

      activeRef.current = null;

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
     * streaming phase. Confirmed Live text remains authoritative;
     * Stop may transcribe only the unconfirmed final audio tail.
     */
    generationRef.current += 1;

    let permanentAudioCreated =
      false;

    try {
      let streamCleanupTimedOut = false;

      try {
        const stoppedLive =
          await WhisperKitLocal.stopLive();
        streamCleanupTimedOut =
          stoppedLive.streamCleanupTimedOut === true;
      } catch (liveStopError) {
        // Whisper is a consumer. Its cleanup failure must not prevent the
        // durable recorder from finalizing the lecture.
        streamCleanupTimedOut = true;
        if (__DEV__) {
          console.warn(
            'Live Whisper stop failed; finalizing durable audio:',
            liveStopError
          );
        }
      }

      const stopped =
        await LectureRecorder.stop();

      if (
        stopped.durationMillis < 500 ||
        stopped.segmentCount === 0
      ) {
        throw new Error(
          'The unified Live recording is too short or has no durable segment.'
        );
      }

      const assembled =
        await LectureRecorder.assembleRecording(
          active.audioFile.uri
        );

      if (
        !assembled.valid ||
        !assembled.playable ||
        assembled.bytes < 4096 ||
        !active.audioFile.exists
      ) {
        throw new Error(
          assembled.message ||
          'The unified Live audio assembly is invalid.'
        );
      }

      const directory =
        getLectureDirectory(active.id);
      const audioFile = active.audioFile;
      const audioBytes = assembled.bytes;
      const durationMillis =
        assembled.durationMillis > 0
          ? assembled.durationMillis
          : stopped.durationMillis;

      permanentAudioCreated = true;

      const baseTranscription =
        createChunkPlan(durationMillis);

      writeMetadata(
        directory,
        {
          id:
            active.id,
          createdAt:
            active.createdAt,
          durationMillis:
            durationMillis,
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

      const confirmedSegments =
        [...confirmedRef.current]
          .sort(
            (a, b) =>
              a.start - b.start
          );

      const confirmedPersisted =
        persistLiveProgress(
          active,
          confirmedSegments,
          translatedRef.current
        );

      const confirmedText =
        confirmedPersisted.text;

      const confirmedUntilSeconds =
        confirmedSegments.length > 0
          ? Math.max(
              0,
              ...confirmedSegments.map(
                segment =>
                  segment.end
              )
            )
          : 0;

      const audioDurationSeconds =
        durationMillis /
        1000;

      let finalSegments =
        confirmedSegments;
      let finalText =
        confirmedText;
      let processedUntilSeconds =
        confirmedUntilSeconds;
      let tailError: string | null =
        null;
      let tailCompleted =
        (
          audioDurationSeconds -
          confirmedUntilSeconds
        ) <= 2.0;

      /*
       * Never rebuild the full Live transcript after Stop.
       * The confirmed streaming transcript is authoritative. If
       * audio remains after its last confirmed timestamp, Whisper
       * receives only that tail plus a small overlap window.
       */
      if (
        !tailCompleted &&
        !streamCleanupTimedOut
      ) {
        try {
          const tailResult =
            await WhisperKitLocal
              .transcribeTail(
                audioFile.uri,
                getWhisperLanguageCode(
                  active.sourceLanguage
                ),
                WHISPERKIT_DEFAULT_MODEL,
                confirmedUntilSeconds,
                LIVE_TAIL_OVERLAP_SECONDS
              );

          const tailSegments =
            normalizeSegments(
              tailResult.segments
            );

          finalSegments =
            mergeLiveTailSegments(
              confirmedSegments,
              tailSegments,
              confirmedUntilSeconds
            );

          const tailPersisted =
            persistLiveProgress(
              active,
              finalSegments,
              translatedRef.current
            );

          finalText =
            tailPersisted.text;
          processedUntilSeconds =
            audioDurationSeconds;
          tailCompleted = true;
        } catch (tailFailure) {
          tailError =
            tailFailure instanceof Error
              ? tailFailure.message
              : String(tailFailure);

          /*
           * Tail transcription is derived work. Its failure must
           * not invalidate the finalized audio or erase the already
           * persisted confirmed Live transcript.
           */
          finalSegments =
            confirmedSegments;
          finalText =
            confirmedText;
          processedUntilSeconds =
            confirmedUntilSeconds;
          tailCompleted = false;
        }
      }

      const transcriptComplete =
        !streamCleanupTimedOut &&
        tailCompleted;

      const transcription:
        LectureTranscription = {
          ...baseTranscription,
          mode:
            'whisperkit-local',
          status:
            transcriptComplete
              ? 'done'
              : 'processing',
          processedUntilSeconds,
          error:
            transcriptComplete
              ? null
              : (
                streamCleanupTimedOut
                  ? 'Live stream cleanup is still finishing. Confirmed transcript was preserved.'
                  : tailError
                    ? `Final Live tail transcription failed: ${tailError}. Confirmed transcript was preserved.`
                    : 'Confirmed Live transcript was preserved. The final tail is still pending.'
              ),
          chunks:
            baseTranscription
              .chunks
              .map(
                chunk => ({
                  ...chunk,
                  status:
                    chunk.toSeconds <=
                      processedUntilSeconds + 0.05
                      ? 'done'
                      : 'pending',
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
            durationMillis,
          language:
            active.sourceLanguage,
          title:
            null,
          audioFile:
            'audio.m4a',
          transcriptFile:
            finalText
              ? 'transcript.txt'
              : null,
          transcriptReady:
            transcriptComplete &&
            !!finalText,
          characters:
            finalText.length,
          audioBytes,
          source:
            'recorded',
          recordingState:
            'ready',
          interruptionReason:
            null,
          transcription,
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
              transcriptComplete
                ? 'live-stream-plus-tail'
                : 'live-stream-preserved',
            sourceLanguage:
              active.sourceLanguage,
            audioDurationMillis:
              durationMillis,
            rawText:
              finalText,
            cleanedSegments:
              finalSegments,
            streamCleanupTimedOut,
            confirmedUntilSeconds,
            processedUntilSeconds,
            tailOverlapSeconds:
              LIVE_TAIL_OVERLAP_SECONDS,
            tailError,
          },
          null,
          2
        )
      );

      activeRef.current = null;
      loadLectures();
      onSaved?.(
        active.id
      );

      setElapsedMillis(
        durationMillis
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
       * If audio was already copied to the lecture library, leave it there.
       * Otherwise promote any finalized temp audio into an interrupted
       * lecture. Failure cleanup must never delete the only valid recording.
       */
      if (!permanentAudioCreated) {
        try {
          const estimatedDurationMillis =
            Math.max(
              elapsedMillis,
              0
            );

          permanentAudioCreated =
            await preserveInterruptedLiveAudio(
              active,
              estimatedDurationMillis,
              `Live recording stop failed: ${message}`
            );

        } catch {
          // Durable segments/manifest remain intact if promotion fails.
        }
      }

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

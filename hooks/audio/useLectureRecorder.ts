import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  enqueueAudioDiagnostic,
  newAudioDiagnosticId,
} from '@/services/audioDiagnostics';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import LectureRecorder, {
  type LectureAudioInfo,
  type LectureRecorderErrorEvent,
  type LectureRecorderCheckpointEvent,
  type LectureRecorderResult,
  type LectureRecorderStatus,
} from '@/modules/lecturerecorder';

import {
  findAudioFile,
  getDefaultTranscription,
  readMetadata,
  writeMetadata,
} from '@/features/audio/lectureStorage';


const devConsole = {
  log: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error(...args);
    }
  },
};


const EMPTY_RECORDER_STATE:
  LectureRecorderStatus = {
    isRecording: false,
    durationMillis: 0,
    uri: null,
    bytes: 0,
  };


export type VerifiedRecordingStart = {
  started:
    LectureRecorderResult;
  verified:
    LectureRecorderStatus;
};


type UseLectureRecorderOptions = {
  pollingActive: boolean;
  onCheckpointCommitted?: (
    event: LectureRecorderCheckpointEvent
  ) => void;
};


export function useLectureRecorder(
  {
    pollingActive,
    onCheckpointCommitted,
  }: UseLectureRecorderOptions
) {

  const onCheckpointCommittedRef =
    useRef(onCheckpointCommitted);

  useEffect(() => {
    onCheckpointCommittedRef.current =
      onCheckpointCommitted;
  }, [onCheckpointCommitted]);

  const [
    recorderState,
    setRecorderState,
  ] =
    useState<LectureRecorderStatus>(
      EMPTY_RECORDER_STATE
    );

  const recorderReadyEventRef =
    useRef<LectureRecorderResult | null>(
      null
    );

  const recorderStoppedEventRef =
    useRef<LectureRecorderResult | null>(
      null
    );

  const recorderErrorEventRef =
    useRef<LectureRecorderErrorEvent | null>(
      null
    );


  /*
   * AVAudioRecorder.currentTime can briefly report an
   * invalid/negative value immediately after start on iOS.
   * Use a JS wall clock for the live UI counter; the final
   * saved duration still comes from the finalized M4A.
   */
  const recordingStartedAtRef =
    useRef<number | null>(
      null
    );

  const micSilenceStartedAtRef =
    useRef<number | null>(
      null
    );

  const [
    micNoSignalWarning,
    setMicNoSignalWarning,
  ] =
    useState(false);


  useEffect(() => {
    const readySubscription =
      LectureRecorder.addListener(
        'onRecorderReady',
        event => {
          recorderReadyEventRef.current =
            event;

          if (__DEV__) {
            devConsole.log(
              'LECTURE NATIVE READY',
              event
            );
          }
        }
      );

    const stoppedSubscription =
      LectureRecorder.addListener(
        'onRecorderStopped',
        event => {
          recorderStoppedEventRef.current =
            event;

          if (__DEV__) {
            devConsole.log(
              'LECTURE NATIVE STOPPED',
              event
            );
          }
        }
      );

    const checkpointSubscription =
      LectureRecorder.addListener(
        'onRecorderCheckpoint',
        event => {
          onCheckpointCommittedRef.current?.(event);

          if (__DEV__) {
            devConsole.log(
              'LECTURE CHECKPOINT COMMITTED',
              event
            );
          }
        }
      );

    const errorSubscription =
      LectureRecorder.addListener(
        'onRecorderError',
        event => {
          recorderErrorEventRef.current =
            event;

          setRecorderState(
            current => ({
              ...current,
              isRecording: false,
              durationMillis:
                Math.max(
                  current.durationMillis,
                  event.durationMillis
                ),
              uri:
                event.uri ??
                current.uri,
              bytes:
                Math.max(
                  current.bytes,
                  event.bytes
                ),
              writerFailureMessage:
                event.message,
              engineRunning: false,
            })
          );

          if (__DEV__) {
            devConsole.warn(
              'LECTURE NATIVE ERROR',
              event
            );
          }
        }
      );

    return () => {
      readySubscription.remove();
      stoppedSubscription.remove();
      checkpointSubscription.remove();
      errorSubscription.remove();
    };
  }, []);


  useEffect(() => {

    const subscription =
      AppState.addEventListener(
        'change',
        nextState => {

          if (!__DEV__) {
            return;
          }

          try {

            const nativeStatus =
              LectureRecorder
                .getStatus();

            devConsole.log(
              'LECTURE APP STATE',
              {
                nextState,
                ...nativeStatus,
              }
            );

          } catch (error) {

            devConsole.warn(
              'Could not read native lecture recorder status:',
              error
            );
          }
        }
      );

    return () => {
      subscription.remove();
    };

  }, []);


  useEffect(() => {

    if (!pollingActive) {
      return;
    }

    const updateRecorderState =
      () => {

        try {

          const nativeState =
            LectureRecorder
              .getStatus();

          const rawNativeDuration =
            nativeState.durationMillis;

          const safeNativeDuration =
            Number.isFinite(
              rawNativeDuration
            ) &&
            rawNativeDuration >=
              0
              ? rawNativeDuration
              : 0;

          const safePeakDb =
            Number.isFinite(
              nativeState.peakDb
            )
              ? Number(
                  nativeState.peakDb
                )
              : -160;


          /*
           * During an accepted phone/audio interruption the native
           * recorder intentionally pauses capture. Do not turn that
           * expected pause into a false "microphone has no signal"
           * warning.
           */
          if (
            nativeState
              .isPausedForInterruption
          ) {

            micSilenceStartedAtRef.current =
              null;

            setMicNoSignalWarning(
              false
            );

          } else if (
            safePeakDb <=
              -75
          ) {

            if (
              micSilenceStartedAtRef.current ===
                null
            ) {
              micSilenceStartedAtRef.current =
                Date.now();
            }

            if (
              Date.now() -
                micSilenceStartedAtRef.current >=
                  4000
            ) {
              setMicNoSignalWarning(
                true
              );
            }

          } else {

            micSilenceStartedAtRef.current =
              null;

            setMicNoSignalWarning(
              false
            );
          }


          /*
           * Native captured duration is the only recording clock.
           * Before the first real microphone buffer/write it must remain
           * at zero; a wall-clock fallback falsely makes a failed recorder
           * look as though it captured audio.
           */
          setRecorderState({
            ...nativeState,
            durationMillis:
              safeNativeDuration,
          });

        } catch (error) {

          devConsole.warn(
            'Could not poll lecture recorder:',
            error
          );
        }
      };

    updateRecorderState();

    const timer =
      setInterval(
        updateRecorderState,
        250
      );

    return () => {
      clearInterval(
        timer
      );

      micSilenceStartedAtRef.current =
        null;

      setMicNoSignalWarning(
        false
      );
    };

  }, [pollingActive]);


  const inferRecoveredCreatedAt =
    (
      id: string,
      existing:
        string | null | undefined
    ) => {
      if (existing) {
        return existing;
      }

      const timestamp =
        Number(id);

      if (
        Number.isFinite(timestamp) &&
        timestamp > 0
      ) {
        return new Date(
          timestamp
        ).toISOString();
      }

      return new Date()
        .toISOString();
    };


  const recoverInterruptedRecordings =
    async (onlyLectureId?: string) => {
      try {
        const root =
          new Directory(
            Paths.document,
            'lectures'
          );

        if (!root.exists) {
          return;
        }

        for (
          const entry
          of root.list()
        ) {
          if (
            !(entry instanceof Directory)
          ) {
            continue;
          }

          // Stop-error recovery should touch only the lecture that just failed.
          // Startup recovery omits onlyLectureId and can still repair the archive.
          if (onlyLectureId && entry.name !== onlyLectureId) {
            continue;
          }

          const metadata =
            readMetadata(
              entry
            );

          const segmentsDirectory =
            new Directory(
              entry,
              '.audio-segments'
            );

          let hasRecoverableSegments = false;
          let hasUnresolvedPartialSegments = false;

          const refreshSegmentInventory =
            () => {
              hasRecoverableSegments = false;
              hasUnresolvedPartialSegments = false;

              if (!segmentsDirectory.exists) {
                return;
              }

              try {
                const segmentEntries =
                  segmentsDirectory.list();

                hasRecoverableSegments =
                  segmentEntries.some(item =>
                    item instanceof File &&
                    item.name.startsWith('segment-') &&
                    item.name.endsWith('.m4a') &&
                    !item.name.endsWith('.part.m4a')
                  );

                hasUnresolvedPartialSegments =
                  segmentEntries.some(item =>
                    item instanceof File &&
                    item.name.startsWith('segment-') &&
                    item.name.endsWith('.part.m4a')
                  );
              } catch {
                hasRecoverableSegments = false;
                hasUnresolvedPartialSegments = false;
              }
            };

          refreshSegmentInventory();

          let rollbackCandidate: File | null = null;

          try {
            rollbackCandidate =
              entry
                .list()
                .find(item =>
                  item instanceof File &&
                  item.name.startsWith(
                    'audio-rollback-'
                  ) &&
                  item.name.endsWith('.m4a')
                ) as File | undefined || null;
          } catch {
            rollbackCandidate = null;
          }

          /*
           * Finalized checkpoint segments are intentionally retained
           * after a successful recording. Their presence alone is not
           * evidence of an interrupted recording.
           *
           * A saved lecture with finalized segments but without its
           * derived audio.m4a needs assembly, not crash recovery.
           */
          const existingAudioBeforeRecovery =
            findAudioFile(
              entry,
              metadata
            );

          const isInterruptedRecording =
            metadata.recordingState ===
              'recording' ||
            metadata.recordingState ===
              'interrupted';

          const savedNeedsAssembly =
            metadata.recordingState ===
              'saved' &&
            hasRecoverableSegments &&
            !existingAudioBeforeRecovery;

          const needsRepair =
            isInterruptedRecording ||
            savedNeedsAssembly ||
            !!rollbackCandidate ||
            !metadata.id;

          if (!needsRepair) {
            continue;
          }

          /*
           * Segmented recorder V2 stores finalized checkpoint segments
           * beside audio.m4a while recording. After force-quit there may
           * be no final audio.m4a yet, so ask native recovery to assemble
           * every valid checkpoint before looking for the lecture audio.
           *
           * For pre-segmentation 1.0.8 recordings this call simply finds
           * no checkpoint directory and the old validation path below
           * still handles any existing M4A exactly as before.
           */
          let recoveredCheckpointDurationMillis =
            0;

          let recoveredCheckpointBytes =
            0;

          let segmentRecoveryValidated = false;
          let segmentRecoveryMessage:
            string | null =
              null;

          if (
            isInterruptedRecording ||
            savedNeedsAssembly
          ) {
            const expectedAudioName =
              metadata.audioFile ||
              'audio.m4a';

            const expectedAudio =
              new File(
                entry,
                expectedAudioName
              );

            const recoveryDiagnosticId =
              newAudioDiagnosticId();
            const recoveryStartedAt =
              new Date().toISOString();
            const recoveryT0 = Date.now();
            const recoveryBeginEvent =
              isInterruptedRecording
                ? 'RECOVERY_BEGIN'
                : 'RECOVERY_ASSEMBLY_BEGIN';

            // Commit the begin event to local storage before native work.
            // Existing server status values are preserved; the explicit pending
            // code distinguishes this snapshot from a terminal recovery failure.
            await enqueueAudioDiagnostic({
              session_id: recoveryDiagnosticId,
              mode: 'normal', status: 'failed',
              started_at: recoveryStartedAt, finished_at: recoveryStartedAt,
              error_code: isInterruptedRecording ? 'RECOVERY_PENDING' : 'RECOVERY_ASSEMBLY_PENDING',
              events: [{ name: recoveryBeginEvent, at_ms: 0 }],
            });

            try {
              const recovery =
                isInterruptedRecording
                  ? await LectureRecorder
                      .recoverRecording(
                        expectedAudio.uri
                      )
                  : await LectureRecorder
                      .assembleRecording(
                        expectedAudio.uri
                      );

              enqueueAudioDiagnostic({
                session_id: recoveryDiagnosticId,
                mode: 'normal',
                status:
                  recovery.valid && recovery.playable
                    ? 'saved'
                    : 'failed',
                started_at: recoveryStartedAt,
                finished_at: new Date().toISOString(),
                error_code:
                  recovery.valid && recovery.playable
                    ? null
                    : (recovery.code ?? 'RECOVERY_NOT_READY'),
                events: [
                  { name: recoveryBeginEvent, at_ms: 0 },
                  {
                    name:
                      recovery.valid && recovery.playable
                        ? (
                          isInterruptedRecording
                            ? 'RECOVERY_AUDIO_READY'
                            : 'RECOVERY_ASSEMBLY_AUDIO_READY'
                        )
                        : (
                          isInterruptedRecording
                            ? 'RECOVERY_FAILED'
                            : 'RECOVERY_ASSEMBLY_FAILED'
                        ),
                    at_ms: Math.max(0, Date.now() - recoveryT0),
                  },
                ],
              });

              recoveredCheckpointDurationMillis =
                Math.max(
                  0,
                  recovery.durationMillis
                );

              recoveredCheckpointBytes =
                Math.max(
                  0,
                  recovery.bytes
                );

              segmentRecoveryMessage =
                recovery.message;
              segmentRecoveryValidated = recovery.valid || recovery.durableSegmentsVerified === true;

              if (__DEV__) {
                devConsole.log(
                  isInterruptedRecording
                    ? 'LECTURE SEGMENT RECOVERY'
                    : 'LECTURE SEGMENT ASSEMBLY',
                  {
                    id:
                      metadata.id ||
                      entry.name,
                    ...recovery,
                  }
                );
              }
            } catch (error) {
              enqueueAudioDiagnostic({
                session_id: recoveryDiagnosticId,
                mode: 'normal',
                status: 'failed',
                started_at: recoveryStartedAt,
                finished_at: new Date().toISOString(),
                error_code:
                  isInterruptedRecording
                    ? 'RECOVERY_EXCEPTION'
                    : 'RECOVERY_ASSEMBLY_EXCEPTION',
                events: [
                  { name: recoveryBeginEvent, at_ms: 0 },
                  {
                    name:
                      isInterruptedRecording
                        ? 'RECOVERY_EXCEPTION'
                        : 'RECOVERY_ASSEMBLY_EXCEPTION',
                    at_ms: Math.max(0, Date.now() - recoveryT0),
                  },
                ],
              });

              devConsole.warn(
                isInterruptedRecording
                  ? 'Could not recover lecture checkpoint segments:'
                  : 'Could not assemble saved lecture checkpoint segments:',
                error
              );
            }
          }

          let audio =
            findAudioFile(
              entry,
              metadata
            );

          if (!audio && rollbackCandidate) {
            try {
              const rollbackValidation =
                await LectureRecorder
                  .validateRecording(
                    rollbackCandidate.uri
                  );

              if (
                rollbackValidation.valid &&
                rollbackValidation.playable
              ) {
                const recoveredAudio =
                  new File(
                    entry,
                    'audio.m4a'
                  );

                await rollbackCandidate
                  .copy(recoveredAudio);

                const recoveredValidation =
                  await LectureRecorder
                    .validateRecording(
                      recoveredAudio.uri
                    );

                if (
                  recoveredValidation.valid &&
                  recoveredValidation.playable
                ) {
                  audio = {
                    file: recoveredAudio,
                    name: 'audio.m4a',
                  };

                  if (__DEV__) {
                    devConsole.log(
                      'LECTURE ROLLBACK RECOVERY',
                      {
                        id:
                          metadata.id ||
                          entry.name,
                        rollbackFile:
                          rollbackCandidate.name,
                      }
                    );
                  }
                }
                else if (recoveredAudio.exists) {
                  recoveredAudio.delete();
                }
              }
            } catch (error) {
              const failedRecoveredAudio =
                new File(
                  entry,
                  'audio.m4a'
                );

              if (
                !audio &&
                failedRecoveredAudio.exists
              ) {
                try {
                  failedRecoveredAudio.delete();
                } catch {}
              }

              devConsole.warn(
                'Could not recover lecture rollback audio:',
                error
              );
            }
          }

          if (!audio) {
            const id =
              metadata.id ||
              entry.name;

            const createdAt =
              inferRecoveredCreatedAt(
                id,
                metadata.createdAt
              );

            const durableDurationMillis =
              Math.max(
                metadata.durationMillis ??
                  0,
                recoveredCheckpointDurationMillis
              );

            const durableAudioBytes =
              Math.max(
                metadata.audioBytes ??
                  0,
                recoveredCheckpointBytes
              );

            /*
             * Native recovery may promote a valid .part.m4a to a durable
             * finalized checkpoint. Refresh the filesystem inventory after
             * recovery so JS never marks a lecture SAVED while an unresolved
             * partial tail still exists.
             */
            refreshSegmentInventory();

            const segmentBackedSaved =
              hasRecoverableSegments &&
              !hasUnresolvedPartialSegments &&
              (!isInterruptedRecording || segmentRecoveryValidated);

            writeMetadata(
              entry,
              {
                ...metadata,
                id,
                createdAt,
                durationMillis:
                  durableDurationMillis,
                language:
                  metadata.language ||
                  'nb-NO',
                audioFile:
                  metadata.audioFile ||
                  'audio.m4a',
                transcriptFile:
                  metadata.transcriptFile ??
                  null,
                transcriptReady:
                  metadata.transcriptReady ??
                  false,
                characters:
                  metadata.characters ??
                  0,
                audioBytes:
                  durableAudioBytes,
                source:
                  metadata.source ??
                  'recorded',
                originalFileName:
                  metadata.originalFileName ??
                  null,
                recordingState:
                  segmentBackedSaved
                    ? 'saved'
                    : 'interrupted',
                interruptionReason:
                  segmentBackedSaved
                    ? (
                      segmentRecoveryMessage ||
                      'The lecture checkpoints are saved, but the playable audio file is not assembled yet.'
                    )
                    : (segmentRecoveryMessage || 'Audio recovery is incomplete. Source checkpoints were preserved; retry recovery.'),
                transcription:
                  metadata.transcription ??
                  getDefaultTranscription(
                    durableDurationMillis
                  ),
              }
            );

            continue;
          }

          const validation =
            await LectureRecorder
              .validateRecording(
                audio.file.uri
              );

          const id =
            metadata.id ||
            entry.name;

          const createdAt =
            inferRecoveredCreatedAt(
              id,
              metadata.createdAt
            );

          const transcriptFile =
            new File(
              entry,
              'transcript.txt'
            );

          let characters =
            metadata.characters ??
            0;

          if (
            characters === 0 &&
            transcriptFile.exists
          ) {
            try {
              characters =
                transcriptFile
                  .textSync()
                  .length;
            } catch {
              characters = 0;
            }
          }

          const durationMillis =
            validation.valid &&
            validation.playable
              ? validation.durationMillis
              : 0;

          const recordingState =
            validation.valid &&
            validation.playable
              ? 'ready'
              : 'interrupted';

          const transcription =
            metadata.transcription ??
            getDefaultTranscription(
              durationMillis
            );

          writeMetadata(
            entry,
            {
              ...metadata,
              id,
              createdAt,
              durationMillis,
              language:
                metadata.language ||
                'nb-NO',
              audioFile:
                audio.name,
              transcriptFile:
                transcriptFile.exists
                  ? 'transcript.txt'
                  : null,
              transcriptReady:
                transcriptFile.exists,
              characters,
              audioBytes:
                validation.bytes ??
                audio.file.size ??
                0,
              source:
                metadata.source ??
                'recorded',
              originalFileName:
                metadata.originalFileName ??
                null,
              recordingState,
              interruptionReason:
                recordingState ===
                  'interrupted'
                  ? (
                    validation.message ||
                    'The recording was interrupted before iOS could finalize the audio file.'
                  )
                  : null,
              transcription,
            }
          );

          if (__DEV__) {
            devConsole.log(
              recordingState ===
                'ready'
                ? 'LECTURE INTERRUPTED RECORDING RECOVERED'
                : 'LECTURE INTERRUPTED RECORDING INVALID',
              {
                id,
                ...validation,
              }
            );
          }
        }
      } catch (error) {
        devConsole.error(
          'Could not recover interrupted recordings:',
          error
        );
      }
    };


  /*
   * Start is event-first and is not considered verified until native
   * confirms that the first microphone buffer was written successfully.
   */
  const waitForNativeRecorderReady =
    async (
      audioUri: string,
      timeoutMillis: number
    ) => {
      const deadline =
        Date.now() +
        timeoutMillis;

      while (
        Date.now() <
        deadline
      ) {
        const ready =
          recorderReadyEventRef.current;

        if (
          ready?.isRecording &&
          ready.uri ===
            audioUri
        ) {
          return ready;
        }

        /*
         * getStatus().isRecording is also authoritative: native only
         * reports true after at least one AVAudioFile.write(from:)
         * succeeded. Polling it avoids losing a valid start if the
         * one-shot ready event is delayed or missed.
         */
        const status =
          LectureRecorder.getStatus();

        if (
          status.isRecording &&
          status.uri ===
            audioUri
        ) {
          return status;
        }

        const nativeError =
          recorderErrorEventRef.current;

        if (
          nativeError &&
          (
            nativeError.uri ===
              null ||
            nativeError.uri ===
              audioUri
          )
        ) {
          return null;
        }

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              25
            )
        );
      }

      return null;
    };

  const attemptNativeRecordingStart =
    async (
      audioUri: string,
      attemptNumber: number
    ):
      Promise<
        VerifiedRecordingStart | null
      > => {

      recorderReadyEventRef.current =
        null;

      recorderErrorEventRef.current =
        null;

      const started =
        await LectureRecorder.start(
          audioUri
        );

      /*
       * Native start() now means "the engine accepted the start request".
       * A recording is verified only after native emits onRecorderReady,
       * which happens after the first AVAudioFile.write(from:) succeeds.
       */
      const readyEvent =
        await waitForNativeRecorderReady(
          audioUri,
          12000
        );

      const verified =
        LectureRecorder.getStatus();

      if (__DEV__) {
        devConsole.log(
          attemptNumber === 1
            ? 'LECTURE VERIFIED START'
            : 'LECTURE VERIFIED START AFTER RETRY',
          {
            readyEvent,
            verified,
          }
        );
      }

      if (
        !readyEvent ||
        !verified.isRecording
      ) {
        return null;
      }

      recordingStartedAtRef.current =
        Date.now() -
        Math.max(
          0,
          verified.durationMillis
        );

      return {
        started,
        verified,
      };
    };


  const startRecording =
    async (
      audioUri: string
    ):
      Promise<VerifiedRecordingStart> => {

      const verifiedAttempt =
        await attemptNativeRecordingStart(
          audioUri,
          1
        );

      if (!verifiedAttempt) {
        const nativeError =
          recorderErrorEventRef.current;

        let nativeStatus:
          LectureRecorderStatus | null =
            null;

        try {
          nativeStatus =
            LectureRecorder.getStatus();
        } catch {}

        throw new Error(
          (nativeStatus?.hasSuccessfulWrite === true && nativeStatus?.isRecording === false
            ? `Audio was written, but the native recorder stopped during startup. `
            : `The native recorder did not confirm a durable audio write. `) +
          (nativeError
            ? `native=${nativeError.code}: ${nativeError.message}; `
            : '') +
          `engineRunning=${String(nativeStatus?.engineRunning ?? false)}; ` +
          `hasSuccessfulWrite=${String(nativeStatus?.hasSuccessfulWrite ?? false)}; ` +
          `writerFailure=${nativeStatus?.writerFailureMessage ?? 'none'}; ` +
          `durationMs=${nativeStatus?.durationMillis ?? 0}; ` +
          `segments=${nativeStatus?.segmentCount ?? 0}`
        );
      }

      return verifiedAttempt;
    };


  const commitStartedRecording =
    (
      attempt:
        VerifiedRecordingStart
    ) => {
      const {
        started,
        verified,
      } = attempt;

      setRecorderState({
        ...verified,
        isRecording:
          verified.isRecording,
        durationMillis:
          Math.max(
            0,
            verified.durationMillis
          ),
        uri:
          verified.uri ??
          started.uri,
        bytes:
          verified.bytes,
      });

      micSilenceStartedAtRef.current =
        null;

      setMicNoSignalWarning(
        false
      );
    };


  const getRecordingElapsedMillis =
    () => {
      try {
        const nativeState =
          LectureRecorder
            .getStatus();

        if (
          Number.isFinite(
            nativeState.durationMillis
          ) &&
          nativeState.durationMillis >=
            0
        ) {
          return Math.max(
            0,
            nativeState.durationMillis
          );
        }
      } catch {
        // Fall through to the pre-segmentation wall-clock fallback.
      }

      const startedAt =
        recordingStartedAtRef.current;

      if (!startedAt) {
        return null;
      }

      return Math.max(
        0,
        Date.now() -
          startedAt
      );
    };


  /*
   * Build the derived M4A for exactly one saved lecture.
   *
   * Durable finalized segments remain untouched and continue to
   * be the recovery authority if assembly fails.
   */
  const assembleSavedRecording =
    async (
      destinationUri: string
    ) =>
      LectureRecorder
        .assembleRecording(
          destinationUri
        );


  const getRecorderStatus =
    () =>
      LectureRecorder.getStatus();


  const stopRecording =
    () =>
      LectureRecorder.stop();


  const cancelRecording =
    () =>
      LectureRecorder.cancel();


  const getAudioInfo =
    (
      uri: string
    ):
      Promise<LectureAudioInfo> =>
      LectureRecorder.getAudioInfo(
        uri
      );


  const resetRecorderState =
    () => {
      recordingStartedAtRef.current =
        null;

      micSilenceStartedAtRef.current =
        null;

      setMicNoSignalWarning(
        false
      );

      setRecorderState({
        ...EMPTY_RECORDER_STATE,
      });
    };


  const completeRecording =
    (
      durationMillis: number,
      uri: string,
      bytes: number
    ) => {
      recordingStartedAtRef.current =
        null;

      setRecorderState({
        isRecording: false,
        durationMillis,
        uri,
        bytes,
      });
    };


  return {
    recorderState,
    micNoSignalWarning,
    recoverInterruptedRecordings,
    assembleSavedRecording,
    startRecording,
    commitStartedRecording,
    getRecordingElapsedMillis,
    getRecorderStatus,
    stopRecording,
    cancelRecording,
    getAudioInfo,
    resetRecorderState,
    completeRecording,
  };
}

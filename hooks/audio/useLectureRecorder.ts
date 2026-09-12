import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import LectureRecorder, {
  type LectureAudioInfo,
  type LectureRecorderErrorEvent,
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
};


export function useLectureRecorder(
  {
    pollingActive,
  }: UseLectureRecorderOptions
) {

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

    const errorSubscription =
      LectureRecorder.addListener(
        'onRecorderError',
        event => {
          recorderErrorEventRef.current =
            event;

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

          const wallClockDuration =
            recordingStartedAtRef.current
              ? Math.max(
                  0,
                  Date.now() -
                    recordingStartedAtRef.current
                )
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
           * From segmented recorder V2 onward native duration is
           * authoritative because it advances only while microphone
           * audio is actually captured. A wall clock would incorrectly
           * include time spent on an accepted phone call.
           *
           * Keep the old wall-clock value only as a defensive fallback
           * before native capture has reported its first duration.
           */
          const authoritativeDuration =
            safeNativeDuration > 0 ||
            nativeState
              .isPausedForInterruption
              ? safeNativeDuration
              : Math.max(
                  0,
                  Math.min(
                    wallClockDuration,
                    1000
                  )
                );

          setRecorderState({
            ...nativeState,
            durationMillis:
              authoritativeDuration,
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
    async () => {
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

          const metadata =
            readMetadata(
              entry
            );

          const needsRecovery =
            metadata.recordingState ===
              'recording' ||
            metadata.recordingState ===
              'interrupted' ||
            !metadata.id;

          if (!needsRecovery) {
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
          if (
            metadata.recordingState ===
              'recording' ||
            metadata.recordingState ===
              'interrupted'
          ) {
            const expectedAudioName =
              metadata.audioFile ||
              'audio.m4a';

            const expectedAudio =
              new File(
                entry,
                expectedAudioName
              );

            try {
              const recovery =
                await LectureRecorder
                  .recoverRecording(
                    expectedAudio.uri
                  );

              if (__DEV__) {
                devConsole.log(
                  'LECTURE SEGMENT RECOVERY',
                  {
                    id:
                      metadata.id ||
                      entry.name,
                    ...recovery,
                  }
                );
              }
            } catch (error) {
              devConsole.warn(
                'Could not assemble lecture checkpoint segments:',
                error
              );
            }
          }

          const audio =
            findAudioFile(
              entry,
              metadata
            );

          if (!audio) {
            const id =
              metadata.id ||
              entry.name;

            const createdAt =
              inferRecoveredCreatedAt(
                id,
                metadata.createdAt
              );

            writeMetadata(
              entry,
              {
                ...metadata,
                id,
                createdAt,
                durationMillis: 0,
                language:
                  metadata.language ||
                  'nb-NO',
                audioFile:
                  metadata.audioFile ||
                  'audio.m4a',
                transcriptFile: null,
                transcriptReady: false,
                characters: 0,
                audioBytes: 0,
                source:
                  metadata.source ??
                  'recorded',
                originalFileName:
                  metadata.originalFileName ??
                  null,
                recordingState:
                  'interrupted',
                interruptionReason:
                  'The app closed before the first recoverable audio checkpoint was finalized.',
                transcription:
                  metadata.transcription ??
                  getDefaultTranscription(
                    0
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
   * 1.0.8 is event-first but intentionally keeps the proven
   * 450 ms verification window as a fallback. Once repeated
   * device tests prove onRecorderReady is fully reliable, the
   * fixed wait can be removed in a later build.
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

      if (
        !started.isRecording
      ) {
        return null;
      }

      recordingStartedAtRef.current =
        Date.now();

      const readyEvent =
        await waitForNativeRecorderReady(
          audioUri,
          450
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
        !verified.isRecording
      ) {
        return null;
      }

      return {
        started:
          readyEvent ??
          started,
        verified,
      };
    };


  const startRecording =
    async (
      audioUri: string
    ):
      Promise<VerifiedRecordingStart> => {

      let verifiedAttempt:
        VerifiedRecordingStart | null =
          null;

      for (
        let attemptNumber = 1;
        attemptNumber <= 2;
        attemptNumber += 1
      ) {

        if (
          attemptNumber >
            1
        ) {

          if (__DEV__) {
            devConsole.warn(
              'LECTURE FIRST START LOST SESSION — retrying once'
            );
          }

          try {

            await LectureRecorder.cancel();

          } catch {
            // Continue with the recovery attempt.
          }

          recordingStartedAtRef.current =
            null;

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                500
              )
          );
        }

        verifiedAttempt =
          await attemptNativeRecordingStart(
            audioUri,
            attemptNumber
          );

        if (
          verifiedAttempt
        ) {
          break;
        }
      }

      if (
        !verifiedAttempt
      ) {
        throw new Error(
          'The native recorder stopped immediately after two start attempts.'
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

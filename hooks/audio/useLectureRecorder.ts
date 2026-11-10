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
  inspectDurableTranscriptInventory,
  claimLectureRecovery,
  releaseLectureRecovery,
  lectureWorkGeneration,
  validateLectureAudio,
  withAudioOperationDeadline,
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


type RecoveryObserver = {
  progress: (id: string, active: boolean) => void;
  settled: () => void;
};
let startupRecoveryScan: {
  observers: Set<RecoveryObserver>;
  active: Set<string>;
  completed: Set<string>;
} | null = null;

/** Share an in-flight startup scan across screen remounts; observers own no files. */
export function observeStartupLectureRecovery(
  run: (onlyId?: string, progress?: (id: string, active: boolean) => void) => Promise<void>,
  observer: RecoveryObserver,
): () => void {
  const notify = (work: () => void) => { try { work(); } catch { /* UI is advisory. */ } };
  let scan = startupRecoveryScan;
  if (!scan) {
    scan = { observers: new Set(), active: new Set(), completed: new Set() };
    startupRecoveryScan = scan;
    const ownedScan = scan;
    // Yield once so the first observer is registered before native work starts.
    void Promise.resolve().then(() => run(undefined, (id, active) => {
      if (active) { ownedScan.active.add(id); ownedScan.completed.delete(id); }
      else { ownedScan.active.delete(id); ownedScan.completed.add(id); }
      for (const item of ownedScan.observers) notify(() => item.progress(id, active));
    })).catch(error => {
      devConsole.warn('Startup lecture recovery failed; source files preserved:', error);
    }).finally(() => {
      if (startupRecoveryScan === ownedScan) startupRecoveryScan = null;
      for (const item of ownedScan.observers) notify(item.settled);
      ownedScan.observers.clear();
    });
  }
  scan.observers.add(observer);
  for (const id of scan.completed) notify(() => observer.progress(id, false));
  for (const id of scan.active) notify(() => observer.progress(id, true));
  const subscribedScan = scan;
  return () => { subscribedScan.observers.delete(observer); };
}

export function useLectureRecorder(
  {
    pollingActive,
    onCheckpointCommitted,
  }: UseLectureRecorderOptions
) {

  const requestedAudioUriRef = useRef<string | null>(null);
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


  const recoverInterruptedRecordings = async (
    onlyLectureId?: string,
    onProgress?: (lectureId: string, active: boolean) => void,
  ) => {
    const root = new Directory(Paths.document, 'lectures');
    if (!root.exists) return;
    for (const entry of root.list()) {
      if (!(entry instanceof Directory) || (onlyLectureId && entry.name !== onlyLectureId)) continue;
      if (!claimLectureRecovery(entry.uri)) continue;
      const generation = lectureWorkGeneration(entry.name);
      let announced = false;
      const notify = (active: boolean) => {
        try { onProgress?.(entry.name, active); }
        catch { /* Presentation must not interrupt recovery or release. */ }
      };
      try {
        const initial = readMetadata(entry);
        const nativeOwnsEntry = () => { const status = LectureRecorder.getStatus(); return !!status.uri && status.uri.startsWith(entry.uri.replace(/\/$/, "") + "/"); };
        if (nativeOwnsEntry()) continue;
        const initialIdentity = initial.createdAt ?? null;
        let inventory = inspectDurableTranscriptInventory(entry);
        const interrupted = initial.recordingState === 'recording' || initial.recordingState === 'interrupted';
        const existing = findAudioFile(entry, initial);
        const rollback = entry.list().find(item => item instanceof File && /^audio-rollback-.*\.m4a$/.test(item.name)) as File | undefined;
        let assemblyFailed = false;
        let publishedManifestPending = false;
        let savedWithReadyManifest = false;
        try {
          const manifest = new File(entry, 'recording-manifest.json');
          const assembly = manifest.exists ? JSON.parse(manifest.textSync())?.assembly : null;
          savedWithReadyManifest = initial.recordingState === 'saved' && !!existing && assembly?.state === 'ready';
          assemblyFailed = assembly?.state === 'assembly_failed';
          publishedManifestPending = !!existing && assembly?.state === 'assembling' && typeof assembly.publicationID === 'string';
        } catch { /* A damaged manifest must still go through native recovery. */ }
        if (!onlyLectureId && initial.recordingState === 'saved' && inventory.complete &&
            !inventory.unresolved && assemblyFailed && !rollback) continue;
        const needsAssembly = publishedManifestPending || savedWithReadyManifest ||
          (initial.recordingState === 'saved' && !existing && inventory.present);
        if (!interrupted && !needsAssembly && !rollback && initial.id) continue;
        announced = true;
        notify(true);
        const current = () => entry.exists && lectureWorkGeneration(entry.name) === generation && !nativeOwnsEntry();
        let reason: string | null = null;
        let nativeVerified = false;
        let nativeOutputVerified = false;
        if (interrupted || needsAssembly || inventory.unresolved) {
          const destination = new File(entry, initial.audioFile || 'audio.m4a');
          const diagnosticId = newAudioDiagnosticId(), startedAt = new Date().toISOString(), t0 = Date.now();
          const begin = interrupted ? 'RECOVERY_BEGIN' : 'RECOVERY_ASSEMBLY_BEGIN';
          void enqueueAudioDiagnostic({session_id:diagnosticId,mode:'normal',status:'failed',started_at:startedAt,finished_at:startedAt,error_code:'RECOVERY_PENDING',events:[{name:begin,at_ms:0,lecture_id:entry.name}]}).catch(() => {});
          try {
            const result = await withAudioOperationDeadline(
              (async () => {
                const recovered = interrupted || inventory.unresolved
                  ? await LectureRecorder.recoverRecording(destination.uri)
                  : await LectureRecorder.assembleRecording(destination.uri);
                if (onlyLectureId && recovered.durableSegmentsVerified === true &&
                    recovered.code === 'ERR_ASSEMBLY_RETRY_REQUIRED') {
                  const assembled = await LectureRecorder.assembleRecording(destination.uri);
                  return { ...assembled, durableSegmentsVerified: true };
                }
                return recovered;
              })(),
              135000, 'Audio preparation/recovery');
            nativeOutputVerified = result.valid && result.playable;
            nativeVerified = result.valid || result.durableSegmentsVerified === true;
            reason = result.valid && result.playable ? null : (result.message || 'Audio preparation requires retry.');
            void enqueueAudioDiagnostic({session_id:diagnosticId,mode:'normal',status:result.valid && result.playable ? 'saved':'failed',started_at:startedAt,finished_at:new Date().toISOString(),error_code:result.valid && result.playable ? null:(result.code || 'RECOVERY_NOT_READY'),events:[{name:begin,at_ms:0,lecture_id:entry.name},{name:result.valid && result.playable ? 'RECOVERY_AUDIO_READY':'RECOVERY_FAILED',at_ms:Date.now()-t0}]}).catch(() => {});
          } catch (error) {
            reason = `Audio recovery requires retry: ${String(error)}`;
            void enqueueAudioDiagnostic({session_id:diagnosticId,mode:'normal',status:'failed',started_at:startedAt,finished_at:new Date().toISOString(),error_code:'RECOVERY_EXCEPTION',events:[{name:begin,at_ms:0,lecture_id:entry.name},{name:'RECOVERY_EXCEPTION',at_ms:Date.now()-t0}]}).catch(() => {});
          }
        }
        if (!current()) continue;
        inventory = inspectDurableTranscriptInventory(entry);
        let latest = readMetadata(entry);
        if ((latest.createdAt ?? null) !== initialIdentity || latest.recordingState === 'recording' && !interrupted) continue;
        let audio = findAudioFile(entry, latest);
        // Keep the rollback original. Never overwrite an existing derived file here.
        if (!audio && rollback) {
          try {
            const validation = await validateLectureAudio(rollback.uri);
            if (!current()) continue;
            if (validation.valid && validation.playable) audio = {file:rollback,name:rollback.name};
          } catch (error) { reason = String(error); }
        }
        let valid: Awaited<ReturnType<typeof validateLectureAudio>> | null = null;
        if (audio) {
          try { valid = await validateLectureAudio(audio.file.uri); }
          catch (error) { reason = `Audio validation requires retry: ${String(error)}`; }
        }
        if (!current()) continue;
        // After native crash recovery verifies the durable committed prefix,
        // its duration is authoritative. The pre-crash UI elapsed time may
        // include an incomplete terminal tail that could not be recovered.
        const expectedInventoryMillis =
          interrupted && nativeVerified
            ? 0
            : initial.durationMillis ?? 0;

        inventory = inspectDurableTranscriptInventory(
          entry,
          expectedInventoryMillis
        );
        latest = readMetadata(entry); // Preserve rename and derived-text writers that completed during await.
        if ((latest.createdAt ?? null) !== initialIdentity) continue;
        const playable = valid?.valid === true && valid.playable === true;
        // A playable old output is not proof that all captured material was recovered.
        const incomplete = inventory.unresolved || (inventory.present && !inventory.complete);
        const finalCoversInventory = !inventory.present || !inventory.complete ||
          Math.abs((valid?.durationMillis ?? 0) - inventory.durationMillis) <=
            Math.max(2000, Math.min(10000, Math.round(inventory.durationMillis * 0.0015)));
        const verifiedInventory = inventory.complete && (!interrupted || nativeVerified);
        const ready = playable && !incomplete && finalCoversInventory && (!inventory.present || !interrupted || nativeVerified) &&
          (!(publishedManifestPending || savedWithReadyManifest) || nativeOutputVerified);
        const state = ready ? 'ready' : verifiedInventory && !inventory.unresolved ? 'saved' : 'interrupted';
        const recoveredDurablePrefix =
          interrupted &&
          nativeVerified &&
          inventory.complete;

        const duration =
          recoveredDurablePrefix
            ? inventory.durationMillis
            : ready
              ? valid!.durationMillis
              : Math.max(
                  latest.durationMillis ?? 0,
                  inventory.durationMillis
                );
        const transcript = new File(entry, 'transcript.txt');
        writeMetadata(entry, {...latest,
          id: latest.id || entry.name, createdAt: inferRecoveredCreatedAt(latest.id || entry.name, latest.createdAt),
          language: latest.language || 'nb-NO', durationMillis:duration,
          audioFile:audio?.name || latest.audioFile || 'audio.m4a',
          audioBytes:ready ? valid!.bytes : Math.max(latest.audioBytes ?? 0, inventory.bytes),
          transcriptFile:transcript.exists ? 'transcript.txt':null,
          transcriptReady:transcript.exists && latest.transcriptReady !== false &&
            (latest.transcription?.status === undefined || latest.transcription.status === 'done'),
          characters:transcript.exists ? (latest.characters || transcript.textSync().length):0,
          recordingState:state,
          partialRecovery: latest.partialRecovery === true || inventory.partialRecovery,
          interruptionReason:ready ? null : inventory.error || reason || 'Audio preparation is incomplete. Source audio was preserved; retry recovery.',
          transcription:latest.transcription || getDefaultTranscription(duration),source:latest.source || 'recorded',
        });
      } catch (error) { devConsole.warn('Lecture recovery failed; original files were preserved:', error); }
      finally {
        releaseLectureRecovery(entry.uri);
        if (announced) notify(false);
      }
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

      requestedAudioUriRef.current = audioUri;
      const started = await withAudioOperationDeadline(
        typeof LectureRecorder.startWithoutLivePCM === 'function'
          ? LectureRecorder.startWithoutLivePCM(audioUri)
          : LectureRecorder.start(audioUri),
        10000, 'Native recorder Start');

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
      withAudioOperationDeadline(LectureRecorder
        .assembleRecording(
          destinationUri
        ), 135000, 'Audio preparation/recovery');


  const getRecorderStatus =
    () =>
      LectureRecorder.getStatus();


  const stopRecording =
    () =>
      LectureRecorder.stop();


  const cancelRecording = () => {
    const uri = requestedAudioUriRef.current || LectureRecorder.getStatus().uri;
    return uri ? withAudioOperationDeadline(LectureRecorder.cancelForUri(uri), 12000, 'Recorder cleanup') : Promise.resolve({ok:true});
  };


  const getAudioInfo =
    (
      uri: string
    ):
      Promise<LectureAudioInfo> =>
      withAudioOperationDeadline(LectureRecorder.getAudioInfo(uri), 10000, 'Audio info');


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

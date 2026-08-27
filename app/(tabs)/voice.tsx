// app/(tabs)/voice.tsx

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

import LectureRecorder, {
  type LectureRecorderResult,
  type LectureRecorderStatus,
} from '@/modules/lecturerecorder';

import type {
  ActiveRecording,
  LectureItem,
  LectureMarker,
  LectureMarkerType,
  LectureMetadata,
  SavedTranscriptSegment,
} from '@/features/audio/lectureTypes';

import {
  createChunkPlan,
  findAudioFile,
  formatLectureDate,
  formatPlaybackTime,
  formatTime,
  getDefaultTranscription,
  getImportedAudioExtension,
  getLectureDirectory,
  markerLabel,
  normalizeMicDb,
  readLectureMarkers,
  readMetadata,
  readTranscriptSegments,
  writeLectureMarkers,
  writeMetadata,
} from '@/features/audio/lectureStorage';

import {
  useLectureTranslation,
} from '@/hooks/audio/useLectureTranslation';

import {
  useLectureTranscription,
} from '@/hooks/audio/useLectureTranscription';

import {
  useLectureExport,
} from '@/hooks/audio/useLectureExport';

import {
  AudioActionButton,
} from '@/components/audio/AudioActionButton';

import {
  ExportMenu,
} from '@/components/audio/ExportMenu';

import {
  MarkerList,
} from '@/components/audio/MarkerList';

import {
  TranscriptView,
} from '@/components/audio/TranscriptView';

import {
  TranslationPanel,
} from '@/components/audio/TranslationPanel';


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


export default function VoiceScreen() {

  const {
    theme,
    fonts,
    themeName,
  } = useTheme();

  const T = theme;
  const F = fonts;

  const isDark =
    themeName === 'dark';


  const [
    recorderState,
    setRecorderState,
  ] =
    useState<LectureRecorderStatus>({
      isRecording: false,
      durationMillis: 0,
      uri: null,
      bytes: 0,
    });

  const activeRecordingRef =
    useRef<ActiveRecording | null>(
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


  const player =
    useAudioPlayer(
      null,
      {
        updateInterval: 250,
        keepAudioSessionActive: true,
      }
    );

  const playerStatus =
    useAudioPlayerStatus(
      player
    );


  const [status, setStatus] =
    useState<
      'idle' |
      'recording' |
      'saved'
    >('idle');


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

    if (
      status !==
      'recording'
    ) {
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
           * Only show "no microphone signal" after
           * sustained near-silence. Natural pauses in speech
           * should not flash a red warning immediately.
           */
          if (
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


          setRecorderState({
            ...nativeState,
            durationMillis:
              Math.max(
                safeNativeDuration,
                wallClockDuration
              ),
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

  }, [status]);

  const [lectures, setLectures] =
    useState<LectureItem[]>([]);

  const [
    playingLectureId,
    setPlayingLectureId,
  ] =
    useState<string | null>(null);

  const [
    loadingLectureId,
    setLoadingLectureId,
  ] =
    useState<string | null>(null);

  const pendingPlaybackIdRef =
    useRef<string | null>(null);

  const pendingPlaybackUriRef =
    useRef<string | null>(null);

  const playbackSeekBarWidthRef =
    useRef(0);

  const pendingPlaybackSeekRef =
    useRef<{
      lectureId: string;
      seconds: number;
      autoplay: boolean;
    } | null>(
      null
    );

  const playbackRetryTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const playbackFailTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const [
    openedLectureId,
    setOpenedLectureId,
  ] =
    useState<string | null>(null);

  const [
    openedTranscript,
    setOpenedTranscript,
  ] =
    useState('');

  const [
    playbackError,
    setPlaybackError,
  ] =
    useState<string | null>(null);

  const [
    lastSavedLectureId,
    setLastSavedLectureId,
  ] =
    useState<string | null>(null);

  const [
    selectedMarkerType,
    setSelectedMarkerType,
  ] =
    useState<LectureMarkerType>(
      'important'
    );

  const [
    activeRecordingMarkers,
    setActiveRecordingMarkers,
  ] =
    useState<LectureMarker[]>(
      []
    );

  const [
    openedTranscriptSegments,
    setOpenedTranscriptSegments,
  ] =
    useState<SavedTranscriptSegment[]>(
      []
    );

  const [
    transcriptUpdatedLectureId,
    setTranscriptUpdatedLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    transcriptUpdatedFlashLectureId,
    setTranscriptUpdatedFlashLectureId,
  ] =
    useState<string | null>(
      null
    );

  const transcriptUpdatedFlashTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const transcriptUpdatedStatusTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  useEffect(() => {
    return () => {
      if (
        transcriptUpdatedFlashTimerRef.current
      ) {
        clearTimeout(
          transcriptUpdatedFlashTimerRef.current
        );
      }

      if (
        transcriptUpdatedStatusTimerRef.current
      ) {
        clearTimeout(
          transcriptUpdatedStatusTimerRef.current
        );
      }
    };
  }, []);

  /*
   * Prevent Start and Stop from overlapping when
   * the user taps the recording button repeatedly.
   */
  const recordingActionPendingRef =
    useRef(false);

  const processingLockRef =
    useRef<
      'transcription' |
      'translation' |
      null
    >(null);


  const loadLectures = () => {

    try {

      const root =
        new Directory(
          Paths.document,
          'lectures'
        );

      if (!root.exists) {

        root.create({
          intermediates: true,
          idempotent: true,
        });

        setLectures([]);
        return;
      }


      const items: LectureItem[] = [];


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
          readMetadata(entry);

        const audio =
          findAudioFile(
            entry,
            metadata
          );

        if (!audio) {
          continue;
        }


        const transcriptFile =
          new File(
            entry,
            'transcript.txt'
          );

        let characters =
          metadata.characters ?? 0;

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
          metadata.durationMillis ?? 0;

        const markers =
          readLectureMarkers(
            entry
          );

        const transcriptSegments =
          readTranscriptSegments(
            entry
          );

        const transcription =
          metadata.transcription ??
          getDefaultTranscription(
            durationMillis
          );


        items.push({

          id:
            metadata.id ||
            entry.name,

          createdAt:
            metadata.createdAt ??
            null,

          durationMillis,

          language:
            metadata.language ||
            'nb-NO',

          audioUri:
            audio.file.uri,

          audioFileName:
            audio.name,

          transcriptUri:
            transcriptFile.exists
              ? transcriptFile.uri
              : null,

          transcriptReady:
            transcriptFile.exists,

          characters,

          audioBytes:
            metadata.audioBytes ??
            audio.file.size,

          transcription,
          markers,
          transcriptSegments,
        });
      }


      items.sort(
        (a, b) => {

          const aTime =
            a.createdAt
              ? new Date(
                  a.createdAt
                ).getTime()
              : Number(a.id) || 0;

          const bTime =
            b.createdAt
              ? new Date(
                  b.createdAt
                ).getTime()
              : Number(b.id) || 0;

          return bTime - aTime;
        }
      );


      setLectures(items);

    } catch (error) {

      devConsole.error(
        'Could not load saved lectures:',
        error
      );
    }
  };




  const translation =
    useLectureTranslation({
      openedLectureId,
      openedTranscript,
      processingLockRef,
    });


  const transcription =
    useLectureTranscription({
      processingLockRef,
      loadLectures,
      onTranslationsInvalidated:
        translation.clearTranslationState,
      onTranscriptReady:
        ({
          lecture,
          text,
          segments,
          isRetranscription,
        }) => {
          setOpenedLectureId(
            lecture.id
          );

          setOpenedTranscript(
            text
          );

          setOpenedTranscriptSegments(
            segments
          );

          translation
            .clearTranslationState();

          if (
            isRetranscription
          ) {
            setTranscriptUpdatedLectureId(
              lecture.id
            );

            setTranscriptUpdatedFlashLectureId(
              lecture.id
            );

            if (
              transcriptUpdatedFlashTimerRef.current
            ) {
              clearTimeout(
                transcriptUpdatedFlashTimerRef.current
              );
            }

            if (
              transcriptUpdatedStatusTimerRef.current
            ) {
              clearTimeout(
                transcriptUpdatedStatusTimerRef.current
              );
            }

            transcriptUpdatedFlashTimerRef.current =
              setTimeout(
                () => {
                  setTranscriptUpdatedFlashLectureId(
                    current =>
                      current ===
                        lecture.id
                        ? null
                        : current
                  );
                },
                3000
              );

            transcriptUpdatedStatusTimerRef.current =
              setTimeout(
                () => {
                  setTranscriptUpdatedLectureId(
                    current =>
                      current ===
                        lecture.id
                        ? null
                        : current
                  );
                },
                60000
              );
          }
        },
    });


  const lectureExport =
    useLectureExport();


  const {
    translationTarget,
    translatingLectureId,
    openedTranslation,
    translationError,
    clearTranslationState,
    loadSavedTranslation,
    handleSelectTranslationTarget,
    handleTranslateTranscript,
  } =
    translation;


  const {
    transcribingLectureId,
    retranscribingLectureId,
    whisperStage,
    liveTranscript,
    transcriptionError,
    handleCreateTranscript,
    confirmRetranscribe,
  } =
    transcription;


  const {
    exportLectureId,
    exportingLectureId,
    setExportLectureId,
    handleExportLecture,
  } =
    lectureExport;


  const isLectureProcessing =
    !!(
      transcribingLectureId ||
      translatingLectureId
    );


  useEffect(() => {
    loadLectures();
  }, []);

  const clearPlaybackLoadTimers =
    () => {

      if (
        playbackRetryTimerRef.current
      ) {
        clearTimeout(
          playbackRetryTimerRef.current
        );
        playbackRetryTimerRef.current =
          null;
      }

      if (
        playbackFailTimerRef.current
      ) {
        clearTimeout(
          playbackFailTimerRef.current
        );
        playbackFailTimerRef.current =
          null;
      }
    };


  useEffect(() => {

    const pendingId =
      pendingPlaybackIdRef.current;

    if (
      !pendingId ||
      playingLectureId !==
        pendingId
    ) {
      return;
    }

    /*
     * In expo-audio, replace() is synchronous but
     * loading the new source is not. AudioStatus.duration
     * is documented as 0 until iOS has determined it.
     *
     * Therefore we wait for a real loaded duration
     * instead of guessing with an 80 ms timer.
     */
    if (
      !playerStatus.isLoaded ||
      playerStatus.duration <= 0
    ) {
      return;
    }


    clearPlaybackLoadTimers();

    pendingPlaybackIdRef.current =
      null;

    pendingPlaybackUriRef.current =
      null;

    setLoadingLectureId(
      null
    );


    try {

      const pendingSeek =
        pendingPlaybackSeekRef.current;

      if (
        pendingSeek &&
        pendingSeek.lectureId ===
          pendingId
      ) {

        pendingPlaybackSeekRef.current =
          null;

        void player
          .seekTo(
            Math.min(
              playerStatus.duration,
              Math.max(
                0,
                pendingSeek.seconds
              )
            )
          )
          .then(
            () => {
              if (
                pendingSeek.autoplay
              ) {
                player.play();
              }
            }
          )
          .catch(
            error => {
              devConsole.error(
                'Playback timestamp seek error:',
                error
              );

              if (
                pendingSeek.autoplay
              ) {
                try {
                  player.play();
                } catch {
                  // Keep loaded audio even if seek failed.
                }
              }
            }
          );

        return;
      }


      player.play();

    } catch (error) {

      devConsole.error(
        'Playback start after load error:',
        error
      );

      setPlaybackError(
        'Audio loaded, but playback could not start.'
      );
    }

  }, [
    playerStatus.isLoaded,
    playerStatus.duration,
    playingLectureId,
  ]);


  useEffect(() => {

    return () => {
      clearPlaybackLoadTimers();
    };

  }, []);




  type VerifiedRecordingStart = {
    started:
      LectureRecorderResult;
    verified:
      LectureRecorderStatus;
  };


  /*
   * Keep the proven iOS timing workaround centralized.
   * The delay values are intentionally unchanged in 1.0.7.
   * Replacing them with native readiness events comes after
   * the Whisper A/B test.
   */
  const attemptNativeRecordingStart =
    async (
      audioUri: string,
      attemptNumber: number
    ):
      Promise<
        VerifiedRecordingStart | null
      > => {

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

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            450
          )
      );

      const verified =
        LectureRecorder.getStatus();

      if (__DEV__) {
        devConsole.log(
          attemptNumber === 1
            ? 'LECTURE VERIFIED START'
            : 'LECTURE VERIFIED START AFTER RETRY',
          verified
        );
      }

      if (
        !verified.isRecording
      ) {
        return null;
      }

      return {
        started,
        verified,
      };
    };


  const resetRecordingState =
    async () => {

      activeRecordingRef.current =
        null;

      recordingStartedAtRef.current =
        null;

      micSilenceStartedAtRef.current =
        null;

      setMicNoSignalWarning(
        false
      );

      setActiveRecordingMarkers(
        []
      );

      setRecorderState({
        isRecording: false,
        durationMillis: 0,
        uri: null,
        bytes: 0,
      });

      setStatus(
        'idle'
      );

      try {

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          allowsBackgroundRecording: false,
          interruptionMode: 'doNotMix',
        });

      } catch {
        // Ignore secondary audio-session cleanup errors.
      }
    };


  const handleStart =
    async () => {

      if (
        recordingActionPendingRef.current
      ) {
        return;
      }

      recordingActionPendingRef.current =
        true;


      try {

        if (
          isLectureProcessing
        ) {

          Alert.alert(
            'Processing in progress',
            'Wait until transcription or translation finishes.'
          );

          return;
        }


        clearPlaybackLoadTimers();

        pendingPlaybackIdRef.current =
          null;

        pendingPlaybackUriRef.current =
          null;

        pendingPlaybackSeekRef.current =
          null;

        /*
         * Stop active playback first.
         *
         * keepAudioSessionActive prevents this player
         * from automatically deactivating the shared
         * iOS AVAudioSession. We still wait briefly on
         * every Start so any already-scheduled native
         * player/session work from the previous state
         * has time to finish before LectureRecorder
         * activates its recording session.
         */
        if (
          playerStatus.playing
        ) {
          player.pause();
        }


        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              350
            )
        );


        setPlayingLectureId(
          null
        );

        setLoadingLectureId(
          null
        );

        setPlaybackError(
          null
        );

        const permission =
          await requestRecordingPermissionsAsync();


        if (!permission.granted) {

          Alert.alert(
            'Microphone permission',
            'Microphone access is required.'
          );

          return;
        }


        const id =
          Date.now().toString();

        const createdAt =
          new Date().toISOString();

        const directory =
          getLectureDirectory(
            id
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


        /*
         * Recording is handled by our own iOS AVAudioRecorder
         * module. Verify each native start after the same
         * proven 450ms interval and recover once if iOS loses
         * the first shared audio-session activation.
         */
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
              audioFile.uri,
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


        const {
          started,
          verified:
            verifiedStart,
        } =
          verifiedAttempt;


        activeRecordingRef.current = {
          id,
          createdAt,
          directory,
          audioFile,
        };

        setActiveRecordingMarkers(
          []
        );

        writeLectureMarkers(
          directory,
          []
        );


        setRecorderState({
          isRecording:
            verifiedStart.isRecording,
          durationMillis:
            Math.max(
              0,
              verifiedStart.durationMillis,
              recordingStartedAtRef.current
                ? Date.now() -
                    recordingStartedAtRef.current
                : 0
            ),
          uri:
            verifiedStart.uri ??
            started.uri,
          bytes:
            verifiedStart.bytes,
        });

        micSilenceStartedAtRef.current =
          null;

        setMicNoSignalWarning(
          false
        );

        setStatus(
          'recording'
        );

      } catch (error) {

        devConsole.error(
          'Lecture recording start error:',
          error
        );


        try {
          await LectureRecorder.cancel();
        } catch {
          // Ignore secondary cleanup errors.
        }


        await resetRecordingState();


        Alert.alert(
          'Recording error',
          error instanceof Error
            ? error.message
            : String(error)
        );

      } finally {

        recordingActionPendingRef.current =
          false;
      }
    };


  const handleMarkMoment =
    (
      type:
        LectureMarkerType =
          selectedMarkerType
    ) => {

      const active =
        activeRecordingRef.current;

      const startedAt =
        recordingStartedAtRef.current;

      if (
        status !== 'recording' ||
        !active ||
        !startedAt
      ) {
        return;
      }


      const timeMillis =
        Math.max(
          0,
          Date.now() -
            startedAt
        );


      const marker: LectureMarker = {
        id:
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        timeMillis,
        type,
        note: '',
        createdAt:
          new Date().toISOString(),
      };


      setActiveRecordingMarkers(
        previous => {

          const next = [
            ...previous,
            marker,
          ].sort(
            (a, b) =>
              a.timeMillis -
              b.timeMillis
          );


          try {
            writeLectureMarkers(
              active.directory,
              next
            );
          } catch (error) {
            devConsole.error(
              'Could not save lecture marker:',
              error
            );
          }

          return next;
        }
      );
    };


  const handleStop =
    async () => {

      if (
        recordingActionPendingRef.current
      ) {
        return;
      }

      recordingActionPendingRef.current =
        true;


      try {

        const active =
          activeRecordingRef.current;

        if (!active) {
          throw new Error(
            'The active lecture recording could not be found.'
          );
        }


        const beforeStop =
          LectureRecorder.getStatus();


        if (__DEV__) {
          devConsole.log(
            'LECTURE BEFORE STOP',
            beforeStop
          );
        }


        /*
         * getStatus() is diagnostic only. The native
         * stop() call on the main queue is authoritative:
         * if there is no active recorder it will reject
         * with ERR_NO_RECORDING.
         */
        const result =
          await LectureRecorder.stop();


        const durationMillis =
          result.durationMillis;

        const sourceFile =
          new File(
            result.uri
          );

        const sourceBytes =
          sourceFile.size ??
          result.bytes ??
          0;


        if (__DEV__) {
          devConsole.log(
            'LECTURE FINAL RESULT',
            {
              ...result,
              sourceExists:
                sourceFile.exists,
              sourceBytes,
            }
          );
        }


        if (
          durationMillis <
          500
        ) {
          throw new Error(
            `Recording was too short (${durationMillis} ms).`
          );
        }


        if (
          !sourceFile.exists ||
          sourceBytes <
            4096
        ) {
          throw new Error(
            `The native recording file is invalid (${sourceBytes} bytes).`
          );
        }


        /*
         * The native module writes directly to this
         * lecture's persistent audio.m4a path. No cache
         * lookup and no second recording copy are needed.
         */
        if (
          sourceFile.uri !==
          active.audioFile.uri
        ) {
          throw new Error(
            'The native recorder returned an unexpected audio path.'
          );
        }


        const transcription =
          createChunkPlan(
            durationMillis
          );


        writeMetadata(
          active.directory,
          {
            id:
              active.id,

            createdAt:
              active.createdAt,

            durationMillis,

            language:
              'nb-NO',

            audioFile:
              'audio.m4a',

            transcriptFile:
              null,

            transcriptReady:
              false,

            characters:
              0,

            audioBytes:
              sourceBytes,

            source:
              'recorded',

            originalFileName:
              null,

            transcription,
          }
        );


        activeRecordingRef.current =
          null;

        recordingStartedAtRef.current =
          null;

        setRecorderState({
          isRecording: false,
          durationMillis,
          uri:
            sourceFile.uri,
          bytes:
            sourceBytes,
        });

        setLastSavedLectureId(
          active.id
        );

        setActiveRecordingMarkers(
          []
        );

        setStatus(
          'saved'
        );


        /*
         * Return expo-audio to playback-only mode.
         * Recording itself is managed by LectureRecorder.
         */
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          allowsBackgroundRecording: false,
          interruptionMode: 'doNotMix',
        });


        loadLectures();

      } catch (error) {

        devConsole.error(
          'Save native recording error:',
          error
        );


        try {

          await LectureRecorder.cancel();

        } catch {
          // Recorder may already have finished or been absent.
        }


        await resetRecordingState();


        Alert.alert(
          'Recording was not saved',
          error instanceof Error
            ? error.message
            : String(error)
        );

      } finally {

        recordingActionPendingRef.current =
          false;
      }
    };


  const handleImportAudio =
    async () => {

      if (
        recordingActionPendingRef.current ||
        status ===
          'recording'
      ) {
        return;
      }


      if (
        isLectureProcessing
      ) {

        Alert.alert(
          'Processing in progress',
          'Wait until transcription or translation finishes before importing another audio file.'
        );

        return;
      }


      try {

        const result =
          await DocumentPicker
            .getDocumentAsync({
              type:
                'audio/*',
              multiple:
                false,
              copyToCacheDirectory:
                true,
            });


        if (
          result.canceled
        ) {
          return;
        }


        const asset =
          result.assets[0];

        if (!asset) {
          throw new Error(
            'No audio file was selected.'
          );
        }


        const extension =
          getImportedAudioExtension(
            asset.name
          );


        if (!extension) {
          throw new Error(
            'Unsupported audio format. Use M4A, MP3, WAV, AAC, CAF or MP4.'
          );
        }


        const sourceFile =
          new File(
            asset.uri
          );

        const sourceBytes =
          sourceFile.size ??
          asset.size ??
          0;


        if (
          !sourceFile.exists ||
          sourceBytes <
            4096
        ) {
          throw new Error(
            'The selected audio file is missing or invalid.'
          );
        }


        const info =
          await LectureRecorder
            .getAudioInfo(
              sourceFile.uri
            );


        if (
          info.durationMillis <
          500
        ) {
          throw new Error(
            'The selected audio file has no usable duration.'
          );
        }


        const id =
          Date.now().toString();

        const createdAt =
          new Date().toISOString();

        const directory =
          getLectureDirectory(
            id
          );


        directory.create({
          intermediates: true,
          idempotent: true,
        });


        const audioFileName =
          `audio.${extension}`;

        const audioFile =
          new File(
            directory,
            audioFileName
          );


        await sourceFile.copy(
          audioFile
        );


        const savedBytes =
          audioFile.size ??
          0;


        if (
          !audioFile.exists ||
          savedBytes <
            4096
        ) {
          throw new Error(
            'The imported audio copy is invalid.'
          );
        }


        const transcription =
          createChunkPlan(
            info.durationMillis
          );


        writeMetadata(
          directory,
          {
            id,
            createdAt,

            durationMillis:
              info.durationMillis,

            language:
              'nb-NO',

            audioFile:
              audioFileName,

            transcriptFile:
              null,

            transcriptReady:
              false,

            characters:
              0,

            audioBytes:
              savedBytes,

            source:
              'imported',

            originalFileName:
              asset.name,

            transcription,
          }
        );


        setLastSavedLectureId(
          id
        );

        setStatus(
          'saved'
        );

        loadLectures();


        Alert.alert(
          'Audio imported',
          `${asset.name}\n${formatTime(info.durationMillis)}`
        );

      } catch (error) {

        devConsole.error(
          'Audio import error:',
          error
        );


        Alert.alert(
          'Import failed',
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    };


  const handlePlayLecture =
    async (
      lecture: LectureItem
    ) => {

      if (
        transcribingLectureId ||
        processingLockRef.current ===
          'transcription'
      ) {
        return;
      }

      try {

        setPlaybackError(
          null
        );


        const audioFile =
          new File(
            lecture.audioUri
          );


        if (!audioFile.exists) {

          Alert.alert(
            'Playback error',
            'The saved audio file does not exist.'
          );

          return;
        }


        const audioBytes =
          audioFile.size ??
          0;

        if (
          audioBytes < 4096
        ) {

          Alert.alert(
            'Playback error',
            `The saved audio file is empty or incomplete (${audioBytes} bytes).`
          );

          return;
        }


        const isCurrentLecture =
          playingLectureId ===
            lecture.id;

        const isCurrentLoaded =
          isCurrentLecture &&
          playerStatus.isLoaded &&
          playerStatus.duration >
            0;


        /*
         * For a NEW source, show Loading immediately.
         * setAudioModeAsync may take noticeable time on iOS,
         * and previously the first tap looked ignored while
         * this await was running.
         */
        if (
          !isCurrentLoaded
        ) {
          setLoadingLectureId(
            lecture.id
          );
        }


        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          allowsBackgroundRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });


        if (
          playingLectureId ===
            lecture.id &&
          playerStatus.playing
        ) {

          player.pause();
          return;
        }


        if (
          playingLectureId ===
            lecture.id &&
          playerStatus.isLoaded &&
          playerStatus.duration > 0
        ) {

          if (
            playerStatus.currentTime >=
              playerStatus.duration - 0.15
          ) {

            await player.seekTo(
              0
            );
          }

          player.play();
          return;
        }


        /*
         * New source:
         * never call play() after an arbitrary 80 ms.
         * Wait for AudioStatus to report a real duration.
         */

        clearPlaybackLoadTimers();

        player.pause();

        pendingPlaybackIdRef.current =
          lecture.id;

        pendingPlaybackUriRef.current =
          lecture.audioUri;

        setPlayingLectureId(
          lecture.id
        );


        player.replace({
          uri:
            lecture.audioUri,
        });


        /*
         * The previous implementation often worked
         * on the second manual tap. Reproduce that
         * safely as one automatic reload if iOS has
         * not resolved duration after 1.2 seconds.
         */
        playbackRetryTimerRef.current =
          setTimeout(
            () => {

              if (
                pendingPlaybackIdRef.current ===
                  lecture.id &&
                pendingPlaybackUriRef.current ===
                  lecture.audioUri
              ) {

                try {

                  player.pause();

                  player.replace({
                    uri:
                      lecture.audioUri,
                  });

                } catch (error) {

                  devConsole.error(
                    'Automatic playback reload error:',
                    error
                  );
                }
              }

            },
            1200
          );


        playbackFailTimerRef.current =
          setTimeout(
            () => {

              if (
                pendingPlaybackIdRef.current ===
                  lecture.id
              ) {

                pendingPlaybackIdRef.current =
                  null;

                pendingPlaybackUriRef.current =
                  null;

                setLoadingLectureId(
                  null
                );

                const kb =
                  Math.round(
                    audioBytes /
                    1024
                  );

                setPlaybackError(
                  `The M4A exists (${kb} KB), but iOS could not determine its duration.`
                );
              }

            },
            6000
          );

      } catch (error) {

        devConsole.error(
          'Could not play lecture:',
          error
        );

        clearPlaybackLoadTimers();

        pendingPlaybackIdRef.current =
          null;

        pendingPlaybackUriRef.current =
          null;

        setLoadingLectureId(
          null
        );

        setPlaybackError(
          error instanceof Error
            ? error.message
            : 'The recording could not be loaded.'
        );
      }
    };


  const handleSeekLectureTo =
    async (
      lecture: LectureItem,
      seconds: number,
      autoplay = true
    ) => {

      if (
        transcribingLectureId ||
        processingLockRef.current ===
          'transcription'
      ) {
        return;
      }

      const safeSeconds =
        Math.max(
          0,
          seconds
        );


      try {

        if (
          playingLectureId ===
            lecture.id &&
          playerStatus.isLoaded &&
          playerStatus.duration >
            0
        ) {

          await player.seekTo(
            Math.min(
              playerStatus.duration,
              safeSeconds
            )
          );

          if (autoplay) {
            player.play();
          }

          return;
        }


        pendingPlaybackSeekRef.current = {
          lectureId:
            lecture.id,
          seconds:
            safeSeconds,
          autoplay,
        };


        await handlePlayLecture(
          lecture
        );

      } catch (error) {

        devConsole.error(
          'Could not seek lecture to timestamp:',
          error
        );

        setPlaybackError(
          error instanceof Error
            ? error.message
            : 'Could not jump to this moment.'
        );
      }
    };


  const handleSeekRelative =
    async (
      deltaSeconds: number
    ) => {

      if (
        transcribingLectureId ||
        processingLockRef.current ===
          'transcription'
      ) {
        return;
      }

      try {

        if (
          !playerStatus.isLoaded ||
          playerStatus.duration <= 0
        ) {
          return;
        }

        const nextTime =
          Math.min(
            playerStatus.duration,
            Math.max(
              0,
              playerStatus.currentTime +
                deltaSeconds
            )
          );

        await player.seekTo(
          nextTime
        );

      } catch (error) {

        devConsole.error(
          'Playback seek error:',
          error
        );
      }
    };


  const handleSeekFraction =
    async (
      fraction: number
    ) => {

      if (
        transcribingLectureId ||
        processingLockRef.current ===
          'transcription'
      ) {
        return;
      }

      try {

        if (
          !playerStatus.isLoaded ||
          playerStatus.duration <= 0
        ) {
          return;
        }

        const safeFraction =
          Math.min(
            1,
            Math.max(
              0,
              fraction
            )
          );

        await player.seekTo(
          playerStatus.duration *
            safeFraction
        );

      } catch (error) {

        devConsole.error(
          'Playback seek error:',
          error
        );
      }
    };


  const handleOpenTranscript =
    (
      lecture: LectureItem
    ) => {

      if (
        openedLectureId ===
        lecture.id
      ) {

        setOpenedLectureId(
          null
        );

        setOpenedTranscript(
          ''
        );

        clearTranslationState();

        setOpenedTranscriptSegments(
          []
        );

        return;
      }

      if (
        !lecture.transcriptUri
      ) {
        return;
      }

      try {

        const transcriptFile =
          new File(
            lecture.transcriptUri
          );

        const text =
          transcriptFile
            .textSync()
            .trim();

        setOpenedLectureId(
          lecture.id
        );

        setOpenedTranscript(
          text
        );

        setOpenedTranscriptSegments(
          readTranscriptSegments(
            getLectureDirectory(
              lecture.id
            )
          )
        );

        loadSavedTranslation(
          lecture,
          translationTarget
        );

      } catch (error) {

        devConsole.error(
          'Transcript open error:',
          error
        );

        Alert.alert(
          'Transcript error',
          'The transcript could not be opened.'
        );
      }
    };




  const handleDeleteLecture =
    (
      lecture: LectureItem
    ) => {

      Alert.alert(
        'Delete lecture?',
        'This permanently deletes the audio recording and transcript from this iPhone.',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },

          {
            text:
              'Delete',
            style:
              'destructive',

            onPress:
              () => {

                try {

                  if (
                    playingLectureId ===
                    lecture.id
                  ) {

                    player.pause();

                    setPlayingLectureId(
                      null
                    );
                  }


                  const directory =
                    getLectureDirectory(
                      lecture.id
                    );


                  if (
                    directory.exists
                  ) {

                    directory.delete();
                  }


                  if (
                    openedLectureId ===
                    lecture.id
                  ) {

                    setOpenedLectureId(
                      null
                    );

                    setOpenedTranscript(
                      ''
                    );

                    setOpenedTranscriptSegments(
                      []
                    );
                  }


                  loadLectures();

                } catch (error) {

                  devConsole.error(
                    'Delete lecture error:',
                    error
                  );

                  Alert.alert(
                    'Delete error',
                    'The lecture could not be deleted.'
                  );
                }
              },
          },
        ]
      );
    };


  return (

    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >

      <Text
        style={[
          styles.title,
          {
            color:
              T.textPrimary,
            fontSize:
              22,
          },
        ]}
      >
        🎙 Lecture Capture
      </Text>


      <GlassSurface
        variant="card"
        dark={isDark}
        contentStyle={
          styles.card
        }
      >

        <Text
          style={[
            styles.language,
            {
              color:
                T.textSecondary,
              fontSize:
                F.base,
            },
          ]}
        >
          🇳🇴 Norwegian · nb-NO
        </Text>


        {status ===
          'idle' && (

          <Text
            style={[
              styles.info,
              {
                color:
                  T.textSecondary,
                fontSize:
                  F.base,
              },
            ]}
          >
            Record the complete lecture as one local M4A file with the native iPhone recorder.
            You can lock your iPhone while recording.
            You can also import an existing audio file and transcribe it locally with WhisperKit.
          </Text>
        )}


        {status ===
          'recording' && (

          <>

            <Text
              style={[
                styles.recordingLabel,
                {
                  color:
                    T.accent,
                  fontSize:
                    F.base,
                },
              ]}
            >
              ● RECORDING
            </Text>

            <Text
              style={[
                styles.timer,
                {
                  color:
                    T.textPrimary,
                },
              ]}
            >
              {formatTime(
                recorderState
                  .durationMillis
              )}
            </Text>

            <View
              style={
                styles.micMeterBox
              }
            >

              <View
                style={
                  styles.micMeterHeader
                }
              >

                <Text
                  style={[
                    styles.micMeterTitle,
                    {
                      color:
                        T.textSecondary,
                      fontSize:
                        F.base - 2,
                    },
                  ]}
                >
                  Microphone level
                </Text>

                <Text
                  style={[
                    styles.micMeterValue,
                    {
                      color:
                        micNoSignalWarning
                          ? '#D92D20'
                          : (
                            Number(
                              recorderState.levelDb ??
                              -160
                            ) <
                              -50
                              ? '#B7791F'
                              : '#2E8B57'
                          ),
                      fontSize:
                        F.base - 3,
                    },
                  ]}
                >
                  {Math.round(
                    Number(
                      recorderState.levelDb ??
                      -160
                    )
                  )} dB
                </Text>

              </View>


              <View
                style={
                  styles.micBars
                }
              >

                {Array.from({
                  length: 10,
                }).map(
                  (
                    _,
                    index
                  ) => {

                    const level =
                      normalizeMicDb(
                        recorderState.levelDb
                      );

                    const activeBars =
                      Math.ceil(
                        level *
                          10
                      );

                    const isActive =
                      index <
                        activeBars;

                    const barColor =
                      micNoSignalWarning
                        ? '#D92D20'
                        : (
                          Number(
                            recorderState.levelDb ??
                            -160
                          ) <
                            -50
                            ? '#D69E2E'
                            : '#38A169'
                        );


                    return (

                      <View
                        key={
                          index
                        }
                        style={[
                          styles.micBar,
                          {
                            opacity:
                              isActive
                                ? 1
                                : 0.16,
                            backgroundColor:
                              barColor,
                            height:
                              8 +
                              index *
                                2,
                          },
                        ]}
                      />
                    );
                  }
                )}

              </View>


              {micNoSignalWarning
                ? (

                  <Text
                    style={[
                      styles.micWarning,
                      {
                        color:
                          '#D92D20',
                        fontSize:
                          F.base - 2,
                      },
                    ]}
                  >
                    ⚠ Microphone is not receiving sound
                  </Text>

                )
                : (
                  Number(
                    recorderState.levelDb ??
                    -160
                  ) <
                    -50 && (

                    <Text
                      style={[
                        styles.micQuiet,
                        {
                          color:
                            '#B7791F',
                          fontSize:
                            F.base - 3,
                        },
                      ]}
                    >
                      Signal is quiet · move the iPhone closer if possible
                    </Text>
                  )
                )}

            </View>

            <Text
              style={[
                styles.backgroundInfo,
                {
                  color:
                    T.textSecondary,
                  fontSize:
                    F.base - 1,
                },
              ]}
            >
              Native recording continues while the iPhone is locked.
            </Text>

          </>
        )}


        {status ===
          'saved' && (

          <Text
            style={[
              styles.info,
              {
                color:
                  T.textSecondary,
                fontSize:
                  F.base,
              },
            ]}
          >
            ✓ Audio saved locally as M4A
            {lastSavedLectureId
              ? '\nReady for later transcription.'
              : ''}
          </Text>
        )}


        {status ===
          'recording' && (

          <View
            style={
              styles.recordingMarkersBox
            }
          >

            <Text
              style={[
                styles.recordingMarkersTitle,
                {
                  color:
                    T.textSecondary,
                  fontSize:
                    F.base - 1,
                },
              ]}
            >
              Mark this moment
            </Text>


            <View
              style={
                styles.markerTypeRow
              }
            >

              {(
                [
                  ['important', '⭐ Important'],
                  ['unclear', '❓ Unclear'],
                  ['repeat', '🔁 Repeat'],
                  ['term', '🆕 Term'],
                ] as const
              ).map(
                (
                  [type, label]
                ) => (

                  <Pressable
                    key={
                      type
                    }
                    onPress={() =>
                      setSelectedMarkerType(
                        type
                      )
                    }
                    style={[
                      styles.markerTypeButton,
                      {
                        borderColor:
                          T.accent,
                        backgroundColor:
                          selectedMarkerType ===
                            type
                            ? T.accent
                            : 'transparent',
                      },
                    ]}
                  >

                    <Text
                      style={[
                        styles.markerTypeText,
                        {
                          color:
                            selectedMarkerType ===
                              type
                              ? '#FFFFFF'
                              : T.accent,
                          fontSize:
                            F.base - 3,
                        },
                      ]}
                    >
                      {label}
                    </Text>

                  </Pressable>
                )
              )}

            </View>


            <Pressable
              onPress={() =>
                handleMarkMoment()
              }
              style={[
                styles.markMomentButton,
                {
                  borderColor:
                    T.accent,
                },
              ]}
            >

              <Text
                style={[
                  styles.markMomentText,
                  {
                    color:
                      T.accent,
                    fontSize:
                      F.base,
                  },
                ]}
              >
                ⭐ Mark moment · {formatTime(
                  recorderState.durationMillis
                )}
              </Text>

            </Pressable>


            {activeRecordingMarkers.length >
              0 && (

              <Text
                style={[
                  styles.markerSavedInfo,
                  {
                    color:
                      T.textSecondary,
                    fontSize:
                      F.base - 3,
                  },
                ]}
              >
                {activeRecordingMarkers.length}
                {' '}
                {activeRecordingMarkers.length ===
                  1
                  ? 'marker saved'
                  : 'markers saved'}
              </Text>
            )}

          </View>
        )}


        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            status === 'recording'
              ? 'Stop lecture recording'
              : 'Start lecture recording'
          }
          disabled={
            isLectureProcessing &&
            status !== 'recording'
          }
          onPress={
            status === 'recording'
              ? handleStop
              : handleStart
          }
          style={[
            styles.mainButton,
            {
              backgroundColor:
                status ===
                'recording'
                  ? '#C94B4B'
                  : T.accent,
              opacity:
                isLectureProcessing &&
                status !== 'recording'
                  ? 0.55
                  : 1,
            },
          ]}
        >

          <Text
            style={
              styles.mainButtonText
            }
          >
            {status === 'recording'
              ? 'Stop recording'
              : transcribingLectureId
                ? 'Transcription in progress'
                : translatingLectureId
                  ? 'Translation in progress'
                  : 'Start lecture'}
          </Text>

        </Pressable>


        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import audio file"
          disabled={
            status ===
              'recording' ||
            isLectureProcessing
          }
          onPress={
            handleImportAudio
          }
          style={[
            styles.importButton,
            {
              borderColor:
                T.accent,
              opacity:
                status ===
                  'recording' ||
                isLectureProcessing
                  ? 0.45
                  : 1,
            },
          ]}
        >

          <Text
            style={[
              styles.importButtonText,
              {
                color:
                  T.accent,
              },
            ]}
          >
            Import audio file
          </Text>

        </Pressable>


        <Text
          style={[
            styles.importHint,
            {
              color:
                T.textSecondary,
              fontSize:
                F.base - 2,
            },
          ]}
        >
          M4A, MP3, WAV, AAC, CAF or MP4
        </Text>

      </GlassSurface>


      <View
        style={
          styles.libraryHeader
        }
      >

        <Text
          style={[
            styles.libraryTitle,
            {
              color:
                T.textPrimary,
              fontSize:
                F.base + 4,
            },
          ]}
        >
          Saved lectures
        </Text>

        <Text
          style={[
            styles.libraryCount,
            {
              color:
                T.textSecondary,
              fontSize:
                F.base - 1,
            },
          ]}
        >
          {lectures.length}
        </Text>

      </View>


      {lectures.length === 0
        ? (

          <GlassSurface
            variant="card"
            dark={isDark}
            contentStyle={
              styles.emptyLibrary
            }
          >

            <Text
              style={[
                styles.emptyLibraryText,
                {
                  color:
                    T.textSecondary,
                  fontSize:
                    F.base,
                },
              ]}
            >
              Your saved recordings will appear here.
            </Text>

          </GlassSurface>

        )
        : (

          lectures.map(
            (lecture) => {

              const isCurrent =
                playingLectureId ===
                lecture.id;

              const isPlaying =
                isCurrent &&
                playerStatus.playing;

              const isLoading =
                loadingLectureId ===
                lecture.id;

              const isTranscriptOpen =
                openedLectureId ===
                lecture.id;

              const displayedDuration =
                isCurrent &&
                playerStatus.duration > 0
                  ? playerStatus.duration *
                    1000
                  : lecture.durationMillis;


              return (

                <GlassSurface
                  key={
                    lecture.id
                  }
                  variant="card"
                  dark={isDark}
                  contentStyle={
                    styles.lectureCard
                  }
                >

                  <View
                    style={
                      styles.lectureTopRow
                    }
                  >

                    <View
                      style={
                        styles.lectureInfo
                      }
                    >

                      <Text
                        style={[
                          styles.lectureDate,
                          {
                            color:
                              T.textPrimary,
                            fontSize:
                              F.base + 1,
                          },
                        ]}
                      >
                        {formatLectureDate(
                          lecture.createdAt
                        )}
                      </Text>


                      <Text
                        style={[
                          styles.lectureMeta,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        🇳🇴 {lecture.language}
                        {'  ·  '}
                        {displayedDuration > 0
                          ? formatTime(
                              displayedDuration
                            )
                          : 'Audio saved'}
                        {'  ·  '}
                        {lecture.audioFileName
                          .toUpperCase()
                          .endsWith(
                            '.M4A'
                          )
                          ? 'M4A'
                          : 'WAV'}
                      </Text>

                    </View>


                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete lecture"
                      onPress={() =>
                        handleDeleteLecture(
                          lecture
                        )
                      }
                      style={
                        styles.deleteButton
                      }
                      hitSlop={
                        10
                      }
                    >

                      <Text
                        style={[
                          styles.deleteButtonText,
                          {
                            color:
                              T.textSecondary,
                          },
                        ]}
                      >
                        🗑
                      </Text>

                    </Pressable>

                  </View>


                  {isCurrent && (

                    <View>

                      <Text
                        style={[
                          styles.playbackTime,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 1,
                          },
                        ]}
                      >
                        {isLoading ||
                        !playerStatus.isLoaded ||
                        playerStatus.duration <= 0
                          ? 'Loading audio…'
                          : (
                            `${formatPlaybackTime(
                              playerStatus.currentTime
                            )} / ${formatPlaybackTime(
                              playerStatus.duration
                            )}`
                          )}
                      </Text>


                      {!isLoading &&
                        playerStatus.isLoaded &&
                        playerStatus.duration >
                          0 && (

                        <>

                          <Pressable
                            disabled={
                              !!transcribingLectureId
                            }
                            onLayout={event => {
                              playbackSeekBarWidthRef.current =
                                event.nativeEvent.layout.width;
                            }}
                            onPress={event => {

                              const width =
                                playbackSeekBarWidthRef.current;

                              if (
                                width <= 0
                              ) {
                                return;
                              }

                              const fraction =
                                event.nativeEvent.locationX /
                                width;

                              void handleSeekFraction(
                                fraction
                              );
                            }}
                            style={[
                              styles.playbackSeekTrack,
                              {
                                backgroundColor:
                                  T.textSecondary +
                                  '33',
                                opacity:
                                  transcribingLectureId
                                    ? 0.45
                                    : 1,
                              },
                            ]}
                          >

                            <View
                              style={[
                                styles.playbackSeekFill,
                                {
                                  backgroundColor:
                                    T.accent,
                                  width:
                                    `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        (
                                          playerStatus.currentTime /
                                          playerStatus.duration
                                        ) *
                                          100
                                      )
                                    )}%`,
                                },
                              ]}
                            />

                          </Pressable>


                          <View
                            style={
                              styles.playbackSeekActions
                            }
                          >

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Go back 15 seconds"
                              disabled={
                                !!transcribingLectureId
                              }
                              onPress={() =>
                                void handleSeekRelative(
                                  -15
                                )
                              }
                              style={[
                                styles.playbackSeekButton,
                                {
                                  borderColor:
                                    T.accent,
                                  opacity:
                                    transcribingLectureId
                                      ? 0.45
                                      : 1,
                                },
                              ]}
                            >

                              <Text
                                style={[
                                  styles.playbackSeekButtonText,
                                  {
                                    color:
                                      T.accent,
                                    fontSize:
                                      F.base - 2,
                                  },
                                ]}
                              >
                                ↶ 15 sec
                              </Text>

                            </Pressable>


                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Go forward 15 seconds"
                              disabled={
                                !!transcribingLectureId
                              }
                              onPress={() =>
                                void handleSeekRelative(
                                  15
                                )
                              }
                              style={[
                                styles.playbackSeekButton,
                                {
                                  borderColor:
                                    T.accent,
                                  opacity:
                                    transcribingLectureId
                                      ? 0.45
                                      : 1,
                                },
                              ]}
                            >

                              <Text
                                style={[
                                  styles.playbackSeekButtonText,
                                  {
                                    color:
                                      T.accent,
                                    fontSize:
                                      F.base - 2,
                                  },
                                ]}
                              >
                                15 sec ↷
                              </Text>

                            </Pressable>

                          </View>

                        </>
                      )}

                    </View>
                  )}


                  <MarkerList
                    markers={
                      lecture.markers
                    }
                    accent={
                      T.accent
                    }
                    textSecondary={
                      T.textSecondary
                    }
                    fontBase={
                      F.base
                    }
                    onSeek={
                      milliseconds =>
                        void handleSeekLectureTo(
                          lecture,
                          milliseconds /
                            1000,
                          true
                        )
                    }
                  />


                  <View
                    style={
                      styles.lectureActions
                    }
                  >

                    <AudioActionButton
                      half
                      accent={
                        T.accent
                      }
                      fontSize={
                        F.base - 1
                      }
                      disabled={
                        isLoading ||
                        !!transcribingLectureId
                      }
                      accessibilityLabel={
                        isPlaying
                          ? 'Pause lecture'
                          : 'Play lecture'
                      }
                      label={
                        isLoading
                          ? '… Loading'
                          : isPlaying
                            ? '⏸ Pause'
                            : '▶ Play'
                      }
                      onPress={() => {
                        void Haptics
                          .selectionAsync();

                        void handlePlayLecture(
                          lecture
                        );
                      }}
                    />

                    <AudioActionButton
                      half
                      accent={
                        T.accent
                      }
                      fontSize={
                        F.base - 1
                      }
                      disabled={
                        isLectureProcessing
                      }
                      accessibilityLabel={
                        lecture.transcriptReady
                          ? (
                            isTranscriptOpen
                              ? 'Hide lecture transcript'
                              : 'Open lecture transcript'
                          )
                          : 'Create lecture transcript'
                      }
                      label={
                        lecture.transcriptReady
                          ? (
                            isTranscriptOpen
                              ? '📄 Hide text'
                              : '📄 Transcript'
                          )
                          : (
                            transcribingLectureId ===
                              lecture.id
                              ? '… Transcribing'
                              : 'Create transcript'
                          )
                      }
                      onPress={() => {
                        void Haptics
                          .selectionAsync();

                        if (
                          lecture.transcriptReady
                        ) {
                          handleOpenTranscript(
                            lecture
                          );
                        } else {
                          void handleCreateTranscript(
                            lecture
                          );
                        }
                      }}
                    />

                    <AudioActionButton
                      accent={
                        T.accent
                      }
                      fontSize={
                        F.base - 1
                      }
                      disabled={
                        exportingLectureId ===
                          lecture.id
                      }
                      accessibilityLabel={
                        exportLectureId ===
                          lecture.id
                          ? 'Close lecture export menu'
                          : 'Share or export lecture'
                      }
                      label={
                        exportingLectureId ===
                          lecture.id
                          ? '… Exporting'
                          : exportLectureId ===
                              lecture.id
                            ? '✕ Export'
                            : '↗ Share / Export'
                      }
                      onPress={() => {
                        void Haptics
                          .selectionAsync();

                        setExportLectureId(
                          current =>
                            current ===
                              lecture.id
                              ? null
                              : lecture.id
                        );
                      }}
                    />

                  </View>

                  {exportLectureId ===
                    lecture.id && (

                    <ExportMenu
                      accent={
                        T.accent
                      }
                      textSecondary={
                        T.textSecondary
                      }
                      fontBase={
                        F.base
                      }
                      disabled={
                        exportingLectureId ===
                          lecture.id
                      }
                      onExport={
                        kind =>
                          void handleExportLecture(
                            lecture,
                            kind
                          )
                      }
                    />
                  )}


                  {isCurrent &&
                    !!playbackError && (

                    <Text
                      style={[
                        styles.errorText,
                        {
                          color:
                            T.textSecondary,
                          fontSize:
                            F.base - 2,
                        },
                      ]}
                    >
                      Playback: {playbackError}
                    </Text>
                  )}


                  {!lecture.transcriptReady && (

                    <View
                      style={
                        styles.transcriptionBox
                      }
                    >

                      <Text
                        style={[
                          styles.transcriptionStatus,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        {transcribingLectureId === lecture.id
                          ? (
                            whisperStage === 'preparing-model'
                              ? 'Preparing offline Whisper model…'
                              : whisperStage === 'model-ready'
                                ? 'Model ready'
                                : whisperStage === 'retrying'
                                  ? 'No text detected · retrying once…'
                                  : 'Transcribing locally on this iPhone…'
                          )
                          : lecture.transcription.status ===
                              'not_started'
                            ? 'Transcript not started · WhisperKit offline'
                            : lecture.transcription.status ===
                                'pending'
                              ? 'Ready for local transcription'
                              : lecture.transcription.status ===
                                  'processing'
                                ? 'Transcription interrupted · tap Create transcript to retry'
                                : lecture.transcription.status ===
                                    'done'
                                  ? 'Transcript ready'
                                  : lecture.transcription.status ===
                                      'error'
                                    ? 'Transcription error · tap Create transcript to retry'
                                    : lecture.transcription.status}
                      </Text>

                      <Text
                        style={[
                          styles.chunkText,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        WhisperKit · on-device · Norwegian
                      </Text>

                    </View>
                  )}


                  {transcribingLectureId ===
                    lecture.id && (

                    <View
                      style={[
                        styles.savedTranscriptBox,
                        {
                          borderColor:
                            T.textSecondary,
                        },
                      ]}
                    >

                      <Text
                        style={[
                          styles.transcriptionStatus,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        {retranscribingLectureId ===
                          lecture.id
                          ? (
                            whisperStage ===
                              'preparing-model'
                              ? 'Re-transcribing… preparing the offline Whisper model. The existing transcript will stay visible until the new version is ready.'
                              : whisperStage ===
                                  'retrying'
                                ? 'Re-transcribing… no text detected on the first pass, retrying once.'
                                : 'Re-transcribing locally on this iPhone… The existing transcript will stay visible until the replacement is complete.'
                          )
                          : (
                            whisperStage ===
                              'preparing-model'
                              ? 'First use may download the Whisper model. Keep the app open and connected to the internet.'
                              : 'Processing locally. Long lectures may take several minutes.'
                          )}
                      </Text>

                      {retranscribingLectureId !==
                        lecture.id &&
                        !!liveTranscript && (

                        <Text
                          selectable
                          style={[
                            styles.savedTranscriptText,
                            {
                              color:
                                T.textSecondary,
                              fontSize:
                                F.base,
                              marginTop:
                                10,
                            },
                          ]}
                        >
                          {liveTranscript}
                        </Text>
                      )}

                    </View>
                  )}


                  {transcribingLectureId ===
                    null &&
                    lecture.transcription.status ===
                      'error' &&
                    !!transcriptionError && (

                    <Text
                      style={[
                        styles.errorText,
                        {
                          color:
                            T.textSecondary,
                          fontSize:
                            F.base - 2,
                        },
                      ]}
                    >
                      {transcriptionError}
                    </Text>
                  )}


                  {isTranscriptOpen &&
                    !!openedTranscript && (

                    <View
                      style={[
                        styles.savedTranscriptBox,
                        {
                          borderColor:
                            T.textSecondary,
                        },
                      ]}
                    >

                      {transcriptUpdatedFlashLectureId ===
                        lecture.id ? (

                        <Text
                          accessibilityRole="text"
                          style={[
                            styles.transcriptionStatus,
                            {
                              color:
                                T.accent,
                              fontSize:
                                F.base - 1,
                              fontWeight:
                                '800',
                              marginBottom:
                                10,
                            },
                          ]}
                        >
                          ✓ Transcript updated
                        </Text>

                      ) : transcriptUpdatedLectureId ===
                          lecture.id ? (

                        <Text
                          accessibilityRole="text"
                          style={[
                            styles.transcriptionStatus,
                            {
                              color:
                                T.textSecondary,
                              fontSize:
                                F.base - 2,
                              marginBottom:
                                10,
                            },
                          ]}
                        >
                          Updated just now
                        </Text>

                      ) : null}


                      <TranscriptView
                        segments={
                          openedTranscriptSegments
                        }
                        fallbackText={
                          openedTranscript
                        }
                        isCurrent={
                          isCurrent
                        }
                        isLoaded={
                          playerStatus.isLoaded
                        }
                        currentTime={
                          playerStatus.currentTime
                        }
                        accent={
                          T.accent
                        }
                        textSecondary={
                          T.textSecondary
                        }
                        fontBase={
                          F.base
                        }
                        onSeek={
                          seconds =>
                            void handleSeekLectureTo(
                              lecture,
                              seconds,
                              true
                            )
                        }
                      />


                      <View
                        style={
                          styles.retranscribeRow
                        }
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Re-transcribe lecture"
                          disabled={
                            isLectureProcessing
                          }
                          onPress={() =>
                            confirmRetranscribe(
                              lecture,
                              async () => {
                                setTranscriptUpdatedLectureId(
                                  null
                                );

                                setTranscriptUpdatedFlashLectureId(
                                  null
                                );

                                if (
                                  transcriptUpdatedFlashTimerRef.current
                                ) {
                                  clearTimeout(
                                    transcriptUpdatedFlashTimerRef.current
                                  );
                                }

                                if (
                                  transcriptUpdatedStatusTimerRef.current
                                ) {
                                  clearTimeout(
                                    transcriptUpdatedStatusTimerRef.current
                                  );
                                }

                                clearPlaybackLoadTimers();

                                pendingPlaybackIdRef.current =
                                  null;

                                pendingPlaybackUriRef.current =
                                  null;

                                pendingPlaybackSeekRef.current =
                                  null;

                                setLoadingLectureId(
                                  null
                                );

                                if (
                                  playerStatus.playing
                                ) {
                                  player.pause();
                                }
                              }
                            )
                          }
                          style={[
                            styles.retranscribeButton,
                            {
                              borderColor:
                                T.accent,
                              opacity:
                                isLectureProcessing
                                  ? 0.45
                                  : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.retranscribeText,
                              {
                                color:
                                  T.accent,
                                fontSize:
                                  F.base - 2,
                              },
                            ]}
                          >
                            ↻ Re-transcribe
                          </Text>
                        </Pressable>
                      </View>

                      <TranslationPanel
                        target={
                          translationTarget
                        }
                        translating={
                          translatingLectureId ===
                            lecture.id
                        }
                        processing={
                          isLectureProcessing
                        }
                        translatedText={
                          openedTranslation
                        }
                        error={
                          translationError
                        }
                        accent={
                          T.accent
                        }
                        textSecondary={
                          T.textSecondary
                        }
                        fontBase={
                          F.base
                        }
                        onTarget={
                          target =>
                            handleSelectTranslationTarget(
                              lecture,
                              target
                            )
                        }
                        onTranslate={
                          () =>
                            void handleTranslateTranscript(
                              lecture
                            )
                        }
                      />

                    </View>
                  )}

                </GlassSurface>
              );
            }
          )
        )}

    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex: 1,
      backgroundColor:
        'transparent',
    },

    content: {
      paddingTop: 70,
      paddingHorizontal: 20,
      /*
       * The app uses a floating bottom tab bar. Extra room
       * lets the final Export/translation controls scroll
       * fully above it instead of sitting underneath it.
       */
      paddingBottom: 210,
    },

    title: {
      fontWeight: '900',
      marginBottom: 20,
    },

    card: {
      padding: 20,
    },

    language: {
      fontWeight: '700',
      marginBottom: 18,
    },

    info: {
      lineHeight: 25,
      fontWeight: '600',
      marginBottom: 20,
    },

    recordingLabel: {
      textAlign: 'center',
      fontWeight: '900',
      marginTop: 8,
    },

    timer: {
      textAlign: 'center',
      fontSize: 42,
      fontWeight: '900',
      marginTop: 10,
      marginBottom: 10,
    },

    backgroundInfo: {
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 22,
      fontWeight: '600',
    },

    micMeterBox: {
      marginTop: 14,
      marginBottom: 4,
      padding: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(128,128,128,0.35)',
    },

    micMeterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },

    micMeterTitle: {
      fontWeight: '900',
    },

    micMeterValue: {
      fontWeight: '900',
    },

    micBars: {
      minHeight: 30,
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },

    micBar: {
      flex: 1,
      minWidth: 5,
      borderRadius: 4,
    },

    micWarning: {
      marginTop: 8,
      fontWeight: '900',
    },

    micQuiet: {
      marginTop: 8,
      fontWeight: '700',
    },

    recordingMarkersBox: {
      marginBottom: 14,
      padding: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(128,128,128,0.35)',
    },

    recordingMarkersTitle: {
      fontWeight: '900',
      marginBottom: 10,
    },

    markerTypeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 10,
    },

    markerTypeButton: {
      borderWidth: 1,
      borderRadius: 999,
      minHeight: 32,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    markerTypeText: {
      fontWeight: '800',
    },

    markMomentButton: {
      minHeight: 44,
      borderWidth: 1.5,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },

    markMomentText: {
      fontWeight: '900',
      textAlign: 'center',
    },

    markerSavedInfo: {
      marginTop: 7,
      fontWeight: '700',
      textAlign: 'center',
    },

    mainButton: {
      paddingVertical: 17,
      paddingHorizontal: 20,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },

    mainButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    importButton: {
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },

    importButtonText: {
      fontSize: 16,
      fontWeight: '800',
    },

    importHint: {
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 18,
      fontWeight: '500',
    },

    libraryHeader: {
      marginTop: 28,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    libraryTitle: {
      fontWeight: '900',
    },

    libraryCount: {
      fontWeight: '800',
    },

    emptyLibrary: {
      padding: 18,
    },

    emptyLibraryText: {
      lineHeight: 22,
      fontWeight: '600',
    },

    lectureCard: {
      padding: 16,
      marginBottom: 12,
    },

    lectureTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },

    lectureInfo: {
      flex: 1,
    },

    lectureDate: {
      fontWeight: '900',
      marginBottom: 5,
    },

    lectureMeta: {
      fontWeight: '700',
      lineHeight: 19,
    },

    deleteButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },

    deleteButtonText: {
      fontSize: 18,
    },

    playbackTime: {
      marginTop: 12,
      fontWeight: '700',
    },

    playbackSeekTrack: {
      height: 14,
      borderRadius: 999,
      overflow: 'hidden',
      marginTop: 10,
      justifyContent: 'center',
    },

    playbackSeekFill: {
      height: '100%',
      borderRadius: 999,
    },

    playbackSeekActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },

    playbackSeekButton: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },

    playbackSeekButtonText: {
      fontWeight: '800',
      textAlign: 'center',
    },










    lectureActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
    },





    transcriptionBox: {
      marginTop: 12,
    },

    transcriptionStatus: {
      fontWeight: '700',
      lineHeight: 19,
    },

    chunkText: {
      marginTop: 3,
      fontWeight: '600',
      lineHeight: 18,
    },

    errorText: {
      marginTop: 10,
      lineHeight: 19,
      fontWeight: '600',
    },

    savedTranscriptBox: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
    },





    savedTranscriptText: {
      lineHeight: 24,
      fontWeight: '500',
    },













    retranscribeRow: {
      marginTop: 14,
      alignItems: 'flex-start',
    },

    retranscribeButton: {
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },

    retranscribeText: {
      fontWeight: '800',
    },
  });

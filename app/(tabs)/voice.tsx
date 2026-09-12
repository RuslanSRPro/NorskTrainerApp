// app/(tabs)/voice.tsx

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
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

import {
  getAudioSourceLanguageLabel,
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';

import type {
  ActiveRecording,
  LectureItem,
  LectureMarker,
  LectureMarkerType,
  LectureMetadata,
  LectureSourceLanguage,
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
  getLectureLanguageUi,
  normalizeLectureLanguage,
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
  useLectureRecorder,
} from '@/hooks/audio/useLectureRecorder';

import {
  useLecturePlayback,
} from '@/hooks/audio/useLecturePlayback';

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

import {
  LiveLectureButton,
} from '@/components/audio/LiveLectureButton';


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


type LectureTextTab =
  | 'source'
  | 'uk'
  | 'ru';


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


  const {
    app_language,
    loadSettings,
  } = useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const formatAudioLectureDate =
    (
      value: string | null
    ) => {
      if (!value) {
        return audioUi.savedRecording;
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return audioUi.savedRecording;
      }

      return formatLectureDate(
        value
      );
    };

  useEffect(() => {
    void loadSettings();
  }, []);


  const activeRecordingRef =
    useRef<ActiveRecording | null>(
      null
    );


  const [status, setStatus] =
    useState<
      'idle' |
      'recording' |
      'saved'
    >('idle');


  const {
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
  } =
    useLectureRecorder({
      pollingActive:
        status ===
          'recording',
    });


  const [lectures, setLectures] =
    useState<LectureItem[]>([]);

  const [
    openedLectureId,
    setOpenedLectureId,
  ] =
    useState<string | null>(null);

  const [
    selectedSourceLanguage,
    setSelectedSourceLanguage,
  ] =
    useState<LectureSourceLanguage>(
      'nb-NO'
    );


  const [
    liveBusy,
    setLiveBusy,
  ] =
    useState(false);

  const [
    openedTranscript,
    setOpenedTranscript,
  ] =
    useState('');

  const [
    openedTextTab,
    setOpenedTextTab,
  ] =
    useState<LectureTextTab>(
      'source'
    );

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
            normalizeLectureLanguage(
              metadata.language
            ),

          title:
            typeof metadata.title ===
              'string' &&
            metadata.title.trim()
              ? metadata.title.trim()
              : null,

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

          recordingState:
            metadata.recordingState ??
            'ready',

          interruptionReason:
            metadata.interruptionReason ??
            null,

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
      openedTranscriptSegments,
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

          setOpenedTextTab(
            'source'
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
    openedTranslationSegments,
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
    playerStatus,
    playingLectureId,
    loadingLectureId,
    playbackError,
    playbackSeekBarWidthRef,
    beginRecordingTransition,
    finishRecordingTransition,
    pauseForRetranscription,
    pauseIfLecturePlaying,
    handlePlayLecture,
    handleSeekLectureTo,
    handleSeekRelative,
    handleSeekFraction,
  } =
    useLecturePlayback({
      isPlaybackBlocked:
        () =>
          !!(
            liveBusy ||
            transcribingLectureId ||
            processingLockRef.current ===
              'transcription'
          ),
    });


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
    void (
      async () => {
        await recoverInterruptedRecordings();
        loadLectures();
      }
    )();
  }, []);

  const resetRecordingState =
    async () => {

      activeRecordingRef.current =
        null;

      resetRecorderState();

      setActiveRecordingMarkers(
        []
      );

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
        recordingActionPendingRef.current ||
        liveBusy
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
            audioUi.processingInProgress,
            audioUi.waitForProcessing
          );

          return;
        }


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
        beginRecordingTransition();


        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              350
            )
        );


        finishRecordingTransition();

        const permission =
          await requestRecordingPermissionsAsync();


        if (!permission.granted) {

          Alert.alert(
            audioUi.microphonePermission,
            audioUi.microphoneRequired
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
         * Native recorder lifecycle, event-first verification,
         * the proven 450 ms fallback and one 500 ms retry are
         * isolated in useLectureRecorder without behavior changes.
         */
        const verifiedAttempt =
          await startRecording(
            audioFile.uri
          );


        const {
          verified:
            verifiedStart,
        } =
          verifiedAttempt;


        activeRecordingRef.current = {
          id,
          createdAt,
          language:
            selectedSourceLanguage,
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

        writeMetadata(
          directory,
          {
            id,
            createdAt,
            durationMillis:
              0,
            language:
              selectedSourceLanguage,
            audioFile:
              'audio.m4a',
            transcriptFile:
              null,
            transcriptReady:
              false,
            characters:
              0,
            audioBytes:
              verifiedStart.bytes,
            source:
              'recorded',
            originalFileName:
              null,
            recordingState:
              'recording',
            interruptionReason:
              null,
            transcription:
              getDefaultTranscription(
                0
              ),
          }
        );


        commitStartedRecording(
          verifiedAttempt
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
          await cancelRecording();
        } catch {
          // Ignore secondary cleanup errors.
        }


        await resetRecordingState();


        Alert.alert(
          audioUi.recordingError,
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

      const timeMillis =
        getRecordingElapsedMillis();

      if (
        status !== 'recording' ||
        !active ||
        timeMillis ===
          null
      ) {
        return;
      }


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
            audioUi.activeRecordingMissing
          );
        }


        const beforeStop =
          getRecorderStatus();


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
          await stopRecording();


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
            `${audioUi.recordingTooShort} (${durationMillis} ms).`
          );
        }


        if (
          !sourceFile.exists ||
          sourceBytes <
            4096
        ) {
          throw new Error(
            `${audioUi.nativeRecordingInvalid} (${sourceBytes} bytes).`
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
            audioUi.unexpectedAudioPath
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
              active.language,

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

            recordingState:
              'ready',

            interruptionReason:
              null,

            transcription,
          }
        );


        activeRecordingRef.current =
          null;

        completeRecording(
          durationMillis,
          sourceFile.uri,
          sourceBytes
        );

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

          await cancelRecording();

        } catch {
          // Recorder may already have finished or been absent.
        }


        await resetRecordingState();


        Alert.alert(
          audioUi.recordingNotSaved,
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
          audioUi.processingInProgress,
          audioUi.waitForProcessingBeforeImport
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
            audioUi.noAudioSelected
          );
        }


        const extension =
          getImportedAudioExtension(
            asset.name
          );


        if (!extension) {
          throw new Error(
            audioUi.unsupportedAudioFormat
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
            audioUi.selectedAudioInvalid
          );
        }


        const info =
          await getAudioInfo(
            sourceFile.uri
          );


        if (
          info.durationMillis <
          500
        ) {
          throw new Error(
            audioUi.selectedAudioNoDuration
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
            audioUi.importedAudioInvalid
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
              selectedSourceLanguage,

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

            recordingState:
              'ready',

            interruptionReason:
              null,

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
          audioUi.audioImported,
          `${asset.name}\n${formatTime(info.durationMillis)}`
        );

      } catch (error) {

        devConsole.error(
          'Audio import error:',
          error
        );


        Alert.alert(
          audioUi.importFailed,
          error instanceof Error
            ? error.message
            : String(error)
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

        setOpenedTextTab(
          'source'
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

        setOpenedTextTab(
          'source'
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
          audioUi.transcriptError,
          audioUi.transcriptOpenFailed
        );
      }
    };


  const handleSelectTextTab =
    (
      lecture: LectureItem,
      tab: LectureTextTab
    ) => {

      if (isLectureProcessing) {
        return;
      }

      setOpenedTextTab(
        tab
      );

      if (
        tab === 'uk' ||
        tab === 'ru'
      ) {
        handleSelectTranslationTarget(
          lecture,
          tab
        );
      }
    };



  const handleRenameLecture =
    (
      lecture:
        LectureItem
    ) => {

      Alert.prompt(
        audioUi.renameLecture,
        audioUi.renamePrompt,
        [
          {
            text:
              audioUi.cancel,
            style:
              'cancel',
          },
          {
            text:
              audioUi.save,
            onPress:
              (value: string | undefined) => {
                try {
                  const directory =
                    getLectureDirectory(
                      lecture.id
                    );

                  const metadata =
                    readMetadata(
                      directory
                    );

                  const title =
                    String(
                      value || ''
                    )
                      .trim()
                      .slice(
                        0,
                        120
                      );

                  writeMetadata(
                    directory,
                    {
                      ...metadata,
                      title:
                        title ||
                        null,
                    }
                  );

                  loadLectures();

                } catch (error) {
                  devConsole.error(
                    'Rename lecture error:',
                    error
                  );

                  Alert.alert(
                    audioUi.renameError,
                    audioUi.renameSaveFailed
                  );
                }
              },
          },
        ],
        'plain-text',
        lecture.title ??
          ''
      );
    };


  const handleDeleteLecture =
    (
      lecture: LectureItem
    ) => {

      Alert.alert(
        audioUi.deleteLecture,
        audioUi.deletePrompt,
        [
          {
            text:
              audioUi.cancel,
            style:
              'cancel',
          },

          {
            text:
              audioUi.delete,
            style:
              'destructive',

            onPress:
              () => {

                try {

                  pauseIfLecturePlaying(
                    lecture.id
                  );


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
                    audioUi.deleteError,
                    audioUi.deleteFailed
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
        {audioUi.captureTitle}
      </Text>


      <GlassSurface
        variant="card"
        dark={isDark}
        contentStyle={
          styles.card
        }
      >

        <View
          style={
            styles.sourceLanguageRow
          }
        >
          {(
            [
              ['nb-NO', '🇳🇴 NO'],
              ['en', '🇬🇧 EN'],
            ] as const
          ).map(
            ([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={
                  value === 'nb-NO'
                    ? audioUi.useNorwegian
                    : audioUi.useEnglish
                }
                disabled={
                  status ===
                    'recording' ||
                  isLectureProcessing ||
                  liveBusy
                }
                onPress={() =>
                  setSelectedSourceLanguage(
                    value
                  )
                }
                style={[
                  styles.sourceLanguageButton,
                  {
                    borderColor:
                      T.accent,
                    backgroundColor:
                      selectedSourceLanguage ===
                        value
                        ? T.accent
                        : 'transparent',
                    opacity:
                      status ===
                        'recording' ||
                      isLectureProcessing ||
                      liveBusy
                        ? 0.45
                        : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sourceLanguageText,
                    {
                      color:
                        selectedSourceLanguage ===
                          value
                          ? '#FFFFFF'
                          : T.accent,
                      fontSize:
                        F.base - 2,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </View>


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
            {audioUi.idleInfo}
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
                    recorderState
                      .isPausedForInterruption
                      ? '#B7791F'
                      : T.accent,
                  fontSize:
                    F.base,
                },
              ]}
            >
              {recorderState
                .isPausedForInterruption
                ? audioUi.pausedForCall
                : audioUi.recording}
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

            {recorderState
              .isPausedForInterruption && (

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
                {audioUi.callPauseInfo}
              </Text>
            )}

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
                  {audioUi.microphoneLevel}
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
                    {audioUi.microphoneNoSound}
                  </Text>

                )
                : (
                  !recorderState
                    .isPausedForInterruption &&
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
                      {audioUi.microphoneQuiet}
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
              {audioUi.lockRecordingInfo}
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
            {audioUi.audioSaved}
            {lastSavedLectureId
              ? `\n${audioUi.readyForLaterTranscription}`
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
              {audioUi.markThisMoment}
            </Text>


            <View
              style={
                styles.markerTypeRow
              }
            >

              {(
                [
                  ['important', audioUi.markerImportant],
                  ['unclear', audioUi.markerUnclear],
                  ['repeat', audioUi.markerRepeat],
                  ['term', audioUi.markerTerm],
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
                {audioUi.markMoment} · {formatTime(
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
                {audioUi.markersSaved} {activeRecordingMarkers.length}
              </Text>
            )}

          </View>
        )}


        <View
          style={
            styles.recordingActionRow
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              status === 'recording'
                ? audioUi.stopRecording
                : audioUi.startRecording
            }
            disabled={
              (
                isLectureProcessing ||
                liveBusy
              ) &&
              status !== 'recording'
            }
            onPress={
              status === 'recording'
                ? handleStop
                : handleStart
            }
            style={[
              styles.mainButton,
              styles.recordingMainButton,
              {
                backgroundColor:
                  status ===
                  'recording'
                    ? '#C94B4B'
                    : T.accent,
                opacity:
                  (
                    isLectureProcessing ||
                    liveBusy
                  ) &&
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
                ? audioUi.stopRecording
                : transcribingLectureId ||
                    translatingLectureId
                  ? audioUi.processing
                  : audioUi.startRecording}
            </Text>
          </Pressable>

          <LiveLectureButton
            sourceLanguage={
              selectedSourceLanguage
            }
            translationTarget={
              translationTarget
            }
            disabled={
              status === 'recording' ||
              isLectureProcessing
            }
            beforeStart={
              async () => {
                beginRecordingTransition();

                await new Promise(
                  resolve =>
                    setTimeout(
                      resolve,
                      350
                    )
                );

                finishRecordingTransition();
              }
            }
            loadLectures={
              loadLectures
            }
            onBusyChange={
              setLiveBusy
            }
            onSaved={
              lectureId => {
                setLastSavedLectureId(
                  lectureId
                );
              }
            }
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={audioUi.importAudio}
          disabled={
            status ===
              'recording' ||
            isLectureProcessing ||
            liveBusy
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
                isLectureProcessing ||
                liveBusy
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
            {audioUi.importAudio}
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
          {audioUi.supportedFormats}
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
          {audioUi.savedLectures}
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
              {audioUi.emptyLibrary}
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

              const isInterrupted =
                lecture.recordingState ===
                  'interrupted';

              const displayedDuration =
                isCurrent &&
                playerStatus.duration > 0
                  ? playerStatus.duration *
                    1000
                  : lecture.durationMillis;

              const lectureLanguageUi =
                getLectureLanguageUi(
                  lecture.language
                );


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
                        numberOfLines={2}
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
                        {lecture.title ||
                          formatAudioLectureDate(
                            lecture.createdAt
                          )}
                      </Text>

                      {!!lecture.title && (
                        <Text
                          style={[
                            styles.lectureSubDate,
                            {
                              color:
                                T.textSecondary,
                              fontSize:
                                F.base - 3,
                            },
                          ]}
                        >
                          {formatAudioLectureDate(
                            lecture.createdAt
                          )}
                        </Text>
                      )}


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
                        {isInterrupted
                          ? (
                            <>
                              {lectureLanguageUi.flag} {lectureLanguageUi.code}
                              {'  ·  '}
                              {audioUi.interrupted}
                            </>
                          )
                          : (
                            <>
                              {lectureLanguageUi.flag} {lectureLanguageUi.code}
                              {'  ·  '}
                              {displayedDuration > 0
                                ? formatTime(
                                    displayedDuration
                                  )
                                : audioUi.audioSavedShort}
                              {'  ·  '}
                              {lecture.audioFileName
                                .toUpperCase()
                                .endsWith(
                                  '.M4A'
                                )
                                ? 'M4A'
                                : 'WAV'}
                            </>
                          )}
                      </Text>

                    </View>


                    <View
                      style={
                        styles.lectureHeaderActions
                      }
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={audioUi.renameAccessibility}
                        onPress={() =>
                          handleRenameLecture(
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
                          ✎
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={audioUi.deleteAccessibility}
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
                          ? audioUi.loadingAudio
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
                              accessibilityLabel={audioUi.back15}
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
                                {audioUi.back15Short}
                              </Text>

                            </Pressable>


                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={audioUi.forward15}
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
                                {audioUi.forward15Short}
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
                        isInterrupted ||
                        isLoading ||
                        !!transcribingLectureId
                      }
                      accessibilityLabel={
                        isInterrupted
                          ? audioUi.cannotPlayInterrupted
                          : isPlaying
                            ? audioUi.pauseLecture
                            : audioUi.playLecture
                      }
                      label={
                        isInterrupted
                          ? audioUi.noPlayback
                          : isLoading
                            ? audioUi.loading
                            : isPlaying
                              ? audioUi.pause
                              : audioUi.play
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
                        isLectureProcessing ||
                        (
                          isInterrupted &&
                          !lecture.transcriptReady
                        )
                      }
                      accessibilityLabel={
                        isInterrupted &&
                        !lecture.transcriptReady
                          ? audioUi.cannotTranscribeInterrupted
                          : lecture.transcriptReady
                          ? (
                            isTranscriptOpen
                              ? audioUi.hideTranscript
                              : audioUi.openTranscript
                          )
                          : audioUi.createTranscriptAccessibility
                      }
                      label={
                        isInterrupted &&
                        !lecture.transcriptReady
                          ? audioUi.noTranscript
                          : lecture.transcriptReady
                            ? (
                              isTranscriptOpen
                              ? audioUi.hideText
                              : audioUi.transcript
                            )
                            : (
                              transcribingLectureId ===
                                lecture.id
                                ? audioUi.transcribing
                                : audioUi.createTranscript
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
                          ? audioUi.closeExportMenu
                          : audioUi.shareOrExport
                      }
                      label={
                        exportingLectureId ===
                          lecture.id
                          ? audioUi.exporting
                          : exportLectureId ===
                              lecture.id
                            ? audioUi.export
                            : audioUi.shareExport
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
                      {audioUi.playback}: {playbackError}
                    </Text>
                  )}


                  {isInterrupted && (

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
                        {audioUi.interruptedDescription}
                      </Text>
                    </View>
                  )}


                  {!isInterrupted &&
                    !lecture.transcriptReady && (

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
                              ? audioUi.preparingWhisper
                              : whisperStage === 'model-ready'
                                ? audioUi.modelReady
                                : whisperStage === 'retrying'
                                  ? audioUi.noTextRetrying
                                  : audioUi.transcribingLocally
                          )
                          : lecture.transcription.status ===
                              'not_started'
                            ? audioUi.transcriptNotStarted
                            : lecture.transcription.status ===
                                'pending'
                              ? audioUi.readyForTranscription
                              : lecture.transcription.status ===
                                  'processing'
                                ? audioUi.transcriptionInterrupted
                                : lecture.transcription.status ===
                                    'done'
                                  ? audioUi.transcriptReady
                                  : lecture.transcription.status ===
                                      'error'
                                    ? audioUi.transcriptionFailedStatus
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
                        WhisperKit · {audioUi.onDevice} · {getAudioSourceLanguageLabel(lecture.language, app_language)}
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
                              ? audioUi.retranscribingPreparing
                              : whisperStage ===
                                  'retrying'
                                ? audioUi.retranscribingRetrying
                                : audioUi.retranscribingLocal
                          )
                          : (
                            whisperStage ===
                              'preparing-model'
                              ? audioUi.firstUseWhisper
                              : audioUi.processingLocally
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
                          {audioUi.transcriptUpdated}
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
                          {audioUi.updatedJustNow}
                        </Text>

                      ) : null}


                      <View
                        style={
                          styles.textTabRow
                        }
                      >
                        {(
                          [
                            ['source', getAudioSourceLanguageLabel(lecture.language, app_language)],
                            ['uk', audioUi.ukrainian],
                            ['ru', audioUi.russian],
                          ] as const
                        ).map(
                          ([tab, label]) => (
                            <Pressable
                              key={tab}
                              accessibilityRole="button"
                              accessibilityLabel={`${audioUi.showText}: ${label}`}
                              disabled={
                                isLectureProcessing
                              }
                              onPress={() =>
                                handleSelectTextTab(
                                  lecture,
                                  tab
                                )
                              }
                              style={[
                                styles.textTabButton,
                                {
                                  borderColor:
                                    T.accent,
                                  backgroundColor:
                                    openedTextTab ===
                                      tab
                                      ? T.accent
                                      : 'transparent',
                                  opacity:
                                    isLectureProcessing
                                      ? 0.45
                                      : 1,
                                },
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.textTabText,
                                  {
                                    color:
                                      openedTextTab ===
                                        tab
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


                      <View
                        style={
                          styles.retranscribeRow
                        }
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={audioUi.retranscribeAccessibility}
                          disabled={
                            isLectureProcessing
                          }
                          onPress={() =>
                            confirmRetranscribe(
                              lecture,
                              async () => {
                                setOpenedTextTab(
                                  'source'
                                );

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

                                pauseForRetranscription();
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
                            {audioUi.retranscribe}
                          </Text>
                        </Pressable>
                      </View>


                      {openedTextTab ===
                        'source' ? (

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

                      ) : (

                        <TranslationPanel
                          target={
                            openedTextTab
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
                          translatedSegments={
                            openedTranslationSegments
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
                          isCurrent={
                            isCurrent
                          }
                          isLoaded={
                            playerStatus.isLoaded
                          }
                          currentTime={
                            playerStatus.currentTime
                          }
                          onSeek={
                            seconds =>
                              void handleSeekLectureTo(
                                lecture,
                                seconds,
                                true
                              )
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
                          showTargetSelector={false}
                        />
                      )}


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

    sourceLanguageRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },

    sourceLanguageButton: {
      minWidth: 74,
      minHeight: 34,
      borderWidth: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },

    sourceLanguageText: {
      fontWeight: '900',
      textAlign: 'center',
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

    recordingActionRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },

    recordingMainButton: {
      flex: 1,
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

    lectureSubDate: {
      fontWeight: '600',
      marginBottom: 4,
    },

    lectureMeta: {
      fontWeight: '700',
      lineHeight: 19,
    },

    lectureHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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

    textTabRow: {
      flexDirection: 'row',
      gap: 7,
      marginBottom: 10,
    },

    textTabButton: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },

    textTabText: {
      fontWeight: '800',
      textAlign: 'center',
    },


    savedTranscriptText: {
      lineHeight: 24,
      fontWeight: '500',
    },













    retranscribeRow: {
      marginBottom: 14,
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

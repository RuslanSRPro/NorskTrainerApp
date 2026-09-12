import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  convertFileSrc,
  invoke,
} from '@tauri-apps/api/core';

import {
  listen,
} from '@tauri-apps/api/event';

import {
  confirm,
  open,
} from '@tauri-apps/plugin-dialog';

import {
  getAudioMarkerLabel,
  getAudioUiText,
  normalizeAudioUiLanguage,
} from '@/features/audio/audioUiText';

import {
  beginWindowsTranslator,
  translateSegmentsWithSession,
  type WindowsTranslationTarget,
  type WindowsTranslatorProgress,
  type WindowsTranslatorSession,
} from '@/features/audio/windowsTranslation';

import {
  useSettingsStore,
} from '@/store/settingsStore';

import {
  useTheme,
} from '@/contexts/ThemeContext';

import type {
  LectureMarker,
  LectureMarkerType,
  LectureSourceLanguage,
} from '@/features/audio/lectureTypes';

type RecordingStatus = {
  isRecording: boolean;
  elapsedMillis: number;
  path: string | null;
  bytes: number;
  sampleRate: number;
  channels: number;
  error: string | null;
};

type WindowsLectureMarker = {
  id: string;
  timeMillis: number;
  markerType: LectureMarkerType;
  note: string;
  createdAt: string;
};

type WindowsLecture = {
  id: string;
  path: string;
  audioPath: string;
  audioFileName: string;
  title: string | null;
  createdAtMillis: number;
  durationMillis: number;
  bytes: number;
  sampleRate: number;
  channels: number;
  language: LectureSourceLanguage;
  source: string;
  originalFileName: string | null;
  markers: WindowsLectureMarker[];
  transcriptReady: boolean;
  transcriptCharacters: number;
};

type WindowsTranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

type WindowsTranscript = {
  ok: boolean;
  model: string;
  language: string;
  text: string;
  segments: WindowsTranscriptSegment[];
  characters: number;
  audioLoadingMode: string;
  chunkingStrategy: string;
};

type WindowsWhisperProgress = {
  stage: string;
  percent: number;
  message: string;
  lectureId: string | null;
};

type WindowsSavedTranslation = {
  target: WindowsTranslationTarget;
  text: string;
  segments: WindowsTranscriptSegment[];
};

type WindowsLiveSnapshot = {
  ok: boolean;
  model: string;
  backend: string;
  language: string;
  text: string;
  segments: WindowsTranscriptSegment[];
  windowStart: number;
  duration: number;
};

const EMPTY_STATUS: RecordingStatus = {
  isRecording: false,
  elapsedMillis: 0,
  path: null,
  bytes: 0,
  sampleRate: 0,
  channels: 0,
  error: null,
};

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      hours,
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  return [
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(
      1,
      Math.round(bytes / 1024)
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDate(milliseconds: number) {
  if (!milliseconds) {
    return '';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(
    new Date(milliseconds)
  );
}

function newMarker(
  timeMillis: number,
  type: LectureMarkerType
): WindowsLectureMarker {
  return {
    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    timeMillis,
    markerType: type,
    note: '',
    createdAt:
      new Date().toISOString(),
  };
}

function mergeLiveSegments(
  current: WindowsTranscriptSegment[],
  incoming: WindowsTranscriptSegment[],
  windowStart: number
) {
  const keepBefore =
    windowStart +
    0.2;

  const kept =
    current.filter(
      segment =>
        segment.end <
          keepBefore
    );

  const merged =
    [
      ...kept,
      ...incoming,
    ]
      .filter(
        segment =>
          segment.text
            .trim()
            .length >
          0
      )
      .sort(
        (left, right) =>
          left.start -
          right.start
      );

  const deduped:
    WindowsTranscriptSegment[] =
      [];

  for (
    const segment
    of merged
  ) {
    const previous =
      deduped[
        deduped.length -
          1
      ];

    if (
      previous &&
      Math.abs(
        previous.start -
          segment.start
      ) <
        0.25 &&
      previous.text
        .trim()
        .toLowerCase() ===
        segment.text
          .trim()
          .toLowerCase()
    ) {
      continue;
    }

    deduped.push(
      segment
    );
  }

  return deduped;
}

export default function WindowsVoiceScreen() {
  const {
    theme,
    fonts,
  } = useTheme();

  const T = theme;
  const F = fonts;

  const {
    app_language,
    loadSettings,
  } = useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const uiLanguage =
    normalizeAudioUiLanguage(
      app_language
    );

  const windowsInfo =
    uiLanguage === 'ua'
      ? 'Записує звук, який відтворює Windows. Працює через динаміки або навушники.'
      : uiLanguage === 'no'
        ? 'Tar opp lyden som spilles av i Windows. Fungerer med både høyttalere og hodetelefoner.'
        : 'Records the audio played by Windows. Works with speakers or headphones.';

  const windowsTranslationInfo =
    uiLanguage === 'ua'
      ? 'Локальний переклад Microsoft Edge. Після першого завантаження мовної моделі працює на цьому PC.'
      : uiLanguage === 'no'
        ? 'Lokal oversettelse med Microsoft Edge. Etter første modellnedlasting kjører den på denne PC-en.'
        : 'On-device translation with Microsoft Edge. After the first language-model download it runs on this PC.';

  const [
    status,
    setStatus,
  ] =
    useState<RecordingStatus>(
      EMPTY_STATUS
    );

  const [
    lectures,
    setLectures,
  ] =
    useState<WindowsLecture[]>([]);

  const [
    sourceLanguage,
    setSourceLanguage,
  ] =
    useState<LectureSourceLanguage>(
      'nb-NO'
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    loadingLibrary,
    setLoadingLibrary,
  ] =
    useState(true);

  const [
    message,
    setMessage,
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
    activeMarkers,
    setActiveMarkers,
  ] =
    useState<WindowsLectureMarker[]>(
      []
    );

  const [
    playingLectureId,
    setPlayingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    playbackCurrent,
    setPlaybackCurrent,
  ] =
    useState(0);

  const [
    playbackDuration,
    setPlaybackDuration,
  ] =
    useState(0);

  const [
    renameLectureId,
    setRenameLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    renameValue,
    setRenameValue,
  ] =
    useState('');

  const [
    openedTranscriptId,
    setOpenedTranscriptId,
  ] =
    useState<string | null>(
      null
    );

  const [
    transcriptByLecture,
    setTranscriptByLecture,
  ] =
    useState<
      Record<
        string,
        WindowsTranscript
      >
    >({});

  const [
    transcribingLectureId,
    setTranscribingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    whisperProgress,
    setWhisperProgress,
  ] =
    useState<
      WindowsWhisperProgress | null
    >(
      null
    );

  const [
    translationTarget,
    setTranslationTarget,
  ] =
    useState<
      WindowsTranslationTarget
    >(
      'uk'
    );

  const [
    translationByLecture,
    setTranslationByLecture,
  ] =
    useState<
      Record<
        string,
        Partial<
          Record<
            WindowsTranslationTarget,
            WindowsSavedTranslation
          >
        >
      >
    >({});

  const [
    translatingKey,
    setTranslatingKey,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    translatorProgress,
    setTranslatorProgress,
  ] =
    useState<
      WindowsTranslatorProgress | null
    >(
      null
    );

  const [
    liveActive,
    setLiveActive,
  ] =
    useState(
      false
    );

  const [
    livePhase,
    setLivePhase,
  ] =
    useState<
      'idle' |
      'preparing' |
      'listening' |
      'finalizing'
    >(
      'idle'
    );

  const [
    liveText,
    setLiveText,
  ] =
    useState(
      ''
    );

  const [
    liveTranslation,
    setLiveTranslation,
  ] =
    useState(
      ''
    );

  const [
    liveBackend,
    setLiveBackend,
  ] =
    useState(
      ''
    );

  const liveBackendLabel =
    liveBackend === 'vulkan'
      ? 'Vulkan GPU'
      : liveBackend === 'cpu-fallback'
        ? 'CPU'
        : '';

  const pollRef =
    useRef<
      ReturnType<typeof setInterval> | null
    >(null);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const liveSnapshotTimerRef =
    useRef<
      ReturnType<typeof setInterval> | null
    >(
      null
    );

  const liveSnapshotBusyRef =
    useRef(
      false
    );

  const liveGenerationRef =
    useRef(
      0
    );

  const livePathRef =
    useRef<
      string | null
    >(
      null
    );

  const liveSegmentsRef =
    useRef<
      WindowsTranscriptSegment[]
    >(
      []
    );

  const liveTranslatedSegmentsRef =
    useRef<
      WindowsTranscriptSegment[]
    >(
      []
    );

  const liveTranslatorRef =
    useRef<
      WindowsTranslatorSession | null
    >(
      null
    );

  const liveTranslatorPromiseRef =
    useRef<
      Promise<
        WindowsTranslatorSession
      > |
      null
    >(
      null
    );

  const liveSourceLanguageRef =
    useRef<
      LectureSourceLanguage
    >(
      'nb-NO'
    );

  const liveTargetRef =
    useRef<
      WindowsTranslationTarget
    >(
      'uk'
    );

  useEffect(
    () => {
      void loadSettings();
    },
    []
  );

  useEffect(
    () => {
      let active =
        true;

      let unlisten:
        (() => void) | null =
          null;

      void listen<
        WindowsWhisperProgress
      >(
        'windows-whisper-progress',
        event => {
          if (!active) {
            return;
          }

          setWhisperProgress(
            event.payload
          );
        }
      ).then(
        cleanup => {
          if (!active) {
            cleanup();
            return;
          }

          unlisten =
            cleanup;
        }
      );

      return () => {
        active =
          false;

        unlisten?.();
      };
    },
    []
  );

  const stopPolling =
    useCallback(
      () => {
        if (
          pollRef.current
        ) {
          clearInterval(
            pollRef.current
          );

          pollRef.current =
            null;
        }
      },
      []
    );

  const stopLiveSnapshotLoop =
    useCallback(
      () => {
        if (
          liveSnapshotTimerRef.current
        ) {
          clearInterval(
            liveSnapshotTimerRef.current
          );

          liveSnapshotTimerRef.current =
            null;
        }

        liveSnapshotBusyRef.current =
          false;
      },
      []
    );

  const destroyLiveTranslator =
    useCallback(
      () => {
        try {
          liveTranslatorRef.current
            ?.destroy();
        }
        catch {
          // no-op
        }

        liveTranslatorRef.current =
          null;

        liveTranslatorPromiseRef.current =
          null;
      },
      []
    );

  const refreshLibrary =
    useCallback(
      async () => {
        try {
          const items =
            await invoke<
              WindowsLecture[]
            >(
              'list_lectures'
            );

          setLectures(items);
        }
        catch (error) {
          console.error(
            'Could not load Windows lectures:',
            error
          );

          setMessage(
            String(error)
          );
        }
        finally {
          setLoadingLibrary(
            false
          );
        }
      },
      []
    );

  const stopPlayback =
    useCallback(
      () => {
        const audio =
          audioRef.current;

        if (audio) {
          audio.pause();
          audio.src = '';
        }

        audioRef.current =
          null;

        setPlayingLectureId(
          null
        );

        setPlaybackCurrent(
          0
        );

        setPlaybackDuration(
          0
        );
      },
      []
    );

  const startPolling =
    useCallback(
      () => {
        stopPolling();

        pollRef.current =
          setInterval(
            async () => {
              try {
                const next =
                  await invoke<
                    RecordingStatus
                  >(
                    'get_system_recording_status'
                  );

                setStatus(
                  next
                );

                if (
                  !next.isRecording
                ) {
                  stopPolling();
                }
              }
              catch (error) {
                console.error(
                  'Recording status error:',
                  error
                );
              }
            },
            250
          );
      },
      [
        stopPolling,
      ]
    );

  useEffect(
    () => {
      void refreshLibrary();

      return () => {
        stopPolling();
        stopPlayback();
        stopLiveSnapshotLoop();
        destroyLiveTranslator();
      };
    },
    [
      destroyLiveTranslator,
      refreshLibrary,
      stopLiveSnapshotLoop,
      stopPlayback,
      stopPolling,
    ]
  );

  const runLiveSnapshot =
    useCallback(
      async (
        generation:
          number
      ) => {
        if (
          generation !==
            liveGenerationRef.current ||
          liveSnapshotBusyRef.current
        ) {
          return;
        }

        const recordingPath =
          livePathRef.current;

        if (!recordingPath) {
          return;
        }

        liveSnapshotBusyRef.current =
          true;

        try {
          const prompt =
            liveSegmentsRef.current
              .map(
                segment =>
                  segment.text
              )
              .join(' ');

          const snapshot =
            await invoke<
              WindowsLiveSnapshot
            >(
              'transcribe_live_snapshot',
              {
                recordingPath,
                language:
                  liveSourceLanguageRef.current,
                windowSeconds:
                  12,
                prompt,
              }
            );

          if (
            generation !==
              liveGenerationRef.current
          ) {
            return;
          }

          setLiveBackend(
            snapshot.backend
          );

          const merged =
            mergeLiveSegments(
              liveSegmentsRef.current,
              snapshot.segments,
              snapshot.windowStart
            );

          liveSegmentsRef.current =
            merged;

          setLiveText(
            merged
              .map(
                segment =>
                  segment.text
              )
              .join(' ')
              .trim()
          );

          const translator =
            liveTranslatorRef.current;

          if (
            translator &&
            snapshot.segments.length >
              0
          ) {
            try {
              const translatedWindow =
                await translateSegmentsWithSession(
                  translator,
                  snapshot.segments
                );

              if (
                generation !==
                  liveGenerationRef.current
              ) {
                return;
              }

              const mergedTranslation =
                mergeLiveSegments(
                  liveTranslatedSegmentsRef.current,
                  translatedWindow.segments,
                  snapshot.windowStart
                );

              liveTranslatedSegmentsRef.current =
                mergedTranslation;

              setLiveTranslation(
                mergedTranslation
                  .map(
                    segment =>
                      segment.text
                  )
                  .join(' ')
                  .trim()
              );
            }
            catch (translationError) {
              console.warn(
                'Live translation update failed:',
                translationError
              );
            }
          }
        }
        catch (error) {
          const text =
            error instanceof Error
              ? error.message
              : String(error);

          /*
           * The recorder flushes checkpoints every 500 ms. A
           * snapshot can occasionally hit the file between two
           * checkpoints; the next interval simply retries.
           */
          if (
            !/waiting for more speech|not ready yet|does not contain audio/i
              .test(
                text
              )
          ) {
            console.warn(
              'Live snapshot skipped:',
              text
            );
          }
        }
        finally {
          liveSnapshotBusyRef.current =
            false;
        }
      },
      []
    );

  const startLiveSnapshotLoop =
    useCallback(
      (
        generation:
          number
      ) => {
        stopLiveSnapshotLoop();

        void runLiveSnapshot(
          generation
        );

        liveSnapshotTimerRef.current =
          setInterval(
            () => {
              void runLiveSnapshot(
                generation
              );
            },
            3500
          );
      },
      [
        runLiveSnapshot,
        stopLiveSnapshotLoop,
      ]
    );

  const resetLiveUi =
    useCallback(
      () => {
        stopLiveSnapshotLoop();

        livePathRef.current =
          null;

        liveSegmentsRef.current =
          [];

        liveTranslatedSegmentsRef.current =
          [];

        setLiveText(
          ''
        );

        setLiveTranslation(
          ''
        );

        setLiveBackend(
          ''
        );

        setLivePhase(
          'idle'
        );

        setLiveActive(
          false
        );
      },
      [
        stopLiveSnapshotLoop,
      ]
    );

  const handleLive =
    async () => {
      if (
        liveActive &&
        livePhase ===
          'finalizing'
      ) {
        return;
      }

      if (
        liveActive
      ) {
        setBusy(
          true
        );

        setLivePhase(
          'finalizing'
        );

        const generation =
          ++liveGenerationRef.current;

        stopLiveSnapshotLoop();

        try {
          const stopped =
            await invoke<
              RecordingStatus
            >(
              'stop_system_recording'
            );

          stopPolling();

          if (
            !stopped.path
          ) {
            throw new Error(
              audioUi.recordingNotSaved
            );
          }

          const lecture =
            await invoke<
              WindowsLecture
            >(
              'adopt_recording',
              {
                recordingPath:
                  stopped.path,
                language:
                  liveSourceLanguageRef.current,
              }
            );

          if (
            activeMarkers.length >
              0
          ) {
            await invoke(
              'save_lecture_markers',
              {
                id:
                  lecture.id,
                markers:
                  activeMarkers,
              }
            );
          }

          setStatus(
            EMPTY_STATUS
          );

          setActiveMarkers(
            []
          );

          /*
           * Accuracy-first final pass: Live preview is provisional.
           * The saved lecture always receives a full-file transcript
           * from the large Turbo model.
           */
          const finalTranscript =
            await invoke<
              WindowsTranscript
            >(
              'transcribe_lecture',
              {
                id:
                  lecture.id,
                language:
                  liveSourceLanguageRef.current,
              }
            );

          if (
            generation !==
              liveGenerationRef.current
          ) {
            return;
          }

          setTranscriptByLecture(
            current => ({
              ...current,
              [lecture.id]:
                finalTranscript,
            })
          );

          setOpenedTranscriptId(
            lecture.id
          );

          let translator =
            liveTranslatorRef.current;

          if (
            !translator &&
            liveTranslatorPromiseRef.current
          ) {
            try {
              translator =
                await liveTranslatorPromiseRef.current;

              liveTranslatorRef.current =
                translator;
            }
            catch (translationError) {
              console.warn(
                'Final Live Translator session failed:',
                translationError
              );
            }
          }

          if (
            translator &&
            finalTranscript.text
              .trim()
          ) {
            try {
              const sourceSegments =
                finalTranscript.segments.length >
                  0
                  ? finalTranscript.segments
                  : [
                      {
                        start:
                          0,
                        end:
                          Math.max(
                            0.1,
                            lecture.durationMillis /
                              1000
                          ),
                        text:
                          finalTranscript.text,
                      },
                    ];

              const translated =
                await translateSegmentsWithSession(
                  translator,
                  sourceSegments,
                  progress => {
                    setTranslatorProgress(
                      progress
                    );
                  }
                );

              if (
                translated.text
                  .trim()
              ) {
                const saved =
                  await invoke<
                    WindowsSavedTranslation
                  >(
                    'save_lecture_translation',
                    {
                      id:
                        lecture.id,
                      target:
                        liveTargetRef.current,
                      text:
                        translated.text,
                      segments:
                        translated.segments,
                    }
                  );

                setTranslationByLecture(
                  current => ({
                    ...current,
                    [lecture.id]: {
                      ...(
                        current[
                          lecture.id
                        ] ??
                        {}
                      ),
                      [liveTargetRef.current]:
                        saved,
                    },
                  })
                );

                setTranslationTarget(
                  liveTargetRef.current
                );
              }
            }
            catch (translationError) {
              console.warn(
                'Final Live translation failed:',
                translationError
              );
            }
          }

          await refreshLibrary();

          setMessage(
            audioUi.liveSaved
          );
        }
        catch (error) {
          console.error(
            'Windows Live finalization error:',
            error
          );

          setMessage(
            error instanceof Error
              ? error.message
              : String(error)
          );
        }
        finally {
          destroyLiveTranslator();

          setTranslatorProgress(
            null
          );

          resetLiveUi();

          setStatus(
            EMPTY_STATUS
          );

          setBusy(
            false
          );
        }

        return;
      }

      if (
        busy ||
        status.isRecording ||
        transcribingLectureId ||
        translatingKey
      ) {
        return;
      }

      const generation =
        ++liveGenerationRef.current;

      liveSourceLanguageRef.current =
        sourceLanguage;

      liveTargetRef.current =
        translationTarget;

      let translatorPromise:
        Promise<
          WindowsTranslatorSession
        > |
        null =
          null;

      try {
        /*
         * Start the browser translation session directly inside
         * the Live button gesture. Live transcription still works
         * if Edge Translator is unavailable.
         */
        translatorPromise =
          beginWindowsTranslator(
            sourceLanguage,
            translationTarget,
            progress => {
              setTranslatorProgress(
                progress
              );
            }
          );
      }
      catch (translationError) {
        console.warn(
          'Live Translator unavailable:',
          translationError
        );

        setLiveTranslation(
          uiLanguage === 'ua'
            ? 'Локальний переклад недоступний у цьому WebView2.'
            : uiLanguage === 'no'
              ? 'Lokal oversettelse er ikke tilgjengelig i denne WebView2-versjonen.'
              : 'On-device translation is unavailable in this WebView2 runtime.'
        );
      }

      liveTranslatorPromiseRef.current =
        translatorPromise;

      setBusy(
        true
      );

      setMessage(
        null
      );

      stopPlayback();

      setActiveMarkers(
        []
      );

      liveSegmentsRef.current =
        [];

      liveTranslatedSegmentsRef.current =
        [];

      setLiveText(
        ''
      );

      setLiveTranslation(
        ''
      );

      setLiveBackend(
        ''
      );

      setLivePhase(
        'preparing'
      );

      try {
        /*
         * Capture begins immediately. Model loading happens in
         * parallel, matching the iOS Live latency strategy.
         */
        const recordingPromise =
          invoke<
            RecordingStatus
          >(
            'start_system_recording'
          );

        const modelPromise =
          invoke(
            'prepare_live_whisper_model'
          );

        const started =
          await recordingPromise;

        if (
          generation !==
            liveGenerationRef.current
        ) {
          return;
        }

        if (
          !started.path
        ) {
          throw new Error(
            audioUi.recordingNotSaved
          );
        }

        livePathRef.current =
          started.path;

        setStatus(
          started
        );

        setLiveActive(
          true
        );

        startPolling();

        /*
         * Once capture has started, Stop Live must remain clickable
         * even while the model is downloading.
         */
        setBusy(
          false
        );

        if (
          translatorPromise
        ) {
          void translatorPromise
            .then(
              translator => {
                if (
                  generation !==
                    liveGenerationRef.current
                ) {
                  translator.destroy();
                  return;
                }

                liveTranslatorRef.current =
                  translator;
              }
            )
            .catch(
              translationError => {
                console.warn(
                  'Live Translator session failed:',
                  translationError
                );

                setLiveTranslation(
                  uiLanguage === 'ua'
                    ? 'Локальний переклад недоступний у цьому WebView2.'
                    : uiLanguage === 'no'
                      ? 'Lokal oversettelse er ikke tilgjengelig i denne WebView2-versjonen.'
                      : 'On-device translation is unavailable in this WebView2 runtime.'
                );
              }
            );
        }

        await modelPromise;

        if (
          generation !==
            liveGenerationRef.current
        ) {
          return;
        }

        setLivePhase(
          'listening'
        );

        startLiveSnapshotLoop(
          generation
        );
      }
      catch (error) {
        console.error(
          'Windows Live start error:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );

        destroyLiveTranslator();

        try {
          const current =
            await invoke<
              RecordingStatus
            >(
              'get_system_recording_status'
            );

          if (
            current.isRecording
          ) {
            await invoke(
              'stop_system_recording'
            );
          }
        }
        catch {
          // no-op
        }

        stopPolling();

        resetLiveUi();

        setStatus(
          EMPTY_STATUS
        );

        setBusy(
          false
        );
      }
    };

  const handleRecording =
    async () => {
      if (
        busy ||
        liveActive
      ) {
        return;
      }

      setBusy(true);
      setMessage(null);

      try {
        if (
          status.isRecording
        ) {
          const stopped =
            await invoke<
              RecordingStatus
            >(
              'stop_system_recording'
            );

          stopPolling();

          if (
            !stopped.path
          ) {
            throw new Error(
              audioUi.recordingNotSaved
            );
          }

          const lecture =
            await invoke<
              WindowsLecture
            >(
              'adopt_recording',
              {
                recordingPath:
                  stopped.path,
                language:
                  sourceLanguage,
              }
            );

          if (
            activeMarkers.length >
              0
          ) {
            await invoke(
              'save_lecture_markers',
              {
                id:
                  lecture.id,
                markers:
                  activeMarkers,
              }
            );
          }

          setActiveMarkers(
            []
          );

          setStatus(
            EMPTY_STATUS
          );

          await refreshLibrary();

          setMessage(
            audioUi.audioSavedShort
          );

          return;
        }

        stopPlayback();

        setActiveMarkers(
          []
        );

        const started =
          await invoke<
            RecordingStatus
          >(
            'start_system_recording'
          );

        setStatus(started);

        startPolling();
      }
      catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          'Windows recording error:',
          error
        );

        setMessage(text);

        setStatus(
          current => ({
            ...current,
            isRecording:
              false,
            error:
              text,
          })
        );

        stopPolling();
      }
      finally {
        setBusy(false);
      }
    };

  const handleMarkMoment =
    () => {
      if (
        !status.isRecording
      ) {
        return;
      }

      setActiveMarkers(
        current => [
          ...current,
          newMarker(
            status.elapsedMillis,
            selectedMarkerType
          ),
        ]
      );
    };

  const handleImport =
    async () => {
      if (
        busy ||
        status.isRecording
      ) {
        return;
      }

      setBusy(true);
      setMessage(null);

      try {
        const selected =
          await open({
            multiple:
              false,
            directory:
              false,
            title:
              audioUi.importAudio,
            filters: [
              {
                name:
                  'Audio',
                extensions: [
                  'm4a',
                  'mp3',
                  'wav',
                  'aac',
                  'caf',
                  'mp4',
                  'mpeg',
                  'mpga',
                ],
              },
            ],
          });

        if (
          !selected ||
          Array.isArray(
            selected
          )
        ) {
          return;
        }

        await invoke(
          'import_audio',
          {
            sourcePath:
              selected,
            language:
              sourceLanguage,
          }
        );

        await refreshLibrary();

        setMessage(
          audioUi.audioImported
        );
      }
      catch (error) {
        console.error(
          'Windows audio import error:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
      finally {
        setBusy(false);
      }
    };

  const handlePlay =
    async (
      lecture:
        WindowsLecture
    ) => {
      const current =
        audioRef.current;

      if (
        current &&
        playingLectureId ===
          lecture.id
      ) {
        if (
          current.paused
        ) {
          await current.play();
        }
        else {
          current.pause();
        }

        return;
      }

      stopPlayback();

      try {
        const url =
          convertFileSrc(
            lecture.audioPath
          );

        const audio =
          new Audio(url);

        audioRef.current =
          audio;

        audio.preload =
          'metadata';

        audio.onloadedmetadata =
          () => {
            const seconds =
              Number.isFinite(
                audio.duration
              )
                ? audio.duration
                : 0;

            setPlaybackDuration(
              seconds
            );

            if (
              lecture.durationMillis ===
                0 &&
              seconds >
                0
            ) {
              void invoke(
                'update_lecture_duration',
                {
                  id:
                    lecture.id,
                  durationMillis:
                    Math.round(
                      seconds *
                        1000
                    ),
                }
              );
            }
          };

        audio.ontimeupdate =
          () => {
            setPlaybackCurrent(
              audio.currentTime ||
                0
            );
          };

        audio.onplay =
          () => {
            setPlayingLectureId(
              lecture.id
            );
          };

        audio.onpause =
          () => {
            if (
              !audio.ended
            ) {
              setPlayingLectureId(
                lecture.id
              );
            }
          };

        audio.onended =
          () => {
            setPlayingLectureId(
              null
            );

            setPlaybackCurrent(
              0
            );
          };

        audio.onerror =
          () => {
            setMessage(
              audioUi.playbackLoadFailed
            );

            stopPlayback();
          };

        await audio.play();

        setPlayingLectureId(
          lecture.id
        );
      }
      catch (error) {
        console.error(
          'Windows playback error:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );

        stopPlayback();
      }
    };

  const seekTo =
    (
      lectureId:
        string,
      seconds:
        number
    ) => {
      const audio =
        audioRef.current;

      if (
        !audio ||
        playingLectureId !==
          lectureId
      ) {
        return;
      }

      const maximum =
        Number.isFinite(
          audio.duration
        )
          ? audio.duration
          : playbackDuration;

      audio.currentTime =
        Math.max(
          0,
          Math.min(
            seconds,
            maximum ||
              seconds
          )
        );

      setPlaybackCurrent(
        audio.currentTime
      );
    };

  const handleRenameSave =
    async (
      lecture:
        WindowsLecture
    ) => {
      try {
        await invoke(
          'rename_lecture',
          {
            id:
              lecture.id,
            title:
              renameValue,
          }
        );

        setRenameLectureId(
          null
        );

        setRenameValue(
          ''
        );

        await refreshLibrary();
      }
      catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    };

  const handleDelete =
    async (
      lecture:
        WindowsLecture
    ) => {
      const accepted =
        await confirm(
          audioUi.deletePrompt
            .replace(
              /iPhone/gi,
              'PC'
            ),
          {
            title:
              audioUi.deleteLecture,
            kind:
              'warning',
            okLabel:
              audioUi.delete,
            cancelLabel:
              audioUi.cancel,
          }
        );

      if (!accepted) {
        return;
      }

      try {
        if (
          playingLectureId ===
            lecture.id
        ) {
          stopPlayback();
        }

        await invoke(
          'delete_lecture',
          {
            id:
              lecture.id,
          }
        );

        await refreshLibrary();
      }
      catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    };

  const loadTranscript =
    async (
      lecture:
        WindowsLecture
    ) => {
      const cached =
        transcriptByLecture[
          lecture.id
        ];

      if (cached) {
        return cached;
      }

      const saved =
        await invoke<
          WindowsTranscript | null
        >(
          'get_saved_transcript',
          {
            id:
              lecture.id,
          }
        );

      if (saved) {
        setTranscriptByLecture(
          current => ({
            ...current,
            [lecture.id]:
              saved,
          })
        );
      }

      return saved;
    };

  const loadSavedTranslation =
    async (
      lecture:
        WindowsLecture,
      target:
        WindowsTranslationTarget
    ) => {
      const cached =
        translationByLecture[
          lecture.id
        ]?.[
          target
        ];

      if (cached) {
        return cached;
      }

      const saved =
        await invoke<
          WindowsSavedTranslation | null
        >(
          'get_saved_translation',
          {
            id:
              lecture.id,
            target,
          }
        );

      if (saved) {
        setTranslationByLecture(
          current => ({
            ...current,
            [lecture.id]: {
              ...(
                current[
                  lecture.id
                ] ??
                {}
              ),
              [target]:
                saved,
            },
          })
        );
      }

      return saved;
    };

  const handleSelectTranslationTarget =
    async (
      lecture:
        WindowsLecture,
      target:
        WindowsTranslationTarget
    ) => {
      setTranslationTarget(
        target
      );

      try {
        await loadSavedTranslation(
          lecture,
          target
        );
      }
      catch (error) {
        console.error(
          'Could not load Windows translation:',
          error
        );
      }
    };

  const handleTranslate =
    async (
      lecture:
        WindowsLecture,
      target:
        WindowsTranslationTarget
    ) => {
      if (
        translatingKey ||
        transcribingLectureId ||
        status.isRecording
      ) {
        return;
      }

      let translatorPromise:
        Promise<
          WindowsTranslatorSession
        >;

      try {
        /*
         * Begin the Edge Translator session immediately from the
         * click event. A first-time model download requires recent
         * user activation.
         */
        translatorPromise =
          beginWindowsTranslator(
            lecture.language,
            target,
            progress => {
              setTranslatorProgress(
                progress
              );
            }
          );
      }
      catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
        return;
      }

      setTranslatingKey(
        `${lecture.id}:${target}`
      );

      setTranslatorProgress({
        stage:
          'preparing',
        percent:
          0,
      });

      setMessage(
        null
      );

      let translator:
        WindowsTranslatorSession | null =
          null;

      try {
        const [
          transcript,
          createdTranslator,
        ] =
          await Promise.all([
            loadTranscript(
              lecture
            ),
            translatorPromise,
          ]);

        translator =
          createdTranslator;

        if (
          !transcript ||
          !transcript.text
            .trim()
        ) {
          throw new Error(
            audioUi.createTranscriptFirst
          );
        }

        const sourceSegments =
          transcript.segments.length >
            0
            ? transcript.segments
            : [
                {
                  start:
                    0,
                  end:
                    Math.max(
                      0.1,
                      lecture.durationMillis /
                        1000
                    ),
                  text:
                    transcript.text,
                },
              ];

        const translated =
          await translateSegmentsWithSession(
            translator,
            sourceSegments,
            progress => {
              setTranslatorProgress(
                progress
              );
            }
          );

        if (
          !translated.text
            .trim()
        ) {
          throw new Error(
            audioUi.emptyTranslation
          );
        }

        const saved =
          await invoke<
            WindowsSavedTranslation
          >(
            'save_lecture_translation',
            {
              id:
                lecture.id,
              target,
              text:
                translated.text,
              segments:
                translated.segments,
            }
          );

        setTranslationByLecture(
          current => ({
            ...current,
            [lecture.id]: {
              ...(
                current[
                  lecture.id
                ] ??
                {}
              ),
              [target]:
                saved,
            },
          })
        );

        setTranslationTarget(
          target
        );
      }
      catch (error) {
        console.error(
          'Windows on-device translation error:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
      finally {
        try {
          translator
            ?.destroy();
        }
        catch {
          // no-op
        }

        setTranslatingKey(
          null
        );

        setTranslatorProgress(
          null
        );
      }
    };

  const handleToggleTranscript =
    async (
      lecture:
        WindowsLecture
    ) => {
      if (
        openedTranscriptId ===
          lecture.id
      ) {
        setOpenedTranscriptId(
          null
        );
        return;
      }

      try {
        const saved =
          await loadTranscript(
            lecture
          );

        if (!saved) {
          setMessage(
            audioUi.createTranscriptFirst
          );
          return;
        }

        setOpenedTranscriptId(
          lecture.id
        );

        void loadSavedTranslation(
          lecture,
          translationTarget
        );

        setMessage(
          null
        );
      }
      catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    };

  const handleTranscribe =
    async (
      lecture:
        WindowsLecture
    ) => {
      if (
        transcribingLectureId ||
        status.isRecording
      ) {
        return;
      }

      if (
        lecture.transcriptReady
      ) {
        const accepted =
          await confirm(
            audioUi.retranscribePrompt,
            {
              title:
                audioUi.retranscribeTitle,
              kind:
                'warning',
              okLabel:
                audioUi.retranscribeConfirm,
              cancelLabel:
                audioUi.cancel,
            }
          );

        if (!accepted) {
          return;
        }
      }

      stopPlayback();

      setTranscribingLectureId(
        lecture.id
      );

      setWhisperProgress({
        stage:
          'preparing',
        percent:
          0,
        message:
          'Preparing local Whisper model',
        lectureId:
          lecture.id,
      });

      setMessage(
        null
      );

      try {
        const result =
          await invoke<
            WindowsTranscript
          >(
            'transcribe_lecture',
            {
              id:
                lecture.id,
              language:
                lecture.language,
            }
          );

        setTranscriptByLecture(
          current => ({
            ...current,
            [lecture.id]:
              result,
          })
        );

        setOpenedTranscriptId(
          lecture.id
        );

        await refreshLibrary();

        setMessage(
          lecture.transcriptReady
            ? audioUi.transcriptUpdated
            : audioUi.transcriptReady
        );
      }
      catch (error) {
        console.error(
          'Windows Whisper transcription error:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
      finally {
        setTranscribingLectureId(
          null
        );
      }
    };

  const handleTranscriptSeek =
    async (
      lecture:
        WindowsLecture,
      seconds:
        number
    ) => {
      if (
        playingLectureId !==
          lecture.id
      ) {
        await handlePlay(
          lecture
        );
      }

      window.setTimeout(
        () => {
          seekTo(
            lecture.id,
            seconds
          );
        },
        80
      );
    };

  const currentPlaying =
    useMemo(
      () =>
        lectures.find(
          lecture =>
            lecture.id ===
              playingLectureId
        ) ??
        null,
      [
        lectures,
        playingLectureId,
      ]
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator
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

      <View
        style={[
          styles.card,
          {
            borderColor:
              `${T.accent}26`,
          },
        ]}
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
                disabled={
                  status.isRecording ||
                  busy
                }
                onPress={() =>
                  setSourceLanguage(
                    value
                  )
                }
                style={[
                  styles.languageButton,
                  {
                    borderColor:
                      T.accent,
                    backgroundColor:
                      sourceLanguage ===
                        value
                        ? T.accent
                        : 'transparent',
                    opacity:
                      status.isRecording ||
                      busy
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      sourceLanguage ===
                        value
                        ? '#FFFFFF'
                        : T.accent,
                    fontSize:
                      F.base - 2,
                    fontWeight:
                      '800',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {!status.isRecording && (
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
            {windowsInfo}
          </Text>
        )}

        {status.isRecording && (
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
              {audioUi.recording}
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
                status.elapsedMillis
              )}
            </Text>

            <View
              style={
                styles.markerBox
              }
            >
              <Text
                style={[
                  styles.markerTitle,
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
                    'important',
                    'unclear',
                    'repeat',
                    'term',
                  ] as LectureMarkerType[]
                ).map(
                  type => (
                    <Pressable
                      key={type}
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
                        style={{
                          color:
                            selectedMarkerType ===
                              type
                              ? '#FFFFFF'
                              : T.accent,
                          fontSize:
                            F.base - 3,
                          fontWeight:
                            '800',
                        }}
                      >
                        {getAudioMarkerLabel(
                          type,
                          app_language
                        )}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              <Pressable
                onPress={
                  handleMarkMoment
                }
                style={[
                  styles.outlineButton,
                  {
                    borderColor:
                      T.accent,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      T.accent,
                    fontWeight:
                      '900',
                    fontSize:
                      F.base,
                  }}
                >
                  {audioUi.markMoment} · {formatTime(
                    status.elapsedMillis
                  )}
                </Text>
              </Pressable>

              {activeMarkers.length >
                0 && (
                <Text
                  style={{
                    color:
                      T.textSecondary,
                    marginTop:
                      10,
                    fontSize:
                      F.base - 3,
                  }}
                >
                  {audioUi.markersSaved} {activeMarkers.length}
                </Text>
              )}
            </View>
          </>
        )}

        <View
          style={
            styles.liveTargetRow
          }
        >
          {(
            [
              ['uk', '🇺🇦'],
              ['ru', '🇷🇺'],
            ] as const
          ).map(
            ([target, label]) => (
              <Pressable
                key={target}
                disabled={
                  liveActive ||
                  busy
                }
                onPress={() =>
                  setTranslationTarget(
                    target
                  )
                }
                style={[
                  styles.liveTargetButton,
                  {
                    borderColor:
                      T.accent,
                    backgroundColor:
                      translationTarget ===
                        target
                        ? `${T.accent}18`
                        : 'transparent',
                    opacity:
                      liveActive ||
                      busy
                        ? 0.55
                        : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      T.accent,
                    fontSize:
                      F.base - 1,
                    fontWeight:
                      '900',
                  }}
                >
                  {label} {
                    target === 'uk'
                      ? audioUi.ukrainian
                      : audioUi.russian
                  }
                </Text>
              </Pressable>
            )
          )}
        </View>

        <View
          style={
            styles.actionRow
          }
        >
          <Pressable
            disabled={
              busy ||
              liveActive
            }
            onPress={
              handleRecording
            }
            style={[
              styles.mainButton,
              {
                backgroundColor:
                  status.isRecording &&
                  !liveActive
                    ? '#C94B4B'
                    : T.accent,
                opacity:
                  busy ||
                  liveActive
                    ? 0.45
                    : 1,
              },
            ]}
          >
            <Text
              style={
                styles.mainButtonText
              }
            >
              {status.isRecording &&
              !liveActive
                ? audioUi.stopRecording
                : audioUi.startRecording}
            </Text>
          </Pressable>

          <Pressable
            disabled={
              livePhase ===
                'finalizing' ||
              (
                busy &&
                !liveActive
              ) ||
              (
                status.isRecording &&
                !liveActive
              ) ||
              !!transcribingLectureId ||
              !!translatingKey
            }
            onPress={() =>
              void handleLive()
            }
            style={[
              styles.liveButton,
              {
                borderColor:
                  liveActive
                    ? '#C94B4B'
                    : T.accent,
                backgroundColor:
                  liveActive
                    ? '#C94B4B'
                    : 'transparent',
                opacity:
                  livePhase ===
                    'finalizing' ||
                  (
                    busy &&
                    !liveActive
                  ) ||
                  (
                    status.isRecording &&
                    !liveActive
                  ) ||
                  !!transcribingLectureId ||
                  !!translatingKey
                    ? 0.45
                    : 1,
              },
            ]}
          >
            <Text
              style={{
                color:
                  liveActive
                    ? '#FFFFFF'
                    : T.accent,
                fontWeight:
                  '900',
                fontSize:
                  F.base,
              }}
            >
              {liveActive
                ? `■ ${audioUi.live}`
                : `● ${audioUi.live}`}
            </Text>
          </Pressable>
        </View>

        {liveActive ? (
          <View
            style={
              styles.livePanel
            }
          >
            <View
              style={
                styles.liveHeader
              }
            >
              <Text
                style={{
                  color:
                    T.textPrimary,
                  fontSize:
                    F.base,
                  fontWeight:
                    '900',
                }}
              >
                {audioUi.liveTitle}
              </Text>

              {liveBackendLabel ? (
                <Text
                  style={{
                    color:
                      T.textSecondary,
                    fontSize:
                      F.base - 3,
                    fontWeight:
                      '800',
                  }}
                >
                  {liveBackendLabel}
                </Text>
              ) : null}
            </View>

            <Text
              style={{
                color:
                  T.accent,
                fontSize:
                  F.base - 2,
                fontWeight:
                  '800',
                marginTop:
                  8,
              }}
            >
              {livePhase ===
                'preparing'
                ? audioUi.livePreparing
                : livePhase ===
                    'finalizing'
                  ? audioUi.liveFinalizing
                  : audioUi.liveListening}
            </Text>

            <Text
              style={[
                styles.liveSectionTitle,
                {
                  color:
                    T.textPrimary,
                  fontSize:
                    F.base - 1,
                },
              ]}
            >
              {audioUi.liveSource}
            </Text>

            <Text
              selectable
              style={{
                color:
                  T.textSecondary,
                fontSize:
                  F.base,
                lineHeight:
                  24,
              }}
            >
              {liveText ||
                audioUi.liveWaiting}
            </Text>

            <Text
              style={[
                styles.liveSectionTitle,
                {
                  color:
                    T.textPrimary,
                  fontSize:
                    F.base - 1,
                },
              ]}
            >
              {audioUi.liveTranslation} · {
                translationTarget ===
                  'uk'
                  ? audioUi.ukrainian
                  : audioUi.russian
              }
            </Text>

            <Text
              selectable
              style={{
                color:
                  T.textSecondary,
                fontSize:
                  F.base,
                lineHeight:
                  24,
              }}
            >
              {liveTranslation ||
                (
                  liveTranslatorRef.current
                    ? audioUi.liveWaiting
                    : windowsTranslationInfo
                )}
            </Text>
          </View>
        ) : null}

        <Pressable
          disabled={
            busy ||
            status.isRecording
          }
          onPress={
            handleImport
          }
          style={[
            styles.importButton,
            {
              borderColor:
                T.accent,
              opacity:
                busy ||
                status.isRecording
                  ? 0.45
                  : 1,
            },
          ]}
        >
          <Text
            style={{
              color:
                T.accent,
              fontWeight:
                '900',
              fontSize:
                F.base,
            }}
          >
            {audioUi.importAudio}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.hint,
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

        {message ? (
          <Text
            style={[
              styles.message,
              {
                color:
                  T.textSecondary,
                fontSize:
                  F.base - 2,
              },
            ]}
          >
            {message}
          </Text>
        ) : null}
      </View>

      <View
        style={
          styles.libraryHeader
        }
      >
        <Text
          style={{
            color:
              T.textPrimary,
            fontSize:
              F.base + 4,
            fontWeight:
              '900',
          }}
        >
          {audioUi.savedLectures}
        </Text>

        <Text
          style={{
            color:
              T.textSecondary,
            fontSize:
              F.base - 1,
            fontWeight:
              '800',
          }}
        >
          {lectures.length}
        </Text>
      </View>

      {loadingLibrary ? (
        <Text
          style={{
            color:
              T.textSecondary,
            fontSize:
              F.base,
          }}
        >
          {audioUi.loading}
        </Text>
      ) : lectures.length ===
          0 ? (
        <View
          style={
            styles.card
          }
        >
          <Text
            style={{
              color:
                T.textSecondary,
              fontSize:
                F.base,
            }}
          >
            {audioUi.emptyLibrary}
          </Text>
        </View>
      ) : (
        lectures.map(
          lecture => {
            const isCurrent =
              playingLectureId ===
                lecture.id;

            const shownDuration =
              isCurrent &&
              playbackDuration >
                0
                ? playbackDuration *
                  1000
                : lecture.durationMillis;

            const currentMillis =
              isCurrent
                ? playbackCurrent *
                  1000
                : 0;

            return (
              <View
                key={
                  lecture.id
                }
                style={[
                  styles.lectureCard,
                  {
                    borderColor:
                      `${T.accent}22`,
                  },
                ]}
              >
                <View
                  style={
                    styles.lectureHeader
                  }
                >
                  <View
                    style={{
                      flex:
                        1,
                      minWidth:
                        0,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          T.textPrimary,
                        fontSize:
                          F.base + 1,
                        fontWeight:
                          '900',
                      }}
                    >
                      {lecture.title ||
                        formatDate(
                          lecture.createdAtMillis
                        ) ||
                        audioUi.savedRecording}
                    </Text>

                    <Text
                      style={{
                        color:
                          T.textSecondary,
                        fontSize:
                          F.base - 2,
                        marginTop:
                          5,
                      }}
                    >
                      {formatTime(
                        shownDuration
                      )} · {formatSize(
                        lecture.bytes
                      )} · {
                        lecture.language ===
                          'en'
                          ? '🇬🇧 EN'
                          : '🇳🇴 NO'
                      }
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.playbackBox
                  }
                >
                  <Text
                    style={{
                      color:
                        T.textSecondary,
                      fontSize:
                        F.base - 2,
                      fontWeight:
                        '800',
                    }}
                  >
                    {audioUi.playback}
                  </Text>

                  <Text
                    style={{
                      color:
                        T.textPrimary,
                      fontSize:
                        F.base - 1,
                      marginTop:
                        8,
                    }}
                  >
                    {formatTime(
                      currentMillis
                    )} / {formatTime(
                      shownDuration
                    )}
                  </Text>

                  <input
                    aria-label={
                      audioUi.playback
                    }
                    type="range"
                    min={0}
                    max={
                      Math.max(
                        0.1,
                        shownDuration /
                          1000
                      )
                    }
                    step={0.1}
                    value={
                      isCurrent
                        ? playbackCurrent
                        : 0
                    }
                    disabled={
                      !isCurrent
                    }
                    onChange={(
                      event:
                        any
                    ) =>
                      seekTo(
                        lecture.id,
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    style={{
                      width:
                        '100%',
                      marginTop:
                        10,
                      accentColor:
                        T.accent,
                    }}
                  />

                  <View
                    style={
                      styles.playbackActions
                    }
                  >
                    <Pressable
                      disabled={
                        !isCurrent
                      }
                      onPress={() =>
                        seekTo(
                          lecture.id,
                          playbackCurrent -
                            15
                        )
                      }
                      style={[
                        styles.smallButton,
                        {
                          borderColor:
                            T.accent,
                          opacity:
                            isCurrent
                              ? 1
                              : 0.4,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            T.accent,
                          fontWeight:
                            '800',
                        }}
                      >
                        {audioUi.back15Short}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        void handlePlay(
                          lecture
                        )
                      }
                      style={[
                        styles.playButton,
                        {
                          backgroundColor:
                            T.accent,
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.playButtonText
                        }
                      >
                        {isCurrent &&
                        audioRef.current &&
                        !audioRef.current
                          .paused
                          ? audioUi.pause
                          : audioUi.play}
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={
                        !isCurrent
                      }
                      onPress={() =>
                        seekTo(
                          lecture.id,
                          playbackCurrent +
                            15
                        )
                      }
                      style={[
                        styles.smallButton,
                        {
                          borderColor:
                            T.accent,
                          opacity:
                            isCurrent
                              ? 1
                              : 0.4,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            T.accent,
                          fontWeight:
                            '800',
                        }}
                      >
                        {audioUi.forward15Short}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {lecture.markers.length >
                  0 && (
                  <View
                    style={
                      styles.savedMarkers
                    }
                  >
                    <Text
                      style={{
                        color:
                          T.textSecondary,
                        fontSize:
                          F.base - 2,
                        fontWeight:
                          '800',
                      }}
                    >
                      {audioUi.markedMoments}
                    </Text>

                    <View
                      style={
                        styles.markerWrap
                      }
                    >
                      {lecture.markers.map(
                        marker => (
                          <Pressable
                            key={
                              marker.id
                            }
                            onPress={async () => {
                              if (
                                playingLectureId !==
                                  lecture.id
                              ) {
                                await handlePlay(
                                  lecture
                                );
                              }

                              window.setTimeout(
                                () =>
                                  seekTo(
                                    lecture.id,
                                    marker.timeMillis /
                                      1000
                                  ),
                                80
                              );
                            }}
                            style={[
                              styles.markerChip,
                              {
                                borderColor:
                                  T.accent,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color:
                                  T.accent,
                                fontSize:
                                  F.base - 3,
                                fontWeight:
                                  '800',
                              }}
                            >
                              {getAudioMarkerLabel(
                                marker.markerType,
                                app_language
                              )} · {formatTime(
                                marker.timeMillis
                              )}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  </View>
                )}

                {renameLectureId ===
                  lecture.id ? (
                  <View
                    style={
                      styles.renameBox
                    }
                  >
                    <TextInput
                      autoFocus
                      value={
                        renameValue
                      }
                      onChangeText={
                        setRenameValue
                      }
                      placeholder={
                        audioUi.renamePrompt
                      }
                      placeholderTextColor={
                        T.textSecondary
                      }
                      style={[
                        styles.renameInput,
                        {
                          color:
                            T.textPrimary,
                          borderColor:
                            T.accent,
                        },
                      ]}
                    />

                    <View
                      style={
                        styles.renameActions
                      }
                    >
                      <Pressable
                        onPress={() => {
                          setRenameLectureId(
                            null
                          );
                          setRenameValue(
                            ''
                          );
                        }}
                        style={[
                          styles.smallButton,
                          {
                            borderColor:
                              T.accent,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              T.accent,
                            fontWeight:
                              '800',
                          }}
                        >
                          {audioUi.cancel}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          void handleRenameSave(
                            lecture
                          )
                        }
                        style={[
                          styles.playButton,
                          {
                            backgroundColor:
                              T.accent,
                          },
                        ]}
                      >
                        <Text
                          style={
                            styles.playButtonText
                          }
                        >
                          {audioUi.save}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <View
                  style={
                    styles.managementRow
                  }
                >
                  <Pressable
                    onPress={() => {
                      setRenameLectureId(
                        lecture.id
                      );
                      setRenameValue(
                        lecture.title ||
                          ''
                      );
                    }}
                    style={[
                      styles.managementButton,
                      {
                        borderColor:
                          T.accent,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          T.accent,
                        fontWeight:
                          '900',
                        fontSize:
                          F.base - 2,
                      }}
                    >
                      ✎ {audioUi.renameLecture}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      void handleDelete(
                        lecture
                      )
                    }
                    style={[
                      styles.managementButton,
                      {
                        borderColor:
                          '#C94B4B',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          '#C94B4B',
                        fontWeight:
                          '900',
                        fontSize:
                          F.base - 2,
                      }}
                    >
                      🗑 {audioUi.delete}
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={
                    styles.nextStageBox
                  }
                >
                  <Text
                    style={{
                      color:
                        T.textSecondary,
                      fontSize:
                        F.base - 2,
                      fontWeight:
                        '800',
                    }}
                  >
                    {lecture.transcriptReady
                      ? `${audioUi.transcriptReady} · ${lecture.transcriptCharacters}`
                      : audioUi.readyForTranscription}
                  </Text>

                  {transcribingLectureId ===
                    lecture.id ? (
                    <View
                      style={
                        styles.whisperProgressBox
                      }
                    >
                      <Text
                        style={{
                          color:
                            T.accent,
                          fontSize:
                            F.base - 2,
                          fontWeight:
                            '900',
                        }}
                      >
                        {whisperProgress?.stage ===
                          'downloading-model'
                          ? `${audioUi.preparingWhisper} ${whisperProgress.percent}%`
                          : whisperProgress?.stage ===
                              'retrying'
                            ? audioUi.noTextRetrying
                            : `${audioUi.transcribingLocally.replace(
                                'на цьому iPhone',
                                'на цьому PC'
                              ).replace(
                                'this iPhone',
                                'this PC'
                              ).replace(
                                'denne iPhonen',
                                'denne PC-en'
                              )} ${whisperProgress?.percent ?? 0}%`}
                      </Text>

                      <View
                        style={[
                          styles.progressTrack,
                          {
                            backgroundColor:
                              `${T.accent}1C`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor:
                                T.accent,
                              width:
                                `${Math.max(
                                  2,
                                  Math.min(
                                    100,
                                    whisperProgress?.percent ?? 0
                                  )
                                )}%`,
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={{
                          color:
                            T.textSecondary,
                          fontSize:
                            F.base - 3,
                          marginTop:
                            8,
                        }}
                      >
                        {audioUi.processingLocally}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.transcriptActionRow
                      }
                    >
                      <Pressable
                        disabled={
                          !!transcribingLectureId ||
                          status.isRecording
                        }
                        onPress={() =>
                          void handleTranscribe(
                            lecture
                          )
                        }
                        style={[
                          styles.transcriptButton,
                          {
                            backgroundColor:
                              T.accent,
                            opacity:
                              transcribingLectureId ||
                              status.isRecording
                                ? 0.45
                                : 1,
                          },
                        ]}
                      >
                        <Text
                          style={
                            styles.transcriptButtonText
                          }
                        >
                          {lecture.transcriptReady
                            ? audioUi.retranscribe
                            : audioUi.createTranscript}
                        </Text>
                      </Pressable>

                      {lecture.transcriptReady ? (
                        <Pressable
                          onPress={() =>
                            void handleToggleTranscript(
                              lecture
                            )
                          }
                          style={[
                            styles.transcriptOutlineButton,
                            {
                              borderColor:
                                T.accent,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color:
                                T.accent,
                              fontSize:
                                F.base - 2,
                              fontWeight:
                                '900',
                            }}
                          >
                            {openedTranscriptId ===
                              lecture.id
                              ? audioUi.hideText
                              : audioUi.showText}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}

                  {openedTranscriptId ===
                    lecture.id &&
                  transcriptByLecture[
                    lecture.id
                  ] ? (
                    <View
                      style={
                        styles.transcriptPanel
                      }
                    >
                      <Text
                        style={{
                          color:
                            T.textPrimary,
                          fontSize:
                            F.base,
                          fontWeight:
                            '900',
                          marginBottom:
                            10,
                        }}
                      >
                        {lecture.language ===
                          'en'
                          ? 'English'
                          : 'Norsk'}
                      </Text>

                      {transcriptByLecture[
                        lecture.id
                      ].segments.length >
                        0 ? (
                        transcriptByLecture[
                          lecture.id
                        ].segments.map(
                          (
                            segment,
                            index
                          ) => {
                            const active =
                              playingLectureId ===
                                lecture.id &&
                              playbackCurrent >=
                                segment.start &&
                              playbackCurrent <
                                Math.max(
                                  segment.end,
                                  segment.start +
                                    0.1
                                );

                            return (
                              <Pressable
                                key={
                                  `${segment.start}-${index}`
                                }
                                onPress={() =>
                                  void handleTranscriptSeek(
                                    lecture,
                                    segment.start
                                  )
                                }
                                style={[
                                  styles.transcriptRow,
                                  {
                                    backgroundColor:
                                      active
                                        ? `${T.accent}18`
                                        : 'transparent',
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color:
                                      T.accent,
                                    fontSize:
                                      F.base - 3,
                                    fontWeight:
                                      '900',
                                    minWidth:
                                      46,
                                  }}
                                >
                                  {formatTime(
                                    segment.start *
                                      1000
                                  )}
                                </Text>

                                <Text
                                  selectable
                                  style={{
                                    color:
                                      T.textSecondary,
                                    fontSize:
                                      F.base,
                                    lineHeight:
                                      24,
                                    flex:
                                      1,
                                  }}
                                >
                                  {segment.text}
                                </Text>
                              </Pressable>
                            );
                          }
                        )
                      ) : (
                        <Text
                          selectable
                          style={{
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base,
                            lineHeight:
                              24,
                          }}
                        >
                          {transcriptByLecture[
                            lecture.id
                          ].text}
                        </Text>
                      )}
                    </View>
                  ) : null}

                  {lecture.transcriptReady ? (
                    <View
                      style={
                        styles.translationBox
                      }
                    >
                      <Text
                        style={{
                          color:
                            T.textPrimary,
                          fontSize:
                            F.base,
                          fontWeight:
                            '900',
                        }}
                      >
                        {audioUi.quickTranslation}
                      </Text>

                      <Text
                        style={{
                          color:
                            T.textSecondary,
                          fontSize:
                            F.base - 3,
                          lineHeight:
                            19,
                          marginTop:
                            5,
                        }}
                      >
                        {windowsTranslationInfo}
                      </Text>

                      <View
                        style={
                          styles.translationTargetRow
                        }
                      >
                        {(
                          [
                            ['uk', `🇺🇦 ${audioUi.ukrainian}`],
                            ['ru', `🇷🇺 ${audioUi.russian}`],
                          ] as const
                        ).map(
                          ([target, label]) => (
                            <Pressable
                              key={target}
                              disabled={
                                !!translatingKey
                              }
                              onPress={() =>
                                void handleSelectTranslationTarget(
                                  lecture,
                                  target
                                )
                              }
                              style={[
                                styles.translationTargetButton,
                                {
                                  borderColor:
                                    T.accent,
                                  backgroundColor:
                                    translationTarget ===
                                      target
                                      ? `${T.accent}18`
                                      : 'transparent',
                                  opacity:
                                    translatingKey
                                      ? 0.5
                                      : 1,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color:
                                    T.accent,
                                  fontSize:
                                    F.base - 2,
                                  fontWeight:
                                    '900',
                                }}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          )
                        )}
                      </View>

                      <Pressable
                        disabled={
                          !!translatingKey ||
                          !!transcribingLectureId ||
                          status.isRecording
                        }
                        onPress={() =>
                          void handleTranslate(
                            lecture,
                            translationTarget
                          )
                        }
                        style={[
                          styles.translationButton,
                          {
                            backgroundColor:
                              T.accent,
                            opacity:
                              translatingKey ||
                              transcribingLectureId ||
                              status.isRecording
                                ? 0.45
                                : 1,
                          },
                        ]}
                      >
                        <Text
                          style={
                            styles.transcriptButtonText
                          }
                        >
                          {translationByLecture[
                            lecture.id
                          ]?.[
                            translationTarget
                          ]
                            ? audioUi.translateAgainAccessibility
                            : audioUi.translateAccessibility}
                        </Text>
                      </Pressable>

                      {translatingKey ===
                        `${lecture.id}:${translationTarget}` ? (
                        <View
                          style={
                            styles.translationProgressBox
                          }
                        >
                          <Text
                            style={{
                              color:
                                T.accent,
                              fontSize:
                                F.base - 2,
                              fontWeight:
                                '800',
                            }}
                          >
                            {audioUi.translatingOnDevice
                              .replace(
                                'на цьому iPhone',
                                'на цьому PC'
                              )
                              .replace(
                                'this iPhone',
                                'this PC'
                              )
                              .replace(
                                'denne iPhonen',
                                'denne PC-en'
                              )} {
                                translatorProgress?.percent ??
                                0
                              }%
                          </Text>
                        </View>
                      ) : null}

                      {translationByLecture[
                        lecture.id
                      ]?.[
                        translationTarget
                      ] ? (
                        <View
                          style={
                            styles.translationPanel
                          }
                        >
                          <Text
                            style={{
                              color:
                                T.textPrimary,
                              fontSize:
                                F.base,
                              fontWeight:
                                '900',
                              marginBottom:
                                8,
                            }}
                          >
                            {translationTarget ===
                              'uk'
                              ? audioUi.ukrainian
                              : audioUi.russian}
                          </Text>

                          {translationByLecture[
                            lecture.id
                          ]?.[
                            translationTarget
                          ]?.segments.map(
                            (
                              segment,
                              index
                            ) => (
                              <Pressable
                                key={
                                  `${translationTarget}-${segment.start}-${index}`
                                }
                                onPress={() =>
                                  void handleTranscriptSeek(
                                    lecture,
                                    segment.start
                                  )
                                }
                                style={
                                  styles.transcriptRow
                                }
                              >
                                <Text
                                  style={{
                                    color:
                                      T.accent,
                                    fontSize:
                                      F.base - 3,
                                    fontWeight:
                                      '900',
                                    minWidth:
                                      46,
                                  }}
                                >
                                  {formatTime(
                                    segment.start *
                                      1000
                                  )}
                                </Text>

                                <Text
                                  selectable
                                  style={{
                                    color:
                                      T.textSecondary,
                                    fontSize:
                                      F.base,
                                    lineHeight:
                                      24,
                                    flex:
                                      1,
                                  }}
                                >
                                  {segment.text}
                                </Text>
                              </Pressable>
                            )
                          )}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }
        )
      )}

      {currentPlaying ? (
        <Text
          style={[
            styles.nowPlaying,
            {
              color:
                T.textSecondary,
              fontSize:
                F.base - 3,
            },
          ]}
        >
          {currentPlaying.title ||
            formatDate(
              currentPlaying.createdAtMillis
            )}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex:
        1,
      position:
        'relative',
      zIndex:
        20,
      backgroundColor:
        '#F5F9FC',
    },

    content: {
      width:
        '100%',
      maxWidth:
        920,
      alignSelf:
        'center',
      paddingHorizontal:
        22,
      paddingTop:
        28,
      paddingBottom:
        230,
    },

    title: {
      fontWeight:
        '900',
      marginBottom:
        16,
    },

    card: {
      width:
        '100%',
      borderRadius:
        24,
      borderWidth:
        1,
      padding:
        22,
      backgroundColor:
        '#FFFFFF',
    },

    sourceLanguageRow: {
      flexDirection:
        'row',
      gap:
        10,
      marginBottom:
        18,
    },

    languageButton: {
      flex:
        1,
      minHeight:
        48,
      borderRadius:
        14,
      borderWidth:
        1.5,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    info: {
      lineHeight:
        23,
    },

    recordingLabel: {
      fontWeight:
        '900',
      textAlign:
        'center',
      marginTop:
        8,
    },

    timer: {
      fontSize:
        42,
      fontWeight:
        '900',
      textAlign:
        'center',
      marginTop:
        10,
      marginBottom:
        10,
    },

    markerBox: {
      marginTop:
        14,
      paddingTop:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.18)',
    },

    markerTitle: {
      fontWeight:
        '800',
      marginBottom:
        10,
    },

    markerTypeRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
    },

    markerTypeButton: {
      borderWidth:
        1,
      borderRadius:
        999,
      paddingHorizontal:
        10,
      paddingVertical:
        7,
    },

    outlineButton: {
      minHeight:
        48,
      borderWidth:
        1.5,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        12,
      paddingHorizontal:
        12,
    },

    actionRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        12,
      marginTop:
        22,
    },

    mainButton: {
      flexGrow:
        1,
      flexBasis:
        260,
      minHeight:
        58,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        14,
    },

    liveButton: {
      flexGrow:
        1,
      flexBasis:
        180,
      minHeight:
        58,
      borderRadius:
        16,
      borderWidth:
        1.5,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        14,
    },

    mainButtonText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
      fontSize:
        17,
    },

    importButton: {
      minHeight:
        52,
      borderWidth:
        1.5,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        12,
    },

    hint: {
      textAlign:
        'center',
      marginTop:
        8,
    },

    message: {
      marginTop:
        12,
      lineHeight:
        20,
    },

    libraryHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginTop:
        28,
      marginBottom:
        12,
      paddingHorizontal:
        2,
    },

    lectureCard: {
      width:
        '100%',
      borderRadius:
        22,
      borderWidth:
        1,
      padding:
        18,
      backgroundColor:
        '#FFFFFF',
      marginBottom:
        14,
    },

    lectureHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        12,
    },

    playbackBox: {
      marginTop:
        16,
      paddingTop:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.16)',
    },

    playbackActions: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        10,
      alignItems:
        'center',
    },

    smallButton: {
      minHeight:
        42,
      borderWidth:
        1.2,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
    },

    playButton: {
      minHeight:
        44,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        18,
    },

    playButtonText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
    },

    savedMarkers: {
      marginTop:
        16,
    },

    markerWrap: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        8,
    },

    markerChip: {
      borderWidth:
        1,
      borderRadius:
        999,
      paddingHorizontal:
        10,
      paddingVertical:
        7,
    },

    renameBox: {
      marginTop:
        16,
    },

    renameInput: {
      minHeight:
        48,
      borderWidth:
        1.3,
      borderRadius:
        12,
      paddingHorizontal:
        12,
      fontSize:
        16,
      backgroundColor:
        '#FFFFFF',
    },

    renameActions: {
      flexDirection:
        'row',
      gap:
        8,
      marginTop:
        8,
    },

    managementRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        10,
      marginTop:
        16,
    },

    managementButton: {
      flexGrow:
        1,
      flexBasis:
        190,
      minHeight:
        46,
      borderWidth:
        1.2,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
    },

    nextStageBox: {
      marginTop:
        14,
      paddingTop:
        12,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.14)',
    },

    whisperProgressBox: {
      marginTop:
        12,
    },

    progressTrack: {
      width:
        '100%',
      height:
        8,
      borderRadius:
        999,
      overflow:
        'hidden',
      marginTop:
        10,
    },

    progressFill: {
      height:
        '100%',
      borderRadius:
        999,
    },

    transcriptActionRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        12,
    },

    transcriptButton: {
      flexGrow:
        1,
      flexBasis:
        210,
      minHeight:
        46,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
    },

    transcriptButtonText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
      fontSize:
        15,
      textAlign:
        'center',
    },

    transcriptOutlineButton: {
      flexGrow:
        1,
      flexBasis:
        150,
      minHeight:
        46,
      borderWidth:
        1.2,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
    },

    transcriptPanel: {
      marginTop:
        14,
      paddingTop:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.14)',
    },

    transcriptRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap:
        10,
      paddingVertical:
        8,
      paddingHorizontal:
        8,
      borderRadius:
        10,
    },

    liveTargetRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        18,
    },

    liveTargetButton: {
      flexGrow:
        1,
      flexBasis:
        150,
      minHeight:
        42,
      borderWidth:
        1.2,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
    },

    livePanel: {
      marginTop:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.14)',
      paddingTop:
        14,
    },

    liveHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        10,
    },

    liveSectionTitle: {
      fontWeight:
        '900',
      marginTop:
        16,
      marginBottom:
        6,
    },

    translationBox: {
      marginTop:
        18,
      paddingTop:
        16,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.14)',
    },

    translationTargetRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        12,
    },

    translationTargetButton: {
      flexGrow:
        1,
      flexBasis:
        150,
      minHeight:
        42,
      borderWidth:
        1.2,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
    },

    translationButton: {
      minHeight:
        48,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        10,
      paddingHorizontal:
        12,
    },

    translationProgressBox: {
      marginTop:
        10,
    },

    translationPanel: {
      marginTop:
        14,
      paddingTop:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        'rgba(127,127,127,0.14)',
    },

    nowPlaying: {
      textAlign:
        'center',
      marginTop:
        8,
    },
  });

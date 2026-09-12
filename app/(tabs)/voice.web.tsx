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

  const pollRef =
    useRef<
      ReturnType<typeof setInterval> | null
    >(null);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
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
      };
    },
    [
      refreshLibrary,
      stopPlayback,
      stopPolling,
    ]
  );

  const handleRecording =
    async () => {
      if (busy) {
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
            styles.actionRow
          }
        >
          <Pressable
            disabled={busy}
            onPress={
              handleRecording
            }
            style={[
              styles.mainButton,
              {
                backgroundColor:
                  status.isRecording
                    ? '#C94B4B'
                    : T.accent,
                opacity:
                  busy
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
              {status.isRecording
                ? audioUi.stopRecording
                : audioUi.startRecording}
            </Text>
          </Pressable>

          <Pressable
            disabled
            style={[
              styles.liveButton,
              {
                borderColor:
                  T.accent,
                opacity:
                  0.45,
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
              ● {audioUi.live}
            </Text>
          </Pressable>
        </View>

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

    nowPlaying: {
      textAlign:
        'center',
      marginTop:
        8,
    },
  });

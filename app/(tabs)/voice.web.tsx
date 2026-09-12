import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  convertFileSrc,
  invoke,
} from '@tauri-apps/api/core';

type RecordingStatus = {
  isRecording: boolean;
  elapsedMillis: number;
  path: string | null;
  bytes: number;
  sampleRate: number;
  channels: number;
  error: string | null;
};

type WindowsRecording = {
  id: string;
  path: string;
  fileName: string;
  bytes: number;
  durationMillis: number;
  sampleRate: number;
  channels: number;
  createdAtMillis: number;
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
  const totalSeconds =
    Math.max(
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

  return `${
    (bytes / (1024 * 1024)).toFixed(1)
  } MB`;
}

function formatDate(milliseconds: number) {
  if (!milliseconds) {
    return 'Opptak';
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

export default function WindowsVoiceScreen() {
  const [
    status,
    setStatus,
  ] =
    useState<RecordingStatus>(
      EMPTY_STATUS
    );

  const [
    recordings,
    setRecordings,
  ] =
    useState<WindowsRecording[]>([]);

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
    playingId,
    setPlayingId,
  ] =
    useState<string | null>(null);

  const [
    sourceLanguage,
    setSourceLanguage,
  ] =
    useState<'NO' | 'EN'>('NO');

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(null);

  const pollRef =
    useRef<
      ReturnType<typeof setInterval> | null
    >(null);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const stopPolling =
    useCallback(
      () => {
        if (pollRef.current) {
          clearInterval(
            pollRef.current
          );

          pollRef.current = null;
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
              WindowsRecording[]
            >(
              'list_recordings'
            );

          setRecordings(items);
        }
        catch (error) {
          console.error(
            'Could not load recordings:',
            error
          );

          setMessage(
            String(error)
          );
        }
        finally {
          setLoadingLibrary(false);
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

        audioRef.current = null;
        setPlayingId(null);
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

                setStatus(next);

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
      refreshLibrary();

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
          setStatus(stopped);

          await refreshLibrary();

          setMessage(
            'Opptaket er lagret.'
          );

          return;
        }

        stopPlayback();

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
            isRecording: false,
            error: text,
          })
        );

        stopPolling();
      }
      finally {
        setBusy(false);
      }
    };

  const handlePlay =
    async (
      recording:
        WindowsRecording
    ) => {
      if (
        playingId ===
          recording.id
      ) {
        stopPlayback();
        return;
      }

      stopPlayback();

      try {
        const url =
          convertFileSrc(
            recording.path
          );

        const audio =
          new Audio(url);

        audioRef.current =
          audio;

        audio.onended =
          () => {
            if (
              audioRef.current ===
                audio
            ) {
              audioRef.current =
                null;

              setPlayingId(null);
            }
          };

        audio.onerror =
          () => {
            console.error(
              'Audio playback failed:',
              recording.path
            );

            if (
              audioRef.current ===
                audio
            ) {
              audioRef.current =
                null;
            }

            setPlayingId(null);

            setMessage(
              'Kunne ikke spille av opptaket.'
            );
          };

        await audio.play();

        setPlayingId(
          recording.id
        );

        setMessage(null);
      }
      catch (error) {
        console.error(
          'Playback error:',
          error
        );

        stopPlayback();

        setMessage(
          `Avspillingsfeil: ${
            String(error)
          }`
        );
      }
    };

  return (
    <ScrollView
      contentContainerStyle={
        styles.page
      }
    >
      <View
        style={styles.hero}
      >
        <Text
          style={styles.title}
        >
          🎙 Lydopptak
        </Text>

        <View
          style={
            styles.languageRow
          }
        >
          <Pressable
            style={[
              styles.languageButton,
              sourceLanguage ===
                'NO' &&
                styles.languageActive,
            ]}
            onPress={() =>
              setSourceLanguage(
                'NO'
              )
            }
          >
            <Text
              style={[
                styles.languageText,
                sourceLanguage ===
                  'NO' &&
                  styles.languageTextActive,
              ]}
            >
              🇳🇴 NO
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.languageButton,
              sourceLanguage ===
                'EN' &&
                styles.languageActive,
            ]}
            onPress={() =>
              setSourceLanguage(
                'EN'
              )
            }
          >
            <Text
              style={[
                styles.languageText,
                sourceLanguage ===
                  'EN' &&
                  styles.languageTextActive,
              ]}
            >
              🇬🇧 EN
            </Text>
          </Pressable>
        </View>

        <Text
          style={styles.description}
        >
          Tar opp lyden som spilles av
          på PC-en. Fungerer både med
          høyttalere og hodetelefoner.
        </Text>

        {status.isRecording ? (
          <Text
            style={styles.timer}
          >
            {formatTime(
              status.elapsedMillis
            )}
          </Text>
        ) : null}

        <View
          style={styles.actions}
        >
          <Pressable
            disabled={busy}
            style={[
              styles.recordButton,
              status.isRecording &&
                styles.stopButton,
              busy &&
                styles.disabled,
            ]}
            onPress={
              handleRecording
            }
          >
            <Text
              style={
                styles.recordButtonText
              }
            >
              {busy
                ? 'Vent...'
                : status.isRecording
                  ? 'Stopp'
                  : 'Start opptak'}
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.liveButton
            }
            onPress={() =>
              setMessage(
                'Live-transkripsjon kobles til etter at vanlig opptak og avspilling er ferdig testet.'
              )
            }
          >
            <Text
              style={
                styles.liveButtonText
              }
            >
              ● Live
            </Text>
          </Pressable>
        </View>

        {message ? (
          <Text
            style={styles.message}
          >
            {message}
          </Text>
        ) : null}
      </View>

      <View
        style={styles.libraryHeader}
      >
        <Text
          style={
            styles.libraryTitle
          }
        >
          Opptak
        </Text>

        <Text
          style={
            styles.libraryCount
          }
        >
          {recordings.length}
        </Text>
      </View>

      {loadingLibrary ? (
        <Text
          style={styles.emptyText}
        >
          Laster opptak...
        </Text>
      ) : recordings.length ===
          0 ? (
        <View
          style={styles.emptyCard}
        >
          <Text
            style={styles.emptyText}
          >
            Ingen opptak ennå.
          </Text>
        </View>
      ) : (
        recordings.map(
          recording => {
            const playing =
              playingId ===
              recording.id;

            return (
              <View
                key={
                  recording.id
                }
                style={
                  styles.recordingCard
                }
              >
                <View
                  style={
                    styles.recordingTop
                  }
                >
                  <View
                    style={
                      styles.recordingInfo
                    }
                  >
                    <Text
                      style={
                        styles.recordingTitle
                      }
                    >
                      {formatDate(
                        recording.createdAtMillis
                      )}
                    </Text>

                    <Text
                      style={
                        styles.recordingMeta
                      }
                    >
                      {formatTime(
                        recording.durationMillis
                      )}
                      {'  •  '}
                      {formatSize(
                        recording.bytes
                      )}
                    </Text>
                  </View>

                  <Pressable
                    style={
                      styles.playButton
                    }
                    onPress={() =>
                      handlePlay(
                        recording
                      )
                    }
                  >
                    <Text
                      style={
                        styles.playButtonText
                      }
                    >
                      {playing
                        ? '❚❚'
                        : '▶'}
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={
                    styles.audioMeta
                  }
                >
                  {
                    recording.sampleRate
                  } Hz · {
                    recording.channels
                  } ch
                </Text>
              </View>
            );
          }
        )
      )}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 135,
      backgroundColor:
        '#f7fbff',
    },

    hero: {
      backgroundColor:
        '#ffffff',
      borderRadius: 32,
      padding: 28,
    },

    title: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '900',
      color: '#101014',
      marginBottom: 22,
    },

    languageRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },

    languageButton: {
      flex: 1,
      minHeight: 54,
      borderRadius: 27,
      borderWidth: 2,
      borderColor: '#087cff',
      alignItems: 'center',
      justifyContent: 'center',
    },

    languageActive: {
      backgroundColor:
        '#087cff',
    },

    languageText: {
      fontSize: 17,
      fontWeight: '800',
      color: '#087cff',
    },

    languageTextActive: {
      color: '#ffffff',
    },

    description: {
      fontSize: 18,
      lineHeight: 28,
      color: '#4f4f58',
    },

    timer: {
      marginTop: 22,
      textAlign: 'center',
      fontSize: 42,
      lineHeight: 48,
      fontWeight: '900',
      color: '#087cff',
    },

    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 28,
    },

    recordButton: {
      flex: 1,
      minHeight: 74,
      borderRadius: 24,
      backgroundColor:
        '#087cff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    stopButton: {
      backgroundColor:
        '#d63c3c',
    },

    disabled: {
      opacity: 0.55,
    },

    recordButtonText: {
      textAlign: 'center',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '900',
      color: '#ffffff',
    },

    liveButton: {
      flex: 1,
      minHeight: 74,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: '#087cff',
      backgroundColor:
        '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    liveButtonText: {
      fontSize: 19,
      fontWeight: '900',
      color: '#087cff',
    },

    message: {
      marginTop: 18,
      fontSize: 14,
      lineHeight: 21,
      color: '#5b5b64',
    },

    libraryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 28,
      marginBottom: 12,
      paddingHorizontal: 4,
    },

    libraryTitle: {
      fontSize: 25,
      fontWeight: '900',
      color: '#101014',
    },

    libraryCount: {
      fontSize: 16,
      fontWeight: '800',
      color: '#8a8a93',
    },

    recordingCard: {
      backgroundColor:
        '#ffffff',
      borderRadius: 24,
      padding: 20,
      marginBottom: 12,
    },

    recordingTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },

    recordingInfo: {
      flex: 1,
    },

    recordingTitle: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '800',
      color: '#16161a',
    },

    recordingMeta: {
      marginTop: 5,
      fontSize: 14,
      color: '#696971',
    },

    audioMeta: {
      marginTop: 12,
      fontSize: 12,
      color: '#92929a',
    },

    playButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#087cff',
      alignItems: 'center',
      justifyContent: 'center',
    },

    playButtonText: {
      fontSize: 20,
      fontWeight: '900',
      color: '#ffffff',
    },

    emptyCard: {
      backgroundColor:
        '#ffffff',
      borderRadius: 24,
      padding: 24,
    },

    emptyText: {
      fontSize: 16,
      lineHeight: 23,
      color: '#777780',
    },
  });
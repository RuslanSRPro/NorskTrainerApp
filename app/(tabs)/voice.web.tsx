import {
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

import { invoke } from '@tauri-apps/api/core';

type RecordingStatus = {
  isRecording: boolean;
  elapsedMillis: number;
  path: string | null;
  bytes: number;
  sampleRate: number;
  channels: number;
  error: string | null;
};

function formatTime(milliseconds: number) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(milliseconds / 1000)
    );

  const minutes =
    Math.floor(totalSeconds / 60);

  const seconds =
    totalSeconds % 60;

  return [
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

export default function WindowsVoiceScreen() {
  const [
    status,
    setStatus,
  ] =
    useState<RecordingStatus>({
      isRecording: false,
      elapsedMillis: 0,
      path: null,
      bytes: 0,
      sampleRate: 0,
      channels: 0,
      error: null,
    });

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState(
      'Ready to record with the Windows microphone.'
    );

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();

    timerRef.current =
      setInterval(
        async () => {
          try {
            const next =
              await invoke<RecordingStatus>(
                'get_recording_status'
              );

            setStatus(next);

            if (!next.isRecording) {
              stopPolling();
            }
          } catch (error) {
            console.error(
              'Recording status error:',
              error
            );
          }
        },
        250
      );
  };

  useEffect(
    () => {
      return () => {
        stopPolling();
      };
    },
    []
  );

  const handleRecording = async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      if (status.isRecording) {
        const stopped =
          await invoke<RecordingStatus>(
            'stop_recording'
          );

        stopPolling();
        setStatus(stopped);

        setMessage(
          stopped.path
            ? `Saved: ${stopped.path}`
            : 'Recording stopped.'
        );

        return;
      }

      setMessage(
        'Starting Windows microphone...'
      );

      const started =
        await invoke<RecordingStatus>(
          'start_recording'
        );

      setStatus(started);

      setMessage(
        'Recording from Windows microphone.'
      );

      startPolling();

    } catch (error) {
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

    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.page}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          🎙 Audio
        </Text>

        <Text style={styles.badge}>
          Windows
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          Lecture recording
        </Text>

        <Text style={styles.timer}>
          {formatTime(
            status.elapsedMillis
          )}
        </Text>

        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            style={[
              styles.primaryButton,
              status.isRecording &&
                styles.stopButton,
              busy &&
                styles.disabledButton,
            ]}
            onPress={handleRecording}
          >
            <Text style={styles.primaryText}>
              {busy
                ? 'Please wait...'
                : status.isRecording
                  ? 'Stop'
                  : 'Start recording'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setMessage(
                'Live transcription will be connected after microphone recording is verified.'
              )
            }
          >
            <Text style={styles.secondaryText}>
              ● Live
            </Text>
          </Pressable>
        </View>

        <Text style={styles.status}>
          {message}
        </Text>

        {status.path ? (
          <View style={styles.details}>
            <Text style={styles.detail}>
              File: {status.path}
            </Text>

            <Text style={styles.detail}>
              Size: {status.bytes} bytes
            </Text>

            <Text style={styles.detail}>
              Audio: {status.sampleRate} Hz · {status.channels} ch
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 28,
    paddingBottom: 130,
    backgroundColor: '#f7fbff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#101014',
  },

  badge: {
    fontSize: 15,
    fontWeight: '800',
    color: '#147cff',
  },

  card: {
    padding: 28,
    borderRadius: 34,
    backgroundColor: '#ffffff',
  },

  heading: {
    fontSize: 25,
    fontWeight: '900',
    color: '#101014',
  },

  timer: {
    marginTop: 22,
    fontSize: 48,
    fontWeight: '800',
    color: '#101014',
  },

  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 28,
  },

  primaryButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#087cff',
  },

  stopButton: {
    backgroundColor: '#d93636',
  },

  disabledButton: {
    opacity: 0.55,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#087cff',
    backgroundColor: '#ffffff',
  },

  primaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },

  secondaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#087cff',
  },

  status: {
    marginTop: 24,
    fontSize: 16,
    lineHeight: 24,
    color: '#55555e',
  },

  details: {
    marginTop: 18,
    gap: 6,
  },

  detail: {
    fontSize: 13,
    lineHeight: 20,
    color: '#777780',
  },
});
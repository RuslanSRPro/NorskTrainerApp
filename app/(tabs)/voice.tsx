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
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import {
  strToU8,
  zipSync,
} from 'fflate';

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

import LectureRecorder, {
  type LectureRecorderResult,
  type LectureRecorderStatus,
} from '@/modules/lecturerecorder';

import WhisperKitLocal, {
  WHISPERKIT_DEFAULT_MODEL,
  type WhisperProgressEvent,
  type WhisperSegment,
} from '@/modules/whisperkitlocal';


import OfflineTranslator, {
  type TranslationLanguageCode,
} from '@/modules/offlinetranslator';


const CHUNK_SECONDS = 5 * 60;

const WHISPER_KEEP_AWAKE_TAG =
  'lecture-whisper-transcription';

const TRANSLATION_KEEP_AWAKE_TAG =
  'lecture-mlkit-translation';

const TRANSLATION_CHUNK_MAX_CHARS =
  1200;


type TranslationTarget =
  Extract<
    TranslationLanguageCode,
    'uk' | 'ru'
  >;


function getTranslationFileName(
  target: TranslationTarget
) {
  return `translation-${target}.txt`;
}


function splitTextForTranslation(
  rawText: string,
  maxChars =
    TRANSLATION_CHUNK_MAX_CHARS
) {

  const text =
    rawText
      .replace(
        /\r\n/g,
        '\n'
      )
      .replace(
        /[ \t]+/g,
        ' '
      )
      .trim();

  if (!text) {
    return [];
  }

  if (
    text.length <=
    maxChars
  ) {
    return [text];
  }

  const sentenceCandidates =
    text.match(
      /[^.!?…]+(?:[.!?…]+|$)/g
    ) ??
    [text];

  const pieces: string[] = [];

  for (
    const rawSentence
    of sentenceCandidates
  ) {

    const sentence =
      rawSentence.trim();

    if (!sentence) {
      continue;
    }

    if (
      sentence.length <=
      maxChars
    ) {
      pieces.push(
        sentence
      );
      continue;
    }

    const words =
      sentence.split(
        /\s+/
      );

    let wordChunk =
      '';

    for (
      const word
      of words
    ) {

      const candidate =
        wordChunk
          ? `${wordChunk} ${word}`
          : word;

      if (
        candidate.length >
          maxChars &&
        wordChunk
      ) {
        pieces.push(
          wordChunk
        );
        wordChunk =
          word;
      } else {
        wordChunk =
          candidate;
      }
    }

    if (wordChunk) {
      pieces.push(
        wordChunk
      );
    }
  }

  const chunks: string[] = [];
  let current =
    '';

  for (
    const piece
    of pieces
  ) {

    const candidate =
      current
        ? `${current} ${piece}`
        : piece;

    if (
      candidate.length >
        maxChars &&
      current
    ) {
      chunks.push(
        current
      );
      current =
        piece;
    } else {
      current =
        candidate;
    }
  }

  if (current) {
    chunks.push(
      current
    );
  }

  return chunks;
}


type TranscriptionChunk = {
  index: number;
  fromSeconds: number;
  toSeconds: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  textFile?: string | null;
  error?: string | null;
};


type LectureTranscription = {
  /*
   * "cloud-chunks" is kept only so old saved session.json
   * files remain readable. New transcriptions are local.
   */
  mode:
    | 'whisperkit-local'
    | 'cloud-chunks';
  status:
    | 'not_started'
    | 'pending'
    | 'uploading'
    | 'processing'
    | 'done'
    | 'error';
  chunkSeconds: number;
  processedUntilSeconds: number;
  chunks: TranscriptionChunk[];
  error?: string | null;
};


type LectureMarkerType =
  | 'important'
  | 'unclear'
  | 'repeat'
  | 'term';


type LectureMarker = {
  id: string;
  timeMillis: number;
  type: LectureMarkerType;
  note: string;
  createdAt: string;
};


type SavedTranscriptSegment = {
  start: number;
  end: number;
  text: string;
};


type LectureMetadata = {
  id?: string;
  createdAt?: string | null;
  durationMillis?: number;
  language?: string;
  audioFile?: string | null;
  transcriptFile?: string | null;
  transcriptReady?: boolean;
  characters?: number;
  audioBytes?: number;
  source?: 'recorded' | 'imported';
  originalFileName?: string | null;
  transcription?: LectureTranscription;
};


type LectureItem = {
  id: string;
  createdAt: string | null;
  durationMillis: number;
  language: string;
  audioUri: string;
  audioFileName: string;
  transcriptUri: string | null;
  transcriptReady: boolean;
  characters: number;
  audioBytes: number;
  transcription: LectureTranscription;
  markers: LectureMarker[];
  transcriptSegments: SavedTranscriptSegment[];
};


type ActiveRecording = {
  id: string;
  createdAt: string;
  directory: Directory;
  audioFile: File;
};


function safeFileStem(
  value: string
) {

  return value
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .replace(
      /^-|-$/g,
      ''
    ) ||
    'lecture';
}


function isMeaningfulTranscriptText(
  value: string
) {

  const text =
    String(
      value || ''
    ).trim();

  if (!text) {
    return false;
  }

  /*
   * Keep a segment only if it contains at least one
   * Unicode letter or number. This removes Whisper
   * artefacts such as "-", "..." and other punctuation-
   * only segments without deleting real Norwegian text.
   */
  return /[\p{L}\p{N}]/u.test(
    text
  );
}


function buildTimestampText(
  segments:
    SavedTranscriptSegment[]
) {

  return segments
    .map(
      segment =>
        `${formatPlaybackTime(
          segment.start
        )}–${formatPlaybackTime(
          segment.end
        )}  ${segment.text}`
    )
    .join(
      '\n\n'
    )
    .trim();
}


function normalizeMicDb(
  rawDb: number | undefined
) {

  const db =
    Number.isFinite(rawDb)
      ? Number(rawDb)
      : -160;

  /*
   * For the compact UI meter we map -60...0 dBFS
   * to 0...1. Values below -60 are treated as silence.
   */
  return Math.min(
    1,
    Math.max(
      0,
      (db + 60) / 60
    )
  );
}


function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

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


function formatPlaybackTime(seconds: number) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '00:00';
  }

  return formatTime(seconds * 1000);
}


function formatLectureDate(value: string | null) {
  if (!value) {
    return 'Saved lecture';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Saved lecture';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}


function getImportedAudioExtension(
  fileName: string
) {

  const extension =
    fileName
      .split('.')
      .pop()
      ?.toLowerCase()
      .trim() ??
    '';

  const supported =
    new Set([
      'm4a',
      'mp3',
      'wav',
      'aac',
      'caf',
      'mp4',
      'mpeg',
      'mpga',
    ]);

  return supported.has(
    extension
  )
    ? extension
    : null;
}


function getLectureDirectory(id: string) {
  return new Directory(
    Paths.document,
    'lectures',
    id
  );
}


function createChunkPlan(
  durationMillis: number
): LectureTranscription {

  const totalSeconds = Math.max(
    1,
    Math.ceil(durationMillis / 1000)
  );

  const chunks: TranscriptionChunk[] = [];

  let fromSeconds = 0;
  let index = 0;

  while (fromSeconds < totalSeconds) {

    const toSeconds = Math.min(
      fromSeconds + CHUNK_SECONDS,
      totalSeconds
    );

    chunks.push({
      index,
      fromSeconds,
      toSeconds,
      status: 'pending',
      textFile: null,
      error: null,
    });

    fromSeconds = toSeconds;
    index += 1;
  }

  return {
    mode: 'whisperkit-local',
    status: 'not_started',
    chunkSeconds: CHUNK_SECONDS,
    processedUntilSeconds: 0,
    chunks,
    error: null,
  };
}


function getDefaultTranscription(
  durationMillis: number
) {
  return createChunkPlan(durationMillis);
}


function readJsonArray<T>(
  file: File
): T[] {

  if (!file.exists) {
    return [];
  }

  try {
    const value =
      JSON.parse(
        file.textSync()
      );

    return Array.isArray(value)
      ? value as T[]
      : [];
  } catch {
    return [];
  }
}


function writeJsonArray<T>(
  file: File,
  value: T[]
) {

  file.create({
    overwrite: true,
    intermediates: true,
  });

  file.write(
    JSON.stringify(
      value,
      null,
      2
    )
  );
}


function readLectureMarkers(
  directory: Directory
): LectureMarker[] {

  const file =
    new File(
      directory,
      'markers.json'
    );

  return readJsonArray<LectureMarker>(
    file
  )
    .filter(
      marker =>
        Number.isFinite(
          marker.timeMillis
        ) &&
        marker.timeMillis >= 0 &&
        typeof marker.type ===
          'string'
    )
    .sort(
      (a, b) =>
        a.timeMillis -
        b.timeMillis
    );
}


function writeLectureMarkers(
  directory: Directory,
  markers: LectureMarker[]
) {

  writeJsonArray(
    new File(
      directory,
      'markers.json'
    ),
    markers
  );
}


function readTranscriptSegments(
  directory: Directory
): SavedTranscriptSegment[] {

  const file =
    new File(
      directory,
      'transcript-segments.json'
    );

  return readJsonArray<SavedTranscriptSegment>(
    file
  )
    .map(
      segment => ({
        start:
          Number(
            segment.start
          ),
        end:
          Number(
            segment.end
          ),
        text:
          String(
            segment.text || ''
          ).trim(),
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
        a.start -
        b.start
    );
}


function markerLabel(
  type: LectureMarkerType
) {

  switch (type) {

  case 'important':
    return '⭐ Important';

  case 'unclear':
    return '❓ Unclear';

  case 'repeat':
    return '🔁 Repeat';

  case 'term':
    return '🆕 New term';

  default:
    return '⭐ Important';
  }
}


function readMetadata(
  directory: Directory
): LectureMetadata {

  const metadataFile =
    new File(
      directory,
      'session.json'
    );

  if (!metadataFile.exists) {
    return {};
  }

  try {
    return JSON.parse(
      metadataFile.textSync()
    ) as LectureMetadata;
  } catch {
    return {};
  }
}


function writeMetadata(
  directory: Directory,
  metadata: LectureMetadata
) {

  const metadataFile =
    new File(
      directory,
      'session.json'
    );

  metadataFile.create({
    overwrite: true,
    intermediates: true,
  });

  metadataFile.write(
    JSON.stringify(
      metadata,
      null,
      2
    )
  );
}


function findAudioFile(
  directory: Directory,
  metadata: LectureMetadata
) {

  const candidates = [
    metadata.audioFile,
    'audio.m4a',
    'audio.mp3',
    'audio.wav',
    'audio.aac',
    'audio.caf',
    'audio.mp4',
    'audio.mpeg',
    'audio.mpga',
  ].filter(
    (value): value is string =>
      !!value
  );

  for (const name of candidates) {

    const file =
      new File(
        directory,
        name
      );

    if (file.exists) {
      return {
        file,
        name,
      };
    }
  }

  return null;
}


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

            console.log(
              'LECTURE APP STATE',
              {
                nextState,
                ...nativeStatus,
              }
            );

          } catch (error) {

            console.warn(
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

          console.warn(
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
    translationTarget,
    setTranslationTarget,
  ] =
    useState<TranslationTarget>(
      'uk'
    );

  const [
    translatingLectureId,
    setTranslatingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    openedTranslation,
    setOpenedTranslation,
  ] =
    useState('');

  const [
    translationError,
    setTranslationError,
  ] =
    useState<string | null>(
      null
    );

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
    exportLectureId,
    setExportLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    exportingLectureId,
    setExportingLectureId,
  ] =
    useState<string | null>(
      null
    );

  /*
   * Prevent Start and Stop from overlapping when
   * the user taps the recording button repeatedly.
   */
  const recordingActionPendingRef =
    useRef(false);

  const [
    transcribingLectureId,
    setTranscribingLectureId,
  ] =
    useState<string | null>(null);

  const [
    whisperStage,
    setWhisperStage,
  ] =
    useState<string>('');

  const [
    liveTranscript,
    setLiveTranscript,
  ] =
    useState('');

  const [
    transcriptionError,
    setTranscriptionError,
  ] =
    useState<string | null>(null);


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

      console.error(
        'Could not load saved lectures:',
        error
      );
    }
  };


  useEffect(() => {
    loadLectures();
  }, []);

  useEffect(() => {

    const subscription =
      WhisperKitLocal.addListener(
        'onProgress',
        (
          event:
            WhisperProgressEvent
        ) => {

          setWhisperStage(
            event.stage
          );

          if (
            event.text &&
            event.text.trim()
          ) {

            setLiveTranscript(
              event.text.trim()
            );
          }
        }
      );

    return () => {
      subscription.remove();
    };

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
              console.error(
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

      console.error(
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
        console.log(
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
          transcribingLectureId ||
          translatingLectureId
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
              console.warn(
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

        console.error(
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
            console.error(
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
          console.log(
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
          console.log(
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

        console.error(
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
        transcribingLectureId ||
        translatingLectureId
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

        console.error(
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

                  console.error(
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

        console.error(
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

        console.error(
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

        console.error(
          'Playback seek error:',
          error
        );
      }
    };


  const handleSeekFraction =
    async (
      fraction: number
    ) => {

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

        console.error(
          'Playback seek error:',
          error
        );
      }
    };


  const loadSavedTranslation =
    (
      lecture: LectureItem,
      target:
        TranslationTarget
    ) => {

      try {

        const directory =
          getLectureDirectory(
            lecture.id
          );

        const translationFile =
          new File(
            directory,
            getTranslationFileName(
              target
            )
          );

        if (
          translationFile.exists
        ) {

          const translation =
            translationFile
              .textSync()
              .trim();

          setOpenedTranslation(
            translation
          );

          return;
        }

      } catch (error) {

        console.warn(
          'Could not load saved translation:',
          error
        );
      }

      setOpenedTranslation(
        ''
      );
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

        setOpenedTranslation(
          ''
        );

        setOpenedTranscriptSegments(
          []
        );

        setTranslationError(
          null
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

        setTranslationError(
          null
        );

        loadSavedTranslation(
          lecture,
          translationTarget
        );

      } catch (error) {

        console.error(
          'Transcript open error:',
          error
        );

        Alert.alert(
          'Transcript error',
          'The transcript could not be opened.'
        );
      }
    };


  const handleSelectTranslationTarget =
    (
      lecture: LectureItem,
      target:
        TranslationTarget
    ) => {

      setTranslationTarget(
        target
      );

      setTranslationError(
        null
      );

      loadSavedTranslation(
        lecture,
        target
      );
    };


  const handleTranslateTranscript =
    async (
      lecture: LectureItem
    ) => {

      if (
        translatingLectureId ||
        transcribingLectureId
      ) {
        return;
      }

      try {

        setTranslatingLectureId(
          lecture.id
        );

        setTranslationError(
          null
        );

        await activateKeepAwakeAsync(
          TRANSLATION_KEEP_AWAKE_TAG
        );

        let sourceText =
          openedLectureId ===
            lecture.id
            ? openedTranscript
            : '';

        if (
          !sourceText &&
          lecture.transcriptUri
        ) {

          const transcriptFile =
            new File(
              lecture.transcriptUri
            );

          sourceText =
            transcriptFile
              .textSync()
              .trim();
        }

        if (!sourceText) {
          throw new Error(
            'The Norwegian transcript is empty.'
          );
        }

        const chunks =
          splitTextForTranslation(
            sourceText
          );

        if (
          chunks.length ===
          0
        ) {
          throw new Error(
            'There is no text to translate.'
          );
        }

        /*
         * Freeze the selected target before async model
         * download/translation work begins.
         */
        const target =
          translationTarget;


        const result =
          await OfflineTranslator
            .translateChunks(
              chunks,
              'no',
              target
            );

        const translations =
          result.translations.map(
            value =>
              String(
                value || ''
              ).trim()
          );


        if (
          translations.length !==
            chunks.length ||
          translations.some(
            value =>
              !value
          )
        ) {
          throw new Error(
            'ML Kit returned an incomplete translation.'
          );
        }


        const translatedText =
          translations
            .join(
              '\n\n'
            )
            .trim();


        if (!translatedText) {
          throw new Error(
            'ML Kit returned an empty translation.'
          );
        }

        const directory =
          getLectureDirectory(
            lecture.id
          );

        const translationFile =
          new File(
            directory,
            getTranslationFileName(
              target
            )
          );

        translationFile.create({
          overwrite: true,
          intermediates: true,
        });

        translationFile.write(
          translatedText
        );

        setOpenedLectureId(
          lecture.id
        );

        setOpenedTranscript(
          sourceText
        );

        setOpenedTranslation(
          translatedText
        );

      } catch (error) {

        console.error(
          'ML Kit translation error:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTranslationError(
          message
        );

        Alert.alert(
          'Translation error',
          message
        );

      } finally {

        setTranslatingLectureId(
          null
        );

        try {
          await deactivateKeepAwake(
            TRANSLATION_KEEP_AWAKE_TAG
          );
        } catch {
          // Do not hide a successful translation.
        }
      }
    };


  const handleCreateTranscript =
    async (
      lecture: LectureItem
    ) => {

      if (
        transcribingLectureId ||
        translatingLectureId
      ) {
        return;
      }

      try {

        setTranscribingLectureId(
          lecture.id
        );


        /*
         * WhisperKit is local foreground work. Keep the
         * screen awake so iOS does not suspend the app
         * in the middle of a long transcription.
         */
        await activateKeepAwakeAsync(
          WHISPER_KEEP_AWAKE_TAG
        );

        setTranscriptionError(
          null
        );

        setLiveTranscript(
          ''
        );

        setWhisperStage(
          'preparing-model'
        );


        const directory =
          getLectureDirectory(
            lecture.id
          );

        const metadata =
          readMetadata(
            directory
          );

        const baseTranscription =
          metadata.transcription ??
          createChunkPlan(
            lecture.durationMillis
          );

        const transcription:
          LectureTranscription = {
            ...baseTranscription,
            mode:
              'whisperkit-local',
            status:
              'processing',
            error:
              null,
            chunks:
              baseTranscription.chunks.map(
                chunk => ({
                  ...chunk,
                })
              ),
          };

        writeMetadata(
          directory,
          {
            ...metadata,
            id: lecture.id,
            createdAt:
              lecture.createdAt,
            durationMillis:
              lecture.durationMillis,
            language:
              lecture.language,
            audioFile:
              lecture.audioFileName,
            transcription,
          }
        );

        loadLectures();


        /*
         * Never send a missing or obviously invalid
         * recording into WhisperKit. A retry is only
         * useful for a valid audio file.
         */
        const transcriptionAudio =
          new File(
            lecture.audioUri
          );

        const transcriptionBytes =
          transcriptionAudio.size ??
          0;


        if (
          !transcriptionAudio.exists ||
          transcriptionBytes <
            4096 ||
          lecture.durationMillis <
            500
        ) {
          throw new Error(
            'The audio recording is missing or invalid.'
          );
        }


        /*
         * On the first run WhisperKit downloads
         * the local Core ML model to the iPhone.
         * Subsequent transcriptions reuse it and
         * can work offline.
         */

        await WhisperKitLocal
          .prepareModel(
            WHISPERKIT_DEFAULT_MODEL
          );


        setWhisperStage(
          'transcribing'
        );


        let result =
          await WhisperKitLocal
            .transcribe(
              lecture.audioUri,
              'no',
              WHISPERKIT_DEFAULT_MODEL
            );


        let finalText =
          String(
            result.text || ''
          ).trim();


        /*
         * On the first transcription after a cold
         * model start WhisperKit can occasionally
         * finish without returning text.
         *
         * Retry ONCE automatically. The model is
         * already loaded at this point, so the
         * second pass is normally much faster.
         */
        if (!finalText) {

          setWhisperStage(
            'retrying'
          );

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                600
              )
          );


          result =
            await WhisperKitLocal
              .transcribe(
                lecture.audioUri,
                'no',
                WHISPERKIT_DEFAULT_MODEL
              );


          finalText =
            String(
              result.text || ''
            ).trim();
        }


        if (!finalText) {
          throw new Error(
            'WhisperKit returned an empty transcript after two attempts.'
          );
        }


        /*
         * A successful new transcription invalidates all
         * translations derived from the previous transcript.
         *
         * Delete them before replacing transcript.txt so a
         * new Norwegian transcript can never be paired with
         * an older Ukrainian/Russian translation.
         */
        for (
          const target
          of ['uk', 'ru'] as const
        ) {

          const oldTranslation =
            new File(
              directory,
              getTranslationFileName(
                target
              )
            );

          if (
            oldTranslation.exists
          ) {
            oldTranslation.delete();
          }
        }


        setOpenedTranslation(
          ''
        );


        /*
         * IMPORTANT:
         *
         * result.text and result.segments are not always
         * equally complete. WhisperKit can occasionally
         * return a fuller plain transcript while timestamp
         * segments begin later in the audio.
         *
         * Never rebuild transcript.txt from segments. The
         * raw result.text remains authoritative for the
         * complete transcript. Segments are a separate
         * timestamp/navigation layer.
         */
        const rawWhisperText =
          finalText;


        const rawTranscriptSegments =
          (result.segments ?? [])
            .map(
              (
                segment:
                  WhisperSegment
              ) => ({
                start:
                  Number(
                    segment.start
                  ),
                end:
                  Number(
                    segment.end
                  ),
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
                segment.start >=
                  0 &&
                segment.end >=
                  segment.start
            );


        const transcriptSegments =
          rawTranscriptSegments
            .filter(
              segment =>
                isMeaningfulTranscriptText(
                  segment.text
                )
            );


        const transcriptSegmentsFile =
          new File(
            directory,
            'transcript-segments.json'
          );

        writeJsonArray(
          transcriptSegmentsFile,
          transcriptSegments
        );


        /*
         * Keep a compact raw Whisper snapshot while this
         * feature is being validated. If text and segments
         * disagree again, the exported lecture tells us
         * whether the loss happened inside WhisperKit or
         * later in our JS processing.
         */
        const whisperDebugFile =
          new File(
            directory,
            'whisper-debug.json'
          );

        whisperDebugFile.create({
          overwrite: true,
          intermediates: true,
        });

        whisperDebugFile.write(
          JSON.stringify(
            {
              createdAt:
                new Date().toISOString(),
              audioDurationMillis:
                lecture.durationMillis,
              rawText:
                rawWhisperText,
              rawSegments:
                rawTranscriptSegments,
              cleanedSegments:
                transcriptSegments,
              audioLoadingMode:
                result.audioLoadingMode ??
                'unknown',
              chunkingStrategy:
                result.chunkingStrategy ??
                'unknown',
            },
            null,
            2
          )
        );


        /*
         * Keep the complete plain transcript exactly from
         * WhisperKit even if the timestamp layer is partial.
         */
        finalText =
          rawWhisperText;


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
          finalText
        );


        const doneTranscription:
          LectureTranscription = {
            ...transcription,
            mode:
              'whisperkit-local',
            status:
              'done',
            processedUntilSeconds:
              Math.ceil(
                lecture.durationMillis /
                1000
              ),
            error:
              null,
            chunks:
              transcription.chunks.map(
                chunk => ({
                  ...chunk,
                  status:
                    'done',
                  error:
                    null,
                })
              ),
          };


        writeMetadata(
          directory,
          {
            ...metadata,
            id: lecture.id,
            createdAt:
              lecture.createdAt,
            durationMillis:
              lecture.durationMillis,
            language:
              lecture.language,
            audioFile:
              lecture.audioFileName,
            transcriptFile:
              'transcript.txt',
            transcriptReady:
              true,
            characters:
              finalText.length,
            transcription:
              doneTranscription,
          }
        );


        setOpenedLectureId(
          lecture.id
        );

        setOpenedTranscript(
          finalText
        );

        setOpenedTranscriptSegments(
          transcriptSegments
        );

        setOpenedTranslation(
          ''
        );

        setTranslationError(
          null
        );

        setLiveTranscript(
          finalText
        );

        setWhisperStage(
          'done'
        );

        loadLectures();

      } catch (error) {

        console.error(
          'WhisperKit transcription error:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTranscriptionError(
          message
        );

        setWhisperStage(
          'error'
        );

        Alert.alert(
          'WhisperKit transcription error',
          message
        );


        try {

          const directory =
            getLectureDirectory(
              lecture.id
            );

          const metadata =
            readMetadata(
              directory
            );

          const baseTranscription =
            metadata.transcription ??
            createChunkPlan(
              lecture.durationMillis
            );

          const transcription:
            LectureTranscription = {
              ...baseTranscription,
              mode:
                'whisperkit-local',
              status:
                'error',
              error:
                message,
              chunks:
                baseTranscription.chunks.map(
                  chunk => ({
                    ...chunk,
                  })
                ),
            };

          writeMetadata(
            directory,
            {
              ...metadata,
              transcription,
            }
          );

          loadLectures();

        } catch {
          // Keep the original audio safe even if
          // status persistence also fails.
        }

      } finally {

        try {

          await deactivateKeepAwake(
            WHISPER_KEEP_AWAKE_TAG
          );

        } catch {
          // Ignore Keep Awake cleanup errors.
        }


        setTranscribingLectureId(
          null
        );
      }
    };


  const shareLocalFile =
    async (
      file: File,
      unavailableMessage:
        string
    ) => {

      if (!file.exists) {
        throw new Error(
          unavailableMessage
        );
      }

      const sharingAvailable =
        await Sharing
          .isAvailableAsync();

      if (!sharingAvailable) {
        throw new Error(
          'Sharing is not available on this device.'
        );
      }

      await Sharing.shareAsync(
        file.uri
      );
    };


  const handleExportLecture =
    async (
      lecture: LectureItem,
      kind:
        | 'audio'
        | 'transcript'
        | 'ukrainian'
        | 'timestamps'
        | 'zip'
    ) => {

      if (
        exportingLectureId
      ) {
        return;
      }


      try {

        setExportingLectureId(
          lecture.id
        );


        const directory =
          getLectureDirectory(
            lecture.id
          );

        const stem =
          safeFileStem(
            lecture.id
          );


        if (
          kind ===
            'audio'
        ) {

          await shareLocalFile(
            new File(
              lecture.audioUri
            ),
            'The audio file is missing.'
          );

          return;
        }


        if (
          kind ===
            'transcript'
        ) {

          const transcriptFile =
            new File(
              directory,
              'transcript.txt'
            );

          await shareLocalFile(
            transcriptFile,
            'Create a transcript first.'
          );

          return;
        }


        if (
          kind ===
            'ukrainian'
        ) {

          const ukrainianFile =
            new File(
              directory,
              getTranslationFileName(
                'uk'
              )
            );

          await shareLocalFile(
            ukrainianFile,
            'Create the Ukrainian translation first.'
          );

          return;
        }


        if (
          kind ===
            'timestamps'
        ) {

          const segments =
            lecture.transcriptSegments.length >
              0
              ? lecture.transcriptSegments
              : readTranscriptSegments(
                  directory
                );


          if (
            segments.length ===
              0
          ) {
            throw new Error(
              'Create or recreate the transcript with timestamps first.'
            );
          }


          const timestampFile =
            new File(
              Paths.cache,
              `${stem}-timestamps.txt`
            );

          timestampFile.create({
            overwrite: true,
            intermediates: true,
          });

          timestampFile.write(
            buildTimestampText(
              segments
            )
          );


          await shareLocalFile(
            timestampFile,
            'The timestamp text could not be created.'
          );

          return;
        }


        /*
         * Full local package:
         * - M4A
         * - transcript
         * - timestamp text + JSON segments
         * - Ukrainian/Russian translation when available
         * - recording markers
         * - session metadata
         *
         * M4A is already compressed, so level 0 avoids
         * wasting CPU and keeps ZIP creation predictable.
         */
        const zipEntries:
          Record<
            string,
            Uint8Array
          > = {};


        const audioFile =
          new File(
            lecture.audioUri
          );

        if (!audioFile.exists) {
          throw new Error(
            'The audio file is missing.'
          );
        }

        zipEntries[
          lecture.audioFileName
        ] =
          audioFile.bytesSync();


        const transcriptFile =
          new File(
            directory,
            'transcript.txt'
          );

        if (
          transcriptFile.exists
        ) {
          zipEntries[
            'transcript.txt'
          ] =
            strToU8(
              transcriptFile
                .textSync()
            );
        }


        const segments =
          readTranscriptSegments(
            directory
          );

        if (
          segments.length >
            0
        ) {

          zipEntries[
            'transcript-timestamps.txt'
          ] =
            strToU8(
              buildTimestampText(
                segments
              )
            );

          const segmentsFile =
            new File(
              directory,
              'transcript-segments.json'
            );

          if (
            segmentsFile.exists
          ) {
            zipEntries[
              'transcript-segments.json'
            ] =
              segmentsFile.bytesSync();
          }
        }


        for (
          const target
          of ['uk', 'ru'] as const
        ) {

          const translationFile =
            new File(
              directory,
              getTranslationFileName(
                target
              )
            );

          if (
            translationFile.exists
          ) {
            zipEntries[
              getTranslationFileName(
                target
              )
            ] =
              translationFile.bytesSync();
          }
        }


        for (
          const fileName
          of [
            'markers.json',
            'session.json',
            'whisper-debug.json',
          ]
        ) {

          const sourceFile =
            new File(
              directory,
              fileName
            );

          if (
            sourceFile.exists
          ) {
            zipEntries[
              fileName
            ] =
              sourceFile.bytesSync();
          }
        }


        const zipped =
          zipSync(
            zipEntries,
            {
              level: 0,
            }
          );


        const zipFile =
          new File(
            Paths.cache,
            `${stem}-complete.zip`
          );

        zipFile.create({
          overwrite: true,
          intermediates: true,
        });

        zipFile.write(
          zipped
        );


        await shareLocalFile(
          zipFile,
          'The ZIP package could not be created.'
        );

      } catch (error) {

        console.error(
          'Lecture export error:',
          error
        );

        Alert.alert(
          'Export error',
          error instanceof Error
            ? error.message
            : 'The lecture could not be exported.'
        );

      } finally {

        setExportingLectureId(
          null
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

                  console.error(
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
            !!(
              transcribingLectureId ||
              translatingLectureId
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
            {
              backgroundColor:
                status ===
                'recording'
                  ? '#C94B4B'
                  : T.accent,
              opacity:
                (
                  transcribingLectureId ||
                  translatingLectureId
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
            !!transcribingLectureId ||
            !!translatingLectureId
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
                transcribingLectureId ||
                translatingLectureId
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


                  {lecture.markers.length >
                    0 && (

                    <View
                      style={
                        styles.savedMarkersBox
                      }
                    >

                      <Text
                        style={[
                          styles.savedMarkersTitle,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        Marked moments
                      </Text>


                      <View
                        style={
                          styles.savedMarkersWrap
                        }
                      >

                        {lecture.markers.map(
                          marker => (

                            <Pressable
                              key={
                                marker.id
                              }
                              onPress={() =>
                                void handleSeekLectureTo(
                                  lecture,
                                  marker.timeMillis /
                                    1000,
                                  true
                                )
                              }
                              style={[
                                styles.savedMarkerButton,
                                {
                                  borderColor:
                                    T.accent,
                                },
                              ]}
                            >

                              <Text
                                style={[
                                  styles.savedMarkerText,
                                  {
                                    color:
                                      T.accent,
                                    fontSize:
                                      F.base - 3,
                                  },
                                ]}
                              >
                                {markerLabel(
                                  marker.type
                                )}
                                {' · '}
                                {formatTime(
                                  marker.timeMillis
                                )}
                              </Text>

                            </Pressable>
                          )
                        )}

                      </View>

                    </View>
                  )}


                  <View
                    style={
                      styles.lectureActions
                    }
                  >

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isPlaying
                          ? 'Pause lecture'
                          : 'Play lecture'
                      }
                      disabled={
                        isLoading
                      }
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 6,
                        right: 6,
                      }}
                      pressRetentionOffset={{
                        top: 20,
                        bottom: 20,
                        left: 20,
                        right: 20,
                      }}
                      onPress={() => {

                        void Haptics
                          .selectionAsync();

                        void handlePlayLecture(
                          lecture
                        );
                      }}
                      style={({
                        pressed,
                      }) => [
                        styles.smallActionButton,
                        styles.halfActionButton,
                        {
                          borderColor:
                            T.accent,
                          backgroundColor:
                            pressed
                              ? T.accent +
                                '14'
                              : 'transparent',
                          opacity:
                            pressed
                              ? 0.62
                              : 1,
                          transform: [
                            {
                              scale:
                                pressed
                                  ? 0.97
                                  : 1,
                            },
                          ],
                        },
                      ]}
                    >

                      <Text
                        style={[
                          styles.smallActionText,
                          {
                            color:
                              T.accent,
                            fontSize:
                              F.base - 1,
                          },
                        ]}
                      >
                        {isLoading
                          ? '… Loading'
                          : isPlaying
                            ? '⏸ Pause'
                            : '▶ Play'}
                      </Text>

                    </Pressable>


                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        lecture.transcriptReady
                          ? (
                            isTranscriptOpen
                              ? 'Hide lecture transcript'
                              : 'Open lecture transcript'
                          )
                          : 'Create lecture transcript'
                      }
                      disabled={
                        !!(
                          transcribingLectureId ||
                          translatingLectureId
                        )
                      }
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 6,
                        right: 6,
                      }}
                      pressRetentionOffset={{
                        top: 20,
                        bottom: 20,
                        left: 20,
                        right: 20,
                      }}
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

                          handleCreateTranscript(
                            lecture
                          );
                        }
                      }}
                      style={({
                        pressed,
                      }) => [
                        styles.smallActionButton,
                        styles.halfActionButton,
                        {
                          borderColor:
                            T.accent,
                          backgroundColor:
                            pressed
                              ? T.accent +
                                '14'
                              : 'transparent',
                          opacity:
                            pressed
                              ? 0.62
                              : 1,
                          transform: [
                            {
                              scale:
                                pressed
                                  ? 0.97
                                  : 1,
                            },
                          ],
                        },
                      ]}
                    >

                      <Text
                        style={[
                          styles.smallActionText,
                          {
                            color:
                              T.accent,
                            fontSize:
                              F.base - 1,
                          },
                        ]}
                      >
                        {lecture.transcriptReady
                          ? (
                            isTranscriptOpen
                              ? '📄 Hide text'
                              : '📄 Transcript'
                          )
                          : (
                            transcribingLectureId === lecture.id
                              ? '… Transcribing'
                              : 'Create transcript'
                          )}
                      </Text>

                    </Pressable>


                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        exportLectureId ===
                          lecture.id
                          ? 'Close lecture export menu'
                          : 'Share or export lecture'
                      }
                      disabled={
                        exportingLectureId ===
                          lecture.id
                      }
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 6,
                        right: 6,
                      }}
                      pressRetentionOffset={{
                        top: 20,
                        bottom: 20,
                        left: 20,
                        right: 20,
                      }}
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
                      style={({
                        pressed,
                      }) => [
                        styles.smallActionButton,
                        styles.fullActionButton,
                        {
                          borderColor:
                            T.accent,
                          backgroundColor:
                            pressed
                              ? T.accent +
                                '14'
                              : 'transparent',
                          opacity:
                            pressed
                              ? 0.62
                              : 1,
                          transform: [
                            {
                              scale:
                                pressed
                                  ? 0.97
                                  : 1,
                            },
                          ],
                        },
                      ]}
                    >

                      <Text
                        style={[
                          styles.smallActionText,
                          {
                            color:
                              T.accent,
                            fontSize:
                              F.base - 1,
                          },
                        ]}
                      >
                        {exportingLectureId ===
                          lecture.id
                          ? '… Exporting'
                          : exportLectureId ===
                              lecture.id
                            ? '✕ Export'
                            : '↗ Share / Export'}
                      </Text>

                    </Pressable>

                  </View>


                  {exportLectureId ===
                    lecture.id && (

                    <View
                      style={
                        styles.exportBox
                      }
                    >

                      <Text
                        style={[
                          styles.exportTitle,
                          {
                            color:
                              T.textSecondary,
                            fontSize:
                              F.base - 2,
                          },
                        ]}
                      >
                        Export this lecture
                      </Text>


                      {(
                        [
                          [
                            'audio',
                            '🎧 M4A audio',
                          ],
                          [
                            'transcript',
                            '📄 Transcript',
                          ],
                          [
                            'ukrainian',
                            '🇺🇦 Ukrainian translation',
                          ],
                          [
                            'timestamps',
                            '⏱ Text with timestamps',
                          ],
                          [
                            'zip',
                            '📦 Complete ZIP',
                          ],
                        ] as const
                      ).map(
                        (
                          [
                            kind,
                            label,
                          ]
                        ) => (

                          <Pressable
                            key={
                              kind
                            }
                            accessibilityRole="button"
                            accessibilityLabel={
                              label
                            }
                            disabled={
                              exportingLectureId ===
                                lecture.id
                            }
                            onPress={() =>
                              void handleExportLecture(
                                lecture,
                                kind
                              )
                            }
                            style={[
                              styles.exportOption,
                              {
                                borderColor:
                                  T.accent,
                              },
                            ]}
                          >

                            <Text
                              style={[
                                styles.exportOptionText,
                                {
                                  color:
                                    T.accent,
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
                        {whisperStage ===
                          'preparing-model'
                          ? 'First use may download the Whisper model. Keep the app open and connected to the internet.'
                          : 'Processing locally. Long lectures may take several minutes.'}
                      </Text>

                      {!!liveTranscript && (

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

                      {openedTranscriptSegments.length >
                        0
                        ? (

                          <View
                            style={
                              styles.transcriptSegmentsList
                            }
                          >

                            {openedTranscriptSegments.map(
                              (
                                segment,
                                index
                              ) => {

                                const isActiveSegment =
                                  isCurrent &&
                                  playerStatus.isLoaded &&
                                  playerStatus.currentTime >=
                                    segment.start &&
                                  playerStatus.currentTime <
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
                                      void handleSeekLectureTo(
                                        lecture,
                                        segment.start,
                                        true
                                      )
                                    }
                                    style={[
                                      styles.transcriptSegmentRow,
                                      {
                                        backgroundColor:
                                          isActiveSegment
                                            ? T.accent +
                                              '18'
                                            : 'transparent',
                                      },
                                    ]}
                                  >

                                    <Text
                                      style={[
                                        styles.transcriptTimestamp,
                                        {
                                          color:
                                            T.accent,
                                          fontSize:
                                            F.base - 3,
                                        },
                                      ]}
                                    >
                                      {formatPlaybackTime(
                                        segment.start
                                      )}
                                    </Text>


                                    <Text
                                      selectable
                                      style={[
                                        styles.transcriptSegmentText,
                                        {
                                          color:
                                            T.textSecondary,
                                          fontSize:
                                            F.base,
                                        },
                                      ]}
                                    >
                                      {segment.text}
                                    </Text>

                                  </Pressable>
                                );
                              }
                            )}

                          </View>

                        )
                        : (

                          <Text
                            selectable
                            style={[
                              styles.savedTranscriptText,
                              {
                                color:
                                  T.textSecondary,
                                fontSize:
                                  F.base,
                              },
                            ]}
                          >
                            {openedTranscript}
                          </Text>
                        )}


                      <View
                        style={
                          styles.translationSection
                        }
                      >

                        <Text
                          style={[
                            styles.translationTitle,
                            {
                              color:
                                T.textSecondary,
                              fontSize:
                                F.base,
                            },
                          ]}
                        >
                          Quick translation
                        </Text>


                        <View
                          style={
                            styles.translationLanguageRow
                          }
                        >

                          <Pressable
                            disabled={
                              !!(
                                translatingLectureId ||
                                transcribingLectureId
                              )
                            }
                            onPress={() =>
                              handleSelectTranslationTarget(
                                lecture,
                                'uk'
                              )
                            }
                            style={[
                              styles.translationLanguageButton,
                              {
                                borderColor:
                                  T.accent,
                                backgroundColor:
                                  translationTarget ===
                                    'uk'
                                    ? T.accent
                                    : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.translationLanguageText,
                                {
                                  color:
                                    translationTarget ===
                                      'uk'
                                      ? '#FFFFFF'
                                      : T.accent,
                                  fontSize:
                                    F.base - 2,
                                },
                              ]}
                            >
                              Українська
                            </Text>
                          </Pressable>


                          <Pressable
                            disabled={
                              !!(
                                translatingLectureId ||
                                transcribingLectureId
                              )
                            }
                            onPress={() =>
                              handleSelectTranslationTarget(
                                lecture,
                                'ru'
                              )
                            }
                            style={[
                              styles.translationLanguageButton,
                              {
                                borderColor:
                                  T.accent,
                                backgroundColor:
                                  translationTarget ===
                                    'ru'
                                    ? T.accent
                                    : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.translationLanguageText,
                                {
                                  color:
                                    translationTarget ===
                                      'ru'
                                      ? '#FFFFFF'
                                      : T.accent,
                                  fontSize:
                                    F.base - 2,
                                },
                              ]}
                            >
                              Русский
                            </Text>
                          </Pressable>

                        </View>


                        <Pressable
                          disabled={
                            !!(
                              translatingLectureId ||
                              transcribingLectureId
                            )
                          }
                          onPress={() =>
                            void handleTranslateTranscript(
                              lecture
                            )
                          }
                          style={[
                            styles.translateButton,
                            {
                              borderColor:
                                T.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.translateButtonText,
                              {
                                color:
                                  T.accent,
                                fontSize:
                                  F.base - 1,
                              },
                            ]}
                          >
                            {translatingLectureId ===
                              lecture.id
                              ? '… Translating on this iPhone'
                              : openedTranslation
                                ? 'Translate again with Google'
                                : 'Translate with Google'}
                          </Text>
                        </Pressable>


                        <Text
                          style={[
                            styles.translationInfo,
                            {
                              color:
                                T.textSecondary,
                              fontSize:
                                F.base - 3,
                            },
                          ]}
                        >
                          On-device after the language model is downloaded. First use requires Wi-Fi.
                        </Text>


                        {!!translationError && (
                          <Text
                            style={[
                              styles.translationError,
                              {
                                color:
                                  T.textSecondary,
                                fontSize:
                                  F.base - 2,
                              },
                            ]}
                          >
                            {translationError}
                          </Text>
                        )}


                        {!!openedTranslation && (
                          <View
                            style={
                              styles.translationResult
                            }
                          >
                            <Text
                              selectable
                              style={[
                                styles.translationText,
                                {
                                  color:
                                    T.textSecondary,
                                  fontSize:
                                    F.base,
                                },
                              ]}
                            >
                              {openedTranslation}
                            </Text>

                            <Text
                              style={[
                                styles.translationAttribution,
                                {
                                  color:
                                    T.textSecondary,
                                  fontSize:
                                    F.base - 3,
                                },
                              ]}
                            >
                              Automatic translation powered by Google Translate
                            </Text>
                          </View>
                        )}

                      </View>

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

    savedMarkersBox: {
      marginTop: 12,
    },

    savedMarkersTitle: {
      fontWeight: '900',
      marginBottom: 7,
    },

    savedMarkersWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    savedMarkerButton: {
      borderWidth: 1,
      borderRadius: 999,
      minHeight: 32,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    savedMarkerText: {
      fontWeight: '800',
    },

    exportBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(128,128,128,0.35)',
      gap: 7,
    },

    exportTitle: {
      fontWeight: '900',
      marginBottom: 2,
    },

    exportOption: {
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 11,
      justifyContent: 'center',
      paddingHorizontal: 11,
    },

    exportOptionText: {
      fontWeight: '800',
    },

    lectureActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
    },

    smallActionButton: {
      minHeight: 56,
      borderWidth: 1.5,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    halfActionButton: {
      flexGrow: 1,
      flexBasis: '46%',
    },

    fullActionButton: {
      width: '100%',
    },

    smallActionText: {
      fontWeight: '900',
      textAlign: 'center',
      lineHeight: 21,
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

    transcriptSegmentsList: {
      gap: 3,
    },

    transcriptSegmentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
    },

    transcriptTimestamp: {
      minWidth: 44,
      fontWeight: '900',
      paddingTop: 2,
    },

    transcriptSegmentText: {
      flex: 1,
      lineHeight: 24,
      fontWeight: '500',
    },

    savedTranscriptText: {
      lineHeight: 24,
      fontWeight: '500',
    },

    translationSection: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(128,128,128,0.35)',
    },

    translationTitle: {
      fontWeight: '900',
      marginBottom: 10,
    },

    translationLanguageRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },

    translationLanguageButton: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },

    translationLanguageText: {
      fontWeight: '800',
      textAlign: 'center',
    },

    translateButton: {
      minHeight: 42,
      borderWidth: 1.5,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    translateButtonText: {
      fontWeight: '900',
      textAlign: 'center',
    },

    translationInfo: {
      marginTop: 8,
      lineHeight: 17,
      fontWeight: '600',
    },

    translationError: {
      marginTop: 10,
      lineHeight: 19,
      fontWeight: '700',
    },

    translationResult: {
      marginTop: 16,
    },

    translationText: {
      lineHeight: 24,
      fontWeight: '500',
    },

    translationAttribution: {
      marginTop: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
  });
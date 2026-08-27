import {
  Directory,
  File,
} from 'expo-file-system';

export type TranscriptionChunk = {
  index: number;
  fromSeconds: number;
  toSeconds: number;
  status:
    | 'pending'
    | 'processing'
    | 'done'
    | 'error';
  textFile?: string | null;
  error?: string | null;
};

export type LectureTranscription = {
  /*
   * Legacy chunk fields stay readable until old session.json
   * files have been migrated. New transcription is local.
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

export type LectureMarkerType =
  | 'important'
  | 'unclear'
  | 'repeat'
  | 'term';

export type LectureMarker = {
  id: string;
  timeMillis: number;
  type: LectureMarkerType;
  note: string;
  createdAt: string;
};

export type SavedTranscriptSegment = {
  start: number;
  end: number;
  text: string;
  noSpeechProb?: number;
  avgLogProb?: number;
};

export type LectureMetadata = {
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

export type LectureItem = {
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

export type ActiveRecording = {
  id: string;
  createdAt: string;
  directory: Directory;
  audioFile: File;
};

export type TranslationTarget =
  | 'uk'
  | 'ru';


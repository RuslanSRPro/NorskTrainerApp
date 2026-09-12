export { default } from './src/WhisperKitLocalModule';

export type {
  WhisperLiveErrorEvent,
  WhisperLiveStartResult,
  WhisperLiveStopResult,
  WhisperLiveUpdateEvent,
  WhisperProgressEvent,
  WhisperSegment,
  WhisperTranscriptResult,
} from './src/WhisperKitLocalModule';

export const WHISPERKIT_DEFAULT_MODEL =
  'large-v3-v20240930_626MB';

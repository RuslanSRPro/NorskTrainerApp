import {
  NativeModule,
  requireNativeModule,
} from 'expo';

export type WhisperProgressEvent = {
  stage:
    | 'preparing-model'
    | 'model-ready'
    | 'transcribing'
    | 'done';
  text: string;
  window: number;
  message: string;
};

export type WhisperSegment = {
  start: number;
  end: number;
  text: string;
  noSpeechProb: number;
  avgLogProb: number;
};

export type WhisperTranscriptResult = {
  ok: boolean;
  model: string;
  language: string;
  text: string;
  segments: WhisperSegment[];
  characters: number;
  audioLoadingMode?: 'full-file';
  chunkingStrategy?: 'none';
};


export type WhisperSegmentTranscriptResult =
  WhisperTranscriptResult & {
    source: 'segment-window';
    globalOffsetSeconds: number;
    overlapSeconds: number;
  };

export type WhisperTailTranscriptResult =
  WhisperTranscriptResult & {
    source: 'tail-window';
    globalOffsetSeconds: number;
    overlapSeconds: number;
    requestedStartSeconds: number;
  };

export type WhisperLiveUpdateEvent = {
  sessionId: string;
  isRecording: boolean;
  elapsedMillis: number;
  partialText: string;
  confirmedSegments: WhisperSegment[];
  unconfirmedSegments: WhisperSegment[];
};

export type WhisperLiveErrorEvent = {
  requiresFullTranscription?: boolean;
  sessionId: string;
  message: string;
};

export type WhisperLiveStartResult = {
  ok: boolean;
  model: string;
  language: string;
  audioUri: string;
};

export type WhisperLiveStopResult = {
  requiresFullTranscription?: boolean;
  ok: boolean;
  audioUri: string;
  durationMillis: number;
  bytes: number;
  writerError?: string | null;
  streamCleanupTimedOut: boolean;
};

type WhisperKitLocalEvents = {
  onProgress(
    event: WhisperProgressEvent
  ): void;
  onLiveUpdate(
    event: WhisperLiveUpdateEvent
  ): void;
  onLiveError(
    event: WhisperLiveErrorEvent
  ): void;
};

declare class WhisperKitLocalNativeModule
  extends NativeModule<WhisperKitLocalEvents> {

  prepareModel(
    model: string
  ): Promise<{
    ok: boolean;
    model: string;
  }>;

  transcribe(
    audioUri: string,
    language: string,
    model: string
  ): Promise<WhisperTranscriptResult>;

  transcribeSegment(
    previousAudioUri: string,
    audioUri: string,
    language: string,
    model: string,
    globalStartSeconds: number,
    overlapSeconds: number
  ): Promise<WhisperSegmentTranscriptResult>;

  transcribeRange(audioUri: string, language: string, model: string, startSeconds: number,
    endSeconds: number, overlapSeconds: number): Promise<Omit<WhisperTailTranscriptResult, 'source'> & {source: 'file-window'}>;

  transcribeTail(
    audioUri: string,
    language: string,
    model: string,
    startSeconds: number,
    overlapSeconds: number
  ): Promise<WhisperTailTranscriptResult>;

  startLive(
    audioUri: string,
    language: string,
    model: string,
    timingLogUri: string
  ): Promise<WhisperLiveStartResult>;

  waitForLiveCleanup(timeoutMillis: number): Promise<{ ready: boolean }>;

  stopLive():
    Promise<WhisperLiveStopResult>;

  cancelLive():
    Promise<
      | {
          ok: boolean;
          cleanupPending?: boolean;
          audioUri?: undefined;
          durationMillis?: undefined;
          bytes?: undefined;
          writerError?: undefined;
        }
      | WhisperLiveStopResult
    >;
}

export default requireNativeModule<
  WhisperKitLocalNativeModule
>('WhisperKitLocal');

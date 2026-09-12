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

export type WhisperLiveUpdateEvent = {
  isRecording: boolean;
  elapsedMillis: number;
  partialText: string;
  confirmedSegments: WhisperSegment[];
  unconfirmedSegments: WhisperSegment[];
};

export type WhisperLiveErrorEvent = {
  message: string;
};

export type WhisperLiveStartResult = {
  ok: boolean;
  model: string;
  language: string;
  audioUri: string;
};

export type WhisperLiveStopResult = {
  ok: boolean;
  audioUri: string;
  durationMillis: number;
  bytes: number;
  writerError?: string | null;
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

  startLive(
    audioUri: string,
    language: string,
    model: string
  ): Promise<WhisperLiveStartResult>;

  stopLive():
    Promise<WhisperLiveStopResult>;

  cancelLive():
    Promise<{ ok: boolean }>;
}

export default requireNativeModule<
  WhisperKitLocalNativeModule
>('WhisperKitLocal');

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

type WhisperKitLocalEvents = {
  onProgress(
    event: WhisperProgressEvent
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
}

export default requireNativeModule<
  WhisperKitLocalNativeModule
>('WhisperKitLocal');

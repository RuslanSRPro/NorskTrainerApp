import {
  NativeModule,
  requireNativeModule,
} from 'expo';

export type LectureRecorderStatus = {
  isRecording: boolean;
  durationMillis: number;
  uri: string | null;
  bytes: number;
  levelDb?: number;
  peakDb?: number;
};

export type LectureRecorderResult = {
  ok: boolean;
  isRecording: boolean;
  durationMillis: number;
  uri: string;
  bytes: number;
  levelDb?: number;
  peakDb?: number;
};

export type LectureAudioInfo = {
  ok: boolean;
  durationMillis: number;
  uri: string;
  bytes: number;
};

declare class LectureRecorderNativeModule
  extends NativeModule {

  start(
    destinationUri: string
  ): Promise<LectureRecorderResult>;

  stop(): Promise<LectureRecorderResult>;

  cancel(): Promise<{
    ok: boolean;
  }>;

  getStatus(): LectureRecorderStatus;

  getAudioInfo(
    uri: string
  ): Promise<LectureAudioInfo>;
}

export default requireNativeModule<
  LectureRecorderNativeModule
>('LectureRecorder');

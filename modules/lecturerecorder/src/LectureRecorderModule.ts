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
  isPausedForInterruption?: boolean;
  segmentCount?: number;
  engineRunning?: boolean;
  hasSuccessfulWrite?: boolean;
  writerFailureMessage?: string | null;
};

export type LectureRecorderResult = {
  ok: boolean;
  isRecording: boolean;
  durationMillis: number;
  uri: string;
  bytes: number;
  levelDb?: number;
  peakDb?: number;
  isPausedForInterruption?: boolean;
  segmentCount?: number;
};

export type LectureAudioInfo = {
  ok: boolean;
  durationMillis: number;
  uri: string;
  bytes: number;
};

export type LectureRecordingValidation = {
  valid: boolean;
  playable: boolean;
  durationMillis: number;
  uri: string;
  bytes: number;
  code: string | null;
  message: string | null;
};

export type LectureSegmentPlaybackStatus = {
  isLoaded: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  lectureUri: string | null;
};

export type LectureRecorderErrorEvent = {
  code: string;
  message: string;
  uri: string | null;
  bytes: number;
  durationMillis: number;
};

export type LectureRecorderEvents = {
  onRecorderReady(
    event: LectureRecorderResult
  ): void;

  onRecorderStopped(
    event: LectureRecorderResult
  ): void;

  onRecorderError(
    event: LectureRecorderErrorEvent
  ): void;
};

declare class LectureRecorderNativeModule
  extends NativeModule<
    LectureRecorderEvents
  > {

  recordTimingEvent(
    event: string,
    timingLogUri: string,
    details?: string | null
  ): Promise<{ ok: boolean }>;

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

  validateRecording(
    uri: string
  ): Promise<LectureRecordingValidation>;

  assembleRecording(
    destinationUri: string
  ): Promise<LectureRecordingValidation>;

  recoverRecording(
    destinationUri: string
  ): Promise<LectureRecordingValidation>;

  prepareSegmentPlayback(
    destinationUri: string
  ): Promise<LectureSegmentPlaybackStatus>;

  playSegmentPlayback(): Promise<LectureSegmentPlaybackStatus>;

  pauseSegmentPlayback(): Promise<LectureSegmentPlaybackStatus>;

  seekSegmentPlayback(
    seconds: number
  ): Promise<LectureSegmentPlaybackStatus>;

  stopSegmentPlayback(): Promise<LectureSegmentPlaybackStatus>;

  getSegmentPlaybackStatus(): LectureSegmentPlaybackStatus;
}

export default requireNativeModule<
  LectureRecorderNativeModule
>('LectureRecorder');

export type {
  LectureAudioInfo,
  LectureRecorderErrorEvent,
  LectureRecorderResult,
  LectureRecorderStatus,
  LectureRecordingValidation,
} from './src/LectureRecorderModule';

import type {
  LectureRecorderStatus,
} from './src/LectureRecorderModule';

type ListenerSubscription = {
  remove(): void;
};

function emptySubscription(): ListenerSubscription {
  return {
    remove() {},
  };
}

function unsupported(): never {
  throw new Error(
    'Audio recording is not available on Windows yet.'
  );
}

const LectureRecorder = {
  addListener(
    _eventName: string,
    _listener: (...args: any[]) => void
  ): ListenerSubscription {
    return emptySubscription();
  },

  async start(
    _destinationUri: string
  ): Promise<any> {
    unsupported();
  },

  async stop(): Promise<any> {
    unsupported();
  },

  async cancel(): Promise<{ ok: boolean }> {
    return { ok: true };
  },

  getStatus(): LectureRecorderStatus {
    return {
      isRecording: false,
      durationMillis: 0,
      uri: null,
      bytes: 0,
      levelDb: -160,
      peakDb: -160,
      isPausedForInterruption: false,
      segmentCount: 0,
    };
  },

  async getAudioInfo(
    _uri: string
  ): Promise<any> {
    unsupported();
  },

  async validateRecording(
    _uri: string
  ): Promise<any> {
    unsupported();
  },

  async recoverRecording(
    _destinationUri: string
  ): Promise<any> {
    unsupported();
  },
};

export default LectureRecorder;
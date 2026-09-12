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
    'Whisper transcription is not available on Windows yet.'
  );
}

const WhisperKitLocal = {
  addListener(
    _eventName: string,
    _listener: (...args: any[]) => void
  ): ListenerSubscription {
    return emptySubscription();
  },

  async prepareModel(
    _model: string
  ): Promise<any> {
    unsupported();
  },

  async transcribe(
    _audioUri: string,
    _language: string,
    _model: string
  ): Promise<any> {
    unsupported();
  },

  async startLive(
    _audioUri: string,
    _language: string,
    _model: string
  ): Promise<any> {
    unsupported();
  },

  async stopLive(): Promise<any> {
    unsupported();
  },

  async cancelLive(): Promise<{ ok: boolean }> {
    return { ok: true };
  },
};

export default WhisperKitLocal;
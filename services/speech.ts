import * as Speech from 'expo-speech';

export type SpeechForm = {
  label: string;
  value: string;
};

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  pauseMs?: number;
};

const DEFAULT_RATE = 0.85;
const SLOW_RATE = 0.65;
const DEFAULT_PITCH = 1;
const DEFAULT_LANGUAGE = 'nb-NO';
const DEFAULT_FORM_PAUSE_MS = 250;

let cachedVoice:
  | {
      language?: string;
      identifier?: string;
    }
  | null = null;

function cleanSpeechText(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampRate(value?: number) {
  if (typeof value !== 'number') return DEFAULT_RATE;
  if (value < 0.45) return 0.45;
  if (value > 1.2) return 1.2;
  return value;
}

function clampPitch(value?: number) {
  if (typeof value !== 'number') return DEFAULT_PITCH;
  if (value < 0.5) return 0.5;
  if (value > 1.5) return 1.5;
  return value;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getNorwegianVoice() {
  if (cachedVoice) {
    return cachedVoice;
  }

  try {
    const voices = await Speech.getAvailableVoicesAsync();

    const norwegianVoice =
      voices.find((voice) =>
        String(voice.language || '').toLowerCase().startsWith('nb')
      ) ||
      voices.find((voice) =>
        String(voice.language || '').toLowerCase().startsWith('no')
      ) ||
      voices.find((voice) =>
        String(voice.language || '').toLowerCase().includes('nor')
      ) ||
      null;

    cachedVoice = norwegianVoice
      ? {
          language: norwegianVoice.language,
          identifier: norwegianVoice.identifier,
        }
      : {
          language: DEFAULT_LANGUAGE,
        };

    return cachedVoice;
  } catch (error) {
    console.log('Get voices error:', error);

    cachedVoice = {
      language: DEFAULT_LANGUAGE,
    };

    return cachedVoice;
  }
}

function speakOnce(
  text: string,
  voice: {
    language?: string;
    identifier?: string;
  },
  options?: SpeakOptions
) {
  const cleanText = cleanSpeechText(text);

  if (!cleanText) return Promise.resolve();

  return new Promise<void>((resolve) => {
    Speech.speak(cleanText, {
      language: voice.language || DEFAULT_LANGUAGE,
      voice: voice.identifier,
      rate: clampRate(options?.rate),
      pitch: clampPitch(options?.pitch),
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export async function stopSpeech() {
  try {
    await Speech.stop();
  } catch (error) {
    console.log('Stop speech error:', error);
  }
}

export async function isSpeechPlaying() {
  try {
    return await Speech.isSpeakingAsync();
  } catch (error) {
    console.log('Speech status error:', error);
    return false;
  }
}

export async function speakNorwegian(text: string, options?: SpeakOptions) {
  const cleanText = cleanSpeechText(text);

  if (!cleanText) return;

  try {
    await Speech.stop();

    const voice = await getNorwegianVoice();

    Speech.speak(cleanText, {
      language: voice?.language || DEFAULT_LANGUAGE,
      voice: voice?.identifier,
      rate: clampRate(options?.rate),
      pitch: clampPitch(options?.pitch),
    });

    console.log('Speaking Norwegian:', {
      text: cleanText,
      language: voice?.language || DEFAULT_LANGUAGE,
      voice: voice?.identifier || 'default',
      rate: clampRate(options?.rate),
    });
  } catch (error) {
    console.log('Speech error:', error);
  }
}

export async function speakNorwegianSlow(text: string, options?: SpeakOptions) {
  return speakNorwegian(text, {
    ...options,
    rate: options?.rate ?? SLOW_RATE,
  });
}

export async function speakNorwegianForms(
  forms: SpeechForm[],
  options?: SpeakOptions
) {
  const availableForms = forms
    .map((item) => cleanSpeechText(item.value))
    .filter(Boolean);

  if (!availableForms.length) return;

  try {
    await Speech.stop();

    const voice = await getNorwegianVoice();
    const pauseMs = options?.pauseMs ?? DEFAULT_FORM_PAUSE_MS;

    for (const form of availableForms) {
      await speakOnce(form, voice, options);
      await wait(pauseMs);
    }

    console.log('Speaking Norwegian forms:', {
      forms: availableForms,
      language: voice?.language || DEFAULT_LANGUAGE,
      voice: voice?.identifier || 'default',
      rate: clampRate(options?.rate),
    });
  } catch (error) {
    console.log('Forms speech error:', error);
  }
}

export async function speakNorwegianPhraseSequence(
  phrases: string[],
  options?: SpeakOptions
) {
  const cleanPhrases = phrases.map(cleanSpeechText).filter(Boolean);

  if (!cleanPhrases.length) return;

  try {
    await Speech.stop();

    const voice = await getNorwegianVoice();
    const pauseMs = options?.pauseMs ?? DEFAULT_FORM_PAUSE_MS;

    for (const phrase of cleanPhrases) {
      await speakOnce(phrase, voice, options);
      await wait(pauseMs);
    }
  } catch (error) {
    console.log('Phrase sequence speech error:', error);
  }
}

export const speakWord = speakNorwegian;
export const speakForms = speakNorwegianForms;
export const speakSlow = speakNorwegianSlow;
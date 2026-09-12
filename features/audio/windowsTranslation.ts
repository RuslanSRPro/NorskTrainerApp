export type WindowsTranslationTarget =
  | 'uk'
  | 'ru';

export type WindowsTranslationSegment = {
  start: number;
  end: number;
  text: string;
};

export type WindowsTranslatorProgress = {
  stage:
    | 'preparing'
    | 'downloading'
    | 'translating'
    | 'done';
  percent: number;
};

export type WindowsTranslatorSession = {
  translate(
    text: string
  ): Promise<string>;
  destroy(): void;
};

type TranslatorConstructor = {
  create(
    options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?(
        monitor: {
          addEventListener(
            type:
              'downloadprogress',
            listener:
              (
                event: {
                  loaded:
                    number;
                }
              ) => void
          ): void;
        }
      ): void;
    }
  ): Promise<
    WindowsTranslatorSession
  >;
};

function getTranslatorConstructor():
  TranslatorConstructor {
  const value =
    (
      globalThis as any
    ).Translator as
      TranslatorConstructor |
      undefined;

  if (
    !value ||
    typeof value.create !==
      'function'
  ) {
    throw new Error(
      'Microsoft Edge on-device Translator API is unavailable in this WebView2 runtime.'
    );
  }

  return value;
}

function normalizeSourceLanguage(
  sourceLanguage:
    string
) {
  return sourceLanguage ===
    'en'
    ? 'en'
    : 'nb';
}

export function beginWindowsTranslator(
  sourceLanguage:
    string,
  target:
    WindowsTranslationTarget,
  onProgress?:
    (
      progress:
        WindowsTranslatorProgress
    ) => void
) {
  const Translator =
    getTranslatorConstructor();

  onProgress?.({
    stage:
      'preparing',
    percent:
      0,
  });

  /*
   * Important: call Translator.create() directly from the
   * user's click handler. Edge requires transient user
   * activation when the language model has to be downloaded.
   */
  return Translator.create({
    sourceLanguage:
      normalizeSourceLanguage(
        sourceLanguage
      ),
    targetLanguage:
      target,
    monitor(
      monitor
    ) {
      monitor.addEventListener(
        'downloadprogress',
        event => {
          onProgress?.({
            stage:
              'downloading',
            percent:
              Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    event.loaded *
                      100
                  )
                )
              ),
          });
        }
      );
    },
  });
}

export async function translateSegmentsWithSession(
  session:
    WindowsTranslatorSession,
  segments:
    WindowsTranslationSegment[],
  onProgress?:
    (
      progress:
        WindowsTranslatorProgress
    ) => void
) {
  if (
    segments.length === 0
  ) {
    return {
      text:
        '',
      segments:
        [] as
          WindowsTranslationSegment[],
    };
  }

  const translated:
    WindowsTranslationSegment[] =
      [];

  for (
    let index =
      0;
    index <
      segments.length;
    index +=
      1
  ) {
    const segment =
      segments[index];

    const sourceText =
      segment.text
        .trim();

    if (!sourceText) {
      continue;
    }

    onProgress?.({
      stage:
        'translating',
      percent:
        Math.round(
          (
            index /
            segments.length
          ) *
            100
        ),
    });

    const text =
      (
        await session.translate(
          sourceText
        )
      )
        .trim();

    if (!text) {
      continue;
    }

    translated.push({
      start:
        segment.start,
      end:
        segment.end,
      text,
    });
  }

  onProgress?.({
    stage:
      'done',
    percent:
      100,
  });

  return {
    text:
      translated
        .map(
          segment =>
            segment.text
        )
        .join(' ')
        .trim(),
    segments:
      translated,
  };
}

export async function translatePlainTextWithSession(
  session:
    WindowsTranslatorSession,
  text:
    string
) {
  const value =
    text.trim();

  if (!value) {
    return '';
  }

  return (
    await session.translate(
      value
    )
  )
    .trim();
}

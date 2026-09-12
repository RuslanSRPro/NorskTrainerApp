export type {
  OfflineTranslationResult,
  TranslationLanguageCode,
} from './src/OfflineTranslatorModule';

import type {
  OfflineTranslationResult,
  TranslationLanguageCode,
} from './src/OfflineTranslatorModule';

const OfflineTranslator = {
  async translateChunks(
    chunks: string[],
    sourceLanguage: TranslationLanguageCode,
    targetLanguage: TranslationLanguageCode
  ): Promise<OfflineTranslationResult> {
    if (sourceLanguage === targetLanguage) {
      const translations = chunks.map(value => String(value ?? '').trim());

      return {
        translations,
        sourceLanguage,
        targetLanguage,
        chunkCount: translations.length,
      };
    }

    throw new Error(
      'Offline translation is not available on Windows yet.'
    );
  },
};

export default OfflineTranslator;
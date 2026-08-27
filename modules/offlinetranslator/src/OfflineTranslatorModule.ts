import {
  NativeModule,
  requireNativeModule,
} from 'expo';

export type TranslationLanguageCode =
  | 'no'
  | 'uk'
  | 'ru'
  | 'en';

export type OfflineTranslationResult = {
  translations: string[];
  sourceLanguage: TranslationLanguageCode;
  targetLanguage: TranslationLanguageCode;
  chunkCount: number;
};

declare class OfflineTranslatorNativeModule
  extends NativeModule {

  translateChunks(
    chunks: string[],
    sourceLanguage: TranslationLanguageCode,
    targetLanguage: TranslationLanguageCode
  ): Promise<OfflineTranslationResult>;
}

export default requireNativeModule<
  OfflineTranslatorNativeModule
>('OfflineTranslator');

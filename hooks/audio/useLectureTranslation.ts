import {
  useState,
  type MutableRefObject,
} from 'react';

import {
  Alert,
} from 'react-native';

import {
  File,
} from 'expo-file-system';

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

import OfflineTranslator from '@/modules/offlinetranslator';

import type {
  LectureItem,
  SavedTranscriptSegment,
  TranslationTarget,
} from '@/features/audio/lectureTypes';

import {
  getLectureDirectory,
  getTranslationFileName,
  getTranslationSegmentsFileName,
  getTranslationSourceLanguageCode,
  readTranscriptSegments,
  readTranslationSegments,
  writeJsonArray,
} from '@/features/audio/lectureStorage';

import {
  splitTextForTranslation,
} from '@/features/audio/translationUtils';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';

const KEEP_AWAKE_TAG =
  'lecture-translation';

type ProcessingLock =
  'transcription' |
  'translation' |
  null;

type Params = {
  openedLectureId:
    string | null;
  openedTranscript:
    string;
  openedTranscriptSegments:
    SavedTranscriptSegment[];
  processingLockRef:
    MutableRefObject<
      ProcessingLock
    >;
};

export function useLectureTranslation({
  openedLectureId,
  openedTranscript,
  openedTranscriptSegments,
  processingLockRef,
}: Params) {
  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const [
    translationTarget,
    setTranslationTarget,
  ] =
    useState<TranslationTarget>(
      'uk'
    );

  const [
    translatingLectureId,
    setTranslatingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    openedTranslation,
    setOpenedTranslation,
  ] =
    useState('');

  const [
    openedTranslationSegments,
    setOpenedTranslationSegments,
  ] =
    useState<
      SavedTranscriptSegment[]
    >(
      []
    );

  const [
    translationError,
    setTranslationError,
  ] =
    useState<string | null>(
      null
    );

  const clearTranslationState =
    () => {
      setOpenedTranslation(
        ''
      );
      setOpenedTranslationSegments(
        []
      );
      setTranslationError(
        null
      );
    };

  const loadSavedTranslation =
    (
      lecture:
        LectureItem,
      target:
        TranslationTarget
    ) => {
      try {
        const directory =
          getLectureDirectory(
            lecture.id
          );

        const translationFile =
          new File(
            directory,
            getTranslationFileName(
              target
            )
          );

        const savedSegments =
          readTranslationSegments(
            directory,
            target
          );

        setOpenedTranslationSegments(
          savedSegments
        );

        if (
          translationFile.exists
        ) {
          setOpenedTranslation(
            translationFile
              .textSync()
              .trim()
          );
          return;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            'Could not load saved translation:',
            error
          );
        }
      }

      setOpenedTranslation(
        ''
      );
      setOpenedTranslationSegments(
        []
      );
    };

  const handleSelectTranslationTarget =
    (
      lecture:
        LectureItem,
      target:
        TranslationTarget
    ) => {
      setTranslationTarget(
        target
      );

      setTranslationError(
        null
      );

      loadSavedTranslation(
        lecture,
        target
      );
    };

  const handleTranslateTranscript =
    async (
      lecture:
        LectureItem
    ) => {
      if (
        translatingLectureId ||
        processingLockRef.current
      ) {
        return;
      }

      processingLockRef.current =
        'translation';

      try {
        setTranslatingLectureId(
          lecture.id
        );

        setTranslationError(
          null
        );

        await activateKeepAwakeAsync(
          KEEP_AWAKE_TAG
        );

        const directory =
          getLectureDirectory(
            lecture.id
          );

        let sourceText =
          openedLectureId ===
            lecture.id
            ? openedTranscript
            : '';

        if (
          !sourceText &&
          lecture.transcriptUri
        ) {
          const transcriptFile =
            new File(
              lecture.transcriptUri
            );

          sourceText =
            transcriptFile
              .textSync()
              .trim();
        }

        if (!sourceText) {
          throw new Error(
            audioUi.transcriptEmpty
          );
        }

        const sourceSegments =
          openedLectureId ===
            lecture.id &&
          openedTranscriptSegments
            .length >
              0
            ? openedTranscriptSegments
            : readTranscriptSegments(
                directory
              );

        const sourceLanguage =
          getTranslationSourceLanguageCode(
            lecture.language
          );

        let translatedText =
          '';

        let translatedSegments:
          SavedTranscriptSegment[] =
            [];

        /*
         * Prefer the timestamped Whisper segments. Translating
         * each segment independently preserves an exact
         * source-time -> translated-text mapping, so tapping a
         * translated timestamp can seek the same audio position.
         *
         * Older lectures without segment JSON fall back to the
         * previous paragraph/chunk translation path.
         */
        if (
          sourceSegments.length >
            0
        ) {
          const sourceSegmentTexts =
            sourceSegments.map(
              segment =>
                segment.text
            );

          const result =
            await OfflineTranslator
              .translateChunks(
                sourceSegmentTexts,
                sourceLanguage,
                translationTarget
              );

          const translations =
            result.translations
              .map(
                value =>
                  String(
                    value || ''
                  ).trim()
              );

          if (
            translations.length !==
              sourceSegments.length ||
            translations.some(
              value =>
                !value
            )
          ) {
            throw new Error(
              audioUi.incompleteTimestampedTranslation
            );
          }

          translatedSegments =
            sourceSegments.map(
              (
                segment,
                index
              ) => ({
                start:
                  segment.start,
                end:
                  segment.end,
                text:
                  translations[
                    index
                  ],
              })
            );

          translatedText =
            translatedSegments
              .map(
                segment =>
                  segment.text
              )
              .join(
                '\n\n'
              )
              .trim();

        } else {
          const chunks =
            splitTextForTranslation(
              sourceText
            );

          if (
            chunks.length ===
              0
          ) {
            throw new Error(
              audioUi.noTextToTranslate
            );
          }

          const result =
            await OfflineTranslator
              .translateChunks(
                chunks,
                sourceLanguage,
                translationTarget
              );

          const translations =
            result.translations
              .map(
                value =>
                  String(
                    value || ''
                  ).trim()
              );

          if (
            translations.length !==
              chunks.length ||
            translations.some(
              value =>
                !value
            )
          ) {
            throw new Error(
              audioUi.incompleteTranslation
            );
          }

          translatedText =
            translations
              .join(
                '\n\n'
              )
              .trim();
        }

        if (!translatedText) {
          throw new Error(
            audioUi.emptyTranslation
          );
        }

        const translationFile =
          new File(
            directory,
            getTranslationFileName(
              translationTarget
            )
          );

        translationFile.create({
          overwrite: true,
          intermediates: true,
        });

        translationFile.write(
          translatedText
        );

        const segmentFile =
          new File(
            directory,
            getTranslationSegmentsFileName(
              translationTarget
            )
          );

        if (
          translatedSegments.length >
            0
        ) {
          writeJsonArray(
            segmentFile,
            translatedSegments
          );
        } else if (
          segmentFile.exists
        ) {
          segmentFile.delete();
        }

        setOpenedTranslation(
          translatedText
        );

        setOpenedTranslationSegments(
          translatedSegments
        );

      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (__DEV__) {
          console.error(
            'Lecture translation error:',
            error
          );
        }

        setTranslationError(
          message
        );

        Alert.alert(
          audioUi.translationErrorTitle,
          message
        );

      } finally {
        setTranslatingLectureId(
          null
        );

        processingLockRef.current =
          null;

        try {
          await deactivateKeepAwake(
            KEEP_AWAKE_TAG
          );
        } catch {}
      }
    };

  return {
    translationTarget,
    translatingLectureId,
    openedTranslation,
    openedTranslationSegments,
    translationError,
    clearTranslationState,
    loadSavedTranslation,
    handleSelectTranslationTarget,
    handleTranslateTranscript,
  };
}

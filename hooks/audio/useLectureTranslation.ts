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
  TranslationTarget,
} from '@/features/audio/lectureTypes';

import {
  getLectureDirectory,
  getTranslationFileName,
} from '@/features/audio/lectureStorage';

import {
  splitTextForTranslation,
} from '@/features/audio/translationUtils';

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
  processingLockRef:
    MutableRefObject<
      ProcessingLock
    >;
};

export function useLectureTranslation({
  openedLectureId,
  openedTranscript,
  processingLockRef,
}: Params) {
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
            'The Norwegian transcript is empty.'
          );
        }

        const chunks =
          splitTextForTranslation(
            sourceText
          );

        if (
          chunks.length ===
            0
        ) {
          throw new Error(
            'There is no text to translate.'
          );
        }

        const result =
          await OfflineTranslator
            .translateChunks(
              chunks,
              'no',
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
            'ML Kit returned an incomplete translation.'
          );
        }

        const translatedText =
          translations
            .join(
              '\n\n'
            )
            .trim();

        if (!translatedText) {
          throw new Error(
            'ML Kit returned an empty translation.'
          );
        }

        const directory =
          getLectureDirectory(
            lecture.id
          );

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

        setOpenedTranslation(
          translatedText
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
          'Translation error',
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
    translationError,
    clearTranslationState,
    loadSavedTranslation,
    handleSelectTranslationTarget,
    handleTranslateTranscript,
  };
}

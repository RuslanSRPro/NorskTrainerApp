import { translationBlocks } from '@/features/audio/transcriptQuality';
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
  recoverPendingTextTransaction,
  getTranslationFileName,
  getTranslationSegmentsFileName,
  getTranslationSourceLanguageCode,
  readTranscriptSegments,
  readTranslationSegments,
  commitLectureTextSnapshot,
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
        recoverPendingTextTransaction(directory);

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
        recoverPendingTextTransaction(directory);

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

        // Use adjacent source context while preserving block-level seek times.
        const normalizeSource = (value: string) => value.replace(/\s+/g, ' ').trim();
        const timestampsCoverText = normalizeSource(sourceSegments.map(segment => segment.text).join(' ')) ===
          normalizeSource(sourceText);
        const sourceBlocks = timestampsCoverText ? translationBlocks(sourceSegments) : [];
        if (
          sourceBlocks.length >
            0
        ) {
          // Keep timestamped blocks intact in storage/UI; only requests are
          // split. A single long Whisper segment may exceed the merge budget.
          const sourceParts = sourceBlocks.map(segment => splitTextForTranslation(segment.text, 600));
          const sourceSegmentTexts = sourceParts.flat();

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
              sourceSegmentTexts.length ||
            translations.some(
              value =>
                !value
            )
          ) {
            throw new Error(
              audioUi.incompleteTimestampedTranslation
            );
          }

          let translatedOffset = 0;
          translatedSegments = sourceBlocks.map((segment, index) => {
            const end = translatedOffset + sourceParts[index].length;
            const text = translations.slice(translatedOffset, end).join(' ');
            translatedOffset = end;
            return { start: segment.start, end: segment.end, text };
          });

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

        commitLectureTextSnapshot(directory, {
          [getTranslationFileName(translationTarget)]: translatedText,
          [getTranslationSegmentsFileName(translationTarget)]: translatedSegments.length > 0
            ? JSON.stringify(translatedSegments) : null,
        });

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

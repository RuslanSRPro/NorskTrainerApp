import {
  useState,
} from 'react';

import {
  Alert,
} from 'react-native';

import {
  File,
  Paths,
} from 'expo-file-system';

import * as Sharing
  from 'expo-sharing';

import {
  strToU8,
  zipSync,
} from 'fflate';

import type {
  LectureItem,
} from '@/features/audio/lectureTypes';

import {
  buildTimestampText,
  formatLectureDate,
  getLectureDirectory,
  getTranslationFileName,
  getTranslationSegmentsFileName,
  readTranscriptSegments,
  readTranslationSegments,
  safeFileStem,
} from '@/features/audio/lectureStorage';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';

export type LectureExportKind =
  | 'audio'
  | 'transcript'
  | 'ukrainian'
  | 'timestamps'
  | 'zip';

export function useLectureExport() {
  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const [
    exportLectureId,
    setExportLectureId,
  ] =
    useState<string | null>(
      null
    );

  const [
    exportingLectureId,
    setExportingLectureId,
  ] =
    useState<string | null>(
      null
    );

  const shareLocalFile =
    async (
      file:
        File,
      unavailableMessage:
        string
    ) => {
      if (!file.exists) {
        throw new Error(
          unavailableMessage
        );
      }

      const sharingAvailable =
        await Sharing
          .isAvailableAsync();

      if (
        !sharingAvailable
      ) {
        throw new Error(
          audioUi.sharingUnavailable
        );
      }

      await Sharing.shareAsync(
        file.uri
      );
    };

  const copyToCacheForShare =
    async (
      source:
        File,
      fileName:
        string
    ) => {
      if (!source.exists) {
        throw new Error(
          audioUi.sourceFileMissing
        );
      }

      const target =
        new File(
          Paths.cache,
          fileName
        );

      if (target.exists) {
        target.delete();
      }

      await source.copy(
        target
      );

      return target;
    };

  const handleExportLecture =
    async (
      lecture:
        LectureItem,
      kind:
        LectureExportKind
    ) => {
      if (
        exportingLectureId
      ) {
        return;
      }

      try {
        setExportingLectureId(
          lecture.id
        );

        const directory =
          getLectureDirectory(
            lecture.id
          );

        const fallbackDate =
          (() => {
            if (!lecture.createdAt) {
              return audioUi.savedRecording;
            }

            const date =
              new Date(
                lecture.createdAt
              );

            return Number.isNaN(
              date.getTime()
            )
              ? audioUi.savedRecording
              : formatLectureDate(
                  lecture.createdAt
                );
          })();

        const stem =
          safeFileStem(
            lecture.title?.trim() ||
            fallbackDate
          );

        if (
          kind ===
            'audio'
        ) {
          const source =
            new File(
              lecture.audioUri
            );

          const extension =
            lecture.audioFileName
              .split('.')
              .pop()
              ?.toLowerCase() ||
            'm4a';

          const shareFile =
            await copyToCacheForShare(
              source,
              `${stem}.${extension}`
            );

          await shareLocalFile(
            shareFile,
            audioUi.audioFileMissing
          );
          return;
        }

        if (
          kind ===
            'transcript'
        ) {
          const source =
            new File(
              directory,
              'transcript.txt'
            );

          const shareFile =
            await copyToCacheForShare(
              source,
              `${stem}-transcript.txt`
            );

          await shareLocalFile(
            shareFile,
            audioUi.createTranscriptFirst
          );
          return;
        }

        if (
          kind ===
            'ukrainian'
        ) {
          const source =
            new File(
              directory,
              getTranslationFileName(
                'uk'
              )
            );

          const shareFile =
            await copyToCacheForShare(
              source,
              `${stem}-ukrainian.txt`
            );

          await shareLocalFile(
            shareFile,
            audioUi.createUkrainianFirst
          );
          return;
        }

        if (
          kind ===
            'timestamps'
        ) {
          const segments =
            lecture
              .transcriptSegments
              .length >
                0
              ? lecture
                  .transcriptSegments
              : readTranscriptSegments(
                  directory
                );

          if (
            segments.length ===
              0
          ) {
            throw new Error(
              audioUi.createTimestampsFirst
            );
          }

          const timestampFile =
            new File(
              Paths.cache,
              `${stem}-timestamps.txt`
            );

          timestampFile.create({
            overwrite: true,
            intermediates: true,
          });

          timestampFile.write(
            buildTimestampText(
              segments
            )
          );

          await shareLocalFile(
            timestampFile,
            audioUi.timestampTextCreateFailed
          );

          return;
        }

        const zipEntries:
          Record<
            string,
            Uint8Array
          > = {};

        const audioFile =
          new File(
            lecture.audioUri
          );

        if (!audioFile.exists) {
          throw new Error(
            audioUi.audioFileMissing
          );
        }

        zipEntries[
          lecture.audioFileName
        ] =
          audioFile.bytesSync();

        const transcriptFile =
          new File(
            directory,
            'transcript.txt'
          );

        if (
          transcriptFile.exists
        ) {
          zipEntries[
            'transcript.txt'
          ] =
            strToU8(
              transcriptFile
                .textSync()
            );
        }

        const segments =
          readTranscriptSegments(
            directory
          );

        if (
          segments.length >
            0
        ) {
          zipEntries[
            'transcript-timestamps.txt'
          ] =
            strToU8(
              buildTimestampText(
                segments
              )
            );

          const segmentsFile =
            new File(
              directory,
              'transcript-segments.json'
            );

          if (
            segmentsFile.exists
          ) {
            zipEntries[
              'transcript-segments.json'
            ] =
              segmentsFile
                .bytesSync();
          }
        }

        for (
          const target
          of ['uk', 'ru'] as const
        ) {
          const fileName =
            getTranslationFileName(
              target
            );

          const source =
            new File(
              directory,
              fileName
            );

          if (
            source.exists
          ) {
            zipEntries[
              fileName
            ] =
              source.bytesSync();
          }

          const translatedSegments =
            readTranslationSegments(
              directory,
              target
            );

          if (
            translatedSegments.length >
              0
          ) {
            zipEntries[
              `translation-${target}-timestamps.txt`
            ] =
              strToU8(
                buildTimestampText(
                  translatedSegments
                )
              );

            const translatedSegmentsFile =
              new File(
                directory,
                getTranslationSegmentsFileName(
                  target
                )
              );

            if (
              translatedSegmentsFile.exists
            ) {
              zipEntries[
                getTranslationSegmentsFileName(
                  target
                )
              ] =
                translatedSegmentsFile
                  .bytesSync();
            }
          }
        }

        for (
          const fileName
          of [
            'markers.json',
            'session.json',
            'whisper-debug.json',
          ]
        ) {
          const sourceFile =
            new File(
              directory,
              fileName
            );

          if (
            sourceFile.exists
          ) {
            zipEntries[
              fileName
            ] =
              sourceFile
                .bytesSync();
          }
        }

        /*
         * Still level 0 intentionally. M4A is already compressed.
         * Async/background ZIP remains a later optimization if
         * long-lecture testing proves this blocks the UI.
         */
        const zipped =
          zipSync(
            zipEntries,
            {
              level: 0,
            }
          );

        const zipFile =
          new File(
            Paths.cache,
            `${stem}-complete.zip`
          );

        zipFile.create({
          overwrite: true,
          intermediates: true,
        });

        zipFile.write(
          zipped
        );

        await shareLocalFile(
          zipFile,
          audioUi.zipCreateFailed
        );

      } catch (error) {
        if (__DEV__) {
          console.error(
            'Lecture export error:',
            error
          );
        }

        Alert.alert(
          audioUi.exportErrorTitle,
          error instanceof Error
            ? error.message
            : audioUi.exportFailed
        );

      } finally {
        setExportingLectureId(
          null
        );
      }
    };

  return {
    exportLectureId,
    exportingLectureId,
    setExportLectureId,
    handleExportLecture,
  };
}

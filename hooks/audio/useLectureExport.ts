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
  getLectureDirectory,
  getTranslationFileName,
  readTranscriptSegments,
  safeFileStem,
} from '@/features/audio/lectureStorage';

export type LectureExportKind =
  | 'audio'
  | 'transcript'
  | 'ukrainian'
  | 'timestamps'
  | 'zip';

export function useLectureExport() {
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
          'Sharing is not available on this device.'
        );
      }

      await Sharing.shareAsync(
        file.uri
      );
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

        const stem =
          safeFileStem(
            lecture.id
          );

        if (
          kind ===
            'audio'
        ) {
          await shareLocalFile(
            new File(
              lecture.audioUri
            ),
            'The audio file is missing.'
          );
          return;
        }

        if (
          kind ===
            'transcript'
        ) {
          await shareLocalFile(
            new File(
              directory,
              'transcript.txt'
            ),
            'Create a transcript first.'
          );
          return;
        }

        if (
          kind ===
            'ukrainian'
        ) {
          await shareLocalFile(
            new File(
              directory,
              getTranslationFileName(
                'uk'
              )
            ),
            'Create the Ukrainian translation first.'
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
              'Create or recreate the transcript with timestamps first.'
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
            'The timestamp text could not be created.'
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
            'The audio file is missing.'
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
          'The ZIP package could not be created.'
        );

      } catch (error) {
        if (__DEV__) {
          console.error(
            'Lecture export error:',
            error
          );
        }

        Alert.alert(
          'Export error',
          error instanceof Error
            ? error.message
            : 'The lecture could not be exported.'
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

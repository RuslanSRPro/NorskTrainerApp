import {
  useState,
  useRef,
} from 'react';

import {
  Alert,
} from 'react-native';

import {
  File,
  FileMode,
  Paths,
} from 'expo-file-system';

import * as Sharing
  from 'expo-sharing';

import {
  strToU8,
  Zip,
  ZipPassThrough,
} from 'fflate';

import type {
  LectureItem,
} from '@/features/audio/lectureTypes';

import {
  buildTimestampText,
  formatLectureDate,
  getLectureDirectory,
  recoverPendingTextTransaction,
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

// M4A is already compressed. Stream stored ZIP entries in bounded chunks,
// writing each emitted output directly to the cache file instead of collecting it.
export async function writeStreamingLectureZip(target: File, entries: Record<string, File | Uint8Array>) {
  const limit = 0xff000000; // Classic ZIP; leave room for headers/central directory.
  let total = 0;
  for (const value of Object.values(entries)) {
    const size = value instanceof File ? value.size : value.length;
    if (!Number.isFinite(size) || size < 0 || (total += size) > limit) {
      throw new Error('This ZIP exceeds the supported size. Export the audio separately.');
    }
  }
  target.create({ overwrite: true, intermediates: true });
  let output: ReturnType<File['open']> | null = null;
  let failure: unknown = null;
  let completed = false;
  let zip: Zip | null = null;
  try {
    output = target.open(FileMode.WriteOnly);
    zip = new Zip((error, data, final) => {
      if (error) { failure = error; return; }
      if (failure) return;
      try { output!.writeBytes(data); completed = final; }
      catch (error) { failure = error; }
    });
    let sinceYield = 0;
    for (const [name, value] of Object.entries(entries)) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      let input: ReturnType<File['open']> | null = null;
      try {
        const length = value instanceof File ? value.size : value.length;
        if (value instanceof File) input = value.open(FileMode.ReadOnly);
        for (let offset = 0; offset < length;) {
          const count = Math.min(64 * 1024, length - offset);
          const chunk = input ? input.readBytes(count) : (value as Uint8Array).subarray(offset, offset + count);
          if (chunk.length !== count) throw new Error('A ZIP source changed or could not be read completely.');
          offset += count;
          entry.push(chunk, offset === length);
          if (failure) throw failure;
          sinceYield += count;
          if (sinceYield >= 1024 * 1024) {
            sinceYield = 0;
            await new Promise<void>(resolve => setTimeout(resolve, 0));
          }
        }
        if (length === 0) entry.push(new Uint8Array(), true);
        if (failure) throw failure;
      } finally { input?.close(); }
    }
    zip.end();
    if (failure) throw failure;
    if (!completed) throw new Error('The ZIP did not finish.');
    output.close();
    output = null;
  } catch (error) {
    zip?.terminate();
    try { output?.close(); } catch {}
    output = null;
    try { if (target.exists) target.delete(); } catch {}
    throw error;
  }
}

export type LectureExportKind =
  | 'audio'
  | 'transcript'
  | 'ukrainian'
  | 'timestamps'
  | 'zip';

export function useLectureExport() {
  const exportInFlightRef = useRef(false);
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
        exportInFlightRef.current
      ) {
        return;
      }

      exportInFlightRef.current = true;
      try {
        setExportingLectureId(
          lecture.id
        );

        const directory =
          getLectureDirectory(
            lecture.id
          );
        if (kind !== 'audio') recoverPendingTextTransaction(directory);

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
            File | Uint8Array
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
          audioFile;

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

        const zipFile =
          new File(
            Paths.cache,
            `${stem}-complete.zip`
          );

        await writeStreamingLectureZip(zipFile, zipEntries);

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
        exportInFlightRef.current = false;
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

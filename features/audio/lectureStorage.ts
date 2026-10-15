import { Platform } from 'react-native';
import LectureRecorder from '@/modules/lecturerecorder';
import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import type {
  LectureMarker,
  LectureSourceLanguage,
  LectureMarkerType,
  LectureMetadata,
  LectureTranscription,
  SavedTranscriptSegment,
  TranscriptionChunk,
  TranslationTarget,
} from './lectureTypes';

const TEXT_JOURNAL = '.derived-text-transaction.json';
type TextUpdates = Record<string, string | null>;
type TextJournal = { version: 1; state: 'prepared' | 'committed'; before: TextUpdates };

function parentDirectory(file: File) {
  return new Directory(file.uri.slice(0, file.uri.lastIndexOf('/')));
}

export function writeTextFile(file: File, text: string) {
  if (Platform.OS === 'ios') {
    const parent = parentDirectory(file);
    if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
    LectureRecorder.writeTextSnapshot(file.uri, text);
    return;
  }
  file.create({ overwrite: true, intermediates: true });
  file.write(text);
}

function checkTextUpdates(value: unknown): asserts value is TextUpdates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid derived text transaction. Recovery data was preserved.');
  }
  const entries = Object.entries(value);
  if (entries.length > 16 || entries.some(([name, text]) =>
    !/^(session\.json|transcript\.txt|transcript-segments\.json|translation-(uk|ru)(\.txt|-segments\.json))$/.test(name) ||
    (text !== null && typeof text !== 'string')
  )) throw new Error('Unsafe derived text transaction. Recovery data was preserved.');
}

function applyTextUpdates(directory: Directory, updates: TextUpdates) {
  for (const [name, text] of Object.entries(updates)) {
    const file = new File(directory, name);
    if (text === null) {
      if (file.exists) file.delete();
    } else {
      writeTextFile(file, text);
    }
  }
}

// Called before reading metadata or writing another snapshot. A prepared journal
// restores the entire previous group; a committed journal only needs cleanup.
export function recoverPendingTextTransaction(directory: Directory) {
  const journalFile = new File(directory, TEXT_JOURNAL);
  if (!journalFile.exists) return;
  const journal = JSON.parse(journalFile.textSync()) as TextJournal;
  if (journal.version !== 1 || !['prepared', 'committed'].includes(journal.state)) {
    throw new Error('Unknown derived text transaction. Recovery data was preserved.');
  }
  checkTextUpdates(journal.before);
  if (journal.state === 'prepared') {
    applyTextUpdates(directory, journal.before);
    // A journal that cannot be removed must not roll back a later successful
    // write. Persist the completed rollback before permitting another writer.
    writeTextFile(journalFile, JSON.stringify({ ...journal, state: 'committed' }));
  }
  // Failed cleanup after a committed/rolled-back group must not undo success.
  try { journalFile.delete(); } catch {}
}

// No await is allowed between journal preparation and commit: JS callers cannot
// interleave another snapshot in this transaction. Audio/manifest are excluded.
export function commitLectureTextSnapshot(directory: Directory, updates: TextUpdates) {
  checkTextUpdates(updates);
  if (!directory.exists) throw new Error('The lecture directory no longer exists.');
  recoverPendingTextTransaction(directory);
  const before: TextUpdates = {};
  for (const name of Object.keys(updates)) {
    const file = new File(directory, name);
    before[name] = file.exists ? file.textSync() : null;
  }
  const journalFile = new File(directory, TEXT_JOURNAL);
  const journal: TextJournal = { version: 1, state: 'prepared', before };
  writeTextFile(journalFile, JSON.stringify(journal));
  try {
    applyTextUpdates(directory, updates);
    writeTextFile(journalFile, JSON.stringify({ ...journal, state: 'committed' }));
  } catch (failure) {
    try { recoverPendingTextTransaction(directory); }
    catch { throw new Error(`Text save failed; recovery journal retained. ${String(failure)}`); }
    throw failure;
  }
  try { journalFile.delete(); } catch {}
}

const CHUNK_SECONDS =
  5 * 60;

export function safeFileStem(
  value: string
) {
  return value
    .normalize('NFKC')
    .replace(
      /[^\p{L}\p{N}_-]+/gu,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .replace(
      /^-|-$/g,
      ''
    ) ||
    'lecture';
}

export function isMeaningfulTranscriptText(
  value: string
) {
  const text =
    String(
      value || ''
    ).trim();

  if (!text) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(
    text
  );
}

export function formatTime(
  milliseconds: number
) {
  const totalSeconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      hours,
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  return [
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

export function formatPlaybackTime(
  seconds: number
) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '00:00';
  }

  return formatTime(
    seconds * 1000
  );
}

export function buildTimestampText(
  segments:
    SavedTranscriptSegment[]
) {
  return segments
    .map(
      segment =>
        `${formatPlaybackTime(
          segment.start
        )}–${formatPlaybackTime(
          segment.end
        )}  ${segment.text}`
    )
    .join(
      '\n\n'
    )
    .trim();
}

export function normalizeLectureLanguage(
  value:
    string | null | undefined
): LectureSourceLanguage {
  const normalized =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();

  return normalized === 'en' ||
    normalized === 'en-us' ||
    normalized === 'en-gb'
    ? 'en'
    : 'nb-NO';
}

export function getLectureLanguageUi(
  value:
    string | null | undefined
) {
  const language =
    normalizeLectureLanguage(
      value
    );

  return language === 'en'
    ? {
        code: 'EN',
        flag: '🇬🇧',
        label: 'English',
        locale: 'en',
      } as const
    : {
        code: 'NO',
        flag: '🇳🇴',
        label: 'Norsk',
        locale: 'nb-NO',
      } as const;
}

export function getWhisperLanguageCode(
  value:
    string | null | undefined
) {
  return normalizeLectureLanguage(
    value
  ) === 'en'
    ? 'en'
    : 'no';
}

export function getTranslationSourceLanguageCode(
  value:
    string | null | undefined
) {
  return getWhisperLanguageCode(
    value
  );
}

export function normalizeMicDb(
  rawDb:
    number | undefined
) {
  const db =
    Number.isFinite(rawDb)
      ? Number(rawDb)
      : -160;

  return Math.min(
    1,
    Math.max(
      0,
      (db + 60) / 60
    )
  );
}

export function formatLectureDate(
  value:
    string | null
) {
  if (!value) {
    return 'Saved lecture';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Saved lecture';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date);
}

export function getImportedAudioExtension(
  fileName: string
) {
  const extension =
    fileName
      .split('.')
      .pop()
      ?.toLowerCase()
      .trim() ??
    '';

  const supported =
    new Set([
      'm4a',
      'mp3',
      'wav',
      'aac',
      'caf',
      'mp4',
      'mpeg',
      'mpga',
    ]);

  return supported.has(
    extension
  )
    ? extension
    : null;
}

export function getLectureDirectory(
  id: string
) {
  return new Directory(
    Paths.document,
    'lectures',
    id
  );
}

export function createChunkPlan(
  durationMillis: number
): LectureTranscription {
  const totalSeconds =
    Math.max(
      1,
      Math.ceil(
        durationMillis / 1000
      )
    );

  const chunks:
    TranscriptionChunk[] =
      [];

  let fromSeconds = 0;
  let index = 0;

  while (
    fromSeconds <
      totalSeconds
  ) {
    const toSeconds =
      Math.min(
        fromSeconds +
          CHUNK_SECONDS,
        totalSeconds
      );

    chunks.push({
      index,
      fromSeconds,
      toSeconds,
      status: 'pending',
      textFile: null,
      error: null,
    });

    fromSeconds =
      toSeconds;

    index += 1;
  }

  return {
    mode:
      'whisperkit-local',
    status:
      'not_started',
    chunkSeconds:
      CHUNK_SECONDS,
    processedUntilSeconds:
      0,
    chunks,
    error:
      null,
  };
}

export function getDefaultTranscription(
  durationMillis: number
) {
  return createChunkPlan(
    durationMillis
  );
}

export function readJsonArray<T>(
  file: File
): T[] {
  recoverPendingTextTransaction(parentDirectory(file));
  if (!file.exists) {
    return [];
  }

  try {
    const value =
      JSON.parse(
        file.textSync()
      );

    return Array.isArray(
      value
    )
      ? value as T[]
      : [];
  } catch {
    return [];
  }
}

export function writeJsonArray<T>(file: File, value: T[]) {
  recoverPendingTextTransaction(parentDirectory(file));
  writeTextFile(file, JSON.stringify(value, null, 2));
}

export function readLectureMarkers(
  directory:
    Directory
): LectureMarker[] {
  const file =
    new File(
      directory,
      'markers.json'
    );

  return readJsonArray<LectureMarker>(
    file
  )
    .filter(
      marker =>
        Number.isFinite(
          marker.timeMillis
        ) &&
        marker.timeMillis >=
          0 &&
        typeof marker.type ===
          'string'
    )
    .sort(
      (a, b) =>
        a.timeMillis -
        b.timeMillis
    );
}

export function writeLectureMarkers(
  directory:
    Directory,
  markers:
    LectureMarker[]
) {
  writeJsonArray(
    new File(
      directory,
      'markers.json'
    ),
    markers
  );
}

export function readTranscriptSegments(
  directory:
    Directory
): SavedTranscriptSegment[] {
  const file =
    new File(
      directory,
      'transcript-segments.json'
    );

  return readJsonArray<SavedTranscriptSegment>(
    file
  )
    .map(
      segment => ({
        start:
          Number(
            segment.start
          ),
        end:
          Number(
            segment.end
          ),
        text:
          String(
            segment.text || ''
          ).trim(),
        noSpeechProb:
          Number.isFinite(
            segment.noSpeechProb
          )
            ? Number(
                segment.noSpeechProb
              )
            : undefined,
        avgLogProb:
          Number.isFinite(
            segment.avgLogProb
          )
            ? Number(
                segment.avgLogProb
              )
            : undefined,
      })
    )
    .filter(
      segment =>
        Number.isFinite(
          segment.start
        ) &&
        Number.isFinite(
          segment.end
        ) &&
        segment.start >=
          0 &&
        segment.end >=
          segment.start &&
        isMeaningfulTranscriptText(
          segment.text
        )
    )
    .sort(
      (a, b) =>
        a.start -
        b.start
    );
}

export function getTranslationSegmentsFileName(
  target:
    TranslationTarget
) {
  return `translation-${target}-segments.json`;
}

export function readTranslationSegments(
  directory:
    Directory,
  target:
    TranslationTarget
): SavedTranscriptSegment[] {
  const file =
    new File(
      directory,
      getTranslationSegmentsFileName(
        target
      )
    );

  return readJsonArray<SavedTranscriptSegment>(
    file
  )
    .map(
      segment => ({
        start:
          Number(
            segment.start
          ),
        end:
          Number(
            segment.end
          ),
        text:
          String(
            segment.text || ''
          ).trim(),
      })
    )
    .filter(
      segment =>
        Number.isFinite(
          segment.start
        ) &&
        Number.isFinite(
          segment.end
        ) &&
        segment.start >=
          0 &&
        segment.end >=
          segment.start &&
        isMeaningfulTranscriptText(
          segment.text
        )
    )
    .sort(
      (a, b) =>
        a.start -
        b.start
    );
}

export function markerLabel(
  type:
    LectureMarkerType
) {
  switch (type) {
  case 'important':
    return '⭐ Important';
  case 'unclear':
    return '❓ Unclear';
  case 'repeat':
    return '🔁 Repeat';
  case 'term':
    return '🆕 New term';
  default:
    return '⭐ Important';
  }
}

export function readMetadata(
  directory:
    Directory
): LectureMetadata {
  recoverPendingTextTransaction(directory);
  const metadataFile =
    new File(
      directory,
      'session.json'
    );

  if (
    !metadataFile.exists
  ) {
    return {};
  }

  try {
    return JSON.parse(
      metadataFile
        .textSync()
    ) as LectureMetadata;
  } catch {
    return {};
  }
}

export function writeMetadata(directory: Directory, metadata: LectureMetadata) {
  recoverPendingTextTransaction(directory);
  writeTextFile(new File(directory, 'session.json'), JSON.stringify(metadata, null, 2));
}

export function findAudioFile(
  directory:
    Directory,
  metadata:
    LectureMetadata
) {
  const candidates = [
    metadata.audioFile,
    'audio.m4a',
    'audio.mp3',
    'audio.wav',
    'audio.aac',
    'audio.caf',
    'audio.mp4',
    'audio.mpeg',
    'audio.mpga',
  ].filter(
    (
      value
    ): value is string =>
      !!value
  );

  for (
    const name
    of candidates
  ) {
    const file =
      new File(
        directory,
        name
      );

    if (
      file.exists
    ) {
      return {
        file,
        name,
      };
    }
  }

  return null;
}

export function getTranslationFileName(
  target:
    TranslationTarget
) {
  return `translation-${target}.txt`;
}

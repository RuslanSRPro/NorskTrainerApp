import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import type {
  LectureMarker,
  LectureMarkerType,
  LectureMetadata,
  LectureTranscription,
  SavedTranscriptSegment,
  TranscriptionChunk,
  TranslationTarget,
} from './lectureTypes';

const CHUNK_SECONDS =
  5 * 60;

export function safeFileStem(
  value: string
) {
  return value
    .replace(
      /[^a-zA-Z0-9_-]+/g,
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

export function writeJsonArray<T>(
  file: File,
  value: T[]
) {
  file.create({
    overwrite: true,
    intermediates: true,
  });

  file.write(
    JSON.stringify(
      value,
      null,
      2
    )
  );
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

export function writeMetadata(
  directory:
    Directory,
  metadata:
    LectureMetadata
) {
  const metadataFile =
    new File(
      directory,
      'session.json'
    );

  metadataFile.create({
    overwrite: true,
    intermediates: true,
  });

  metadataFile.write(
    JSON.stringify(
      metadata,
      null,
      2
    )
  );
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

import { matchSpeakerWindow } from './speakerGrouping';
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

// A UI deadline settles only the caller; it does not cancel or release a native
// recording/archive/inference owner. Late native results cannot settle it twice.
export function withAudioOperationDeadline<T>(work: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded its deadline. Saved audio is preserved; retry when native cleanup finishes.`)), milliseconds);
    work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export type LectureAudioCandidate = { id: string; key: string; uri: string };
export class LectureAudioValidationQueue {
  private cache = new Map<string, { key: string; ready: boolean | undefined; attempt: number; retryAt: number }>();
  private current = new Map<string, string>();
  private pending = new Map<string, LectureAudioCandidate>();
  private retries = new Map<string, ReturnType<typeof setTimeout>>();
  private epochs = new Map<string, number>();
  private nextEpoch = 0;
  private active: LectureAudioCandidate | null = null;
  private running = false;
  private disposed = false;
  constructor(
    private validate: (uri: string) => Promise<{ valid: boolean; playable: boolean; bytes: number; durationMillis: number }>,
    private changed: () => void,
  ) {}
  result(id: string, key: string): boolean | undefined {
    const found = this.cache.get(id);
    if (found?.key !== key) return undefined;
    return found.ready === false && Date.now() >= found.retryAt ? undefined : found.ready;
  }
  private cancelRetry(id: string) {
    const timer = this.retries.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.retries.delete(id);
  }
  invalidate(id: string) {
    this.epochs.set(id, ++this.nextEpoch);
    this.cache.delete(id);
    this.cancelRetry(id);
  }
  resume() { this.disposed = false; }
  dispose() {
    this.disposed = true;
    if (this.active) this.invalidate(this.active.id);
    for (const id of this.retries.keys()) this.cancelRetry(id);
    this.pending.clear(); this.current.clear();
  }
  submit(jobs: LectureAudioCandidate[]) {
    if (this.disposed) return;
    this.current = new Map(jobs.map(job => [job.id, job.key]));
    this.pending.clear();
    for (const id of this.retries.keys()) if (!this.current.has(id)) this.cancelRetry(id);
    for (const id of this.cache.keys()) if (!this.current.has(id)) this.cache.delete(id);
    for (const job of jobs) {
      const cached = this.cache.get(job.id);
      if (cached?.key === job.key && (cached.ready === true || Date.now() < cached.retryAt)) continue;
      this.cancelRetry(job.id);
      if (this.active?.id === job.id && this.active.key === job.key) continue;
      this.pending.set(job.id, job);
    }
    void this.run();
  }
  private async run() {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (!this.disposed && this.pending.size > 0) {
        const job = this.pending.values().next().value!;
        this.pending.delete(job.id); this.active = job;
        const epoch = this.epochs.get(job.id) ?? 0;
        const previous = this.cache.get(job.id);
        const priorAttempt = previous?.key === job.key && previous.attempt < 3 ? previous.attempt : 0;
        const attempt = priorAttempt + 1;
        let ready: boolean | undefined;
        try {
          const value = await withAudioOperationDeadline(this.validate(job.uri), 10000, 'Audio validation');
          ready = value.valid && value.playable && value.bytes >= 4096 && value.durationMillis >= 500;
        } catch {
          // Timeout/exception means unknown, not evidence that saved audio is corrupt.
          ready = undefined;
        }
        this.active = null;
        if (this.disposed || this.current.get(job.id) !== job.key) continue;
        if ((this.epochs.get(job.id) ?? 0) !== epoch) {
          this.pending.set(job.id, job); continue; // Explicit invalidation supersedes this result.
        }
        const delay = attempt === 1 ? 1000 : attempt === 2 ? 5000 : 30000;
        this.cache.set(job.id, { key: job.key, ready, attempt, retryAt: ready === true ? Infinity : Date.now() + delay });
        this.cancelRetry(job.id);
        if (ready !== true && attempt < 3) {
          this.retries.set(job.id, setTimeout(() => {
            this.retries.delete(job.id);
            if (this.disposed || this.current.get(job.id) !== job.key || (this.epochs.get(job.id) ?? 0) !== epoch) return;
            this.pending.set(job.id, job); void this.run();
          }, delay));
        }
        const previousReady = previous?.key === job.key ? previous.ready : undefined;
        if (ready !== previousReady) {
          try { this.changed(); } catch { /* A later library refresh can read the cache. */ }
        }
      }
    } finally { this.active = null; this.running = false; }
  }
}

export function trimLiveWindowOverlap(previous: SavedTranscriptSegment[], incoming: SavedTranscriptSegment): SavedTranscriptSegment | null {
  // Timing alone is not proof of duplicate speech. Preserve corrections and
  // short repeated replies; trim only a multiword match in overlapping audio.
  const last = previous[previous.length - 1];
  if (!last || incoming.start >= last.end - 0.01 || incoming.end <= last.start ||
      incoming.speakerId !== last.speakerId) return incoming;
  // Unknown speaker IDs are not evidence of identity. A mere intersection
  // can contain a genuinely repeated phrase. Require near-identical intervals
  // before treating matching multiword text as a second recognition of it.
  const timingTolerance = 0.15;
  if (!Number.isFinite(incoming.start) || !Number.isFinite(incoming.end) ||
      !Number.isFinite(last.start) || !Number.isFinite(last.end) ||
      incoming.end <= incoming.start || last.end <= last.start ||
      Math.abs(incoming.start - last.start) > timingTolerance ||
      Math.abs(incoming.end - last.end) > timingTolerance) return incoming;
  const tokens = (text: string) => [...text.matchAll(/[\p{L}\p{N}]+/gu)];
  const before = tokens(last.text).map(token => token[0].toLowerCase());
  const words = tokens(incoming.text);
  let overlap = 0;
  for (let size = Math.min(before.length, words.length); size >= 3; size--) {
    if (before.slice(-size).every((word, index) => word === words[index][0].toLowerCase())) {
      overlap = size; break;
    }
  }
  if (!overlap) return incoming;
  if (overlap === words.length) return null;
  // A contained correction has no reliable word timestamps: keep its original
  // interval instead of moving its start past its end.
  const text = incoming.text.slice(words[overlap].index).trim();
  const start = incoming.end > last.end ? Math.max(incoming.start, last.end) : incoming.start;
  return { ...incoming, text, start };
}

const lectureRecoveries = new Set<string>();
export function claimLectureRecovery(uri: string) { if (lectureRecoveries.has(uri)) return false; lectureRecoveries.add(uri); return true; }
export function releaseLectureRecovery(uri: string) { lectureRecoveries.delete(uri); }

// A deleted/replaced lecture invalidates outstanding JS publishers in this run.
const lectureWorkGenerations = new Map<string, number>();
export function invalidateLectureWork(id: string) {
  lectureWorkGenerations.set(id, (lectureWorkGenerations.get(id) ?? 0) + 1);
}
export function lectureWorkGeneration(id: string) { return lectureWorkGenerations.get(id) ?? 0; }

export const MAX_TRANSCRIPTION_WINDOW_SECONDS = 60;
export type DurableTranscriptSource = { uri: string; durationSeconds: number; globalStartSeconds: number };
export type DurableTranscriptInventory = {
  sources: DurableTranscriptSource[]; durationMillis: number; bytes: number;
  present: boolean; complete: boolean; unresolved: boolean; partialRecovery: boolean; error: string | null;
};
export function inspectDurableTranscriptInventory(directory: Directory, expectedMillis = 0): DurableTranscriptInventory {
  const result: DurableTranscriptInventory = { sources: [], durationMillis: 0, bytes: 0, present: false, complete: false, unresolved: false, partialRecovery: false, error: null };
  try {
    const folder = new Directory(directory, '.audio-segments');
    const entries = folder.exists ? folder.list().filter((item): item is File => item instanceof File) : [];
    result.present = entries.some(file => /^segment-/.test(file.name));
    result.unresolved = entries.some(file => /^segment-.*\.part\.m4a$/.test(file.name));
    if (result.unresolved) throw new Error('An unresolved partial audio tail requires recovery.');
    const manifestFile = new File(directory, 'recording-manifest.json');
    if (!manifestFile.exists) { if (result.present) throw new Error('Durable manifest is missing.'); return result; }
    result.present = true;
    const manifest = JSON.parse(manifestFile.textSync());
    result.partialRecovery = manifest?.recovery?.partial === true &&
      manifest?.recovery?.reason === 'terminal_crash_tail';
    if (!Array.isArray(manifest.segments) || !manifest.segments.length) throw new Error('No committed audio segments.');
    const names = new Set<string>();
    for (let index = 0; index < manifest.segments.length; index++) {
      const segment = manifest.segments[index];
      if (segment?.status !== 'committed' || segment.index !== index + 1 ||
          typeof segment.file !== 'string' || !/^segment-\d{6}\.m4a$/.test(segment.file) ||
          Number(segment.file.slice(8,14)) !== segment.index || names.has(segment.file) ||
          !Number.isSafeInteger(segment.durationMillis) || segment.durationMillis <= 0 ||
          !Number.isSafeInteger(segment.bytes) || segment.bytes <= 0) throw new Error('Invalid or discontinuous durable segment inventory.');
      const file = new File(folder, segment.file);
      if (!file.exists || file.size !== segment.bytes) throw new Error('A committed audio segment is missing or changed.');
      names.add(segment.file);
      result.sources.push({uri:file.uri, durationSeconds:segment.durationMillis / 1000, globalStartSeconds:result.durationMillis / 1000});
      result.durationMillis += segment.durationMillis; result.bytes += segment.bytes;
    }
    result.present = true;
    const actual = entries.filter(file => /^segment-.*\.m4a$/.test(file.name));
    if (actual.length !== names.size || actual.some(file => !names.has(file.name))) throw new Error('Unlisted durable audio requires reconciliation.');
    if (!Number.isSafeInteger(manifest.committedDurationMillis) || manifest.committedDurationMillis !== result.durationMillis) throw new Error('Manifest duration does not match its committed inventory.');
    // Millisecond rounding per segment and container timebase differences only.
    const toleranceMillis = Math.max(1000, manifest.segments.length);
    if (expectedMillis > 0 && Math.abs(expectedMillis - result.durationMillis) > toleranceMillis) throw new Error('Durable segments do not cover the expected recording duration.');
    result.complete = true;
  } catch (error) { result.error = String(error); result.sources = []; }
  return result;
}

export async function validateLectureAudio(uri: string) {
  return withAudioOperationDeadline(LectureRecorder.validateRecording(uri), 10000, 'Audio validation');
}

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
    !/^(session\.json|transcript\.txt|transcript-segments\.json|speaker-analysis(-progress)?\.json|translation-(uk|ru)(\.txt|-segments\.json))$/.test(name) ||
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
  const changes: TextUpdates = {};
  for (const name of Object.keys(updates)) {
    const file = new File(directory, name);
    before[name] = file.exists ? file.textSync() : null;
    if (before[name] !== updates[name]) changes[name] = updates[name];
    else delete before[name];
  }
  if (Object.keys(changes).length === 0) return;
  const journalFile = new File(directory, TEXT_JOURNAL);
  const journal: TextJournal = { version: 1, state: 'prepared', before };
  writeTextFile(journalFile, JSON.stringify(journal));
  try {
    applyTextUpdates(directory, changes);
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
        )}  ${speakerLabel(segment)}${speakerLabel(segment) ? ": " : ""}${segment.text}`
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
    Directory,
  includeSpeakers = true
): SavedTranscriptSegment[] {
  const file =
    new File(
      directory,
      'transcript-segments.json'
    );

  const segments = readJsonArray<SavedTranscriptSegment>(
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
  return includeSpeakers ? annotateSpeakerSegments(segments, readSpeakerAnalysis(directory, segments)) : segments;
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
  if (!directory.exists) throw new Error("The lecture was deleted; metadata publication was discarded.");
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

// Speaker analysis is derived data. Original transcript, audio and manifest are never rewritten.
export type SpeakerWindow = { uri: string; start: number; end: number; offset: number };
export type SpeakerTurn = { start: number; end: number; speakerId: number | null };
export type SpeakerProfile = { id: number; centroid: number[]; weight: number; name?: string; anchors?: number[][] };
export type SpeakerAnalysis = {
  version: 1; engine: 'speakerkit-1.1.1-v3-r1' | 'speakerkit-1.1.1-v3-r2'; transcriptKey: string; sourceKey: string;
  status: 'processing' | 'done' | 'error' | 'cancelled'; nextWindow: number; totalWindows: number;
  profiles: SpeakerProfile[]; turns: SpeakerTurn[]; error?: string;
  processedUntilSeconds?: number;
};
export const SPEAKER_ANALYSIS_FILE = 'speaker-analysis.json';
export const SPEAKER_PROGRESS_FILE = 'speaker-analysis-progress.json';
export function speakerTranscriptKey(segments: SavedTranscriptSegment[]): string {
  // Two independent 32-bit streams + length; not used as an authentication hash.
  const value = JSON.stringify(segments.map(s => [s.start, s.end, s.text]));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
  return `${value.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export function speakerWindowPlan(sources: DurableTranscriptSource[], overlapSeconds = 0): SpeakerWindow[] {
  if (!Number.isFinite(overlapSeconds) || overlapSeconds < 0 || overlapSeconds > 30) throw new Error("Invalid speaker overlap.");
  const windows: SpeakerWindow[] = [];
  let expected = 0;
  for (const source of sources) {
    if (!Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0 ||
        !Number.isFinite(source.globalStartSeconds) || Math.abs(source.globalStartSeconds - expected) > 0.01 ||
        expected + source.durationSeconds > 86400) throw new Error('Speaker analysis requires continuous audio of at most 24 hours.');
    for (let start = 0; start < source.durationSeconds - 0.0001; start += 60 - overlapSeconds) {
      windows.push({uri:source.uri,start,end:Math.min(start + 60, source.durationSeconds),offset:source.globalStartSeconds});
      if (start + 60 >= source.durationSeconds - 0.0001) break;
    }
    expected += source.durationSeconds;
  }
  if (!windows.length) throw new Error('No verified audio is available for speaker analysis.');
  return windows;
}
export function speakerSourceKey(windows: SpeakerWindow[]): string {
  const stamps = new Map<string, string>();
  for (const w of windows) if (!stamps.has(w.uri)) {
    const file = new File(w.uri);
    if (!file.exists || file.size <= 0) throw new Error('Speaker audio source is missing.');
    stamps.set(w.uri, `${file.size}:${file.modificationTime ?? ''}`);
  }
  return JSON.stringify(windows.map(w => [w.uri, stamps.get(w.uri), w.start, w.end, w.offset]));
}
function normalizedVoice(vector: number[]): number[] | null {
  if (!Array.isArray(vector) || vector.length < 2 || vector.length > 1024 || vector.some(v => !Number.isFinite(v))) return null;
  const norm = Math.sqrt(vector.reduce((n,v) => n + v*v, 0));
  return norm > 1e-10 && Number.isFinite(norm) ? vector.map(v => v/norm) : null;
}
export function readSpeakerAnalysis(directory: Directory, segments: SavedTranscriptSegment[],
  fileName: typeof SPEAKER_ANALYSIS_FILE | typeof SPEAKER_PROGRESS_FILE = SPEAKER_ANALYSIS_FILE): SpeakerAnalysis | null {
  try {
    const f = new File(directory, fileName);
    if (!f.exists || f.size > 32 * 1024 * 1024) return null;
    const s: SpeakerAnalysis = JSON.parse(f.textSync());
    if (s.version !== 1 || !['speakerkit-1.1.1-v3-r1','speakerkit-1.1.1-v3-r2'].includes(s.engine) || s.transcriptKey !== speakerTranscriptKey(segments) ||
        !['processing','done','error','cancelled'].includes(s.status) ||
        !Number.isSafeInteger(s.nextWindow) || !Number.isSafeInteger(s.totalWindows) ||
        s.nextWindow < 0 || s.nextWindow > s.totalWindows || s.totalWindows > 20000 ||
        typeof s.sourceKey !== 'string' || !Array.isArray(s.profiles) || s.profiles.length > 16 ||
        !Array.isArray(s.turns) || s.turns.length > 300000) return null;
    const stamps: unknown = JSON.parse(s.sourceKey);
    if (!Array.isArray(stamps) || stamps.length !== s.totalWindows) return null;
    const checked = new Set<string>();
    for (const stamp of stamps) {
      if (!Array.isArray(stamp) || typeof stamp[0] !== 'string' ||
          !stamp[0].startsWith(directory.uri.replace(/\/$/, '') + '/')) return null;
      if (checked.has(stamp[0])) continue;
      const source = new File(stamp[0]);
      if (!source.exists || `${source.size}:${source.modificationTime ?? ''}` !== stamp[1]) return null;
      checked.add(stamp[0]);
    }
    const ids = new Set<number>();
    for (const p of s.profiles) {
      if (!Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) || !normalizedVoice(p.centroid) ||
          !Number.isFinite(p.weight) || p.weight <= 0 || p.name !== undefined && (typeof p.name !== 'string' || p.name.length > 80)) return null;
      if (p.anchors !== undefined && (!Array.isArray(p.anchors) || p.anchors.length < 1 || p.anchors.length > 4 ||
          p.anchors.some(vector => !normalizedVoice(vector) || vector.length !== p.centroid.length))) return null;
      ids.add(p.id);
    }
    if (s.turns.some(t => !Number.isFinite(t.start) || !Number.isFinite(t.end) || t.start < 0 || t.end <= t.start ||
      t.end > 86401 || t.speakerId !== null && !ids.has(t.speakerId))) return null;
    if (s.engine === 'speakerkit-1.1.1-v3-r2') {
      const last = s.nextWindow > 0 ? stamps[s.nextWindow - 1] : null;
      const expected = last ? Number(last[3]) + Number(last[4]) : 0;
      if (!Number.isFinite(s.processedUntilSeconds) || !Number.isFinite(expected) || expected < 0 || expected > 86401 ||
          Math.abs((s.processedUntilSeconds ?? -1) - expected) > 0.15) return null;
    }
    if (s.status === 'done' && s.nextWindow !== s.totalWindows) return null;
    return s;
  } catch { return null; }
}
export function applySpeakerWindow(
  state: SpeakerAnalysis, window: SpeakerWindow,
  result: {ok: boolean; startSeconds: number; endSeconds: number;
    turns: {start:number;end:number;speakerIds:number[]}[]; centroids:{id:number;values:number[]}[]},
): SpeakerAnalysis {
  if (state.engine === 'speakerkit-1.1.1-v3-r2') return matchSpeakerWindow(state, window, result);
  if (!result.ok || !Number.isFinite(result.startSeconds) || !Number.isFinite(result.endSeconds) ||
      Math.abs(result.startSeconds-window.start)>0.1 || result.endSeconds < window.end-0.15 ||
      !Array.isArray(result.turns) || result.turns.length>10000 || !Array.isArray(result.centroids) || result.centroids.length>32) {
    throw new Error('Speaker window did not finish or did not cover the requested audio.');
  }
  const profiles = state.profiles.map(p => ({...p,centroid:[...p.centroid]}));
  const mapping = new Map<number,number|null>(), used = new Set<number>(), ids = new Set<number>();
  const centroids = result.centroids.map(c => {
    if (!Number.isSafeInteger(c.id) || c.id < 0 || ids.has(c.id)) throw new Error('Invalid speaker centroid identity.');
    ids.add(c.id);return {...c, normalized:normalizedVoice(c.values)};
  });
  for (const turn of result.turns) {
    if (!Number.isFinite(turn.start)||!Number.isFinite(turn.end)||turn.end<turn.start||
        !Array.isArray(turn.speakerIds)||turn.speakerIds.some(id=>!Number.isSafeInteger(id)||id<0)) throw new Error('Invalid speaker timing.');
  }
  const first = (id:number) => result.turns.find(t=>t.speakerIds.length===1&&t.speakerIds[0]===id)?.start ?? Infinity;
  const distances = (vector:number[]) => state.profiles.filter(p=>p.centroid.length===vector.length).map(p=>({id:p.id,d:1-p.centroid.reduce((sum,v,i)=>sum+v*vector[i],0)})).sort((a,b)=>a.d-b.d);
  // Strong matches are assigned before new/uncertain voices; local IDs are not global IDs.
  centroids.sort((a,b)=>(a.normalized ? distances(a.normalized)[0]?.d ?? 2 : 3)-(b.normalized ? distances(b.normalized)[0]?.d ?? 2 : 3)||first(a.id)-first(b.id));
  for (const c of centroids) {
    const vector=c.normalized;
    const weight=result.turns.filter(t=>t.speakerIds.length===1&&t.speakerIds[0]===c.id).reduce((n,t)=>n+Math.max(0,Math.min(t.end,window.end)-Math.max(t.start,window.start)),0);
    if (!vector || weight<1.5 || state.profiles.some(p=>p.centroid.length!==vector.length)) {mapping.set(c.id,null);continue;}
    const ranked=distances(vector), best=ranked[0], second=ranked[1];
    // Conservative initial policy, not a calibrated probability of identity.
    if (best && best.d<=0.28 && (!second || second.d-best.d>=0.06) && !used.has(best.id)) {
      mapping.set(c.id,best.id);used.add(best.id);
      const p=profiles.find(p=>p.id===best.id)!;
      const oldWeight=Math.min(p.weight,300), freshWeight=Math.min(weight,60);
      p.centroid=normalizedVoice(p.centroid.map((v,i)=>v*oldWeight+vector[i]*freshWeight))!;
      p.weight=Math.min(360,p.weight+freshWeight);
    } else if ((!best || best.d>=0.45) && profiles.length<16) {
      const id=Math.max(0,...profiles.map(p=>p.id))+1;
      profiles.push({id,centroid:vector,weight});mapping.set(c.id,id);used.add(id);
    } else {mapping.set(c.id,null);}
  }
  const turns=result.turns.map(t=>({start:Math.max(window.start,t.start)+window.offset,
    end:Math.min(window.end,t.end)+window.offset,
    speakerId:t.speakerIds.length===1 ? mapping.get(t.speakerIds[0]) ?? null : null}))
    .filter(t=>t.end>t.start).sort((a,b)=>a.start-b.start);
  return {...state,profiles,turns:[...state.turns,...turns],nextWindow:state.nextWindow+1,status:'processing',error:undefined};
}
export function annotateSpeakerSegments(segments: SavedTranscriptSegment[], state: SpeakerAnalysis | null): SavedTranscriptSegment[] {
  if (!state || state.transcriptKey !== speakerTranscriptKey(segments)) return segments;
  return segments.map(segment=>{
    const duration=segment.end-segment.start;
    if (duration<=0) return {...segment,speakerId:null};
    const points=new Set([segment.start,segment.end]);
    const hits=state.turns.filter(t=>t.start<segment.end&&t.end>segment.start);
    for(const t of hits){points.add(Math.max(segment.start,t.start));points.add(Math.min(segment.end,t.end));}
    const edges=[...points].sort((a,b)=>a-b),coverage=new Map<number,number>();
    for(let i=0;i+1<edges.length;i++){
      const mid=(edges[i]+edges[i+1])/2, voices=new Set(hits.filter(t=>t.start<=mid&&t.end>mid).map(t=>t.speakerId));
      if(voices.size===1&&!voices.has(null)){const id=[...voices][0]!;coverage.set(id,(coverage.get(id)??0)+edges[i+1]-edges[i]);}
    }
    const best=[...coverage].sort((a,b)=>b[1]-a[1])[0];
    const speakerId=best&&best[1]/duration>=0.8?best[0]:null;
    return {...segment,speakerId,speakerName:state.profiles.find(p=>p.id===speakerId)?.name};
  });
}
export function speakerLabel(segment: Pick<SavedTranscriptSegment,'speakerId'|'speakerName'>, language='en'): string {
  if(segment.speakerId===undefined)return '';
  const key=language==='ua'||language.startsWith('uk')?'uk':language.startsWith('ru')?'ru':language.startsWith('nb')||language==='no'?'no':'en';
  const labels={uk:['Співрозмовник','Не визначено'],ru:['Собеседник','Не определён'],no:['Taler','Ukjent taler'],en:['Speaker','Unknown speaker']}[key];
  return segment.speakerId===null?labels[1]:segment.speakerName?.trim()||String(segment.speakerId);
}
export function buildSpeakerText(segments: SavedTranscriptSegment[], language='en'): string {
  return segments.map(s=>`${speakerLabel(s,language)}${speakerLabel(s,language)?': ':''}${s.text}`).join('\n\n');
}

// Preserve the authoritative text if timestamps cover a different revision.
export function buildSpeakerExportText(segments: SavedTranscriptSegment[], original: string, language='en'): string {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  if (normalize(segments.map(s => s.text).join(' ')) !== normalize(original)) return original;
  return buildSpeakerText(segments, language);
}

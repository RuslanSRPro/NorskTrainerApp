import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type AudioDiagnosticMode = 'normal' | 'live';
export type AudioDiagnosticStatus = 'saved' | 'failed' | 'cancelled';
export type AudioDiagnosticReport = {
  session_id: string;
  mode: AudioDiagnosticMode;
  status: AudioDiagnosticStatus;
  started_at: string;
  finished_at: string;
  startup_ms?: number | null;
  model_load_ms?: number | null;
  error_code?: string | null;
  events?: { name: string; at_ms: number }[];
};
const KEY = '@norsktrainer/audio_diagnostics_queue/v2';
let storageOperation: Promise<void> = Promise.resolve();
let uploadOperation: Promise<void> | null = null;
let uploadRequested = false;
const NETWORK_DEADLINE_MS = 15000;
const cleanNumber = (n?: number | null) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 2147483647) : null;

function compactEvents(events: NonNullable<AudioDiagnosticReport['events']>) {
  const cleaned = events.map(e => ({
    name: e.name.replace(/[^A-Z0-9_]/g, '').slice(0, 60),
    at_ms: cleanNumber(e.at_ms) ?? 0,
  }));
  // A long lecture can produce hundreds of checkpoints. Keep the lifecycle
  // events and aggregate only the repetitive checkpoint notifications.
  const checkpoints = cleaned.filter(e => e.name === 'SEGMENT_COMMITTED');
  const compacted = cleaned.filter(e => e.name !== 'SEGMENT_COMMITTED');
  const lastCheckpoint = checkpoints[checkpoints.length - 1];
  if (lastCheckpoint) {
    compacted.push({ ...lastCheckpoint, name: `SEGMENT_COUNT_${checkpoints.length}` });
  }
  compacted.sort((a, b) => a.at_ms - b.at_ms);
  return compacted.length <= 40
    ? compacted
    : [...compacted.slice(0, 20), ...compacted.slice(-20)];
}

const clean = (r: AudioDiagnosticReport): AudioDiagnosticReport => ({
  session_id: r.session_id,
  mode: r.mode,
  status: r.status,
  started_at: r.started_at,
  finished_at: r.finished_at,
  startup_ms: cleanNumber(r.startup_ms),
  model_load_ms: cleanNumber(r.model_load_ms),
  error_code: r.error_code?.replace(/[^A-Z0-9_]/g, '').slice(0, 60) ?? null,
  events: compactEvents(r.events ?? []),
});
const read = async (): Promise<AudioDiagnosticReport[]> => {
  const stored = await AsyncStorage.getItem(KEY);
  try { const x: unknown = JSON.parse(stored ?? '[]'); return Array.isArray(x) ? x.slice(-50) : []; }
  catch { return []; }
};
function serial(work: () => Promise<void>): Promise<void> {
  // This chain contains local storage only. A slow auth or upload request must
  // never delay persistence of a newer start, recovery, or assembly event.
  storageOperation = storageOperation.catch(() => {}).then(work).catch(error => {
    console.warn('Could not persist audio diagnostics:', error);
  });
  return storageOperation;
}

async function withNetworkDeadline<T>(work: PromiseLike<T>, abort?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort?.();
          reject(new Error('Audio diagnostic network deadline exceeded.'));
        }, NETWORK_DEADLINE_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function uploadQueue(): Promise<void> {
  do {
    uploadRequested = false;
    const { data: { user }, error } = await withNetworkDeadline(supabase.auth.getUser());
    if (error || !user) return;
    let snapshot: AudioDiagnosticReport[] = [];
    await serial(async () => { snapshot = await read(); });
    for (const report of snapshot) {
      const controller = new AbortController();
      try {
        const result = await withNetworkDeadline(
          supabase.from('audio_diagnostic_sessions').upsert(
            { ...report, user_id: user.id }, { onConflict: 'user_id,session_id' }
          ).abortSignal(controller.signal),
          () => controller.abort()
        );
        if (result.error) continue;
        await serial(async () => {
          const current = await read();
          // A completion report may replace a pending report during upload.
          // Acknowledge exactly the version sent; never delete its replacement.
          const sent = JSON.stringify(report);
          const remaining = current.filter(item =>
            item.session_id !== report.session_id || JSON.stringify(item) !== sent
          );
          await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
        });
      } catch {
        // Leave failed or cancelled reports durable for the next retry.
      }
    }
  } while (uploadRequested);
}

function requestUpload(): void {
  uploadRequested = true;
  if (uploadOperation) return;
  uploadOperation = uploadQueue().catch(() => {
    // Auth/network failures do not affect recording or local persistence.
    uploadRequested = false;
  }).finally(() => {
    uploadOperation = null;
    if (uploadRequested) requestUpload();
  });
}

/** Resolves after local persistence only. Ordinary Start/Stop callers may ignore it. */
export function enqueueAudioDiagnostic(report: AudioDiagnosticReport): Promise<void> {
  return serial(async () => {
    const queue = await read();
    const item = clean(report);
    const idx = queue.findIndex(x => x.session_id === item.session_id);
    if (idx >= 0) queue[idx] = item; else queue.push(item);
    await AsyncStorage.setItem(KEY, JSON.stringify(queue.slice(-50)));
  }).then(() => { requestUpload(); });
}
export function retryAudioDiagnostics(): void { requestUpload(); }
/** Session identity is non-secret and not used for authorization. */
export function newAudioDiagnosticId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

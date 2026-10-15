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
let operation: Promise<void> = Promise.resolve();
const cleanNumber = (n?: number | null) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 2147483647) : null;
const clean = (r: AudioDiagnosticReport): AudioDiagnosticReport => ({
  session_id: r.session_id,
  mode: r.mode,
  status: r.status,
  started_at: r.started_at,
  finished_at: r.finished_at,
  startup_ms: cleanNumber(r.startup_ms),
  model_load_ms: cleanNumber(r.model_load_ms),
  error_code: r.error_code?.replace(/[^A-Z0-9_]/g, '').slice(0, 60) ?? null,
  events: (r.events ?? []).slice(-40).map(e => ({name: e.name.replace(/[^A-Z0-9_]/g, '').slice(0,60), at_ms: cleanNumber(e.at_ms) ?? 0})),
});
const read = async (): Promise<AudioDiagnosticReport[]> => {
  try { const x: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); return Array.isArray(x) ? x.slice(-50) : []; }
  catch { return []; }
};
async function uploadQueue() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return;
  const queue = await read();
  const pending: AudioDiagnosticReport[] = [];
  for (const report of queue) {
    try {
      const result = await supabase.from('audio_diagnostic_sessions').upsert(
        { ...report, user_id: user.id }, { onConflict: 'user_id,session_id' }
      );
      if (result.error) pending.push(report);
    } catch { pending.push(report); }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(pending));
}
function serial(work: () => Promise<void>): Promise<void> {
  operation = operation.catch(() => {}).then(work).catch(() => {});
  return operation;
}
/** Caller must not await from Start/Stop. Queue is serialized to prevent lost updates. */
export function enqueueAudioDiagnostic(report: AudioDiagnosticReport): void {
  void serial(async () => {
    const queue = await read();
    const item = clean(report);
    const idx = queue.findIndex(x => x.session_id === item.session_id);
    if (idx >= 0) queue[idx] = item; else queue.push(item);
    await AsyncStorage.setItem(KEY, JSON.stringify(queue.slice(-50)));
    await uploadQueue();
  });
}
export function retryAudioDiagnostics(): void { void serial(uploadQueue); }
/** Session identity is non-secret and not used for authorization. */
export function newAudioDiagnosticId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

// services/analysisHistory.ts
// D10 28.10.2026 (agreed): storage of "recent analyses" on this device.
// Rules are in analysisHistoryCore.ts. Every read/write is guarded: a storage
// error never breaks an analysis (the list is a convenience, not data).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addChild, addEntry, makeEntry, parseHistory,
  type HistoryChildKind, type HistoryEntry } from '@/services/analysisHistoryCore';

const STORAGE_KEY = 'd10_analysis_history_v1';

// writes are chained so two quick writes never overwrite each other
let queue: Promise<unknown> = Promise.resolve();

export async function loadAnalysisHistory(): Promise<HistoryEntry[]> {
  try {
    return parseHistory(await AsyncStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn('[analysis history] read failed', error);
    return [];
  }
}

function update(change: (list: HistoryEntry[]) => HistoryEntry[]): Promise<void> {
  const next = queue.then(async () => {
    try {
      const list = change(await loadAnalysisHistory());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      console.warn('[analysis history] write failed', error);
    }
  });
  queue = next;
  return next;
}

// A new analysis; returns its id (used to attach child jobs).
export function recordAnalysis(input: Parameters<typeof makeEntry>[0]): string {
  const entry = makeEntry(input);
  void update((list) => addEntry(list, entry));
  return entry.id;
}

export function recordChildJob(parentId: string | null, child: {
  jobId: string; kind: HistoryChildKind; words: unknown[]; mode?: string;
}): void {
  void update((list) => addChild(list, parentId, child));
}

export async function clearAnalysisHistory(): Promise<void> {
  await update(() => []);
}

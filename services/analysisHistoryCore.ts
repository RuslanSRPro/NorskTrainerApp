// services/analysisHistoryCore.ts
// D10 28.10.2026 (agreed): "recent analyses" in the Reading tab.
//   - kept on THIS device only (AsyncStorage, see analysisHistory.ts);
//   - at most MAX_ENTRIES analyses, the newest first; a new one pushes out
//     the oldest;
//   - one entry = one analysis (a text, or a word check that started a job);
//     jobs started from it (save selected words, save a previewed word, re-run
//     problem cards) are its CHILD jobs;
//   - only ids and short labels are stored; results are read from the server
//     (get-job-status) when the entry is opened.
// Pure functions (no React Native, no storage) so they are tested in node.

export const MAX_ENTRIES = 20;
export const MAX_WORDS = 40;
export const MAX_CHILDREN = 20;

export type HistoryChildKind = 'save_selected' | 'save_preview' | 'rerun_problems';
export type HistoryChild = { jobId: string; kind: HistoryChildKind; words: string[]; startedAt: string };

export type HistoryEntry = {
  id: string;                    // local id of the analysis
  jobId: string | null;          // its own job (Audit); null in Read mode
  kind: 'text' | 'word';
  mode: string;                  // 'read' | 'audit'
  preview: string;               // start of the text / the words checked
  startedAt: string;             // ISO time
  counts?: { inBase: number; unknown: number } | null;
  unknownWords?: string[];       // words not in the database (Read mode)
  children: HistoryChild[];
};

const cleanWords = (words: unknown[]): string[] =>
  [...new Set(words.map((w) => String(w ?? '').trim()).filter(Boolean))].slice(0, MAX_WORDS);

export function newEntryId(now: number = Date.now()): string {
  return `a-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEntry(input: {
  id?: string; jobId?: string | null; kind: 'text' | 'word'; mode: string; preview: string;
  counts?: { inBase: number; unknown: number } | null; unknownWords?: unknown[]; startedAt?: string;
}): HistoryEntry {
  return {
    id: input.id ?? newEntryId(),
    jobId: input.jobId ? String(input.jobId) : null,
    kind: input.kind,
    mode: String(input.mode || ''),
    preview: String(input.preview ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    startedAt: input.startedAt ?? new Date().toISOString(),
    counts: input.counts ?? null,
    unknownWords: cleanWords(input.unknownWords ?? []),
    children: [],
  };
}

// newest first, at most MAX_ENTRIES (the oldest is dropped)
export function addEntry(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
}

// A child job goes to the given analysis; without one (or when it is no longer
// in the list) to the newest analysis; with no analyses at all it becomes an
// entry of its own (kind "word", its words as the label).
export function addChild(list: HistoryEntry[], parentId: string | null, child: {
  jobId: string; kind: HistoryChildKind; words: unknown[]; startedAt?: string; mode?: string;
}): HistoryEntry[] {
  const item: HistoryChild = { jobId: String(child.jobId), kind: child.kind, words: cleanWords(child.words),
    startedAt: child.startedAt ?? new Date().toISOString() };
  const target = (parentId && list.find((e) => e.id === parentId)) || list[0];
  if (!target) {
    const own = makeEntry({ jobId: item.jobId, kind: 'word', mode: child.mode ?? '', preview: item.words.join(', '),
      startedAt: item.startedAt });
    return addEntry(list, own);
  }
  return list.map((e) => e.id !== target.id ? e : {
    ...e, children: [...e.children.filter((c) => c.jobId !== item.jobId), item].slice(-MAX_CHILDREN),
  });
}

// Stored JSON -> entries (anything broken is dropped, never throws).
export function parseHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((e: any) => e && typeof e.id === 'string' && Array.isArray(e.children)).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

// services/serverStars.ts
// D10 16.10.2026 (agreed, step B part 3): the app shows the star rating the
// server computed (public.verification_stars_v1, D10_verification_stars_v1).
// One source of truth: the server. Read only. Ratings are fetched in batches
// and kept in memory for the session; a rating that is missing or cannot be
// read leaves the old in-app calculation in place for that word.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type ServerRatingDetail = {
  version?: string;
  stars?: number;
  kind?: 'word' | 'expression';
  card_pos?: string | null;
  basis?: string | null;              // 'no_evidence' = never checked
  ordbokene?: string;                 // article | article_pos_unknown | other_pos | none
  naob?: string;                      // article | mention | other_pos | none
  lexin?: string;                     // entry | mention | other_pos | none
  wiktionary?: string;                // entry | mention | other_pos | none
  sprakradet?: string;                // mention | none
  note?: string | null;               // no_ordbokene_article
};

export type ServerRating = { stars: number; rating: ServerRatingDetail };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 150;

// undefined: not asked yet; null: asked, no rating on the server
const cache = new Map<string, ServerRating | null>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

function notify() {
  version += 1;
  for (const listener of [...listeners]) {
    try { listener(); } catch { /* a listener never breaks the others */ }
  }
}

async function flush() {
  timer = null;
  const ids = [...queued];
  queued.clear();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const { data, error } = await supabase
        .from('verification_stars_v1')
        .select('entity_type, entity_id, stars, rating')
        .in('entity_id', chunk);
      if (error) throw error;
      const found = new Map<string, ServerRating>();
      for (const row of (data ?? []) as any[]) {
        const stars = Number(row?.stars);
        if (!row?.entity_id || !(stars >= 1 && stars <= 5)) continue;
        // a lexeme row wins over an expression row with the same id
        if (found.has(row.entity_id) && row.entity_type !== 'lexeme') continue;
        found.set(row.entity_id, { stars, rating: (row.rating ?? {}) as ServerRatingDetail });
      }
      for (const id of chunk) cache.set(id, found.get(id) ?? null);
    } catch {
      // Unreadable (offline, table missing): keep "not asked", old calculation stays.
      for (const id of chunk) cache.delete(id);
    }
  }
  notify();
}

export function prefetchServerRatings(ids: Array<string | null | undefined>): void {
  let added = false;
  for (const raw of ids) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!UUID.test(id) || cache.has(id) || queued.has(id)) continue;
    queued.add(id);
    added = true;
  }
  if (added && !timer) timer = setTimeout(() => { void flush(); }, 30);
}

export function getCachedServerRating(id?: string | null): ServerRating | null | undefined {
  return id ? cache.get(String(id)) : undefined;
}

// Re-read a rating after the word changed (new check, new job).
export function invalidateServerRatings(ids: Array<string | null | undefined>): void {
  for (const id of ids) if (id) cache.delete(String(id));
  prefetchServerRatings(ids);
}

export function useServerRating(id?: string | null): ServerRating | null | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((x) => x + 1);
    listeners.add(listener);
    prefetchServerRatings([id]);
    return () => { listeners.delete(listener); };
  }, [id]);
  return getCachedServerRating(id);
}

export function serverRatingsVersion(): number {
  return version;
}

import type { SpeakerAnalysis, SpeakerProfile, SpeakerTurn, SpeakerWindow } from './lectureStorage';

type WindowResult = {
  ok: boolean; startSeconds: number; endSeconds: number;
  turns: Array<{start: number; end: number; speakerIds: number[]}>;
  centroids: Array<{id: number; values: number[]}>;
};

export function normalizedSpeakerVoice(vector: number[]): number[] | null {
  if (!Array.isArray(vector) || vector.length < 2 || vector.length > 1024 || vector.some(v => !Number.isFinite(v))) return null;
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 1e-10 && Number.isFinite(norm) ? vector.map(value => value / norm) : null;
}

function distance(left: number[], right: number[]): number {
  if (left.length !== right.length) return Infinity;
  return Math.max(0, Math.min(2, 1 - left.reduce((sum, value, index) => sum + value * right[index], 0)));
}

function intervalLength(intervals: Array<{start: number; end: number}>): number {
  let end = -Infinity, duration = 0;
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    duration += Math.max(0, interval.end - Math.max(end, interval.start));
    end = Math.max(end, interval.end);
  }
  return duration;
}

function overlapEvidence(id: number, window: SpeakerWindow, result: WindowResult, state: SpeakerAnalysis) {
  const votes = new Map<number, Array<{start: number; end: number}>>();
  const end = Math.min(state.processedUntilSeconds ?? 0, window.end + window.offset);
  const solo = result.turns.filter(turn => turn.speakerIds.length === 1 && turn.speakerIds[0] === id)
    .map(turn => ({start: Math.max(window.start, turn.start) + window.offset,
      end: Math.min(end, turn.end + window.offset)})).filter(turn => turn.end > turn.start);
  const total = intervalLength([...solo]);
  for (const turn of solo) for (const previous of state.turns) {
    if (previous.speakerId === null || previous.end <= turn.start || previous.start >= turn.end) continue;
    const intervals = votes.get(previous.speakerId) ?? [];
    intervals.push({start: Math.max(previous.start, turn.start), end: Math.min(previous.end, turn.end)});
    votes.set(previous.speakerId, intervals);
  }
  const ranked = [...votes].map(([speakerId, intervals]) => ({speakerId, seconds: intervalLength(intervals)}))
    .sort((a, b) => b.seconds - a.seconds || a.speakerId - b.speakerId);
  const best = ranked[0], second = ranked[1];
  const reliable = best && best.seconds >= 2 && best.seconds >= total * 0.7 &&
    best.seconds - (second?.seconds ?? 0) >= Math.max(1, best.seconds * 0.25);
  return {speakerId: reliable ? best.speakerId : null, seconds: best?.seconds ?? 0,
    ambiguous: !reliable && (best?.seconds ?? 0) >= 2};
}

// Keep established labels in repeated audio; fill previously unknown intervals.
function reconcileTurns(previous: SpeakerTurn[], incoming: SpeakerTurn[], start: number): SpeakerTurn[] {
  const prefix = previous.filter(turn => turn.start < start).map(turn => ({...turn, end: Math.min(turn.end, start)}));
  const old = previous.filter(turn => turn.end > start).map(turn => ({...turn, start: Math.max(start, turn.start)}));
  const edges = [...new Set([...old, ...incoming].flatMap(turn => [turn.start, turn.end]))].sort((a, b) => a - b);
  const output = prefix.filter(turn => turn.end > turn.start);
  for (let index = 0; index + 1 < edges.length; index++) {
    const from = edges[index], to = edges[index + 1], middle = (from + to) / 2;
    const oldHits = old.filter(turn => turn.start <= middle && turn.end > middle);
    const newHits = incoming.filter(turn => turn.start <= middle && turn.end > middle);
    if (!oldHits.length && !newHits.length) continue;
    const known = new Set(oldHits.map(turn => turn.speakerId).filter(id => id !== null));
    const ids = known.size ? known : new Set(newHits.map(turn => turn.speakerId));
    const speakerId = ids.size === 1 ? [...ids][0] ?? null : null;
    const last = output.at(-1);
    if (last && last.speakerId === speakerId && Math.abs(last.end - from) < 0.0001) last.end = to;
    else output.push({start: from, end: to, speakerId});
  }
  return output;
}

export function matchSpeakerWindow(state: SpeakerAnalysis, window: SpeakerWindow, result: WindowResult): SpeakerAnalysis {
  if (!result.ok || !Number.isFinite(result.startSeconds) || !Number.isFinite(result.endSeconds) ||
      Math.abs(result.startSeconds - window.start) > 0.1 || result.endSeconds < window.end - 0.15 ||
      !Array.isArray(result.turns) || result.turns.length > 10000 ||
      !Array.isArray(result.centroids) || result.centroids.length > 32) throw new Error('Speaker window did not cover its audio.');
  for (const turn of result.turns) {
    if (!Number.isFinite(turn.start) || !Number.isFinite(turn.end) || turn.end < turn.start ||
        !Array.isArray(turn.speakerIds) || turn.speakerIds.some(id => !Number.isSafeInteger(id) || id < 0)) throw new Error('Invalid speaker timing.');
  }
  const vectors = new Map<number, number[] | null>();
  for (const centroid of result.centroids) {
    if (!Number.isSafeInteger(centroid.id) || centroid.id < 0 || vectors.has(centroid.id)) throw new Error('Invalid voice identity.');
    vectors.set(centroid.id, normalizedSpeakerVoice(centroid.values));
  }
  const localIds = new Set(result.turns.flatMap(turn => turn.speakerIds));
  const evidence = [...localIds].map(id => ({id, ...overlapEvidence(id, window, result, state)}))
    .sort((a, b) => Number(b.speakerId !== null) - Number(a.speakerId !== null) || b.seconds - a.seconds || a.id - b.id);
  const profiles: SpeakerProfile[] = state.profiles.map(profile => ({...profile,
    centroid: [...profile.centroid], anchors: profile.anchors?.map(vector => [...vector]) ?? [[...profile.centroid]]}));
  const used = new Set<number>(), mapping = new Map<number, number | null>();
  for (const item of evidence) {
    if (item.ambiguous || item.speakerId !== null && used.has(item.speakerId)) {
      mapping.set(item.id, null);
      continue;
    }
    const vector = vectors.get(item.id);
    const speech = result.turns.filter(turn => turn.speakerIds.length === 1 && turn.speakerIds[0] === item.id)
      .map(turn => ({start: Math.max(window.start, turn.start), end: Math.min(window.end, turn.end)}))
      .filter(turn => turn.end > turn.start);
    const weight = intervalLength(speech);
    let created = false;
    let profile = item.speakerId === null ? undefined : profiles.find(p => p.id === item.speakerId && !used.has(p.id));
    if (!profile && vector && weight >= 1.5) {
      const ranked = profiles.map(p => ({profile: p, distance: Math.min(distance(vector, p.centroid),
        ...(p.anchors ?? []).map(anchor => distance(vector, anchor)))}))
        .sort((a, b) => a.distance - b.distance || a.profile.id - b.profile.id);
      const best = ranked[0], second = ranked[1];
      if (best && best.distance <= 0.28 && (!second || second.distance - best.distance >= 0.06) && !used.has(best.profile.id)) {
        profile = best.profile;
      } else if ((!best || best.distance >= 0.45) && weight >= 3 && profiles.length < 16 &&
          profiles.every(p => p.centroid.length === vector.length)) {
        profile = {id: Math.max(0, ...profiles.map(p => p.id)) + 1, centroid: vector, weight, anchors: [vector]};
        profiles.push(profile);
        created = true;
      }
    }
    if (!profile) { mapping.set(item.id, null); continue; }
    mapping.set(item.id, profile.id); used.add(profile.id);
    if (!created && vector && vector.length === profile.centroid.length) {
      // Repeated speech links drifting embeddings. Retain the first reference
      // and at most three recent references established by shared audio.
      if (item.speakerId === profile.id) {
        const anchors = profile.anchors ?? [profile.centroid];
        profile.anchors = [anchors[0], ...anchors.slice(1).slice(-2), vector];
      }
      const oldWeight = Math.min(profile.weight, 300), freshWeight = Math.min(weight, 60);
      profile.centroid = normalizedSpeakerVoice(profile.centroid.map((value, index) =>
        value * oldWeight + vector[index] * freshWeight)) ?? profile.centroid;
      profile.weight = Math.min(360, profile.weight + freshWeight);
    }
  }
  const incoming = result.turns.map(turn => ({start: Math.max(window.start, turn.start) + window.offset,
    end: Math.min(window.end, turn.end) + window.offset,
    speakerId: turn.speakerIds.length === 1 ? mapping.get(turn.speakerIds[0]) ?? null : null,
  })).filter(turn => turn.end > turn.start);
  return {...state, profiles, turns: reconcileTurns(state.turns, incoming, window.start + window.offset),
    processedUntilSeconds: Math.max(state.processedUntilSeconds ?? 0, window.end + window.offset),
    nextWindow: state.nextWindow + 1, status: 'processing', error: undefined};
}

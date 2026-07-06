import { TrainingMode } from '@/services/settings';

export type TrainingTask = {
  id: string;
  mode: TrainingMode;
  word: any;
  prompt?: string;
  expected?: string;
  options?: string[];
  formLabel?: string;
};

export function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function normalizeAnswer(v: string) {
  return String(v || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»]/g, '')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .replace(/^(den|det|de)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFormAnswer(v: string) {
  return normalizeAnswer(v).replace(/^(den|det|de)\s+/i, '').trim();
}

export function splitAccepted(v: string) {
  const raw = String(v || '').trim();
  if (!raw) return [];

  return Array.from(
    new Set([
      raw,
      ...raw
        .split(/[,;\/|]/g)
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  );
}

export function isAccepted(input: string, expected: string, mode?: TrainingMode) {
  const norm = mode === 'forms' ? normalizeFormAnswer : normalizeAnswer;
  const typed = norm(input);

  if (!typed) return false;

  return splitAccepted(expected)
    .map(norm)
    .filter(Boolean)
    .some((accepted) => accepted === typed);
}

export function normalizeChoice(v: string) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getCategoryFamily(w: any) {
  const c = String(w?.category || w?.type || '').toLowerCase();

  if (c.includes('verb')) return 'verb';
  if (c.includes('noun')) return 'noun';
  if (c.includes('adj')) return 'adjective';
  if (c.includes('adv')) return 'adverb';
  if (c.includes('expr')) return 'expression';

  return c || 'unknown';
}

export function isVerbLike(w: any) {
  return String(w?.category || w?.type || w?.pos || '')
    .toLowerCase()
    .includes('verb');
}

export function displayLemma(v: string, w?: any) {
  const raw = String(v || '').trim();

  if (!raw) return raw;
  if (/^å\s+/i.test(raw)) return raw;

  return isVerbLike(w) ? `å ${raw}` : raw;
}

export function getNestedFirst(v: any) {
  return Array.isArray(v) ? v[0] || {} : v || {};
}

export function getFormValue(w: any, keys: string[]) {
  for (const k of keys) {
    if (w?.[k]) return w[k];
  }

  const vf = getNestedFirst(w?.verb_forms);
  const nf = getNestedFirst(w?.noun_forms);
  const af = getNestedFirst(w?.adjective_forms);

  for (const k of keys) {
    const v = vf?.[k] || nf?.[k] || af?.[k];
    if (v) return v;
  }

  return '';
}

export function getNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getFreq(w: any) {
  const v = getNum(w?.frequency, getNum(w?.srs?.frequency));
  return v > 0 ? v : 999999;
}

export function getPriority(w: any) {
  return getNum(w?.priorityScore ?? w?.priority_score ?? w?.srs?.priority_score);
}

export function getWeak(w: any) {
  return getNum(w?.weakScore ?? w?.weak_score ?? w?.srs?.weak_score);
}

export function getHits(w: any) {
  return getNum(w?.personalHits ?? w?.personal_hits ?? w?.srs?.personal_hits);
}

export function getMemStatus(w: any) {
  return String(w?.memoryStatus ?? w?.memory_status ?? w?.srs?.memory_status ?? 'active');
}

export function getQueue(w: any) {
  return getNum(w?.queueScore ?? w?.queue_score ?? w?.srs?.queue_score);
}

export function getBucket(w: any) {
  const status = getMemStatus(w);
  const weak = getWeak(w);
  const queue = getQueue(w);
  const hits = getHits(w);
  const priority = getPriority(w);

  if (status === 'passive_known') return 'passive';
  if (status === 'weak' || weak >= 45 || queue >= 70) return 'weak';
  if (hits > 0 || priority >= 55) return 'reading';
  if (status === 'reinforcement') return 'reinforcement';

  return 'new';
}

export function getScore(w: any) {
  const freq = getFreq(w);
  const freqBoost =
    freq > 0 ? Math.max(0, 60 - Math.log10(freq + 1) * 12) : 0;

  const status = getMemStatus(w);
  const statusBoost =
    status === 'weak'
      ? 70
      : status === 'active'
        ? 25
        : status === 'reinforcement'
          ? 10
          : status === 'passive_known'
            ? -120
            : 0;

  return (
    getPriority(w) +
    getWeak(w) * 1.6 +
    getQueue(w) * 0.7 +
    Math.min(getHits(w), 30) * 5 +
    freqBoost +
    statusBoost
  );
}

export function sortWords(words: any[]) {
  return [...words].sort((a, b) => getScore(b) - getScore(a));
}

export function hasVerification(w: any) {
  return Boolean(w?.verification_tier || w?.verification_evidence || w?.source_verified);
}

export function hasRelations(w: any) {
  return Boolean(
    w?.relations_count > 0 ||
      w?.has_relations ||
      (Array.isArray(w?.relations) && w.relations.length > 0),
  );
}

export function getImageUrl(w: any) {
  return w?.image_url || w?.imageUrl || w?.image || '';
}

export function getCleanWord(w: any) {
  return String(w?.word || w?.lemma || '')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

export function getMainWord(w: any) {
  return displayLemma(w?.word || w?.lemma || w?.text || '', w);
}
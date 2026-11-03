// supabase/functions/synonym-verifier/fit-core.ts
// D10 02.11.2026 (agreed, D10_synonym_stable_v1): translation fit, evaluated ONCE per card + sense and reused by
// both directions of every synonym pair and by rechecks (private.synonym_sense_fit_v1).
// The model only CHOOSES an existing pipeline translation by its index (or -1 = none fits this sense).
// It never writes translation text: the database takes the chosen text from its own stored list by index,
// so nothing outside the pipeline translations can appear.

export const FIT_PROMPT_VERSION = 'sense_fit_v1';

export type FitRow = { fit_key: string; lemma: string | null; part_of_speech: string | null; sense: string | null;
  contexts: unknown; tr_uk: string[]; tr_en: string[] };
export type FitAnswer = { fit_key: string; uk_index: number; en_index: number };

const text = (v: unknown, max = 300): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (v: unknown, max = 8): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).map((x) => text(x, 300)).filter(Boolean).slice(0, max);

export function buildFitPrompt(rows: FitRow[]): string {
  const input = rows.map((r, ref) => ({
    ref, lemma: text(r.lemma, 80), part_of_speech: text(r.part_of_speech, 30) || null,
    sense: text(r.sense, 300), contexts: list(r.contexts, 8),
    uk: (r.tr_uk ?? []).map((t, n) => ({ n, text: text(t, 120) })),
    en: (r.tr_en ?? []).map((t, n) => ({ n, text: text(t, 120) })),
  }));
  return `You check Norwegian dictionary cards for a learning app.
Each item: a Norwegian word, ONE of its senses (a Norwegian definition, with related definitions as context),
and the card's EXISTING Ukrainian (uk) and English (en) translations, numbered from 0.

For each item choose:
  uk_index: the number of the uk translation that expresses the word IN THIS SENSE, or -1 if none does;
  en_index: the same for en.
Rules:
  - Choose only from the given lists. Never translate, never invent, never repair a translation.
  - A translation of ANOTHER sense of the word does not fit (e.g. "take" does not fit the sense "steal";
    "good/tasty" does not fit the sense "large, roomy").
  - A broader or vaguer translation that a learner would not understand as this sense does not fit.
  - uk and en must express the same interpretation of the sense.
  - If several fit, choose the closest to this sense.
  - When in doubt, answer -1.
Answer with one entry per item, in order, with its ref.

ITEMS:
${JSON.stringify(input)}`;
}

export function fitSchema() {
  return {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: { ref: { type: 'INTEGER' }, uk_index: { type: 'INTEGER' }, en_index: { type: 'INTEGER' } },
      required: ['ref', 'uk_index', 'en_index'],
    },
  };
}

// Only well-formed answers are returned; a missing or invalid answer leaves the row for the next run.
export function parseFitAnswer(raw: string, rows: FitRow[]): FitAnswer[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out = new Map<number, FitAnswer>();
  for (const a of parsed as any[]) {
    const ref = Number(a?.ref);
    if (!Number.isInteger(ref) || ref < 0 || ref >= rows.length || out.has(ref)) continue;
    const ui = Number(a?.uk_index); const ei = Number(a?.en_index);
    const r = rows[ref];
    const okU = Number.isInteger(ui) && ui >= -1 && ui < (r.tr_uk ?? []).length;
    const okE = Number.isInteger(ei) && ei >= -1 && ei < (r.tr_en ?? []).length;
    if (!okU || !okE) continue;
    out.set(ref, { fit_key: r.fit_key, uk_index: ui, en_index: ei });
  }
  return [...out.values()];
}

// D10 02.11.2026 (agreed, D10_synonym_eval_v1): TEST version sense_fit_v2, used only by the eval mode. Stricter: a
// translation fits only if it renders THIS sense; "none fits" is a normal answer. A translation may cover several
// senses of the Norwegian word (that is fine), but the closest translation of ANOTHER sense must not be chosen.
export const FIT_PROMPT_VERSION_V2 = 'sense_fit_v2b';

export function buildFitPromptV2(rows: FitRow[]): string {
  const input = rows.map((r, ref) => ({
    ref, lemma: text(r.lemma, 80), part_of_speech: text(r.part_of_speech, 30) || null,
    sense: text(r.sense, 300), contexts: list(r.contexts, 8),
    uk: (r.tr_uk ?? []).map((t, n) => ({ n, text: text(t, 120) })),
    en: (r.tr_en ?? []).map((t, n) => ({ n, text: text(t, 120) })),
  }));
  return `You check Norwegian dictionary cards for a learning app.
Each item: a Norwegian word, ONE of its senses (a Norwegian definition, with the other explanations of the same
sense as context), and the card's EXISTING Ukrainian (uk) and English (en) translations, numbered from 0.

For each item answer:
  uk_index: the number of the uk translation that renders the word IN THIS SENSE, or -1;
  en_index: the same for en.
A translation fits only if a learner who reads it in a sentence with this sense would understand exactly this
sense. Test it: put the Norwegian word in a short sentence of THIS sense and ask whether the translation is a
natural rendering there.
  - "None fits" (-1) is a normal, correct answer. Do NOT choose the closest translation when it renders another
    sense: e.g. "sterk" in the sense "krydret (om mat)" (spicy) is not "сильний / strong".
  - A translation may also cover other senses of the word; that is fine if it renders THIS sense naturally
    (e.g. uk "легкий" renders "lett" both as "not heavy" and as "easy").
  - Choose only from the given lists. Never translate, never invent, never repair.
  - uk and en must express the same interpretation of the sense; if only one language fits, give -1 for the other.
Answer with one entry per item, in order, with its ref.

ITEMS:
${JSON.stringify(input)}`;
}

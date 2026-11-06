// D10_synonym_nuance_v1 (05.11.2026, agreed): the kind of a contextual synonym, for a label in the app.
//   style   - the same meaning, only another style (more colloquial, formal, old-fashioned, dialect, technical);
//   meaning - a close meaning: the word adds or specifies something (amount, intensity, manner, object, attitude ...).
// The test is Cruse's contrast test: "X, but not Y" for the same situation. If it is a contradiction in both
// directions, the words mean the same and differ at most in style. The class of the pair (clean / contextual)
// is NOT changed by this check; it only decides the label of a contextual pair.
export const NUANCE_PROMPT_VERSION = 'nuance_v1';
export const REGISTERS = ['neutral', 'colloquial', 'formal', 'literary_or_archaic', 'regional', 'technical'] as const;
export type NuanceItem = {
  ref: number; source_lemma: string; source_pos: string | null; source_meaning: string;
  target_lemma: string; target_pos: string | null; target_meaning: string; example_nb: string | null;
};
export type NuanceAnswer = {
  ref: number; contrast_forward_nb: string; contrast_forward: 'contradiction' | 'possible';
  contrast_reverse_nb: string; contrast_reverse: 'contradiction' | 'possible';
  register_source: string; register_target: string; note: string | null;
};
const text = (v: unknown, max = 300): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function buildNuancePrompt(items: NuanceItem[]): string {
  return [
    'You compare pairs of Norwegian Bokmål words in ONE given meaning. In this meaning each word can already replace',
    'the other. Decide only HOW they differ.',
    '',
    'contrast_forward: write one short natural Norwegian sentence about one concrete situation that ASSERTS the source',
    'word and DENIES the target word, for example "Han <source> i en time, men han <target> ikke." (use correct',
    'forms). Then judge it as a native speaker:',
    '  contradiction - the sentence contradicts itself: the target says nothing that the source does not already say;',
    '  possible      - the sentence can be true: the target adds or specifies something (amount, intensity, manner,',
    '                  purpose, object, attitude, evaluation ...).',
    'contrast_reverse: the same with the TARGET word asserted and the SOURCE word denied.',
    'A difference ONLY in style (one word more colloquial, formal, old-fashioned, dialectal or technical) does NOT make',
    'a sentence possible. Example: "Det var faren hans, men det var ikke pappaen hans." is a contradiction (style only);',
    '"Han drepte ham, men han myrdet ham ikke." is possible (myrde adds intent).',
    'register_source / register_target: neutral | colloquial | formal | literary_or_archaic | regional | technical.',
    'note: the difference in a few English words, or null.',
    'Answer every item exactly once, with its ref.',
    '',
    'Items:',
    JSON.stringify(items.map((x) => ({
      ref: x.ref,
      source: { word: x.source_lemma, part_of_speech: x.source_pos, meaning: text(x.source_meaning, 300) },
      target: { word: x.target_lemma, part_of_speech: x.target_pos, meaning: text(x.target_meaning, 300) },
      example_nb: x.example_nb ? text(x.example_nb, 200) : null,
    }))),
  ].join('\n');
}

export function nuanceSchema() {
  return {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        ref: { type: 'INTEGER' },
        contrast_forward_nb: { type: 'STRING' },
        contrast_forward: { type: 'STRING', enum: ['contradiction', 'possible'] },
        contrast_reverse_nb: { type: 'STRING' },
        contrast_reverse: { type: 'STRING', enum: ['contradiction', 'possible'] },
        register_source: { type: 'STRING', enum: [...REGISTERS] },
        register_target: { type: 'STRING', enum: [...REGISTERS] },
        note: { type: 'STRING', nullable: true },
      },
      required: ['ref', 'contrast_forward_nb', 'contrast_forward', 'contrast_reverse_nb', 'contrast_reverse',
        'register_source', 'register_target', 'note'],
    },
  };
}

// Only well-formed answers are returned; a missing answer leaves the item without a label.
export function parseNuanceAnswer(raw: string, count: number): Map<number, NuanceAnswer> {
  const out = new Map<number, NuanceAnswer>();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return out; }
  if (!Array.isArray(parsed)) return out;
  const ok = (v: unknown, list: readonly string[]) => list.includes(String(v));
  for (const a of parsed as any[]) {
    const ref = Number(a?.ref);
    if (!Number.isInteger(ref) || ref < 0 || ref >= count || out.has(ref)) continue;
    if (!ok(a?.contrast_forward, ['contradiction', 'possible']) || !ok(a?.contrast_reverse, ['contradiction', 'possible'])) continue;
    if (!ok(a?.register_source, REGISTERS) || !ok(a?.register_target, REGISTERS)) continue;
    out.set(ref, { ref, contrast_forward_nb: text(a.contrast_forward_nb, 200), contrast_forward: a.contrast_forward,
      contrast_reverse_nb: text(a.contrast_reverse_nb, 200), contrast_reverse: a.contrast_reverse,
      register_source: a.register_source, register_target: a.register_target, note: text(a?.note, 160) || null });
  }
  return out;
}

// style: a contradiction in both directions (same meaning); otherwise meaning (a close meaning).
// style_of_target: how the target word sounds next to the source (null = same register).
export function nuanceKind(a: NuanceAnswer): { kind: 'style' | 'meaning'; style_of_target: string | null } {
  const kind = a.contrast_forward === 'contradiction' && a.contrast_reverse === 'contradiction' ? 'style' : 'meaning';
  const style = a.register_target !== a.register_source ? a.register_target : null;
  return { kind, style_of_target: style };
}

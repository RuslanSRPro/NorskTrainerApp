import { existsSync, readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

function loadJson(file) {
  if (!existsSync(file)) { console.log('SKIP: ' + file + ' not found'); return []; }
  return JSON.parse(readFileSync(file, 'utf-8'));
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const g1 = loadJson('./gemini_expressions.json');
const g2 = loadJson('./gemini_expressions_2.json');
const g3 = loadJson('./gemini_expressions_3.json');
const g4 = loadJson('./gemini_expressions_4.json');
const gemini = [...g1, ...g2, ...g3, ...g4];
const wiktionary = loadJson('./wiktionary_expressions.json');
const naob = loadJson('./naob_expressions.json');

console.log('Gemini:', gemini.length);
console.log('Wiktionary:', wiktionary.length);
console.log('NAOB:', naob.length);

const all = [
  ...gemini.map(i => ({...i, source: 'gemini'})),
  ...wiktionary.map(i => ({...i, source: 'wiktionary'})),
  ...naob.map(i => ({...i, source: 'naob'})),
];

if (DRY_RUN) {
  console.log('Total to sync:', all.length);
  console.log('Sample:', all.slice(0,3).map(i => i.lemma));
  console.log('DRY RUN - no changes');
  process.exit(0);
}

let ok = 0, err = 0;
for (const item of all) {
  const { error } = await supabase.rpc('upsert_expression_catalog', {
    p_lemma: item.lemma || '',
    p_display_form: item.display_form || item.lemma || '',
    p_expression_subtype: item.expression_subtype || 'fixed_expression',
    p_translation_ua: item.translation_ua || item.meaning_ua || '',
    p_translation_en: item.translation_en || item.meaning_en || '',
    p_example: item.example || '',
    p_notes_ua: item.notes_ua || '',
    p_cefr: item.cefr || null,
    p_frequency_level: item.frequency_level || null,
    p_frequency_rank: null,
    p_source: item.source,
    p_source_url: null,
    p_raw_json: item,
  });
  if (error) { err++; if (err <= 3) console.log('ERR:', item.lemma, error.message); }
  else ok++;
}
console.log('Done. OK:', ok, 'Errors:', err);


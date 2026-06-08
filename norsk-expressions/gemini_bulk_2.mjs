import { writeFileSync, existsSync, readFileSync } from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + API_KEY;
const OUTPUT = './gemini_expressions_2.json';
const PARTIAL = './gemini_expressions_2_partial.json';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(prompt, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res;
  try {
    res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 2000 },
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (attempt < 3) { await sleep(10000); return callGemini(prompt, attempt + 1); }
    return [];
  }
  clearTimeout(timer);
  if (res.status === 429 || res.status === 503) {
    console.log('  [' + res.status + '] waiting...');
    await sleep(attempt * 15000);
    return callGemini(prompt, attempt + 1);
  }
  if (!res.ok) { console.log('  [HTTP ' + res.status + ']'); return []; }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/^```+json\s*/i, '').replace(/\s*```+$/i, '').trim();
  try { return JSON.parse(clean); }
  catch (e1) {
    try {
      let r = clean.replace(/,\s*$/, '');
      if (!r.trim().endsWith(']')) {
        r = r.replace(/\{[^}]*$/, '').replace(/,\s*$/, '') + ']';
      }
      return JSON.parse(r);
    } catch { return []; }
  }
}

const PROMPT_TEMPLATE = (topic) =>
  'List 20 most common Norwegian Bokmål multiword expressions about ' + topic + '. ' +
  'Return ONLY a JSON array. Each item must have these fields: ' +
  'lemma (canonical form, use "a" prefix for verbs), ' +
  'meaning_en (English translation), ' +
  'expression_subtype (one of: particle_verb, lexical_reflexive, prepositional_verb, fixed_expression, idiom, time_expression, discourse_marker, collocation), ' +
  'cefr (A1/A2/B1/B2), ' +
  'frequency_level (high/medium/low). ' +
  'Only multiword expressions (minimum 2 words). No examples field. No markdown.';

const BATCHES = [
  { id: 'school_education',    topic: 'school, education and learning' },
  { id: 'family_relations',    topic: 'family, relationships and home life' },
  { id: 'health_medical',      topic: 'health, illness and medical situations' },
  { id: 'nature_weather',      topic: 'nature, weather and environment' },
  { id: 'food_eating',         topic: 'food, eating and cooking' },
  { id: 'travel_transport',    topic: 'travel and transport' },
  { id: 'money_economy',       topic: 'money, economy and personal finance' },
  { id: 'politics_society',    topic: 'politics, society and news' },
  { id: 'technology_digital',  topic: 'technology, internet and digital life' },
  { id: 'feelings_psychology', topic: 'feelings, emotions and psychology' },
];

const all = existsSync(PARTIAL)
  ? JSON.parse(readFileSync(PARTIAL, 'utf-8'))
  : [];
const done = new Set(all.map(e => e.batch_id));

for (const batch of BATCHES) {
  if (done.has(batch.id)) { console.log('[SKIP] ' + batch.id); continue; }

  process.stdout.write('[FETCH] ' + batch.id + '...');
  const result = await callGemini(PROMPT_TEMPLATE(batch.topic));
  const items = Array.isArray(result)
    ? result.filter(i => i.lemma && i.lemma.includes(' '))
    : [];
  items.forEach(i => i.batch_id = batch.id);
  all.push(...items);
  writeFileSync(PARTIAL, JSON.stringify(all, null, 2));
  console.log(' ' + items.length + ' (total: ' + all.length + ')');
  await sleep(4000);
}

writeFileSync(OUTPUT, JSON.stringify(all, null, 2));
console.log('\nDone: ' + all.length + ' expressions -> ' + OUTPUT);

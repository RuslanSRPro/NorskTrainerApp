import { writeFileSync, existsSync, readFileSync } from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + API_KEY;
const OUTPUT = './gemini_expressions_3.json';
const PARTIAL = './gemini_expressions_3_partial.json';

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

const PROMPT_TEMPLATE = (topic, extra) =>
  'List 20 most common Norwegian Bokmål multiword expressions about ' + topic + '. ' +
  (extra || '') +
  'Return ONLY a JSON array. Each item: ' +
  '{"lemma":"canonical form","meaning_en":"English translation","expression_subtype":"particle_verb|lexical_reflexive|prepositional_verb|fixed_expression|idiom|time_expression|discourse_marker|collocation","cefr":"A1/A2/B1/B2","frequency_level":"high/medium/low"}. ' +
  'Only multiword expressions (min 2 words). No examples field. No markdown.';

const BATCHES = [
  {
    id: 'sports_leisure',
    topic: 'sports, hobbies and leisure activities',
    extra: 'Include expressions like: a holde seg i form, a spille pa lag, a gi alt, a komme i form. '
  },
  {
    id: 'legal_official',
    topic: 'legal rights, official documents and bureaucracy in Norway',
    extra: 'Include expressions like: ha rett til, soke om, fylle ut skjema, ha krav pa, fa innvilget, klage pa vedtak. '
  },
  {
    id: 'numbers_time',
    topic: 'numbers, repetition and frequency expressions',
    extra: 'Include: en gang til, for forste gang, for siste gang, to ganger i uken, hvert ar, en gang i blant, fra gang til gang. '
  },
  {
    id: 'norwegian_realities',
    topic: 'Norwegian social institutions and cultural realities',
    extra: 'Include expressions related to: NAV (welfare), dugnad (community work), friluftsliv (outdoor life), bunadsbryllup, hytteliv, allemannsretten, janteloven. Focus on multiword expressions. '
  },
  {
    id: 'academic_formal',
    topic: 'academic writing and formal Norwegian style',
    extra: 'Include: i henhold til, med bakgrunn i, pa bakgrunn av, i trad med, med hensyn til, ta utgangspunkt i, legge til grunn, stille krav til, sette fokus pa, rette seg etter. '
  },
  {
    id: 'negation_emphasis',
    topic: 'negation, emphasis and intensification expressions',
    extra: 'Include: ikke i det hele tatt, slett ikke, overhodet ikke, jo da, nei da, det er klart, selvfolgelig ikke, absolutt ikke, pa ingen mate, langt fra. '
  },
  {
    id: 'agreement_disagreement',
    topic: 'agreement, disagreement and opinion expressions',
    extra: 'Include: si seg enig, ta feil, ha et poeng, mene noe om, stille seg bak, ga imot, sette sporsmalstegn ved, stelle seg tvilende til. '
  },
  {
    id: 'cause_result',
    topic: 'cause, reason and result connectors',
    extra: 'Include: pa grunn av, som folge av, i forbindelse med, med tanke pa, av den grunn, derfor, pa den maten, som et resultat av. '
  },
  {
    id: 'housing_city',
    topic: 'housing, city life and local community in Norway',
    extra: 'Include: flytte inn, flytte ut, leie bolig, eie bolig, betale husleie, bo i leilighet, ha fast adresse, melde adresse. '
  },
  {
    id: 'media_communication',
    topic: 'media, news and modern communication',
    extra: 'Include: folge med pa, holde seg oppdatert, dele pa sosiale medier, ta opp et tema, sette dagsorden, bruke tid pa. '
  },
];

const all = existsSync(PARTIAL)
  ? JSON.parse(readFileSync(PARTIAL, 'utf-8'))
  : [];
const done = new Set(all.map(e => e.batch_id));

for (const batch of BATCHES) {
  if (done.has(batch.id)) { console.log('[SKIP] ' + batch.id); continue; }

  process.stdout.write('[FETCH] ' + batch.id + '...');
  const result = await callGemini(PROMPT_TEMPLATE(batch.topic, batch.extra));
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

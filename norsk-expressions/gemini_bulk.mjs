// Script B вЂ” Gemini bulk: top 1000 Norwegian expressions
// Makes multiple batched calls to Gemini to generate curated expression list
// Output: gemini_expressions.json
//
// Usage: GEMINI_API_KEY=your_key node gemini_bulk.mjs

import { writeFileSync, existsSync, readFileSync } from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE = './gemini_expressions.json';
const PARTIAL_FILE = './gemini_expressions_partial.json';

if (!GEMINI_API_KEY) {
  console.error('ERROR: set GEMINI_API_KEY environment variable');
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(prompt, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 90000); // 90s timeout

  let res;
  try {
    res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 2000,
          
        },
      }),
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      console.log(`\n  [TIMEOUT] attempt ${attempt} вЂ” no response in 90s`);
    } else {
      console.log(`\n  [NETWORK] ${e.message}`);
    }
    if (attempt < 3) {
      await sleep(10000);
      return callGemini(prompt, attempt + 1);
    }
    return [];
  }
  clearTimeout(timeout);

  if (res.status === 429) {
    const wait = attempt <= 2 ? 30000 : 60000;
    console.log(`  [429] rate limit вЂ” waiting ${wait/1000}s (attempt ${attempt})...`);
    await sleep(wait);
    return callGemini(prompt, attempt + 1);
  }

  if (!res.ok) {
    console.log(`  [HTTP ${res.status}] ${await res.text().then(t => t.slice(0,100))}`);
    if (attempt < 3) { await sleep(5000); return callGemini(prompt, attempt + 1); }
    return [];
  }

  const data = await res.json();

  if (data?.error) {
    console.log(`  [API ERROR] ${data.error.message || JSON.stringify(data.error)}`);
    return [];
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    console.log(`  [EMPTY] no text in response`);
    return [];
  }
  const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  try { return JSON.parse(clean); }
  catch (e) { console.error('JSON error:', e.message); console.error('Parse error:', clean.slice(0, 200)); return []; }
}

// 10 thematic batches Г— ~100 expressions each = ~1000 total
const BATCHES = [
  {
    id: 'verbs_reflexive',
    title: 'Reflexive and particle verbs',
    prompt: `Generate exactly 20 of the most common and useful Norwegian BokmГҐl REFLEXIVE VERBS and PARTICLE VERBS for language learners (A1-B2 level). Focus on verbs used in everyday spoken Norwegian.

Include:
- Reflexive verbs: glede seg, finne seg, kle pГҐ seg, etc.
- Particle verbs: gi opp, ta av, sette opp, etc.
- Reflexive-particle verbs: kle av seg, komme seg, etc.

For each item return these fields:
- lemma: canonical infinitive form starting with "ГҐ" (e.g. "ГҐ glede seg til", "ГҐ gi opp")  
- display_form: same as lemma but cleaner (e.g. "glede seg til")
- expression_subtype: one of: lexical_reflexive | reflexive_particle_verb | particle_verb | prepositional_verb | reflexive_construction
- meaning_en: English translation
- cefr: A1 | A2 | B1 | B2
- frequency_level: high | medium | low
- notes_ua: short grammar note in Ukrainian (optional, max 60 chars)

Return ONLY valid JSON array. No markdown, no preamble.`
  },
  {
    id: 'time_expressions',
    title: 'Time and frequency expressions',
    prompt: `Generate exactly 20 of the most common Norwegian BokmГҐl TIME EXPRESSIONS and FREQUENCY ADVERBIALS for language learners.

Include expressions like:
- i det siste, om stunden, for lengst, i tide, en gang imellom
- av og til, i blant, fra tid til annen, til slutt, til ГҐ begynne med
- pГҐ forhГҐnd, i forveien, for Гёyeblikket, i mellomtiden
- Temporal phrases with dag, uke, mГҐned, ГҐr, tid, gang

For each item:
- lemma: canonical form (e.g. "i det siste", "av og til")
- display_form: same as lemma
- expression_subtype: time_expression | discourse_marker | fixed_expression
- meaning_en: English translation
- cefr: A1 | A2 | B1 | B2
- frequency_level: high | medium | low
- notes_ua: optional short note in Ukrainian

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'modal_discourse',
    title: 'Modal and discourse markers',
    prompt: `Generate exactly 20 of the most common Norwegian BokmГҐl DISCOURSE MARKERS, MODAL PARTICLES, and CONVERSATIONAL EXPRESSIONS.

Include:
- Discourse connectors: pГҐ den ene siden...pГҐ den andre siden, i tillegg til, ikke bare...men ogsГҐ
- Modal expressions: ha lyst til, ha tenkt ГҐ, ha lov til, vГ¦re nГёdt til, vГ¦re i stand til
- Hedging: pГҐ en mГҐte, liksom, egentlig, faktisk, ganske, nesten, omtrent
- Conversation markers: for Гёvrig, dessuten, derimot, likevel, allikevel, til og med
- Agreement/disagreement: ha rett i, ta feil, vГ¦re enig i, si seg enig

For each item:
- lemma: canonical form
- display_form: same
- expression_subtype: discourse_marker | modal_expression | fixed_expression | prepositional_verb
- meaning_en: English translation
- cefr: A1 | A2 | B1 | B2  
- frequency_level: high | medium | low
- notes_ua: optional

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'body_health',
    title: 'Body, health, and emotions expressions',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl IDIOMS AND EXPRESSIONS related to body, health, feelings, and emotions.

Include:
- Body idioms: ha noe pГҐ hjertet, ta til fornuft, stГҐ pГҐ egne bein, ha is i magen
- Health: ha det travelt, ikke ha det bra, komme seg, bli bedre, fГёle seg bra/dГҐrlig
- Emotional states: vГ¦re glad i, bli lei av, ha nok av, se frem til, se tilbake pГҐ
- ta seg av, bryte ned, holde ut, gi etter, ta seg sammen

For each item:
- lemma: canonical form (start with "ГҐ" for verbs, or bare phrase)
- display_form: same
- expression_subtype: idiom | lexical_reflexive | particle_verb | fixed_expression | reflexive_construction
- meaning_en: English translation
- cefr: A1 | A2 | B1 | B2
- frequency_level: high | medium | low
- notes_ua: optional

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'work_social',
    title: 'Work, social, and daily life expressions',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl expressions used in WORK, SOCIAL SITUATIONS, and EVERYDAY LIFE.

Include:
- Work: ta ansvar for, ha ansvaret for, jobbe med, ha erfaring med, ta initiativ til
- Social: ha besГёk av, stikke innom, slГҐ av en prat, ta kontakt med, holde kontakten med
- Housing: flytte inn/ut, ta vare pГҐ, holde orden pГҐ, gjГёre rent, rydde opp
- Shopping/money: ha rГҐd til, spare opp, betale for seg, gГҐ i butikken
- Communication: ta opp (emne), si fra, gjГёre oppmerksom pГҐ, holde pГҐ med

For each item:
- lemma: canonical form
- display_form: same  
- expression_subtype: particle_verb | prepositional_verb | fixed_expression | collocation
- meaning_en: English translation
- cefr: A1 | A2 | B1 | B2
- frequency_level: high | medium | low
- notes_ua: optional

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'quantity_degree',
    title: 'Quantity, degree, and comparison expressions',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl QUANTITATIVE, DEGREE, and COMPARISON expressions.

Include:
- Degree: i hГёy grad, i stor grad, i det hele tatt, slett ikke, overhodet ikke, absolutt ikke
- Quantity: en del, en rekke, en hel del, mye mer, langt mer, ikke nok
- Comparison: i motsetning til, i likhet med, i stedet for, sammenlignet med
- Approximation: omtrent, cirka, rundt, noe slikt, noe i den retningen
- Addition: i tillegg, dessuten, foruten, i og med, bortsett fra, unntatt

For each:
- lemma, display_form, expression_subtype (quantifier | degree_expression | fixed_expression | discourse_marker)
- meaning_ua, meaning_en, example (Norwegian), cefr, frequency_level, notes_ua (optional)

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'communication_verbs',
    title: 'Communication and cognitive verbs with complements',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl PREPOSITIONAL VERBS and VERB COLLOCATIONS related to communication, thinking, and social interaction.

Include patterns:
- tenke pГҐ, tenke over, tenke seg om, tenke gjennom
- snakke om, snakke med, snakke til, prate med
- skrive til, skrive om, lese om, hГёre om, hГёre fra
- spГёrre om, svare pГҐ, fortelle om, forklare for
- si opp (jobb), si fra, si imot, si ja/nei til
- bestemme seg for, mene noe om, tro pГҐ, stole pГҐ

For each:
- lemma: canonical form with "ГҐ"
- display_form: verb + preposition pattern
- expression_subtype: prepositional_verb | particle_verb | lexical_reflexive
- meaning_ua, meaning_en
- cefr: A1-B2
- frequency_level: high | medium | low
- notes_ua: optional grammar note

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'movement_direction',
    title: 'Movement, direction, and location expressions',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl MOVEMENT VERBS with particles/prepositions and LOCATION EXPRESSIONS.

Include:
- gГҐ inn/ut/opp/ned/bort/frem/tilbake/videre/forbi
- komme inn/ut/hit/dit/tilbake/seg
- kjГёre til/fra/mot, fly til, reise til/fra/med
- bo i/pГҐ/ved, ligge i/pГҐ, stГҐ i/pГҐ/ved
- Location: i nГ¦rheten av, langt fra, like ved, rett rundt hjГёrnet
- ta av sted, dra av gГҐrde, legge ut pГҐ tur, vГ¦re pГҐ farten

For each:
- lemma: canonical form
- display_form: same
- expression_subtype: particle_verb | prepositional_verb | fixed_expression
- meaning_ua, meaning_en, example (Norwegian), cefr, frequency_level

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'idioms_figurative',
    title: 'Figurative idioms and fixed phrases',
    prompt: `Generate exactly 20 of the most useful Norwegian BokmГҐl FIGURATIVE IDIOMS and FIXED PHRASES that are common in spoken and written Norwegian.

Include colourful but genuinely common expressions:
- ha is i magen, ta seg vann over hodet, slГҐ to fluer i Г©n smekk
- gГҐ rundt grГёten, kaste perler for svin, ha mange jern i ilden
- ta saken i egne hender, snu seg rundt, stГҐ pГҐ egne ben
- komme til poenget, ta det med ro, holde motet oppe
- vГ¦re i samme bГҐt, trekke det lengste strГҐet, bite i det sure eplet

Prioritize expressions that are actually commonly used (not archaic).

For each:
- lemma: canonical form
- display_form: same
- expression_subtype: idiom | fixed_expression | particle_verb
- meaning_en: English translation  
- example: natural Norwegian sentence showing usage
- cefr: A2 | B1 | B2
- frequency_level: high | medium | low
- notes_ua: literal meaning or grammar note (optional)

Return ONLY valid JSON array. No markdown.`
  },
  {
    id: 'conversation_phrases',
    title: 'Conversational phrases and social formulas',
    prompt: `Generate exactly 20 common Norwegian BokmГҐl CONVERSATIONAL PHRASES, SOCIAL FORMULAS, and PRAGMATIC EXPRESSIONS used in everyday spoken Norwegian.

Include:
- Greetings/farewells: ha det bra, ta vare pГҐ deg, lykke til, god tur
- Agreement: ha rett, ta feil, si seg enig, ikke sant
- Politeness: vГ¦r sГҐ god, mange takk, ingen ГҐrsak, ikke noe problem  
- Reactions: si det samme, tenk det, vet du hva, ikke noe ГҐ si pГҐ det
- Checking understanding: hva mener du, forstГҐr du, er det klart
- Asking about wellbeing: ha det bra, ha det travelt, trives
- Expressing opinions: mene at, synes at, tro at, vГ¦re av den mening at

For each:
- lemma: canonical form  
- display_form: same
- expression_subtype: discourse_marker | fixed_expression | social_formula | collocation
- meaning_en: English translation
- example: short natural usage (can be a dialogue snippet)
- cefr: A1 | A2 | B1 | B2
- frequency_level: high | medium | low

Return ONLY valid JSON array. No markdown.`
  },
];

function normalizeExpression(expr) {
  if (!expr || typeof expr !== 'object') return null;

  const lemma = String(expr.lemma || expr.text || '').trim();
  if (!lemma || lemma.length < 3) return null;

  // Normalize lemma: lowercase, clean up
  const normalizedLemma = lemma
    .replace(/^[""В«В»]|[""В«В»]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Guess expression subtype if missing
  const subtype = expr.expression_subtype || guessSubtype(normalizedLemma);

  return {
    lemma: normalizedLemma,
    display_form: normalizedLemma.replace(/^ГҐ\s+/i, ''),
    pos: 'expression',
    expression_subtype: subtype,
    translation_ua: String(expr.meaning_ua || '').trim(),
    translation_en: String(expr.meaning_en || '').trim(),
    example: String(expr.example || '').trim(),
    notes_ua: String(expr.notes_ua || '').trim(),
    cefr: normalizeCEFR(expr.cefr),
    frequency_level: normalizeFrequency(expr.frequency_level),
    source: 'gemini_bulk',
    verification: 'ai_candidate',
    batch_id: expr._batch_id || '',
  };
}

function guessSubtype(lemma) {
  const l = lemma.toLowerCase();
  const tokens = l.split(/\s+/);
  const reflexive = new Set(['seg', 'meg', 'deg', 'oss', 'dere']);
  const particles = new Set(['opp', 'av', 'pГҐ', 'ut', 'inn', 'frem', 'bort', 'ned', 'over', 'under', 'igjen', 'til', 'fra', 'med']);
  
  const hasReflexive = tokens.some(t => reflexive.has(t));
  const hasParticle = tokens.some(t => particles.has(t));
  
  if (l.startsWith('ГҐ ')) {
    if (hasReflexive && hasParticle) return 'reflexive_particle_verb';
    if (hasReflexive) return 'lexical_reflexive';
    if (hasParticle) return 'particle_verb';
    return 'verb_expression';
  }
  if (/^(i|pГҐ|av|til|fra|med|om|for|etter|ved)\s/.test(l)) return 'prepositional_expression';
  return 'fixed_expression';
}

function normalizeCEFR(val) {
  const v = String(val || '').trim().toUpperCase();
  return ['A1','A2','B1','B2','C1','C2'].includes(v) ? v : '';
}

function normalizeFrequency(val) {
  const v = String(val || '').toLowerCase().trim();
  return ['high','medium','low','rare'].includes(v) ? v : 'medium';
}

// Deduplicate by normalized lemma
function deduplicateExpressions(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.lemma.toLowerCase()
      .replace(/^ГҐ\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      // Keep the one with more data
      const existing = seen.get(key);
      if (!existing.translation_ua && item.translation_ua) {
        seen.set(key, item);
      }
    }
  }
  return Array.from(seen.values());
}

async function main() {
  console.log('=== Gemini Bulk вЂ” Top Norwegian Expressions ===');
  console.log(`Batches: ${BATCHES.length} Г— ~100 = ~1000 expressions\n`);

  // в”Ђв”Ђ Test connection first в”Ђв”Ђ
  process.stdout.write('Testing Gemini API connection...');
  try {
    const testCtrl = new AbortController();
    const testTimeout = setTimeout(() => testCtrl.abort(), 15000);
    const testRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`,
      { signal: testCtrl.signal }
    ).finally(() => clearTimeout(testTimeout));

    if (testRes.status === 400 || testRes.status === 403) {
      const err = await testRes.json();
      console.log(`\n[ERROR] API key problem: ${err?.error?.message || testRes.status}`);
      process.exit(1);
    }
    if (testRes.status === 200) {
      console.log(' OK\n');
    } else {
      console.log(` HTTP ${testRes.status} вЂ” continuing anyway\n`);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('\n[ERROR] No response in 15s вЂ” check internet connection');
    } else {
      console.log(`\n[ERROR] ${e.message}`);
    }
    process.exit(1);
  }

  const allExpressions = [];

  // Load partial results if interrupted
  if (existsSync(PARTIAL_FILE)) {
    const partial = JSON.parse(readFileSync(PARTIAL_FILE, 'utf-8'));
    allExpressions.push(...partial);
    console.log(`Loaded ${partial.length} partial results\n`);
  }

  const completedBatchIds = new Set(allExpressions.map(e => e.batch_id));

  for (const batch of BATCHES) {
    if (completedBatchIds.has(batch.id)) {
      console.log(`[SKIP] ${batch.id} вЂ” already done`);
      continue;
    }

    process.stdout.write(`[FETCH] ${batch.title}...`);

    try {
      const result = await callGemini(batch.prompt);

      if (!Array.isArray(result)) {
        console.log(` ERROR: not an array`);
        continue;
      }

      const normalized = result
        .map(item => normalizeExpression({ ...item, _batch_id: batch.id }))
        .filter(Boolean);

      allExpressions.push(...normalized);
      writeFileSync(PARTIAL_FILE, JSON.stringify(allExpressions, null, 2));

      console.log(` ${normalized.length} expressions (total: ${allExpressions.length})`);
    } catch (e) {
      console.log(` ERROR: ${e.message}`);
    }

    await sleep(5000);
  }

  // Final deduplication
  const deduplicated = deduplicateExpressions(allExpressions);

  // Sort by frequency then CEFR
  const freqOrder = { high: 0, medium: 1, low: 2, rare: 3, '': 4 };
  const cefrOrder = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5, '': 6 };
  deduplicated.sort((a, b) =>
    (freqOrder[a.frequency_level] - freqOrder[b.frequency_level]) ||
    (cefrOrder[a.cefr] - cefrOrder[b.cefr])
  );

  writeFileSync(OUTPUT_FILE, JSON.stringify(deduplicated, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Raw total:       ${allExpressions.length}`);
  console.log(`After dedup:     ${deduplicated.length}`);
  
  // Stats by subtype
  const bySubtype = {};
  for (const e of deduplicated) {
    bySubtype[e.expression_subtype] = (bySubtype[e.expression_subtype] || 0) + 1;
  }
  console.log('\nBy subtype:');
  for (const [k, v] of Object.entries(bySubtype).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log(`\nOutput: ${OUTPUT_FILE}`);
}

main().catch(console.error);
















import { writeFileSync, existsSync, readFileSync } from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + API_KEY;
const OUTPUT = './gemini_expressions_4.json';
const PARTIAL = './gemini_expressions_4_partial.json';

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
  'List 20 most common Norwegian Bokmål multiword expressions used in ' + topic + '. ' +
  (extra || '') +
  'Return ONLY a JSON array. Each item: ' +
  '{"lemma":"canonical form","meaning_en":"English translation","expression_subtype":"particle_verb|prepositional_verb|fixed_expression|collocation|discourse_marker","cefr":"A2/B1/B2","frequency_level":"high/medium/low"}. ' +
  'Only multiword expressions (min 2 words). No examples field. No markdown.';

const BATCHES = [
  {
    id: 'business_general',
    topic: 'general business and professional Norwegian communication',
    extra: 'Include: innga avtale, drive virksomhet, ta stilling til, sette i verk, folge opp, legge frem, ta opp til diskusjon, na enighet, sette i gang et prosjekt, ha ansvaret for. '
  },
  {
    id: 'office_meetings',
    topic: 'office work, meetings and corporate communication in Norway',
    extra: 'Include: holde mote, kalle inn til, sende innkalling, ta referat, folge opp saker, sette pa dagsorden, gi tilbakemelding, ta initiativ, koordinere med, rapportere til. '
  },
  {
    id: 'hr_personnel',
    topic: 'HR, hiring, employment contracts and personnel management in Norway',
    extra: 'Include: soke stilling, fa ansettelse, skrive arbeidskontrakt, si opp jobben, bli sagt opp, ha permisjon, ga pa kurs, fa lonnsokning, vurdere kandidater, holde medarbeidersamtale. '
  },
  {
    id: 'sales_customers',
    topic: 'sales, customer service and client relations in Norwegian business',
    extra: 'Include: innga kontrakt, gi tilbud, folge opp kunde, handtere klage, lose problem, bygge relasjon, vinne anbudet, tape kunden, gi rabatt, fornye avtale. '
  },
  {
    id: 'marketing_branding',
    topic: 'marketing, branding and advertising in Norwegian',
    extra: 'Include: na ut til, bygge merkevare, drive markedsforing, lage kampanje, na malgruppen, skape oppmerksomhet, analysere markedet, posisjonere seg, kommunisere verdier, malrettet reklame. '
  },
  {
    id: 'logistics_supply',
    topic: 'logistics, supply chain and delivery in Norwegian business',
    extra: 'Include: levere til tiden, holde fristen, haandtere forsinkelse, spore forsendelse, motta varer, kontrollere kvalitet, sende retur, bekrefte mottak, laste opp dokument, innga samarbeid. '
  },
  {
    id: 'finance_accounting',
    topic: 'finance, accounting and budgeting in Norwegian companies',
    extra: 'Include: fa budsjett godkjent, styre kostnadene, ga i pluss, ga i minus, legge frem regnskap, betale faktura, sende faktura, folge opp betaling, ha likviditet, rapportere til styret. '
  },
  {
    id: 'project_management',
    topic: 'project management and planning in Norwegian professional context',
    extra: 'Include: sette mal, na mal, holde tidsplan, overholde budsjettet, fordele oppgaver, prioritere arbeid, evaluere resultater, justere kursen, levere pa tid, rapportere fremdrift. '
  },
  {
    id: 'digital_business',
    topic: 'digital business, e-commerce and online services in Norwegian',
    extra: 'Include: drive nettbutikk, bygge nettside, optimalisere for sok, na kunder digitalt, analysere data, bruke sosiale medier, lage innhold, engasjere folger, male resultater, skalere virksomhet. '
  },
  {
    id: 'networking_professional',
    topic: 'professional networking, partnerships and business relationships in Norway',
    extra: 'Include: knytte kontakter, bygge nettverk, innga partnerskap, presentere seg, holde foredrag, delta pa konferanse, folge opp bekjentskap, anbefale samarbeidspartner, dele kompetanse, vise til resultater. '
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

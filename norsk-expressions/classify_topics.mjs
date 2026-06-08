import { writeFileSync } from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + API_KEY;

const EXPRESSIONS = [
  "angre på","annenhver","avtalt tid","bestemme seg for noe","blant annet / andre",
  "bli kjent med","bli vant til / å være vant til","det er ingen tvil om","det lille ekstra",
  "det ser du vel","det stemmer","du har rett (i det)","engasjere seg","er ikke det.. (du)",
  "etter en stund","få (ha) barn med","få lov til å","felles verdier","finne ut",
  "føle seg fri","for dager- timer- måneder- år- siden","for lenge siden","for sent",
  "for tidlig","forrige dag / uke / måned / år","forsinket","gå glipp av","gå over",
  "gi beskjed","gi fra seg","glede seg","glede seg til","grue seg","ha mye til felles",
  "hit og dit","holde (en) tale","holde på","holde rent","høres ut som",
  "hva driver du med?","hva med deg?","hva slags","hvem som helst","hvor som helst",
  "hvordan er det med deg?","hvordan går det?","hvordan har du det?","i år",
  "i begynnelsen var","i dag","i dagens samfunn","i det hele tatt",
  "i det siste, den siste uka, de siste årene","i forfjor","i forgårs","i går",
  "i like stor grad","i løpet av dagen, en time, en dag, en måned, et år","i morgen",
  "i nærheten av","i slutten av uka / måneden","i tillegg (til)","jeg gleder meg",
  "kaldt / varmt / fuktig i lufta","kaste kortene","kjede seg","kjenne på",
  "klare seg selv","kle av","kle på","kle på seg","komme nærmere / nærme seg land",
  "komme på besøk","komme på døra","la noen være i fred","lære bort","legge merke til",
  "leve av","like ofte som før","lønnet arbeid","minst mulig","more seg","nærme seg",
  "når det gjelder","når som helst","neste dag / uke / måned / år",
  "om 5 minutter, om en uke, om en måned, om et år","om dagen","om gangen",
  "oppføre seg","overimorgen","på bakken","på egen hånd","på full tid","på landet",
  "passe på","pleier å","re opp","reise seg","så godt å høre",
  "se på","sette seg ned","si ifra","siden den gang","skje med","skynde seg",
  "slutte med","snakke med hverandre","stå opp","ta det rolig","ta opp igjen",
  "tenke på","trives med","tro på","vaske seg","vente på svar","vise seg"
];

const TOPICS = [
  'reflexive_verbs','time_expressions','discourse','health_emotions',
  'work_business','business_professional','degree_quantity','communication',
  'movement_travel','idioms','social_phrases','education','family_home',
  'nature_weather','food','money_finance','politics_society','technology',
  'sports_leisure','legal_official','numbers_time','norwegian_culture',
  'academic_formal','core_verbs','general'
];

async function callGemini(prompt) {
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    console.log('Network error:', e.message);
    return null;
  }
  clearTimeout(timer);
  if (!res.ok) { console.log('HTTP', res.status); return null; }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/^```+json\s*/i, '').replace(/\s*```+$/i, '').trim();
  try { return JSON.parse(clean); }
  catch (e) {
    // Try to repair
    try {
      let r = clean.replace(/,\s*$/, '');
      if (!r.trim().endsWith(']') && !r.trim().endsWith('}')) r += ']';
      return JSON.parse(r);
    } catch { console.log('Parse error:', clean.slice(0, 100)); return null; }
  }
}

// Split into chunks of 30
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

const allResults = [];

for (const batch of chunk(EXPRESSIONS, 30)) {
  const list = batch.map((e, i) => (i + 1) + '. ' + e).join('\n');
  const prompt = 'Classify each Norwegian expression into one of these topics: ' +
    TOPICS.join(', ') + '.\n\n' +
    'Expressions:\n' + list + '\n\n' +
    'Return ONLY a JSON array where each item has: ' +
    '{"lemma": "expression", "topic": "topic_name"}. ' +
    'No markdown, no explanation.';

  console.log('Processing', batch.length, 'expressions...');
  const result = await callGemini(prompt);
  if (Array.isArray(result)) {
    allResults.push(...result);
    console.log('Got', result.length, 'results (total:', allResults.length + ')');
  } else {
    console.log('Failed batch, using general');
    batch.forEach(e => allResults.push({ lemma: e, topic: 'general' }));
  }

  await new Promise(r => setTimeout(r, 3000));
}

writeFileSync('./topics_classification.json', JSON.stringify(allResults, null, 2));
console.log('\nDone:', allResults.length, 'expressions classified');
console.log('Output: ./topics_classification.json');

// Generate SQL
const sqlLines = allResults
  .filter(r => r.lemma && r.topic)
  .map(r => {
    const escaped = r.lemma.replace(/'/g, "''");
    return `UPDATE lexemes SET topic = '${r.topic}' WHERE lemma ILIKE '${escaped}' AND pos = 'expression' AND topic IS NULL;`;
  });

const sql = sqlLines.join('\n');
writeFileSync('./update_topics.sql', sql);
console.log('SQL generated:', sqlLines.length, 'statements -> ./update_topics.sql');

// supabase/functions/analyze-text/index.ts
// Norsk Trainer — Text Analyzer v6.0
//
// Что изменилось в v6:
//   1) loadDictionary — пагинация вместо range(0,9999), грузит всю базу
//   2) detectKnownPhrases — нормализация составных глагольных форм:
//      "har hatt det travelt" → ищет "ha det travelt" в словаре
//      "hadde gitt opp" → ищет "gi opp"
//   3) detectKnownPhrases — варианты рефлексивных местоимений:
//      "gleder meg til" → ищет "glede seg til" (meg→seg)
//   4) expressions из базы возвращают found объект на клиент
//      чтобы клиент мог показать жёлтый статус без повторного поиска

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!;

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const MAX_TEXT_LENGTH    = 12000;
const MAX_GEMINI_UNITS   = 30;
const MAX_PHRASE_TOKENS  = 8;  // увеличено с 7 до 8 для "hadde hatt det travelt"
const CHUNK_TARGET_WORDS = 60;
const CHUNK_MAX_WORDS    = 75;
const CHUNK_MAX_SENTENCES = 4;
const DICT_PAGE_SIZE     = 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type DictItem = {
  id: string;
  word: string;
  lemma: string;
  pos: string;
  type: string;
  ua: string;
  en: string;
  example: string;
  cefr: string;
  f1: string;
  f2: string;
  f3: string;
  f4: string;
  f5: string;
  expression_subtype?: string;
  frequency_rank?: number | null;
  frequency_level?: string;
  frequency_source?: string;
  frequency_note?: string;
};

type KnownMatch = {
  original: string;
  lemma: string;
  found: DictItem;
  start: number;
  end: number;
  matchType: 'expression' | 'single' | 'form';
};

type GeminiUnit = {
  text: string;
  lemma: string;
  pos: string;
  meaning_ua: string;
  meaning_en: string;
  is_expression: boolean;
  expression_subtype?: string;
  tokens?: string[];
  confidence: string;
  cefr?: string;
  frequency_level?: string;
};

type OrdbokeneResult = {
  found: boolean;
  foundByForm: boolean;
  lemma: string;
  pos: string;
  f1: string;
  f2: string;
  f3: string;
  f4?: string;
  f5?: string;
  inflectionClass: string;
};

type EnrichmentResult = {
  translation_ua: string;
  translation_en: string;
  example: string;
  notes_ua: string;
  cefr: string;
};

// ============================================================
// Normalization helpers
// ============================================================

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

function normalizeExpression(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .trim();
}

function tokenize(text: string): string[] {
  return String(text || '')
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, ' ')
    .replace(/[–—]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?/g)
    ?.map((item) => item.trim())
    .filter(Boolean) || [];
}

function splitIntoChunks(text: string): string[] {
  const sentences = splitSentences(text);
  if (!sentences.length) return text.trim() ? [text.trim()] : [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  function flush() {
    if (current.length) chunks.push(current.join(' ').trim());
    current = [];
    currentWords = 0;
  }

  for (const sentence of sentences) {
    const count = tokenize(sentence).length;
    if (count > CHUNK_MAX_WORDS) {
      flush();
      const words = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += CHUNK_TARGET_WORDS) {
        chunks.push(words.slice(i, i + CHUNK_TARGET_WORDS).join(' '));
      }
      continue;
    }
    const wouldExceedWords    = currentWords > 0 && currentWords + count > CHUNK_MAX_WORDS;
    const wouldExceedSentences = current.length >= CHUNK_MAX_SENTENCES;
    const reachedTarget        = currentWords >= CHUNK_TARGET_WORDS;
    if (wouldExceedWords || wouldExceedSentences || reachedTarget) flush();
    current.push(sentence);
    currentWords += count;
  }
  flush();
  return chunks;
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function compactError(value: string, max = 1200): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// ============================================================
// Stop words & pronouns
// ============================================================

const STOPWORDS = new Set([
  'og', 'i', 'på', 'pa', 'å', 'a', 'det', 'den', 'de', 'dem',
  'en', 'ei', 'et', 'for', 'med', 'som', 'at',
  'vi', 'du', 'jeg', 'han', 'hun', 'dere',
  'er', 'var', 'har', 'hadde', 'skal', 'vil', 'kan', 'må', 'ma',
  'til', 'av', 'fra', 'om', 'men', 'eller',
  'ikke', 'seg', 'meg', 'deg', 'oss', 'dere',
  'sin', 'sitt', 'sine',
  'min', 'mitt', 'mine', 'din', 'ditt', 'dine',
  'denne', 'dette', 'disse', 'da', 'når', 'nar', 'hvor',
  'hva', 'hvem', 'hvilken', 'hvilket', 'nå', 'na', 'her', 'der',
]);

const SUBJECT_PRONOUNS  = new Set(['jeg', 'du', 'han', 'hun', 'vi', 'dere', 'de', 'man']);
const REFLEXIVE_PRONOUNS = new Set(['meg', 'deg', 'seg', 'oss', 'dere']);

// Вспомогательные глаголы которые могут стоять перед perfektum
const AUXILIARY_VERBS = new Set([
  'har', 'hadde', 'er', 'var', 'blir', 'ble', 'blitt',
  'skal', 'skulle', 'vil', 'ville', 'kan', 'kunne',
  'må', 'måtte', 'bør', 'burde',
]);

function hasReflexivePronoun(tokens: string[] = []): boolean {
  return tokens.some((token) => REFLEXIVE_PRONOUNS.has(normalize(token)));
}

function normalizeExpressionSubtype(unit: GeminiUnit): string {
  const raw    = String(unit.expression_subtype || unit.pos || '').toLowerCase();
  const tokens = unit.tokens?.length ? unit.tokens : tokenize(unit.text || '');
  if (hasReflexivePronoun(tokens)) {
    if (raw.includes('particle')) return 'reflexive_particle_verb';
    return 'lexical_reflexive';
  }
  if (raw.includes('particle'))     return 'particle_verb';
  if (raw.includes('prepositional')) return 'prepositional_verb';
  if (raw.includes('fixed'))        return 'fixed_expression';
  if (raw.includes('idiom'))        return 'idiom';
  if (raw.includes('time'))         return 'time_expression';
  if (raw.includes('discourse'))    return 'discourse_marker';
  if (raw.includes('collocation'))  return 'collocation';
  return 'verb_expression';
}

function shouldDeferSingleMatchToGemini(
  token: string,
  previousToken: string | undefined,
  found: DictItem
): boolean {
  const norm = normalize(token);
  const prev = normalize(previousToken || '');
  if (!found || found.pos !== 'noun') return false;
  if (!SUBJECT_PRONOUNS.has(prev)) return false;
  return /er$/.test(norm) || /r$/.test(norm);
}

// ============================================================
// v6: Compound form normalization
// Normalizes token sequences to canonical expression form
// "har hatt det travelt" → tokens ["ha", "det", "travelt"]
// "gleder meg til"       → tokens ["glede", "seg", "til"]
// ============================================================

// Built lazily from dictionary — perfektum → infinitiv
const PERFEKTUM_TO_INFINITIV = new Map<string, string>();
const PRESENS_TO_INFINITIV   = new Map<string, string>();

function buildVerbMaps(data: any[]): void {
  for (const row of data) {
    if (row.pos !== 'verb') continue;
    const vf = row.verb_forms?.[0] || {};
    const inf = String(row.lemma || '').replace(/^å\s+/i, '').trim();
    if (!inf) continue;
    if (vf.perfektum) {
      const p = normalize(vf.perfektum);
      if (p && !PERFEKTUM_TO_INFINITIV.has(p)) PERFEKTUM_TO_INFINITIV.set(p, inf);
    }
    if (vf.presens) {
      const p = normalize(vf.presens);
      if (p && !PRESENS_TO_INFINITIV.has(p)) PRESENS_TO_INFINITIV.set(p, inf);
    }
  }
}

// Normalize a token slice to canonical expression tokens
// Returns normalized tokens array or null if no normalization needed
function normalizeCompoundTokens(tokens: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = normalize(tokens[i]);

    // Pattern: auxiliary + perfektum → infinitiv
    // "har hatt" → "ha"  |  "hadde gitt" → "gi"
    if (AUXILIARY_VERBS.has(tok) && i + 1 < tokens.length) {
      const next = normalize(tokens[i + 1]);
      const inf  = PERFEKTUM_TO_INFINITIV.get(next);
      if (inf) {
        result.push(inf);
        i += 2;
        continue;
      }
    }

    // Pattern: reflexive pronoun → seg
    // "meg" | "deg" | "oss" | "dere" → "seg"
    if (REFLEXIVE_PRONOUNS.has(tok)) {
      result.push('seg');
      i++;
      continue;
    }

    // Pattern: presens → infinitiv for verb at start of expression
    // "gleder" → "glede"  |  "gir" → "gi"
    if (result.length === 0 && PRESENS_TO_INFINITIV.has(tok)) {
      result.push(PRESENS_TO_INFINITIV.get(tok)!);
      i++;
      continue;
    }

    result.push(tok);
    i++;
  }

  return result;
}

// ============================================================
// Dictionary loader — v6: pagination instead of range(0,9999)
// ============================================================

async function loadDictionary(): Promise<Map<string, DictItem>> {
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('lexemes')
      .select(`
        id, lemma, display_form, pos,
        translation_ua, translation_en, example, cefr,
        frequency_rank, frequency_level, frequency_source, frequency_note,
        expression_data (expression_subtype),
        verb_forms (presens, preteritum, perfektum, infinitiv),
        noun_forms (best_entall, ubest_flertall, best_flertall, ubest_entall),
        adjective_forms (intetkjonn, flertall, komparativ, superlativ, best_superlativ)
      `)
      .range(from, from + DICT_PAGE_SIZE - 1)
      .limit(DICT_PAGE_SIZE);

    if (error) throw new Error('DB error: ' + error.message);
    const rows = data || [];
    allRows.push(...rows);
    hasMore = rows.length === DICT_PAGE_SIZE;
    from += DICT_PAGE_SIZE;
  }

  // Build verb maps for compound form normalization
  buildVerbMaps(allRows);

  const dict = new Map<string, DictItem>();

  for (const row of allRows) {
    const vf = row.verb_forms?.[0]      || {};
    const nf = row.noun_forms?.[0]      || {};
    const af = row.adjective_forms?.[0] || {};
    const ed = row.expression_data?.[0] || {};

    const mapped: DictItem = {
      id:      row.id,
      word:    row.display_form || row.lemma,
      lemma:   row.lemma,
      pos:     row.pos,
      type:    row.pos,
      ua:      row.translation_ua || '',
      en:      row.translation_en || '',
      example: row.example        || '',
      cefr:    row.cefr           || '',
      f1: vf.presens         || af.intetkjonn    || nf.best_entall    || '',
      f2: vf.preteritum      || af.flertall      || nf.ubest_flertall || '',
      f3: vf.perfektum       || af.komparativ    || nf.best_flertall  || '',
      f4: af.superlativ      || '',
      f5: af.best_superlativ || '',
      expression_subtype: ed.expression_subtype || '',
      frequency_rank:    row.frequency_rank   ?? null,
      frequency_level:   row.frequency_level  || '',
      frequency_source:  row.frequency_source || '',
      frequency_note:    row.frequency_note   || '',
    };

    const keys = [
      row.lemma,
      row.display_form,
      vf.infinitiv,
      vf.presens,
      vf.preteritum,
      vf.perfektum,
      nf.ubest_entall,
      nf.best_entall,
      nf.ubest_flertall,
      nf.best_flertall,
      af.intetkjonn,
      af.flertall,
      af.komparativ,
      af.superlativ,
    ];

    for (const rawKey of keys) {
      const key = row.pos === 'expression'
        ? normalizeExpression(rawKey || '')
        : normalize(rawKey || '');
      if (key && key.length >= 2 && !dict.has(key)) {
        dict.set(key, mapped);
      }
    }

    // For expressions: also index reflexive pronoun variants
    // "glede seg til" → also index "glede meg til", "glede deg til", "glede oss til"
    if (row.pos === 'expression') {
      const baseKey = normalizeExpression(row.lemma || '');
      if (baseKey.includes('seg')) {
        for (const pron of ['meg', 'deg', 'oss', 'dere']) {
          const variant = baseKey.replace(/\bseg\b/g, pron);
          if (variant !== baseKey && !dict.has(variant)) {
            dict.set(variant, mapped);
          }
        }
      }
    }
  }

  return dict;
}

// ============================================================
// v6: detectKnownPhrases with compound normalization
// ============================================================

function detectKnownPhrases(
  tokens: string[],
  dict: Map<string, DictItem>
): { known: KnownMatch[]; usedIndices: Set<number> } {
  const known: KnownMatch[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    if (usedIndices.has(i)) continue;

    for (let len = Math.min(MAX_PHRASE_TOKENS, tokens.length - i); len >= 2; len--) {
      const slice    = tokens.slice(i, i + len);
      const phrase   = slice.join(' ');
      const normKey  = normalizeExpression(phrase);

      // 1. Exact match
      let found = dict.get(normKey);

      // 2. Normalized compound match (aux+perf, reflexive pronouns, presens→inf)
      if (!found || found.pos !== 'expression') {
        const normalizedTokens = normalizeCompoundTokens(slice);
        const normalizedKey    = normalizedTokens.join(' ');
        if (normalizedKey !== normKey) {
          const candidate = dict.get(normalizedKey);
          if (candidate && candidate.pos === 'expression') {
            found = candidate;
          }
        }
      }

      if (found && found.pos === 'expression') {
        known.push({
          original: phrase,
          lemma:    found.lemma,
          found,
          start:    i,
          end:      i + len - 1,
          matchType: 'expression',
        });
        for (let j = i; j < i + len; j++) usedIndices.add(j);
        break;
      }
    }
  }

  return { known, usedIndices };
}

// ============================================================
// detectKnownSingleWords — unchanged from v5
// ============================================================

function detectKnownSingleWords(
  tokens: string[],
  dict: Map<string, DictItem>,
  usedIndices: Set<number>
) {
  const known: KnownMatch[]    = [];
  const unknownTokens: string[] = [];
  const unknownSeen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    if (usedIndices.has(i)) continue;

    const token   = tokens[i];
    const normKey = normalize(token);

    if (!normKey || normKey.length < 2) {
      usedIndices.add(i);
      continue;
    }

    const found = dict.get(normKey);
    if (found && !shouldDeferSingleMatchToGemini(token, tokens[i - 1], found)) {
      known.push({ original: token, lemma: found.lemma, found, start: i, end: i, matchType: 'single' });
    } else if (!STOPWORDS.has(normKey)) {
      if (!unknownSeen.has(normKey)) {
        unknownSeen.add(normKey);
        unknownTokens.push(token);
      }
    }
    usedIndices.add(i);
  }

  return { known, unknownTokens };
}

// ============================================================
// Gemini helpers — unchanged from v5
// ============================================================

function extractJsonFromGeminiText(text: string): string {
  let clean = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const arrayStart = clean.indexOf('[');
  const arrayEnd   = clean.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) return clean.slice(arrayStart, arrayEnd + 1);

  const objectStart = clean.indexOf('{');
  const objectEnd   = clean.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) return clean.slice(objectStart, objectEnd + 1);

  return clean;
}

async function callGemini(prompt: string): Promise<{ data: any; status: string; error: string; model: string }> {
  if (!GEMINI_API_KEY) {
    return { data: null, status: 'missing_api_key', error: 'GEMINI_API_KEY is missing', model: '' };
  }

  let lastError = '';

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:      0.1,
            maxOutputTokens:  12000,
            responseMimeType: 'application/json',
          },
        }),
      });

      const raw = await res.text();
      if (res.status === 429) { lastError = raw; continue; }
      if (!res.ok)            { lastError = raw; continue; }

      let parsedResponse: any;
      try { parsedResponse = JSON.parse(raw); } catch { lastError = raw; continue; }

      if (parsedResponse?.error) { lastError = JSON.stringify(parsedResponse.error); continue; }

      const text = parsedResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) { lastError = raw; continue; }

      const clean = extractJsonFromGeminiText(text);
      try {
        return { data: JSON.parse(clean), status: 'gemini_ok', error: '', model };
      } catch {
        return { data: null, status: 'gemini_parse_error', error: clean.slice(0, 2000), model };
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
      continue;
    }
  }

  return { data: null, status: 'gemini_http_error', error: compactError(lastError), model: '' };
}

async function geminiAnalyzeUnknownUnits(
  fullText: string,
  allTokens: string[],
  unknownTokens: string[],
  knownMatches: KnownMatch[]
) {
  const knownList = knownMatches
    .map((k) => `- "${k.original}" -> "${k.lemma}" (${k.found.pos})`)
    .slice(0, 80)
    .join('\n');

  const unknownList = Array.from(new Set(unknownTokens.map((t) => normalize(t)).filter(Boolean)))
    .map((w, i) => `${i + 1}. ${w}`)
    .join('\n');

  const tokenList = allTokens.map((t, i) => `${i + 1}:${t}`).join(' ');

  const prompt = `You are a Norwegian Bokmål lexical analyzer for a language-learning app.

FULL TEXT:
"${fullText}"

TOKENS WITH INDEX:
${tokenList}

KNOWN UNITS ALREADY FOUND IN DATABASE:
${knownList || '(none)'}

UNKNOWN TOKENS THAT NEED ANALYSIS:
${unknownList || '(none)'}

TASK:
Return lexical units from the text that are NOT already covered by known units.
You MUST detect multi-word expressions from the full text, even if they contain function words.
Return at most ${MAX_GEMINI_UNITS} items total.

PRIORITY ORDER:
1. Multi-word expressions.
2. Reflexive verbs.
3. Particle verbs.
4. Prepositional verbs.
5. Important unknown content words only.

Do NOT return every noun and every verb from the text.
Do NOT return proper names such as Oslo.
Do NOT return words already covered by KNOWN UNITS.
For each item include cefr (A1, A2, B1, B2, C1) and frequency_level (high, medium, low, rare).

IMPORTANT EXPRESSION RULES:
- If text contains "i det siste", return expression lemma "i det siste".
- If text contains "gleder meg til", return expression lemma "å glede seg til".
- If text contains "har hatt det travelt", return expression lemma "å ha det travelt".
- If text contains "kler på seg", return expression lemma "å kle på seg".
- If text contains "gir opp", return expression lemma "å gi opp".
- Reflexive pronouns meg/deg/seg/oss/dere normalize to "seg" in lemma.
- Particle/prepositional/reflexive expressions should be returned as expressions, not separate words.

SINGLE WORD RULES:
- Verb lemma must use "å": "arbeider" -> "å arbeide", "gikk" -> "å gå".
- Noun lemma: indefinite singular without article unless article is necessary.
- Adjective lemma: base positive form.
- Skip pure function words unless part of an expression.

POS values:
verb | noun | adjective | adverb | fixed_expression | particle_verb | prepositional_verb | reflexive_verb | reflexive_particle_verb | expression

Return ONLY valid JSON array. Max ${MAX_GEMINI_UNITS} items. No markdown.
[
  {
    "text": "gleder meg til",
    "lemma": "å glede seg til",
    "pos": "reflexive_verb",
    "meaning_ua": "з нетерпінням чекати",
    "meaning_en": "to look forward to",
    "is_expression": true,
    "expression_subtype": "lexical_reflexive",
    "tokens": ["gleder", "meg", "til"],
    "confidence": "high",
    "cefr": "B1",
    "frequency_level": "medium"
  }
]`;

  const result = await callGemini(prompt);

  if (!Array.isArray(result.data)) {
    return { units: [] as GeminiUnit[], status: result.status, error: result.error, model: result.model };
  }

  const units: GeminiUnit[] = result.data.slice(0, MAX_GEMINI_UNITS).map((item: any) => ({
    text:               String(item.text || '').trim(),
    lemma:              String(item.lemma || item.text || '').trim(),
    pos:                String(item.pos || 'word').trim(),
    meaning_ua:         String(item.meaning_ua || '').trim(),
    meaning_en:         String(item.meaning_en || '').trim(),
    is_expression:      !!item.is_expression || String(item.pos || '').includes('expression') || String(item.pos || '').includes('_verb'),
    expression_subtype: String(item.expression_subtype || '').trim(),
    tokens:             Array.isArray(item.tokens) ? item.tokens.map((x: any) => String(x)) : [],
    confidence:         String(item.confidence || 'medium').trim(),
    cefr:               String(item.cefr || '').trim(),
    frequency_level:    String(item.frequency_level || '').trim(),
  })).filter((u) => u.text || u.lemma);

  return { units, status: result.status, error: result.error, model: result.model };
}

// ============================================================
// Ordbøkene verification — unchanged from v5
// ============================================================

async function verifyWithOrdbokene(lemma: string, posHint: string): Promise<OrdbokeneResult> {
  const empty: OrdbokeneResult = { found: false, foundByForm: false, lemma, pos: posHint, f1: '', f2: '', f3: '', f4: '', f5: '', inflectionClass: '' };

  try {
    const searchWord = lemma.replace(/^å\s+/i, '').replace(/^(en|ei|et)\s+/i, '').trim();
    if (!searchWord) return empty;

    let url = `https://ord.uib.no/api/articles?w=${encodeURIComponent(searchWord)}&dict=bm&scope=e`;
    let res = await fetch(url);
    if (!res.ok) return empty;

    let data = await res.json();
    let articles: any[] = data?.articles?.bm || [];
    let foundByForm = false;

    if (!articles.length) {
      url = `https://ord.uib.no/api/articles?w=${encodeURIComponent(searchWord)}&dict=bm&scope=i`;
      res  = await fetch(url);
      if (!res.ok) return empty;
      data     = await res.json();
      articles = data?.articles?.bm || [];
      foundByForm = articles.length > 0;
    }

    if (!articles.length) return empty;

    for (const id of articles.slice(0, 5)) {
      const articleRes = await fetch(`https://ord.uib.no/bm/article/${id}.json`);
      if (!articleRes.ok) continue;
      const article = await articleRes.json();

      for (const lemmaObj of (article?.lemmas || [])) {
        const tags           = lemmaObj?.paradigm_info?.[0]?.tags || [];
        const detectedPos    = posFromTags(tags, posHint);
        const normalizedHint = normalizePosHint(posHint);
        const posMatches     = !normalizedHint || normalizedHint === detectedPos || (normalizedHint === 'expression' && detectedPos === 'verb');
        if (!posMatches && articles.length > 1) continue;
        const forms = lemmaObj?.paradigm_info?.[0]?.inflection || [];
        return buildOrdbokeneResult(lemmaObj?.lemma || lemma, detectedPos, forms, lemmaObj?.inflection_class || '', foundByForm);
      }
    }
    return empty;
  } catch {
    return empty;
  }
}

function normalizePosHint(pos: string): string {
  const p = String(pos || '').toLowerCase();
  if (p.includes('verb'))       return 'verb';
  if (p.includes('noun'))       return 'noun';
  if (p.includes('adj'))        return 'adjective';
  if (p.includes('adv'))        return 'adverb';
  if (p.includes('expression')) return 'expression';
  return p;
}

function posFromTags(tags: string[], fallback: string): string {
  if (tags.includes('VERB')) return 'verb';
  if (tags.includes('NOUN')) return 'noun';
  if (tags.includes('ADJ'))  return 'adjective';
  if (tags.includes('ADV'))  return 'adverb';
  return normalizePosHint(fallback) || 'word';
}

function getForm(forms: any[], ...tagSets: string[][]): string {
  for (const tags of tagSets) {
    const found = forms.find((f: any) => tags.every((t) => (f.tags || []).includes(t)));
    if (found?.word_form && found.word_form !== 'null') return found.word_form;
  }
  return '';
}

function buildOrdbokeneResult(lemma: string, pos: string, forms: any[], inflClass: string, foundByForm: boolean): OrdbokeneResult {
  let f1 = '', f2 = '', f3 = '', f4 = '', f5 = '';
  if (pos === 'verb') {
    f1 = getForm(forms, ['Pres'], ['Pres', 'Act']);
    f2 = getForm(forms, ['Past'], ['Pret'], ['Past', 'Act']);
    const perf = getForm(forms, ['<PerfPart>'], ['PerfPart'], ['PastPart']);
    f3 = perf ? `har ${perf}` : '';
  } else if (pos === 'noun') {
    f1 = getForm(forms, ['Sing', 'Def']);
    f2 = getForm(forms, ['Plur', 'Ind'], ['Plur']);
    f3 = getForm(forms, ['Plur', 'Def']);
  } else if (pos === 'adjective') {
    f1 = getForm(forms, ['Neuter', 'Ind', 'Sing'], ['Neuter', 'Sing'], ['Neuter']);
    f2 = getForm(forms, ['Plur'], ['Def']);
    f3 = getForm(forms, ['Cmp'], ['Comp'], ['Comparative']);
    f4 = getForm(forms, ['Sup', 'Ind'], ['Sup'], ['Superl']);
    const rawF5 = getForm(forms, ['Sup', 'Def'], ['Superl', 'Def']);
    f5 = rawF5.replace(/^(den|det|de)\s+/i, '').trim();
  }
  const displayLemma = pos === 'verb' && !/^å\s+/i.test(lemma) ? `å ${lemma}` : lemma;
  return { found: true, foundByForm, lemma: displayLemma, pos, f1, f2, f3, f4, f5, inflectionClass: inflClass };
}

// ============================================================
// Enrichment batch — unchanged from v5
// ============================================================

async function geminiEnrichBatch(units: Array<{ lemma: string; pos: string; f1?: string; meaning_ua?: string; meaning_en?: string }>) {
  const results    = new Map<string, EnrichmentResult>();
  if (!units.length) return { map: results, status: 'skipped', error: '', model: '' };

  const needEnrich  = units.filter((u) => !u.meaning_ua && !u.meaning_en);
  const alreadyHave = units.filter((u) => u.meaning_ua || u.meaning_en);

  for (const u of alreadyHave) {
    results.set(u.lemma, { translation_ua: u.meaning_ua || '', translation_en: u.meaning_en || '', example: '', notes_ua: '', cefr: '' });
  }

  if (!needEnrich.length) return { map: results, status: 'already_have_meaning', error: '', model: '' };

  const list   = needEnrich.map((u, i) => `${i + 1}. ${u.lemma} (${u.pos})${u.f1 ? ', form: ' + u.f1 : ''}`).join('\n');
  const prompt = `You are a Norwegian language expert. Provide enrichment data for these verified Norwegian lexical units.

WORDS:
${list}

Return ONLY valid JSON array (no markdown):
[{"index":1,"translation_ua":"працювати","translation_en":"to work","example":"Han arbeider på kontoret.","notes_ua":"примітка","cefr":"A1"}]`;

  const result = await callGemini(prompt);
  if (!Array.isArray(result.data)) return { map: results, status: result.status, error: result.error, model: result.model };

  result.data.forEach((item: any, idx: number) => {
    const unit = needEnrich[(Number(item.index) || idx + 1) - 1] || needEnrich[idx];
    if (!unit) return;
    results.set(unit.lemma, {
      translation_ua: String(item.translation_ua || '').trim(),
      translation_en: String(item.translation_en || '').trim(),
      example:        String(item.example || '').trim(),
      notes_ua:       String(item.notes_ua || '').trim(),
      cefr:           String(item.cefr || '').trim(),
    });
  });

  return { map: results, status: result.status, error: result.error, model: result.model };
}

// ============================================================
// analyzeChunk — v6: expressions get in_base flag from found
// ============================================================

type ChunkAnalysis = {
  missing:     any[];
  expressions: any[];
  known:       any[];
  stats:       any;
  debug:       any;
};

function mergeUniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return uniqueBy(items, keyFn);
}

async function analyzeChunk(text: string, dict: Map<string, DictItem>, chunkIndex: number): Promise<ChunkAnalysis> {
  const tokens      = tokenize(text);
  const phraseResult = detectKnownPhrases(tokens, dict);
  const singleResult = detectKnownSingleWords(tokens, dict, phraseResult.usedIndices);
  const dbKnownRaw   = [...phraseResult.known, ...singleResult.known];

  const geminiAnalysis = await geminiAnalyzeUnknownUnits(text, tokens, singleResult.unknownTokens, dbKnownRaw);
  const geminiUnits    = geminiAnalysis.units;

  const coveredNorms = new Set<string>();
  for (const k of dbKnownRaw) {
    coveredNorms.add(normalizeExpression(k.original));
    coveredNorms.add(normalizeExpression(k.lemma));
  }

  const expressionUnits = uniqueBy(
    geminiUnits.filter((u) => {
      const nText  = normalizeExpression(u.text);
      const nLemma = normalizeExpression(u.lemma);
      return u.is_expression && !coveredNorms.has(nText) && !coveredNorms.has(nLemma);
    }),
    (u) => normalizeExpression(u.lemma || u.text)
  );

  const expressionTokenSet = new Set<string>();
  for (const expr of expressionUnits) {
    for (const token of (expr.tokens || [])) expressionTokenSet.add(normalize(token));
    for (const token of tokenize(expr.text || '')) expressionTokenSet.add(normalize(token));
  }

  const dbKnownFiltered = dbKnownRaw.filter((k) => {
    if (k.matchType !== 'single') return true;
    return !expressionTokenSet.has(normalize(k.original));
  });
  dbKnownRaw.length = 0;
  dbKnownRaw.push(...dbKnownFiltered);

  const wordUnits = uniqueBy(
    geminiUnits.filter((u) => {
      if (u.is_expression) return false;
      const nText  = normalize(u.text);
      const nLemma = normalize(u.lemma);
      if (!nText && !nLemma) return false;
      if (STOPWORDS.has(nText) || STOPWORDS.has(nLemma)) return false;
      if (expressionTokenSet.has(nText)) return false;
      if (coveredNorms.has(nText) || coveredNorms.has(nLemma)) return false;
      return true;
    }),
    (u) => normalize(u.lemma || u.text)
  );

  const verifiedUnits: Array<{ gemini: GeminiUnit; ordbokene: OrdbokeneResult }> = [];

  for (const unit of wordUnits) {
    const normLemma = normalize(unit.lemma);
    const normText  = normalize(unit.text);
    const inDb      = dict.get(normLemma) || dict.get(normText);

    if (inDb) {
      dbKnownRaw.push({ original: unit.text, lemma: inDb.lemma, found: inDb, start: -1, end: -1, matchType: 'form' });
      continue;
    }

    const ordbokene = await verifyWithOrdbokene(unit.lemma, unit.pos);
    verifiedUnits.push({ gemini: unit, ordbokene });
  }

  const toEnrich = verifiedUnits.map((u) => ({
    lemma:      u.ordbokene.found ? u.ordbokene.lemma : u.gemini.lemma,
    pos:        u.ordbokene.found ? u.ordbokene.pos   : u.gemini.pos,
    f1:         u.ordbokene.f1,
    meaning_ua: u.gemini.meaning_ua,
    meaning_en: u.gemini.meaning_en,
  }));

  const enrichment = await geminiEnrichBatch(toEnrich);

  const missing = verifiedUnits.map((u) => {
    const finalLemma = u.ordbokene.found ? u.ordbokene.lemma : u.gemini.lemma;
    const e = enrichment.map.get(finalLemma) || {
      translation_ua: u.gemini.meaning_ua,
      translation_en: u.gemini.meaning_en,
      example: '', notes_ua: '', cefr: '',
    };
    const possibleDb = dict.get(normalize(finalLemma)) || dict.get(normalize(u.gemini.text));

    return {
      lemma:        finalLemma,
      text:         u.gemini.text,
      type:         u.ordbokene.found ? u.ordbokene.pos : u.gemini.pos,
      meaning_ua:   e.translation_ua,
      meaning_en:   e.translation_en,
      example:      e.example,
      notes_ua:     e.notes_ua,
      cefr:         e.cefr || u.gemini.cefr || possibleDb?.cefr || '',
      frequency_rank:   possibleDb?.frequency_rank   ?? null,
      frequency_level:  possibleDb?.frequency_level  || u.gemini.frequency_level  || '',
      frequency_source: possibleDb?.frequency_source || (u.gemini.frequency_level ? 'gemini_estimate' : ''),
      frequency_note:   possibleDb?.frequency_note   || '',
      f1: u.ordbokene.f1 || '',
      f2: u.ordbokene.f2 || '',
      f3: u.ordbokene.f3 || '',
      f4: u.ordbokene.f4 || '',
      f5: u.ordbokene.f5 || '',
      inflection_class:       u.ordbokene.inflectionClass || '',
      ordbokene_verified:     u.ordbokene.found,
      ordbokene_found_by_form: u.ordbokene.foundByForm,
      verification:   u.ordbokene.found ? 'verified_dictionary' : 'ai_candidate',
      confidence:     u.gemini.confidence,
      chunk_index:    chunkIndex,
    };
  });

  // v6: expressions now carry in_base flag and found object
  // so client can show yellow (in_base) without extra lookup
  const expressions = expressionUnits.map((u) => {
    const possibleDb = dict.get(normalizeExpression(u.lemma)) || dict.get(normalizeExpression(u.text));
    return {
      lemma:            u.lemma,
      text:             u.text,
      type:             'expression',
      expression_subtype: normalizeExpressionSubtype(u),
      meaning_ua:       u.meaning_ua,
      meaning_en:       u.meaning_en,
      example:          '',
      cefr:             possibleDb?.cefr            || u.cefr            || '',
      frequency_rank:   possibleDb?.frequency_rank  ?? null,
      frequency_level:  possibleDb?.frequency_level || u.frequency_level || '',
      frequency_source: possibleDb?.frequency_source || (u.frequency_level ? 'gemini_estimate' : ''),
      frequency_note:   possibleDb?.frequency_note   || '',
      confidence:       u.confidence,
      // v6: explicit in_base flag — client uses this directly
      in_base:          !!possibleDb,
      verification:     possibleDb ? 'known_dictionary' : 'ai_candidate',
      found:            possibleDb || null,
      chunk_index:      chunkIndex,
    };
  });

  const known = uniqueBy(
    dbKnownRaw,
    (k) => `${normalizeExpression(k.lemma)}|${k.found.id}`
  ).map((k) => ({
    lemma:      k.lemma,
    text:       k.original,
    match_type: k.matchType,
    found:      k.found,
    chunk_index: chunkIndex,
  }));

  return {
    missing,
    expressions,
    known,
    debug: {
      chunk_index:       chunkIndex,
      text,
      word_count:        tokens.length,
      tokens,
      unknownTokens:     singleResult.unknownTokens,
      phraseMatches:     phraseResult.known.map((k) => k.original),
      gemini_status:     geminiAnalysis.status,
      gemini_error:      geminiAnalysis.error,
      gemini_model:      geminiAnalysis.model,
      enrichment_status: enrichment.status,
      enrichment_error:  enrichment.error,
      enrichment_model:  enrichment.model,
      gemini_units:      geminiUnits.length,
      gemini_expressions: expressionUnits.length,
    },
    stats: {
      total_tokens:      tokens.length,
      known_count:       known.length,
      missing_count:     missing.length,
      expression_count:  expressions.length,
      unknown_tokens:    singleResult.unknownTokens.length,
      db_phrase_matches: phraseResult.known.length,
      db_single_matches: singleResult.known.length,
      gemini_units:      geminiUnits.length,
      gemini_expressions: expressionUnits.length,
      ordbokene_verified: missing.filter((m) => m.ordbokene_verified).length,
      ai_candidate:       missing.filter((m) => !m.ordbokene_verified).length,
    },
  };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text: string = String(body.text || '').trim();

    if (!text) return json({ ok: false, message: 'text is required' }, 400);
    if (text.length > MAX_TEXT_LENGTH) {
      return json({ ok: false, message: `Text is too long. Max ${MAX_TEXT_LENGTH} characters.`, tooLong: true }, 400);
    }

    const dict   = await loadDictionary();
    const chunks = splitIntoChunks(text);
    const allResults: ChunkAnalysis[] = [];

    for (let i = 0; i < chunks.length; i++) {
      allResults.push(await analyzeChunk(chunks[i], dict, i));
    }

    const missing = mergeUniqueBy(
      allResults.flatMap((r) => r.missing),
      (item) => `${normalize(item.lemma || item.text)}|${item.type || ''}`
    );

    const expressions = mergeUniqueBy(
      allResults.flatMap((r) => r.expressions),
      (item) => normalizeExpression(item.lemma || item.text)
    );

    const known = mergeUniqueBy(
      allResults.flatMap((r) => r.known),
      (item) => `${normalizeExpression(item.lemma)}|${item.found?.id || ''}`
    );

    const totalStats = allResults.reduce((acc, r) => {
      for (const [key, value] of Object.entries(r.stats)) {
        if (typeof value === 'number') acc[key] = (acc[key] || 0) + value;
      }
      return acc;
    }, {} as Record<string, number>);

    return json({
      ok: true,
      missing,
      expressions,
      known,
      chunks: {
        count:         chunks.length,
        target_words:  CHUNK_TARGET_WORDS,
        max_words:     CHUNK_MAX_WORDS,
        max_sentences: CHUNK_MAX_SENTENCES,
      },
      debug: body.debug ? {
        chunks: allResults.map((r) => r.debug),
        models: GEMINI_MODELS,
      } : undefined,
      stats: {
        ...totalStats,
        total_tokens:     tokenize(text).length,
        known_count:      known.length,
        missing_count:    missing.length,
        expression_count: expressions.length,
        chunk_count:      chunks.length,
      },
    });
  } catch (err: any) {
    return json({ ok: false, message: err?.message || String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
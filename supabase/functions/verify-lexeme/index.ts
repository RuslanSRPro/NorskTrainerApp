// supabase/functions/verify-lexeme/index.ts
// Norsk Trainer — Lexeme Verification Aggregator v1.2
//
// Purpose:
// - Verify one lexeme/candidate against several sources before writing to DB.
// - Can run in dry_run mode.
// - Can repair existing lexemes in small batches.
// - Does NOT delete anything.
// - Updates only quality fields when dry_run=false.
//
// Sources in v1:
// - Ordbokene: strong for lemma/POS/forms for words.
// - Wiktionary: useful secondary source, especially expressions/multiword terms.
// - NAOB: best-effort HTML/search check for words/expressions.
// - Gemini: enrichment/normalization/translation/CEFR/frequency estimate, not authoritative.
// - Språkrådet: reserved for future/manual source handling.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SourceName = 'Ordbokene' | 'Wiktionary' | 'NAOB' | 'Språkrådet' | 'Gemini' | 'Manual';

type VerifyRequest = {
  mode?: 'single' | 'batch' | 'catalog_batch';
  dry_run?: boolean;
  lexeme_id?: string;
  lemma?: string;
  display_form?: string;
  pos?: string;
  translation_ua?: string;
  translation_en?: string;
  expression_subtype?: string;
  limit?: number;
  pos_filter?: string;
  where?: 'needs_quality' | 'missing_source_verified' | 'ai_candidate' | 'unverified' | 'all';
};

type ExistingLexeme = {
  id: string;
  lemma: string;
  display_form: string | null;
  pos: string;
  translation_ua: string | null;
  translation_en: string | null;
  example: string | null;
  notes: string | null;
  cefr: string | null;
  frequency_rank: number | null;
  frequency_level: string | null;
  frequency_source: string | null;
  frequency_note: string | null;
  verification: string | null;
  source_verified: string | null;
  source: string | null;
  enrichment_status: string | null;
};


type ExpressionCatalogRow = {
  id: string;
  lemma: string;
  display_form: string | null;
  normalized_key: string | null;
  pos: string | null;
  expression_subtype: string | null;
  translation_ua: string | null;
  translation_en: string | null;
  example: string | null;
  notes_ua: string | null;
  cefr: string | null;
  frequency_level: string | null;
  frequency_rank: number | null;
  importance_score: number | null;
  source_naob: boolean | null;
  source_wiktionary: boolean | null;
  source_gemini: boolean | null;
  source_ordbokene: boolean | null;
  source_manual: boolean | null;
  source_verified: string | null;
  source_urls: any;
  raw_sources: any;
  verification: string | null;
  confidence: string | null;
  lexeme_id: string | null;
};

type VerificationCandidate = {
  lexeme_id?: string;
  lemma: string;
  display_form: string;
  pos: string;
  translation_ua?: string;
  translation_en?: string;
  expression_subtype?: string;
};

type SourceCheck = {
  source: SourceName;
  found: boolean;
  confidence: 'low' | 'medium' | 'high';
  url?: string;
  lemma?: string;
  pos?: string;
  meaning_en?: string;
  example?: string;
  forms?: Record<string, string>;
  raw?: any;
  error?: string;
};

type GeminiEnrichment = {
  lemma?: string;
  display_form?: string;
  pos?: string;
  translation_ua?: string;
  translation_en?: string;
  example?: string;
  cefr?: string;
  frequency_level?: string;
  frequency_rank?: number | null;
  frequency_note?: string;
  confidence?: 'low' | 'medium' | 'high';
  notes_ua?: string;
};

type AggregatedVerification = {
  input: VerificationCandidate;
  checks: SourceCheck[];
  sources_found: SourceName[];
  source_verified: string;
  verification: string;
  confidence: 'low' | 'medium' | 'high';
  recommended_update: Record<string, any>;
  changed_fields: string[];
  dry_run: boolean;
  updated?: boolean;
  error?: string;
};

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function normalize(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[.,!?;:()«»"''“”‘’\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

function normalizeExpression(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[.,!?;:()«»"''“”‘’\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .trim();
}

function isExpressionPos(pos: string): boolean {
  const p = clean(pos).toLowerCase();
  return p === 'expression' || p.includes('expression') || p.includes('particle_verb') || p.includes('prepositional_verb') || p.includes('reflexive');
}

function sourceLabel(sources: SourceName[]): string {
  const order: SourceName[] = ['Ordbokene', 'Wiktionary', 'NAOB', 'Språkrådet', 'Gemini', 'Manual'];
  return order.filter((s) => sources.includes(s)).join('+');
}

function computeVerification(sources: SourceName[]): string {
  const authoritative = sources.includes('NAOB') || sources.includes('Språkrådet');
  const dictionary = sources.includes('Ordbokene') || sources.includes('Wiktionary');
  const nonAiSources = sources.filter((s) => s !== 'Gemini');

  if (sources.includes('Manual')) return 'verified_manual';
  if (nonAiSources.length >= 2) return 'verified_multi_source';
  if (authoritative) return 'verified_authoritative';
  if (dictionary) return 'verified_dictionary';
  if (sources.includes('Gemini')) return 'ai_candidate';
  return 'needs_review';
}

function computeConfidence(sources: SourceName[]): 'low' | 'medium' | 'high' {
  const nonAiSources = sources.filter((s) => s !== 'Gemini');
  if (nonAiSources.length >= 2) return 'high';
  if (nonAiSources.length === 1) return 'medium';
  if (sources.includes('Gemini')) return 'medium';
  return 'low';
}

function compactError(value: unknown, max = 700): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizePosHint(pos: string): string {
  const p = clean(pos).toLowerCase();
  if (p.includes('verb')) return 'verb';
  if (p.includes('noun')) return 'noun';
  if (p.includes('adj')) return 'adjective';
  if (p.includes('adv')) return 'adverb';
  if (p.includes('expression')) return 'expression';
  return p || 'word';
}

function posFromOrdbokeneTags(tags: string[], fallback: string): string {
  if (tags.includes('VERB')) return 'verb';
  if (tags.includes('NOUN')) return 'noun';
  if (tags.includes('ADJ')) return 'adjective';
  if (tags.includes('ADV')) return 'adverb';
  return normalizePosHint(fallback);
}

function getForm(forms: any[], ...tagSets: string[][]): string {
  for (const tags of tagSets) {
    const found = forms.find((f: any) => tags.every((t) => (f.tags || []).includes(t)));
    if (found?.word_form && found.word_form !== 'null') return String(found.word_form);
  }
  return '';
}

function buildFormsFromOrdbokene(pos: string, forms: any[]): Record<string, string> {
  if (pos === 'verb') {
    const perf = getForm(forms, ['<PerfPart>'], ['PerfPart'], ['PastPart']);
    return {
      presens: getForm(forms, ['Pres'], ['Pres', 'Act']),
      preteritum: getForm(forms, ['Past'], ['Pret'], ['Past', 'Act']),
      perfektum: perf ? `har ${perf}` : '',
    };
  }

  if (pos === 'noun') {
    return {
      best_entall: getForm(forms, ['Sing', 'Def']),
      ubest_flertall: getForm(forms, ['Plur', 'Ind'], ['Plur']),
      best_flertall: getForm(forms, ['Plur', 'Def']),
    };
  }

  if (pos === 'adjective') {
    return {
      intetkjonn: getForm(forms, ['Neuter', 'Ind', 'Sing'], ['Neuter', 'Sing'], ['Neuter']),
      flertall: getForm(forms, ['Plur'], ['Def']),
      komparativ: getForm(forms, ['Cmp'], ['Comp'], ['Comparative']),
      superlativ: getForm(forms, ['Sup', 'Ind'], ['Sup'], ['Superl']),
      best_superlativ: getForm(forms, ['Sup', 'Def'], ['Superl', 'Def']).replace(/^(den|det|de)\s+/i, '').trim(),
    };
  }

  return {};
}

async function checkOrdbokene(candidate: VerificationCandidate): Promise<SourceCheck> {
  if (isExpressionPos(candidate.pos)) {
    return { source: 'Ordbokene', found: false, confidence: 'low', error: 'Skipped expression in v1.' };
  }

  try {
    const query = normalize(candidate.lemma || candidate.display_form);
    if (!query) return { source: 'Ordbokene', found: false, confidence: 'low' };

    const exactUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(query)}&dict=bm&scope=e`;
    let res = await fetch(exactUrl);
    if (!res.ok) return { source: 'Ordbokene', found: false, confidence: 'low', url: exactUrl, error: `HTTP ${res.status}` };

    let data = await res.json();
    let articleIds: any[] = data?.articles?.bm || [];
    let foundByForm = false;

    if (!articleIds.length) {
      const inflectedUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(query)}&dict=bm&scope=i`;
      res = await fetch(inflectedUrl);
      if (!res.ok) return { source: 'Ordbokene', found: false, confidence: 'low', url: inflectedUrl, error: `HTTP ${res.status}` };
      data = await res.json();
      articleIds = data?.articles?.bm || [];
      foundByForm = articleIds.length > 0;
    }

    if (!articleIds.length) return { source: 'Ordbokene', found: false, confidence: 'low', url: exactUrl };

    const posHint = normalizePosHint(candidate.pos);

    for (const id of articleIds.slice(0, 5)) {
      const articleUrl = `https://ord.uib.no/bm/article/${id}.json`;
      const articleRes = await fetch(articleUrl);
      if (!articleRes.ok) continue;
      const article = await articleRes.json();

      for (const lemmaObj of (article?.lemmas || [])) {
        const tags = lemmaObj?.paradigm_info?.[0]?.tags || [];
        const detectedPos = posFromOrdbokeneTags(tags, posHint);
        if (posHint && posHint !== detectedPos) continue;

        const rawLemma = clean(lemmaObj?.lemma || candidate.lemma);
        const displayLemma = detectedPos === 'verb' && !/^å\s+/i.test(rawLemma) ? `å ${rawLemma}` : rawLemma;
        const inflection = lemmaObj?.paradigm_info?.[0]?.inflection || [];

        return {
          source: 'Ordbokene',
          found: true,
          confidence: foundByForm ? 'medium' : 'high',
          url: articleUrl,
          lemma: displayLemma,
          pos: detectedPos,
          forms: buildFormsFromOrdbokene(detectedPos, inflection),
          raw: { article_id: id, found_by_form: foundByForm, inflection_class: lemmaObj?.inflection_class || '', tags },
        };
      }
    }

    return { source: 'Ordbokene', found: false, confidence: 'low', url: exactUrl };
  } catch (e) {
    return { source: 'Ordbokene', found: false, confidence: 'low', error: compactError(e) };
  }
}

async function checkWiktionary(candidate: VerificationCandidate): Promise<SourceCheck> {
  try {
    const titleCandidates = Array.from(new Set([
      candidate.lemma,
      candidate.display_form,
      normalizeExpression(candidate.lemma),
      normalize(candidate.lemma),
    ].map(clean).filter(Boolean)));

    for (const title of titleCandidates.slice(0, 5)) {
      const url = `https://en.wiktionary.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&redirects=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const pages = data?.query?.pages || {};
      const page = Object.values(pages)[0] as any;
      if (!page || page.missing) continue;

      const extract = clean(page.extract || '');
      const hasNorwegian = /Norwegian Bokm[åa]l/i.test(extract) || /Norwegian Nynorsk/i.test(extract) || /\bBokm[åa]l\b/i.test(extract);
      if (!hasNorwegian && !isExpressionPos(candidate.pos)) continue;

      return {
        source: 'Wiktionary',
        found: true,
        confidence: hasNorwegian ? 'medium' : 'low',
        url: `https://en.wiktionary.org/wiki/${encodeURIComponent(title)}`,
        lemma: title,
        meaning_en: extract.slice(0, 500),
        raw: { pageid: page.pageid, title: page.title },
      };
    }

    return { source: 'Wiktionary', found: false, confidence: 'low' };
  } catch (e) {
    return { source: 'Wiktionary', found: false, confidence: 'low', error: compactError(e) };
  }
}

async function checkNaob(candidate: VerificationCandidate): Promise<SourceCheck> {
  try {
    const query = clean(candidate.lemma || candidate.display_form).replace(/^å\s+/i, '');
    if (!query) return { source: 'NAOB', found: false, confidence: 'low' };

    const url = `https://naob.no/s%C3%B8k?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NorskTrainerApp/1.0 verification research' } });
    if (!res.ok) return { source: 'NAOB', found: false, confidence: 'low', url, error: `HTTP ${res.status}` };

    const html = await res.text();
    const haystack = html.toLowerCase();
    const found = haystack.includes(query.toLowerCase()) || haystack.includes(normalizeExpression(query));

    if (!found) return { source: 'NAOB', found: false, confidence: 'low', url };

    return {
      source: 'NAOB',
      found: true,
      confidence: 'medium',
      url,
      lemma: candidate.lemma,
      raw: { note: 'Best-effort NAOB search-page match. Treat as evidence; structured extraction can improve this.' },
    };
  } catch (e) {
    return { source: 'NAOB', found: false, confidence: 'low', error: compactError(e) };
  }
}

async function checkSprakradet(_candidate: VerificationCandidate): Promise<SourceCheck> {
  return { source: 'Språkrådet', found: false, confidence: 'low', error: 'Reserved for future/manual source integration in v1.' };
}

function extractJson(text: string): string {
  const cleanText = clean(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const objStart = cleanText.indexOf('{');
  const objEnd = cleanText.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) return cleanText.slice(objStart, objEnd + 1);
  return cleanText;
}

async function callGemini(prompt: string): Promise<{ data: any; model: string; error: string }> {
  if (!GEMINI_API_KEY) return { data: null, model: '', error: 'GEMINI_API_KEY is missing' };
  let lastError = '';

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        }),
      });

      const raw = await res.text();
      if (!res.ok) { lastError = raw; continue; }
      const parsed = JSON.parse(raw);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) { lastError = raw; continue; }
      return { data: JSON.parse(extractJson(text)), model, error: '' };
    } catch (e) {
      lastError = compactError(e);
      continue;
    }
  }
  return { data: null, model: '', error: compactError(lastError) };
}

async function enrichWithGemini(candidate: VerificationCandidate, checks: SourceCheck[]): Promise<SourceCheck & { enrichment?: GeminiEnrichment }> {
  const evidence = checks.map((c) => ({ source: c.source, found: c.found, lemma: c.lemma || '', pos: c.pos || '', url: c.url || '' }));
  const prompt = `You are a Norwegian Bokmål lexical-data assistant.

Candidate:
${JSON.stringify(candidate, null, 2)}

Verification evidence:
${JSON.stringify(evidence, null, 2)}

Task:
Return one JSON object with normalized language-learning fields.
Gemini is NOT an authoritative source. It may estimate translation, CEFR, and frequency_level.
Do not invent authoritative source claims.

Return ONLY valid JSON:
{
  "lemma": "canonical lemma",
  "display_form": "display form",
  "pos": "noun|verb|adjective|adverb|expression",
  "translation_ua": "Ukrainian translation",
  "translation_en": "English translation",
  "example": "short Norwegian example",
  "cefr": "A1|A2|B1|B2|C1|C2|",
  "frequency_level": "high|medium|low|rare|",
  "frequency_rank": null,
  "frequency_note": "short note",
  "confidence": "low|medium|high",
  "notes_ua": "short note in Ukrainian"
}`;

  const result = await callGemini(prompt);
  if (!result.data) return { source: 'Gemini', found: false, confidence: 'low', error: result.error };

  const item = result.data || {};
  const frequencyLevel = clean(item.frequency_level).toLowerCase();
  const confidenceRaw = clean(item.confidence).toLowerCase();
  const enrichment: GeminiEnrichment = {
    lemma: clean(item.lemma),
    display_form: clean(item.display_form),
    pos: clean(item.pos),
    translation_ua: clean(item.translation_ua),
    translation_en: clean(item.translation_en),
    example: clean(item.example),
    cefr: clean(item.cefr),
    frequency_level: ['high', 'medium', 'low', 'rare'].includes(frequencyLevel) ? frequencyLevel : '',
    frequency_rank: typeof item.frequency_rank === 'number' ? item.frequency_rank : null,
    frequency_note: clean(item.frequency_note),
    confidence: ['low', 'medium', 'high'].includes(confidenceRaw) ? confidenceRaw as any : 'medium',
    notes_ua: clean(item.notes_ua),
  };

  return {
    source: 'Gemini', found: true, confidence: enrichment.confidence || 'medium',
    lemma: enrichment.lemma || candidate.lemma, pos: enrichment.pos || candidate.pos,
    meaning_en: enrichment.translation_en, example: enrichment.example,
    raw: { model: result.model }, enrichment,
  };
}

async function loadLexemeById(id: string): Promise<ExistingLexeme | null> {
  const { data, error } = await supabase
    .from('lexemes')
    .select(`
      id, lemma, display_form, pos,
      translation_ua, translation_en, example, notes, cefr,
      frequency_rank, frequency_level, frequency_source, frequency_note,
      verification, source_verified, source, enrichment_status
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

function candidateFromLexeme(row: ExistingLexeme): VerificationCandidate {
  return {
    lexeme_id: row.id,
    lemma: clean(row.lemma),
    display_form: clean(row.display_form || row.lemma),
    pos: clean(row.pos),
    translation_ua: clean(row.translation_ua || ''),
    translation_en: clean(row.translation_en || ''),
  };
}


const VERB_LIKE_EXPRESSION_SUBTYPES = new Set([
  'prepositional_verb',
  'particle_verb',
  'verb_expression',
  'lexical_reflexive',
  'reflexive_verb',
  'reflexive_particle_verb',
  'reflexive_prepositional_verb',
]);

function startsWithAa(value: string): boolean {
  return /^å\s+/i.test(clean(value));
}

function stripAa(value: string): string {
  return clean(value).replace(/^å\s+/i, '').trim();
}

function shouldUseAaLemma(params: {
  pos: string;
  expressionSubtype?: string;
  inputLemma?: string;
  inputDisplayForm?: string;
  candidateLemma?: string;
  candidateDisplayForm?: string;
}) {
  const pos = normalizePosHint(params.pos);
  const subtype = clean(params.expressionSubtype).toLowerCase();

  if (pos === 'verb') return true;
  if (VERB_LIKE_EXPRESSION_SUBTYPES.has(subtype)) return true;

  // If the user/input/source already gave an infinitive marker for an expression,
  // preserve it. This prevents Gemini from changing "å klage over" -> "klage over".
  if (isExpressionPos(pos)) {
    return [
      params.inputLemma,
      params.inputDisplayForm,
      params.candidateLemma,
      params.candidateDisplayForm,
    ].some((value) => startsWithAa(clean(value || '')));
  }

  return false;
}

function canonicalizeLemmaForStorage(params: {
  lemma: string;
  pos: string;
  expressionSubtype?: string;
  inputLemma?: string;
  inputDisplayForm?: string;
  candidateDisplayForm?: string;
}) {
  const raw = clean(params.lemma || params.candidateDisplayForm || params.inputLemma || params.inputDisplayForm);
  if (!raw) return '';

  if (shouldUseAaLemma({
    pos: params.pos,
    expressionSubtype: params.expressionSubtype,
    inputLemma: params.inputLemma,
    inputDisplayForm: params.inputDisplayForm,
    candidateLemma: params.lemma,
    candidateDisplayForm: params.candidateDisplayForm,
  })) {
    return startsWithAa(raw) ? raw : `å ${stripAa(raw)}`;
  }

  // Non-verb expressions should not accidentally keep an infinitive marker.
  if (isExpressionPos(params.pos)) return stripAa(raw);

  return raw;
}

function canonicalizeDisplayFormForStorage(params: {
  displayForm: string;
  canonicalLemma: string;
  pos: string;
  expressionSubtype?: string;
}) {
  const display = clean(params.displayForm || params.canonicalLemma);
  if (!display) return '';

  if (isExpressionPos(params.pos)) {
    if (shouldUseAaLemma({
      pos: params.pos,
      expressionSubtype: params.expressionSubtype,
      candidateLemma: params.canonicalLemma,
      candidateDisplayForm: display,
    })) {
      return startsWithAa(display) ? display : `å ${stripAa(display)}`;
    }
    return stripAa(display);
  }

  // For simple verbs we keep display_form without å, while lemma keeps å.
  if (normalizePosHint(params.pos) === 'verb') return stripAa(display);

  return display;
}

function buildRecommendedUpdate(candidate: VerificationCandidate, existing: ExistingLexeme | null, checks: SourceCheck[], dryRun: boolean): AggregatedVerification {
  const foundChecks = checks.filter((c) => c.found);
  const sourcesFound = foundChecks.map((c) => c.source);
  const nonGeminiFound = sourcesFound.filter((s) => s !== 'Gemini');
  const gemini = checks.find((c: any) => c.source === 'Gemini' && c.found) as any;
  const geminiEnrichment: GeminiEnrichment = gemini?.enrichment || {};
  const ordbokene = checks.find((c) => c.source === 'Ordbokene' && c.found);

  const source_verified = sourceLabel(nonGeminiFound.length ? nonGeminiFound : sourcesFound);
  const verification = computeVerification(sourcesFound);
  const confidence = computeConfidence(sourcesFound);

  const recommended: Record<string, any> = {
    source_verified: source_verified || null,
    verification,
    enrichment_status: verification,
  };

  const effectivePos = normalizePosHint(geminiEnrichment.pos || candidate.pos);
  const effectiveSubtype = clean(candidate.expression_subtype || (geminiEnrichment as any).expression_subtype || '');

  const rawLemmaForStorage = ordbokene?.lemma || geminiEnrichment.lemma || candidate.lemma || candidate.display_form;
  const canonicalLemma = canonicalizeLemmaForStorage({
    lemma: rawLemmaForStorage,
    pos: effectivePos,
    expressionSubtype: effectiveSubtype,
    inputLemma: candidate.lemma,
    inputDisplayForm: candidate.display_form,
    candidateDisplayForm: geminiEnrichment.display_form,
  });

  if (canonicalLemma) recommended.lemma = canonicalLemma;

  const canonicalDisplayForm = canonicalizeDisplayFormForStorage({
    displayForm: geminiEnrichment.display_form || candidate.display_form || canonicalLemma,
    canonicalLemma,
    pos: effectivePos,
    expressionSubtype: effectiveSubtype,
  });

  if (canonicalDisplayForm) recommended.display_form = canonicalDisplayForm;
  if (effectivePos) recommended.pos = effectivePos;

  if (!existing?.translation_ua && geminiEnrichment.translation_ua) recommended.translation_ua = geminiEnrichment.translation_ua;
  if (!existing?.translation_en && geminiEnrichment.translation_en) recommended.translation_en = geminiEnrichment.translation_en;
  if (!existing?.example && geminiEnrichment.example) recommended.example = geminiEnrichment.example;
  if (!existing?.notes && geminiEnrichment.notes_ua) recommended.notes = geminiEnrichment.notes_ua;
  if (!existing?.cefr && geminiEnrichment.cefr) recommended.cefr = geminiEnrichment.cefr;
  if (!existing?.frequency_level && geminiEnrichment.frequency_level) recommended.frequency_level = geminiEnrichment.frequency_level;
  // Do not write Gemini frequency_rank as a real rank. Keep rank for corpus-based data only.
  if (!existing?.frequency_source && geminiEnrichment.frequency_level) recommended.frequency_source = 'Gemini estimate';
  if (!existing?.frequency_note && geminiEnrichment.frequency_note) recommended.frequency_note = geminiEnrichment.frequency_note;
  if (source_verified) recommended.source = source_verified;

  const changedFields = Object.keys(recommended).filter((key) => {
    if (!existing) return true;
    return JSON.stringify((existing as any)[key] ?? null) !== JSON.stringify(recommended[key] ?? null);
  });

  return {
    input: candidate,
    checks,
    sources_found: sourcesFound,
    source_verified: source_verified || '',
    verification,
    confidence,
    recommended_update: recommended,
    changed_fields: changedFields,
    dry_run: dryRun,
  };
}

async function verifyCandidate(candidate: VerificationCandidate, existing: ExistingLexeme | null, dryRun: boolean): Promise<AggregatedVerification> {
  const checksWithoutGemini = await Promise.all([
    checkOrdbokene(candidate),
    checkWiktionary(candidate),
    checkNaob(candidate),
    checkSprakradet(candidate),
  ]);

  const geminiCheck = await enrichWithGemini(candidate, checksWithoutGemini);
  const checks = [...checksWithoutGemini, geminiCheck];
  const result = buildRecommendedUpdate(candidate, existing, checks, dryRun);

  if (!dryRun && existing?.id) {
    const { error } = await supabase.from('lexemes').update(result.recommended_update).eq('id', existing.id);
    if (error) return { ...result, updated: false, error: error.message };
    return { ...result, updated: true };
  }

  return result;
}

async function loadBatch(req: VerifyRequest): Promise<ExistingLexeme[]> {
  const limit = Math.min(Math.max(Number(req.limit || 20), 1), 100);
  const where = req.where || 'needs_quality';

  let query = supabase
    .from('lexemes')
    .select(`
      id, lemma, display_form, pos,
      translation_ua, translation_en, example, notes, cefr,
      frequency_rank, frequency_level, frequency_source, frequency_note,
      verification, source_verified, source, enrichment_status
    `)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (req.pos_filter) query = query.eq('pos', req.pos_filter);

  if (where === 'missing_source_verified') {
    query = query.or('source_verified.is.null,source_verified.eq.');
  } else if (where === 'ai_candidate') {
    query = query.in('verification', ['ai_candidate', 'needs_review']);
  } else if (where === 'needs_quality') {
    query = query.or([
      'source_verified.is.null', 'source_verified.eq.',
      'verification.is.null', 'verification.eq.',
      'verification.eq.ai_candidate', 'verification.eq.needs_review',
      'cefr.is.null', 'cefr.eq.',
      'frequency_level.is.null', 'frequency_level.eq.',
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}


function candidateFromCatalog(row: ExpressionCatalogRow): VerificationCandidate {
  return {
    lemma: clean(row.lemma),
    display_form: clean(row.display_form || row.lemma),
    pos: 'expression',
    translation_ua: clean(row.translation_ua || ''),
    translation_en: clean(row.translation_en || ''),
    expression_subtype: clean(row.expression_subtype || ''),
  };
}

function existingFromCatalog(row: ExpressionCatalogRow): ExistingLexeme {
  return {
    id: row.id,
    lemma: clean(row.lemma),
    display_form: clean(row.display_form || row.lemma),
    pos: 'expression',
    translation_ua: row.translation_ua || null,
    translation_en: row.translation_en || null,
    example: row.example || null,
    notes: row.notes_ua || null,
    cefr: row.cefr || null,
    frequency_rank: row.frequency_rank ?? null,
    frequency_level: row.frequency_level || null,
    frequency_source: null,
    frequency_note: null,
    verification: row.verification || null,
    source_verified: row.source_verified || null,
    source: row.source_verified || null,
    enrichment_status: row.verification || null,
  };
}

async function loadCatalogBatch(req: VerifyRequest): Promise<ExpressionCatalogRow[]> {
  const limit = Math.min(Math.max(Number(req.limit || 20), 1), 100);
  const where = req.where || 'needs_quality';

  let query = supabase
    .from('expression_catalog')
    .select(`
      id, lemma, display_form, normalized_key, pos, expression_subtype,
      translation_ua, translation_en, example, notes_ua,
      cefr, frequency_level, frequency_rank, importance_score,
      source_naob, source_wiktionary, source_gemini, source_ordbokene, source_manual,
      source_verified, source_urls, raw_sources,
      verification, confidence, lexeme_id
    `)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (where === 'missing_source_verified') {
    query = query.or('source_verified.is.null,source_verified.eq.');
  } else if (where === 'ai_candidate') {
    query = query.in('verification', ['ai_candidate', 'needs_review']);
  } else if (where === 'unverified') {
    query = query.or('verification.is.null,verification.eq.,verification.eq.ai_candidate,verification.eq.needs_review');
  } else if (where === 'needs_quality') {
    query = query.or([
      'source_verified.is.null', 'source_verified.eq.',
      'verification.is.null', 'verification.eq.',
      'verification.eq.ai_candidate', 'verification.eq.needs_review',
      'cefr.is.null', 'cefr.eq.',
      'frequency_level.is.null', 'frequency_level.eq.',
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

function catalogUpdateFromVerification(result: AggregatedVerification): Record<string, any> {
  const update = result.recommended_update || {};
  const sources = new Set(result.sources_found || []);

  const allowed: Record<string, any> = {
    lemma: update.lemma,
    display_form: update.display_form,
    expression_subtype: result.input.expression_subtype || undefined,
    translation_ua: update.translation_ua,
    translation_en: update.translation_en,
    example: update.example,
    notes_ua: update.notes,
    cefr: update.cefr,
    frequency_level: update.frequency_level,
    frequency_rank: update.frequency_rank ?? null,
    source_verified: result.source_verified || null,
    verification: result.verification,
    confidence: result.confidence,
    source_naob: sources.has('NAOB'),
    source_wiktionary: sources.has('Wiktionary'),
    source_gemini: sources.has('Gemini'),
    source_ordbokene: sources.has('Ordbokene'),
    source_manual: sources.has('Manual'),
    source_urls: (result.checks || [])
      .filter((c) => c.found && c.url)
      .map((c) => ({ source: c.source, url: c.url })),
    raw_sources: Object.fromEntries(
      (result.checks || [])
        .filter((c) => c.found)
        .map((c) => [c.source, { confidence: c.confidence, lemma: c.lemma || '', pos: c.pos || '', raw: c.raw || null }])
    ),
    updated_at: new Date().toISOString(),
  };

  Object.keys(allowed).forEach((key) => {
    if (allowed[key] === undefined) delete allowed[key];
  });

  return allowed;
}

async function verifyCatalogRow(row: ExpressionCatalogRow, dryRun: boolean): Promise<AggregatedVerification> {
  const candidate = candidateFromCatalog(row);
  const existing = existingFromCatalog(row);
  const result = await verifyCandidate(candidate, existing, true);

  if (dryRun) return result;

  const update = catalogUpdateFromVerification(result);
  const { error } = await supabase
    .from('expression_catalog')
    .update(update)
    .eq('id', row.id);

  if (error) return { ...result, updated: false, error: error.message };
  return { ...result, recommended_update: update, updated: true, dry_run: false };
}

function summarizeVerificationResults(results: AggregatedVerification[]) {
  const byVerification: Record<string, number> = {};
  const bySourceVerified: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};

  for (const r of results) {
    const v = r.verification || '(blank)';
    const s = r.source_verified || '(blank)';
    const c = r.confidence || '(blank)';
    byVerification[v] = (byVerification[v] || 0) + 1;
    bySourceVerified[s] = (bySourceVerified[s] || 0) + 1;
    byConfidence[c] = (byConfidence[c] || 0) + 1;
  }

  return { byVerification, bySourceVerified, byConfidence };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as VerifyRequest;
    const mode = body.mode || 'single';
    const dryRun = body.dry_run !== false; // default true for safety

    if (mode === 'catalog_batch') {
      const rows = await loadCatalogBatch(body);
      const results: AggregatedVerification[] = [];
      for (const row of rows) results.push(await verifyCatalogRow(row, dryRun));
      return json({
        ok: true,
        mode,
        dry_run: dryRun,
        count: results.length,
        summary: summarizeVerificationResults(results),
        results,
      });
    }

    if (mode === 'batch') {
      const rows = await loadBatch(body);
      const results: AggregatedVerification[] = [];
      for (const row of rows) results.push(await verifyCandidate(candidateFromLexeme(row), row, dryRun));
      return json({
        ok: true,
        mode,
        dry_run: dryRun,
        count: results.length,
        summary: summarizeVerificationResults(results),
        results,
      });
    }

    let existing: ExistingLexeme | null = null;
    let candidate: VerificationCandidate;

    if (body.lexeme_id) {
      existing = await loadLexemeById(body.lexeme_id);
      if (!existing) return json({ ok: false, message: 'lexeme_id not found' }, 404);
      candidate = candidateFromLexeme(existing);
    } else {
      const lemma = clean(body.lemma || body.display_form || '');
      const displayForm = clean(body.display_form || body.lemma || '');
      const pos = clean(body.pos || 'word');
      if (!lemma && !displayForm) return json({ ok: false, message: 'Provide lexeme_id or lemma/display_form' }, 400);
      candidate = {
        lemma: lemma || displayForm,
        display_form: displayForm || lemma,
        pos,
        translation_ua: clean(body.translation_ua || ''),
        translation_en: clean(body.translation_en || ''),
        expression_subtype: clean(body.expression_subtype || ''),
      };
    }

    const result = await verifyCandidate(candidate, existing, dryRun);
    return json({ ok: true, mode, dry_run: dryRun, result });
  } catch (e: any) {
    return json({ ok: false, message: e?.message || String(e) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
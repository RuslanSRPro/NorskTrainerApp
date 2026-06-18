import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// Types / constants
// ============================================================

type AnyObj = Record<string, any>;

// Модели по приоритету: сначала максимально дешёвая, потом более сильные fallback-модели
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const MAX_BATCH_SIZE = 30;

// ============================================================
// Helpers
// ============================================================

function clean(value: any): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function emptyToNull(value: any): string | null {
  const v = clean(value);
  return v ? v : null;
}

function intToNull(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeLemma(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

function posFromCandidateType(type: string): string {
  if (type === 'noun_masculine' || type === 'noun_feminine' || type === 'noun_neuter') return 'noun';
  if (type === 'verb')      return 'verb';
  if (type === 'adjective') return 'adjective';
  if (type === 'adverb')    return 'adverb';
  return 'expression';
}

function missingFieldsFromCandidate(candidate: AnyObj): string[] {
  const missing: string[] = [];
  if (!clean(candidate.translation_ua)) missing.push('translation_ua');
  if (!clean(candidate.translation_en)) missing.push('translation_en');
  if (!clean(candidate.example))        missing.push('example');
  if (!clean(candidate.notes_ua || candidate.notes)) missing.push('notes_ua');
  if (!clean(candidate.cefr))           missing.push('cefr');
  return missing;
}

function existingNeedsRepair(item: AnyObj): boolean {
  if (!item) return false;
  return !clean(item.translation_ua) ||
    !clean(item.translation_en) ||
    !clean(item.example) ||
    !clean(item.notes) ||
    !clean(item.cefr) ||
    clean(item.verification) === 'needs_review' ||
    !clean(item.frequency_level);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

// ============================================================
// Ordbokene API
// ============================================================

async function getArticleIds(word: string): Promise<number[]> {
  const cleanWord = word
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
  if (!cleanWord) return [];
  const url = `https://ord.uib.no/api/articles?w=${encodeURIComponent(cleanWord)}&dict=bm&scope=e`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data?.articles?.bm) ? data.articles.bm : [];
  } catch { return []; }
}

async function getArticleIdsByForm(wordForm: string): Promise<number[]> {
  const url = `https://ord.uib.no/api/articles?w=${encodeURIComponent(wordForm)}&dict=bm&scope=i`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data?.articles?.bm) ? data.articles.bm : [];
  } catch { return []; }
}

async function getArticle(articleId: number): Promise<any> {
  const url = `https://ord.uib.no/bm/article/${articleId}.json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

function tagsToType(tags: string[]): string {
  const t = tags.join('|').toUpperCase();
  if (t.includes('VERB')) return 'verb';
  if (t.includes('ADJ'))  return 'adjective';
  if (t.includes('NOUN')) {
    if (t.includes('FEM'))  return 'noun_feminine';
    if (t.includes('NEUT')) return 'noun_neuter';
    return 'noun_masculine';
  }
  if (t.includes('ADV')) return 'adverb';
  return 'other';
}

function formWord(forms: any[], requiredTags: string[]): string {
  for (const f of forms) {
    const tags = Array.isArray(f.tags) ? f.tags : [];
    if (requiredTags.every((tag) => tags.includes(tag))) {
      return f.word_form || '';
    }
  }
  return '';
}

function formWordAny(forms: any[], tagSets: string[][]): string {
  for (const tags of tagSets) {
    const w = formWord(forms, tags);
    if (w && w !== 'null') return w;
  }
  return '';
}

function parseVerbForms(forms: any[]) {
  const f1 = formWordAny(forms, [['Pres'], ['Pres', 'Act']]);
  const f2 = formWordAny(forms, [
    ['Past'], ['Past', 'Act'], ['Pret'], ['Pret', 'Act'],
  ]);
  const activeForms = forms.filter((f) => {
    const tags = Array.isArray(f.tags) ? f.tags : [];
    return !tags.includes('Pass') &&
      !tags.includes('Passive') &&
      !tags.includes('Adj');
  });
  const pp = formWordAny(activeForms, [
    ['<PerfPart>'], ['PastPart'], ['PerfPart'], ['Perf', 'Part'],
  ]);
  return { f1, f2, f3: pp ? 'har ' + pp : '' };
}

function parseNounForms(forms: any[]) {
  return {
    f1: formWordAny(forms, [
      ['Sing', 'Def'], ['Sing', 'Def', 'Masc'],
      ['Sing', 'Def', 'Fem'], ['Sing', 'Def', 'Neut'],
    ]),
    f2: formWordAny(forms, [['Plur', 'Ind'], ['Plur']]),
    f3: formWordAny(forms, [['Plur', 'Def']]),
  };
}

function parseAdjectiveForms(forms: any[]) {
  const f5raw = formWordAny(forms, [
    ['Sup', 'Def'], ['Superl', 'Def'], ['Superlative', 'Def'],
  ]);
  return {
    f1: formWordAny(forms, [
      ['Neuter', 'Ind', 'Sing'], ['Neuter', 'Sing'],
      ['Neuter', 'Ind'], ['Neuter'],
    ]),
    f2: formWordAny(forms, [['Plur'], ['Def', 'Sing'], ['Def']]),
    f3: formWordAny(forms, [['Cmp'], ['Comp'], ['Comparative']]),
    f4: formWordAny(forms, [
      ['Sup', 'Ind'], ['Sup'], ['Superl', 'Ind'], ['Superl'],
    ]),
    f5: f5raw.replace(/^(den|det|de)\s+/i, '').trim(),
  };
}

function lemmaToFormat(lemma: any): any {
  if (!lemma) return null;

  const lemmaWord       = lemma.lemma || '';
  const inflectionClass = lemma.inflection_class || '';
  const paradigms       = lemma.paradigm_info || [];
  const posTags         = paradigms[0]?.tags || [];
  const type            = tagsToType(posTags);

  const forms: any[] = [];
  if (paradigms.length > 0) {
    for (const inf of paradigms[0].inflection || []) {
      if (inf.word_form && inf.word_form !== 'null') {
        forms.push({ tags: inf.tags || [], word_form: inf.word_form });
      }
    }
  }

  const result: any = {
    word:             lemmaWord,
    type,
    inflection_class: inflectionClass,
    source:           'Ordbokene',
    pos_tags_raw:     posTags.join('|'),
    raw_forms_count:  forms.length,
  };

  if (type === 'verb') {
    result.word = 'å ' + lemmaWord;
    const vf = parseVerbForms(forms);
    result.f1 = vf.f1;
    result.f2 = vf.f2;
    result.f3 = vf.f3;

  } else if (type === 'adjective') {
    const af = parseAdjectiveForms(forms);
    result.f1 = af.f1;
    result.f2 = af.f2;
    result.f3 = af.f3;
    result.f4 = af.f4;
    result.f5 = af.f5;
    if (!af.f3) {
      result.f3 = 'mer '  + lemmaWord;
      result.f4 = 'mest ' + lemmaWord;
      result.f5 = '';
      result.comparison_mode   = 'analytic';
      result.comparison_status = 'generated_analytic';
    } else {
      result.comparison_mode   = 'synthetic';
      result.comparison_status = 'verified_synthetic';
    }

  } else if (type.startsWith('noun')) {
    const nf = parseNounForms(forms);
    result.f1 = nf.f1;
    result.f2 = nf.f2;
    result.f3 = nf.f3;
    const article = type === 'noun_neuter'   ? 'et'
                  : type === 'noun_feminine' ? 'ei'
                  : 'en';
    result.word = article + ' ' + lemmaWord;
  }

  return result;
}

async function fetchOrdbokeneParadigm(word: string): Promise<any> {
  const wordClean = word.trim();
  if (!wordClean) return { found: false, candidates: [] };

  let ids = await getArticleIds(wordClean);

  if (!ids.length) {
    const bare = wordClean
      .replace(/^å\s+/i, '')
      .replace(/^(en|ei|et)\s+/i, '')
      .trim();
    ids = await getArticleIdsByForm(bare);
  }

  if (!ids.length) return { found: false, candidates: [] };

  const candidates: any[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const article = await getArticle(id);
    if (!article) continue;
    for (const lemma of article.lemmas || []) {
      const fmt = lemmaToFormat(lemma);
      if (!fmt?.word) continue;
      const key = `${fmt.word}|${fmt.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(fmt);
    }
  }

  return { found: candidates.length > 0, candidates };
}

// ============================================================
// Gemini — fallback по моделям
// ============================================================

async function callGeminiWithFallback(
  prompt: string,
  geminiKey: string,
): Promise<{ raw: string; model: string; ok: boolean; error?: string }> {
  for (const model of GEMINI_MODELS) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const raw = await resp.text();

      if (resp.ok) {
        console.log(`Gemini model used: ${model}`);
        return { raw, model, ok: true };
      }

      // 429 quota / 404 not found — пробуем следующую
      console.warn(`Gemini ${model} failed ${resp.status} — trying next`);

    } catch (e) {
      console.warn(`Gemini ${model} exception: ${e} — trying next`);
    }
  }

  return {
    raw:   '',
    model: '',
    ok:    false,
    error: 'All Gemini models exhausted',
  };
}

// ============================================================
// Gemini batch enrichment
// ============================================================

function buildGeminiBatchPrompt(candidates: AnyObj[]): string {
  const payload = candidates.map((c, i) => ({
    index:            i,
    word:             c.word,
    type:             c.type             || '',
    inflection_class: c.inflection_class || '',
  }));

  return [
    'You are a Ukrainian/English translation assistant for Norwegian language learning.',
    'Return ONLY valid JSON. No markdown. No explanation.',
    'Do NOT generate grammar forms. Grammar forms are already handled by dictionary data.',
    'For each Norwegian item, provide concise learner-friendly data.',
    'Return a JSON object with exactly one field: items.',
    'items must be an array of objects with these fields:',
    'index, translation_ua, translation_en, example, notes_ua, cefr, frequency_level, frequency_rank, frequency_source, frequency_note.',
    'translation_ua: Ukrainian, comma-separated synonyms, max 3.',
    'translation_en: English, comma-separated synonyms, max 3.',
    'example: one natural Norwegian sentence.',
    'notes_ua: 1-2 Ukrainian sentences about usage.',
    'cefr: one of A1, A2, B1, B2, C1.',
    'frequency_level: one of high, medium, low, rare. Estimate practical everyday frequency for Norwegian learners.',
    'frequency_rank: integer only if confidently known from a real frequency source, otherwise null.',
    'frequency_source: short source label, usually "Gemini estimate" unless using known corpus data.',
    'frequency_note: short Ukrainian note about how common/useful the word is.',
    'Input items:',
    JSON.stringify(payload),
  ].join(' ');
}

function extractJsonFromText(text: string): string {
  let cleanText = String(text || '').trim();

  cleanText = cleanText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const objectStart = cleanText.indexOf('{');
  const objectEnd   = cleanText.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return cleanText.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = cleanText.indexOf('[');
  const arrayEnd   = cleanText.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return cleanText.slice(arrayStart, arrayEnd + 1);
  }

  return cleanText;
}

function extractGeminiContentJson(raw: string): AnyObj {
  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(extractJsonFromText(text));
}

async function enrichBatchWithGemini(
  candidates: AnyObj[],
  geminiKey: string,
): Promise<{
  candidates: AnyObj[];
  status: string;
  error: string | null;
  model: string | null;
}> {
  if (!candidates.length) {
    return { candidates, status: 'no_candidates', error: null, model: null };
  }

  const prompt       = buildGeminiBatchPrompt(candidates);
  const geminiResult = await callGeminiWithFallback(prompt, geminiKey);

  if (!geminiResult.ok) {
    console.error('All Gemini models failed:', geminiResult.error);
    return {
      candidates: candidates.map((c) => ({
        ...c,
        enrichment_status: 'gemini_http_error',
        enrichment_error:  geminiResult.error || 'All models exhausted',
        gemini_model_used: null,
      })),
      status: 'gemini_http_error',
      error:  geminiResult.error || 'All models exhausted',
      model:  null,
    };
  }

  const raw   = geminiResult.raw;
  const model = geminiResult.model;

  let parsed: AnyObj;
  try {
    parsed = extractGeminiContentJson(raw);
  } catch (e) {
    console.error('Gemini parse error:', raw);
    return {
      candidates: candidates.map((c) => ({
        ...c,
        enrichment_status: 'gemini_parse_error',
        enrichment_error:  raw,
        gemini_model_used: model,
      })),
      status: 'gemini_parse_error',
      error:  raw,
      model,
    };
  }

  const items    = Array.isArray(parsed.items) ? parsed.items : [];
  const enriched = candidates.map((candidate, index) => {
    const item = items.find((x: AnyObj) => Number(x.index) === index)
      || items[index]
      || {};

    const out: AnyObj = {
      ...candidate,
      translation_ua:    item.translation_ua || '',
      translation_en:    item.translation_en || '',
      example:           item.example        || '',
      notes_ua:          item.notes_ua       || '',
      cefr:              item.cefr           || '',
      frequency_level:   item.frequency_level  || '',
      frequency_rank:    item.frequency_rank   ?? null,
      frequency_source:  item.frequency_source || 'Gemini estimate',
      frequency_note:    item.frequency_note   || '',
      enrichment_status: 'gemini_ok' as string,
      enrichment_error:  null as string | null,
      gemini_model_used: model,
    };

    const missing = missingFieldsFromCandidate(out);
    if (missing.length > 0) {
      out.enrichment_status = 'gemini_incomplete';
      out.enrichment_error  = 'Missing fields: ' + missing.join(', ');
    }

    return out;
  });

  return { candidates: enriched, status: 'gemini_ok', error: null, model };
}

// ============================================================
// Supabase read / save / update
// ============================================================

function lexemeSelectQuery() {
  return `
    id, lemma, pos, display_form,
    translation_ua, translation_en, example, notes, cefr, status,
    frequency_rank, frequency_level, frequency_source, frequency_note,
    verification, source, enrichment_status, enrichment_error,
    verb_forms (
      infinitiv, presens, preteritum, perfektum, gruppe,
      expression_subtype, base_verb, particle, requires_seg
    ),
    noun_forms (
      official_gender, accepted_articles, preferred_article,
      ubest_entall, best_entall, ubest_flertall, best_flertall
    ),
    adjective_forms (
      positiv, intetkjonn, flertall,
      komparativ, superlativ, best_superlativ
    )
  `;
}

async function findExistingLexeme(
  supabase: any,
  word: string,
): Promise<AnyObj | null> {
  const lemmaSearch = normalizeLemma(word);
  const { data, error } = await supabase
    .from('lexemes')
    .select(lexemeSelectQuery())
    .ilike('lemma', lemmaSearch)
    .limit(1)
    .maybeSingle();
  if (error) { console.error('findExistingLexeme error:', error.message); return null; }
  return data || null;
}

function buildLexemePayload(candidate: AnyObj) {
  const lemma        = normalizeLemma(candidate.word);
  const pos          = posFromCandidateType(candidate.type || '');
  const missing      = missingFieldsFromCandidate(candidate);
  const enrichmentOk = clean(candidate.enrichment_status) === 'gemini_ok'
    && missing.length === 0;

  return {
    lemma,
    pos,
    display_form:      candidate.word,
    translation_ua:    emptyToNull(candidate.translation_ua),
    translation_en:    emptyToNull(candidate.translation_en),
    example:           emptyToNull(candidate.example),
    notes:             emptyToNull(candidate.notes_ua || candidate.notes),
    source:            enrichmentOk ? 'Ordbokene + Gemini' : 'Ordbokene',
    verification:      enrichmentOk ? 'verified_dictionary' : 'needs_review',
    status:            'New',
    cefr:              emptyToNull(candidate.cefr),
    frequency_rank:    intToNull(candidate.frequency_rank),
    frequency_level:   emptyToNull(candidate.frequency_level),
    frequency_source:  emptyToNull(candidate.frequency_source || 'Gemini estimate'),
    frequency_note:    emptyToNull(candidate.frequency_note),
    migrated_from:     'user_added',
    enrichment_status: emptyToNull(candidate.enrichment_status),
    enrichment_error:  emptyToNull(candidate.enrichment_error),
  };
}

async function saveOrUpdateForms(
  supabase: any,
  lexemeId: string,
  candidate: AnyObj,
) {
  const pos = posFromCandidateType(candidate.type || '');

  if (pos === 'verb') {
    const { error } = await supabase.from('verb_forms').upsert({
      lexeme_id:          lexemeId,
      infinitiv:          candidate.word,
      presens:            emptyToNull(candidate.f1),
      preteritum:         emptyToNull(candidate.f2),
      perfektum:          emptyToNull(candidate.f3),
      gruppe:             emptyToNull(candidate.inflection_class),
      expression_subtype: emptyToNull(candidate.expression_subtype),
      base_verb:          emptyToNull(candidate.base_verb),
      particle:           emptyToNull(candidate.particle),
      requires_seg: Boolean(
        candidate.requires_seg ||
        String(candidate.word).includes(' seg')
      ),
    }, { onConflict: 'lexeme_id' });
    if (error) console.error('verb_forms upsert error:', error.message);
  }

  if (pos === 'noun') {
    const gender  = candidate.type === 'noun_feminine' ? 'feminine'
                  : candidate.type === 'noun_neuter'   ? 'neuter'
                  : 'masculine';
    const article = gender === 'neuter'   ? 'et'
                  : gender === 'feminine' ? 'ei'
                  : 'en';
    const { error } = await supabase.from('noun_forms').upsert({
      lexeme_id:         lexemeId,
      official_gender:   gender,
      accepted_articles: article,
      preferred_article: article,
      ubest_entall:      candidate.word,
      best_entall:       emptyToNull(candidate.f1),
      ubest_flertall:    emptyToNull(candidate.f2),
      best_flertall:     emptyToNull(candidate.f3),
      inflection_class:  emptyToNull(candidate.inflection_class),
    }, { onConflict: 'lexeme_id' });
    if (error) console.error('noun_forms upsert error:', error.message);
  }

  if (pos === 'adjective') {
    const { error } = await supabase.from('adjective_forms').upsert({
      lexeme_id:         lexemeId,
      positiv:           candidate.word,
      intetkjonn:        emptyToNull(candidate.f1),
      flertall:          emptyToNull(candidate.f2),
      komparativ:        emptyToNull(candidate.f3),
      superlativ:        emptyToNull(candidate.f4),
      best_superlativ:   emptyToNull(candidate.f5),
      comparison_mode:   emptyToNull(candidate.comparison_mode),
      comparison_status: emptyToNull(candidate.comparison_status),
    }, { onConflict: 'lexeme_id' });
    if (error) console.error('adjective_forms upsert error:', error.message);
  }
}

async function saveCandidateToSupabase(
  supabase: any,
  candidate: AnyObj,
): Promise<string> {
  const payload = buildLexemePayload(candidate);
  const { data: lex, error: lexError } = await supabase
    .from('lexemes')
    .upsert(payload, { onConflict: 'lemma,pos' })
    .select('id')
    .single();
  if (lexError) throw new Error('Lexeme error: ' + lexError.message);
  await saveOrUpdateForms(supabase, lex.id, candidate);
  return lex.id;
}

async function repairExistingLexeme(
  supabase: any,
  existing: AnyObj,
  candidate: AnyObj,
): Promise<string> {
  const missing      = missingFieldsFromCandidate(candidate);
  const enrichmentOk = clean(candidate.enrichment_status) === 'gemini_ok'
    && missing.length === 0;

  const payload = {
    display_form:      candidate.word || existing.display_form,
    translation_ua:    emptyToNull(candidate.translation_ua) ?? existing.translation_ua,
    translation_en:    emptyToNull(candidate.translation_en) ?? existing.translation_en,
    example:           emptyToNull(candidate.example)        ?? existing.example,
    notes:             emptyToNull(candidate.notes_ua || candidate.notes) ?? existing.notes,
    cefr:              emptyToNull(candidate.cefr)           ?? existing.cefr,
    frequency_rank:    intToNull(candidate.frequency_rank)       ?? existing.frequency_rank,
    frequency_level:   emptyToNull(candidate.frequency_level)    ?? existing.frequency_level,
    frequency_source:  emptyToNull(candidate.frequency_source || 'Gemini estimate') ?? existing.frequency_source,
    frequency_note:    emptyToNull(candidate.frequency_note)     ?? existing.frequency_note,
    source:            enrichmentOk
      ? 'Ordbokene + Gemini'
      : (existing.source || 'Ordbokene'),
    verification:      enrichmentOk ? 'verified_dictionary' : 'needs_review',
    enrichment_status: emptyToNull(candidate.enrichment_status),
    enrichment_error:  emptyToNull(candidate.enrichment_error),
    updated_at:        new Date().toISOString(),
  };

  const { error } = await supabase
    .from('lexemes')
    .update(payload)
    .eq('id', existing.id);
  if (error) throw new Error('Repair lexeme error: ' + error.message);

  await saveOrUpdateForms(supabase, existing.id, candidate);
  return existing.id;
}

async function readLexemeById(
  supabase: any,
  id: string,
): Promise<AnyObj | null> {
  const { data, error } = await supabase
    .from('lexemes')
    .select(lexemeSelectQuery())
    .eq('id', id)
    .single();
  if (error) { console.error('readLexemeById error:', error.message); return null; }
  return data || null;
}

// ============================================================
// Learning progress
// ============================================================

async function addToLearningProgress(
  supabase: any,
  userId: string,
  lexemeId: string,
) {
  const now = new Date().toISOString();
  await supabase.from('learning_progress').upsert({
    user_id:        userId,
    lexeme_id:      lexemeId,
    status:         'New',
    ease_factor:    2.5,
    interval_days:  0,
    repetitions:    0,
    lapses:         0,
    stability:      1,
    difficulty_val: 5,
    retention:      0.9,
    queue_score:    20,
    memory_status:  'active',
    memory_score:   0,
    priority_score: 35,
    weak_score:     0,
    next_due_at:    now,
    updated_at:     now,
  }, { onConflict: 'user_id,lexeme_id' });
}

// ============================================================
// Format lexeme for client
// ============================================================

function formatLexeme(item: any) {
  if (!item) return null;

  const vf = item.verb_forms?.[0]      || {};
  const nf = item.noun_forms?.[0]      || {};
  const af = item.adjective_forms?.[0] || {};

  return {
    id:                item.id,
    word:              item.display_form  || item.lemma,
    lemma:             item.lemma,
    pos:               item.pos,
    category:          item.pos,
    type:              item.pos,
    ua:                item.translation_ua || '',
    en:                item.translation_en || '',
    example:           item.example        || '',
    notes:             item.notes          || '',
    cefr:              item.cefr           || '',
    frequency_rank:    item.frequency_rank   ?? null,
    frequency_level:   item.frequency_level  || '',
    frequency_source:  item.frequency_source || '',
    frequency_note:    item.frequency_note   || '',
    status:            item.status         || 'New',
    verification:      item.verification   || '',
    source:            item.source         || '',
    enrichment_status: item.enrichment_status || '',
    enrichment_error:  item.enrichment_error  || '',
    f1: vf.presens        || af.intetkjonn    || nf.best_entall    || '',
    f2: vf.preteritum     || af.flertall      || nf.ubest_flertall || '',
    f3: vf.perfektum      || af.komparativ    || nf.best_flertall  || '',
    f4: af.superlativ     || '',
    f5: af.best_superlativ || '',
  };
}

// ============================================================
// Single/batch processing
// ============================================================

async function buildCandidateForWord(word: string): Promise<{
  word: string;
  found: boolean;
  candidate: AnyObj | null;
  message?: string;
}> {
  const paradigm = await fetchOrdbokeneParadigm(word);
  if (!paradigm.found || !paradigm.candidates.length) {
    return { word, found: false, candidate: null, message: 'Not found in Ordbokene' };
  }
  return { word, found: true, candidate: paradigm.candidates[0] };
}

function ordbokeneDebug(candidate: AnyObj | null) {
  if (!candidate) return null;
  return {
    candidate_word:   candidate.word,
    candidate_type:   candidate.type,
    inflection_class: candidate.inflection_class || '',
    pos_tags_raw:     candidate.pos_tags_raw     || '',
    raw_forms_count:  candidate.raw_forms_count  || 0,
  };
}

async function processWordsBatch(
  supabase: any,
  geminiKey: string,
  wordsInput: string[],
  options: {
    addToLearning:  boolean;
    userId:         string;
    repairExisting: boolean;
  },
) {
  const words = Array.from(
    new Set(wordsInput.map(clean).filter(Boolean))
  ).slice(0, MAX_BATCH_SIZE);

  const existingMap    = new Map<string, AnyObj>();
  const needsOrdbokene: string[] = [];
  const repairItems:   { word: string; existing: AnyObj }[] = [];

  for (const word of words) {
    const existing = await findExistingLexeme(supabase, word);
    if (!existing) {
      needsOrdbokene.push(word);
      continue;
    }
    existingMap.set(word, existing);
    if (options.repairExisting && existingNeedsRepair(existing)) {
      repairItems.push({ word, existing });
    }
  }

  const candidateInputs: {
    word:      string;
    existing?: AnyObj;
    candidate: AnyObj | null;
    found:     boolean;
    message?:  string;
  }[] = [];

  for (const word of needsOrdbokene) {
    const built = await buildCandidateForWord(word);
    candidateInputs.push({ ...built });
  }

  for (const item of repairItems) {
    const built = await buildCandidateForWord(item.word);
    candidateInputs.push({ ...built, existing: item.existing });
  }

  const candidatesToEnrich = candidateInputs
    .filter((x) => x.found && x.candidate)
    .map((x) => x.candidate as AnyObj);

  const enrichedResult     = await enrichBatchWithGemini(candidatesToEnrich, geminiKey);
  const enrichedCandidates = enrichedResult.candidates;

  let enrichIndex = 0;
  const results: AnyObj[] = [];

  for (const word of words) {
    const existing    = existingMap.get(word);
    const repairInput = candidateInputs.find((x) => x.word === word && x.existing);
    const newInput    = candidateInputs.find((x) => x.word === word && !x.existing);

    // Слово уже есть и не требует ремонта
    if (existing && !repairInput) {
      if (options.addToLearning) {
        await addToLearningProgress(supabase, options.userId, existing.id);
      }
      results.push({
        ok:               true,
        word,
        found:            true,
        isNew:            false,
        repairedExisting: false,
        needsReview:      existingNeedsRepair(existing),
        lexeme:           formatLexeme(existing),
      });
      continue;
    }

    const input = repairInput || newInput;

    // Не найдено в Ordbokene
    if (!input || !input.found || !input.candidate) {
      results.push({
        ok:               true,
        word,
        found:            false,
        isNew:            false,
        repairedExisting: false,
        message:          input?.message || 'Not found in Ordbokene',
      });
      continue;
    }

    const candidate    = enrichedCandidates[enrichIndex++];
    const missing      = missingFieldsFromCandidate(candidate);
    let lexemeId: string;
    let repairedExisting = false;
    let isNew            = true;

    if (input.existing) {
      lexemeId         = await repairExistingLexeme(supabase, input.existing, candidate);
      repairedExisting = true;
      isNew            = false;
    } else {
      lexemeId = await saveCandidateToSupabase(supabase, candidate);
    }

    if (options.addToLearning) {
      await addToLearningProgress(supabase, options.userId, lexemeId);
    }

    const saved = await readLexemeById(supabase, lexemeId);

    results.push({
      ok:               true,
      word,
      found:            true,
      isNew,
      repairedExisting,
      enrichment_status:  candidate.enrichment_status  || enrichedResult.status,
      enrichment_error:   candidate.enrichment_error   || enrichedResult.error,
      gemini_model_used:  candidate.gemini_model_used  || enrichedResult.model,
      needsReview:        missing.length > 0,
      missing,
      ordbokene_debug:    ordbokeneDebug(candidate),
      lexeme:             formatLexeme(saved),
    });
  }

  return {
    ok:                      true,
    mode:                    words.length > 1 ? 'batch' : 'single',
    count:                   words.length,
    batch_enrichment_status: enrichedResult.status,
    batch_enrichment_error:  enrichedResult.error,
    gemini_model_used:       enrichedResult.model,
    results,
  };
}

// ============================================================
// Main handler
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiKey      = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl    = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({
        ok:      false,
        message: 'Missing env vars: GEMINI_API_KEY, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    const body  = await req.json();
    const word  = clean(body.word  || '');
    const words = Array.isArray(body.words)
      ? body.words.map((x: any) => clean(x)).filter(Boolean)
      : word
        ? [word]
        : [];

    const userId         = clean(body.userId         || 'default');
    const addToLearning  = body.addToLearning  === true;
    const repairExisting = body.repairExisting !== false;

    if (!words.length) {
      return jsonResponse({ ok: false, message: 'Missing word or words[]' });
    }

    if (words.length > MAX_BATCH_SIZE) {
      return jsonResponse(
        { ok: false, message: `Too many words. Max batch size is ${MAX_BATCH_SIZE}.` },
        400,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const batchResult = await processWordsBatch(supabase, geminiKey, words, {
      addToLearning,
      userId,
      repairExisting,
    });

    // Одно слово — плоский ответ
    if (words.length === 1) {
      const first = batchResult.results[0];
      return jsonResponse({
        ...first,
        batch_enrichment_status: batchResult.batch_enrichment_status,
        batch_enrichment_error:  batchResult.batch_enrichment_error,
        gemini_model_used:       batchResult.gemini_model_used,
      });
    }

    return jsonResponse(batchResult);

  } catch (error: any) {
    console.error('enrich-word error:', error);
    return jsonResponse({
      ok:      false,
      message: String(error?.message || error),
    });
  }
});
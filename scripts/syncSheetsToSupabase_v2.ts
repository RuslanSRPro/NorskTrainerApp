import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config({ path: '.env.local' });

const SHEETS_XLSX_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSONc2_1ez34Ha8tWXBmLXw96hvOHdRa4Q8ncQ8_J_hYZwgu8QHX7TuoZAeljPow3TEKhNmm6GM1S-M/pub?output=xlsx';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const secretKey   = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !secretKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const supabase = createClient(supabaseUrl, secretKey);

type SheetRow = Record<string, any>;

function clean(value: any): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function emptyToNull(value: any): string | null {
  const v = clean(value);
  return v ? v : null;
}

function normCefr(val: any): string | null {
  const v = clean(val).toUpperCase();
  return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(v) ? v : null;
}

function normStatus(val: any): string {
  const v = clean(val);
  const valid = ['New', 'Learning', 'Review', 'Known', 'Suspended'];
  return valid.includes(v) ? v : 'New';
}

function normVerification(source: string): string {
  const s = clean(source);

  if (s.includes('Ordbokene') || s.includes('NAOB') || s.includes('Spr')) {
    return 'verified_dictionary';
  }

  if (s === 'Manual') return 'verified_manual';

  return 'ai_candidate';
}

function normalizeLemma(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

async function getLexemeId(lemma: string, pos?: string): Promise<string | null> {
  let query = supabase
    .from('lexemes')
    .select('id')
    .eq('lemma', lemma);

  if (pos) query = query.eq('pos', pos);

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error('getLexemeId error:', lemma, pos || '', error.message);
    return null;
  }

  return data?.id ?? null;
}

// ============================================================
// DOWNLOAD
// ============================================================

async function downloadWorkbook() {
  console.log('Downloading Google Sheets XLSX...');
  const response = await fetch(SHEETS_XLSX_URL);

  if (!response.ok) {
    throw new Error(`Failed to download workbook: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

// ============================================================
// EXPORT VERBS
// ============================================================

async function exportVerbs(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Verb'];
  if (!sheet) {
    console.log('Verb sheet not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Verb: ${rows.length} rows`);

  let count = 0;

  for (const row of rows) {
    const word = clean(row['infinitiv'] || row['Infinitiv'] || row['word'] || '');
    if (!word) continue;

    const lemma = normalizeLemma(word);

    const { error: le } = await supabase.from('lexemes').upsert({
      lemma,
      pos:            'verb',
      display_form:   word,
      translation_ua: emptyToNull(row['translation_ua']),
      translation_en: emptyToNull(row['translation_en']),
      example:        emptyToNull(row['example']),
      notes:          emptyToNull(row['notes']),
      source:         emptyToNull(row['source']),
      verification:   normVerification(clean(row['source'])),
      status:         normStatus(row['status']),
      cefr:           normCefr(row['cefr']),
      migrated_from:  'Verb'
    }, { onConflict: 'lemma,pos' });

    if (le) {
      console.error('Verb lexeme error:', word, le.message);
      continue;
    }

    const lexemeId = await getLexemeId(lemma, 'verb');
    if (!lexemeId) continue;

    const { error: vf } = await supabase.from('verb_forms').upsert({
      lexeme_id:   lexemeId,
      infinitiv:   word,
      presens:     emptyToNull(row['presens']),
      preteritum:  emptyToNull(row['preteritum']),
      perfektum:   emptyToNull(row['perfektum']),
      gruppe:      emptyToNull(row['gruppe']),
    }, { onConflict: 'lexeme_id' });

    if (vf) {
      console.error('Verb forms error:', word, vf.message);
      continue;
    }

    count++;
  }

  console.log(`Verb done: ${count}`);
}

// ============================================================
// EXPORT NOUNS (Substantiv)
// ============================================================

async function exportNouns(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Substantiv'];
  if (!sheet) {
    console.log('Substantiv sheet not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Substantiv: ${rows.length} rows`);

  let count = 0;

  for (const row of rows) {
    const lemma = clean(row['lemma'] || '');
    if (!lemma) continue;

    const displayForm = clean(row['ubest_entall']) || lemma;

    const { error: le } = await supabase.from('lexemes').upsert({
      lemma,
      pos:            'noun',
      display_form:   displayForm,
      translation_ua: emptyToNull(row['translation_ua']),
      translation_en: emptyToNull(row['translation_en']),
      example:        emptyToNull(row['example']),
      notes:          emptyToNull(row['notes']),
      source:         emptyToNull(row['source']),
      verification:   normVerification(clean(row['source'])),
      status:         normStatus(row['status']),
      cefr:           normCefr(row['cefr']),
      migrated_from:  clean(row['migrated_from']) || 'Substantiv'
    }, { onConflict: 'lemma,pos' });

    if (le) {
      console.error('Noun lexeme error:', lemma, le.message);
      continue;
    }

    const lexemeId = await getLexemeId(lemma, 'noun');
    if (!lexemeId) continue;

    const { error: nf } = await supabase.from('noun_forms').upsert({
      lexeme_id:         lexemeId,
      official_gender:   emptyToNull(row['official_gender']),
      accepted_articles: emptyToNull(row['accepted_articles']),
      preferred_article: emptyToNull(row['preferred_article']),
      ubest_entall:      emptyToNull(row['ubest_entall']),
      best_entall:       emptyToNull(row['best_entall']),
      ubest_flertall:    emptyToNull(row['ubest_flertall']),
      best_flertall:     emptyToNull(row['best_flertall']),
      inflection_class:  emptyToNull(row['inflection_class']),
      gender_stability:  emptyToNull(row['gender_stability']),
      spoken_variants:   emptyToNull(row['spoken_variants']),
      regional_usage:    emptyToNull(row['regional_usage']),
    }, { onConflict: 'lexeme_id' });

    if (nf) {
      console.error('Noun forms error:', lemma, nf.message);
      continue;
    }

    count++;
  }

  console.log(`Nouns done: ${count}`);
}

// ============================================================
// EXPORT ADJECTIVES
// ============================================================

async function exportAdjectives(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Adjektiv'];
  if (!sheet) {
    console.log('Adjektiv sheet not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Adjektiv: ${rows.length} rows`);

  let count = 0;

  for (const row of rows) {
    const word = clean(row['positiv'] || row['word'] || '');
    if (!word) continue;

    const { error: le } = await supabase.from('lexemes').upsert({
      lemma:          word,
      pos:            'adjective',
      display_form:   word,
      translation_ua: emptyToNull(row['translation_ua']),
      translation_en: emptyToNull(row['translation_en']),
      example:        emptyToNull(row['example']),
      notes:          emptyToNull(row['notes']),
      source:         emptyToNull(row['source']),
      verification:   normVerification(clean(row['source'])),
      status:         normStatus(row['status']),
      cefr:           normCefr(row['cefr']),
      migrated_from:  'Adjektiv'
    }, { onConflict: 'lemma,pos' });

    if (le) {
      console.error('Adj lexeme error:', word, le.message);
      continue;
    }

    const lexemeId = await getLexemeId(word, 'adjective');
    if (!lexemeId) continue;

    const { error: af } = await supabase.from('adjective_forms').upsert({
      lexeme_id:            lexemeId,
      positiv:              word,
      intetkjonn:           emptyToNull(row['intetkjønn'] || row['intetkjonn']),
      flertall:             emptyToNull(row['flertall']),
      komparativ:           emptyToNull(row['komparativ']),
      superlativ:           emptyToNull(row['superlativ']),
      best_superlativ:      emptyToNull(row['best_superlativ']),
      comparison_mode:      emptyToNull(row['comparison_mode']),
      comparison_status:    emptyToNull(row['comparison_status']),
      preferred_comparison: emptyToNull(row['preferred_comparison']),
      lexical_subtype:      emptyToNull(row['lexical_subtype']),
      normativity_level:    emptyToNull(row['normativity_level']),
    }, { onConflict: 'lexeme_id' });

    if (af) {
      console.error('Adj forms error:', word, af.message);
      continue;
    }

    count++;
  }

  console.log(`Adjectives done: ${count}`);
}

// ============================================================
// EXPORT EXPRESSIONS (Faste uttrykk)
// ============================================================

async function exportExpressions(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Faste uttrykk'];
  if (!sheet) {
    console.log('Faste uttrykk sheet not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Faste uttrykk: ${rows.length} rows`);

  let count = 0;

  for (const row of rows) {
    const word = clean(row['uttrykk'] || row['word'] || '').replace(/^\-\s*/, '');
    if (!word) continue;

    const lemma = normalizeLemma(word);

    const { error: le } = await supabase.from('lexemes').upsert({
      lemma,
      pos:            'expression',
      display_form:   word,
      translation_ua: emptyToNull(row['translation_ua']),
      translation_en: emptyToNull(row['translation_en']),
      example:        emptyToNull(row['example']),
      notes:          emptyToNull(row['notes']),
      source:         emptyToNull(row['source']),
      verification:   normVerification(clean(row['source'])),
      status:         normStatus(row['status']),
      cefr:           normCefr(row['cefr']),
      migrated_from:  'Faste uttrykk'
    }, { onConflict: 'lemma,pos' });

    if (le) {
      console.error('Expr lexeme error:', word, le.message);
      continue;
    }

    const lexemeId = await getLexemeId(lemma, 'expression');
    if (!lexemeId) continue;

    const { error: ed } = await supabase.from('expression_data').upsert({
      lexeme_id:          lexemeId,
      expression_subtype: clean(row['expression_subtype']) || 'fixed_expression',
      similar_no:         emptyToNull(row['similar_no']),
      similar_ua:         emptyToNull(row['similar_ua']),
      source_verified:    emptyToNull(row['source']),
    }, { onConflict: 'lexeme_id' });

    if (ed) {
      console.error('Expression data error:', word, ed.message);
      continue;
    }

    count++;
  }

  console.log(`Expressions done: ${count}`);
}

// ============================================================
// EXPORT PARTICLE VERBS + REFLEXIVE
// ============================================================

async function exportParticleVerbs(workbook: XLSX.WorkBook) {
  const sheets = ['Particle Verbs', 'Reflexive_verb'];

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`${sheetName} not found`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
    console.log(`${sheetName}: ${rows.length} rows`);

    let count = 0;

    for (const row of rows) {
      const word = clean(row['uttrykk'] || row['word'] || '');
      if (!word) continue;

      const lemma = normalizeLemma(word);
      const expressionSubtype =
        clean(row['expression_subtype']) ||
        (sheetName === 'Reflexive_verb' ? 'lexical_reflexive' : 'particle_verb');

      const { error: le } = await supabase.from('lexemes').upsert({
          lemma,
        pos:            'verb',
        display_form:   word,
        translation_ua: emptyToNull(row['translation_ua']),
        translation_en: emptyToNull(row['translation_en']),
        example:        emptyToNull(row['example']),
        notes:          emptyToNull(row['notes']),
        source:         emptyToNull(row['source']),
        verification:   normVerification(clean(row['source'])),
        status:         normStatus(row['status']),
        cefr:           normCefr(row['cefr']),
        migrated_from:  sheetName
      }, { onConflict: 'lemma,pos' });

      if (le) {
        console.error(`${sheetName} lexeme error:`, word, le.message);
        continue;
      }

      const lexemeId = await getLexemeId(lemma, 'verb');
      if (!lexemeId) continue;

      const { error: vf } = await supabase.from('verb_forms').upsert({
        lexeme_id:          lexemeId,
        infinitiv:          word,
        presens:            emptyToNull(row['presens']),
        preteritum:         emptyToNull(row['preteritum']),
        perfektum:          emptyToNull(row['perfektum']),
        gruppe:             emptyToNull(row['gruppe']),
        expression_subtype: expressionSubtype,
        base_verb:          emptyToNull(row['base_verb']),
        particle:           emptyToNull(row['particle']),
        requires_seg:       sheetName === 'Reflexive_verb' || expressionSubtype.includes('reflexive'),
      }, { onConflict: 'lexeme_id' });

      if (vf) {
        console.error(`${sheetName} verb_forms error:`, word, vf.message);
        continue;
      }

      count++;
    }

    console.log(`${sheetName} done: ${count}`);
  }
}

// ============================================================
// EXPORT ADVERBS
// ============================================================

async function exportAdverbs(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Adverb ord'];
  if (!sheet) {
    console.log('Adverb ord not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Adverb ord: ${rows.length} rows`);

  let count = 0;

  for (const row of rows) {
    const word = clean(row['adverb'] || row['word'] || '');
    if (!word) continue;

    const { error: le } = await supabase.from('lexemes').upsert({
      lemma:          word,
      pos:            'adverb',
      display_form:   word,
      translation_ua: emptyToNull(row['translation_ua']),
      translation_en: emptyToNull(row['translation_en']),
      example:        emptyToNull(row['example']),
      notes:          emptyToNull(row['notes']),
      source:         emptyToNull(row['source']),
      verification:   normVerification(clean(row['source'])),
      status:         normStatus(row['status']),
      cefr:           normCefr(row['cefr']),
      migrated_from:  'Adverb ord'
    }, { onConflict: 'lemma,pos' });

    if (le) {
      console.error('Adverb lexeme error:', word, le.message);
      continue;
    }

    count++;
  }

  console.log(`Adverbs done: ${count}`);
}

// ============================================================
// EXPORT SYNONYMS
// ============================================================

async function exportSynonyms(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['Synonymer'];
  if (!sheet) {
    console.log('Synonymer not found');
    return;
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
  console.log(`Synonymer: ${rows.length} rows`);

  const validSynTypes = ['exact', 'near', 'formal', 'informal', 'antonym'];
  const validStatuses = [
    'verified_dictionary',
    'verified_manual',
    'ai_candidate',
    'near_synonym',
    'contextual',
    'needs_review',
    'rejected'
  ];
  const validInterchange = [
    'full',
    'mostly',
    'partial',
    'contextual',
    'not_interchangeable'
  ];

  // Build payload first. This makes the sync idempotent:
  // for lexemes present in the Synonymer sheet, existing synonym rows are deleted
  // and then recreated from the current sheet snapshot.
  const payload: any[] = [];
  const lexemeIdsToRefresh = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    const word = clean(row['Word'] || row['word'] || '');
    if (!word) continue;

    const lemma = normalizeLemma(word);
    const lexemeId = await getLexemeId(lemma);

    if (!lexemeId) {
      console.log(`Synonym: lexeme not found for "${word}"`);
      skipped++;
      continue;
    }

    lexemeIdsToRefresh.add(lexemeId);

    const synType = clean(row['synonym_type'] || '');
    const synonymStatus = clean(row['synonym_status']);
    const interchangeability = clean(row['interchangeability']);
    const registerMatch = clean(row['register_match']);

    payload.push({
      lexeme_id:          lexemeId,
      synonym_no:         emptyToNull(row['synonym_no'] || row['Synonym NO']),
      synonym_type:       validSynTypes.includes(synType) ? synType : null,
      synonym_ua:         emptyToNull(row['synonym_ua'] || row['Synonym UA']),
      antonym_no:         emptyToNull(row['antonym_no'] || row['Antonym NO']),
      antonym_ua:         emptyToNull(row['antonym_ua'] || row['Antonym UA']),
      source_primary:     emptyToNull(row['source_primary'] || row['Source']),
      source_secondary:   emptyToNull(row['source_secondary']),
      synonym_status:     validStatuses.includes(synonymStatus) ? synonymStatus : 'ai_candidate',
      interchangeability: validInterchange.includes(interchangeability) ? interchangeability : 'contextual',
      register_match:     ['same', 'higher', 'lower'].includes(registerMatch) ? registerMatch : 'same',
      sense_id:           row['sense_id'] ? parseInt(clean(row['sense_id']), 10) : null,
      confidence:         emptyToNull(row['confidence'] || row['Confidence']),
      notes:              emptyToNull(row['notes'] || row['Notes']),
    });
  }

  const ids = Array.from(lexemeIdsToRefresh);
  if (ids.length) {
    const { error: delErr } = await supabase
      .from('synonyms')
      .delete()
      .in('lexeme_id', ids);

    if (delErr) {
      console.error('Synonyms cleanup error:', delErr.message);
      return;
    }
  }

  if (payload.length) {
    const { error: insErr } = await supabase
      .from('synonyms')
      .insert(payload);

    if (insErr) {
      console.error('Synonyms insert error:', insErr.message);
      return;
    }
  }

  console.log(`Synonyms done: ${payload.length}, skipped: ${skipped}`);
}

// ============================================================
// EXPORT CONSTRUCTIONS (Lexical Registry)
// ============================================================

async function exportConstructions() {
  // TODO:
  // Later this should export Construction Registry:
  // - expression
  // - canonical
  // - lexical_type
  // - expression_subtype
  // - labels
  // - lookup_form
  // - base_verb
  // - particle
  // - pattern
  // - semantic_shift
  // - verification_status
  // - cefr
  console.log('Constructions: skipped (add manually via SQL or Apps Script)');
}

// ============================================================
// MAIN
// ============================================================

async function sync() {
  console.log('=== NORSK TRAINER SYNC START ===');

  const workbook = await downloadWorkbook();

  await exportVerbs(workbook);
  await exportNouns(workbook);
  await exportAdjectives(workbook);
  await exportExpressions(workbook);
  await exportParticleVerbs(workbook);
  await exportAdverbs(workbook);
  await exportSynonyms(workbook);
  await exportConstructions();

  console.log('=== SYNC DONE ===');
}

sync().catch((err) => {
  console.error('SYNC FAILED:', err);
  process.exit(1);
});
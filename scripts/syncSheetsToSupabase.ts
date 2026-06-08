import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config({ path: '.env.local' });

const SHEETS_XLSX_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSONc2_1ez34Ha8tWXBmLXw96hvOHdRa4Q8ncQ8_J_hYZwgu8QHX7TuoZAeljPow3TEKhNmm6GM1S-M/pub?output=xlsx';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const supabase = createClient(supabaseUrl, secretKey);

type SheetRow = Record<string, any>;

const SHEETS_TO_IMPORT = [
  'Verb',
  'Subs. hankjønn',
  'Subs. intetkjønn',
  'Adjektiv',
  'Adverb ord',
  'Faste uttrykk',
];

function clean(value: any): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeHeader(value: string): string {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pick(row: SheetRow, candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeHeader);

  for (const [key, value] of Object.entries(row)) {
    if (
      normalizedCandidates.includes(normalizeHeader(key)) &&
      clean(value)
    ) {
      return clean(value);
    }
  }

  return '';
}

function normalizeCanonical(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/^å\s+/, '')
    .replace(/^(en|ei|et)\s+/, '');
}

function detectCategory(sheetName: string): string {
  if (sheetName === 'Verb') return 'verb';
  if (sheetName === 'Subs. hankjønn') return 'noun_masculine';
  if (sheetName === 'Subs. intetkjønn') return 'noun_neuter';
  if (sheetName === 'Subs. hunkjønn') return 'noun_feminine';
  if (sheetName === 'Adjektiv') return 'adjective';
  if (sheetName === 'Adverb ord') return 'adverb';
  if (sheetName === 'Faste uttrykk') return 'expression';

  return 'unknown';
}

function getMainWord(sheetName: string, row: SheetRow): string {
  if (sheetName === 'Verb') {
    return pick(row, ['Infinitive', 'Infinitiv', 'word', 'Word']);
  }

  if (sheetName.startsWith('Subs.')) {
    return pick(row, [
      'Ubestemt form entall',
      'Substantiv',
      'word',
      'Word',
    ]);
  }

  if (sheetName === 'Adjektiv') {
    return pick(row, ['positiver', 'Adjektiv', 'adjektiv', 'word', 'Word']);
  }

  if (sheetName === 'Adverb ord') {
    return pick(row, ['Adverb', 'Adverb ', 'word', 'Word']);
  }

  if (sheetName === 'Faste uttrykk') {
    return pick(row, [
      'Fast uttryk Expression',
      'Fast uttryk Expression ',
      'Uttrykk',
      'Expression',
      'word',
      'Word',
    ]);
  }

  return pick(row, ['word', 'Word', 'Norwegian', 'NO']);
}

function getUa(row: SheetRow): string {
  for (const [key, value] of Object.entries(row)) {
    const normalized = String(key)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    console.log('UA CHECK:', normalized);

    if (
      normalized.includes('ua') ||
      normalized.includes('укра') ||
      normalized.includes('переклад')
    ) {
      const cleaned = clean(value);

      if (cleaned) {
        console.log('UA FOUND:', cleaned);

        return cleaned;
      }
    }
  }

  return '';
}


function getEn(row: SheetRow): string {
  return pick(row, [
    'EN',
    'Betyr Eng',
    'betyr Eng',
    'Betyr EN',
    'Meaning EN',
    'Meaning  ENG',
    'Meaning ENG',
    'English',
  ]);
}

function getExample(row: SheetRow): string {
  return pick(row, [
    'Example',
    'example',
    'Setning',
    'Sentence',
    'Eksempel',
    'Example NO',
  ]);
}

function getFrequency(row: SheetRow): number | null {
  const raw = pick(row, ['Frequency', 'frequency', 'freq']);

  if (!raw) return null;

  const num = Number(raw);

  return Number.isFinite(num) ? num : null;
}

function buildForms(sheetName: string, row: SheetRow) {
  const forms: {
    form_type: string;
    form_value: string;
    is_primary?: boolean;
  }[] = [];

  function add(form_type: string, value: string, is_primary = false) {
    if (value) {
      forms.push({
        form_type,
        form_value: value,
        is_primary,
      });
    }
  }

  if (sheetName === 'Verb') {
    add('infinitive', pick(row, ['Infinitive', 'Infinitiv']), true);
    add('present', pick(row, ['presens nåtid', 'Presens', 'presens']));
    add('preterite', pick(row, ['preteritum fortid', 'Preteritum', 'preteritum']));
    add('present_perfect', pick(row, ['presens perfektum', 'Presens perfektum']));
  }

  if (sheetName.startsWith('Subs.')) {
    add('indefinite_singular', pick(row, ['Ubestemt form entall']), true);
    add('definite_singular', pick(row, ['Bestemt form entall']));
    add('indefinite_plural', pick(row, ['Ubestemt form flertall']));
    add('definite_plural', pick(row, ['Bestemt form flertall']));
  }

  if (sheetName === 'Adjektiv') {
    add('common', pick(row, ['positiver', 'Adjektiv']), true);
    add('neuter', pick(row, ['Intetkj.', 'Intetkjønn']));
    add('plural', pick(row, ['flertall', 'Flertall']));
    add('comparative', pick(row, ['komparativ', 'Komparativ']));
    add('superlative', pick(row, ['superlativ', 'Superlativ']));
    add('definite_superlative', pick(row, ['bestemt superlativ', 'Bestemt superlativ']));
  }

  if (sheetName === 'Adverb ord') {
    add('base', pick(row, ['Adverb', 'Adverb ']), true);
  }

  if (sheetName === 'Faste uttrykk') {
    add('expression', pick(row, ['Fast uttryk Expression', 'Fast uttryk Expression ', 'Uttrykk', 'Expression']), true);
  }

  return forms;
}

async function downloadWorkbook() {
  const response = await fetch(SHEETS_XLSX_URL);

  if (!response.ok) {
    throw new Error(`Failed to download XLSX: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return XLSX.read(arrayBuffer, { type: 'array' });
}

async function replaceChildRows(
  lexemeId: string,
  sheetName: string,
  row: SheetRow
) {
  await supabase.from('word_forms').delete().eq('lexeme_id', lexemeId);
  await supabase.from('translations').delete().eq('lexeme_id', lexemeId);
  await supabase.from('examples').delete().eq('lexeme_id', lexemeId);

  const forms = buildForms(sheetName, row);

  for (const form of forms) {
    await supabase.from('word_forms').insert({
      lexeme_id: lexemeId,
      form_type: form.form_type,
      form_value: form.form_value,
      is_primary: !!form.is_primary,
    });
  }

  const ua = getUa(row);
  const en = getEn(row);
  const example = getExample(row);

  if (ua) {
    await supabase.from('translations').insert({
      lexeme_id: lexemeId,
      lang: 'ua',
      value: ua,
    });
  }

  if (en) {
    await supabase.from('translations').insert({
      lexeme_id: lexemeId,
      lang: 'en',
      value: en,
    });
  }

  if (example) {
    await supabase.from('examples').insert({
      lexeme_id: lexemeId,
      example_no: example,
    });
  }

  return {
    formsCount: forms.length,
    translationsCount: Number(Boolean(ua)) + Number(Boolean(en)),
    examplesCount: example ? 1 : 0,
  };
}

async function sync() {
  console.log('Downloading Google Sheets export...');

  const workbook = await downloadWorkbook();

  let importedLexemes = 0;
  let importedForms = 0;
  let importedTranslations = 0;
  let importedExamples = 0;

  for (const sheetName of SHEETS_TO_IMPORT) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      console.log(`Skip missing sheet: ${sheetName}`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      defval: '',
    });

    console.log(`Sync sheet: ${sheetName}, rows: ${rows.length}`);
    console.log('Headers:', Object.keys(rows[0] || {}));

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const sourceRow = index + 2;
      const word = getMainWord(sheetName, row);

      if (!word) continue;

      const category = detectCategory(sheetName);
      const canonical = normalizeCanonical(word);
      const frequency = getFrequency(row);

      const { data: lexeme, error: lexemeError } = await supabase
        .from('lexemes')
        .upsert(
          {
            source_sheet: sheetName,
            source_row: sourceRow,
            category,
            word,
            canonical,
            frequency,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'source_sheet,source_row',
          }
        )
        .select()
        .single();

      if (lexemeError) {
        console.error('Lexeme upsert error:', {
          sheetName,
          sourceRow,
          word,
          error: lexemeError.message,
        });
        continue;
      }

      importedLexemes++;

      const childCounts = await replaceChildRows(
        lexeme.id,
        sheetName,
        row
      );

      importedForms += childCounts.formsCount;
      importedTranslations += childCounts.translationsCount;
      importedExamples += childCounts.examplesCount;
    }
  }

  console.log('SYNC DONE');
  console.log({
    importedLexemes,
    importedForms,
    importedTranslations,
    importedExamples,
  });
}

sync().catch((error) => {
  console.error('SYNC FAILED:', error);
  process.exit(1);
});
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const LEXIN_SOURCE = 'lexin';
const LEXIN_BASE_URL = 'https://editorportal.oslomet.no/api/v1/findwords';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Parse E-idi: "legge merke til (observere, se)"
// → { expressionText: "legge merke til", gloss: "observere, se", glossTerms: ["observere","se"] }
function parseIdiomText(text: string): {
  expressionText: string;
  gloss: string | null;
  glossTerms: string[];
} {
  const parenIdx = text.indexOf('(');
  if (parenIdx === -1) {
    return { expressionText: text.trim(), gloss: null, glossTerms: [] };
  }
  const expressionText = text.slice(0, parenIdx).trim();
  const rest = text.slice(parenIdx + 1);
  const closeIdx = rest.lastIndexOf(')');
  const gloss = closeIdx !== -1 ? rest.slice(0, closeIdx).trim() : rest.trim();
  const glossTerms = gloss.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  return { expressionText, gloss, glossTerms };
}

type LexinEntry = {
  id: number;
  sub_id: number;
  type: string;
  text: string;
  index: number | null;
  pri_id?: number | null;
};

// ============================================================================
// ФИКС v4 (10.07.2026 — найдено через сырой JSON-ответ Lexin для "bestå"):
//
// Lexin НЕ возвращает массив групп-по-смыслам, как предполагала вся
// предыдущая версия parser'а. "result" — это массив из ОДНОЙ секции, а
// внутри неё — ПЛОСКИЙ список записей вперемешку для НЕСКОЛЬКИХ разных
// словарных статей (разных "id"), включая статьи слов, вообще не
// совпадающих с искомой леммой (Lexin подмешивает fuzzy/похожие по
// написанию результаты — напр. на запрос "bestå" пришли ещё статьи
// "vare", "omfatte", "hangle", "stryke", "sikkert").
//
// Поэтому: сначала группируем весь плоский список по "id" в
// Map<id, entries[]>, и только затем для каждой такой "суб-статьи"
// отдельно проверяем совпадение и собираем переводы/определения/примеры.
// source_entry_id для каждой конкретно записи берётся с неё самой (e.id).
//
// ПОДТВЕРЖДЕНО НА ЖИВЫХ ДАННЫХ (15.07.2026, dry-run "bestå"):
// entries_skipped_no_match = 5, matched_entry_ids = [47750, 402].
// ============================================================================

function groupEntriesById(flatEntries: LexinEntry[]): Map<number, LexinEntry[]> {
  const byId = new Map<number, LexinEntry[]>();
  for (const e of flatEntries) {
    if (e.id == null) continue;
    if (!byId.has(e.id)) byId.set(e.id, []);
    byId.get(e.id)!.push(e);
  }
  return byId;
}

function entriesOfType(bucket: LexinEntry[], ...types: string[]): LexinEntry[] {
  return bucket.filter((e) => types.includes(e.type));
}

// ФИКС (найдено 10.07.2026 через сравнение с сайтом lexin.oslomet.no):
// физический порядок появления записей в плоском "result" НЕ совпадает с
// порядком, который сам Lexin показывает как основной/первый на своём
// сайте. Настоящий порядок релевантности хранится отдельно, в поле
// верхнего уровня "resArray" — {"0":{"id":402},"1":{"id":47750},...},
// где числовой ключ — позиция статьи на сайте.
function extractEntryOrderFromResArray(rawData: any): Map<number, number> {
  const resArray = rawData?.resArray;
  const orderMap = new Map<number, number>();
  if (resArray && typeof resArray === 'object') {
    for (const [key, val] of Object.entries(resArray)) {
      const idx = Number(key);
      const id = (val as any)?.id;
      if (Number.isFinite(idx) && typeof id === 'number') {
        if (!orderMap.has(id) || idx < (orderMap.get(id) as number)) {
          orderMap.set(id, idx);
        }
      }
    }
  }
  return orderMap;
}

// ФИКС v6 (11.07.2026 — подтверждено на `nå`):
// украинские варианты Lexin могут одновременно использовать `|`, запятые
// и пробелы между самостоятельными инфинитивами. Нормализация превращает
// их в явный список через запятые, сохраняя все варианты.
function isUkrainianInfinitiveToken(token: string): boolean {
  const clean = token
    .trim()
    .replace(/^[("'«„]+|[)"'»“.,;:!?]+$/g, '');

  return /(?:ти|тися|тись)$/iu.test(clean);
}

function splitWhitespaceInfinitiveList(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length > 1 && tokens.every(isUkrainianInfinitiveToken)) {
    return tokens;
  }

  return [trimmed];
}

function normalizeTranslationSegment(segment: string): string[] {
  return segment
    .split(',')
    .flatMap((part) => splitWhitespaceInfinitiveList(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

// ФИКС v11 (19.07.2026 — найдено на живых данных: "å ta på seg" получило
// ОДНУ строку translation из 12 склеенных вариантов: "вдягти, одягти,
// вдягати, вдягнути, одягнути, взути, узути, взувати, узувати, взяти на
// себе, одягати, взувати; брати на себе" — включая внутренние дубли
// ("одягати" и "взувати" дважды).
//
// Причина: cleanTranslationText уже правильно разбирала текст Lexin на
// отдельные варианты (v6, split по '|' + запятым + пробельным
// инфинитивам), но в конце схлопывала массив обратно в ОДНУ строку через
// unique.join(', '). Файл уже содержит отдельный цикл ранжирования/дедупа
// ПОСЛЕ сборки translations (см. seenPerEntry/rankPerEntry ниже по файлу)
// — он рассчитан именно на приём отдельных вариантов как отдельных строк
// entity_translations с инкрементным translation_rank внутри одного
// source_entry_id, и дедуп он делает сам. Но получал на вход уже
// склеенную мега-строку как единственный "вариант" — то есть отработать
// как задумано не мог.
//
// Фикс — здесь: возвращаем string[] вместо string, ничего не склеивая.
// Дедуп внутри Lexin-текста (совпадающие после normalizeKey варианты)
// остаётся здесь же, до передачи дальше — это защита от дублей УЖЕ
// ВНУТРИ одного sub_id (напр. "одягати" дважды в одном исходном тексте),
// а не от дублей между разными source_entry_id (та защита — отдельный
// уровень, ниже по файлу). Cap на количество вариантов сюда намеренно НЕ
// добавлен — v_cap_uk/v_cap_en в sync_lexeme_translation_columns
// применяются на агрегации между смыслами (source_entry_id), а внутри
// одного смысла distinct on (source_entry_id) в sync-функции и так
// выбирает только translation_rank=1 — значит хранить все варианты здесь
// безопасно, лишнее просто не попадёт в lexemes.translation_ua.
function cleanTranslationVariants(text: string): string[] {
  const normalized = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const candidates = normalized
    .split('|')
    .flatMap((block) => normalizeTranslationSegment(block));

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();

    if (!cleaned) continue;

    const key = normalizeKey(cleaned);
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(cleaned);
  }

  return unique;
}

// Обёртка для идиом-веток (Ukr-idi/B-idi через parseIdiomText): там на
// входе уже ОДНА конкретная фраза идиомы, не Lexin-поле с несколькими
// синонимами через "|" — join здесь безопасен и лишь нормализует
// пунктуацию/пробелы, не теряя и не размножая варианты.
function cleanTranslationText(text: string): string {
  return cleanTranslationVariants(text).join(', ');
}

// ФИКС v12 (25.07.2026 — найдено на живых данных: "bygge"):
// Lexin разделяет РАЗНЫЕ смыслы одного слова внутри ОДНОГО Ukr-lem
// текстового поля через ";" — напр. "будувати; ґрунтуватися" для bygge
// (значение 1: "строить", значение 2: "основываться на"). Прежняя
// cleanTranslationVariants не считала ";" границей смысла — весь текст
// уходил в одну плоскую группу вариантов с общим sense_rank=1, из-за чего
// downstream (translation-aspect-reorder-worker) пытался переставить
// "будувати"/"побудувати"/"збудувати" вперемешку со "спертися"/
// "ґрунтуватися" как единую видову пару, и AI закономерно не мог найти
// среди них общую базову форму — либо путал местами, либо (при защите от
// галлюцинаций) отбрасывал часть слов как несовпадение множества.
//
// Разбиение depth-aware (";" не считается границей ВНУТРИ скобок — тот
// же принцип, что уже применяется для запятых в gloss-парсинге) на
// смысловые группы; внутри каждой группы — прежняя логика
// (|/,/пробельные-инфинитивы). Каждая группа получает свой sense_rank по
// порядку появления (1, 2, 3...), а не всегда 1.
function splitOutsideParens(text: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === separator && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function cleanTranslationSenseGroups(text: string): string[][] {
  const normalized = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const senseSegments = splitOutsideParens(normalized, ';')
    .map((s) => s.trim())
    .filter(Boolean);

  return senseSegments
    .map((segment) => {
      const candidates = segment
        .split('|')
        .flatMap((block) => normalizeTranslationSegment(block));

      const seen = new Set<string>();
      const unique: string[] = [];

      for (const candidate of candidates) {
        const cleaned = candidate
          .replace(/\s+/g, ' ')
          .replace(/\s+([,.;:!?])/g, '$1')
          .trim();

        if (!cleaned) continue;

        const key = normalizeKey(cleaned);
        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(cleaned);
      }

      return unique;
    })
    .filter((group) => group.length > 0);
}

// ФИКС v5 (11.07.2026 — подтверждено диагностикой для `nå`):
// прежняя проверка `v.includes('verb')` ошибочно классифицировала
// `adverb` как `verb`. POS сопоставляется по точным значениям и целым
// токенам. Статьи с одинаковой леммой, но разной частью речи (омонимы:
// virke-дієслово vs virke-іменник) различаются через E-kat/N-kat.
function normalizePos(value: string | null | undefined): string | null {
  if (!value) return null;

  const v = normalizeKey(String(value))
    .replace(/[.:;,]+$/g, '')
    .trim();

  const exactMap: Record<string, string> = {
    verb: 'verb',

    substantiv: 'noun',
    noun: 'noun',

    adjektiv: 'adjective',
    adjective: 'adjective',
    adj: 'adjective',

    adverb: 'adverb',
    adv: 'adverb',

    preposisjon: 'preposition',
    preposition: 'preposition',

    pronomen: 'pronoun',
    pronoun: 'pronoun',

    konjunksjon: 'conjunction',
    conjunction: 'conjunction',

    subjunksjon: 'subjunction',
    subjunction: 'subjunction',

    interjeksjon: 'interjection',
    interjection: 'interjection',

    determinativ: 'determiner',
    determiner: 'determiner',

    artikkel: 'article',
    article: 'article',

    tallord: 'numeral',
    numeral: 'numeral',

    'дієслово': 'verb',
    'іменник': 'noun',
    'прикметник': 'adjective',
    'прислівник': 'adverb',
    'прийменник': 'preposition',
    'займенник': 'pronoun',
    'сполучник': 'conjunction',
    'вигук': 'interjection',
    'числівник': 'numeral',
  };

  if (exactMap[v]) return exactMap[v];

  const tokens = v
    .split(/[^\p{L}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (exactMap[token]) return exactMap[token];
  }

  return null;
}

function collectRawPosSignals(bucket: LexinEntry[]): Array<{
  type: string;
  text: string;
  sub_id: number | null;
  index: number | null;
}> {
  const explicitTypes = new Set([
    'E-kat', 'N-kat', 'B-kat',
    'E-pos', 'N-pos', 'B-pos',
    'E-gram', 'N-gram', 'B-gram',
    'E-ordklasse', 'N-ordklasse', 'B-ordklasse',
  ]);

  return bucket
    .filter((e) => {
      const type = String(e.type ?? '');
      return explicitTypes.has(type) || /(?:^|[-_])(kat|pos|gram|ordklasse)(?:$|[-_])/i.test(type);
    })
    .map((e) => ({
      type: String(e.type ?? ''),
      text: String(e.text ?? '').trim(),
      sub_id: e.sub_id ?? null,
      index: e.index ?? null,
    }));
}

async function fetchLexin(query: string): Promise<{ ok: boolean; data: unknown; url: string }> {
  const encoded = encodeURIComponent(query);
  const url = `${LEXIN_BASE_URL}?searchWord=${encoded}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: 'https://lexin.oslomet.no',
      Referer: 'https://lexin.oslomet.no/',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Lexin HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const text = await response.text();
  if (!text || text.length < 5 || text === '[]' || text === '{}') {
    return { ok: false, data: null, url };
  }
  return { ok: true, data: JSON.parse(text), url };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));

    const lexemeId: string | null = body.lexeme_id ?? null;
    const expressionId: string | null = body.expression_id ?? null;
    let lemma: string | null = body.lemma ? normalizeKey(String(body.lemma)) : null;

    let explicitPos: string | null = body.pos ? String(body.pos) : null;
    const dryRun = body.dry_run !== false;
    const allowUnknownPos = Boolean(body.allow_unknown_pos ?? false);

    if (!lemma) return jsonResponse({ ok: false, error: 'lemma is required' }, 400);
    if (!lexemeId && !expressionId) {
      return jsonResponse({ ok: false, error: 'lexeme_id or expression_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ФИКС: auto-resolve pos из lexemes.pos, если не передан явно в body —
    // нужен для POS-фильтра однословных совпадений (E-lem-путь) ниже.
    if (lexemeId) {
      const { data: lexemeRow, error: lexemeLookupError } = await supabase
        .from('lexemes')
        .select('lemma, pos')
        .eq('id', lexemeId)
        .maybeSingle();

      if (lexemeLookupError) {
        return jsonResponse({ ok: false, stage: 'load_lexeme', error: safeStringify(lexemeLookupError) }, 500);
      }

      // lexeme_id — источник истины. Это защищает от повреждённой UTF-8
      // строки в body (например best� вместо bestå) и от случайной леммы.
      if (lexemeRow?.lemma) lemma = normalizeKey(String(lexemeRow.lemma));
      if (!explicitPos && lexemeRow?.pos) explicitPos = String(lexemeRow.pos);
    }

    // ФИКС v10 (15.07.2026 — defense-in-depth по итогам обсуждения
    // "смешения lem-match и idi-match записи на один expression_id").
    //
    // До этого фикса expression_id не сверялся с БД вообще: после удаления
    // старого блока авто-резолва root_lemma (v9) body.lemma использовалась
    // как есть, без проверки, что она реально принадлежит указанному
    // expression_id. Штатный вызывающий код (job-enrichment-batch-worker)
    // всегда передаёт lemma = normalized_lemma именно этого expression_id
    // — рассинхрон невозможен при нормальной работе пайплайна. Но это
    // делает функцию хрупкой к двум реальным сценариям, оба уже
    // встречались в этой сессии:
    //   (а) expression_id, для которого в expression_catalog нет строки
    //       (найдено на живых данных: "ta til" из тестового job'а,
    //       expression_id e370ff2c-... — 11 таких "осиротевших" items
    //       подтверждено в lexeme_processing_items);
    //   (б) ручной/отладочный вызов с намеренно или случайно неверной
    //       lemma в body — раньше ничем не проверялся.
    //
    // Симметрично lexeme_id (см. блок выше): expression_catalog — источник
    // истины. lemma из БД имеет приоритет над body.lemma. Если строки нет
    // вовсе — функция отказывает явно и до похода в Lexin, а не тратит
    // внешний вызов впустую и не пишет что-либо от чужого имени.
    if (expressionId) {
      const { data: expressionRow, error: expressionLookupError } = await supabase
        .from('expression_catalog')
        .select('lemma')
        .eq('id', expressionId)
        .maybeSingle();

      if (expressionLookupError) {
        return jsonResponse({ ok: false, stage: 'load_expression', error: safeStringify(expressionLookupError) }, 500);
      }

      if (!expressionRow) {
        return jsonResponse({
          ok: true,
          skipped: true,
          reason: 'expression_id_not_found',
          detail: 'No row in expression_catalog for this expression_id — nothing to look up or write to.',
          expression_id: expressionId,
          lemma_from_body: lemma,
        });
      }

      lemma = normalizeKey(String(expressionRow.lemma));
    }

    const requestedPos = normalizePos(explicitPos);

    // ============================================================================
    // ФИКС v9 (15.07.2026 — убран root_lemma/root_word как обязательный
    // указатель "в какой статье искать").
    //
    // ПРИЧИНА: root_lemma — служебное поле для семей 360° (группировка
    // "ta", "ta til", "ta opp"... вокруг общего корня), созданное ИМЕННО
    // для этой цели. Использовать его как обязательный входной параметр
    // для Lexin-поиска было категориальной ошибкой: 765 выражений, у
    // которых 360°-группировка ещё не проставила root_lemma (в основном —
    // Gemini-сгенерированные "выражения", у которых по построению нет
    // корневой статьи), автоматически лишались перевода вовсе, хотя их
    // LEMMA была на месте и её можно было просто передать в Lexin.
    //
    // РЕШЕНИЕ (по итогам обсуждения 15.07.2026): не подгонять Lexin под
    // нашу структуру данных через root_lemma как жёсткий указатель, откуда
    // искать, а честно спрашивать Lexin по LEMMA (как и для обычных слов)
    // и принимать любой ответ как есть. Технически: queryWord = lemma
    // всегда, без root_word.
    //
    // Внутри каждой статьи, которую вернёт Lexin на этот запрос, ищем ОБА
    // типа совпадения независимо друг от друга:
    //   - E-lem/N-lem === lemma → однословное совпадение — переводы из
    //     Ukr-lem/B-lem/Ukr-def (как раньше в LEXEME MODE).
    //   - E-idi === lemma → устойчивое выражение найдено ВНУТРИ чьей-то
    //     статьи — переводы из Ukr-idi/B-idi (как раньше в EXPRESSION
    //     MODE, но без необходимости заранее знать, чья это статья).
    //
    // Если Lexin вернул статью и там нашлось совпадение (любого из двух
    // типов) — записываем настоящий словарный перевод. Если нет ни того,
    // ни другого — пусто, кандидат идёт на AI fallback дальше по
    // пайплайну. Симметрично и для лексем, и для выражений: единственный
    // критерий — нашёл Lexin или нет.
    //
    // ПОСЛЕДСТВИЕ, ПРИНЯТОЕ ОСОЗНАННО: раньше explicit root_word
    // ГАРАНТИРОВАННО указывал верную статью для поиска E-idi. Теперь для
    // многословных выражений результат зависит от того, вернёт ли Lexin
    // САМ хоть одну релевантную статью на запрос полной фразой (его
    // собственный fuzzy-поиск). Часть выражений, находившихся раньше
    // гарантированно через root_lemma, теперь могут не найтись — это цена
    // простоты и честности подхода "спросили — приняли ответ как есть"
    // вместо "подгоняем запрос под свою модель данных".
    // ============================================================================

    const queryWord = lemma;

    const lexin = await fetchLexin(queryWord);
    if (!lexin.ok || !lexin.data) {
      return jsonResponse({
        ok: true, skipped: true,
        reason: 'Lexin returned no results',
        lemma, url: lexin.url,
      });
    }

    const data = lexin.data as any;
    const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;

    const rawSections: LexinEntry[][] = Array.isArray(result) ? result : [];
    const flatEntries: LexinEntry[] = rawSections.flatMap((section) =>
      Array.isArray(section) ? section : [],
    );

    const entryBuckets = groupEntriesById(flatEntries);
    const normalizedLemma = normalizeKey(lemma);

    const entryOrderFromLexin = extractEntryOrderFromResArray(data);
    let fallbackOrderCounter = 100000;
    const resolveEntryOrder = (entryId: number): number => {
      if (entryOrderFromLexin.has(entryId)) return entryOrderFromLexin.get(entryId)!;
      return fallbackOrderCounter++;
    };

    const translations: any[] = [];
    const sourceEvidence: any[] = [];
    const definitions: any[] = [];
    const examples: any[] = [];
    const glossCandidates: any[] = [];
    let idiomMatches = 0;
    let lemMatches = 0;

    let entriesSkippedNoMatch = 0;
    let entriesSkippedPosMismatch = 0;
    let entriesSkippedUnknownPos = 0;
    let entriesMatched = 0;
    const matchedEntryIds: number[] = [];
    const posDebugEntries: Array<Record<string, unknown>> = [];

    for (const [entryId, bucket] of entryBuckets) {
      // ── ПОПЫТКА 1: однословное совпадение (E-lem/N-lem === lemma) ────
      const lemEntries = entriesOfType(bucket, 'E-lem', 'N-lem');
      const hasLemMatch = lemEntries.some((e) => {
        const t = normalizeKey(e.text ?? '');
        return t === normalizedLemma || t.replace(/^å\s+/, '') === normalizedLemma.replace(/^å\s+/, '');
      });

      // ── ПОПЫТКА 2: выражение внутри этой статьи (E-idi === lemma) ────
      const eIdiList = entriesOfType(bucket, 'E-idi');
      const matchingIdiEntries = eIdiList.filter((e) => {
        if (!e.text?.trim()) return false;
        const parsed = parseIdiomText(e.text);
        return normalizeKey(parsed.expressionText) === normalizedLemma;
      });
      const hasIdiMatch = matchingIdiEntries.length > 0;

      if (!hasLemMatch && !hasIdiMatch) {
        entriesSkippedNoMatch++;
        continue;
      }

      // ── Ветка E-lem: обычное словарное совпадение ────────────────────
      if (hasLemMatch) {
        const catEntries = entriesOfType(bucket, 'E-kat', 'N-kat', 'B-kat');
        const rawPosSignals = collectRawPosSignals(bucket);
        const entryPosRaw = catEntries.find((e) => e.text?.trim())?.text ?? null;
        const entryPos = normalizePos(entryPosRaw);

        if (dryRun) {
          posDebugEntries.push({
            entry_id: entryId,
            matched_via: 'lem',
            requested_pos: requestedPos,
            detected_pos: entryPos,
            detected_pos_raw: entryPosRaw,
            raw_pos_signals: rawPosSignals,
            lemma_entries: lemEntries.map((e) => ({ type: e.type, text: e.text, sub_id: e.sub_id ?? null })),
            category_entries: catEntries.map((e) => ({ type: e.type, text: e.text, sub_id: e.sub_id ?? null })),
            all_entry_types: [...new Set(bucket.map((e) => String(e.type ?? '')))].sort(),
            entries_summary: bucket.map((e) => ({ type: e.type, text: e.text, sub_id: e.sub_id ?? null, index: e.index ?? null })),
          });
        }

        let posBlocked = false;
        if (requestedPos && !entryPos && !allowUnknownPos) {
          entriesSkippedUnknownPos++;
          posBlocked = true;
        } else if (requestedPos && entryPos && entryPos !== requestedPos) {
          entriesSkippedPosMismatch++;
          posBlocked = true;
        }

        if (!posBlocked) {
          entriesMatched++;
          lemMatches++;
          matchedEntryIds.push(entryId);

          for (const e of entriesOfType(bucket, 'Ukr-lem')) {
            if (!e.text?.trim()) continue;
            const entryIdForRow = e.id ?? entryId;
            const senseGroups = cleanTranslationSenseGroups(e.text);

            senseGroups.forEach((group, senseIndex) => {
              for (const variant of group) {
                translations.push({
                  lexeme_id: lexemeId,
                  expression_id: expressionId,
                  language_code: 'uk',
                  translation: variant,
                  translation_type: expressionId ? 'expression_primary' : 'primary',
                  translation_rank: 0,
                  sense_rank: senseIndex + 1,
                  source: LEXIN_SOURCE,
                  confidence: 'high',
                  surface_form: lemEntries[0]?.text ?? lemma,
                  source_entry_id: entryIdForRow,
                  source_sub_id: e.sub_id ?? null,
                  entry_order: resolveEntryOrder(entryIdForRow),
                });
              }
            });
          }

          for (const e of entriesOfType(bucket, 'B-lem')) {
            if (!e.text?.trim()) continue;
            const entryIdForRow = e.id ?? entryId;
            const senseGroups = cleanTranslationSenseGroups(e.text);

            senseGroups.forEach((group, senseIndex) => {
              for (const variant of group) {
                translations.push({
                  lexeme_id: lexemeId,
                  expression_id: expressionId,
                  language_code: 'en',
                  translation: variant,
                  translation_type: expressionId ? 'expression_primary' : 'primary',
                  translation_rank: 0,
                  sense_rank: senseIndex + 1,
                  source: LEXIN_SOURCE,
                  confidence: 'high',
                  surface_form: lemEntries[0]?.text ?? lemma,
                  source_entry_id: entryIdForRow,
                  source_sub_id: e.sub_id ?? null,
                  entry_order: resolveEntryOrder(entryIdForRow),
                });
              }
            });
          }

          for (const e of entriesOfType(bucket, 'Ukr-def')) {
            if (!e.text?.trim()) continue;
            const entryIdForRow = e.id ?? entryId;
            const senseGroups = cleanTranslationSenseGroups(e.text);

            senseGroups.forEach((group, senseIndex) => {
              for (const variant of group) {
                translations.push({
                  lexeme_id: lexemeId,
                  expression_id: expressionId,
                  language_code: 'uk',
                  translation: variant,
                  translation_type: 'definition',
                  translation_rank: 0,
                  sense_rank: senseIndex + 1,
                  source: LEXIN_SOURCE,
                  confidence: 'medium',
                  surface_form: null,
                  source_entry_id: entryIdForRow,
                  source_sub_id: e.sub_id ?? null,
                  entry_order: resolveEntryOrder(entryIdForRow),
                });
              }
            });
          }

          for (const e of entriesOfType(bucket, 'E-def', 'N-def')) {
            if (!e.text?.trim()) continue;
            definitions.push({
              lexeme_id: lexemeId,
              expression_id: expressionId,
              language_code: 'nb',
              definition: e.text.trim(),
              source: LEXIN_SOURCE,
              source_type: e.type === 'N-def' ? 'n_def' : 'e_def',
              source_entry_id: e.id ?? entryId,
            });
          }

          for (const e of entriesOfType(bucket, 'B-def')) {
            if (!e.text?.trim()) continue;
            definitions.push({
              lexeme_id: lexemeId,
              expression_id: expressionId,
              language_code: 'en',
              definition: e.text.trim(),
              source: LEXIN_SOURCE,
              source_type: 'b_def',
              source_entry_id: e.id ?? entryId,
            });
          }

          // ФИКС v7 (15.07.2026): Ukr-eks сопоставляется с E-eks по
          // ЗНАЧЕНИЮ index (порядковый номер), не по позиции в массиве
          // Ukr-eks — сами Ukr-eks приходят в порядке 0,2,1.
          const ukrEksEntries = entriesOfType(bucket, 'Ukr-eks');
          const eEksEntries = entriesOfType(bucket, 'E-eks', 'N-eks');

          for (let eksIdx = 0; eksIdx < eEksEntries.length; eksIdx++) {
            const e = eEksEntries[eksIdx];
            if (!e.text?.trim()) continue;

            const ukrMatch =
              (e.index !== null && e.index !== undefined
                ? ukrEksEntries.find((u) => u.index === e.index)
                : null) ??
              ukrEksEntries.find((u) => u.index === eksIdx) ??
              null;

            examples.push({
              lexeme_id: lexemeId,
              expression_id: expressionId,
              language_code: 'nb',
              example_text: e.text.trim(),
              translation_uk: ukrMatch?.text?.trim() ?? null,
              source: LEXIN_SOURCE,
              source_type: e.type === 'N-eks' ? 'n_eks' : 'e_eks',
              source_entry_id: e.id ?? entryId,
            });
          }

          for (const e of entriesOfType(bucket, 'B-eks')) {
            if (!e.text?.trim()) continue;
            examples.push({
              lexeme_id: lexemeId,
              expression_id: expressionId,
              language_code: 'en',
              example_text: e.text.trim(),
              translation_uk: null,
              source: LEXIN_SOURCE,
              source_type: 'b_eks',
              source_entry_id: e.id ?? entryId,
            });
          }
        }
      }

      // ── Ветка E-idi: выражение найдено внутри статьи ──────────────────
      if (hasIdiMatch) {
        const ukrIdiEntries = entriesOfType(bucket, 'Ukr-idi');
        const bIdiEntries = entriesOfType(bucket, 'B-idi');

        for (let idiIdx = 0; idiIdx < eIdiList.length; idiIdx++) {
          const e = eIdiList[idiIdx];
          if (!e.text?.trim()) continue;

          const parsed = parseIdiomText(e.text);
          if (normalizeKey(parsed.expressionText) !== normalizedLemma) continue;

          idiomMatches++;
          matchedEntryIds.push(entryId);

          const ukrIdi =
            ukrIdiEntries.find((u) => u.index === e.index) ??
            ukrIdiEntries.find((u) => u.index === idiIdx) ??
            ukrIdiEntries[idiIdx] ??
            null;
          const bIdi =
            bIdiEntries.find((b) => b.index === e.index) ??
            bIdiEntries[idiIdx] ??
            null;

          sourceEvidence.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            source: LEXIN_SOURCE,
            source_status: 'e_idi',
            surface_form: e.text.trim(),
            expression_text: parsed.expressionText,
            hint_text: parsed.gloss,
            gloss_terms: parsed.glossTerms,
            ukr_translation: ukrIdi?.text?.trim() ?? null,
            evidence: {
              lexin_entry_id: e.id,
              lexin_sub_id: e.sub_id,
              type: e.type,
              raw_text: e.text,
              parsed,
              ukr_idi: ukrIdi ?? null,
              b_idi: bIdi ?? null,
              found_in_entry_id: entryId,
            },
            urls: [lexin.url],
          });

          if (ukrIdi?.text?.trim()) {
            const parsedUkrIdi = parseIdiomText(ukrIdi.text);
            const entryIdForRow = ukrIdi.id ?? entryId;
            translations.push({
              lexeme_id: expressionId ? null : lexemeId,
              expression_id: expressionId,
              language_code: 'uk',
              translation: cleanTranslationText(parsedUkrIdi.expressionText),
              translation_type: expressionId ? 'expression_primary' : 'primary',
              translation_rank: 0,
              sense_rank: 1,
              source: LEXIN_SOURCE,
              confidence: 'high',
              surface_form: ukrIdi.text.trim(),
              source_entry_id: entryIdForRow,
              source_sub_id: ukrIdi.sub_id ?? null,
              entry_order: resolveEntryOrder(entryIdForRow),
            });
          }

          if (bIdi?.text?.trim()) {
            const parsedBIdi = parseIdiomText(bIdi.text);
            const entryIdForRow = bIdi.id ?? entryId;
            translations.push({
              lexeme_id: expressionId ? null : lexemeId,
              expression_id: expressionId,
              language_code: 'en',
              translation: cleanTranslationText(parsedBIdi.expressionText),
              translation_type: expressionId ? 'expression_primary' : 'primary',
              translation_rank: 0,
              sense_rank: 1,
              source: LEXIN_SOURCE,
              confidence: 'high',
              surface_form: bIdi.text.trim(),
              source_entry_id: entryIdForRow,
              source_sub_id: bIdi.sub_id ?? null,
              entry_order: resolveEntryOrder(entryIdForRow),
            });
          }

          for (const term of parsed.glossTerms) {
            glossCandidates.push({
              source_lexeme_id: lexemeId,
              source_expression_id: expressionId,
              gloss_term: normalizeKey(term),
              surface_gloss: parsed.gloss,
              surface_idi: e.text.trim(),
              uk_translation: null,
              translation_status: 'pending',
              target_lexeme_id: null,
              target_status: 'pending',
              promotion_status: 'pending',
              source: LEXIN_SOURCE,
              confidence: 'medium',
              evidence: {
                evidence_type: 'lexin_gloss_term',
                source_idi: e.text,
                gloss: parsed.gloss,
                all_gloss_terms: parsed.glossTerms,
              },
            });
          }
        }
      }
    }

    // Ранжирование и дедупликация ПО СМЫСЛУ (source_entry_id + sense_rank),
    // не по всей статье — переводы из разных статей/подсмыслов не
    // конкурируют за rank и не считаются дублями друг друга. ФИКС
    // (25.07.2026): добавлен sense_rank в ключ группировки — раньше все
    // "подсмыслы" внутри одной статьи (source_entry_id) делили один
    // rank-счётчик, из-за чего разные значения слова (см. cleanTranslation
    // SenseGroups выше) смешивались в общее ранжирование.
    const seenPerEntry = new Map<string, Set<string>>();
    const rankPerEntry = new Map<string, number>();

    for (const t of translations) {
      if (t.translation_rank !== 0) continue;

      const entryKey = `${t.language_code}:${t.translation_type}:${t.source_entry_id ?? 'null'}:${t.sense_rank ?? 1}`;
      if (!seenPerEntry.has(entryKey)) {
        seenPerEntry.set(entryKey, new Set());
        rankPerEntry.set(entryKey, 0);
      }

      const dedupKey = (t.translation ?? '').toLowerCase().trim();
      const seen = seenPerEntry.get(entryKey)!;

      if (seen.has(dedupKey)) {
        t.translation_rank = -1;
        continue;
      }

      seen.add(dedupKey);
      const rank = (rankPerEntry.get(entryKey) ?? 0) + 1;
      rankPerEntry.set(entryKey, rank);
      t.translation_rank = rank;
    }

    const dedupedTranslations = translations.filter((t) => t.translation_rank !== -1);

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        lemma,
        lexeme_id: lexemeId,
        expression_id: expressionId,
        total_entries_in_response: entryBuckets.size,
        requested_pos: requestedPos,
        entries_matched: entriesMatched,
        entries_skipped_no_match: entriesSkippedNoMatch,
        entries_skipped_pos_mismatch: entriesSkippedPosMismatch,
        entries_skipped_unknown_pos: entriesSkippedUnknownPos,
        allow_unknown_pos: allowUnknownPos,
        pos_debug_entries: posDebugEntries,
        matched_entry_ids: [...new Set(matchedEntryIds)],
        lem_matches: lemMatches,
        idiom_matches: idiomMatches,
        matched_via_lem: lemMatches > 0,
        matched_via_idi: idiomMatches > 0,
        would_upsert: {
          entity_translations: dedupedTranslations.length,
          expression_source_evidence: sourceEvidence.length,
          entity_definitions: definitions.length,
          entity_examples: examples.length,
          lexin_gloss_candidates: glossCandidates.length,
        },
        translations: dedupedTranslations,
        source_evidence: sourceEvidence,
        definitions,
        examples,
        gloss_candidates: glossCandidates,
      });
    }

    // ── Write to DB ───────────────────────────────────────────────────
    const results: Record<string, { upserted: number; errors: string[] }> = {};

    async function upsertBatch(table: string, rows: any[], onConflict: string) {
      if (!rows.length) { results[table] = { upserted: 0, errors: [] }; return; }
      const errors: string[] = [];
      let upserted = 0;
      for (const row of rows) {
        const { error } = await supabase
          .from(table)
          .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict });
        if (error) errors.push(safeStringify(error));
        else upserted++;
      }
      results[table] = { upserted, errors };
    }

    await upsertBatch(
      'entity_translations',
      dedupedTranslations,
      'lexeme_id,expression_id,language_code,translation_type,source,source_entry_id,translation',
    );

    await upsertBatch(
      'expression_source_evidence',
      sourceEvidence,
      'lexeme_id,expression_id,source,source_status,expression_text',
    );

    await upsertBatch(
      'entity_definitions',
      definitions.filter((d) => d.definition?.trim()),
      'lexeme_id,expression_id,language_code,source,source_entry_id',
    );

    await upsertBatch(
      'entity_examples',
      examples.filter((e) => e.example_text?.trim()),
      'lexeme_id,expression_id,language_code,source,example_text',
    );

    await upsertBatch(
      'lexin_gloss_candidates',
      glossCandidates,
      'source_lexeme_id,source_expression_id,gloss_term,source',
    );

    // Удаляем устаревшие Lexin-строки, которые больше не проходят
    // текущие фильтры совпадения/POS. Иначе старые ошибки остаются в БД
    // навсегда после повторного прогона.
    async function cleanupStaleRows(
      table: string,
      currentRows: any[],
      selectColumns: string,
      keyOf: (row: any) => string,
    ) {
      if (results[table]?.errors?.length) return;

      let query = supabase.from(table).select(`id,${selectColumns}`).eq('source', LEXIN_SOURCE);
      query = lexemeId ? query.eq('lexeme_id', lexemeId) : query.is('lexeme_id', null);
      query = expressionId ? query.eq('expression_id', expressionId) : query.is('expression_id', null);

      const { data: existing, error } = await query;
      if (error) {
        results[table].errors.push(`cleanup_lookup_failed: ${safeStringify(error)}`);
        return;
      }

      const validKeys = new Set(currentRows.map(keyOf));
      const staleIds = (existing ?? []).filter((row: any) => !validKeys.has(keyOf(row))).map((row: any) => row.id);
      if (!staleIds.length) return;

      const { error: deleteError } = await supabase.from(table).delete().in('id', staleIds);
      if (deleteError) results[table].errors.push(`cleanup_delete_failed: ${safeStringify(deleteError)}`);
      else (results[table] as any).deleted_stale = staleIds.length;
    }

    await cleanupStaleRows(
      'entity_translations',
      dedupedTranslations,
      'lexeme_id,expression_id,language_code,translation_type,source_entry_id,translation',
      (r) => [r.lexeme_id ?? '', r.expression_id ?? '', r.language_code ?? '', r.translation_type ?? '', r.source_entry_id ?? '', normalizeKey(r.translation ?? '')].join('|'),
    );
    await cleanupStaleRows(
      'entity_definitions',
      definitions.filter((d) => d.definition?.trim()),
      'lexeme_id,expression_id,language_code,source_entry_id,definition',
      (r) => [r.lexeme_id ?? '', r.expression_id ?? '', r.language_code ?? '', r.source_entry_id ?? '', normalizeKey(r.definition ?? '')].join('|'),
    );
    await cleanupStaleRows(
      'entity_examples',
      examples.filter((e) => e.example_text?.trim()),
      'lexeme_id,expression_id,language_code,example_text',
      (r) => [r.lexeme_id ?? '', r.expression_id ?? '', r.language_code ?? '', normalizeKey(r.example_text ?? '')].join('|'),
    );

    const totalErrors = Object.values(results).flatMap((r) => r.errors);

    return jsonResponse({
      ok: totalErrors.length === 0,
      dry_run: false,
      lemma,
      lexeme_id: lexemeId,
      expression_id: expressionId,
      total_entries_in_response: entryBuckets.size,
      requested_pos: requestedPos,
      entries_matched: entriesMatched,
      entries_skipped_no_match: entriesSkippedNoMatch,
      entries_skipped_pos_mismatch: entriesSkippedPosMismatch,
      entries_skipped_unknown_pos: entriesSkippedUnknownPos,
      allow_unknown_pos: allowUnknownPos,
      matched_entry_ids: [...new Set(matchedEntryIds)],
      lem_matches: lemMatches,
      idiom_matches: idiomMatches,
      results,
      errors: totalErrors.length > 0 ? totalErrors : undefined,
    });

  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});
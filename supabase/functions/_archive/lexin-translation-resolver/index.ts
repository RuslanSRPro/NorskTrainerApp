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
// Все версии parser'а до этой трактовали весь плоский список как одну
// "группу" (или в v3 — правильно связывали exact-match с содержимым
// группы, но по-прежнему ошибочно относили это к ОДНОЙ статье через
// group[0]/eLemEntries[0]). Из-за этого:
//   (а) переводы ПОСТОРОННИХ слов могли попасть в результат целевой
//       леммы (dø → "ті"/"you", se → "ті", mål → "миля"/"10 km" и т.д.);
//   (б) для лемм с несколькими ЛЕГИТИМНЫМИ значениями (bestå: "скласти"
//       vs "складатися з") оба значения ранжировались как взаимозаменяемые
//       варианты одного смысла, а не как отдельные статьи.
//
// Правильная модель, подтверждённая структурой ответа Lexin: КАЖДАЯ
// запись (Ukr-lem, B-lem, E-def, E-eks, Ukr-eks, ...) уже содержит "id" —
// устойчивый идентификатор своей статьи, одинаковый у всех записей одной
// статьи. "pri_id" проставлен только у самой E-lem/N-lem записи (как
// маркер "я — заглавная запись своей статьи") и не нужен как отдельный
// ключ группировки, раз есть "id". "sub_id" уникален для каждой отдельной
// записи и НЕ переиспользуется — это не идентификатор статьи.
//
// Поэтому: сначала группируем весь плоский список по "id" в
// Map<id, entries[]>, и только затем для каждой такой "суб-статьи"
// отдельно проверяем exact-match и собираем переводы/определения/примеры.
// source_entry_id для каждой конкретно записи берётся с неё самой (e.id),
// а не наследуется от контекста цикла — так, чтобы код не зависел от
// негласного инварианта "все записи в bucket имеют один и тот же id"
// (хотя это и гарантируется самой группировкой, читать с самой записи
// надёжнее и очевиднее для будущих правок).
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
// сайте. Для "bestå" E-lem записи в "result" идут в порядке id=47750
// (первым), затем id=402 — но сам сайт Lexin показывает id=402
// ("складатися, полягати") как ПЕРВУЮ статью, не 47750 ("здати...").
//
// Настоящий порядок релевантности Lexin хранит отдельно, в поле верхнего
// уровня "resArray" — объекте вида {"0":{"id":402},"1":{"id":47750},...},
// где числовой ключ — позиция статьи в порядке отображения на сайте.
// Именно resArray используется для "top-2 значения" в promotion-слое, а
// НЕ порядок появления записей в самом "result".
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
// и пробелы между самостоятельными инфинитивами. Нормализация теперь
// превращает их в явный список через запятые, сохраняя все варианты.
// Канонический вариант по-прежнему выбирается отдельным worker'ом.
//
// ФИКС: Lexin иногда склеивает несколько синонимов через "|" без пробела
// внутри одного текстового поля (напр. "здати здавати скласти |складати").
// Это дефект данных на стороне Lexin (похоже на пропущенный пробел при
// вводе редактором), не баг parser'а — нормализуем в читаемый список.
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

  // Lexin иногда передаёт несколько украинских инфинитивов без запятых:
  // "дістати досягти" или "досягнути добратися".
  // Разбиваем только когда КАЖДЫЙ токен похож на самостоятельный
  // украинский инфинитив. Многословные фразы вроде "давати пас" или
  // "планувати щось зробити" остаются нетронутыми.
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

// Нормализует только техническую структуру текста Lexin, не удаляя
// авторитетные варианты и не выбирая за Lexin "правильный" вид.
//
// Примеры:
// "дістати досягти |діставати, досягати"
//   → "дістати, досягти, діставати, досягати"
//
// "досягнути добратися |досягати, добиратися"
//   → "досягнути, добратися, досягати, добиратися"
//
// Символ "|" трактуется как граница двух блоков вариантов. Слитые через
// пробел самостоятельные инфинитивы разделяются запятыми. Реальный выбор
// одного канонического варианта остаётся задачей
// translation-canonicalization-worker.
function cleanTranslationText(text: string): string {
  const normalized = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

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

  return unique.join(', ');
}

// ФИКС v5 (11.07.2026 — подтверждено диагностикой для `nå`):
// прежняя проверка `v.includes('verb')` ошибочно классифицировала
// `adverb` как `verb`. Теперь POS сопоставляется по точным значениям
// и целым токенам. Поэтому статьи `nå = now` и `nå = altså` больше
// не проходят фильтр для лексемы `å nå` с pos = verb.
//
// ФИКС (найдено 11.07.2026 через слово "virke" — verb vs noun): статьи с
// одинаковой леммой, но РАЗНОЙ частью речи (омонимы: virke-дієслово
// "працювати" vs virke-іменник "деревина") ранее не различались вообще —
// exact-match проверял только текст леммы, не категорию. В итоге переклад
// іменника міг потрапити в дієслівну лексему (і навпаки). Тепер частина
// мови статті (E-kat/N-kat) звіряється з частиною мови самої лексеми
// (lexemes.pos); статті з несумісною частиною мови пропускаються.
function normalizePos(value: string | null | undefined): string | null {
  if (!value) return null;

  // ВАЖНО: нельзя проверять `includes('verb')`, потому что строка
  // `adverb` тоже содержит подстроку `verb` и раньше ошибочно
  // нормализовалась как глагол.
  const v = normalizeKey(String(value))
    .replace(/[.:;,]+$/g, '')
    .trim();

  const exactMap: Record<string, string> = {
    // Bokmål / Nynorsk / English
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

    // Ukrainian category labels occasionally present in Ukr-kat
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

  // Поддержка расширенных категорий вроде "verb transitiv" или
  // "substantiv hankjønn". Проверяем целые токены, а не подстроки.
  const tokens = v
    .split(/[^\p{L}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (exactMap[token]) return exactMap[token];
  }

  return null;
}


// Диагностика POS: Lexin использует не всегда одинаковые type-поля для
// части речи. В dry-run сохраняем все потенциальные POS-сигналы статьи,
// чтобы увидеть реальные type/text для проблемных entry_id.
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
    // root_word: the source article lemma (not necessarily linguistic root).
    // e.g. "legge merke til" → root_word = "merke" (the Ordbokene article).
    // If not provided explicitly and expression_id is given, auto-resolved
    // from expression_catalog.root_lemma — no manual lookup needed.
    let rootWord: string | null = body.root_word
      ? normalizeKey(String(body.root_word))
      : null;
    // ФИКС: pos лексемы нужен для POS-фильтра статей Lexin (см.
    // normalizePos выше). Если не передан явно — читаем из lexemes.pos по
    // lexeme_id, аналогично авто-резолву root_word для expression_id.
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

    // Auto-resolve root_word from expression_catalog.root_lemma when
    // expression_id is provided but root_word is not manually specified.
    if (expressionId && !rootWord) {
      const { data: catalogRow } = await supabase
        .from('expression_catalog')
        .select('root_lemma')
        .eq('id', expressionId)
        .maybeSingle();

      if (catalogRow?.root_lemma) {
        rootWord = normalizeKey(catalogRow.root_lemma);
      }
    }

    // ФИКС: auto-resolve pos из lexemes.pos, если не передан явно в body —
    // нужен для POS-фильтра в LEXEME MODE ниже. Expression mode не
    // использует POS-фильтр (у выражений нет единой простой части речи).
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
    const requestedPos = normalizePos(explicitPos);

    const queryWord = rootWord ?? lemma;
    const expressionMode = Boolean(rootWord && expressionId);

    const lexin = await fetchLexin(queryWord);
    if (!lexin.ok || !lexin.data) {
      return jsonResponse({
        ok: true, skipped: true,
        reason: 'Lexin returned no results',
        lemma, root_word: rootWord, url: lexin.url,
      });
    }

    const data = lexin.data as any;
    const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;

    // result — массив "секций" (обычно ОДНА), каждая секция сама по себе
    // плоский список записей МНОГИХ статей вперемешку. Собираем все секции
    // в один плоский список и группируем по id ниже.
    const rawSections: LexinEntry[][] = Array.isArray(result) ? result : [];
    const flatEntries: LexinEntry[] = rawSections.flatMap((section) =>
      Array.isArray(section) ? section : [],
    );

    const entryBuckets = groupEntriesById(flatEntries);
    const normalizedLemma = normalizeKey(lemma);

    const entryOrderFromLexin = extractEntryOrderFromResArray(data);
    // Fallback for any matched entry id NOT present in resArray (shouldn't
    // normally happen, but resArray coverage isn't formally guaranteed) —
    // push it after all resArray-ranked entries, in first-appearance order,
    // rather than dropping ordering information entirely.
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
    let idiomMatches = 0; // how many E-idi entries matched our lemma

    let entriesSkippedNoMatch = 0;
    let entriesSkippedPosMismatch = 0;
    let entriesSkippedUnknownPos = 0;
    let entriesMatched = 0;
    const matchedEntryIds: number[] = []; // diagnostics — which Lexin articles were actually used
    const posDebugEntries: Array<Record<string, unknown>> = [];

    for (const [entryId, bucket] of entryBuckets) {
      if (expressionMode) {
        // ── EXPRESSION MODE ───────────────────────────────────────────
        const ukrIdiEntries = entriesOfType(bucket, 'Ukr-idi');
        const bIdiEntries = entriesOfType(bucket, 'B-idi');
        const eIdiList = entriesOfType(bucket, 'E-idi');

        for (let idiIdx = 0; idiIdx < eIdiList.length; idiIdx++) {
          const e = eIdiList[idiIdx];
          if (!e.text?.trim()) continue;

          const parsed = parseIdiomText(e.text);
          if (normalizeKey(parsed.expressionText) !== normalizedLemma) continue;

          idiomMatches++;
          matchedEntryIds.push(entryId);

          // Index matching: Lexin is inconsistent — E-idi: index=null,
          // B-idi: index=null, but Ukr-idi: index=0.
          // Strategy: exact match first, then positional fallback.
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
            },
            urls: [lexin.url],
          });

          if (ukrIdi?.text?.trim()) {
            const parsedUkrIdi = parseIdiomText(ukrIdi.text);
            const entryIdForRow = ukrIdi.id ?? entryId;
            translations.push({
              // lexeme_id: null — обязательно для expression-строк, см.
              // constraint entity_translations_single_entity.
              lexeme_id: null,
              expression_id: expressionId,
              language_code: 'uk',
              translation: cleanTranslationText(parsedUkrIdi.expressionText),
              translation_type: 'expression_primary',
              translation_rank: 0, // reassigned per-entry below
              source: LEXIN_SOURCE,
              confidence: 'high',
              surface_form: ukrIdi.text.trim(),
              // ФИКС: source_entry_id берётся с САМОЙ записи (ukrIdi.id),
              // не наследуется от контекста цикла.
              source_entry_id: entryIdForRow,
              source_sub_id: ukrIdi.sub_id ?? null,
              entry_order: resolveEntryOrder(entryIdForRow),
            });
          }

          if (bIdi?.text?.trim()) {
            const parsedBIdi = parseIdiomText(bIdi.text);
            const entryIdForRow = bIdi.id ?? entryId;
            translations.push({
              lexeme_id: null,
              expression_id: expressionId,
              language_code: 'en',
              translation: cleanTranslationText(parsedBIdi.expressionText),
              translation_type: 'expression_primary',
              translation_rank: 0,
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

      } else {
        // ── LEXEME MODE ─────────────────────────────────────────────
        // ФИКС: exact-match проверяется ВНУТРИ одной статьи (id-бакета),
        // включая нюнорские записи (N-lem) — статьи, где Lexin вернул
        // только N-lem (nynorsk), раньше никогда не давали exact match
        // (проверялся только E-lem) и терялись/понижались зря.
        const lemEntries = entriesOfType(bucket, 'E-lem', 'N-lem');
        const hasExactMatch = lemEntries.some((e) => {
          const t = normalizeKey(e.text ?? '');
          return t === normalizedLemma || t.replace(/^å\s+/, '') === normalizedLemma.replace(/^å\s+/, '');
        });

        // Статья без точного совпадения леммы пропускается целиком — она
        // либо статья другого слова (fuzzy-fallback самого Lexin API),
        // либо нерелевантный сенс. Диагностировано на "bestå": статьи
        // "vare"/"omfatte"/"hangle"/"stryke"/"sikkert" отсеиваются здесь.
        if (!hasExactMatch) {
          entriesSkippedNoMatch++;
          continue;
        }

        // ФИКС: POS-фильтр (см. normalizePos выше). Если у лексемы известна
        // часть речи и статья Lexin явно указывает СВОЮ часть речи через
        // E-kat/N-kat, и они не совпадают — это омоним другой части речи
        // (напр. "virke"-дієслово vs "virke"-іменник), не альтернативный
        // смысл того же слова. Статьи без категории (entryPos === null)
        // НЕ отбрасываются — так безопаснее при неполных метаданных Lexin.
        const catEntries = entriesOfType(bucket, 'E-kat', 'N-kat', 'B-kat');
        const rawPosSignals = collectRawPosSignals(bucket);
        const entryPosRaw = catEntries.find((e) => e.text?.trim())?.text ?? null;
        const entryPos = normalizePos(entryPosRaw);

        if (dryRun) {
          posDebugEntries.push({
            entry_id: entryId,
            requested_pos: requestedPos,
            detected_pos: entryPos,
            detected_pos_raw: entryPosRaw,
            raw_pos_signals: rawPosSignals,
            lemma_entries: lemEntries.map((e) => ({
              type: e.type,
              text: e.text,
              sub_id: e.sub_id ?? null,
            })),
            category_entries: catEntries.map((e) => ({
              type: e.type,
              text: e.text,
              sub_id: e.sub_id ?? null,
            })),
            all_entry_types: [...new Set(bucket.map((e) => String(e.type ?? '')))].sort(),
            entries_summary: bucket.map((e) => ({
              type: e.type,
              text: e.text,
              sub_id: e.sub_id ?? null,
              index: e.index ?? null,
            })),
          });
        }
        if (requestedPos && !entryPos && !allowUnknownPos) {
          entriesSkippedUnknownPos++;
          continue;
        }
        if (requestedPos && entryPos && entryPos !== requestedPos) {
          entriesSkippedPosMismatch++;
          continue;
        }

        entriesMatched++;
        matchedEntryIds.push(entryId);

        for (const e of entriesOfType(bucket, 'Ukr-lem')) {
          if (!e.text?.trim()) continue;
          const entryIdForRow = e.id ?? entryId;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'uk',
            translation: cleanTranslationText(e.text),
            translation_type: 'primary',
            translation_rank: 0, // reassigned per-entry below
            source: LEXIN_SOURCE,
            confidence: 'high', // статья уже гарантированно exact-match
            surface_form: lemEntries[0]?.text ?? lemma,
            source_entry_id: entryIdForRow,
            source_sub_id: e.sub_id ?? null,
            entry_order: resolveEntryOrder(entryIdForRow),
          });
        }

        for (const e of entriesOfType(bucket, 'B-lem')) {
          if (!e.text?.trim()) continue;
          const entryIdForRow = e.id ?? entryId;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'en',
            translation: cleanTranslationText(e.text),
            translation_type: 'primary',
            translation_rank: 0,
            source: LEXIN_SOURCE,
            confidence: 'high',
            surface_form: lemEntries[0]?.text ?? lemma,
            source_entry_id: entryIdForRow,
            source_sub_id: e.sub_id ?? null,
            entry_order: resolveEntryOrder(entryIdForRow),
          });
        }

        for (const e of entriesOfType(bucket, 'Ukr-def')) {
          if (!e.text?.trim()) continue;
          const entryIdForRow = e.id ?? entryId;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'uk',
            translation: cleanTranslationText(e.text),
            translation_type: 'definition',
            translation_rank: 0,
            source: LEXIN_SOURCE,
            confidence: 'medium',
            surface_form: null,
            source_entry_id: entryIdForRow,
            source_sub_id: e.sub_id ?? null,
            entry_order: resolveEntryOrder(entryIdForRow),
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

        // ФИКС v7 (15.07.2026 — найдено через dry-run на "bestå"):
        // сопоставление Ukr-eks с E-eks по `u.index === e.index` не
        // работало НИКОГДА: у всех E-eks в ответе Lexin index === null, а
        // у Ukr-eks index — это ПОРЯДКОВЫЙ НОМЕР соответствующего E-eks
        // внутри статьи (0, 1, 2...). Условие сводилось к `0 === null` →
        // false, и все примеры сохранялись с translation_uk: null, хотя
        // украинские переводы примеров в Lexin есть.
        //
        // Подтверждено на статье 402 ("bestå" = складатися):
        //   E-eks #0 "delegasjonen består av elleve mann"
        //     ← Ukr-eks index=0 "делегація складається з одинадцяти осіб"
        //   E-eks #1 "stipendet består i dekning av reisekostnadene"
        //     ← Ukr-eks index=1 "стипендія полягає в оплаті транспортних витрат"
        //   E-eks #2 "skulpturen består av to tredeler plast"
        //     ← Ukr-eks index=2 "скульптура складається на дві третини з пластмаси"
        //
        // ВАЖНО: сами Ukr-eks приходят в массиве в порядке 0, 2, 1 — искать
        // нужно ПО ЗНАЧЕНИЮ index, а не по позиции в массиве Ukr-eks.
        // Стратегия как в expression mode: точное совпадение index сначала
        // (на случай, если Lexin где-то его всё же проставляет), порядковый
        // номер — как fallback.
        const ukrEksEntries = entriesOfType(bucket, 'Ukr-eks');
        const eEksEntries = entriesOfType(bucket, 'E-eks', 'N-eks');

        for (let eksIdx = 0; eksIdx < eEksEntries.length; eksIdx++) {
          const e = eEksEntries[eksIdx];
          // Пустые записи отсеиваются ПОСЛЕ вычисления eksIdx — нумерация
          // Lexin идёт по всем E-eks подряд, пропуск сдвинул бы соответствие.
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

        // English examples (B-eks) — iterate directly, NOT matched by index
        // (all have index: null, positional matching is unreliable)
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

    // ФИКС: ранжирование и дедупликация ПО СМЫСЛУ (source_entry_id), не по
    // всему слову. Ключ группировки — language:type:entryId — значит
    // "pass" из entry 47750 и "складатися, полягати" из entry 402 НЕ
    // конкурируют друг с другом за rank и НЕ считаются дублями разных
    // смыслов. Верхний предел на количество РАЗНЫХ entry/смыслов
    // отсутствует намеренно — хранится всё, что реально пришло от Lexin
    // (после exact-match фильтра выше); выбор "какой смысл главный" для
    // lexemes.translation_ua — задача promotion-слоя (sync_lexeme_
    // translation_columns), не parser'а.
    const seenPerEntry = new Map<string, Set<string>>();
    const rankPerEntry = new Map<string, number>();

    for (const t of translations) {
      if (t.translation_rank !== 0) continue;

      const entryKey = `${t.language_code}:${t.translation_type}:${t.source_entry_id ?? 'null'}`;
      if (!seenPerEntry.has(entryKey)) {
        seenPerEntry.set(entryKey, new Set());
        rankPerEntry.set(entryKey, 0);
      }

      const dedupKey = (t.translation ?? '').toLowerCase().trim();
      const seen = seenPerEntry.get(entryKey)!;

      if (seen.has(dedupKey)) {
        t.translation_rank = -1; // истинный дубль внутри ОДНОГО смысла
        continue;
      }

      seen.add(dedupKey);
      const rank = (rankPerEntry.get(entryKey) ?? 0) + 1;
      rankPerEntry.set(entryKey, rank);
      t.translation_rank = rank; // без cap
    }

    const dedupedTranslations = translations.filter((t) => t.translation_rank !== -1);

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        lemma,
        root_word: rootWord,
        expression_mode: expressionMode,
        lexeme_id: lexemeId,
        expression_id: expressionId,
        total_entries_in_response: entryBuckets.size,
        requested_pos: expressionMode ? null : requestedPos,
        entries_matched: expressionMode ? null : entriesMatched,
        entries_skipped_no_match: expressionMode ? null : entriesSkippedNoMatch,
        entries_skipped_pos_mismatch: expressionMode ? null : entriesSkippedPosMismatch,
        entries_skipped_unknown_pos: expressionMode ? null : entriesSkippedUnknownPos,
        allow_unknown_pos: expressionMode ? null : allowUnknownPos,
        pos_debug_entries: expressionMode ? null : posDebugEntries,
        matched_entry_ids: [...new Set(matchedEntryIds)],
        idiom_matches: expressionMode ? idiomMatches : null,
        matched_expression: expressionMode ? idiomMatches > 0 : null,
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

    // ФИКС: onConflict теперь включает source_entry_id — так, чтобы
    // одинаковый текст перевода из РАЗНЫХ смыслов не перезаписывал друг
    // друга при upsert. Требует constraint
    // entity_translations_unique_with_entry (см. миграцию) и колонок
    // source_entry_id / source_sub_id на entity_translations.
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

    // После успешного upsert удаляем устаревшие Lexin-строки, которые
    // больше не проходят exact/POS-фильтры. Иначе старые ошибки (например
    // nå=now для verb или virke=wood) остаются в БД навсегда.
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
      root_word: rootWord,
      expression_mode: expressionMode,
      lexeme_id: lexemeId,
      expression_id: expressionId,
      total_entries_in_response: entryBuckets.size,
      requested_pos: expressionMode ? null : requestedPos,
      entries_matched: expressionMode ? null : entriesMatched,
      entries_skipped_no_match: expressionMode ? null : entriesSkippedNoMatch,
      entries_skipped_pos_mismatch: expressionMode ? null : entriesSkippedPosMismatch,
      entries_skipped_unknown_pos: expressionMode ? null : entriesSkippedUnknownPos,
      allow_unknown_pos: expressionMode ? null : allowUnknownPos,
      matched_entry_ids: [...new Set(matchedEntryIds)],
      idiom_matches: expressionMode ? idiomMatches : null,
      matched_expression: expressionMode ? idiomMatches > 0 : null,
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
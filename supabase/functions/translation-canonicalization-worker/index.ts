import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// translation-canonicalization-worker (v4)
//
// Узкая задача: НЕ переводить, НЕ генерировать новые слова, НЕ изменять
// смысл — выбрать один канонический вариант из закрытого списка
// кандидатов, собранного lexin-enrichment-worker'ом для одного смысла
// (source_entry_id) слова.
//
// ФИКС v2 (по замечаниям 11.07.2026):
//
// 1. НЕ перезаписывает entity_translations.translation — это оригинальный
//    текст авторитетного источника (Lexin), уничтожать его нельзя.
//    Результат канонизации пишется в ОТДЕЛЬНЫЕ колонки:
//    canonical_translation (text) и canonicalization_metadata (jsonb).
//
// 2. Вместо notes — структурированный canonicalization_metadata:
//    { original: [...], selected: "...", provider: "gemini",
//      reason: "...", method: "ai" | "deterministic_dedup" }.
//
// 3. Разбор кандидатов через split(/[;,|]/) — Lexin использует все три
//    разделителя в разных полях, split(',') пропускал бы часть вариантов.
//
// 4. Детерминированная нормализация ПЕРЕД обращением к AI (реализация
//    идеи "translation-normalization-worker" — split + dedup + trim как
//    отдельный, чисто программный шаг). Если после дедупа по
//    нормализованному тексту остался ОДИН уникальный кандидат
//    (например "працювати, працювати" → "працювати") — Gemini вообще не
//    вызывается, canonical_translation проставляется напрямую. AI
//    привлекается только для ДЕЙСТВИТЕЛЬНО неоднозначных случаев (когда
//    после дедупа кандидатов ≥ 2).
//
// 5. Модели передаётся не только english_gloss, но и norwegian_definition
//    (entity_definitions, language_code='nb', тот же source_entry_id) —
//    он однозначнее отличает "діяти" от "працювати", чем общий "work".
//
// 6. BATCH_SIZE снижен до 10 — при 15 крупных items в одном JSON-массиве
//    Gemini иногда пропускала ref в ответе.
//
// 7. Модель обязана вернуть "reason" вместе с "selected" — для будущего
//    анализа качества выбора.
// ФИКС v3 (11.07.2026):
//
// 8. Строки с canonicalization_metadata.status='needs_review' больше не
//    отправляются в Gemini повторно при каждом обычном запуске. Повторная
//    попытка возможна только через force_recanonicalize=true.
//
// 9. Для english_gloss используется canonical_translation, если английская
//    строка уже была канонизирована; иначе используется исходный translation.
//
// 10. Финальный ok теперь равен errors.length === 0, поэтому оркестратор не
//     считает частично упавший запуск успешным.
// ФИКС v4 (11.07.2026):
//
// 11. Обновлён только Gemini prompt. Остальная рабочая логика worker
//     сохранена без изменений.
//
// 12. Norwegian definition закреплён как основной семантический сигнал,
//     English gloss используется только как вспомогательный контекст.
//
// 13. Добавлена политика выбора несовершенного украинского инфинитива,
//     когда совершенный и несовершенный виды выражают один смысл.
//
// 14. Поле reason ограничено фиксированным набором значений для аудита.
// ============================================================================

const AI_PROVIDER = 'gemini';
const BATCH_SIZE = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function normalizeForCompare(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Regex-литералы с тройным backtick собраны через new RegExp(...), а не
// через /```.../ синтаксис — так проще для tooling, парсящего исходники
// текстовым способом (backtick внутри "/.../" сбивает наивные парсеры).
const CODE_FENCE_START_RE = new RegExp('^```json\\s*', 'i');
const CODE_FENCE_START_PLAIN_RE = new RegExp('^```\\s*', 'i');
const CODE_FENCE_END_RE = new RegExp('```$', 'i');

function parseJsonFromText(text: string): any {
  const cleaned = text
    .replace(CODE_FENCE_START_RE, '')
    .replace(CODE_FENCE_START_PLAIN_RE, '')
    .replace(CODE_FENCE_END_RE, '')
    .trim();

  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');

  if (arrStart !== -1 && arrEnd !== -1 && (objStart === -1 || arrStart < objStart)) {
    return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
  }
  if (objStart === -1 || objEnd === -1) {
    throw new Error(`AI returned non-JSON: ${text.slice(0, 500)}`);
  }
  return JSON.parse(cleaned.slice(objStart, objEnd + 1));
}

function extractGeminiText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
  );
}

// ----------------------------------------------------------------------------
// ФИКС v3 (11.07.2026 — найдено на "здати здавати скласти", "позначити
// помітити", "погладити проводити провести вести" и т.п.): Lexin иногда
// даёт НЕСКОЛЬКО самостоятельных інфінітивів через ПРОБЕЛ внутри одного
// comma/semicolon-разделённого сегмента, без явного разделителя между
// ними (напр. сырое поле "здати здавати скласти, складати" даёт после
// split(',') сегмент "здати здавати скласти", который сам по себе — три
// отдельные форми одного дієслова, а не одна фраза). Это не задача AI —
// это недоразобранная структура самого Lexin-поля.
//
// Разбиваем такой сегмент по пробелу, но ТОЛЬКО если ВСЕ получившиеся
// токены оканчиваются на "ти"/"тись"/"тися" — это надёжный сигнал списка
// інфінітивів, а не одной многословной фразы. Так "давати пас" (где
// "пас" — не інфінітив) корректно остаётся одной фразой, а "здати
// здавати скласти" разбивается на три отдельных кандидата.
// ----------------------------------------------------------------------------
function splitInfinitiveList(token: string): string[] {
  const parts = token.trim().split(/\s+/).filter(Boolean);
  const looksLikeInfinitive = (t: string) => /(тись|тися|ти)$/i.test(t);
  if (parts.length >= 2 && parts.every(looksLikeInfinitive)) {
    return parts;
  }
  return [token];
}

// ----------------------------------------------------------------------------
// ФИКС п.3: split по всем разделителям, которые реально встречаются у
// Lexin (";", ",", "|"), не только по запятой. Плюс дополнительный проход
// splitInfinitiveList на каждом получившемся сегменте (см. выше).
// ФИКС п.4: дедуп по нормализованному тексту — чисто программный шаг,
// без AI. Возвращает уникальные кандидаты в исходном порядке появления.
// ----------------------------------------------------------------------------
function splitAndDedupeCandidates(rawTranslation: string): { original: string[]; deduped: string[] } {
  const commaSplit = rawTranslation
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const original: string[] = [];
  for (const segment of commaSplit) {
    original.push(...splitInfinitiveList(segment));
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of original) {
    const key = normalizeForCompare(c);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return { original, deduped };
}

// ----------------------------------------------------------------------------
// Кандидаты на канонизацию.
// ----------------------------------------------------------------------------
type CanonCandidate = {
  translationId: string;
  lexemeId: string | null;
  lexemeLemma: string;
  lexemePos: string | null;
  sourceEntryId: number | null;
  languageCode: 'uk' | 'en';
  originalCandidates: string[]; // до дедупа — сохраняется в metadata.original
  candidates: string[]; // после дедупа — то, из чего реально выбирает AI
  englishGloss: string | null;
  norwegianDefinition: string | null;
};

async function findCanonCandidates(
  supabase: any,
  lexemeIds: string[],
  forceRecanonicalize: boolean,
): Promise<{ deterministic: CanonCandidate[]; needsAi: CanonCandidate[] }> {
  // Загружаем ВСЕ Lexin-переводы для выбранных лексем, чтобы английский
  // gloss был доступен даже тогда, когда EN-строка уже канонизирована.
  const { data: allRows, error } = await supabase
    .from('entity_translations')
    .select(
      'id, lexeme_id, source_entry_id, language_code, translation, translation_type, source, canonical_translation, canonicalization_metadata',
    )
    .in('lexeme_id', lexemeIds)
    .eq('source', 'lexin')
    .in('language_code', ['uk', 'en'])
    .in('translation_type', ['primary', 'expression_primary'])
    .eq('translation_rank', 1);

  const rows = (allRows ?? []).filter((r: any) => {
    if (forceRecanonicalize) return true;

    const reviewStatus =
      r.canonicalization_metadata?.status ??
      null;

    return (
      r.canonical_translation == null &&
      reviewStatus !== 'needs_review'
    );
  });

  if (error) throw new Error(error.message);

  const lexemeMeta = new Map<string, { lemma: string; pos: string | null }>();
  const { data: lexemes, error: lexError } = await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .in('id', lexemeIds);
  if (lexError) throw new Error(lexError.message);
  for (const l of lexemes ?? []) lexemeMeta.set(l.id, { lemma: l.lemma, pos: l.pos ?? null });

  // ФИКС п.5: norwegian_definition — из entity_definitions (nb), тот же
  // (lexeme_id, source_entry_id). Более точный контекст для выбора, чем
  // только english_gloss.
  const { data: nbDefs, error: nbError } = await supabase
    .from('entity_definitions')
    .select('lexeme_id, source_entry_id, definition')
    .in('lexeme_id', lexemeIds)
    .eq('language_code', 'nb')
    .eq('source', 'lexin');
  if (nbError) throw new Error(nbError.message);

  const entryKey = (lexemeId: string | null, entryId: number | null) =>
    `${lexemeId ?? 'null'}:${entryId ?? 'null'}`;

  const nbDefMap = new Map<string, string>();
  for (const d of nbDefs ?? []) {
    const key = entryKey(d.lexeme_id, d.source_entry_id);
    if (!nbDefMap.has(key)) nbDefMap.set(key, d.definition);
  }

  const glossMap = new Map<string, string>();
  for (const r of allRows ?? []) {
    if (r.language_code !== 'en') continue;

    const englishGloss =
      String(r.canonical_translation ?? '').trim() ||
      String(r.translation ?? '').trim();

    if (!englishGloss) continue;

    glossMap.set(
      entryKey(r.lexeme_id, r.source_entry_id),
      englishGloss,
    );
  }

  const deterministic: CanonCandidate[] = [];
  const needsAi: CanonCandidate[] = [];

  for (const r of rows ?? []) {
    const { original, deduped } = splitAndDedupeCandidates(r.translation);
    if (deduped.length === 0) continue;

    const meta = lexemeMeta.get(r.lexeme_id);
    const candidate: CanonCandidate = {
      translationId: r.id,
      lexemeId: r.lexeme_id,
      lexemeLemma: meta?.lemma ?? '',
      lexemePos: meta?.pos ?? null,
      sourceEntryId: r.source_entry_id,
      languageCode: r.language_code,
      originalCandidates: original,
      candidates: deduped,
      englishGloss:
        r.language_code === 'uk' ? glossMap.get(entryKey(r.lexeme_id, r.source_entry_id)) ?? null : null,
      norwegianDefinition: nbDefMap.get(entryKey(r.lexeme_id, r.source_entry_id)) ?? null,
    };

    // ФИКС п.4: единственный уникальный кандидат после дедупа — не нужен
    // AI, canonical_translation проставляется детерминированно.
    if (deduped.length === 1) {
      deterministic.push(candidate);
    } else {
      needsAi.push(candidate);
    }
  }

  return { deterministic, needsAi };
}

// ----------------------------------------------------------------------------
// Batch call — SELECTION, не GENERATION.
// ----------------------------------------------------------------------------
type BatchInputItem = {
  ref: number;
  lemma: string;
  pos: string | null;
  language_code: string;
  candidates: string[];
  english_gloss: string | null;
  norwegian_definition: string | null;
};

type BatchOutputItem = {
  ref: number;
  selected?: string | null;
  reason?: string | null;
};

async function callGeminiCanonicalizeBatch(items: BatchInputItem[]): Promise<Map<number, BatchOutputItem>> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const inputJson = JSON.stringify(items, null, 2);

  const prompt = `
You are selecting the canonical learner-dictionary translation from a CLOSED
list of authoritative candidates.

You are NOT translating.
You are NOT generating new wording.
You are NOT correcting spelling.
You are selecting EXACTLY ONE existing candidate, or null.

======================================================================
GOAL
======================================================================

Select the single candidate that would most naturally appear as the primary
headword translation in a learner's dictionary.

Do not choose merely the most literal English equivalent. Choose the candidate
that best represents the specific Norwegian dictionary sense.

======================================================================
INPUT
======================================================================

Each item contains:

- "lemma": Norwegian lemma
- "pos": part of speech
- "language_code": language of the candidate list
- "candidates": closed list of allowed words or phrases
- "english_gloss": supporting English gloss, when available
- "norwegian_definition": Bokmål definition of this exact dictionary sense,
  when available

All candidates come from an authoritative lexical source.

======================================================================
DECISION PRIORITY
======================================================================

Use this order of priority:

1. Match the specific Norwegian definition.
2. Match the correct grammatical and semantic function.
3. Prefer the conventional learner-dictionary headword.
4. Prefer the most common, neutral, productive candidate.
5. Use the English gloss only as supporting context.

The Norwegian definition is the PRIMARY semantic signal.

If the Norwegian definition and English gloss suggest different
interpretations, follow the Norwegian definition.

======================================================================
LANGUAGE-SPECIFIC POLICY
======================================================================

For Ukrainian verb candidates:

- When perfective and imperfective infinitives express the same lexical
  meaning, normally prefer the imperfective infinitive as the learner-facing
  dictionary form.
- Use the perfective infinitive only when the Norwegian definition clearly
  describes a completed, bounded, one-time action.
- Do not choose a semantically broader but less accurate verb merely because
  it is a more literal match for the English gloss.

Examples of aspect preference when the lexical meaning is the same:

досягти / досягати
→ prefer "досягати"

добратися / добиратися
→ prefer "добиратися"

дістати / діставати
→ prefer "діставати"

знайти / знаходити
→ prefer "знаходити"

стати / ставати
→ prefer "ставати"

Examples of semantic disambiguation:

Norwegian definition:
"få fatt i" or "rekke"

Prefer:
"діставати"

Avoid:
"досягати"

when both are candidates.

Norwegian definition:
"komme fram til"

Prefer:
"добиратися"

Avoid:
"досягати"

when both are candidates and the sense is arrival at a place or point.

Norwegian definition:
"virke som"

Prefer:
"здаватися"

Avoid:
"виглядати"

unless the definition explicitly concerns visible appearance.

Norwegian definition:
"bli kjent med"

Prefer:
"знайомитися"

Avoid:
"пізнавати"

when both are candidates.

For English candidates:

- Prefer the broad, neutral dictionary headword that matches the Norwegian
  definition.
- Avoid a narrower phrase when a standard single-word headword expresses the
  same sense more naturally.
- Do not merge multiple English candidates.

======================================================================
GENERAL SELECTION RULES
======================================================================

- Choose EXACTLY ONE candidate.
- Never merge candidates.
- Never rewrite a candidate.
- Never alter punctuation.
- Never invent a synonym.
- Never return a value outside the supplied "candidates" array.
- Do not automatically choose the shortest candidate.
- Do not automatically choose the first candidate.
- Avoid literary, archaic, overly formal, or rare candidates when a common
  neutral learner-dictionary equivalent exists.
- If no candidate clearly matches the specific Norwegian sense, return null.

======================================================================
VALIDATION
======================================================================

"selected" MUST be copied EXACTLY, character for character, from the
corresponding item's "candidates" array, or be null.

Return the same numeric "ref" value unchanged.

For "reason", use EXACTLY ONE of these values:

- "semantic_match"
- "imperfective_preferred"
- "common_headword"
- "broader_headword"
- "dictionary_convention"
- "no_clear_match"

Use "no_clear_match" whenever "selected" is null.

======================================================================
INPUT ITEMS
======================================================================

${inputJson}

======================================================================
OUTPUT
======================================================================

Return ONLY a valid JSON array, with exactly one object per input item:

[
  {
    "ref": <same numeric ref as input>,
    "selected": "<exact candidate or null>",
    "reason": "<one allowed reason value>"
  }
]
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini batch HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const parsed = parseJsonFromText(extractGeminiText(data));
  if (!Array.isArray(parsed)) {
    throw new Error(`Gemini batch response is not a JSON array: ${JSON.stringify(parsed).slice(0, 300)}`);
  }

  const byRef = new Map<number, BatchOutputItem>();
  for (const entry of parsed) {
    if (entry && typeof entry.ref === 'number') byRef.set(entry.ref, entry as BatchOutputItem);
  }
  return byRef;
}

async function writeCanonicalResult(
  supabase: any,
  translationId: string,
  selected: string | null,
  metadata: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('entity_translations')
    .update({
      canonical_translation: selected,
      canonicalization_metadata: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', translationId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));
    const lexemeIds: string[] = Array.isArray(body.lexeme_ids) ? body.lexeme_ids.map(String) : [];
    const dryRun = body.dry_run !== false;
    const forceRecanonicalize = Boolean(body.force_recanonicalize ?? false);

    if (lexemeIds.length === 0) {
      return jsonResponse({ ok: false, error: 'lexeme_ids (array) is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { deterministic, needsAi } = await findCanonCandidates(supabase, lexemeIds, forceRecanonicalize);

    if (deterministic.length === 0 && needsAi.length === 0) {
      return jsonResponse({
        ok: true,
        dry_run: dryRun,
        deterministic_count: 0,
        needs_ai_count: 0,
        processed: [],
        errors: [],
        note: 'Nothing to canonicalize for these lexemes.',
      });
    }

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        force_recanonicalize: forceRecanonicalize,
        deterministic_count: deterministic.length,
        needs_ai_count: needsAi.length,
        deterministic: deterministic.map((c) => ({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          language_code: c.languageCode,
          original: c.originalCandidates,
          would_select: c.candidates[0],
          method: 'deterministic_dedup',
        })),
        needs_ai: needsAi.map((c) => ({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          pos: c.lexemePos,
          source_entry_id: c.sourceEntryId,
          language_code: c.languageCode,
          original: c.originalCandidates,
          candidates: c.candidates,
          english_gloss: c.englishGloss,
          norwegian_definition: c.norwegianDefinition,
        })),
      });
    }

    const processed: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];

    // ── Детерминированные (без AI) ──────────────────────────────────────
    for (const c of deterministic) {
      const metadata = {
        original: c.originalCandidates,
        selected: c.candidates[0],
        provider: null,
        reason: 'only one distinct candidate after dedup',
        method: 'deterministic_dedup',
      };
      const result = await writeCanonicalResult(supabase, c.translationId, c.candidates[0], metadata);
      if (result.ok) {
        processed.push({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          status: 'canonicalized',
          method: 'deterministic_dedup',
          selected: c.candidates[0],
        });
      } else {
        errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
      }
    }

    // ── Требуют AI ───────────────────────────────────────────────────────
    for (let i = 0; i < needsAi.length; i += BATCH_SIZE) {
      const chunk = needsAi.slice(i, i + BATCH_SIZE);
      const batchInput: BatchInputItem[] = chunk.map((c, idx) => ({
        ref: idx,
        lemma: c.lexemeLemma,
        pos: c.lexemePos,
        language_code: c.languageCode,
        candidates: c.candidates,
        english_gloss: c.englishGloss,
        norwegian_definition: c.norwegianDefinition,
      }));

      let byRef: Map<number, BatchOutputItem>;
      try {
        byRef = await callGeminiCanonicalizeBatch(batchInput);
      } catch (batchError) {
        for (const c of chunk) {
          errors.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            error: `batch_call_failed: ${safeStringify(batchError)}`,
          });
        }
        continue;
      }

      for (let idx = 0; idx < chunk.length; idx++) {
        const c = chunk[idx];
        const ai = byRef.get(idx);

        if (!ai || ai.selected == null) {
          const reviewReason = !ai ? 'missing_in_batch_response' : ai.reason ?? 'model_returned_null';
          const metadata = {
            original: c.originalCandidates,
            selected: null,
            provider: AI_PROVIDER,
            reason: reviewReason,
            method: 'needs_review',
            status: 'needs_review',
          };
          const result = await writeCanonicalResult(supabase, c.translationId, null, metadata);
          if (!result.ok) {
            errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          }
          processed.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            candidates: c.candidates,
            status: 'needs_review',
            reason: reviewReason,
          });
          continue;
        }

        // Критическая серверная проверка — ответ модели должен ДОСЛОВНО
        // (после нормализации регистра/пробелов) совпадать с одним из
        // исходных candidates. Если нет — needs_review, ничего не
        // применяется.
        const normalizedSelected = normalizeForCompare(ai.selected);
        const matchedCandidate = c.candidates.find(
          (cand) => normalizeForCompare(cand) === normalizedSelected,
        );

        if (!matchedCandidate) {
          const metadata = {
            original: c.originalCandidates,
            selected: null,
            provider: AI_PROVIDER,
            reason: 'model_returned_value_outside_candidate_list',
            method: 'needs_review',
            status: 'needs_review',
            model_returned: ai.selected,
          };
          const result = await writeCanonicalResult(supabase, c.translationId, null, metadata);
          if (!result.ok) {
            errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          }
          processed.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            candidates: c.candidates,
            status: 'needs_review',
            reason: 'model_returned_value_outside_candidate_list',
            model_returned: ai.selected,
          });
          continue;
        }

        const metadata = {
          original: c.originalCandidates,
          selected: matchedCandidate,
          provider: AI_PROVIDER,
          reason: ai.reason ?? null,
          method: 'ai',
        };

        const result = await writeCanonicalResult(supabase, c.translationId, matchedCandidate, metadata);
        if (!result.ok) {
          errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          continue;
        }

        processed.push({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          source_entry_id: c.sourceEntryId,
          language_code: c.languageCode,
          candidates: c.candidates,
          status: 'canonicalized',
          method: 'ai',
          selected: matchedCandidate,
          reason: ai.reason ?? null,
        });
      }
    }

    return jsonResponse({
      ok: errors.length === 0,
      dry_run: false,
      ai_provider: AI_PROVIDER,
      force_recanonicalize: forceRecanonicalize,
      deterministic_count: deterministic.length,
      needs_ai_count: needsAi.length,
      canonicalized_count: processed.filter((p) => p.status === 'canonicalized').length,
      needs_review_count: processed.filter((p) => p.status === 'needs_review').length,
      error_count: errors.length,
      processed,
      errors,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});
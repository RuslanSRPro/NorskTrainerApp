import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// ai-enrichment-worker (v6 — + per-kind MAX_TRANSLATION_VARIANTS)
//
// ФИКС (onConflict, 15.07.2026): entity_translations_unique был удалён в
// сессии 11.07.2026 (замена на entity_translations_unique_with_entry, см.
// session_handoff п.12.2.3) — новый индекс включает source_entry_id (7
// колонок), старый onConflict в этом воркере указывал 6 колонок без него.
// Postgres требует ТОЧНОГО совпадения набора колонок с существующим
// уникальным индексом — при несовпадении upsert падает с 42P10 "there is
// no unique or exclusion constraint matching the ON CONFLICT specification".
//
// Последствие было хуже, чем "не пишет": writeTranslations сначала
// удаляет старые AI-строки (delete), и только потом пытается вставить
// новые (upsert). Delete проходил, upsert падал — то есть КАЖДЫЙ вызов
// этого воркера с 11.07.2026 удалял существующие AI-переводы и не мог
// записать новые взамен. Ошибка не терялась молча (writeErrors
// записывается в write_errors), но job-enrichment-batch-worker считает
// успех по processed_count и внутрь write_errors не заглядывает — то
// есть цепочка выше видела "success", хотя данные были потеряны.
//
// Подтверждено: entity_translations_unique_with_entry имеет
// NULLS NOT DISTINCT — это и делает исправленный onConflict рабочим для
// AI-записей, у которых source_entry_id всегда null (AI не относится к
// конкретной словарной статье): без NULLS NOT DISTINCT такие строки
// никогда бы не считались конфликтующими друг с другом.
//
// ФИКС (ref integrity, 15.07.2026): сопоставление ответа батч-запроса
// Gemini с исходными кандидатами шло по числовому полю "ref", которое
// ДОЛЖНА была дословно скопировать модель. Ничем, кроме этого числа, оно
// не подтверждалось — в выходной JSON-схеме не было леммы, и сверить
// "ai" с "p.candidate" было невозможно. Один сдвиг нумерации у модели на
// одном элементе батча — и весь хвост записывается на чужие лексемы.
// Ровно та же архитектурная ошибка ("доверие внешнему источнику в
// вопросе идентичности без проверки"), которая привела к порче
// Lexin-переводов через fuzzy-подмес (см. lexin-enrichment-worker v4).
//
// Фикс: "lemma" добавлена в выходную JSON-схему батча; перед записью
// ответ сверяется с леммой исходного кандидата (normalizeKey). При
// несовпадении — элемент НЕ записывается, идёт в errors с явной причиной
// "ref_lemma_mismatch"; повторный батч-запрос не делается, элемент
// просто теряется на этом проходе и будет подхвачен следующим
// job-completion-auditor.heal (как и любой другой "not fully processed"
// кандидат). Также убрана фраза промпта "return your best guess, even if
// uncertain" — она поощряла модель заполнять все слоты вместо честного
// null/[], что косвенно повышало риск скрытого сдвига нумерации.
//
// ФИКС (NAOB-context + POS-mismatch guard, 15.08.2026): найдено на живых
// данных (batch job 13ae6d23, 15.08.2026) — AI-переводчик получал только
// голое "POS: noun/verb/..." в промпте, без самого текста словарной
// статьи, хотя для большинства кандидатов эта статья УЖЕ была добыта и
// закеширована на более ранней стадии (verification_evidence.NAOB.
// evidence.raw_preview). Модель, не имея доступа к этому кешу, либо (а)
// дословно копировала перевод соседнего POS того же слова ("blande" noun
// → "змішувати", хотя это перевод глагола), либо (б) выдавала
// грамматически невозможный ответ (EN "to mix" как перевод
// существительного), либо (в) в редких случаях путала лемму с другим
// словом целиком ("hende" adjective → "almost", хотя NAOB даёт "sjelden"/
// "рідкісний"). Пример blande/noun: NAOB реально даёт отдельное
// substantiv-значение ("blandingsdrikk... sur melk eller myse blandet
// med vann"), но AI его не увидел и вместо этого продублировал глагол.
//
// Фикс двухчастный:
// (1) extractNaobRawPreview() достаёт закешированный NAOB-текст из
//     verification_evidence и прокидывается в промпт как
//     authoritative_dictionary_context — модели больше не нужно
//     "гадать с нуля", когда ответ уже есть в её собственном контексте.
// (2) looksLikeWrongPos() — грубый пост-фильтр перед записью: для
//     pos IN (noun, adjective, adverb) отклоняет перевод, который
//     грамматически выглядит как глагол (EN начинается на "to ", UA
//     заканчивается на характерный глагольный суффикс без пробела внутри
//     фразы). При срабатывании перевод НЕ пишется в entity_translations,
//     кандидат помечается needs_review с причиной pos_mismatch, и это
//     видно в processed/errors ответа воркера без необходимости искать
//     проблему вручную через SQL.
//
// Оба фикса — эвристики, не гарантия: (1) снижает вероятность ошибки на
// входе, (2) ловит часть оставшихся случаев на выходе. Ни один не ловит
// смысловую (не грамматическую) ошибку внутри правильного POS — за это
// по-прежнему отвечает выборочная ручная/NAOB-проверка.
//
// ФИКС (Lexin-context, 15.08.2026): та же логика из фикса выше расширена
// на Lexin — verification_evidence хранит Lexin.evidence.raw_preview рядом
// с NAOB.evidence.raw_preview под тем же корневым объектом (проверено на
// живых данных: blande/doble/fryse/hakke/hende/koke — у всех оба ключа
// присутствуют одновременно). Раньше воркер читал только NAOB, хотя Lexin
// часто даёт более прямой сигнал: JSON с явными типами узлов ("E-def" =
// definition, "E-lem" = отдельная словарная статья — разные "id" на одну
// лемму означают явную POS-омонимию, без необходимости парсить
// человекочитаемый норвежский текст, как у NAOB). Пример: для "koke"(noun)
// Lexin дал "et kar til å koke mat i" (посудина для варіння) — значение,
// которое NAOB тоже упоминает, но менее чётко ("porsjon som kokes på én
// gang"). extractLexinRawPreview()/buildDictionaryContext() добавлены
// симметрично NAOB-версии; оба источника, если есть, передаются в промпт
// одним блоком с явными заголовками [NAOB]/[Lexin], чтобы модель не путала
// формат (связный текст vs сырой JSON). ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ: raw_preview
// Lexin в source_lookup_cache обрублен ДО того, как попадает в
// verification_evidence — для лемм с 3+ омонимичными статьями (напр.
// "hakke") в обрезанном тексте может не остаться данных по третьей статье.
// Не устраняется этим патчем — требует либо увеличения лимита сохраняемого
// текста в исходном lexical-worker, либо отдельного повторного запроса к
// Lexin API при необходимости полного текста.
//
// ФИКС (per-kind MAX_TRANSLATION_VARIANTS, 15.08.2026): найдено при
// разборе стоимости (job 13ae6d23, 15.08.2026) — expression_ai_fallback
// даёт ~84% всех AI-вызовов на переводы выражений (Lexin почти не
// покрывает идиомы), и это основная статья расхода на весь пайплайн.
// В отличие от многозначных отдельных слов, идиомы почти всегда имеют
// ОДНО естественное значение — второй вариант перевода редко несёт
// реальную пользу учащемуся, но всё равно генерируется и оплачивается.
// max_variants теперь per-item (1 для expression, 2 для lexeme, см.
// maxVariantsFor()) — короче ответ на самой массовой категории вызовов,
// без потери реальной пользы. cleanList() и промпты (single+batch)
// теперь принимают лимит параметром/полем, а не берут из общей константы.
// ============================================================================

const AI_SOURCE = 'ai_fallback';
const AI_PROVIDER = 'gemini';

const NON_AUTHORITATIVE_SOURCES = ['ai_fallback', 'ai_candidate', 'ai analyzer'];
const ELIGIBLE_VERIFICATION_STATUSES = ['authoritative', 'usage_verified', 'multi_source', 'candidate'];

// Максимальная длина NAOB raw_preview, которую вставляем в промпт — сам
// raw_preview может доходить до ~1500 символов HTML-подобного текста с
// футером сайта в конце (копирайт, cookies и т.п.), это не несёт
// смысловой ценности и просто раздувает промпт/costs. Обрезаем по
// разумной границе, оставляя начало (там всегда сама словарная статья).
const NAOB_CONTEXT_MAX_CHARS = 600;

// Сколько кандидатов уходит в ОДИН запрос к Gemini. Компромисс: больше —
// меньше оверхеда на слово, но крупнее единая точка отказа (если весь
// batch-запрос упадёт или вернёт невалидный JSON — теряется весь пакет,
// а не одно слово) и длиннее сам промпт/ответ.
//
// ФИКС (07.08.2026): было 10 — поднято до 20, синхронно с
// AI_FALLBACK_BATCH_LIMIT в pipeline-supervisor (оба числа должны
// двигаться вместе — поднятие только одного не даёт эффекта, см.
// комментарий там). Компромисс тот же, просто сдвинутый на один шаг:
// больше items на один Gemini-вызов = дешевле на больших объёмах, но
// крупнее единая точка отказа при сбое всего batch-запроса. 20 — разумный
// следующий шаг, не выше (30-50+), чтобы не рисковать обрезанием
// JSON-массива в ответе Gemini на большом количестве items одновременно.
const BATCH_SIZE = 20;

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

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cleanList(value: unknown, maxVariants: number): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of value) {
    const text = String(item ?? '').trim();
    const key = normalizeKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }

  return out.slice(0, maxVariants);
}

// ФИКС (15.08.2026): достаёт закешированный текст статьи NAOB из
// verification_evidence, добытый на более ранней стадии пайплайна
// (authoritative / authoritative_ai_fallback), чтобы передать его AI
// как ground truth вместо перевода "с нуля". Формат verification_evidence
// — { NAOB: { evidence: { raw_preview: string, ... } }, Lexin: {...}, ... }
// (см. lexemes.verification_evidence / expression_catalog.verification_evidence).
// Namespace нечувствителен к регистру не проверяется намеренно — поле
// заполняется только текущим пайплайном, ключи стабильны.
function extractNaobRawPreview(verificationEvidence: unknown): string | null {
  try {
    const raw = (verificationEvidence as any)?.NAOB?.evidence?.raw_preview;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed.length > NAOB_CONTEXT_MAX_CHARS
      ? trimmed.slice(0, NAOB_CONTEXT_MAX_CHARS) + '…'
      : trimmed;
  } catch {
    return null;
  }
}

// ФИКС (15.08.2026): симметричный аналог extractNaobRawPreview для Lexin —
// verification_evidence хранит Lexin рядом с NAOB под тем же корнем
// ({ NAOB: {...}, Lexin: {...}, Ordbokene: {...}, ... }). Lexin.evidence.
// raw_preview — это ЧАСТИЧНЫЙ (обрезанный при сохранении в кеш,
// см. source_lookup_cache) сырой JSON ответа Lexin API: массив узлов вида
// {"type":"E-lem"/"E-def"/"E-eks"/"N-eks", "text":"...", "id":..., ...}.
// В отличие от NAOB, тип узла явно размечен машиночитаемо (E-def =
// definition, E-lem = lemma entry — разные "id" на одну лемму означают
// разные словарные статьи, т.е. Lexin тоже фиксирует POS-омонимию, просто
// в структурированном виде, не текстом). ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ: raw_preview
// в кеше обрублен на фиксированной длине ДО того, как это поле сюда
// попадает (лимит стоит в воркере, который наполняет source_lookup_cache,
// не здесь) — для лемм с 2+ омонимичными статьями (напр. "hakke": 3
// разных id) в обрезанном тексте может не остаться данных по второй/
// третьей статье вообще. Не устраняется на этом уровне; если понадобится
// полный текст — нужен отдельный запрос к Lexin API или увеличение лимита
// сохраняемого raw_preview в исходном воркере, не здесь.
function extractLexinRawPreview(verificationEvidence: unknown): string | null {
  try {
    const raw = (verificationEvidence as any)?.Lexin?.evidence?.raw_preview;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed.length > NAOB_CONTEXT_MAX_CHARS
      ? trimmed.slice(0, NAOB_CONTEXT_MAX_CHARS) + '…'
      : trimmed;
  } catch {
    return null;
  }
}

// Собирает единый текстовый блок из обоих источников для промпта — если
// оба присутствуют, они помечены заголовками, чтобы модель не путала их
// (NAOB — связный текст на норвежском, Lexin — сырой JSON с типами узлов).
function buildDictionaryContext(naob: string | null, lexin: string | null): string | null {
  const parts: string[] = [];
  if (naob) parts.push(`[NAOB]\n${naob}`);
  if (lexin) parts.push(`[Lexin, raw JSON — may be truncated, "E-def"/"N-eks" fields hold definitions/examples]\n${lexin}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

// ФИКС (15.08.2026): грубый пост-фильтр на грамматическое согласование
// перевода с заявленным POS. Не претендует на лингвистическую строгость
// (могут быть ложные срабатывания на многословных фразах с "to" внутри,
// например "used to X") — задача не отфильтровать 100% ошибок, а поймать
// самый частый и самый дешёвый в обнаружении класс: глагольный инфинитив,
// записанный как перевод noun/adjective/adverb (см. кейсы blande/koke/
// doble/fryse в job 13ae6d23, 15.08.2026).
function looksLikeWrongPos(pos: string | null, translationsEn: string[], translationsUa: string[]): boolean {
  if (pos !== 'noun' && pos !== 'adjective' && pos !== 'adverb') return false;

  const enLooksLikeVerb = translationsEn.some((t) => /^to\s+\w/i.test(t.trim()));
  const uaLooksLikeVerb = translationsUa.some((t) => {
    const trimmed = t.trim();
    if (trimmed.includes(' ')) return false; // многословные фразы не проверяем этой эвристикой
    return /(ти|тись|тися)$/i.test(trimmed);
  });

  return enLooksLikeVerb || uaLooksLikeVerb;
}

function extractGeminiText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? '')
      .join('') ?? ''
  );
}

function parseJsonFromText(text: string): any {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
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

function isAuthoritative(translationRow: any): boolean {
  const source = String(translationRow?.source ?? '').toLowerCase();
  return !NON_AUTHORITATIVE_SOURCES.includes(source);
}

function isUsableForCompleteness(row: any): boolean {
  const value = String(row?.translation ?? row?.value ?? '').trim();
  return value.length > 0;
}

function pickBestTranslation(translations: any[] | null, languageCode: 'uk' | 'en'): string | null {
  const rows = (translations ?? [])
    .filter((t: any) => t.language_code === languageCode && t.translation?.trim())
    .sort((a: any, b: any) => {
      const priority = (s: string) => {
        const src = String(s ?? '').toLowerCase();
        if (src === 'manual_verified') return 1;
        if (src === 'lexin') return 2;
        if (src === 'ai_fallback') return 3;
        return 9;
      };

      const ap = priority(a.source);
      const bp = priority(b.source);
      if (ap !== bp) return ap - bp;

      return Number(a.translation_rank ?? 999) - Number(b.translation_rank ?? 999);
    });

  return rows[0]?.translation?.trim() ?? null;
}

async function callGeminiSingle(input: {
  lemma: string;
  display_form: string | null;
  pos: string | null;
  missing: string[];
  existing_english_translation: string | null;
  authoritative_dictionary_context: string | null;
  max_variants: number;
}) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  // ФИКС (12.08.2026): дефолт-fallback обновлён на дешёвую модель —
  // gemini-2.5-flash ($0.30/$2.50 за 1M токенов) заметно дороже
  // gemini-2.5-flash-lite ($0.10/$0.40) при сопоставимой пригодности для
  // этой задачи (генерация переводов/примеров, не сложные рассуждения).
  // Реальная модель обычно берётся из переменной окружения GEMINI_MODEL
  // (сейчас выставлена в 'gemini-2.5-flash-lite') — это именно fallback
  // на случай, если секрет почему-то не применится, чтобы откат по
  // умолчанию тоже был на дешёвую модель, а не на дорогую (и тем более
  // не на модель, отключающуюся 16.10.2026).
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';

  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const ukrainianInstruction = input.existing_english_translation
    ? `
For Ukrainian translation:
- Translate from this existing English meaning, not directly from Norwegian:
  "${input.existing_english_translation}"
- Prefer natural learner-dictionary Ukrainian, not literal wording.
- Return AT MOST ${input.max_variants} meanings, ordered from most to least common.
`
    : `
For Ukrainian translation:
- No English meaning is available.
- Translate directly from Norwegian lemma/display form.
- Prefer natural learner-dictionary Ukrainian, not literal wording.
- Return AT MOST ${input.max_variants} meanings, ordered from most to least common.
`;

  const dictionaryContextBlock = input.authoritative_dictionary_context
    ? `
Authoritative dictionary context for this lemma (NAOB and/or Lexin search
results, each labeled), use this as ground truth over your own knowledge.
It may list several senses mixed together for different parts of speech of
the same lemma — extract and translate ONLY the sense that matches POS
"${input.pos ?? 'unknown'}", ignore senses belonging to a different part of
speech. Lexin entries are raw JSON and may be truncated mid-entry:
"""
${input.authoritative_dictionary_context}
"""
`
    : `
No authoritative dictionary context is available for this lemma — rely on
your own knowledge, but stay conservative (see accuracy note above).
`;

  const prompt = `
You are enriching a Norwegian learning dictionary. Accuracy matters more than
coverage: it is better to return one confident meaning than two where the
second is a guess or a rare/literary sense.

Fill ONLY missing fields.
Do not replace existing authoritative data.
Do not invent source claims.
Return ONLY valid JSON.

Norwegian lemma: ${input.lemma}
Display form: ${input.display_form ?? input.lemma}
POS: ${input.pos ?? 'unknown'}
Missing fields: ${input.missing.join(', ')}
Existing English translation, if available: ${input.existing_english_translation ?? 'null'}
${dictionaryContextBlock}
${ukrainianInstruction}

CRITICAL: translation_ua and translation_en MUST be grammatically the same
part of speech as POS "${input.pos ?? 'unknown'}". A noun translation must be
a noun phrase (never an infinitive verb like "to mix"). An adjective/adverb
translation must be an adjective/adverb, not a verb. If you are only
confident about a different sense than the one matching this POS, return
null/[] instead of guessing.

Return JSON:
{
  "translation_ua": ["..."],
  "translation_en": ["..."],
  "example_nb": "...",
  "example_translation_ua": "...",
  "notes_ua": "..."
}

Rules:
- Ukrainian translations: natural learner-dictionary meanings, MAX ${input.max_variants}, most common sense first.
- English translations: natural learner-dictionary meanings, MAX ${input.max_variants}, most common sense first.
- If one meaning fully covers normal usage, return only one translation.
- Norwegian example: simple, correct Bokmål.
- Notes in Ukrainian: one short practical sentence.
- If a field is not missing, still include it as null or [].
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  return parseJsonFromText(extractGeminiText(data));
}

type BatchInputItem = {
  ref: number;
  lemma: string;
  display_form: string | null;
  pos: string | null;
  missing: string[];
  existing_english_translation: string | null;
  authoritative_dictionary_context: string | null;
  max_variants: number;
};

type BatchOutputItem = {
  ref: number;
  lemma?: string | null;
  translation_ua?: string[] | null;
  translation_en?: string[] | null;
  example_nb?: string | null;
  example_translation_ua?: string | null;
  notes_ua?: string | null;
};

async function callGeminiBatch(items: BatchInputItem[]): Promise<Map<number, BatchOutputItem>> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  // ФИКС (12.08.2026): тот же fallback-дефолт на дешёвую модель, что и в
  // callGeminiSingle выше — см. комментарий там.
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';

  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const inputJson = JSON.stringify(
    items.map((it) => ({
      ref: it.ref,
      lemma: it.lemma,
      display_form: it.display_form ?? it.lemma,
      pos: it.pos ?? 'unknown',
      missing: it.missing,
      existing_english_translation: it.existing_english_translation,
      authoritative_dictionary_context: it.authoritative_dictionary_context,
      max_variants: it.max_variants,
    })),
    null,
    2,
  );

  const prompt = `
You are enriching a Norwegian learning dictionary. Accuracy matters more than
coverage: it is better to return one confident meaning than two where the
second is a guess or a rare/literary sense.

Below is a JSON array of Norwegian words/expressions. For EACH item, fill
ONLY the fields listed in its "missing" array. Do not replace existing
authoritative data. Do not invent source claims.

Each item may include "authoritative_dictionary_context" — NAOB and/or Lexin
search results for that lemma, each labeled with its source. Treat it as
ground truth over your own knowledge when present. It may list several
senses mixed together for different parts of speech of the same lemma —
extract and translate ONLY the sense matching that item's own "pos" field,
ignore senses belonging to a different part of speech. Lexin entries are raw
JSON and may be truncated mid-entry. If "authoritative_dictionary_context"
is null, rely on your own knowledge but stay conservative.

CRITICAL: each item's translation_ua/translation_en MUST be grammatically
the same part of speech as that item's own "pos". A noun translation must be
a noun phrase (never an infinitive verb like "to mix"). An adjective/adverb
translation must be an adjective/adverb, not a verb. If you are only
confident about a different sense than the one matching that item's POS,
return null/[] for that item instead of guessing.

For Ukrainian translation of each item:
- If "existing_english_translation" is not null, translate FROM that English
  meaning, not directly from Norwegian.
- If it is null, translate directly from the Norwegian lemma/display_form.
- Prefer natural learner-dictionary Ukrainian, not literal wording.
- Each item has its own "max_variants" field — return AT MOST that many
  meanings for THAT item specifically, most common first. Different items
  may have different limits (e.g. expressions typically allow fewer
  variants than single words) — respect each item's own value, do not use
  one limit for the whole batch.

Input items:
${inputJson}

Return ONLY a valid JSON array, one object per input item. Each output
object MUST include BOTH "ref" and "lemma" copied EXACTLY, unchanged, from
the matching input item — these are used to verify your answers were not
mismatched to the wrong word, so copy them verbatim, do not translate or
normalize "lemma".

If you are not confident about a field, return null or [] for that field
rather than guessing — a missing field is fine, a wrong "ref"/"lemma" pairing
is not.

[
  {
    "ref": <same ref as input>,
    "lemma": "<same lemma as input, verbatim>",
    "translation_ua": ["..."],
    "translation_en": ["..."],
    "example_nb": "...",
    "example_translation_ua": "...",
    "notes_ua": "..."
  }
]

Rules:
- Ukrainian/English translations: natural learner-dictionary meanings, respect each item's own "max_variants" cap, most common sense first.
- If one meaning fully covers normal usage, return only one translation even if max_variants allows more.
- Norwegian example: simple, correct Bokmål.
- Notes in Ukrainian: one short practical sentence.
- If a field was not in that item's "missing" list, still include it as null or [].
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
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
    if (entry && typeof entry.ref === 'number') {
      if (byRef.has(entry.ref)) {
        console.warn(`ai-enrichment-worker: duplicate ref ${entry.ref} in batch response, keeping last`);
      }
      byRef.set(entry.ref, entry as BatchOutputItem);
    }
  }

  return byRef;
}

type EntityKind = 'lexeme' | 'expression';

// ФИКС (15.08.2026): per-kind лимит вариантов перевода — выражения почти
// всегда переводятся однозначно, в отличие от многозначных слов. См.
// комментарий в шапке файла.
const DEFAULT_MAX_TRANSLATION_VARIANTS = 2;
const EXPRESSION_MAX_TRANSLATION_VARIANTS = 1;

function maxVariantsFor(kind: EntityKind): number {
  return kind === 'expression' ? EXPRESSION_MAX_TRANSLATION_VARIANTS : DEFAULT_MAX_TRANSLATION_VARIANTS;
}

type EntityCandidate = {
  kind: EntityKind;
  id: string;
  lexemeId: string | null;
  lemma: string;
  displayForm: string | null;
  pos: string | null;
  notes: string | null;
  verificationStatus: string | null;
  naobContext: string | null;
  lexinContext: string | null;
};

function getOwnKeyColumn(candidate: EntityCandidate): 'lexeme_id' | 'expression_id' {
  return candidate.kind === 'expression' ? 'expression_id' : 'lexeme_id';
}

function buildEntityOrFilter(candidate: EntityCandidate): string {
  const ownKeyColumn = getOwnKeyColumn(candidate);
  const parts = [`${ownKeyColumn}.eq.${candidate.id}`];

  if (candidate.kind === 'expression' && candidate.lexemeId) {
    parts.push(`lexeme_id.eq.${candidate.lexemeId}`);
  }

  return parts.join(',');
}

function applyOwnKeyEq<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  candidate: EntityCandidate,
): T {
  return query.eq(getOwnKeyColumn(candidate), candidate.id);
}

async function writeTranslations(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  params: {
    languageCode: 'uk' | 'en';
    list: string[];
    translationType: 'primary' | 'expression_primary';
    writeLexemeId: string | null;
    writeExpressionId: string | null;
    existingEnglishTranslation: string | null;
  },
): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  let written = 0;

  await applyOwnKeyEq(
    supabase
      .from('entity_translations')
      .delete()
      .eq('language_code', params.languageCode)
      .eq('source', AI_SOURCE)
      .in('translation_type', ['primary', 'expression_primary']),
    candidate,
  );

  let rank = 0;
  for (const translation of params.list) {
    rank++;

    const isUk = params.languageCode === 'uk';
    const { error } = await supabase.from('entity_translations').upsert(
      {
        lexeme_id: params.writeLexemeId,
        expression_id: params.writeExpressionId,
        language_code: params.languageCode,
        translation,
        translation_type: params.translationType,
        translation_rank: rank,
        source: AI_SOURCE,
        confidence: isUk ? (params.existingEnglishTranslation ? 'medium' : 'low') : 'medium',
        notes: isUk
          ? params.existingEnglishTranslation
            ? 'AI fallback: translated Ukrainian from existing English meaning'
            : 'AI fallback: translated Ukrainian directly from Norwegian'
          : 'AI fallback: no authoritative English primary translation found',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          'lexeme_id,expression_id,language_code,translation_type,source,source_entry_id,translation',
      },
    );

    if (!error) written++;
    else errors.push(`${params.languageCode} upsert failed: ${error.message}`);
  }

  return { written, errors };
}

async function writeExample(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  params: {
    exampleNb: string;
    exampleTranslationUa: string | null;
    writeLexemeId: string | null;
    writeExpressionId: string | null;
  },
): Promise<{ written: boolean; error?: string }> {
  await applyOwnKeyEq(
    supabase.from('entity_examples').delete().eq('source', AI_SOURCE),
    candidate,
  );

  const { error } = await supabase.from('entity_examples').upsert(
    {
      lexeme_id: params.writeLexemeId,
      expression_id: params.writeExpressionId,
      language_code: 'nb',
      example_text: params.exampleNb.trim(),
      translation_uk: params.exampleTranslationUa?.trim() ?? null,
      source: AI_SOURCE,
      source_type: 'ai_example',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lexeme_id,expression_id,language_code,source,example_text' },
  );

  return error ? { written: false, error: `example upsert failed: ${error.message}` } : { written: true };
}

async function checkCandidateMissing(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
): Promise<{
  missing: string[];
  needsReview: string[];
  existingEnglishTranslation: string | null;
}> {
  const readFilter = buildEntityOrFilter(candidate);

  const { data: allTranslations } = await supabase
    .from('entity_translations')
    .select('language_code, translation, translation_type, source, translation_rank')
    .or(readFilter)
    .in('translation_type', ['primary', 'expression_primary']);

  const usableTranslations = (allTranslations ?? []).filter(isUsableForCompleteness);
  const hasUsableUk = usableTranslations.some((t: any) => t.language_code === 'uk');
  const hasUsableEn = usableTranslations.some((t: any) => t.language_code === 'en');

  const authoritativeTranslations = (allTranslations ?? []).filter(isAuthoritative);
  const hasAuthoritativeUk = authoritativeTranslations.some((t: any) => t.language_code === 'uk');
  const hasAuthoritativeEn = authoritativeTranslations.some((t: any) => t.language_code === 'en');

  const existingEnglishTranslation = pickBestTranslation(allTranslations, 'en');

  const { data: allExamples } = await supabase
    .from('entity_examples')
    .select('id, source, example_text')
    .or(readFilter)
    .limit(5);

  const hasUsableExample = (allExamples ?? []).some(
    (e: any) => String(e?.example_text ?? '').trim().length > 0,
  );
  const hasAuthoritativeExample = (allExamples ?? []).some(
    (e: any) =>
      String(e?.source ?? '').toLowerCase() !== AI_SOURCE &&
      String(e?.example_text ?? '').trim().length > 0,
  );

  const missing: string[] = [];
  if (!hasUsableUk) missing.push('translation_ua');
  if (!hasUsableEn) missing.push('translation_en');
  if (!hasUsableExample) missing.push('example');
  if (candidate.kind === 'lexeme' && !candidate.notes) missing.push('notes');

  const needsReview: string[] = [];
  if (!hasAuthoritativeUk) needsReview.push('translation_ua');
  if (!hasAuthoritativeEn) needsReview.push('translation_en');
  if (!hasAuthoritativeExample) needsReview.push('example');

  return { missing, needsReview, existingEnglishTranslation };
}

async function writeAiResult(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  missing: string[],
  needsReview: string[],
  existingEnglishTranslation: string | null,
  ai: { translation_ua?: unknown; translation_en?: unknown; example_nb?: unknown; example_translation_ua?: unknown; notes_ua?: unknown },
): Promise<Record<string, unknown>> {
  const translationType = candidate.kind === 'expression' ? 'expression_primary' : 'primary';
  const writeLexemeId = candidate.kind === 'lexeme' ? candidate.id : null;
  const writeExpressionId = candidate.kind === 'expression' ? candidate.id : null;

  let translationsWritten = 0;
  const writeErrors: string[] = [];
  const posMismatchFields: string[] = [];

  const maxVariants = maxVariantsFor(candidate.kind);
  const cleanedUa = cleanList(ai.translation_ua, maxVariants);
  const cleanedEn = cleanList(ai.translation_en, maxVariants);

  // ФИКС (15.08.2026): пост-валидация грамматического согласования с POS
  // ДО записи в базу — см. комментарий у looksLikeWrongPos() выше. Считаем
  // по обоим спискам сразу (UA+EN), потому что несоответствие в одном
  // языке обычно означает, что модель перепутала сам сенс слова, а не
  // просто ошиблась в переводе на один язык.
  const posMismatch = looksLikeWrongPos(candidate.pos, cleanedEn, cleanedUa);

  if (missing.includes('translation_ua')) {
    if (posMismatch) {
      posMismatchFields.push('translation_ua');
    } else {
      const { written, errors } = await writeTranslations(supabase, candidate, {
        languageCode: 'uk',
        list: cleanedUa,
        translationType,
        writeLexemeId,
        writeExpressionId,
        existingEnglishTranslation,
      });
      translationsWritten += written;
      writeErrors.push(...errors);
    }
  }

  if (missing.includes('translation_en')) {
    if (posMismatch) {
      posMismatchFields.push('translation_en');
    } else {
      const { written, errors } = await writeTranslations(supabase, candidate, {
        languageCode: 'en',
        list: cleanedEn,
        translationType,
        writeLexemeId,
        writeExpressionId,
        existingEnglishTranslation,
      });
      translationsWritten += written;
      writeErrors.push(...errors);
    }
  }

  let exampleWritten = false;

  if (missing.includes('example') && ai.example_nb && String(ai.example_nb).trim()) {
    const result = await writeExample(supabase, candidate, {
      exampleNb: String(ai.example_nb),
      exampleTranslationUa: (ai.example_translation_ua as string | null) ?? null,
      writeLexemeId,
      writeExpressionId,
    });
    exampleWritten = result.written;
    if (result.error) writeErrors.push(result.error);
  }

  const updatedFields: string[] = [];

  if (candidate.kind === 'lexeme' && missing.includes('notes') && ai.notes_ua && String(ai.notes_ua).trim()) {
    const { error: notesError } = await supabase
      .from('lexemes')
      .update({ notes: String(ai.notes_ua).trim(), updated_at: new Date().toISOString() })
      .eq('id', candidate.id);

    if (!notesError) updatedFields.push('notes');
    else writeErrors.push(`notes update failed: ${notesError.message}`);
  }

  if (translationsWritten > 0) {
    if (missing.includes('translation_ua') && !posMismatchFields.includes('translation_ua')) updatedFields.push('translation_ua');
    if (missing.includes('translation_en') && !posMismatchFields.includes('translation_en')) updatedFields.push('translation_en');
  }
  if (exampleWritten) updatedFields.push('example');

  const fieldsKey = candidate.kind === 'expression' ? 'updated_expression_fields' : 'updated_lexemes_fields';

  const mergedNeedsReview = posMismatchFields.length > 0
    ? Array.from(new Set([...needsReview, ...posMismatchFields]))
    : needsReview;

  return {
    kind: candidate.kind,
    id: candidate.id,
    lexeme_id: candidate.lexemeId,
    lemma: candidate.lemma,
    verification_status: candidate.verificationStatus,
    missing,
    needs_review: mergedNeedsReview.length > 0,
    needs_review_fields: mergedNeedsReview.length > 0 ? mergedNeedsReview : undefined,
    pos_mismatch_filtered: posMismatchFields.length > 0 ? posMismatchFields : undefined,
    ai_provider: AI_PROVIDER,
    existing_english_translation: existingEnglishTranslation,
    translations_written: translationsWritten,
    example_written: exampleWritten,
    [fieldsKey]: updatedFields,
    write_errors: writeErrors.length ? writeErrors : undefined,
  };
}

async function processCandidatesBatch(
  supabase: ReturnType<typeof createClient>,
  candidates: EntityCandidate[],
  dryRun: boolean,
): Promise<{ processed: Record<string, unknown>[]; errors: Record<string, unknown>[] }> {
  const processed: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];

  type PendingItem = {
    candidate: EntityCandidate;
    missing: string[];
    needsReview: string[];
    existingEnglishTranslation: string | null;
  };

  const pending: PendingItem[] = [];

  for (const candidate of candidates) {
    try {
      const { missing, needsReview, existingEnglishTranslation } = await checkCandidateMissing(supabase, candidate);

      const baseEntry = {
        kind: candidate.kind,
        id: candidate.id,
        lexeme_id: candidate.lexemeId,
        lemma: candidate.lemma,
        verification_status: candidate.verificationStatus,
      };

      if (missing.length === 0) {
        processed.push({
          ...baseEntry,
          skipped: true,
          reason: 'nothing_missing',
          needs_review: needsReview.length > 0,
          needs_review_fields: needsReview.length > 0 ? needsReview : undefined,
        });
        continue;
      }

      if (dryRun) {
        processed.push({
          ...baseEntry,
          missing,
          needs_review: needsReview.length > 0,
          needs_review_fields: needsReview.length > 0 ? needsReview : undefined,
          would_call_ai: true,
          ai_provider: AI_PROVIDER,
          ukrainian_strategy: existingEnglishTranslation ? 'en_to_uk' : 'nb_to_uk',
          existing_english_translation: existingEnglishTranslation,
          has_naob_context: candidate.naobContext != null,
          has_lexin_context: candidate.lexinContext != null,
          max_variants: maxVariantsFor(candidate.kind),
        });
        continue;
      }

      pending.push({ candidate, missing, needsReview, existingEnglishTranslation });
    } catch (rowError) {
      errors.push({
        kind: candidate.kind,
        id: candidate.id,
        lemma: candidate.lemma,
        error: safeStringify(rowError),
      });
    }
  }

  if (dryRun || pending.length === 0) {
    return { processed, errors };
  }

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);

    const batchInput: BatchInputItem[] = chunk.map((p, idx) => ({
      ref: idx,
      lemma: p.candidate.lemma,
      display_form: p.candidate.displayForm ?? p.candidate.lemma,
      pos: p.candidate.pos,
      missing: p.missing,
      existing_english_translation: p.existingEnglishTranslation,
      authoritative_dictionary_context: buildDictionaryContext(p.candidate.naobContext, p.candidate.lexinContext),
      max_variants: maxVariantsFor(p.candidate.kind),
    }));

    let byRef: Map<number, BatchOutputItem>;

    try {
      byRef = await callGeminiBatch(batchInput);
    } catch (batchError) {
      for (const p of chunk) {
        errors.push({
          kind: p.candidate.kind,
          id: p.candidate.id,
          lemma: p.candidate.lemma,
          error: `batch_call_failed: ${safeStringify(batchError)}`,
        });
      }
      continue;
    }

    for (let idx = 0; idx < chunk.length; idx++) {
      const p = chunk[idx];
      const ai = byRef.get(idx);

      if (!ai) {
        errors.push({
          kind: p.candidate.kind,
          id: p.candidate.id,
          lemma: p.candidate.lemma,
          error: 'missing_in_batch_response: Gemini did not return an entry for this ref',
        });
        continue;
      }

      const aiLemma = typeof ai.lemma === 'string' ? normalizeKey(ai.lemma) : null;
      const candidateLemma = normalizeKey(p.candidate.lemma);

      if (aiLemma !== null && aiLemma !== candidateLemma) {
        errors.push({
          kind: p.candidate.kind,
          id: p.candidate.id,
          lemma: p.candidate.lemma,
          error: `ref_lemma_mismatch: expected "${p.candidate.lemma}", got "${ai.lemma}" for ref ${idx} — skipped, not written`,
        });
        continue;
      }

      try {
        const entry = await writeAiResult(supabase, p.candidate, p.missing, p.needsReview, p.existingEnglishTranslation, ai);
        processed.push(entry);

        if (entry.write_errors) {
          errors.push({
            kind: p.candidate.kind,
            id: p.candidate.id,
            lemma: p.candidate.lemma,
            error: 'write_errors present, see processed entry',
          });
        }

        if (entry.pos_mismatch_filtered) {
          errors.push({
            kind: p.candidate.kind,
            id: p.candidate.id,
            lemma: p.candidate.lemma,
            error: `pos_mismatch_filtered: fields ${JSON.stringify(entry.pos_mismatch_filtered)} looked like a different part of speech than "${p.candidate.pos}" — not written, flagged needs_review instead`,
          });
        }
      } catch (writeError) {
        errors.push({
          kind: p.candidate.kind,
          id: p.candidate.id,
          lemma: p.candidate.lemma,
          error: safeStringify(writeError),
        });
      }
    }
  }

  return { processed, errors };
}

async function processSingleCandidate(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  const { missing, needsReview, existingEnglishTranslation } = await checkCandidateMissing(supabase, candidate);

  const baseEntry = {
    kind: candidate.kind,
    id: candidate.id,
    lexeme_id: candidate.lexemeId,
    lemma: candidate.lemma,
    verification_status: candidate.verificationStatus,
  };

  if (missing.length === 0) {
    return {
      ...baseEntry,
      skipped: true,
      reason: 'nothing_missing',
      needs_review: needsReview.length > 0,
      needs_review_fields: needsReview.length > 0 ? needsReview : undefined,
    };
  }

  if (dryRun) {
    return {
      ...baseEntry,
      missing,
      needs_review: needsReview.length > 0,
      needs_review_fields: needsReview.length > 0 ? needsReview : undefined,
      would_call_ai: true,
      ai_provider: AI_PROVIDER,
      ukrainian_strategy: existingEnglishTranslation ? 'en_to_uk' : 'nb_to_uk',
      existing_english_translation: existingEnglishTranslation,
      has_naob_context: candidate.naobContext != null,
      has_lexin_context: candidate.lexinContext != null,
      max_variants: maxVariantsFor(candidate.kind),
    };
  }

  const ai = await callGeminiSingle({
    lemma: candidate.lemma,
    display_form: candidate.displayForm ?? candidate.lemma,
    pos: candidate.pos,
    missing,
    existing_english_translation: existingEnglishTranslation,
    authoritative_dictionary_context: buildDictionaryContext(candidate.naobContext, candidate.lexinContext),
    max_variants: maxVariantsFor(candidate.kind),
  });

  return writeAiResult(supabase, candidate, missing, needsReview, existingEnglishTranslation, ai);
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Number(body.limit ?? 25), 100);
    const dryRun = body.dry_run !== false;

    const lexemeIds: string[] = Array.isArray(body.lexeme_ids) ? body.lexeme_ids.map(String) : [];
    const expressionIds: string[] = Array.isArray(body.expression_ids) ? body.expression_ids.map(String) : [];

    const onlyLexemeId = body.lexeme_id ?? null;
    const onlyExpressionId = body.expression_id ?? null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (lexemeIds.length > 0 || expressionIds.length > 0) {
      const candidates: EntityCandidate[] = [];

      if (lexemeIds.length > 0) {
        const { data, error } = await supabase
          .from('lexemes')
          .select('id, lemma, pos, display_form, notes, verification_status, verification_evidence')
          .in('id', lexemeIds);

        if (error) throw error;

        for (const row of data ?? []) {
          candidates.push({
            kind: 'lexeme',
            id: row.id,
            lexemeId: row.id,
            lemma: row.lemma,
            displayForm: row.display_form ?? null,
            pos: row.pos ?? null,
            notes: row.notes ?? null,
            verificationStatus: row.verification_status ?? null,
            naobContext: extractNaobRawPreview(row.verification_evidence),
            lexinContext: extractLexinRawPreview(row.verification_evidence),
          });
        }
      }

      if (expressionIds.length > 0) {
        const { data, error } = await supabase
          .from('expression_catalog')
          .select('id, lemma, expression_subtype, lexeme_id, verification_status, verification_evidence')
          .in('id', expressionIds);

        if (error) throw error;

        for (const row of data ?? []) {
          candidates.push({
            kind: 'expression',
            id: row.id,
            lexemeId: row.lexeme_id ?? null,
            lemma: row.lemma,
            displayForm: row.lemma,
            pos: 'expression',
            notes: null,
            verificationStatus: row.verification_status ?? null,
            naobContext: extractNaobRawPreview(row.verification_evidence),
            lexinContext: extractLexinRawPreview(row.verification_evidence),
          });
        }
      }

      const { processed, errors } = await processCandidatesBatch(supabase, candidates, dryRun);

      return jsonResponse({
        ok: true,
        mode: 'batch',
        dry_run: dryRun,
        ai_provider: AI_PROVIDER,
        batch_size: BATCH_SIZE,
        default_max_translation_variants: DEFAULT_MAX_TRANSLATION_VARIANTS,
        expression_max_translation_variants: EXPRESSION_MAX_TRANSLATION_VARIANTS,
        candidates_found: candidates.length,
        processed_count: processed.filter((p) => !p.skipped).length,
        skipped_count: processed.filter((p) => p.skipped).length,
        error_count: errors.length,
        processed,
        errors,
      });
    }

    if (onlyLexemeId || onlyExpressionId) {
      let candidate: EntityCandidate | null = null;

      if (onlyLexemeId) {
        const { data, error } = await supabase
          .from('lexemes')
          .select('id, lemma, pos, display_form, notes, verification_status, verification_evidence')
          .eq('id', onlyLexemeId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          candidate = {
            kind: 'lexeme',
            id: data.id,
            lexemeId: data.id,
            lemma: data.lemma,
            displayForm: data.display_form ?? null,
            pos: data.pos ?? null,
            notes: data.notes ?? null,
            verificationStatus: data.verification_status ?? null,
            naobContext: extractNaobRawPreview(data.verification_evidence),
            lexinContext: extractLexinRawPreview(data.verification_evidence),
          };
        }
      } else if (onlyExpressionId) {
        const { data, error } = await supabase
          .from('expression_catalog')
          .select('id, lemma, expression_subtype, lexeme_id, verification_status, verification_evidence')
          .eq('id', onlyExpressionId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          candidate = {
            kind: 'expression',
            id: data.id,
            lexemeId: data.lexeme_id ?? null,
            lemma: data.lemma,
            displayForm: data.lemma,
            pos: 'expression',
            notes: null,
            verificationStatus: data.verification_status ?? null,
            naobContext: extractNaobRawPreview(data.verification_evidence),
            lexinContext: extractLexinRawPreview(data.verification_evidence),
          };
        }
      }

      if (!candidate) {
        return jsonResponse({
          ok: true,
          dry_run: dryRun,
          candidates_found: 0,
          processed_count: 0,
          skipped_count: 0,
          error_count: 0,
          processed: [],
          errors: [],
        });
      }

      const entry = await processSingleCandidate(supabase, candidate, dryRun);

      return jsonResponse({
        ok: true,
        mode: 'single',
        dry_run: dryRun,
        ai_provider: AI_PROVIDER,
        max_translation_variants: maxVariantsFor(candidate.kind),
        candidates_found: 1,
        processed_count: entry.skipped ? 0 : 1,
        skipped_count: entry.skipped ? 1 : 0,
        error_count: entry.write_errors ? 1 : 0,
        processed: [entry],
        errors: entry.write_errors ? [{ kind: candidate.kind, id: candidate.id, lemma: candidate.lemma, error: 'write_errors present' }] : [],
      });
    }

    const shouldRunLexemeLoop = !(onlyExpressionId && !onlyLexemeId);
    const shouldRunExpressionLoop = !(onlyLexemeId && !onlyExpressionId);

    const candidates: EntityCandidate[] = [];

    if (shouldRunLexemeLoop) {
      const { data, error } = await supabase
        .from('lexemes')
        .select('id, lemma, pos, display_form, notes, verification_status, verification_evidence')
        .in('verification_status', ELIGIBLE_VERIFICATION_STATUSES)
        .not('lemma', 'ilike', '%�%')
        .order('updated_at', { ascending: true })
        .limit(limit * 3);

      if (error) throw error;

      for (const row of data ?? []) {
        candidates.push({
          kind: 'lexeme',
          id: row.id,
          lexemeId: row.id,
          lemma: row.lemma,
          displayForm: row.display_form ?? null,
          pos: row.pos ?? null,
          notes: row.notes ?? null,
          verificationStatus: row.verification_status ?? null,
          naobContext: extractNaobRawPreview(row.verification_evidence),
            lexinContext: extractLexinRawPreview(row.verification_evidence),
        });
      }
    }

    if (shouldRunExpressionLoop) {
      const { data, error } = await supabase
        .from('expression_catalog')
        .select('id, lemma, expression_subtype, lexeme_id, verification_status, verification_evidence')
        .in('verification_status', ELIGIBLE_VERIFICATION_STATUSES)
        .not('lemma', 'ilike', '%�%')
        .order('updated_at', { ascending: true })
        .limit(limit * 3);

      if (error) throw error;

      for (const row of data ?? []) {
        candidates.push({
          kind: 'expression',
          id: row.id,
          lexemeId: row.lexeme_id ?? null,
          lemma: row.lemma,
          displayForm: row.lemma,
          pos: 'expression',
          notes: null,
          verificationStatus: row.verification_status ?? null,
          naobContext: extractNaobRawPreview(row.verification_evidence),
            lexinContext: extractLexinRawPreview(row.verification_evidence),
        });
      }
    }

    const limited = candidates.slice(0, limit);

    const { processed, errors } = await processCandidatesBatch(supabase, limited, dryRun);

    return jsonResponse({
      ok: true,
      mode: 'auto_discovery',
      dry_run: dryRun,
      ai_provider: AI_PROVIDER,
      batch_size: BATCH_SIZE,
      default_max_translation_variants: DEFAULT_MAX_TRANSLATION_VARIANTS,
      expression_max_translation_variants: EXPRESSION_MAX_TRANSLATION_VARIANTS,
      eligible_verification_statuses: ELIGIBLE_VERIFICATION_STATUSES,
      candidates_found: limited.length,
      processed_count: processed.filter((p) => !p.skipped).length,
      skipped_count: processed.filter((p) => p.skipped).length,
      processed_lexemes: processed.filter((p) => p.kind === 'lexeme' && !p.skipped).length,
      processed_expressions: processed.filter((p) => p.kind === 'expression' && !p.skipped).length,
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